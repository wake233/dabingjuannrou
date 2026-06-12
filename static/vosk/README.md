# Vosk 离线语音识别模型

此目录存放 Vosk.js WASM 离线中文语音识别模型文件，用于在无网络环境下提供语音识别能力。

## 模型下载

推荐使用轻量中文模型 **vosk-model-small-cn-0.22**（约 42MB）：

```
https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip
```

完整模型列表见：<https://alphacephei.com/vosk/models>

## 快速开始

### 方式一：应用内自动下载（推荐）

应用启动后，点击 UI 中的"下载离线模型"按钮，模型将自动下载并存储到浏览器 IndexedDB 中，后续会话无需重新下载。

### 方式二：手动配置本地模型文件

1. 下载并解压模型文件到此目录：

```powershell
# 下载模型
curl -O https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip

# 解压
unzip vosk-model-small-cn-0.22.zip -d static/vosk/
```

2. 确保目录结构为：

```
static/vosk/vosk-model-small-cn-0.22/
  ├── am/
  ├── conf/
  ├── graph/
  ├── ivector/
  ├── rescore/
  └── ...
```

3. 加载 Vosk.js WASM 模块（在 `index.html` 中添加）：

```html
<script src="/vosk/vosk.js"></script>
```

4. 参考 `static/vosk_recognizer.js` 中的 `_createRealRecognizer()` 方法获取完整的 WASM 初始化代码。

## 模型文件说明

| 文件/目录 | 用途 |
|----------|------|
| `am/` | 声学模型参数 |
| `graph/` | 解码图（WFST） |
| `conf/` | 模型配置文件 |
| `ivector/` | 说话人自适应参数 |
| `rescore/` | 语言模型重打分 |

## 注意事项

- 模型文件较大（42MB），首次下载需要一定时间和网络带宽
- 模型文件存储在浏览器 IndexedDB 中，清除浏览器数据会导致模型丢失
- 离线模式识别准确率低于云端模式，建议配合模糊匹配（phase 3.1）使用
- 手动配置的模型文件不会被 Git 跟踪（已在 `.gitignore` 中排除）
- Vosk.js WASM 需要 WebAssembly 和 AudioWorklet 支持（Chrome 61+、Edge 79+、Firefox 76+）

## 故障排除

1. **模型未就绪**：确保模型已下载或正确放置在 `static/vosk/` 目录下
2. **下载失败**：检查网络连接，可能需要代理或 VPN 访问 `alphacephei.com`
3. **WASM 加载失败**：确认浏览器支持 WebAssembly，检查 MIME 类型配置（服务器需返回 `application/wasm`）
4. **识别准确率低**：离线模型准确率有限，建议配合同音词模糊匹配表（`FUZZY_MAP`）使用
