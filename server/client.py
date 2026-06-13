"""LLM and STT HTTP clients for Listen Paint."""

import base64
import json
import os
import re
import uuid
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from server.config import CONFIG
from server.prompt import SYSTEM_PROMPT
from server.schema import ALLOWED_AUDIO_TYPES, MAX_AUDIO_BYTES, STT_PROMPT, validate_actions


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
