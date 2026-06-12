# 听画

听画是一款本地运行、通过简体中文语音控制的结构化矢量绘图工具。首次启动和麦克风授权可以使用鼠标；进入画板后，创建、编辑、布局、撤销、清空与导出均可通过语音完成。

## 启动

要求 Python 3.8+ 和支持 Web Speech API 的 Chrome 或 Edge。

```powershell
python main.py
```

服务默认打开 `http://127.0.0.1:8000`。点击一次“开始聆听”并允许麦克风权限，此后即可持续使用语音。若不希望自动打开浏览器：

```powershell
python main.py --no-browser
```

浏览器语音识别通常依赖网络。应用本地规则解析、绘图和导出不需要额外依赖。

## 示例指令

- `画一个红色圆形放在左边，再画一个蓝色矩形放在右边`
- `画一个文字，写上“你好”放在中央`
- `选中刚才两个图形，然后顶部对齐，然后整体向下移动五十`
- `选择矩形一，然后把它改成绿色`
- `把它放大两倍，然后旋转四十五`
- `选择所有图形，然后横向均匀分布`
- `撤销`、`重做`、`当前状态`、`帮助`
- `设置背景为灰色`
- `清空画布`，随后说 `确认` 或 `取消`
- `保存为 SVG`、`保存为 PNG`

每个图形会按类型自动命名，例如“矩形一”“矩形二”“圆形一”。

## 可选模型回退

规则解析器不能理解指令时，服务端可调用 OpenAI 兼容的聊天补全接口。配置以下环境变量后重启服务：

```powershell
$env:LLM_BASE_URL="https://your-provider.example/v1"
$env:LLM_API_KEY="your-key"
$env:LLM_MODEL="your-model"
python main.py
```

密钥只保留在 Python 服务端。模型返回的动作会在服务端和浏览器内校验，每条语音最多执行 20 个动作。未配置模型时，全部标准指令仍可使用。

## 测试

```powershell
node --test tests/*.test.js
python -m unittest discover -s tests -p "test_*.py" -v
```

详细设计、能力完成状态与已知限制见 [DESIGN.md](DESIGN.md)。
