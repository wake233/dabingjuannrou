"""Local server for Listen Paint."""

import argparse
import base64
import json
import os
import re
import socket
import threading
import uuid
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
CONFIG = {
    "speech_to_text": {"base_url": "", "model": ""},
    "command_model": {"base_url": "", "model": ""},
}
CONFIG_SECTIONS = set(CONFIG)
CONFIG_FIELDS = {"base_url", "model"}
ALLOWED_ACTIONS = {
    "create", "select", "update", "move", "align", "distribute", "duplicate",
    "delete", "group", "ungroup", "history", "canvas", "export", "help", "status",
}
KINDS = {"rect", "circle", "ellipse", "triangle", "star", "line", "arrow", "text"}
POSITIONS = {"左边", "右边", "上边", "下边", "左上角", "右上角", "左下角", "右下角", "中央"}
ALIGN_MODES = {"left", "right", "top", "bottom", "hcenter", "vcenter"}
AXES = {"horizontal", "vertical"}
UPDATE_FIELDS = {"fill", "stroke", "strokeWidth", "opacity", "rotation", "text", "width", "height", "zOrder"}
ACTION_FIELDS = {
    "create": {"type", "kind", "position", "x", "y", "width", "height", "fill", "stroke", "strokeWidth", "opacity", "rotation", "text"},
    "select": {"type", "target"},
    "update": {"type", "target", "changes"},
    "move": {"type", "target", "position", "dx", "dy"},
    "align": {"type", "target", "mode"},
    "distribute": {"type", "target", "axis"},
    "duplicate": {"type", "target"},
    "delete": {"type", "target"},
    "group": {"type", "target"},
    "ungroup": {"type", "target"},
    "history": {"type", "operation"},
    "canvas": {"type", "operation", "color", "requiresConfirmation"},
    "export": {"type", "format"},
    "help": {"type"},
    "status": {"type"},
}
COLOR_PATTERN = re.compile(r"^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$", re.I)
MAX_AUDIO_BYTES = 10 * 1024 * 1024
ALLOWED_AUDIO_TYPES = {
    "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"
}
STT_PROMPT = (
    # Shapes
    "矩形 圆形 椭圆 三角形 星形 直线 箭头 文字 正方形 五角形 椭圆形 长方形 方形 "
    "三角 线条 星星 圆 五角星 多边形 "
    # Colors
    "红色 蓝色 绿色 黄色 黑色 白色 灰色 橙色 紫色 粉色 "
    "青色 棕色 透明 颜色 填充色 描边色 "
    # Actions
    "画 创建 选择 删除 移动 复制 缩放 旋转 撤销 重做 "
    "添加 生成 移除 克隆 放到 放在 移到 改成 设为 "
    # Style
    "填充 描边 线宽 透明度 旋转角度 边框 轮廓 背景色 "
    # Layout
    "置顶 置底 组合 取消组合 顶部对齐 底部对齐 左对齐 右对齐 "
    "水平居中 垂直居中 水平分布 垂直分布 均匀分布 "
    # Position
    "左边 右边 上边 下边 中央 中间 左上角 右上角 左下角 右下角 "
    "左上方 右上方 左下方 右下方 "
    # Canvas / File
    "清空画布 清除画布 画布 保存 导出 下载 SVG PNG "
    "帮助 状态 背景 全部 所有 取消选择 "
    # Numbers
    "一 二 三 四 五 六 七 八 九 十 "
    "零 百 千 一个 两个 三个 四个 五个 "
    # Common phrases
    "画一个 画矩形 画圆形 画椭圆 画三角形 画星形 画直线 画箭头 画文字 "
    "确认 取消 是 否 好的 不要 撤销 重做 休息 停止聆听 "
    # Quantity
    "放大 缩小 宽度 高度 尺寸 像素 "
    # Wake words
    "听画 开始画 嘿画布"
)


