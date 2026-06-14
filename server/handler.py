"""HTTP request handler for Listen Paint."""

import json
from http.server import SimpleHTTPRequestHandler
from urllib.parse import urlsplit

from server.config import STATIC
from server.schema import MAX_AUDIO_BYTES
from server.client import ServiceError, transcribe_audio, parse_with_llm, interpret_with_llm
from server.art import compose_drafts, generate_texture, refine_artwork


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == "/api/status":
            from server.client import service_status
            self.send_json(200, {"apiVersion": 1, **service_status()})
            return
        super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in {"/api/parse", "/api/interpret", "/api/transcribe", "/api/generate-texture", "/api/compose-drafts", "/api/refine-artwork"}:
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
            if length <= 0:
                raise ValueError("请求内容为空")
            if length > 100_000:
                raise ValueError("请求过大")
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("请求结构无效")
            if path == "/api/generate-texture":
                self.send_json(200, generate_texture(body))
                return
            if path == "/api/compose-drafts":
                self.send_json(200, compose_drafts(body))
                return
            if path == "/api/refine-artwork":
                self.send_json(200, refine_artwork(body))
                return
            text = body.get("text", "")
            if not isinstance(text, str) or not text.strip() or len(text) > 1000:
                raise ValueError("指令文本无效")
            context = body.get("context", {})
            if not isinstance(context, dict):
                raise ValueError("上下文无效")
            if path == "/api/interpret":
                self.send_json(200, interpret_with_llm(text, context))
            else:
                actions = parse_with_llm(text, context)
                self.send_json(200, {"actions": actions})
        except ServiceError as exc:
            self.send_json(exc.status, {
                "error": str(exc),
                "errorCode": exc.error_code,
                "retryable": exc.retryable,
            })
        except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
            self.send_json(400, {
                "error": str(exc),
                "errorCode": "invalid_request",
                "retryable": False,
            })

    def send_json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Listen-Paint-API", "1")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
