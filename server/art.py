"""Constrained artistic planning and procedural texture services."""

import base64
import hashlib

ALLOWED_STYLES = {"storybook", "woodcut", "ink"}
ALLOWED_TEXTURE_TYPES = {"paper", "carved", "ink-wash"}
MAX_TEXTURE_SIZE = 2048
MAX_TEXTURE_PROMPT = 500

# A safe, local 1x1 PNG placeholder. The browser scales and blends it while the
# structured vector artwork remains fully available and editable.
PNG_1X1 = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")

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


def generate_texture(body):
    request = validate_texture_request(body)
    digest = hashlib.sha256(repr(sorted(request.items())).encode("utf-8")).hexdigest()
    return {
        "mimeType": "image/png",
        "imageBase64": base64.b64encode(PNG_1X1).decode("ascii"),
        "width": request["width"],
        "height": request["height"],
        "cacheKey": f"texture-{digest[:24]}",
        "model": "listen-paint-procedural-texture-v1",
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
