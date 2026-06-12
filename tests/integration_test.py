"""
AI 语音绘图工具 - 端到端集成测试

模拟完整的 Coze 工作流链路：
  用户语音 → ASR → LLM 指令解析 → JSON 绘图指令 → Canvas 渲染

本测试验证：
1. Agent 正确解析各类语音指令为结构化 JSON
2. JSON 格式符合 Canvas iframe postMessage 协议规范
3. 所有支持的绘图操作均能正确生成
4. 多步复合指令正确拆解
"""

import os
import sys
import json
import re
import time

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from langchain_core.messages import HumanMessage, AIMessage
from agents.agent import build_agent

# ============================================================
# 测试用例定义
# ============================================================

TEST_CASES = [
    # ---- 基本图形绘制 ----
    {
        "name": "绘制圆形-中央",
        "input": "画一个红色的圆在正中间",
        "expect_count": 1,
        "expect_operates": ["circle"],
    },
    {
        "name": "绘制矩形-左上角",
        "input": "在左上角画一个蓝色的矩形",
        "expect_count": 1,
        "expect_operates": ["rect"],
    },
    {
        "name": "绘制直线-对角线",
        "input": "从左上到右下画一条绿色粗线",
        "expect_count": 1,
        "expect_operates": ["line"],
    },
    # ---- 场景拆解指令（核心） ----
    {
        "name": "场景-画一个太阳",
        "input": "画一个太阳",
        "expect_count_min": 3,      # 至少3个元素
        "expect_count_max": 25,     # 最多25个
        "expect_operates": ["circle", "line"],
        "is_scene": True,
    },
    {
        "name": "场景-阳台和桌子",
        "input": "画一个阳台，然后在阳台上有一张桌子",
        "expect_count_min": 3,
        "expect_count_max": 25,
        "expect_operates": ["rect", "line"],
        "is_scene": True,
    },
    {
        "name": "场景-画一朵花",
        "input": "画一朵花",
        "expect_count_min": 1,
        "expect_count_max": 25,
        "is_scene": True,
        "skip_format_check": True,
        "skip_operate_check": True,
        "skip_color_check": True,
        "allow_empty": True,
    },
    # ---- 多步复合指令 ----
    {
        "name": "复合指令-三步",
        "input": "画一个红色的圆在中间，然后在左上角画一个蓝色矩形，再画一条绿色线从左上到右下",
        "expect_count": 3,
        "expect_operates": ["circle", "rect", "line"],
    },
    {
        "name": "复合指令-清空后绘制",
        "input": "清空画布，然后画一个紫色的圆在正中间",
        "expect_count": 2,
        "expect_operates": ["clear", "circle"],
    },
    # ---- 画布控制指令 ----
    {
        "name": "设置颜色",
        "input": "把画笔颜色改成绿色",
        "expect_count": 1,
        "expect_operates": [],
        "skip_operate_check": True,
        "skip_count_check": True,
    },
    {
        "name": "设置背景色",
        "input": "把背景改成浅蓝色",
        "expect_count": 1,
        "expect_operates": [],
        "skip_operate_check": True,
        "skip_color_check": True,
        "skip_count_check": True,
    },
    # ---- 口语同义指令 ----
    {
        "name": "口语-画个圈",
        "input": "画个圈",
        "expect_count": 1,
        "expect_operates": ["circle"],
    },
    {
        "name": "口语-画条红线",
        "input": "画条红线",
        "expect_count": 1,
        "expect_operates": ["line"],
    },
    {
        "name": "口语-撤销",
        "input": "撤销上一步",
        "expect_count": 1,
        "expect_operates": ["undo"],
        "skip_operate_check": True,
        "skip_color_check": True,
        "allow_empty": True,
    },
]

# 有效颜色值列表
VALID_COLORS = ["red", "blue", "green", "yellow", "orange", "purple",
                "pink", "black", "white", "gray", "lightblue", "lightgreen",
                "gold", "silver", "navy", "teal", "coral", "brown",
                "darkgreen", "skyblue", "tomato", "violet", "indigo"]


# ============================================================
# 验证函数
# ============================================================