def load_env_file(path=ROOT / ".env"):
    """Load simple KEY=VALUE entries without overriding process variables."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return
    for line_number, raw_line in enumerate(lines, 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f".env 第 {line_number} 行格式无效")
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            raise ValueError(f".env 第 {line_number} 行变量名无效")
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def load_config_file(path=ROOT / "config.yaml"):
    """Load the small, mapping-only YAML configuration used by this app."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError as exc:
        raise ValueError("缺少配置文件 config.yaml") from exc
    loaded = {}
    section = None
    for line_number, raw_line in enumerate(lines, 1):
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if not line.startswith((" ", "\t")) and stripped.endswith(":"):
            section = stripped[:-1].strip()
            if section not in CONFIG_SECTIONS:
                raise ValueError(f"config.yaml 第 {line_number} 行配置段无效")
            loaded[section] = {}
            continue
        if section is None or not line.startswith("  ") or ":" not in stripped:
            raise ValueError(f"config.yaml 第 {line_number} 行格式无效")
        key, value = stripped.split(":", 1)
        key, value = key.strip(), value.strip()
        if key not in CONFIG_FIELDS or not value:
            raise ValueError(f"config.yaml 第 {line_number} 行配置项无效")
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        loaded[section][key] = value
    for name in CONFIG_SECTIONS:
        values = loaded.get(name, {})
        if set(values) != CONFIG_FIELDS:
            raise ValueError(f"config.yaml 缺少 {name} 配置")
    CONFIG.clear()
    CONFIG.update(loaded)
    return CONFIG


SYSTEM_PROMPT = """你是纯语音矢量绘图工具的指令解析器。把用户中文指令转换为 JSON 数组。
只允许动作类型：create, select, update, move, align, distribute, duplicate, delete,
group, ungroup, history, canvas, export, help, status。target 可使用 selected、last、lastTwo、all
或上下文中的对象名称。create.kind 只允许 rect,circle,ellipse,triangle,star,line,arrow,text。
颜色只使用十六进制格式。清空画布必须返回 requiresConfirmation: true。
只输出 JSON 数组，不要 Markdown，不要解释。最多 20 个动作。
常见基础指令示例：
- "画一个圆形" → [{"type":"create","kind":"circle"}]
- "画一个红色矩形" → [{"type":"create","kind":"rect","fill":"#ef4444"}]
- "撤销" → [{"type":"history","operation":"undo"}]
- "帮助" → [{"type":"help"}]；只有用户明确询问帮助时才返回 help。

## 语义概念拆解规则
当用户使用抽象语义概念（如树、云、花、星图案等）而非具体形状名称时，需要拆解为多个 create 动作，
每个动作自行计算合理的相对位置和尺寸。画布尺寸为 1000×700，中心位于 (500, 350)。

拆解示例：
- "画一棵树" → 矩形树干 + 圆形树冠：
  [{"type":"create","kind":"rect","x":460,"y":350,"width":80,"height":150,"fill":"#78350f"},
   {"type":"create","kind":"circle","x":410,"y":210,"width":180,"height":180,"fill":"#22c55e"}]
- "画一朵云" → 多个重叠圆形：
  [{"type":"create","kind":"circle","x":380,"y":280,"width":120,"height":120,"fill":"#ffffff"},
   {"type":"create","kind":"circle","x":440,"y":260,"width":140,"height":140,"fill":"#ffffff"},
   {"type":"create","kind":"circle","x":500,"y":270,"width":130,"height":130,"fill":"#ffffff"},
   {"type":"create","kind":"circle","x":540,"y":280,"width":110,"height":110,"fill":"#ffffff"}]
- "画一个房子" → 三角形屋顶 + 矩形墙体 + 矩形门：
  [{"type":"create","kind":"triangle","x":400,"y":210,"width":200,"height":140,"fill":"#eab308"},
   {"type":"create","kind":"rect","x":400,"y":350,"width":200,"height":150,"fill":"#f97316"},
   {"type":"create","kind":"rect","x":470,"y":430,"width":60,"height":70,"fill":"#78350f"}]
- "画一个星星图案" → 五角星中心 + 小星围绕：
  [{"type":"create","kind":"star","x":420,"y":270,"width":160,"height":160,"fill":"#eab308"},
   {"type":"create","kind":"star","x":340,"y":240,"width":60,"height":60,"fill":"#eab308"},
   {"type":"create","kind":"star","x":600,"y":240,"width":60,"height":60,"fill":"#eab308"},
   {"type":"create","kind":"star","x":340,"y":400,"width":60,"height":60,"fill":"#eab308"},
   {"type":"create","kind":"star","x":600,"y":400,"width":60,"height":60,"fill":"#eab308"}]
- "画一排{N}个{形状}" → 水平均匀分布，间距为形状宽度的 1.5 倍
- "画一列{N}个{形状}" → 垂直均匀分布，间距为形状高度的 1.5 倍
- "画一个雪人" → 三个圆形纵向堆叠（底部 r≈60, 中部 r≈40, 头部 r≈25）
- "画一个笑脸" → 圆形脸 + 两个小圆眼 + 椭圆嘴

遇到未列出的语义概念时，按相同思路拆解：识别组成部分 → 为每部分选择合适形状 → 计算相对位置和尺寸。
始终确保各部分位置正确对应（如树冠在树干上方、门在墙体下部居中等）。"""


