"""Configuration loading for Listen Paint — .env and config.yaml."""

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
CONFIG = {
    "speech_to_text": {"base_url": "", "model": ""},
    "command_model": {"base_url": "", "model": ""},
    "texture_model": {"base_url": "", "model": ""},
}
CONFIG_SECTIONS = set(CONFIG)
CONFIG_FIELDS = {"base_url", "model"}
REQUIRED_CONFIG_SECTIONS = {"speech_to_text", "command_model"}


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
    for name in REQUIRED_CONFIG_SECTIONS:
        values = loaded.get(name, {})
        if set(values) != CONFIG_FIELDS:
            raise ValueError(f"config.yaml 缺少 {name} 配置")
    for name in CONFIG_SECTIONS - REQUIRED_CONFIG_SECTIONS:
        values = loaded.get(name, {"base_url": "", "model": ""})
        if set(values) != CONFIG_FIELDS:
            raise ValueError(f"config.yaml 缺少 {name} 配置")
        loaded[name] = values
    CONFIG.clear()
    CONFIG.update(loaded)
    return CONFIG
