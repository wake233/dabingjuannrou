import json
import os
import unittest
from unittest.mock import MagicMock, patch

import main


class Response:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return None

    def read(self):
        return json.dumps(self.body).encode()


class ServerTests(unittest.TestCase):
    def test_unconfigured_model(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "未配置"):
                main.parse_with_llm("画圆", {})

    def test_valid_model_response(self):
        response = Response({"choices": [{"message": {"content": '[{"type":"create","kind":"circle"}]'}}]})
        env = {"LLM_BASE_URL": "https://example.test/v1", "LLM_API_KEY": "key", "LLM_MODEL": "model"}
        with patch.dict(os.environ, env, clear=True), patch("main.urlopen", return_value=response):
            actions = main.parse_with_llm("画圆", {})
        self.assertEqual(actions[0]["kind"], "circle")

    def test_invalid_json_and_action(self):
        with self.assertRaisesRegex(ValueError, "有效 JSON"):
            main.parse_json_content("not-json")
        with self.assertRaisesRegex(ValueError, "不允许"):
            main.parse_json_content('[{"type":"execute_code"}]')

    def test_timeout_becomes_service_error(self):
        env = {"LLM_BASE_URL": "https://example.test/v1", "LLM_API_KEY": "key", "LLM_MODEL": "model"}
        with patch.dict(os.environ, env, clear=True), patch("main.urlopen", side_effect=TimeoutError):
            with self.assertRaisesRegex(RuntimeError, "暂时不可用"):
                main.parse_with_llm("画圆", {})


if __name__ == "__main__":
    unittest.main()
