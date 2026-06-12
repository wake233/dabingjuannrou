# AI 语音绘图工具 - 设计文档

> 版本：1.0  
> 日期：2025-06-12  
> 项目：AI Voice Drawing Tool

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [指令能力设计](#3-指令能力设计)
4. [已实现功能清单](#4-已实现功能清单)
5. [未完成功能与原因说明](#5-未完成功能与原因说明)
6. [组件详细设计](#6-组件详细设计)
7. [通信协议](#7-通信协议)
8. [部署拓扑](#8-部署拓扑)
9. [测试结果](#9-测试结果)

---

## 1. 项目概述

### 1.1 项目简介

AI 语音绘图工具是一款**纯语音控制**的绘图应用。用户无需使用鼠标或键盘，仅通过语音指令即可完成绘图创作。系统通过语音识别（ASR）将用户口语转化为文本，利用大语言模型（LLM）解析语义并生成标准化的绘图操作指令，最终在 Canvas 画布上渲染图形，并通过语音合成（TTS）反馈执行结果。

### 1.2 核心设计目标

| 目标 | 说明 |
|------|------|
| 纯语音交互 | 唯一输入源为麦克风，彻底屏蔽鼠标/键盘交互 |
| 低响应延迟 | ASR + LLM 流式处理，减少用户等待时间 |
| 高容错性 | 口语同义映射、语序乱序修正、模糊语义识别 |
| 复杂指令支持 | 多步复合指令串行拆分、缺参自动补全 |
| 完整反馈闭环 | 画布渲染 + 文字日志 + TTS 语音播报 |

---

## 2. 系统架构

### 2.1 五层拓扑

```
┌─────────────────────────────────────────────────────────┐
│  L1: 终端用户交互层                                      │
│  输入: 麦克风（唯一输入源）  输出: 扬声器 + 显示屏        │
│  约束: 鼠标/键盘物理输入全部屏蔽                          │
├─────────────────────────────────────────────────────────┤
│  L2: Web 可视化展示层                                    │
│  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │ 语音交互子面板    │  │ 嵌入式绘图画布 iframe     │    │
│  │ ├ 麦克风授权      │  │ ├ HTML Canvas 渲染容器   │    │
│  │ ├ 流式 ASR 收音   │  │ ├ JS 键鼠全局拦截脚本    │    │
│  │ ├ 对话历史展示    │  │ ├ 跨域消息监听接收器      │    │
│  │ └ TTS 语音播报    │  │ └ 绘图状态提示栏         │    │
│  └──────────────────┘  └──────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│  L3: Coze Agent 核心调度层                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │语音识别  │→│意图归一化│→│指令拆解  │→│参数校验  │ │
│  │(ASR)    │ │(LLM)     │ │(多步拆分)│ │(缺参补全)│ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                              ↓                         │
│                         ┌──────────┐                   │
│                         │格式化输出│                   │
│                         │(JSON指令)│                   │
│                         └──────────┘                   │
├─────────────────────────────────────────────────────────┤
│  L4: 前端绘图执行引擎层                                  │
│  ┌────────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │消息通信解析器   │→│图形绘制渲染库│ │安全防护模块  │ │
│  │(postMessage)   │ │(Canvas API) │ │(键鼠拦截)    │ │
│  └────────────────┘ └──────────────┘ └──────────────┘ │
├─────────────────────────────────────────────────────────┤
│  L5: 闭环反馈层                                         │
│  画布状态上报 → 对话面板日志 → TTS 播报 → 等待下轮输入   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户语音 → [麦克风] → 音频文件 → [ASR] → 文字
  → [LLM 指令解析] → JSON 绘图指令数组
  → [postMessage] → Canvas iframe → 渲染图形
  → [TTS] → 语音播报执行结果 → 等待下轮输入
```

---

## 3. 指令能力设计

### 3.1 支持的绘图操作（完整指令集）

#### 3.1.1 图形绘制指令

| 指令类型 | 口语示例 | 参数 | 说明 |
|---------|---------|------|------|
| `draw_circle` | "画一个红色的圆"、"在中间画个圆圈" | cx, cy, r, color, fill_color | 圆心坐标、半径、颜色 |
| `draw_rectangle` | "画个蓝色矩形"、"左上角画个正方形" | x, y, w, h, color, fill_color | 左上角坐标、宽高、颜色 |
| `draw_line` | "画一条绿线从左上到右下" | x1, y1, x2, y2, color, line_width | 起止坐标、颜色、线宽 |
| `draw_triangle` | "画一个紫色三角形" | x1-3, y1-3, color, fill_color | 三个顶点坐标、颜色 |
| `draw_ellipse` | "画一个椭圆"、"画个鸭蛋形" | cx, cy, rx, ry, color, fill_color | 中心坐标、水平/垂直半径 |
| `draw_text` | "写上'你好'在右上角" | x, y, text, color, size | 位置、文字内容、颜色、字号 |

#### 3.1.2 画布控制指令

| 指令类型 | 口语示例 | 参数 | 说明 |
|---------|---------|------|------|
| `clear` | "清空画布"、"删掉所有"、"重新开始" | 无 | 清除所有图形 |
| `undo` | "撤销"、"回退"、"后悔了" | 无 | 撤销上一步操作 |
| `set_color` | "把颜色改成绿色" | color | 设置画笔颜色 |
| `set_fill` | "填充红色"、"设置填充色为蓝色" | color | 设置填充颜色 |
| `set_line_width` | "线条加粗到10"、"细一点" | width | 设置线条宽度 |
| `set_bg` | "背景改成浅蓝色" | color | 设置画布背景色 |

### 3.2 口语同义指令映射表

| 意图 | 口语变体 |
|------|---------|
| 绘制圆形 | 画圆、画圆圈、画圆形、画个圈、画个圆 |
| 绘制矩形 | 画方块、画正方形、画长方形、画矩形、画个框 |
| 绘制直线 | 画线、画直线、画条线、画线段 |
| 绘制三角形 | 画三角、画三角形、画个三角 |
| 绘制椭圆 | 画椭圆、画鸭蛋、画椭圆形 |
| 添加文字 | 写字、写文字、标注、加文字、写上 |
| 清空画布 | 清空、清屏、删除所有、清除、重新开始、重置 |
| 撤销 | 撤销、回退、取消、上一步、后悔了、不要了 |
| 设置颜色 | 改成X色、换颜色、用X色、选X色 |

### 3.3 语序容错设计

系统支持以下语序变体（均能正确解析）：
- "画一个红色的圆在正中间" → `draw_circle(center, red)`
- "在正中间画一个红色的圆" → `draw_circle(center, red)`
- "红色圆，在正中间画一个" → `draw_circle(center, red)`
- "我要画一个圆，红色的，放在正中间" → `draw_circle(center, red)`

### 3.4 缺参自动补全规则

| 缺失参数 | 默认值/推断逻辑 |
|---------|---------------|
| 位置 | 默认正中央 (cx=500, cy=500) |
| 颜色 | 继承当前画笔颜色 |
| 大小（半径/宽高） | 圆半径=200，矩形300x200 |
| 填充色 | 仅描边，不填充 |
| 线宽 | 默认4 |

---

## 4. 已实现功能清单

### 4.1 Canvas 画布（assets/canvas.html）

| 功能 | 状态 | 说明 |
|------|------|------|
| HTML Canvas 渲染容器 | ✅ 已完成 | 自适应窗口尺寸，支持 DPR 缩放 |
| 键盘全局拦截 | ✅ 已完成 | 所有 keydown/keyup/keypress 事件被捕获阻止 |
| 鼠标全局拦截 | ✅ 已完成 | 所有 mouse/click/drag/wheel 事件被捕获阻止 |
| 触摸事件拦截 | ✅ 已完成 | 移动端 touch/gesture 事件被捕获阻止 |
| F12/开发者工具禁用 | ✅ 已完成 | Ctrl+Shift+I/J/C、F12、Ctrl+U 均被拦截 |
| 复制/剪切/粘贴禁用 | ✅ 已完成 | copy/cut/paste 事件被阻止 |
| 右键菜单禁用 | ✅ 已完成 | contextmenu 事件被阻止 |
| postMessage 监听 | ✅ 已完成 | 跨域消息接收，支持 JSON 指令解析 |
| 绘制圆形 | ✅ 已完成 | 支持描边和填充 |
| 绘制矩形 | ✅ 已完成 | 支持描边和填充 |
| 绘制直线 | ✅ 已完成 | 支持颜色和线宽 |
| 绘制三角形 | ✅ 已完成 | 支持描边和填充，三个顶点坐标 |
| 绘制椭圆 | ✅ 已完成 | 支持描边和填充 |
| 添加文字 | ✅ 已完成 | 支持文字内容、颜色、字号 |
| 绘制多边形 | ✅ 已完成 | 任意数量顶点 |
| 清空画布 | ✅ 已完成 | 清除所有图形 |
| 撤销操作 | ✅ 已完成 | 撤销上一步绘制 |
| 设置画笔颜色 | ✅ 已完成 | 支持 CSS 颜色名和十六进制 |
| 设置填充颜色 | ✅ 已完成 | 支持 CSS 颜色名和十六进制 |
| 设置背景色 | ✅ 已完成 | 支持 CSS 颜色名和十六进制 |
| 设置线宽 | ✅ 已完成 | 1-50 范围 |
| 状态栏显示 | ✅ 已完成 | 当前操作、图形数量 |
| 底部操作提示 | ✅ 已完成 | 动态提示文字，3秒后恢复默认 |
| 欢迎覆盖层 | ✅ 已完成 | 显示使用引导文字 |
| 坐标映射 | ✅ 已完成 | 逻辑坐标 0-1000 映射到实际像素 |
| 画布就绪上报 | ✅ 已完成 | 加载完成后通知父窗口 |
| 执行结果上报 | ✅ 已完成 | 每次操作后上报状态 |

### 4.2 Agent 核心（src/agents/agent.py + config）

| 功能 | 状态 | 说明 |
|------|------|------|
| ASR 语音识别工具 | ✅ 已完成 | 基于 ASRClient 实现音频转文字 |
| LLM 指令解析 | ✅ 已完成 | 口语 → 结构化绘图指令 |
| 多步复合指令拆解 | ✅ 已完成 | "画红色圆再画蓝色矩形" → 2条指令 |
| 口语同义映射 | ✅ 已完成 | "画个圈"→draw_circle, "画画"→draw_rectangle 等 |
| 语序容错 | ✅ 已完成 | 支持多种语序变体 |
| 缺参自动补全 | ✅ 已完成 | 位置/颜色/大小默认值 |
| 短期记忆 | ✅ 已完成 | 滑动窗口保留最近20轮对话 |
| 工具错误处理 | ✅ 已完成 | wrap_tool_call 中间件 |
| 颜色支持 | ✅ 已完成 | 完整 CSS 颜色名 + 十六进制 |
| JSON 格式化输出 | ✅ 已完成 | 标准化的 JSON 绘图指令数组 |

### 4.3 模型配置（config/agent_llm_config.json）

| 配置项 | 值 | 说明 |
|--------|---|------|
| model | doubao-seed-2-0-lite-260215 | 均衡性能与成本 |
| temperature | 0.3 | 低温度确保指令解析的确定性 |
| top_p | 0.9 | 标准采样参数 |
| max_completion_tokens | 10000 | 足够输出多步指令 |
| timeout | 600 | 10分钟超时（考虑 ASR 延迟） |
| thinking | disabled | 无需深度推理 |

---

## 5. 未完成功能与原因说明

### 5.1 流式 ASR（实时收音组件）

| 功能点 | 状态 | 原因说明 |
|--------|------|----------|
| 浏览器端流式 ASR 实时收音 | ❌ 未实现 | 当前 ASR SDK 为服务端 API，仅支持 URL/base64 上传识别。浏览器端流式录音需要 WebRTC + WebSocket 配合服务端流式接口，这部分依赖 Coze Web App 的页面组件能力，需要在 Coze 网页应用的对话气泡组件层面实现录音→上传→识别的流程。本 Agent 已封装好服务端 ASR 工具，可接收上传的音频文件 URL。 |
| 静音截断 | ❌ 未实现 | 同样依赖浏览器端录音组件的能力，需要在 Coze 页面组件层利用 Web Audio API 的 AnalyserNode 检测音频能量，实现自动断句。 |
| 口音容错 | ⚠️ 部分实现 | ASR 服务本身支持常见口音识别，但未针对特定方言做专项优化。LLM 层通过同义映射表对口语化表达做了大量容错。 |

### 5.2 前端部署集成

| 功能点 | 状态 | 原因说明 |
|--------|------|----------|
| Coze 网页应用集成 | ❌ 未完整实现 | Canvas HTML 和 Agent 后端已完整实现，但 Coze Web App 的对话气泡组件、页面布局编排、工作流串联需要在 Coze 平台侧完成配置。具体需要的 Coze 工程配置：<br>1. 在 Coze Web App 中添加自定义 iframe 组件，加载 canvas.html（需上传至对象存储获取公网 URL）<br>2. 配置对话气泡组件，绑定录音上传流程<br>3. 创建工作流串联 5 个节点（详见部署拓扑章节） |
| 对象存储上传 | ❌ 未配置 | canvas.html 需要上传到对象存储（OSS/S3）获取公网可访问的 URL，才能在 Coze iframe 中加载。需要用户在目标环境中配置对象存储集成。 |
| TTS 语音输出集成 | ❌ 未直接集成 | Agent 不直接调用 TTS（这是 Coze 页面组件的能力）。Coze 对话气泡组件原生支持 TTS 输出，将 Agent 返回的 text/plain 部分自动转换为语音朗读。 |

### 5.3 高级绘图功能

| 功能点 | 状态 | 原因说明 |
|--------|------|----------|
| 图片导入 | ❌ 未实现 | 需扩展 Canvas 渲染引擎支持 Image 对象绘制，并增加 draw_image 指令类型。当前版本聚焦基础几何图形绘制。 |
| 图形选择/移动/缩放 | ❌ 未实现 | 纯语音交互场景下，图形选择操作（"选中红色的圆"）需要维护持久化的图形对象引用和状态管理，复杂度较高，计划作为 v2 功能。 |
| 渐变/阴影效果 | ❌ 未实现 | Canvas 支持渐变和阴影，但语音描述这些效果的门槛较高（如"径向渐变从红色到蓝色"），当前版本聚焦基础样式。 |
| 历史绘图回放 | ❌ 未实现 | 需要记录完整的绘图操作时间线并支持回放，计划作为 v2 功能。 |
| 导出图片 | ❌ 未实现 | Canvas 支持 toDataURL，可通过 Coze 页面提供"保存为图片"按钮触发。当前版本无导出按钮（无鼠标交互）。 |

---

## 6. 组件详细设计

### 6.1 Canvas 画布组件 (assets/canvas.html)

#### 6.1.1 坐标系统

```
逻辑坐标 (0-1000)                 物理像素 (实际窗口)
┌──────────────────────┐         ┌──────────────────────┐
│ (0,0)          (1000,0)│  map  │ (0,0)         (W,0)  │
│                      │  ───→  │                      │
│      (500,500)       │         │      (W/2, H/2)      │
│                      │         │                      │
│ (0,1000)      (1000,1000)│      │ (0,H)         (W,H)  │
└──────────────────────┘         └──────────────────────┘
```

#### 6.1.2 安全防护矩阵

| 攻击面 | 防护措施 |
|--------|---------|
| 鼠标点击/拖拽/滚轮 | event.preventDefault() + stopPropagation()（capture phase） |
| 触摸手势 | 同上 |
| 键盘输入 | 所有 keydown/keyup/keypress 拦截 |
| 开发者工具 | F12、Ctrl+Shift+I/J/C、Ctrl+U 拦截 |
| 右键菜单 | oncontextmenu = false |
| 文本选择 | user-select: none + selectstart 拦截 |
| 复制粘贴 | copy/cut/paste 拦截 |

### 6.2 Agent 组件 (src/agents/agent.py)

#### 6.2.1 工具列表

| 工具名 | 功能 | 调用时机 |
|--------|------|---------|
| `speech_to_text` | 将语音音频 URL 转换为文字 | 输入为音频URL时自动调用 |
| （LLM 原生） | 指令解析、语义理解、结构化输出 | 每次用户输入 |

#### 6.2.2 记忆机制

- 类型：滑动窗口短期记忆
- 窗口大小：最近 20 轮对话（40 条消息）
- 实现：`_windowed_messages` reducer

---

## 7. 通信协议

### 7.1 父页面 → Canvas iframe（绘图指令）

```json
{
  "target": "ai-drawing-canvas",
  "command": [
    {
      "type": "draw_circle|draw_rectangle|draw_line|draw_triangle|draw_ellipse|draw_text|clear|undo|set_color|set_fill|set_line_width|set_bg",
      "params": {
        // 各类型的参数...
      }
    }
  ]
}
```

### 7.2 Canvas iframe → 父页面（状态上报）

**就绪通知：**
```json
{
  "target": "coze-canvas-ready",
  "source": "ai-drawing-canvas",
  "status": "ready",
  "logicalSize": 1000
}
```

**执行结果：**
```json
{
  "target": "coze-canvas-response",
  "source": "ai-drawing-canvas",
  "result": {
    "success": true,
    "message": "已绘制 圆形",
    "results": [...],
    "shapeCount": 1
  }
}
```

**状态更新：**
```json
{
  "target": "coze-canvas-status",
  "source": "ai-drawing-canvas",
  "status": "success",
  "message": "已绘制 圆形",
  "shapeCount": 1,
  "timestamp": 1718188800000
}
```

### 7.3 Agent 输出格式

```json
[
  {
    "type": "操作类型",
    "params": {
      // 操作参数
    }
  }
]
```

---

## 8. 部署拓扑

### 8.1 Coze 网页应用容器

```
外部访问入口：Coze 网页应用公开访问 URL
├─ 页面布局组件 1：对话气泡组件
│   ├─ 内置语音录制按钮（浏览器麦克风授权）
│   ├─ 流式 ASR 实时收音 + 静音截断
│   ├─ 对话历史展示
│   └─ TTS 语音播报输出
│   └─ 绑定工作流：语音音频上传 → ASR 调用 → 文本输出
│
├─ 页面布局组件 2：自定义 iframe 嵌入组件
│   └─ 加载独立 Canvas 绘图画布 HTML
│       ├─ 自带键鼠锁定、消息接收逻辑
│       ├─ 通过 postMessage 接收绘图指令
│       └─ 状态上报回 Coze 页面
│
└─ Coze 工作流内部节点串联：
    1. 语音文件输入节点 ← 接收用户录音文件
    2. 语音识别工具节点（ASR）→ 输出文字
    3. LLM 提示词解析节点 → 输出结构化绘图指令 JSON
    4. JS 代码节点 → parent.postMessage 下发绘图指令到 iframe
    5. 回复组装节点 → 拼接执行日志，触发 TTS 语音朗读
```

### 8.2 Coze 工作流节点配置

| 节点 | 配置说明 |
|------|---------|
| 1. 语音输入 | 接收用户在对话中上传的音频文件 |
| 2. ASR 节点 | 调用语音识别技能，将音频转为文本 |
| 3. LLM 节点 | 使用本项目的 System Prompt（config/agent_llm_config.json 中的 sp），将文本解析为 JSON 绘图指令 |
| 4. JS 代码 | `parent.postMessage({target:'ai-drawing-canvas', command: <上一步的JSON>}, '*')` |
| 5. 回复组装 | 拼接执行日志文字，交给 TTS 朗读 |

---

## 9. 测试结果

### 9.1 端到端集成测试（15个用例）

运行命令：`python3 tests/integration_test.py`

| 测试类别 | 用例数 | 通过 | 通过率 |
|---------|-------|------|-------|
| 基本图形绘制 | 5 | 5 | 100% |
| 多步复合指令 | 2 | 2 | 100% |
| 画布控制指令 | 3 | 3 | 100% |
| 口语同义指令 | 4 | 4 | 100% |
| 撤销操作 | 1 | 1 | 100% |
| **总计** | **15** | **15** | **100%** |

### 9.2 指令协议匹配性验证

| Agent 输出类型 | Canvas 实现 | 匹配 |
|---------------|------------|------|
| draw_circle | ✅ | ✅ |
| draw_rectangle | ✅ | ✅ |
| draw_line | ✅ | ✅ |
| draw_triangle | ✅ | ✅ |
| draw_ellipse | ✅ | ✅ |
| draw_text | ✅ | ✅ |
| clear | ✅ | ✅ |
| undo | ✅ | ✅ |
| set_color | ✅ | ✅ |
| set_fill | ✅ | ✅ |
| set_line_width | ✅ | ✅ |
| set_bg | ✅ | ✅ |

### 9.3 典型输出示例

| 输入 | Agent 输出 | Canvas 渲染 |
|------|-----------|------------|
| "画一个红色的圆在正中间" | `[{"type":"draw_circle","params":{"cx":500,"cy":500,"r":200,"color":"red"}}]` | 圆形绘制 |
| "在左上角画一个蓝色矩形，再画一条绿线" | 2条指令串行 | 矩形+线条 |
| "画个圈"（口语） | `draw_circle` 自动补全位置和颜色 | 圆形绘制 |
| "清空画布，然后画紫色圆" | `clear` + `draw_circle` | 先清空后绘制 |

### 9.4 性能指标

| 指标 | 实测值 | 说明 |
|------|--------|------|
| LLM 指令解析延迟 | < 2s | 从文本输入到 JSON 输出 |
| JSON 输出大小 | < 1KB | 单条指令压缩体积 |
| Canvas 渲染延迟 | < 50ms | 毫秒级渲染 |
| 集成测试运行时间 | ~60s | 15个用例全量执行 |

---

## 附录 A：文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| Canvas 画布 HTML | `assets/canvas.html` | 独立绘图画布，包含键鼠锁定、postMessage 通信 |
| Agent 核心逻辑 | `src/agents/agent.py` | 包含 ASR 工具、LLM 指令解析、记忆机制 |
| LLM 配置 | `config/agent_llm_config.json` | 模型参数 + 绘图指令 System Prompt |
| 设计文档（本文件） | `docs/DESIGN.md` | 完整的设计说明 |

## 附录 B：支持的 CSS 颜色名

```
red, blue, green, yellow, orange, purple, pink, black, white, gray,
lightblue, lightgreen, gold, silver, navy, teal, coral, brown,
darkgreen, skyblue, tomato, violet, indigo, darkred, darkblue, darkgray,
lime, cyan, magenta, turquoise, salmon, khaki, plum, wheat, tan,
lavender, mintcream, aliceblue, antiquewhite, azure, beige, bisque,
blanchedalmond, burlywood, chartreuse, chocolate, cornflowerblue,
cornsilk, crimson, cyan, darkcyan, darkgoldenrod, darkkhaki,
darkmagenta, darkolivegreen, darkorange, darkorchid, darksalmon,
darkseagreen, darkslateblue, darkslategray, darkturquoise, darkviolet,
deeppink, deepskyblue, dimgray, dodgerblue, firebrick, floralwhite,
forestgreen, fuchsia, gainsboro, ghostwhite, goldenrod, greenyellow,
honeydew, hotpink, indianred, ivory, lavenderblush, lawngreen,
lemonchiffon, lightcoral, lightcyan, lightgoldenrodyellow, lightpink,
lightsalmon, lightseagreen, lightskyblue, lightslategray, lightsteelblue,
lightyellow, limegreen, linen, magenta, maroon, mediumaquamarine,
mediumblue, mediumorchid, mediumpurple, mediumseagreen, mediumslateblue,
mediumspringgreen, mediumturquoise, mediumvioletred, midnightblue,
mistyrose, moccasin, navajowhite, oldlace, olivedrab, orange, orangered,
orchid, palegoldenrod, palegreen, paleturquoise, palevioletred,
papayawhip, peachpuff, peru, plum, powderblue, rosybrown, royalblue,
saddlebrown, salmon, sandybrown, seagreen, seashell, sienna, silver,
skyblue, slateblue, slategray, snow, springgreen, steelblue, tan, teal,
thistle, tomato, turquoise, violet, wheat, whitesmoke, yellowgreen
```

也支持十六进制颜色值：`#FF0000`, `#00FF00`, `#0000FF`, `#333333` 等。