"""
AI 语音绘图工具 - Agent 核心逻辑

架构：
  ┌─ 语音输入 ──→ ASR 工具 (speech_to_text) ──→ 转写文本
  └─ 转写文本 ──→ LLM (绘图指令解析 Prompt) ──→ JSON 绘图指令数组
  └─ JSON 指令 ──→ 输出给前端 Canvas iframe (postMessage)

工作流（Coze Web App 上下文）：
  1. 用户在浏览器录制语音 → Coze 页面获取音频 URL
  2. Agent 接收音频 URL → 调用 speech_to_text 工具 → 获取文本
  3. LLM 解析文本 → 按 System Prompt 规则输出 JSON 绘图指令
  4. 返回结构化结果 → 前端 JS 通过 postMessage 发送到 Canvas iframe
  5. Canvas 执行绘图 → 状态上报 → TTS 朗读结果
"""

import os
import json
import logging
from typing import Annotated

from langchain.agents import create_agent
from langchain.agents.middleware import wrap_tool_call
from langchain.messages import ToolMessage
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import MessagesState
from langgraph.graph.message import add_messages
from langchain_core.messages import AnyMessage

from coze_coding_utils.runtime_ctx.context import default_headers, new_context
from coze_coding_utils.log.write_log import request_context
from storage.memory.memory_saver import get_memory_saver
from coze_coding_dev_sdk import ASRClient

logger = logging.getLogger(__name__)

# ============================================================
#  配置常量
# ============================================================

LLM_CONFIG = "config/agent_llm_config.json"

# 默认保留最近 20 轮对话 (40 条消息)
MAX_MESSAGES = 40

# ============================================================
#  短期记忆 - 滑动窗口
# ============================================================

def _windowed_messages(old, new):
    """滑动窗口: 只保留最近 MAX_MESSAGES 条消息"""
    merged = add_messages(old, new)
    # 手动截断，避免类型检查器对切片操作的误报
    count = 0
    for _ in merged:
        count += 1
    if count > MAX_MESSAGES:
        skip = count - MAX_MESSAGES
        result = []
        for i, msg in enumerate(merged):
            if i >= skip:
                result.append(msg)
        return result
    return merged

class AgentState(MessagesState):
    messages: Annotated[list[AnyMessage], _windowed_messages]

# ============================================================
#  工具模块
# ============================================================

@tool
def speech_to_text(audio_url: str) -> str:
    """将语音音频文件转换为文字。
    
    接收一个可公开访问的音频文件 URL，使用 ASR 语音识别服务将其转换为文本。
    支持的音频格式: WAV/MP3/OGG OPUS/M4A
    音频时长限制: ≤ 2小时
    音频大小限制: ≤ 100MB
    
    Args:
        audio_url: 音频文件的公开访问 URL
        
    Returns:
        识别出的文字内容
    """
    ctx = request_context.get() or new_context(method="asr.recognize")
    try:
        client = ASRClient(ctx=ctx)
        text, data = client.recognize(
            uid="voice_drawing_user",
            url=audio_url
        )
        logger.info(f"[ASR] 语音识别成功: {text}")
        return text
    except Exception as e:
        logger.error(f"[ASR] 语音识别失败: {e}")
        return f"语音识别失败: {str(e)}，请检查音频文件是否有效"


# 工具执行错误处理中间件
@wrap_tool_call
def handle_tool_errors(request, handler):
    """处理工具执行错误，返回友好的错误信息"""
    try:
        return handler(request)
    except Exception as e:
        logger.error(f"[Tool Error] {request.tool_call.get('name', 'unknown')}: {e}")
        return ToolMessage(
            content=f"工具执行出错: ({str(e)})，请重试或换个说法",
            tool_call_id=request.tool_call["id"]
        )

# ============================================================
#  Agent 构建工厂
# ============================================================

