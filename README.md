# 情侣头像批量工厂

一个本地 Web 工具：上传任意参考图，批量调用 OpenAI Images API，把参考图重构成横向情侣头像图，并支持下载严格 2:1 裁剪版和左右两个 1:1 头像。

## 启动

最简单：双击 `start-tool.bat`，浏览器打开后在页面里粘贴你的 OpenAI API Key。

或者用 PowerShell：

```powershell
$env:OPENAI_API_KEY="你的 OpenAI API Key"
npm start
```

打开：

```text
http://localhost:8787
```

## 工作流

1. 上传参考图片。
2. 在“情侣设定”里输入左右两侧的气质设定，一行一组，用 `|` 分隔。
3. 选择风格、模型、质量和批量张数。
4. 点击“预览提示词”检查队列。
5. 点击“开始批量生成”。
6. 结果可下载原图、严格 2:1 裁剪版，或直接拆成左右两个 1:1 头像。

## 内置参考图

把图片放进这个目录，刷新页面后会自动出现在“图片展示”区：

```text
public/reference-images/
```

支持 `.png`、`.jpg`、`.jpeg`、`.webp`。

## 模型说明

OpenAI 官方文档当前列出的 GPT Image 模型包括 `gpt-image-1.5`、`gpt-image-1`、`gpt-image-1-mini`。工具默认使用 `gpt-image-1.5`，也允许在界面里手动输入其他模型 ID。

## 输出位置

生成图片会保存到：

```text
outputs/
```
