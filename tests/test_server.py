import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

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
    def test_server_uses_exclusive_port_binding(self):
        self.assertFalse(main.ExclusiveThreadingHTTPServer.allow_reuse_address)

    def test_service_status_reports_configuration_without_exposing_key(self):
        config = {
            "speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"},
            "command_model": {"base_url": "https://example.test/v1", "model": "chat-model"},
        }
        with patch.object(main, "CONFIG", config), patch.dict(os.environ, {"OPENAI_API_KEY": "secret"}, clear=True):
            self.assertEqual(main.service_status(), {
                "cloudTranscriptionConfigured": True,
                "cloudTranscriptionIssue": None,
                "commandModelConfigured": True,
            })
        with patch.object(main, "CONFIG", config), patch.dict(os.environ, {}, clear=True):
            self.assertEqual(main.service_status(), {
                "cloudTranscriptionConfigured": False,
                "cloudTranscriptionIssue": "missing_api_key",
                "commandModelConfigured": False,
            })

    def test_load_env_file_without_overriding_process_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text(
                "# comment\nOPENAI_API_KEY=\"file-key\"\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"OPENAI_API_KEY": "process-key"}, clear=True):
                main.load_env_file(path)
                self.assertEqual(os.environ["OPENAI_API_KEY"], "process-key")

    def test_load_yaml_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.yaml"
            path.write_text(
                "speech_to_text:\n"
                "  base_url: https://speech.test/v1\n"
                "  model: speech-model\n"
                "command_model:\n"
                "  base_url: https://command.test/v1\n"
                "  model: command-model\n",
                encoding="utf-8",
            )
            with patch.object(main, "CONFIG", {
                "speech_to_text": {"base_url": "", "model": ""},
                "command_model": {"base_url": "", "model": ""},
            }):
                config = main.load_config_file(path)
                self.assertEqual(config["speech_to_text"]["model"], "speech-model")
                self.assertEqual(config["command_model"]["base_url"], "https://command.test/v1")

    def test_invalid_yaml_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.yaml"
            path.write_text("speech_to_text:\n  model: only-one-field\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "缺少"):
                main.load_config_file(path)

    def test_unconfigured_model(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(main, "CONFIG", {
            "speech_to_text": {"base_url": "", "model": ""},
            "command_model": {"base_url": "", "model": ""},
        }):
            with self.assertRaisesRegex(RuntimeError, "未配置"):
                main.parse_with_llm("画圆", {})

    def test_valid_model_response(self):
        response = Response({"choices": [{"message": {"content": '[{"type":"create","kind":"circle"}]'}}]})
        config = {"speech_to_text": {"base_url": "", "model": ""}, "command_model": {"base_url": "https://example.test/v1", "model": "model"}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(main, "CONFIG", config), patch("main.urlopen", return_value=response):
            actions = main.parse_with_llm("画圆", {})
        self.assertEqual(actions[0]["kind"], "circle")

    def test_shared_openai_key_is_used_by_both_services(self):
        model_response = Response({"choices": [{"message": {"content": '[{"type":"create","kind":"circle"}]'}}]})
        speech_response = Response({"text": "画一个圆形"})
        config = {
            "command_model": {"base_url": "https://example.test/v1", "model": "model"},
            "speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"},
        }
        with patch.dict(os.environ, {"OPENAI_API_KEY": "shared-key"}, clear=True), patch.object(main, "CONFIG", config), patch("main.urlopen", side_effect=[model_response, speech_response]) as mocked:
            main.parse_with_llm("画圆", {})
            main.transcribe_audio(b"audio", "audio/webm")

        self.assertEqual(mocked.call_args_list[0].args[0].headers["Authorization"], "Bearer shared-key")
        self.assertEqual(mocked.call_args_list[1].args[0].headers["Authorization"], "Bearer shared-key")

    def test_invalid_json_and_action(self):
        with self.assertRaisesRegex(ValueError, "有效 JSON"):
            main.parse_json_content("not-json")
        with self.assertRaisesRegex(ValueError, "不允许"):
            main.parse_json_content('[{"type":"execute_code"}]')

    def test_action_payload_validation(self):
        valid = [
            {"type": "create", "kind": "rect", "fill": "#fff", "opacity": 0.5},
            {"type": "update", "target": "last", "changes": {"width": {"multiply": 2}, "zOrder": "top"}},
            {"type": "move", "target": "selected", "position": "中央"},
            {"type": "align", "target": "selected", "mode": "left"},
            {"type": "distribute", "target": "selected", "axis": "horizontal"},
            {"type": "canvas", "operation": "background", "color": "#ffffff"},
            {"type": "export", "format": "png"},
        ]
        self.assertEqual(main.validate_actions(valid), valid)
        self.assertEqual(
            main.validate_actions([{"type": "canvas", "operation": "clear", "requiresConfirmation": True}])[0]["operation"],
            "clear",
        )

        invalid = [
            {"type": []},
            {"type": "create"},
            {"type": "create", "kind": []},
            {"type": "create", "kind": "rect", "fill": "url(https://example.test/a.svg)"},
            {"type": "create", "kind": "rect", "opacity": True},
            {"type": "update", "target": "selected", "changes": {"x": 10}},
            {"type": "update", "target": "selected", "changes": {"width": {"multiply": 0}}},
            {"type": "move", "target": "selected", "position": "中央", "dx": 1},
            {"type": "align", "target": "selected", "mode": "diagonal"},
            {"type": "canvas", "operation": "clear"},
            {"type": "canvas", "operation": "background", "color": "red"},
            {"type": "export", "format": "pdf"},
            {"type": "help", "payload": "unexpected"},
        ]
        for action in invalid:
            with self.subTest(action=action), self.assertRaises(ValueError):
                main.validate_actions([action])
        with self.assertRaisesRegex(ValueError, "单独执行"):
            main.validate_actions([{"type": "history", "operation": "undo"}, {"type": "help"}])

    def test_timeout_becomes_service_error(self):
        config = {"speech_to_text": {"base_url": "", "model": ""}, "command_model": {"base_url": "https://example.test/v1", "model": "model"}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(main, "CONFIG", config), patch("main.urlopen", side_effect=TimeoutError):
            with self.assertRaisesRegex(RuntimeError, "连接超时"):
                main.parse_with_llm("画圆", {})

    def test_unconfigured_transcription(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(main, "CONFIG", {
            "speech_to_text": {"base_url": "", "model": ""},
            "command_model": {"base_url": "", "model": ""},
        }):
            with self.assertRaisesRegex(RuntimeError, "语音识别未配置"):
                main.transcribe_audio(b"audio", "audio/webm")

    def test_valid_transcription_request(self):
        response = Response({"text": " 画一个红色矩形 "})
        config = {"speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"}, "command_model": {"base_url": "", "model": ""}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(main, "CONFIG", config), patch("main.urlopen", return_value=response) as mocked:
            text = main.transcribe_audio(b"audio-data", "audio/webm;codecs=opus")

        self.assertEqual(text, "画一个红色矩形")
        request = mocked.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.test/v1/audio/transcriptions")
        self.assertIn(b'name="language"\r\n\r\nzh', request.data)
        self.assertIn("矩形".encode(), request.data)
        self.assertIn(b"audio-data", request.data)

    def test_qwen_asr_uses_chat_completions_audio_input(self):
        response = Response({"choices": [{"message": {"content": "画一个蓝色圆形"}}]})
        config = {"speech_to_text": {"base_url": "https://dashscope.test/v1", "model": "qwen3-asr-flash"}, "command_model": {"base_url": "", "model": ""}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(main, "CONFIG", config), patch("main.urlopen", return_value=response) as mocked:
            text = main.transcribe_audio(b"wav-data", "audio/wav")

        self.assertEqual(text, "画一个蓝色圆形")
        request = mocked.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.full_url, "https://dashscope.test/v1/chat/completions")
        self.assertEqual(payload["model"], "qwen3-asr-flash")
        self.assertTrue(payload["messages"][0]["content"][0]["input_audio"]["data"].startswith("data:audio/wav;base64,"))
        self.assertEqual(payload["asr_options"]["language"], "zh")
        self.assertEqual(payload["asr_options"]["enable_itn"], True)

    def test_realtime_transcription_model_is_rejected_with_clear_message(self):
        config = {"speech_to_text": {"base_url": "https://dashscope.test/v1", "model": "qwen-realtime"}, "command_model": {"base_url": "", "model": ""}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(main, "CONFIG", config):
            with self.assertRaisesRegex(RuntimeError, "实时 WebSocket 模型"):
                main.transcribe_audio(b"audio", "audio/webm")
            self.assertEqual(main.service_status()["cloudTranscriptionIssue"], "unsupported_realtime_model")

    def test_transcription_rejects_invalid_audio(self):
        config = {"speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"}, "command_model": {"base_url": "", "model": ""}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(main, "CONFIG", config):
            with self.assertRaisesRegex(ValueError, "音频内容为空"):
                main.transcribe_audio(b"", "audio/webm")
            with self.assertRaisesRegex(ValueError, "音频文件过大"):
                main.transcribe_audio(b"x" * (main.MAX_AUDIO_BYTES + 1), "audio/webm")
            with self.assertRaisesRegex(ValueError, "音频格式"):
                main.transcribe_audio(b"audio", "text/plain")

    def test_transcription_invalid_response_and_timeout(self):
        config = {"speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"}, "command_model": {"base_url": "", "model": ""}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(main, "CONFIG", config), patch("main.urlopen", return_value=Response({"value": "missing"})):
            with self.assertRaisesRegex(ValueError, "响应无效"):
                main.transcribe_audio(b"audio", "audio/webm")
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(main, "CONFIG", config), patch("main.urlopen", side_effect=TimeoutError):
            with self.assertRaisesRegex(RuntimeError, "连接超时"):
                main.transcribe_audio(b"audio", "audio/webm")

    def test_transcription_reports_http_authentication_error(self):
        config = {"speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"}, "command_model": {"base_url": "", "model": ""}}
        error = HTTPError("https://example.test/v1/audio/transcriptions", 401, "Unauthorized", {}, None)
        with patch.dict(os.environ, {"OPENAI_API_KEY": "invalid"}, clear=True), patch.object(main, "CONFIG", config), patch("main.urlopen", side_effect=error):
            with self.assertRaisesRegex(RuntimeError, "密钥无效"):
                main.transcribe_audio(b"audio", "audio/webm")

    def test_system_prompt_contains_composite_decomposition_instructions(self):
        prompt = main.SYSTEM_PROMPT
        self.assertIn("语义概念拆解", prompt)
        self.assertIn("拆解为多个 create 动作", prompt)
        self.assertIn("画一棵树", prompt)
        self.assertIn("画一朵云", prompt)
        self.assertIn("画一个房子", prompt)
        self.assertIn("画一个星星图案", prompt)
        self.assertIn("画一排", prompt)
        self.assertIn("画一列", prompt)
        self.assertIn("画布尺寸为 1000×700", prompt)
        self.assertIn("中心位于 (500, 350)", prompt)

    def test_parse_json_content_accepts_tree_decomposition(self):
        # LLM returns tree as trunk rect + crown circle
        tree_response = json.dumps([
            {"type": "create", "kind": "rect", "x": 460, "y": 350, "width": 80, "height": 150, "fill": "#78350f"},
            {"type": "create", "kind": "circle", "x": 410, "y": 210, "width": 180, "height": 180, "fill": "#22c55e"},
        ])
        actions = main.parse_json_content(tree_response)
        self.assertEqual(len(actions), 2)
        self.assertEqual(actions[0]["kind"], "rect")
        self.assertEqual(actions[1]["kind"], "circle")

    def test_parse_json_content_accepts_cloud_decomposition(self):
        # LLM returns cloud as overlapping circles
        cloud_response = json.dumps([
            {"type": "create", "kind": "circle", "x": 380, "y": 280, "width": 120, "height": 120, "fill": "#ffffff"},
            {"type": "create", "kind": "circle", "x": 440, "y": 260, "width": 140, "height": 140, "fill": "#ffffff"},
            {"type": "create", "kind": "circle", "x": 500, "y": 270, "width": 130, "height": 130, "fill": "#ffffff"},
            {"type": "create", "kind": "circle", "x": 540, "y": 280, "width": 110, "height": 110, "fill": "#ffffff"},
        ])
        actions = main.parse_json_content(cloud_response)
        self.assertEqual(len(actions), 4)
        self.assertTrue(all(a["kind"] == "circle" for a in actions))

    def test_parse_json_content_accepts_house_decomposition(self):
        # LLM returns house as roof + wall + door
        house_response = json.dumps([
            {"type": "create", "kind": "triangle", "x": 400, "y": 210, "width": 200, "height": 140, "fill": "#eab308"},
            {"type": "create", "kind": "rect", "x": 400, "y": 350, "width": 200, "height": 150, "fill": "#f97316"},
            {"type": "create", "kind": "rect", "x": 470, "y": 430, "width": 60, "height": 70, "fill": "#78350f"},
        ])
        actions = main.parse_json_content(house_response)
        self.assertEqual(len(actions), 3)
        self.assertListEqual([a["kind"] for a in actions], ["triangle", "rect", "rect"])

    def test_parse_json_content_rejects_decomposition_with_invalid_kind(self):
        # Should reject actions with invalid shapes in decomposition
        invalid_response = json.dumps([
            {"type": "create", "kind": "rect"},
            {"type": "create", "kind": "hexagon"},
        ])
        with self.assertRaises(ValueError):
            main.parse_json_content(invalid_response)


if __name__ == "__main__":
    unittest.main()