def build_agent(ctx=None):
    """
    构建 AI 语音绘图 Agent
    
    该 Agent 包含：
    1. speech_to_text 工具 - 将语音转为文字
    2. LLM 指令解析 - 将自然语言解析为结构化绘图指令
    3. 短期记忆 - 滑动窗口保留最近 20 轮对话
    
    Args:
        ctx: 可选的请求上下文，用于链路追踪
        
    Returns:
        create_agent 构建的 Agent 实例 (带格式转换层)
    """
    workspace_path = os.getenv("COZE_WORKSPACE_PATH", "/workspace/projects")
    config_path = os.path.join(workspace_path, LLM_CONFIG)

    with open(config_path, 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    api_key = os.getenv("COZE_WORKLOAD_IDENTITY_API_KEY")
    base_url = os.getenv("COZE_INTEGRATION_MODEL_BASE_URL")

    llm = ChatOpenAI(
        model=cfg['config'].get("model"),
        api_key=api_key,
        base_url=base_url,
        temperature=cfg['config'].get('temperature', 0.3),
        streaming=True,
        timeout=cfg['config'].get('timeout', 600),
        extra_body={
            "thinking": {
                "type": cfg['config'].get('thinking', 'disabled')
            }
        },
        default_headers=default_headers(ctx) if ctx else {}
    )

    agent = create_agent(
        model=llm,
        system_prompt=cfg.get("sp"),
        tools=[speech_to_text],
        checkpointer=get_memory_saver(),
        state_schema=AgentState,
        middleware=[handle_tool_errors],
    )

    logger.info("[Agent] AI 语音绘图 Agent 构建完成")

    # 构建格式转换包装器
    class _FormatConvertingAgent:
        """包装 agent，LLM输出后自动转换格式"""
        def __init__(self, inner):
            self._inner = inner
        
        def invoke(self, input_data, config=None, **kwargs):
            result = self._inner.invoke(input_data, config=config, **kwargs)
            return self._convert(result)
        
        async def ainvoke(self, input_data, config=None, **kwargs):
            result = await self._inner.ainvoke(input_data, config=config, **kwargs)
            return self._convert(result)
        
        def _convert(self, result):
            if isinstance(result, dict) and 'messages' in result:
                msgs = result['messages']
                if msgs and hasattr(msgs[-1], 'content') and isinstance(msgs[-1].content, str):
                    try:
                        parsed = json.loads(msgs[-1].content)
                        if isinstance(parsed, list):
                            converted = convert_type_params_to_operate_args(parsed)
                            msgs[-1].content = json.dumps(converted, ensure_ascii=False)
                    except (json.JSONDecodeError, TypeError):
                        pass
            return result
        
        def __getattr__(self, name):
            return getattr(self._inner, name)
    
    logger.info("[Agent] AI 语音绘图 Agent 构建完成（含格式转换）")
    return _FormatConvertingAgent(agent)


# ============================================================
#  格式转换: type/params → operate/args
# ============================================================

def convert_type_params_to_operate_args(commands):
    """将 [{type, params}] 转为 [{operate, args}] — Coze JS 节点直接消费的纯净 JSON 数组
    
    映射表:
      type/params                        →  operate/args
      ─────────────────────────────────────────────────────
      draw_circle {cx,cy,r,color,fill_color,line_width}   →  circle [x,y,r,fill,stroke,width]
      draw_rectangle {x,y,w,h,color,fill_color,line_width} →  rect [x,y,w,h,fill,stroke,width]
      draw_line {x1,y1,x2,y2,color,line_width}             →  line [x1,y1,x2,y2,color,width]
      clear {}                                               →  clear []
      undo {}                                                →  undo []
      set_color {color}                                     →  set_color [color]
      set_fill {fill}                                       →  set_fill [fill]
      set_line_width {line_width}                           →  set_line_width [width]
      set_bg {color}                                        →  set_bg [color]
    """
    if not isinstance(commands, list):
        return commands
    
    result = []
    for cmd in commands:
        if not isinstance(cmd, dict):
            result.append(cmd)
            continue
        # 已经是新格式，直接保留
        if 'operate' in cmd:
            result.append(cmd)
            continue
        
        t = cmd.get('type', '')
        p = cmd.get('params', {})
        
        if t == 'draw_circle':
            fill = p.get('fill_color') or ''
            if not fill:
                fill = p.get('color', '#333')
            result.append({'operate': 'circle', 'args': [
                p.get('cx', 500), p.get('cy', 500), p.get('r', 100),
                fill,
                p.get('color', '#333'), 
                p.get('line_width', 4)
            ]})
        
        elif t == 'draw_rectangle':
            fill = p.get('fill_color') or ''
            if not fill:
                fill = p.get('color', '#333')
            result.append({'operate': 'rect', 'args': [
                p.get('x', 100), p.get('y', 100), 
                p.get('w', 200), p.get('h', 200),
                fill,
                p.get('color', '#333'), 
                p.get('line_width', 4)
            ]})
        
        elif t == 'draw_line':
            result.append({'operate': 'line', 'args': [
                p.get('x1', 0), p.get('y1', 0), 
                p.get('x2', 500), p.get('y2', 500),
                p.get('color', '#333'), 
                p.get('line_width', 4)
            ]})
        
        elif t == 'clear':
            result.append({'operate': 'clear', 'args': []})
        
        elif t == 'undo':
            result.append({'operate': 'undo', 'args': []})
        
        elif t == 'set_color':
            result.append({'operate': 'set_color', 'args': [p.get('color', 'black')]})
        
        elif t == 'set_fill':
            result.append({'operate': 'set_fill', 'args': [p.get('fill', 'none')]})
        
        elif t == 'set_line_width':
            result.append({'operate': 'set_line_width', 'args': [p.get('line_width', 4)]})
        
        elif t == 'set_bg':
            result.append({'operate': 'set_bg', 'args': [p.get('color', 'white')]})
        
        elif t in ('draw_triangle',):
            # 三角形 → 三条线
            pts = [
                (p.get('x1', 300), p.get('y1', 100)),
                (p.get('x2', 300), p.get('y2', 700)),
                (p.get('x3', 700), p.get('y3', 700)),
            ]
            for i in range(3):
                x1, y1 = pts[i]
                x2, y2 = pts[(i + 1) % 3]
                result.append({'operate': 'line', 'args': [
                    x1, y1, x2, y2,
                    p.get('color', '#333'), p.get('line_width', 4)
                ]})
        
        elif t in ('draw_ellipse',):
            result.append({'operate': 'draw_ellipse', 'args': [
                p.get('cx', 500), p.get('cy', 500),
                p.get('rx', 150), p.get('ry', 100),
                p.get('fill_color') or p.get('color', '#333'),
                p.get('color', '#333'),
                p.get('line_width', 4)
            ]})
        
        elif t == 'draw_text':
            result.append({'operate': 'draw_text', 'args': [
                p.get('text', 'Hello'),
                p.get('x', 500), p.get('y', 500),
                p.get('color', '#333'),
                p.get('font_size', 24)
            ]})
        
        else:
            # 未知指令，原样保留
            result.append(cmd)
    
    return result