def require_fields(action, *fields):
    for field in fields:
        if field not in action:
            raise ValueError(f"{action['type']} 缺少字段 {field}")


def finite_number(value, minimum=-1_000_000, maximum=1_000_000):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and minimum <= value <= maximum


def allowed_value(value, allowed):
    return isinstance(value, str) and value in allowed


def validate_target(target, allow_none=False):
    valid_string = isinstance(target, str) and 0 < len(target) <= 100 and (allow_none or target != "none")
    valid_list = (
        isinstance(target, list) and 0 < len(target) <= 100
        and all(isinstance(value, str) and 0 < len(value) <= 100 for value in target)
    )
    if not valid_string and not valid_list:
        raise ValueError("目标字段无效")


def validate_color(value, allow_none=True):
    if not isinstance(value, str) or len(value) > 20 or (value == "none" and not allow_none):
        raise ValueError("颜色字段无效")
    if value != "none" and not COLOR_PATTERN.fullmatch(value):
        raise ValueError("颜色字段无效")


def validate_dimension(value, allow_zero=False):
    minimum = 0 if allow_zero else 0.0000001
    if not finite_number(value, minimum):
        raise ValueError("尺寸字段无效")


def validate_change_value(field, value):
    if field in {"width", "height"} and isinstance(value, dict):
        if set(value) != {"multiply"} or not finite_number(value["multiply"], 0.0000001, 1000):
            raise ValueError("缩放倍数无效")
    elif field in {"fill", "stroke"}:
        validate_color(value)
    elif field == "strokeWidth" and not finite_number(value, 0, 1000):
        raise ValueError("线宽无效")
    elif field == "opacity" and not finite_number(value, 0, 1):
        raise ValueError("透明度无效")
    elif field == "rotation" and not finite_number(value):
        raise ValueError("旋转角度无效")
    elif field == "text" and (not isinstance(value, str) or len(value) > 1000):
        raise ValueError("文字字段无效")
    elif field == "width":
        validate_dimension(value)
    elif field == "height":
        validate_dimension(value, True)
    elif field == "zOrder" and not allowed_value(value, {"top", "bottom"}):
        raise ValueError("层级操作无效")


def validate_action(action):
    action_type = action["type"]
    # Fields prefixed with "_" are browser-side metadata (e.g. _compositeId)
    # and are exempt from the allowed-fields whitelist.
    unknown = {k for k in action if not k.startswith("_")} - ACTION_FIELDS[action_type]
    if unknown:
        raise ValueError(f"{action_type} 包含不允许的字段 {next(iter(unknown))}")
    if action_type == "create":
        require_fields(action, "kind")
        if not allowed_value(action["kind"], KINDS):
            raise ValueError("图形类型无效")
        if "position" in action and not allowed_value(action["position"], POSITIONS):
            raise ValueError("位置字段无效")
        for field in ("x", "y"):
            if field in action and not finite_number(action[field]):
                raise ValueError(f"{field} 字段无效")
        if "width" in action:
            validate_dimension(action["width"])
        if "height" in action:
            validate_dimension(action["height"], action["kind"] in {"line", "arrow"})
        for field in ("fill", "stroke"):
            if field in action:
                validate_color(action[field])
        validate_optional_style(action)
    elif action_type == "select":
        require_fields(action, "target")
        validate_target(action["target"], True)
    elif action_type == "update":
        require_fields(action, "target", "changes")
        validate_target(action["target"])
        changes = action["changes"]
        if not isinstance(changes, dict) or not changes:
            raise ValueError("修改内容无效")
        for field, value in changes.items():
            if field not in UPDATE_FIELDS:
                raise ValueError(f"不能修改属性 {field}")
            validate_change_value(field, value)
    elif action_type == "move":
        require_fields(action, "target")
        validate_target(action["target"])
        has_position = "position" in action
        has_offset = "dx" in action or "dy" in action
        if has_position == has_offset:
            raise ValueError("移动动作必须指定位置或偏移量")
        if has_position and not allowed_value(action["position"], POSITIONS):
            raise ValueError("位置字段无效")
        for field in ("dx", "dy"):
            if field in action and not finite_number(action[field]):
                raise ValueError(f"{field} 字段无效")
    elif action_type in {"align", "distribute"}:
        field = "mode" if action_type == "align" else "axis"
        require_fields(action, "target", field)
        validate_target(action["target"])
        allowed = ALIGN_MODES if action_type == "align" else AXES
        if not allowed_value(action[field], allowed):
            raise ValueError(f"{field} 字段无效")
    elif action_type in {"duplicate", "delete", "group", "ungroup"}:
        require_fields(action, "target")
        validate_target(action["target"])
    elif action_type == "history":
        require_fields(action, "operation")
        if not allowed_value(action["operation"], {"undo", "redo"}):
            raise ValueError("历史操作无效")
    elif action_type == "canvas":
        require_fields(action, "operation")
        if not allowed_value(action["operation"], {"clear", "background"}):
            raise ValueError("画布操作无效")
        if action["operation"] == "clear":
            if action.get("requiresConfirmation") is not True:
                raise ValueError("清空画布必须确认")
            if "color" in action:
                raise ValueError("清空画布不能设置颜色")
        if action["operation"] == "background":
            if "requiresConfirmation" in action:
                raise ValueError("背景操作不能包含确认字段")
            require_fields(action, "color")
            validate_color(action["color"], False)
    elif action_type == "export":
        require_fields(action, "format")
        if not allowed_value(action["format"], {"svg", "png"}):
            raise ValueError("导出格式无效")


