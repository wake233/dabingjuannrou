"""Local server for Listen Paint."""

import argparse
import json
import os
import re
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
ALLOWED_ACTIONS = {
    "create", "select", "update", "move", "align", "distribute", "duplicate",
    "delete", "group", "ungroup", "history", "canvas", "export", "help", "status",
}

SYSTEM_PROMPT = """你是纯语音矢量绘图工具的指令解析器。把用户中文指令转换为 JSON 数组。
只允许动作类型：create, select, update, move, align, distribute, duplicate, delete,
group, ungroup, history, canvas, export, help, status。target 可使用 selected、last、lastTwo、all
或上下文中的对象名称。create.kind 只允许 rect,circle,ellipse,triangle,star,line,arrow,text。
只输出 JSON 数组，不要 Markdown，不要解释。最多 20 个动作。"""


def validate_actions(actions):
    if not isinstance(actions, list) or not 1 <= len(actions) <= 20:
        raise ValueError("模型动作数量必须在 1 到 20 之间")
    for action in actions:
        if not isinstance(action, dict) or action.get("type") not in ALLOWED_ACTIONS:
            raise ValueError("模型返回了不允许的动作")
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
    base_url = os.environ.get("LLM_BASE_URL", "").rstrip("/")
    api_key = os.environ.get("LLM_API_KEY", "")
    model = os.environ.get("LLM_MODEL", "")
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
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("模型服务暂时不可用") from exc
    try:
        return parse_json_content(result["choices"][0]["message"]["content"])
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("模型响应结构无效") from exc


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def do_POST(self):
        if self.path != "/api/parse":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 100_000:
                raise ValueError("请求过大")
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            text = body.get("text", "")
            if not isinstance(text, str) or not text.strip() or len(text) > 1000:
                raise ValueError("指令文本无效")
            actions = parse_with_llm(text, body.get("context", {}))
            self.send_json(200, {"actions": actions})
        except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})

    def send_json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    parser = argparse.ArgumentParser(description="启动听画本地服务")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), AppHandler)
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