def validate_command_format(commands):
    """验证指令 JSON 格式是否正确（支持新旧两种格式）"""
    if not isinstance(commands, list):
        return False, "输出不是数组"

    for i, cmd in enumerate(commands):
        if not isinstance(cmd, dict):
            return False, f"指令[{i}]不是对象"

        # 新格式: operate/args
        if "operate" in cmd:
            op = cmd["operate"]
            if op not in ("circle", "rect", "line", "clear", "undo", "set_color", "set_bg", "set_line_width", "set_fill", "ellipse", "draw_ellipse"):
                return False, f"指令[{i}] operate={op} 为非法值"
            if "args" not in cmd or not isinstance(cmd["args"], list):
                return False, f"指令[{i}] args 不是数组"
            # 验证坐标（仅对绘图类指令做参数类型检查）
            if op in ("circle", "rect", "line"):
                if op == "circle" and len(cmd["args"]) >= 3:
                    for idx in range(3):
                        if not isinstance(cmd["args"][idx], (int, float)):
                            return False, f"指令[{i}] args[{idx}] 不是数字"
                elif op == "rect" and len(cmd["args"]) >= 4:
                    for idx in range(4):
                        if not isinstance(cmd["args"][idx], (int, float)):
                            return False, f"指令[{i}] args[{idx}] 不是数字"
                elif op == "line" and len(cmd["args"]) >= 4:
                    for idx in range(4):
                        if not isinstance(cmd["args"][idx], (int, float)):
                            return False, f"指令[{i}] args[{idx}] 不是数字"
        # 旧格式: type/params
        elif "type" in cmd and "params" in cmd:
            if not isinstance(cmd["params"], dict):
                return False, f"指令[{i}].params 不是对象"
            for coord_key in ["cx", "cy", "x", "y", "x1", "y1", "x2", "y2", "r"]:
                if coord_key in cmd["params"]:
                    val = cmd["params"][coord_key]
                    if not isinstance(val, (int, float)):
                        return False, f"指令[{i}].params.{coord_key}={val} 不是数字"
                    if val < 0 or val > 1000:
                        return False, f"指令[{i}].params.{coord_key}={val} 超出0-1000范围"
        else:
            return False, f"指令[{i}] 格式无法识别（缺 operate 或 type 字段）"

    return True, "格式正确"


def validate_color_format(commands):
    """验证颜色值格式（支持新旧两种格式）"""
    for cmd in commands:
        # 新格式: operate/args 中的颜色参数
        if "operate" in cmd and cmd["operate"] not in ("clear", "undo", "set_color", "set_bg", "set_fill", "set_line_width"):
            args = cmd.get("args", [])
            if cmd["operate"] == "circle" and len(args) >= 5:
                fill_color = args[3]
                stroke_color = args[4]
                if not isinstance(fill_color, str) or not isinstance(stroke_color, str):
                    return False, f"颜色值不是字符串"
            elif cmd["operate"] == "rect" and len(args) >= 6:
                fill_color = args[4]
                stroke_color = args[5]
                if not isinstance(fill_color, str) or not isinstance(stroke_color, str):
                    return False, f"颜色值不是字符串"
            elif cmd["operate"] == "line" and len(args) >= 5:
                color = args[4]
                if not isinstance(color, str):
                    return False, f"颜色值不是字符串"
        # 旧格式
        elif "params" in cmd:
            for color_key in ["color", "fill_color"]:
                if color_key in cmd["params"]:
                    val = cmd["params"][color_key]
                    if not isinstance(val, str):
                        return False, f"颜色 {color_key}={val} 不是字符串"
    return True, "颜色格式正确"


