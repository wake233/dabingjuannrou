import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

import server.config
import server.client
from server.config import CONFIG, load_env_file, load_config_file
from server.schema import MAX_AUDIO_BYTES, validate_actions, validate_interpretation
from server.art import compose_drafts, generate_texture, refine_artwork, validate_texture_request
from server.client import (
    ServiceError, parse_json_content, parse_with_llm, parse_interpretation_content,
    transcribe_audio, service_status,
)
from server.handler import AppHandler
from server.server import ExclusiveThreadingHTTPServer
from server.prompt import SYSTEM_PROMPT


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
    def test_creative_action_validation(self):
        actions = [{"type": "creative", "operation": "generate_drafts", "theme": "雨中归人", "style": "ink"}]
        self.assertEqual(validate_actions(actions), actions)
        for action in [
            {"type": "creative", "operation": "set_style", "style": "oil"},
            {"type": "creative", "operation": "mix_drafts", "draftIds": ["one"]},
            {"type": "creative", "operation": "lock"},
        ]:
            with self.assertRaises(ValueError):
                validate_actions([action])

    def test_texture_request_is_constrained_and_returns_png_metadata(self):
        request = {"prompt": "soft paper", "style": "storybook", "textureType": "paper", "width": 1000, "height": 700}
        self.assertEqual(validate_texture_request(request), request)
        result = generate_texture(request)
        self.assertEqual(result["mimeType"], "image/png")
        self.assertTrue(result["imageBase64"])
        self.assertTrue(result["cacheKey"].startswith("texture-"))
        for invalid in [
            {**request, "prompt": "https://evil.test/image.png"},
            {**request, "prompt": "<svg/>"},
            {**request, "width": 4096},
            {**request, "textureType": "external"},
            {**request, "url": "https://evil.test"},
        ]:
            with self.assertRaises(ValueError):
                validate_texture_request(invalid)

    def test_texture_action_validation(self):
        action = {"type": "texture", "operation": "apply", "prompt": "paper", "model": "safe",
                  "cacheKey": "texture-one", "mimeType": "image/png", "width": 1000, "height": 700}
        self.assertEqual(validate_actions([action]), [action])
        with self.assertRaises(ValueError):
            validate_actions([{**action, "mimeType": "image/svg+xml"}])

    def test_compose_and_refine_artwork_services_are_structured_and_lock_aware(self):
        drafts = compose_drafts({"theme": "雨中归人", "style": "woodcut", "context": {}})["drafts"]
        self.assertEqual(len(drafts), 3)
        for field in ("focus", "flow", "scale", "negativeSpace"):
            self.assertEqual(len({draft[field] for draft in drafts}), 3)
        refined = refine_artwork({"instruction": "更孤独，加强风感，右侧留白更多",
                                  "locks": {"fields": ["atmosphere"], "entities": ["entity-1"]}, "context": {}})
        self.assertNotIn("emotion", refined["intentChanges"])
        self.assertEqual(refined["intentChanges"]["rhythm"], "强烈的方向性风感")
        self.assertEqual(refined["compositionChanges"]["negativeSpace"], "right-open")
        with self.assertRaises(ValueError):
            compose_drafts({"theme": "x", "style": "oil", "context": {}})

    def test_shared_action_validation_vectors(self):
        vectors = json.loads((Path(__file__).parent / "action_vectors.json").read_text(encoding="utf-8"))
        for actions in vectors["valid"]:
            with self.subTest(kind="valid", actions=actions):
                self.assertEqual(validate_actions(actions), actions)
        for actions in vectors["invalid"]:
            with self.subTest(kind="invalid", actions=actions), self.assertRaises(ValueError):
                validate_actions(actions)

    def test_server_uses_exclusive_port_binding(self):
        self.assertFalse(ExclusiveThreadingHTTPServer.allow_reuse_address)

    def test_service_status_reports_configuration_without_exposing_key(self):
        config = {
            "speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"},
            "command_model": {"base_url": "https://example.test/v1", "model": "chat-model"},
        }
        with patch.object(server.client, "CONFIG", config), patch.dict(os.environ, {"OPENAI_API_KEY": "secret"}, clear=True):
            self.assertEqual(service_status(), {
                "cloudTranscriptionConfigured": True,
                "cloudTranscriptionIssue": None,
                "commandModelConfigured": True,
            })
        with patch.object(server.client, "CONFIG", config), patch.dict(os.environ, {}, clear=True):
            self.assertEqual(service_status(), {
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
                load_env_file(path)
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
            with patch.object(server.config, "CONFIG", {
                "speech_to_text": {"base_url": "", "model": ""},
                "command_model": {"base_url": "", "model": ""},
            }):
                config = load_config_file(path)
                self.assertEqual(config["speech_to_text"]["model"], "speech-model")
                self.assertEqual(config["command_model"]["base_url"], "https://command.test/v1")

    def test_invalid_yaml_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.yaml"
            path.write_text("speech_to_text:\n  model: only-one-field\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "缺少"):
                load_config_file(path)

    def test_unconfigured_model(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(server.client, "CONFIG", {
            "speech_to_text": {"base_url": "", "model": ""},
            "command_model": {"base_url": "", "model": ""},
        }):
            with self.assertRaisesRegex(RuntimeError, "未配置"):
                parse_with_llm("画圆", {})

    def test_valid_model_response(self):
        response = Response({"choices": [{"message": {"content": '[{"type":"create","kind":"circle"}]'}}]})
        config = {"speech_to_text": {"base_url": "", "model": ""}, "command_model": {"base_url": "https://example.test/v1", "model": "model"}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", return_value=response):
            actions = parse_with_llm("画圆", {})
        self.assertEqual(actions[0]["kind"], "circle")

    def test_invalid_model_response_is_classified(self):
        response = Response({"choices": [{"message": {"content": "not-json"}}]})
        config = {"speech_to_text": {"base_url": "", "model": ""}, "command_model": {"base_url": "https://example.test/v1", "model": "model"}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", return_value=response):
            with self.assertRaises(ServiceError) as caught:
                parse_with_llm("画圆", {})
        self.assertEqual(caught.exception.error_code, "invalid_response")
        self.assertFalse(caught.exception.retryable)

    def test_shared_openai_key_is_used_by_both_services(self):
        model_response = Response({"choices": [{"message": {"content": '[{"type":"create","kind":"circle"}]'}}]})
        speech_response = Response({"text": "画一个圆形"})
        config = {
            "command_model": {"base_url": "https://example.test/v1", "model": "model"},
            "speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"},
        }
        with patch.dict(os.environ, {"OPENAI_API_KEY": "shared-key"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", side_effect=[model_response, speech_response]) as mocked:
            parse_with_llm("画圆", {})
            transcribe_audio(b"audio", "audio/webm")

        self.assertEqual(mocked.call_args_list[0].args[0].headers["Authorization"], "Bearer shared-key")
        self.assertEqual(mocked.call_args_list[1].args[0].headers["Authorization"], "Bearer shared-key")

    def test_invalid_json_and_action(self):
        with self.assertRaisesRegex(ValueError, "有效 JSON"):
            parse_json_content("not-json")
        with self.assertRaisesRegex(ValueError, "不允许"):
            parse_json_content('[{"type":"execute_code"}]')

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
        self.assertEqual(validate_actions(valid), valid)
        self.assertEqual(
            validate_actions([{"type": "canvas", "operation": "clear"}])[0]["operation"],
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
            {"type": "canvas", "operation": "background", "color": "red"},
            {"type": "export", "format": "pdf"},
            {"type": "help", "payload": "unexpected"},
            {"type": "create", "kind": "rect", "_compositeId": 1},
            {"type": "create", "kind": "rect", "_private": 1},
        ]
        for action in invalid:
            with self.subTest(action=action), self.assertRaises(ValueError):
                validate_actions([action])
        with self.assertRaisesRegex(ValueError, "单独执行"):
            validate_actions([{"type": "history", "operation": "undo"}, {"type": "help"}])

    def test_parse_endpoint_rejects_non_positive_or_missing_content_length(self):
        handler = object.__new__(AppHandler)
        handler.path = "/api/parse"
        handler.rfile = MagicMock()
        handler.send_json = MagicMock()
        for value in (None, "0", "-1"):
            with self.subTest(value=value):
                handler.headers = {} if value is None else {"Content-Length": value}
                handler.do_POST()
                self.assertEqual(handler.rfile.read.call_count, 0)
                self.assertEqual(handler.send_json.call_args.args[0], 400)
                self.assertEqual(handler.send_json.call_args.args[1]["errorCode"], "invalid_request")
                self.assertFalse(handler.send_json.call_args.args[1]["retryable"])
                handler.rfile.reset_mock()
                handler.send_json.reset_mock()

    def test_timeout_becomes_service_error(self):
        config = {"speech_to_text": {"base_url": "", "model": ""}, "command_model": {"base_url": "https://example.test/v1", "model": "model"}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", side_effect=TimeoutError):
            with self.assertRaisesRegex(RuntimeError, "连接超时"):
                parse_with_llm("画圆", {})

    def test_unconfigured_transcription(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(server.client, "CONFIG", {
            "speech_to_text": {"base_url": "", "model": ""},
            "command_model": {"base_url": "", "model": ""},
        }):
            with self.assertRaisesRegex(RuntimeError, "语音识别未配置"):
                transcribe_audio(b"audio", "audio/webm")

    def test_valid_transcription_request(self):
        response = Response({"text": " 画一个红色矩形 "})
        config = {"speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"}, "command_model": {"base_url": "", "model": ""}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", return_value=response) as mocked:
            text = transcribe_audio(b"audio-data", "audio/webm;codecs=opus")

        self.assertEqual(text, "画一个红色矩形")
        request = mocked.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.test/v1/audio/transcriptions")
        self.assertIn(b'name="language"\r\n\r\nzh', request.data)
        self.assertIn("矩形".encode(), request.data)
        self.assertIn(b"audio-data", request.data)

    def test_qwen_asr_uses_chat_completions_audio_input(self):
        response = Response({"choices": [{"message": {"content": "画一个蓝色圆形"}}]})
        config = {"speech_to_text": {"base_url": "https://dashscope.test/v1", "model": "qwen3-asr-flash"}, "command_model": {"base_url": "", "model": ""}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", return_value=response) as mocked:
            text = transcribe_audio(b"wav-data", "audio/wav")

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
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config):
            with self.assertRaisesRegex(RuntimeError, "实时 WebSocket 模型"):
                transcribe_audio(b"audio", "audio/webm")
            self.assertEqual(service_status()["cloudTranscriptionIssue"], "unsupported_realtime_model")

    def test_transcription_rejects_invalid_audio(self):
        config = {"speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"}, "command_model": {"base_url": "", "model": ""}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config):
            with self.assertRaisesRegex(ValueError, "音频内容为空"):
                transcribe_audio(b"", "audio/webm")
            with self.assertRaisesRegex(ValueError, "音频文件过大"):
                transcribe_audio(b"x" * (MAX_AUDIO_BYTES + 1), "audio/webm")
            with self.assertRaisesRegex(ValueError, "音频格式"):
                transcribe_audio(b"audio", "text/plain")

    def test_transcription_invalid_response_and_timeout(self):
        config = {"speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"}, "command_model": {"base_url": "", "model": ""}}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", return_value=Response({"value": "missing"})):
            with self.assertRaisesRegex(ServiceError, "响应无效"):
                transcribe_audio(b"audio", "audio/webm")
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", side_effect=TimeoutError):
            with self.assertRaisesRegex(RuntimeError, "连接超时"):
                transcribe_audio(b"audio", "audio/webm")

    def test_transcription_reports_http_authentication_error(self):
        config = {"speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"}, "command_model": {"base_url": "", "model": ""}}
        error = HTTPError("https://example.test/v1/audio/transcriptions", 401, "Unauthorized", {}, None)
        with patch.dict(os.environ, {"OPENAI_API_KEY": "invalid"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", side_effect=error):
            with self.assertRaisesRegex(RuntimeError, "密钥无效"):
                transcribe_audio(b"audio", "audio/webm")

    def test_cloud_error_classification_and_retryability(self):
        config = {"speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"}, "command_model": {"base_url": "", "model": ""}}
        cases = [
            (HTTPError("https://example.test", 401, "Unauthorized", {}, None), "authentication_failed", False),
            (HTTPError("https://example.test", 403, "Forbidden", {}, None), "permission_denied", False),
            (HTTPError("https://example.test", 404, "Missing", {}, None), "model_not_found", False),
            (HTTPError("https://example.test", 429, "Limited", {}, None), "rate_limited", True),
            (URLError("offline"), "network_failure", True),
            (TimeoutError(), "timeout", True),
        ]
        for raised, code, retryable in cases:
            with self.subTest(code=code), patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", side_effect=raised):
                with self.assertRaises(ServiceError) as caught:
                    transcribe_audio(b"audio", "audio/webm")
                self.assertEqual(caught.exception.error_code, code)
                self.assertEqual(caught.exception.retryable, retryable)

    def test_invalid_and_empty_transcription_are_classified(self):
        config = {"speech_to_text": {"base_url": "https://example.test/v1", "model": "stt-model"}, "command_model": {"base_url": "", "model": ""}}
        for response, code, retryable in [
            (Response({"value": "missing"}), "invalid_response", False),
            (Response({"text": "  "}), "empty_transcription", True),
        ]:
            with self.subTest(code=code), patch.dict(os.environ, {"OPENAI_API_KEY": "key"}, clear=True), patch.object(server.client, "CONFIG", config), patch("server.client.urlopen", return_value=response):
                with self.assertRaises(ServiceError) as caught:
                    transcribe_audio(b"audio", "audio/webm")
                self.assertEqual(caught.exception.error_code, code)
                self.assertEqual(caught.exception.retryable, retryable)

    def test_handler_serializes_structured_service_error(self):
        handler = object.__new__(AppHandler)
        handler.path = "/api/transcribe"
        handler.headers = {"Content-Length": "5", "Content-Type": "audio/webm"}
        handler.rfile = MagicMock()
        handler.send_json = MagicMock()
        error = ServiceError("请求过多", "rate_limited", True, 429)
        with patch("server.handler.transcribe_audio", side_effect=error):
            handler.do_POST()
        self.assertEqual(handler.send_json.call_args.args, (429, {
            "error": "请求过多",
            "errorCode": "rate_limited",
            "retryable": True,
        }))

    def test_system_prompt_contains_composite_decomposition_instructions(self):
        prompt = SYSTEM_PROMPT
        self.assertIn("scene_plan", prompt)
        self.assertIn("scene_revision", prompt)
        self.assertIn("实体模板白名单", prompt)
        self.assertIn("不得输出 svg", prompt)
        self.assertIn("现有实体边界", prompt)
        self.assertIn("画布尺寸为 1000×700", prompt)
        self.assertIn("storybook", prompt)

    def test_parse_json_content_accepts_tree_decomposition(self):
        # LLM returns tree as trunk rect + crown circle
        tree_response = json.dumps([
            {"type": "create", "kind": "rect", "x": 460, "y": 350, "width": 80, "height": 150, "fill": "#78350f"},
            {"type": "create", "kind": "circle", "x": 410, "y": 210, "width": 180, "height": 180, "fill": "#22c55e"},
        ])
        actions = parse_json_content(tree_response)
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
        actions = parse_json_content(cloud_response)
        self.assertEqual(len(actions), 4)
        self.assertTrue(all(a["kind"] == "circle" for a in actions))

    def test_parse_json_content_accepts_house_decomposition(self):
        # LLM returns house as roof + wall + door
        house_response = json.dumps([
            {"type": "create", "kind": "triangle", "x": 400, "y": 210, "width": 200, "height": 140, "fill": "#eab308"},
            {"type": "create", "kind": "rect", "x": 400, "y": 350, "width": 200, "height": 150, "fill": "#f97316"},
            {"type": "create", "kind": "rect", "x": 470, "y": 430, "width": 60, "height": 70, "fill": "#78350f"},
        ])
        actions = parse_json_content(house_response)
        self.assertEqual(len(actions), 3)
        self.assertListEqual([a["kind"] for a in actions], ["triangle", "rect", "rect"])

    def test_parse_json_content_rejects_decomposition_with_invalid_kind(self):
        # Should reject actions with invalid shapes in decomposition
        invalid_response = json.dumps([
            {"type": "create", "kind": "rect"},
            {"type": "create", "kind": "hexagon"},
        ])
        with self.assertRaises(ValueError):
            parse_json_content(invalid_response)

    def test_interpretation_union_accepts_actions_scene_plan_and_revision(self):
        actions = {"kind": "actions", "actions": [{"type": "create", "kind": "circle"}]}
        plan = {
            "kind": "scene_plan",
            "scene": {"theme": "雨夜", "mood": "安静", "composition": "人物在左", "summary": "雨中人物", "ignored": ["龙"]},
            "entities": [
                {"templateId": "person", "name": "人物", "role": "主角", "x": 200, "y": 250, "width": 100, "height": 220, "params": {"direction": "right"}},
                {"templateId": "rain", "name": "雨", "role": "天气", "x": 0, "y": 0, "width": 1000, "height": 700, "params": {"density": 0.7}},
            ],
        }
        revision = {"kind": "scene_revision", "actions": [
            {"type": "entity_update", "target": "雨", "changes": {"params": {"density": 0.9}}},
            {"type": "scene_update", "changes": {"mood": "热闹"}},
        ]}
        for result in [actions, plan, revision]:
            self.assertEqual(validate_interpretation(result), result)
            self.assertEqual(parse_interpretation_content(json.dumps(result, ensure_ascii=False)), result)
        self.assertEqual(parse_interpretation_content('[{"type":"create","kind":"circle"}]')["kind"], "actions")

    def test_interpretation_rejects_unknown_template_raw_svg_illegal_params_and_too_many_entities(self):
        scene = {"theme": "", "mood": "", "composition": "", "summary": "", "ignored": []}
        base = {"templateId": "cat", "name": "猫", "x": 0, "y": 0, "width": 100, "height": 100}
        invalid = [
            {"kind": "scene_plan", "scene": scene, "entities": [{**base, "templateId": "dragon"}]},
            {"kind": "scene_plan", "scene": scene, "entities": [{**base, "svg": "<path/>"}]},
            {"kind": "scene_plan", "scene": scene, "entities": [{**base, "params": {"href": "https://evil.test"}}]},
            {"kind": "scene_plan", "scene": scene, "entities": [{**base, "name": f"猫{i}"} for i in range(21)]},
            {"kind": "scene_revision", "actions": [{"type": "entity_update", "target": "猫", "changes": {"params": {"svg": "<path/>"}}}]},
        ]
        for result in invalid:
            with self.subTest(result=result), self.assertRaises(ValueError):
                validate_interpretation(result)

    def test_person_variant_is_controlled_and_prompt_requests_rich_composition(self):
        result = {
            "kind": "scene_plan",
            "scene": {"theme": "雨天", "mood": "安静", "composition": "分层构图", "summary": "雨中女人", "ignored": []},
            "entities": [{"templateId": "person", "name": "女人", "x": 300, "y": 220, "width": 180, "height": 380, "params": {"variant": "woman"}}],
        }
        self.assertEqual(validate_interpretation(result), result)
        result["entities"][0]["params"]["variant"] = "robot"
        with self.assertRaises(ValueError):
            validate_interpretation(result)
        self.assertIn("不是图标堆叠", SYSTEM_PROMPT)
        self.assertIn("5 至 10 个实体", SYSTEM_PROMPT)

    def test_interpret_endpoint_returns_validated_union_result(self):
        handler = object.__new__(AppHandler)
        handler.path = "/api/interpret"
        body = json.dumps({"text": "画一个雨夜场景", "context": {}}).encode("utf-8")
        handler.headers = {"Content-Length": str(len(body))}
        handler.rfile = MagicMock()
        handler.rfile.read.return_value = body
        handler.send_json = MagicMock()
        result = {"kind": "scene_plan", "scene": {"theme": "", "mood": "", "composition": "", "summary": "", "ignored": []}, "entities": []}
        with patch("server.handler.interpret_with_llm", return_value=result):
            handler.do_POST()
        self.assertEqual(handler.send_json.call_args.args, (200, result))


if __name__ == "__main__":
    unittest.main()
