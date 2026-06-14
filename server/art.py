"""Constrained artistic planning and cloud texture services."""

import base64
import hashlib
import json
import os
import struct
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from server.client import ServiceError, service_error
from server.config import CONFIG

ALLOWED_STYLES = {"storybook", "woodcut", "ink"}
ALLOWED_TEXTURE_TYPES = {"paper", "carved", "ink-wash"}
MAX_TEXTURE_SIZE = 2048
MAX_TEXTURE_PROMPT = 500
MAX_TEXTURE_BYTES = 5 * 1024 * 1024
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PNG_END = b"\x00\x00\x00\x00IEND\xaeB`\x82"
MAX_TEXTURE_RESPONSE_BYTES = MAX_TEXTURE_BYTES * 2 + 4096

DRAFT_STRATEGIES = {
    "storybook": [("left-third", "diagonal-rise", "hero-large", "right-open"), ("center-low", "s-curve", "environment-large", "top-open"), ("right-third", "horizontal-calm", "hero-distant", "left-open")],
    "woodcut": [("left-edge", "hard-diagonal", "hero-large", "split-open"), ("center-high", "vertical-thrust", "environment-large", "bottom-open"), ("right-edge", "zigzag", "hero-distant", "center-open")],
    "ink": [("left-low", "floating-diagonal", "hero-small", "right-open"), ("center-low", "vertical-drift", "environment-large", "top-open"), ("right-low", "horizontal-pause", "hero-distant", "left-open")],
}


def validate_texture_request(body):
    if not isinstance(body, dict) or set(body) - {"prompt", "style", "textureType", "width", "height"}:
        raise ValueError("纹理请求结构无效")
    prompt = body.get("prompt")
    style = body.get("style")
    texture_type = body.get("textureType")
    width, height = body.get("width"), body.get("height")
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > MAX_TEXTURE_PROMPT:
        raise ValueError("纹理提示词无效")
    if style not in ALLOWED_STYLES or texture_type not in ALLOWED_TEXTURE_TYPES:
        raise ValueError("纹理类型无效")
    if not isinstance(width, int) or isinstance(width, bool) or not 1 <= width <= MAX_TEXTURE_SIZE:
        raise ValueError("纹理宽度无效")
    if not isinstance(height, int) or isinstance(height, bool) or not 1 <= height <= MAX_TEXTURE_SIZE:
        raise ValueError("纹理高度无效")
    lowered = prompt.lower()
    if any(token in lowered for token in ("http://", "https://", "<svg", "<script", "data:image/svg")):
        raise ValueError("纹理提示词包含不允许内容")
    return {"prompt": prompt.strip(), "style": style, "textureType": texture_type, "width": width, "height": height}


def validate_generated_png(encoded):
    if not isinstance(encoded, str) or not encoded or len(encoded) > MAX_TEXTURE_BYTES * 2:
        raise ServiceError("云端纹理响应无效", "invalid_response", False, 502)
    try:
        image = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError) as exc:
        raise ServiceError("云端纹理不是有效 PNG", "invalid_response", False, 502) from exc
    if len(image) > MAX_TEXTURE_BYTES:
        raise ServiceError("云端纹理文件过大", "invalid_response", False, 502)
    if (len(image) < 36 or not image.startswith(PNG_SIGNATURE)
            or image[12:16] != b"IHDR" or not image.endswith(PNG_END)):
        raise ServiceError("云端纹理不是有效 PNG", "invalid_response", False, 502)
    width, height = struct.unpack(">II", image[16:24])
    if not 1 <= width <= MAX_TEXTURE_SIZE or not 1 <= height <= MAX_TEXTURE_SIZE:
        raise ServiceError("云端纹理尺寸超限", "invalid_response", False, 502)
    return image, width, height


def generate_texture(body, timeout=45):
    request = validate_texture_request(body)
    config = CONFIG.get("texture_model", {})
    base_url = config.get("base_url", "").rstrip("/")
    model = config.get("model", "")
    api_key = os.environ.get("TEXTURE_API_KEY", "") or os.environ.get("OPENAI_API_KEY", "")
    if not (base_url and model and api_key):
        raise ServiceError("云端纹理未配置，继续使用无纹理矢量版本", "configuration_missing", False, 503)
    prompt = (
        f"Seamless {request['style']} {request['textureType']} texture only. "
        f"No text, no objects, no scene, no SVG. {request['prompt']}"
    )
    payload = {
        "model": model,
        "prompt": prompt,
        "size": f"{request['width']}x{request['height']}",
        "response_format": "b64_json",
        "n": 1,
    }
    cloud_request = Request(
        f"{base_url}/images/generations",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urlopen(cloud_request, timeout=timeout) as response:
            raw_response = response.read(MAX_TEXTURE_RESPONSE_BYTES + 1)
            if len(raw_response) > MAX_TEXTURE_RESPONSE_BYTES:
                raise ServiceError("云端纹理响应过大", "invalid_response", False, 502)
            result = json.loads(raw_response.decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise service_error("云端纹理", exc) from exc
    try:
        encoded = result["data"][0]["b64_json"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ServiceError("云端纹理响应结构无效", "invalid_response", False, 502) from exc
    _, width, height = validate_generated_png(encoded)
    digest = hashlib.sha256((model + prompt + encoded).encode("utf-8")).hexdigest()
    return {
        "mimeType": "image/png",
        "imageBase64": encoded,
        "width": width,
        "height": height,
        "cacheKey": f"texture-{digest[:24]}",
        "model": model,
        "prompt": request["prompt"],
    }


def compose_drafts(body):
    if not isinstance(body, dict) or set(body) - {"theme", "style", "context"}:
        raise ValueError("小稿请求结构无效")
    theme, style = body.get("theme"), body.get("style")
    if not isinstance(theme, str) or not theme.strip() or len(theme) > 500 or style not in ALLOWED_STYLES:
        raise ValueError("小稿请求无效")
    drafts = []
    for index, (focus, flow, scale, negative_space) in enumerate(DRAFT_STRATEGIES[style], 1):
        drafts.append({"id": f"draft-1-{index}", "theme": theme.strip(), "style": style, "focus": focus,
                       "flow": flow, "scale": scale, "negativeSpace": negative_space})
    return {"drafts": drafts}


def refine_artwork(body):
    if not isinstance(body, dict) or set(body) - {"instruction", "locks", "context"}:
        raise ValueError("精修请求结构无效")
    instruction, locks = body.get("instruction"), body.get("locks", {})
    if not isinstance(instruction, str) or not instruction.strip() or len(instruction) > 500:
        raise ValueError("精修意图无效")
    if not isinstance(locks, dict) or set(locks) - {"fields", "entities"}:
        raise ValueError("精修锁定无效")
    fields, entities = locks.get("fields", []), locks.get("entities", [])
    if not isinstance(fields, list) or not isinstance(entities, list) or any(not isinstance(value, str) for value in fields + entities):
        raise ValueError("精修锁定无效")
    intent_changes, composition_changes = {}, {}
    if "atmosphere" not in fields and "孤独" in instruction:
        intent_changes["emotion"] = "孤独、克制"
    if "rhythm" not in fields and "风" in instruction:
        intent_changes["rhythm"] = "强烈的方向性风感"
    if "negativeSpace" not in fields and "右侧留白" in instruction:
        composition_changes["negativeSpace"] = "right-open"
    return {"intentChanges": intent_changes, "compositionChanges": composition_changes, "entityChanges": []}
