# 验收执行报告

## 任务目标

绘本造型与线条精修计划：将故事绘本渲染器从当前简单图标拼接升级为接近写实结构的细腻钢笔绘本插画。覆盖全部 26 个语义实体，新增钢笔线条引擎、色彩光线系统、渐进式精绘与导出，以及两个视觉验收页面。木刻与水墨渲染器本轮不改动。

基线：Node 154/154，Python 40/40。完成：Node 180/180，Python 40/40。

## 验收标准

| ID | 验收要求 | 验收方法 | 通过条件 | 状态 | 证据 |
| --- | --- | --- | --- | --- | --- |
| A01 | 钢笔笔触模块生成确定性可变宽 SVG 路径，不依赖统一 stroke-width | node --test tests/pen_stroke.test.js | 相同输入产生相同路径；路径宽度沿中心线变化 | 通过 | tests/pen_stroke.test.js: "钢笔笔触生成确定性可变宽 SVG 路径" |
| A02 | 支持主轮廓、结构线、纹理线和氛围线四级线条，分别具有不同粗细/透明度/断续/扰动 | node --test tests/pen_stroke.test.js | 四级线条参数可区分；data-line-tier 属性正确标记 | 通过 | tests/pen_stroke.test.js: "四级线条具有不同粗细、透明度、断续和扰动参数" |
| A03 | 使用实体ID+部件名称生成固定 seed，扰动效果每次一致 | node --test tests/pen_stroke.test.js | 相同 seed 多次调用产生相同路径；不同 seed 产生可区分偏差 | 通过 | tests/pen_stroke.test.js: "使用实体ID+部件名称生成固定 seed" |
| A04 | 所有生成坐标有限，单实体节点数量有上限 | node --test tests/pen_stroke.test.js | 所有坐标在有限范围内；节点数不超过上限 | 通过 | tests/pen_stroke.test.js: "所有生成坐标有限，单实体节点数量有上限" |
| A05 | 全部 26 个实体模板具有独立、可辨识的外轮廓，禁止复用通用剪影 | node --test tests/templates.test.js | 每个实体渲染后具有唯一轮廓数据；任意两实体外轮廓不同 | 通过 | tests/templates.test.js: "全部 26 个实体具有独立可辨识的外轮廓" |
| A06 | 角色与动物（人物、猫、狗、鸟）使用骨架、体块、关节和姿态相关轮廓 | node --test tests/templates.test.js | 渲染 children 包含 data-line-tier="structure" 元素；阴影存在 | 通过 | tests/templates.test.js: "角色与动物包含结构线和姿态相关轮廓" |
| A07 | 建筑与器物具有可信透视、厚度和连接关系 | node --test tests/templates.test.js | 建筑实体包含多层级结构元素；器物包含连接节点 | 通过 | tests/templates.test.js: "建筑与器物包含可信连接关系和厚度" |
| A08 | 自然实体具有不规则轮廓、生长方向和疏密变化 | node --test tests/templates.test.js | 自然实体包含多个不规则路径元素 | 通过 | tests/templates.test.js: "自然实体包含不规则轮廓和疏密变化" |
| A09 | 场景与光效具有方向场、反光和波纹 | node --test tests/templates.test.js | 场景实体包含方向性元素和反光/波纹路径 | 通过 | tests/templates.test.js: "场景与光效包含方向场和反光元素" |
| A10 | 每个绘本实体使用本地渐变表现明暗转折 | node --test tests/templates.test.js | 渲染中包含带命名空间前缀的渐变定义 | 通过 | tests/templates.test.js: "每个绘本实体使用带命名空间的渐变" |
| A11 | 使用半透明高光、接触阴影和投影建立体积 | node --test tests/templates.test.js | 阴影元素存在且不遮盖结构线 | 通过 | tests/templates.test.js: "使用阴影和半透明高光建立体积" |
| A12 | 近景实体增加材质排线，远景仅保留主要轮廓 | node --test tests/templates.test.js | 不同尺寸实体渲染细节有显著差异 | 通过 | tests/templates.test.js: "近景实体细节密度明显高于远景" |
| A13 | 渐变与滤镜 ID 使用渲染命名空间，避免跨画布冲突 | node --test tests/templates.test.js | 不同 namespace 下无重复/冲突 id | 通过 | tests/templates.test.js: "不同命名空间下的渐变 ID 不会冲突" |
| A14 | renderArtworkEntity 增加 quality 和 namespace 参数 | node --test tests/templates.test.js | 调用时传入参数正确传递到模板渲染 | 通过 | tests/templates.test.js: "renderArtworkEntity 接受 quality 和 namespace 参数" |
| A15 | base 质量与 full 质量渲染明显不同 | node --test tests/templates.test.js | base children < full children; base 无纹理线 | 通过 | tests/templates.test.js: "base 和 full 质量渲染明显不同" |
| A16 | 语音中间预览仅使用 base 质量 | 代码检查 (app.js) | tryPreviewRender 调用 renderObjects 时传入 quality: "base" | 通过 | static/app.js tryPreviewRender: quality: "base", namespace: "preview" |
| A17 | SVG/PNG/作品集导出始终生成 full 质量，不含选择高亮 | 代码检查 (app.js) | exportSvgSource 先执行 full 渲染，再清除 selection-glow | 通过 | static/app.js exportSvgSource: quality: "full", noSelectionHighlight: true |
| A18 | 旧版工程加载后数据不变，自动使用新绘本渲染器 | node --test tests/acceptance.test.js | 序列化测试通过；渲染自动使用新模板 | 通过 | tests/acceptance.test.js: 版本迁移测试通过 |
| A19 | 木刻与水墨渲染器行为不变 | node --test tests/templates.test.js | 木刻和水墨渲染测试全部通过 | 通过 | tests/templates.test.js: 木刻和水墨测试通过 |
| A20 | 新增 26 实体图鉴页面 | 文件存在 + 浏览器检查 | static/entity-gallery.html 存在且所有 26 个实体可在真实浏览器中渲染（已修复 SVG 命名空间问题） | 通过（代码层面） | static/entity-gallery.html: 26 个卡片；需在浏览器中验证最终视觉效果 |
| A21 | 新增六张标杆场景页面 | 文件存在 + 浏览器检查 | static/benchmark-scenes.html 存在且 6 场景可渲染 | 通过（代码层面） | static/benchmark-scenes.html: 6 场景 43 实体可见；需人工视觉评审 |
| A22 | 移除自动填充完成度分数的作品集验收方式 | 代码检查 | portfolio.js 不再自动填充分数 | 通过 | static/portfolio.js: requiresVisualReview 字段 |
| A23 | 20 个实体基础渲染低于 100ms | node --test tests/pen_stroke.test.js | 20 个实体连续 base 渲染总耗时 < 100ms | 通过 | tests/pen_stroke.test.js: 性能测试（mock DOM 环境） |
| A24 | 完整精绘在基础画面出现后 500ms 内完成 | 代码结构 + 真机测量 | requestAnimationFrame 调度，实际耗时需在目标设备测量 | 待真实验证 | static/app.js: scheduleFrame 机制；真机延迟未测量 |
| A25 | 不修改工程状态、动作协议或撤销历史 | node --test tests/*.test.js 全量 | model/parser 测试全过 | 通过 | tests/model.test.js, tests/parser.test.js 全过 |
| A26 | 所有效果由本地可信 SVG 渲染器生成 | 代码检查 | 无外部 URL、无模型原始 SVG 注入 | 通过 | static/templates.js: 所有路径本地计算 |

## 实施记录

### 第 0 轮：基线检查与验收清单建立

- 完成的改动：探索项目结构，阅读所有核心文件，建立 26 条验收标准。
- 涉及文件：docs/acceptance-report.md
- 验证结果：基线 Node 154/154、Python 40/40 全部通过。
- 下一步：实施钢笔线条引擎。

### 第 1 轮：钢笔线条引擎 + 26 实体模板重写 + 色彩光线 + 渐进式渲染

- 完成的改动：
  1. 新增 `static/pen_stroke.js`：确定性钢笔笔触模块，包含四级线条定义、seed 哈希、Mulberry32 PRNG、可变宽路径生成、起收笔渐细、排线生成、命名空间 ID、节点上限检查
  2. 重写 `static/templates.js`：全部 26 个实体使用钢笔笔触引擎重建模板，每个实体独立外轮廓，角色/动物使用骨架体块，建筑/器物使用透视连接，自然实体使用不规则轮廓，场景使用方向场和反光。所有实体支持 base/full 质量，包含带命名空间的渐变、阴影和高光
  3. 更新 `static/renderers.js`：renderArtworkEntity 接受 quality 和 namespace 参数
  4. 更新 `static/app.js`：渐进式渲染（base 立即显示，full 下一帧替换），预览使用 base 质量，导出强制 full 质量，Node.js 环境兼容（requestAnimationFrame 回退）
  5. 新增 `static/entity-gallery.html`：26 实体双尺寸图鉴
  6. 新增 `static/benchmark-scenes.html`：六张标杆场景
  7. 更新 `static/portfolio.js`：移除自动分数填充
  8. 新增 `tests/pen_stroke.test.js`：10 项钢笔引擎测试（确定性、四级线条、seed、坐标安全、闭合路径、渐细、SVG元素、排线、命名空间、性能）
  9. 更新 `tests/templates.test.js`：新增多项验收测试（独立轮廓、结构线、建筑透视、自然不规则、场景方向、渐变命名空间、base/full质量、远景近景差异、命名空间冲突）
  10. 更新 `tests/portfolio.test.js`：匹配新 portfolio 接口
  11. 更新 `tests/portfolio_acceptance.mjs`：匹配新接口

- 涉及文件：static/pen_stroke.js, static/templates.js, static/renderers.js, static/app.js, static/entity-gallery.html, static/benchmark-scenes.html, static/portfolio.js, tests/pen_stroke.test.js, tests/templates.test.js, tests/portfolio.test.js, tests/portfolio_acceptance.mjs, docs/acceptance-report.md
- 首轮失败与修复：
  - app.test.js 崩溃：requestAnimationFrame 在 Node 不可用，添加 scheduleFrame/cancelFrame 回退到 setTimeout
  - portfolio.test.js 失败：旧测试期望 auto-fill scores，更新测试匹配新的 requiresVisualReview 结构
  - templates.test.js: moon 外轮廓测试使用 circle 而非 path，更新 collectPathData 为 collectSilhouetteData
  - 渐变 defs 缺失：在 renderEntity 函数中统一添加梯度定义
- 验证结果：Node 180/180、Python 40/40、smoke 16/16、git diff --check 通过
- 未通过项：无
- 下一步：创建最终 Git commit

## 测试结果

| 命令或检查方法 | 结果 | 关键输出 |
| --- | --- | --- |
| 基线 `node --test tests/*.test.js` | 通过 | 154/154 |
| 基线 `python -m unittest discover -s tests -p "test_*.py" -v` | 通过 | 40/40 |
| 基线 `node tests/smoke_test.mjs` | 通过 | 16/16 |
| 实现后 `node --test tests/*.test.js` | 通过 | 180/180 |
| 实现后 `python -m unittest discover -s tests -p "test_*.py" -v` | 通过 | 40/40 |
| 实现后 `node tests/smoke_test.mjs` | 通过 | 16/16 |
| 实现后 `node tests/portfolio_acceptance.mjs` | 通过 | 12 题材结构评估完成 |
| 实现后 `git diff --check` | 通过 | 仅 LF/CRLF 警告（Windows 正常） |

## 审查修复记录

### 第 2 轮修复（针对人工审查反馈）

审查发现以下问题并已修复：

| 严重度 | 问题 | 修复 |
|--------|------|------|
| P0 | `templates.js:1564` `group.children.unshift(defs)` — 真实 DOM 的 `children` 是 `HTMLCollection`，无 `unshift` 方法 | 改为 `group.insertBefore(defs, group.firstChild)` |
| P1 | `templates.js:94` `penLineToGroup` 将笔触外轮廓路径设置 `fill="none"` 再用固定 `stroke-width` 描边，产生等宽双边轮廓而非实心起收笔渐细笔触 | 改为 `fill` 使用笔触颜色，`stroke="none"` — `penPath()` 生成的是封闭可变宽包络面，应填充而非描边 |
| P1 | `pen_stroke.js:168` 断笔只跳过采样点，恢复后仍用 `L` 连接，不产生真正断口 | 修改 gap 逻辑：恢复后第一个点使用 `M` 命令产生真正断口 |
| P1 | 验收报告错误宣称全部完成，但视觉验收尚未执行 | 更新为准确状态（见下方） |
| P2 | `templates.js:1529` 为所有实体通用渐变使用 `PALETTE.green` 作为默认值，覆盖了河流、水洼、云等模板各自的默认颜色 | 新增 `DEFAULT_COLORS` 映射表，26 个模板各有正确默认颜色 |

### 测试结果（第 2 轮修复后）

| 命令 | 结果 |
|------|------|
| `node --test tests/*.test.js` | 180/180 通过 |
| `python -m unittest discover -s tests -p "test_*.py" -v` | 40/40 通过 |
| `node tests/smoke_test.mjs` | 16/16 通过 |

## 最终结论

绘本造型与线条精修计划的代码实现已完成，自动化测试全部通过。核心改动包括：
- 新增钢笔线条引擎 (static/pen_stroke.js)，实现确定性可变宽路径、四级线条、seeded PRNG
- 全部 26 个语义实体使用钢笔笔触重建，每个实体具有独立轮廓和完整结构
- 色彩光线系统（渐变、阴影、高光、命名空间隔离）
- 渐进式精绘（base 立即 + full 下一帧）、预览 base 质量、导出 full 质量
- 两个视觉验收页面（26 实体图鉴 + 六张标杆场景）
- 木刻/水墨渲染器行为完全不变

## 残余风险

- **视觉验收尚未完成**：26 个实体轮廓可区分性、六张标杆场景的结构可信度和光影统一性需要在真实浏览器中实际查看 entity-gallery.html 和 benchmark-scenes.html 确认。PLAN_V4.md 明确要求浏览器视觉证据后才能标记完成。
- 性能目标（A24: full 精绘 500ms 内）仅在 requestAnimationFrame 调度层面实现，实际渲染耗时受浏览器和设备影响，需要在目标设备上真实验收。
- 旧工程视觉外观已因新渲染器而改变（预期行为）。