def validate_optional_style(action):
    if "strokeWidth" in action and not finite_number(action["strokeWidth"], 0, 1000):
        raise ValueError("线宽无效")
    if "opacity" in action and not finite_number(action["opacity"], 0, 1):
        raise ValueError("透明度无效")
    if "rotation" in action and not finite_number(action["rotation"]):
        raise ValueError("旋转角度无效")
    if "text" in action and (not isinstance(action["text"], str) or len(action["text"]) > 1000):
        raise ValueError("文字字段无效")


def validate_actions(actions):
    if not isinstance(actions, list) or not 1 <= len(actions) <= 20:
        raise ValueError("模型动作数量必须在 1 到 20 之间")
    for action in actions:
        if not isinstance(action, dict) or not allowed_value(action.get("type"), ALLOWED_ACTIONS):
            raise ValueError("模型返回了不允许的动作")
        validate_action(action)
    if any(action["type"] == "history" for action in actions) and len(actions) != 1:
        raise ValueError("撤销或重做必须单独执行")
    return actions


def parse_json_content(content):
    if not isinstance(content, str):
        raise ValueError("模型返回内容不是文本")
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.I)
    try:
        return validate_actions(json.loads(cleaned))
    except json.JSONDecodeError as exc:
        raise ValueError("模型没有返回有效 JSON") from exc


def parse_with_llm(text, context, timeout=12):
    base_url = CONFIG["command_model"]["base_url"].rstrip("/")
    api_key = os.environ.get("OPENAI_API_KEY", "")
    model = CONFIG["command_model"]["model"]
    if not (base_url and api_key and model):
        raise RuntimeError("模型回退未配置")
    payload = {
        "model": model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps({"text": text, "context": context}, ensure_ascii=False)},
        ],
    }
    request = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(service_error_message("命令模型", exc)) from exc
    try:
        return parse_json_content(result["choices"][0]["message"]["content"])
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("模型响应结构无效") from exc


def multipart_field(boundary, name, value):
    return (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
        f"{value}\r\n"
    ).encode("utf-8")


def service_error_message(label, error):
    if isinstance(error, HTTPError):
        messages = {
            400: f"{label}请求无效，请检查模型名称和接口兼容性",
            401: f"{label}密钥无效或已过期",
            403: f"{label}访问被拒绝，请检查账号权限",
            404: f"{label}接口或模型不存在",
            429: f"{label}请求过多或额度不足",
        }
        return messages.get(error.code, f"{label}服务错误（HTTP {error.code}）")
    if isinstance(error, TimeoutError):
        return f"{label}连接超时"
    if isinstance(error, URLError):
        return f"{label}网络连接失败"
    if isinstance(error, json.JSONDecodeError):
        return f"{label}响应格式无效"
    return f"{label}暂时不可用"


