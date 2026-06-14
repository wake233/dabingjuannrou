"""Action schema constants and validation functions for Listen Paint."""

import re

ALLOWED_ACTIONS = {
    "create", "select", "update", "move", "align", "distribute", "duplicate",
    "delete", "group", "ungroup", "history", "canvas", "export", "help", "status",
    "entity_create", "entity_update", "scene_update", "creative", "texture",
}
ENTITY_TEMPLATES = {
    "person": {"color", "accent", "pose", "direction", "variant"},
    "cat": {"color", "accent", "pose", "direction"},
    "dog": {"color", "accent", "pose", "direction"},
    "bird": {"color", "accent", "direction", "count"},
    "umbrella": {"color", "accent", "direction"},
    "streetlamp": {"color", "accent"}, "roof": {"color", "accent"},
    "house": {"color", "accent"}, "bridge": {"color", "accent"}, "boat": {"color", "accent", "direction"},
    "bench": {"color", "accent"}, "bicycle": {"color", "accent", "direction"}, "fence": {"color", "accent", "density"},
    "buildings": {"color", "accent", "density"}, "rain": {"color", "density", "direction"},
    "cloud": {"color", "density"}, "sun": {"color", "accent"}, "moon": {"color", "accent"},
    "stars": {"color", "density", "count"}, "tree": {"color", "accent", "density"},
    "mountain": {"color", "accent", "density"}, "flowers": {"color", "accent", "density", "count"},
    "river": {"color", "accent", "direction"}, "grass": {"color", "accent", "density"},
    "street": {"color", "accent", "direction"}, "puddle": {"color", "accent"},
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
    "entity_create": {"type", "templateId", "name", "role", "x", "y", "width", "height", "rotation", "opacity", "layer", "params"},
    "entity_update": {"type", "target", "changes"},
    "scene_update": {"type", "changes"},
    "creative": {"type", "operation", "theme", "style", "draftId", "draftIds", "instruction", "target", "field"},
    "texture": {"type", "operation", "prompt", "model", "cacheKey", "mimeType", "width", "height"},
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
    "听画 开始画 嘿画布 绘本 木刻 水墨 小稿 构图方案 混合方案 锁定 解锁 "
    "焦点 氛围 节奏 光线 留白 更孤独 加强风感"
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


def validate_string(value, allow_empty=False, maximum=1000):
    if not isinstance(value, str) or (not allow_empty and not value) or len(value) > maximum:
        raise ValueError("文本字段无效")


def validate_entity_params(template_id, params):
    if template_id not in ENTITY_TEMPLATES or not isinstance(params, dict):
        raise ValueError("实体模板或参数无效")
    for field, value in params.items():
        if field not in ENTITY_TEMPLATES[template_id]:
            raise ValueError(f"模板不支持参数 {field}")
        if field in {"color", "accent"}:
            validate_color(value, False)
        elif field == "pose" and not allowed_value(value, {"standing", "walking", "sitting", "curled"}):
            raise ValueError("实体姿态参数无效")
        elif field == "direction" and not allowed_value(value, {"left", "right", "vertical", "diagonal"}):
            raise ValueError("实体方向参数无效")
        elif field == "variant" and not allowed_value(value, {"woman", "man", "child", "neutral"}):
            raise ValueError("人物类型参数无效")
        elif field == "count" and (not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= 100):
            raise ValueError("实体数量参数无效")
        elif field == "density" and not finite_number(value, 0, 1):
            raise ValueError("实体密度参数无效")


def validate_scene_changes(changes):
    if not isinstance(changes, dict) or not changes:
        raise ValueError("场景修改内容无效")
    allowed = {"theme", "mood", "composition", "summary", "ignored"}
    if set(changes) - allowed:
        raise ValueError("场景修改字段无效")
    for field, value in changes.items():
        if field == "ignored":
            if not isinstance(value, list) or len(value) > 20 or any(not isinstance(item, str) or not item or len(item) > 100 for item in value):
                raise ValueError("场景忽略项无效")
        else:
            validate_string(value, True)


def validate_entity_changes(changes):
    if not isinstance(changes, dict) or not changes:
        raise ValueError("实体修改内容无效")
    allowed = {"name", "role", "width", "height", "rotation", "opacity", "params", "zOrder"}
    if set(changes) - allowed:
        raise ValueError("实体修改字段无效")
    for field, value in changes.items():
        if field in {"name", "role"}:
            validate_string(value, field == "role", 100)
        elif field in {"width", "height", "rotation", "opacity", "zOrder"}:
            validate_change_value(field, value)
        elif not isinstance(value, dict):
            raise ValueError("实体参数修改无效")
        else:
            allowed_params = set().union(*ENTITY_TEMPLATES.values())
            if set(value) - allowed_params:
                raise ValueError("实体参数修改无效")
            for param, param_value in value.items():
                if param in {"color", "accent"}:
                    validate_color(param_value, False)
                elif param == "pose" and not allowed_value(param_value, {"standing", "walking", "sitting", "curled"}):
                    raise ValueError("实体姿态参数无效")
                elif param == "direction" and not allowed_value(param_value, {"left", "right", "vertical", "diagonal"}):
                    raise ValueError("实体方向参数无效")
                elif param == "count" and (not isinstance(param_value, int) or isinstance(param_value, bool) or not 1 <= param_value <= 100):
                    raise ValueError("实体数量参数无效")
                elif param == "density" and not finite_number(param_value, 0, 1):
                    raise ValueError("实体密度参数无效")


def validate_action(action):
    action_type = action["type"]
    unknown = set(action) - ACTION_FIELDS[action_type]
    if unknown:
        raise ValueError(f"{action_type} 包含不允许的字段 {next(iter(unknown))}")
    if action_type == "entity_create":
        require_fields(action, "templateId", "name", "x", "y", "width", "height")
        validate_string(action["name"], False, 100)
        if "role" in action:
            validate_string(action["role"], True, 100)
        if not finite_number(action["x"]) or not finite_number(action["y"]):
            raise ValueError("实体坐标无效")
        validate_dimension(action["width"])
        validate_dimension(action["height"])
        if "rotation" in action and not finite_number(action["rotation"]):
            raise ValueError("实体旋转无效")
        if "opacity" in action and not finite_number(action["opacity"], 0, 1):
            raise ValueError("实体透明度无效")
        if "layer" in action and (not isinstance(action["layer"], int) or isinstance(action["layer"], bool) or not -1000 <= action["layer"] <= 1000):
            raise ValueError("实体层次无效")
        validate_entity_params(action["templateId"], action.get("params", {}))
    elif action_type == "entity_update":
        require_fields(action, "target", "changes")
        validate_target(action["target"])
        validate_entity_changes(action["changes"])
    elif action_type == "scene_update":
        require_fields(action, "changes")
        validate_scene_changes(action["changes"])
    elif action_type == "creative":
        require_fields(action, "operation")
        operation = action["operation"]
        if not allowed_value(operation, {"generate_drafts", "select_draft", "mix_drafts", "refine", "lock", "unlock", "set_style", "regenerate_texture"}):
            raise ValueError("创作操作无效")
        if "theme" in action:
            validate_string(action["theme"], False, 500)
        if "style" in action and not allowed_value(action["style"], {"storybook", "woodcut", "ink"}):
            raise ValueError("艺术风格无效")
        if "draftId" in action:
            validate_string(action["draftId"], False, 100)
        if "draftIds" in action and (
            not isinstance(action["draftIds"], list) or len(action["draftIds"]) != 2
            or any(not isinstance(value, str) or not value or len(value) > 100 for value in action["draftIds"])
        ):
            raise ValueError("混合小稿无效")
        if "instruction" in action:
            validate_string(action["instruction"], False, 500)
        if "field" in action and not allowed_value(action["field"], {"composition", "palette", "light", "focus", "atmosphere", "rhythm", "negativeSpace"}):
            raise ValueError("锁定字段无效")
        if "target" in action:
            validate_target(action["target"])
        required = {
            "generate_drafts": ("theme", "style"), "select_draft": ("draftId",), "mix_drafts": ("draftIds",),
            "refine": ("instruction",), "set_style": ("style",),
        }
        if operation in required:
            require_fields(action, *required[operation])
        if operation in {"lock", "unlock"} and "field" not in action and "target" not in action:
            raise ValueError("锁定目标无效")
    elif action_type == "texture":
        require_fields(action, "operation")
        operation = action["operation"]
        if not allowed_value(operation, {"pending", "apply", "remove", "missing", "failed"}):
            raise ValueError("纹理操作无效")
        for field in {"prompt", "model", "cacheKey", "mimeType"} & set(action):
            validate_string(action[field], True, 1000)
        for field in {"width", "height"} & set(action):
            if not isinstance(action[field], int) or isinstance(action[field], bool) or not 0 <= action[field] <= 2048:
                raise ValueError("纹理尺寸无效")
        if operation == "apply":
            require_fields(action, "prompt", "model", "cacheKey", "mimeType", "width", "height")
            if action["mimeType"] != "image/png" or not action["cacheKey"]:
                raise ValueError("纹理元数据无效")
    elif action_type == "create":
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
        if not allowed_value(action["format"], {"svg", "png", "project"}):
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
    scene_batch = (
        isinstance(actions, list) and len(actions) <= 21
        and sum(isinstance(action, dict) and action.get("type") == "scene_update" for action in actions) == 1
        and sum(isinstance(action, dict) and action.get("type") == "entity_create" for action in actions) == len(actions) - 1
    )
    if not isinstance(actions, list) or not actions or (len(actions) > 20 and not scene_batch):
        raise ValueError("模型动作数量必须在 1 到 20 之间")
    for action in actions:
        if not isinstance(action, dict) or not allowed_value(action.get("type"), ALLOWED_ACTIONS):
            raise ValueError("模型返回了不允许的动作")
        validate_action(action)
    if any(action["type"] == "history" for action in actions) and len(actions) != 1:
        raise ValueError("撤销或重做必须单独执行")
    return actions


def validate_interpretation(result):
    if not isinstance(result, dict) or set(result) - {"kind", "actions", "scene", "entities"}:
        raise ValueError("解释结果结构无效")
    kind = result.get("kind")
    if kind == "actions":
        if set(result) != {"kind", "actions"}:
            raise ValueError("动作解释结果结构无效")
        validate_actions(result["actions"])
    elif kind == "scene_revision":
        if set(result) != {"kind", "actions"}:
            raise ValueError("场景修改结果结构无效")
        actions = validate_actions(result["actions"])
        if any(action["type"] not in {"entity_create", "entity_update", "scene_update", "move", "delete", "update"} for action in actions):
            raise ValueError("场景修改包含不允许的动作")
    elif kind == "scene_plan":
        if set(result) != {"kind", "scene", "entities"} or not isinstance(result["entities"], list) or len(result["entities"]) > 20:
            raise ValueError("场景规划结构无效")
        scene = result["scene"]
        if not isinstance(scene, dict) or set(scene) != {"theme", "mood", "composition", "summary", "ignored"}:
            raise ValueError("场景说明结构无效")
        validate_scene_changes(scene)
        names = set()
        for entity in result["entities"]:
            action = {"type": "entity_create", **entity}
            validate_action(action)
            if entity["name"] in names:
                raise ValueError("实体名称重复")
            names.add(entity["name"])
    else:
        raise ValueError("解释结果类型无效")
    return result
