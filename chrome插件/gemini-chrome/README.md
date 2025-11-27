# Omni-Adapter Gemini Chrome Extension

Chrome 扩展程序，用于自动化 Google Business Gemini 网站的图片生成功能。

## 功能特性

- **文字生成图片 (Text-to-Image)**: 输入文字提示词自动生成图片
- **图片+文字生成图片 (Image-to-Image)**: 上传参考图片并输入提示词生成图片
- **多Tab轮询**: 支持多个 Gemini 标签页，自动轮询分发任务
- **WebSocket 通信**: 与任务派发服务器实时通信
- **API响应拦截**: 自动捕获生成的图片结果

## 安装步骤

1. 打开 Chrome 浏览器，进入 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `gemini-chrome` 文件夹

## 使用说明

### 基本使用

1. 安装扩展后，打开 [Google Business Gemini](https://business.gemini.google/)
2. 扩展会自动连接到 WebSocket 服务器
3. 当服务器发送任务时，扩展会自动执行图片生成

### 设置面板

在 Gemini 页面点击扩展图标，可以打开设置面板：

- **WebSocket URL**: WebSocket 服务器地址
- **Group Name**: 分组名称，用于任务分发
- **Auto reload**: 任务完成后是否自动刷新页面

### 状态显示

设置面板显示以下状态信息：

- WebSocket 连接状态
- 活跃的 Gemini 标签页数量
- 任务队列长度
- 各标签页状态（idle/busy）

## 配置选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| wsUrl | `wss://websock.aihack.top/ws` | WebSocket 服务器地址 |
| wsGroup | `gemini` | 分组名称 |
| autoReload | `false` | 任务完成后自动刷新 |

## 消息格式

### 任务消息 (服务器 → 扩展)

```json
{
  "type": "task",
  "taskId": "uuid-string",
  "payload": {
    "model": "gemini-image",
    "messages": [{ "role": "user", "content": "prompt text" }],
    "data": {
      "prompt": "prompt text",
      "ratio": "1:1",
      "imageUrl": "https://..."
    }
  }
}
```

### 任务完成 (扩展 → 服务器)

```json
{
  "type": "task_complete",
  "taskId": "uuid-string",
  "result": {
    "images": [
      { "fileId": "123", "base64": "data:image/png;base64,..." }
    ],
    "status": "completed"
  },
  "duration": 15234
}
```

### 任务失败 (扩展 → 服务器)

```json
{
  "type": "task_error",
  "taskId": "uuid-string",
  "error": "Error description",
  "duration": 1234
}
```

## 文件结构

```
gemini-chrome/
├── manifest.json        # 扩展配置文件
├── background.js        # 后台服务脚本
├── content.js           # 内容脚本
├── settings-panel.js    # 设置面板
├── message-parser.js    # 消息解析模块
├── response-builder.js  # 响应构建模块
├── tab-manager.js       # 标签页管理模块
├── websocket-manager.js # WebSocket 管理模块
├── task-tracker.js      # 任务跟踪模块
├── api-interceptor.js   # API 拦截模块
├── image-downloader.js  # 图片下载模块
├── icon-48.png          # 扩展图标
└── icon-128.png         # 扩展图标
```

## 权限说明

- `webNavigation`: 监听页面导航事件
- `storage`: 存储设置
- `debugger`: 拦截 API 响应
- `scripting`: 注入脚本
- `activeTab`: 访问当前标签页

## 故障排除

### WebSocket 连接失败

1. 检查网络连接
2. 确认 WebSocket 服务器地址正确
3. 查看浏览器控制台日志

### 任务执行失败

1. 确保已登录 Gemini 账号
2. 检查页面是否完全加载
3. 查看控制台错误信息

### 图片无法下载

1. 确认已正确登录
2. 检查 API 响应格式
3. 查看 Network 面板

## 开发说明

基于 Chrome Extension Manifest V3 开发，参考了 doubao-chrome 的架构设计。

## License

MIT