def transcribe_chat_audio(audio, content_type, base_url, api_key, model, timeout):
    data_uri = f"data:{content_type};base64,{base64.b64encode(audio).decode('ascii')}"
    payload = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [{"type": "input_audio", "input_audio": {"data": data_uri}}],
        }],
        "stream": False,
        "asr_options": {"language": "zh", "enable_itn": True},
    }
    request = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(service_error_message("云端语音识别", exc)) from exc
    try:
        text = result["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, AttributeError, TypeError) as exc:
        raise ValueError("云端语音识别响应无效") from exc
    if not text:
        raise ValueError("云端语音识别未返回文字")
    return text


def transcribe_audio(audio, content_type="audio/webm", timeout=30):
    base_url = CONFIG["speech_to_text"]["base_url"].rstrip("/")
    api_key = os.environ.get("OPENAI_API_KEY", "")
    model = CONFIG["speech_to_text"]["model"]
    if not api_key:
        raise RuntimeError("云端语音识别未配置 OPENAI_API_KEY")
    if not (base_url and model):
        raise RuntimeError("云端语音识别配置不完整")
    if not isinstance(audio, bytes) or not audio:
        raise ValueError("音频内容为空")
    if len(audio) > MAX_AUDIO_BYTES:
        raise ValueError("音频文件过大")
    content_type = content_type.split(";", 1)[0].strip().lower()
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise ValueError("不支持的音频格式")
    if "realtime" in model:
        raise RuntimeError("当前云端模型是实时 WebSocket 模型，请改用 qwen3-asr-flash")
    if model.startswith("qwen3-asr-flash"):
        return transcribe_chat_audio(audio, content_type, base_url, api_key, model, timeout)

    extension = {
        "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a",
        "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
    }[content_type]
    boundary = f"listen-paint-{uuid.uuid4().hex}"
    file_header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="speech.{extension}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8")
    body = b"".join([
        multipart_field(boundary, "model", model),
        multipart_field(boundary, "language", "zh"),
        multipart_field(boundary, "prompt", STT_PROMPT),
        multipart_field(boundary, "response_format", "json"),
        file_header,
        audio,
        f"\r\n--{boundary}--\r\n".encode("utf-8"),
    ])
    request = Request(
        f"{base_url}/audio/transcriptions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(service_error_message("云端语音识别", exc)) from exc
    try:
        text = result["text"].strip()
    except (KeyError, AttributeError, TypeError) as exc:
        raise ValueError("云端语音识别响应无效") from exc
    if not text:
        raise ValueError("云端语音识别未返回文字")
    return text


def service_status():
    api_key_configured = bool(os.environ.get("OPENAI_API_KEY", "").strip())
    stt_configured = bool(CONFIG["speech_to_text"]["base_url"] and CONFIG["speech_to_text"]["model"])
    stt_realtime_model = "realtime" in CONFIG["speech_to_text"]["model"]
    if not stt_configured:
        stt_issue = "missing_config"
    elif not api_key_configured:
        stt_issue = "missing_api_key"
    elif stt_realtime_model:
        stt_issue = "unsupported_realtime_model"
    else:
        stt_issue = None
    return {
        "cloudTranscriptionConfigured": stt_issue is None,
        "cloudTranscriptionIssue": stt_issue,
        "commandModelConfigured": bool(
            CONFIG["command_model"]["base_url"]
            and CONFIG["command_model"]["model"]
            and api_key_configured
        ),
    }


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == "/api/status":
            self.send_json(200, {"apiVersion": 1, **service_status()})
            return
        super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in {"/api/parse", "/api/transcribe"}:
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if path == "/api/transcribe":
                if length <= 0:
                    raise ValueError("音频内容为空")
                if length > MAX_AUDIO_BYTES:
                    raise ValueError("音频文件过大")
                audio = self.rfile.read(length)
                text = transcribe_audio(audio, self.headers.get("Content-Type", ""))
                self.send_json(200, {"text": text})
                return
            if length > 100_000:
                raise ValueError("请求过大")
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("请求结构无效")
            text = body.get("text", "")
            if not isinstance(text, str) or not text.strip() or len(text) > 1000:
                raise ValueError("指令文本无效")
            context = body.get("context", {})
            if not isinstance(context, dict):
                raise ValueError("上下文无效")
            actions = parse_with_llm(text, context)
            self.send_json(200, {"actions": actions})
        except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})

    def send_json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Listen-Paint-API", "1")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class ExclusiveThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    load_env_file()
    load_config_file()
    parser = argparse.ArgumentParser(description="启动听画本地服务")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    try:
        server = ExclusiveThreadingHTTPServer((args.host, args.port), AppHandler)
    except OSError as exc:
        raise SystemExit(
            f"无法启动听画：端口 {args.port} 已被占用。请关闭旧的听画服务后重试。"
        ) from exc
    url = f"http://{args.host}:{args.port}"
    print(f"听画已启动：{url}")
    if not args.no_browser:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