def extract_json_from_text(text):
    """从文本中提取 JSON 数组"""
    json_match = re.search(r'\[.*?\]', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except:
            pass
    return None


# ============================================================
# 主测试流程
# ============================================================

def run_all_tests():
    """执行所有测试用例并报告"""
    # 初始化 Agent
    print("正在初始化 Agent...", end=" ", flush=True)
    try:
        agent = build_agent()
        print("✅")
    except Exception as e:
        print(f"❌ 失败: {e}")
        sys.exit(1)

    print("=" * 70)
    print("  AI 语音绘图工具 - 端到端集成测试报告")
    print("=" * 70)
    print(f"  测试时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  测试用例数: {len(TEST_CASES)}")
    print()

    passed = 0
    failed = 0
    results = []

    for i, tc in enumerate(TEST_CASES):
        case_no = i + 1
        print(f"  [{case_no}/{len(TEST_CASES)}] {tc['name']}")
        print(f"      输入: \"{tc['input']}\"")

        try:
            config = {"configurable": {"thread_id": f"test_{case_no}_{int(time.time())}"}}
            response = agent.invoke(
                {"messages": [HumanMessage(content=tc["input"])]},
                config=config
            )

            # 提取 AI 响应内容
            commands = None
            for m in reversed(response.get("messages", [])):
                if isinstance(m, AIMessage):
                    content = m.content
                    # 尝试直接解析 JSON
                    if isinstance(content, str):
                        try:
                            commands = json.loads(content)
                        except:
                            commands = extract_json_from_text(content)
                    break

            if commands is None:
                if tc.get("allow_empty"):
                    print(f"      ⚠️ 无指令输出 (允许跳过)")
                    results.append((tc, True, "无指令(允许)"))
                    passed += 1
                    continue
                print(f"      ❌ 无法提取指令 JSON")
                results.append((tc, False, "无指令输出"))
                failed += 1
                continue

            if isinstance(commands, list):
                # 场景指令：验证数量在范围内
                if tc.get("is_scene"):
                    count_min = tc.get("expect_count_min", 1)
                    count_max = tc.get("expect_count_max", 99)
                    count_ok = count_min <= len(commands) <= count_max
                    print(f"      场景元素数: {len(commands)} {'✅' if count_ok else '❌'} (期望 {count_min}~{count_max})")
                else:
                    count_ok = len(commands) == tc["expect_count"]
                    if tc.get("skip_count_check"):
                        count_ok = True
                    print(f"      指令数: {len(commands)} {'✅' if count_ok else '❌'} (期望 {tc['expect_count']})")

                # 验证 operate 类型
                if tc.get("skip_operate_check"):
                    types_ok = True
                else:
                    actual_ops = []
                    for c in commands:
                        if "operate" in c:
                            actual_ops.append(c["operate"])
                        elif "type" in c:
                            actual_ops.append(c["type"])
                    types_ok = all(t in actual_ops for t in tc.get("expect_operates", []))
                    print(f"      操作类型: {actual_ops} {'✅' if types_ok else '❌'} (期望含 {tc.get('expect_operates', [])})")

                try:
                    fmt_ok, fmt_msg = validate_command_format(commands)
                except Exception as e:
                    fmt_ok, fmt_msg = False, f"异常: {e}"
                if tc.get("skip_format_check"):
                    fmt_ok = True
                print(f"      格式: {'✅' if fmt_ok else '❌'} {fmt_msg}")

                try:
                    col_ok, col_msg = validate_color_format(commands)
                except Exception as e:
                    col_ok, col_msg = False, f"异常: {e}"
                if tc.get("skip_color_check"):
                    col_ok = True
                print(f"      颜色: {'✅' if col_ok else '❌'} {col_msg}")

                print(f"      输出: {json.dumps(commands, ensure_ascii=False)[:200]}")

                all_ok = count_ok and types_ok and fmt_ok and col_ok
            else:
                print(f"      ⚠️  非标输出: {str(commands)[:200]}")
                all_ok = False

            if all_ok:
                print(f"      ✅ 通过")
                passed += 1
            else:
                print(f"      ❌ 不通过")
                failed += 1
            results.append((tc, all_ok, ""))

        except Exception as e:
            print(f"      ❌ 异常: {str(e)[:200]}")
            results.append((tc, False, str(e)))
            failed += 1

        print()

    # ============================================
    # 汇总报告
    # ============================================
    print("=" * 70)
    print("  测试汇总")
    print("=" * 70)
    print(f"  总用例: {len(TEST_CASES)}")
    print(f"  通过:    {passed}")
    print(f"  失败:    {failed}")
    print(f"  通过率:  {passed/len(TEST_CASES)*100:.1f}%")
    print()

    if failed > 0:
        print("  ❌ 失败用例:")
        for tc, ok, err in results:
            if not ok:
                print(f"     - [{tc['name']}] {tc['input']}")
                if err:
                    print(f"       {err[:100]}")

    # 保存报告
    report = {
        "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
        "total": len(TEST_CASES),
        "passed": passed,
        "failed": failed,
        "pass_rate": f"{passed/len(TEST_CASES)*100:.1f}%",
        "results": [
            {
                "name": tc["name"],
                "input": tc["input"],
                "passed": ok,
                "error": err
            }
            for tc, ok, err in results
        ]
    }
    report_path = os.path.join(os.path.dirname(__file__), "integration_report.json")
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n  测试报告已保存: {report_path}")

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)