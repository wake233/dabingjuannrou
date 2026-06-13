"""Server entry point for Listen Paint."""

import argparse
import socket
import threading
import webbrowser
from http.server import ThreadingHTTPServer

from server.config import load_env_file, load_config_file
from server.handler import AppHandler


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
