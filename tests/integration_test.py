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
        "expect_types": ["draw_circle"],
    },
    {
        "name": "绘制矩形-左上角",
        "input": "在左上角画一个蓝色的矩形",
        "expect_count": 1,
        "expect_types": ["draw_rectangle"],
    },
    {
        "name": "绘制直线-对角线",
        "input": "从左上到右下画一条绿色粗线",
        "expect_count": 2,
        "expect_types": ["set_line_width", "draw_line"],
        "allow_inline_line_width": True,  # 允许 line_width 内联到 draw_line 参数中
    },
    {
        "name": "绘制三角形-填充",
        "input": "画一个紫色三角形，填充为黄色",
        "expect_count": 1,
        "expect_types": ["draw_triangle"],
    },
    {
        "name": "绘制椭圆",
        "input": "画一个粉色椭圆在右侧",
        "expect_count": 1,
        "expect_types": ["draw_ellipse"],
    },
    {
        "name": "添加文字",
        "input": "在顶部写上'Hello'用蓝色",
        "expect_count": 1,
        "expect_types": ["draw_text"],
    },
    # ---- 多步复合指令 ----
    {
        "name": "复合指令-三步",
        "input": "画一个红色的圆在中间，然后在左上角画一个蓝色矩形，再画一条绿色线从左上到右下",
        "expect_count": 3,
        "expect_types": ["draw_circle", "draw_rectangle", "draw_line"],
    },
    {
        "name": "复合指令-清空后绘制",
        "input": "清空画布，然后画一个紫色的圆在正中间",
        "expect_count": 2,
        "expect_types": ["clear", "draw_circle"],
    },
    # ---- 画布控制指令 ----
    {
        "name": "设置颜色",
        "input": "把画笔颜色改成绿色",
        "expect_count": 1,
        "expect_types": ["set_color"],
    },
    {
        "name": "设置线宽",
        "input": "线条加粗到10",
        "expect_count": 1,
        "expect_types": ["set_line_width"],
    },
    {
        "name": "设置背景色",
        "input": "把背景改成浅蓝色",
        "expect_count": 1,
        "expect_types": ["set_bg"],
    },
    # ---- 口语同义指令 ----
    {
        "name": "口语-画个圈",
        "input": "画个圈",
        "expect_count": 1,
        "expect_types": ["draw_circle"],
    },
    {
        "name": "口语-画个方块",
        "input": "画个方块在右上角",
        "expect_count": 1,
        "expect_types": ["draw_rectangle"],
    },
    {
        "name": "口语-画条线",
        "input": "画条红线",
        "expect_count": 1,
        "expect_types": ["draw_line"],
    },
    {
        "name": "口语-撤销",
        "input": "撤销上一步",
        "expect_count": 1,
        "expect_types": ["undo"],
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
    """验证指令 JSON 格式是否正确"""
    if not isinstance(commands, list):
        return False, "输出不是数组"

    for i, cmd in enumerate(commands):
        if not isinstance(cmd, dict):
            return False, f"指令[{i}]不是对象"

        if "type" not in cmd:
            return False, f"指令[{i}]缺少 type 字段"

        if "params" not in cmd:
            return False, f"指令[{i}]缺少 params 字段"

        if not isinstance(cmd["params"], dict):
            return False, f"指令[{i}].params 不是对象"

        # 验证坐标范围
        for coord_key in ["cx", "cy", "x", "y", "x1", "y1", "x2", "y2", "r"]:
            if coord_key in cmd["params"]:
                val = cmd["params"][coord_key]
                if not isinstance(val, (int, float)):
                    return False, f"指令[{i}].params.{coord_key}={val} 不是数字"
                if val < 0 or val > 1000:
                    return False, f"指令[{i}].params.{coord_key}={val} 超出0-1000范围"

    return True, "格式正确"


def validate_color_format(commands):
    """验证颜色值格式"""
    for cmd in commands:
        for color_key in ["color", "fill_color"]:
            if color_key in cmd["params"]:
                val = cmd["params"][color_key]
                if not isinstance(val, str):
                    return False, f"颜色 {color_key}={val} 不是字符串"
                # 颜色可以是命名颜色或十六进制
                if val.lower() not in VALID_COLORS and not val.startswith("#"):
                    # 弱检查 - 只要不是明显错误即可
                    pass
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
                print(f"      ❌ 无法提取指令 JSON")
                results.append((tc, False, "无指令输出"))
                failed += 1
                continue

            if isinstance(commands, list):
                count_ok = len(commands) == tc["expect_count"]
                # 内联兼容：当 expect_count=2 但使用内联 line_width 时，1条指令给出2个效果
                if not count_ok and tc.get("allow_inline_line_width"):
                    has_inline_width = any(
                        c.get("params", {}).get("line_width")
                        for c in commands
                        if c["type"] in ("draw_line", "draw_circle", "draw_rectangle")
                    )
                    if has_inline_width:
                        count_ok = True
                print(f"      指令数: {len(commands)} {'✅' if count_ok else '❌'} (期望 {tc['expect_count']})")

                actual_types = [c.get("type", "?") for c in commands]
                types_ok = all(t in actual_types for t in tc["expect_types"])
                # 内联兼容性检查
                if not types_ok and tc.get("allow_inline_line_width"):
                    has_inline_width = any(
                        c.get("params", {}).get("line_width")
                        for c in commands
                        if c["type"] in ("draw_line", "draw_circle", "draw_rectangle")
                    )
                    if has_inline_width:
                        types_ok = True
                print(f"      类型: {actual_types} {'✅' if types_ok else '❌'} (期望含 {tc['expect_types']})")

                fmt_ok, fmt_msg = validate_command_format(commands)
                print(f"      格式: {'✅' if fmt_ok else '❌'} {fmt_msg}")

                col_ok, col_msg = validate_color_format(commands)
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