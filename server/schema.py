"""Action schema constants and validation functions for Listen Paint."""

import re

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
    "canvas": {"type", "operation", "color"},
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
    unknown = set(action) - ACTION_FIELDS[action_type]
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
            if "color" in action:
                raise ValueError("清空画布不能设置颜色")
        if action["operation"] == "background":
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
