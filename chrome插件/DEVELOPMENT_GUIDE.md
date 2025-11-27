# Omni-Adapter 插件开发指南

> 本文档面向开发新手，详细介绍插件的架构、代码结构、开发规范和扩展方法。

## 目录

1. [插件架构概述](#1-插件架构概述)
2. [文件结构说明](#2-文件结构说明)
3. [核心模块详解](#3-核心模块详解)
4. [WebSocket 通信机制](#4-websocket-通信机制)
5. [如何添加新功能](#5-如何添加新功能)
6. [调试技巧](#6-调试技巧)
7. [常见问题](#7-常见问题)

---

## 1. 插件架构概述

### 1.1 什么是 Chrome 扩展？

Chrome 扩展是运行在浏览器中的小程序，可以：
- 修改网页内容
- 与远程服务器通信
- 在后台执行任务

### 1.2 本插件的三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    WebSocket 服务器                          │
│                 (任务派发中心)                                │
└─────────────────────────┬───────────────────────────────────┘
                          │ WebSocket 连接
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   background.js                              │
│                 (后台服务脚本)                                │
│  - WebSocket 连接管理                                        │
│  - 任务解析和分发                                            │
│  - Tab 状态管理                                              │
│  - 结果收集和上报                                            │
└─────────────────────────┬───────────────────────────────────┘
                          │ Chrome 消息通信
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    content.js                                │
│                 (内容脚本)                                    │
│  - 注入到豆包网页中                                          │
│  - 操作页面 DOM 元素                                         │
│  - 执行图片生成任务                                          │
│  - 收集生成的图片 URL                                        │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 数据流向

```
服务器发送任务 → background.js 解析 → 分发到空闲 Tab 
→ content.js 执行 → 收集图片 URL → background.js 汇总 → 发送结果到服务器
```

---

## 2. 文件结构说明


```
omni-adapter/
├── manifest.json          # 插件配置文件（必需）
├── background.js          # 后台服务脚本（核心）
├── content.js             # 内容脚本（注入网页）
├── settings-panel.js      # 设置面板脚本
├── icon-48.png           # 插件图标 48x48
├── icon-128.png          # 插件图标 128x128
├── README.md             # 项目说明
├── API_PROTOCOL.md       # API 协议文档
└── DEVELOPMENT_GUIDE.md  # 本开发指南
```

### 2.1 manifest.json - 插件配置文件

这是 Chrome 扩展的"身份证"，定义了插件的基本信息和权限。

```json
{
  "manifest_version": 3,           // Chrome 扩展版本，必须是 3
  "name": "Omni-Adapter",          // 插件名称
  "version": "1.0.0",              // 版本号
  "description": "豆包图片生成助手", // 描述
  
  "permissions": [                  // 需要的权限
    "tabs",                        // 访问标签页
    "storage",                     // 存储数据
    "cookies",                     // 操作 Cookie
    "debugger",                    // 调试器（拦截网络请求）
    "webNavigation",               // 监听页面导航
    "scripting"                    // 注入脚本
  ],
  
  "host_permissions": [            // 可访问的网站
    "https://www.doubao.com/*",
    "<all_urls>"
  ],
  
  "background": {                  // 后台脚本配置
    "service_worker": "background.js"
  },
  
  "content_scripts": [             // 内容脚本配置
    {
      "matches": ["https://www.doubao.com/*"],  // 匹配的网址
      "js": ["content.js"],                     // 注入的脚本
      "run_at": "document_end"                  // 注入时机
    }
  ],
  
  "action": {                      // 工具栏图标
    "default_icon": {
      "48": "icon-48.png",
      "128": "icon-128.png"
    }
  }
}
```

### 2.2 background.js - 后台服务脚本

这是插件的"大脑"，负责：

| 功能模块 | 代码位置 | 说明 |
|----------|----------|------|
| WebSocket 管理 | `connectWebSocket()` | 建立和维护 WebSocket 连接 |
| 消息解析 | `parseTaskMessage()` | 解析服务器发来的消息 |
| 任务分发 | `dispatchTask()` | 将任务分发到空闲的 Tab |
| 结果上报 | `completeTask()` | 收集结果并发送给服务器 |
| Tab 管理 | `doubaoTabs` Map | 管理所有豆包页面的状态 |

### 2.3 content.js - 内容脚本

这是注入到豆包网页中的脚本，负责：

| 功能模块 | 代码位置 | 说明 |
|----------|----------|------|
| 接收命令 | `onMessage` 监听器 | 接收 background.js 发来的任务 |
| 执行任务 | `handleGenerateImageCommand()` | 操作页面生成图片 |
| 收集结果 | `performSendAndCleanup()` | 收集图片 URL 并上报 |
| 状态更新 | `updateTabStatus()` | 更新 Tab 状态（忙/闲） |

---

## 3. 核心模块详解

### 3.1 WebSocket 连接管理

```javascript
// ========== 关键变量 ==========
const DEFAULT_WEBSOCKET_URL = 'wss://websock.aihack.top/ws';  // 默认服务器地址
const DEFAULT_GROUP = 'doubao';                               // 默认分组
const RECONNECT_DELAY_MS = 5000;                             // 重连间隔（毫秒）

let ws = null;                    // WebSocket 实例
let reconnectTimeout = null;      // 重连定时器

// ========== 连接函数 ==========
function connectWebSocket() {
    // 1. 防止重复连接
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
    }

    // 2. 从存储中读取配置
    chrome.storage.sync.get(['wsUrl', 'wsGroup'], (result) => {
        const baseUrl = result.wsUrl || DEFAULT_WEBSOCKET_URL;
        const group = result.wsGroup || DEFAULT_GROUP;
        
        // 3. 构建带 group 参数的 URL
        const websocketUrl = buildWebSocketUrl(baseUrl, group);
        
        // 4. 创建 WebSocket 连接
        ws = new WebSocket(websocketUrl);
        setupWebSocketHandlers();  // 设置事件处理器
    });
}

// ========== URL 构建函数 ==========
function buildWebSocketUrl(baseUrl, group) {
    if (!group) return baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}group=${encodeURIComponent(group)}`;
}
// 示例：buildWebSocketUrl('ws://localhost:3000/ws', 'doubao')
// 结果：'ws://localhost:3000/ws?group=doubao'
```


### 3.2 消息解析器

```javascript
// ========== 消息类型判断 ==========
function isNewFormatMessage(message) {
    // 新格式消息必须有 type: 'task'
    return message && typeof message === 'object' && message.type === 'task';
}

// ========== 主解析函数 ==========
function parseTaskMessage(rawMessage) {
    try {
        // 1. 解析 JSON
        const message = typeof rawMessage === 'string' 
            ? JSON.parse(rawMessage) 
            : rawMessage;
        
        // 2. 识别系统消息（不是任务）
        const systemMessageTypes = ['connected', 'ping', 'pong', 'heartbeat', 'ack', 'error'];
        if (message.type && systemMessageTypes.includes(message.type)) {
            return { isSystemMessage: true, type: message.type, data: message };
        }
        
        // 3. 解析新格式任务
        if (isNewFormatMessage(message)) {
            return {
                isNewFormat: true,
                taskId: message.taskId,
                payload: message.payload || {}
            };
        }
        
        // 4. 解析旧格式任务（向后兼容）
        if (message.commandId || message.prompt || message.task_type) {
            return {
                isNewFormat: false,
                taskId: message.commandId || `legacy-${Date.now()}`,
                payload: message
            };
        }
        
        // 5. 无法识别的消息
        return null;
    } catch (e) {
        console.error("[Parser] Failed to parse message:", e);
        return null;
    }
}
```

### 3.3 任务转换器

将服务器的 payload 转换为插件内部使用的命令格式：

```javascript
function convertPayloadToCommand(taskId, payload) {
    // 如果已经是旧格式，直接使用
    if (payload.task_type || payload.prompt) {
        return {
            commandId: taskId,           // 任务 ID
            task_type: payload.task_type || 'image',
            prompt: payload.prompt || '',
            ratio: payload.ratio || '1:1',
            file: payload.file || !!payload.imageUrl,
            imageUrl: payload.imageUrl || null
        };
    }
    
    // 新格式需要转换
    const data = payload.data || {};
    const messages = payload.messages || [];
    
    // 从 messages 中提取 prompt
    let prompt = data.prompt || '';
    if (!prompt && messages.length > 0) {
        const userMessage = messages.find(m => m.role === 'user');
        if (userMessage) {
            prompt = userMessage.content || '';
        }
    }
    
    return {
        commandId: taskId,
        task_type: 'image',
        prompt: prompt,
        ratio: data.ratio || data.resolution || '1:1',
        file: !!data.imageUrl,
        imageUrl: data.imageUrl || null
    };
}
```

### 3.4 Tab 管理系统

```javascript
// ========== 数据结构 ==========
let doubaoTabs = new Map();  // 存储所有豆包 Tab
// 结构：tabId -> { id, url, status: 'idle'|'busy', lastUsed: timestamp }

let taskQueue = [];          // 任务队列（当没有空闲 Tab 时使用）
let currentTabIndex = 0;     // 轮询索引

// ========== 添加 Tab ==========
function addDoubaoTab(tabId, url) {
    doubaoTabs.set(tabId, {
        id: tabId,
        url: url,
        status: 'idle',      // 初始状态为空闲
        lastUsed: Date.now()
    });
}

// ========== 获取空闲 Tab ==========
function getIdleTab() {
    // 过滤出所有空闲的 Tab
    const idleTabs = Array.from(doubaoTabs.values())
        .filter(tab => tab.status === 'idle');
    
    if (idleTabs.length === 0) return null;
    
    // 轮询选择（负载均衡）
    const selectedTab = idleTabs[currentTabIndex % idleTabs.length];
    currentTabIndex = (currentTabIndex + 1) % idleTabs.length;
    
    return selectedTab;
}

// ========== 设置 Tab 状态 ==========
function setTabStatus(tabId, status) {
    if (doubaoTabs.has(tabId)) {
        doubaoTabs.get(tabId).status = status;
        if (status === 'idle') {
            doubaoTabs.get(tabId).lastUsed = Date.now();
        }
    }
}
```

### 3.5 任务跟踪器

```javascript
// ========== 数据结构 ==========
const activeTasks = new Map();  // 正在执行的任务
// 结构：taskId -> { taskId, startTime, tabId, status }

// ========== 开始跟踪 ==========
function startTaskTracking(taskId, tabId) {
    activeTasks.set(taskId, {
        taskId: taskId,
        startTime: Date.now(),  // 记录开始时间
        tabId: tabId,
        status: 'executing'
    });
}

// ========== 任务完成 ==========
function completeTask(taskId, urls) {
    const taskInfo = activeTasks.get(taskId);
    if (!taskInfo) {
        console.warn("[TaskTracker] Task not found:", taskId);
        return;
    }
    
    // 构建完成消息
    const message = {
        type: 'task_complete',
        taskId: taskId,
        result: {
            urls: urls || [],
            status: 'completed'
        },
        duration: Date.now() - taskInfo.startTime  // 计算耗时
    };
    
    // 发送到服务器
    sendWebSocketMessage(message);
    
    // 清理
    activeTasks.delete(taskId);
}

// ========== 任务失败 ==========
function failTask(taskId, error) {
    const taskInfo = activeTasks.get(taskId);
    
    const message = {
        type: 'task_error',
        taskId: taskId,
        error: error,
        duration: taskInfo ? (Date.now() - taskInfo.startTime) : 0
    };
    
    sendWebSocketMessage(message);
    activeTasks.delete(taskId);
}
```

---

## 4. WebSocket 通信机制

### 4.1 连接生命周期

```
浏览器启动/插件安装
        │
        ▼
  connectWebSocket()
        │
        ▼
┌───────────────────┐
│  WebSocket.CONNECTING │
└─────────┬─────────┘
          │ 连接成功
          ▼
┌───────────────────┐
│  WebSocket.OPEN   │◄──────────────┐
└─────────┬─────────┘               │
          │                         │
          ▼                         │
   收到 "connected"                  │
          │                         │
          ▼                         │
   发送 "ready"                      │
          │                         │
          ▼                         │
   等待任务...                       │
          │                         │
          │ 连接断开                 │
          ▼                         │
┌───────────────────┐               │
│  WebSocket.CLOSED │               │
└─────────┬─────────┘               │
          │                         │
          ▼                         │
   scheduleReconnect()              │
          │                         │
          │ 5秒后                    │
          └─────────────────────────┘
```


### 4.2 消息处理流程

```javascript
function handleWebSocketMessage(event) {
    console.log("[WebSocket] Received message:", event.data);
    
    // 1. 解析消息
    const parsedTask = parseTaskMessage(event.data);
    
    if (!parsedTask) {
        console.warn("[WebSocket] Failed to parse message, skipping");
        return;
    }
    
    // 2. 处理系统消息
    if (parsedTask.isSystemMessage) {
        if (parsedTask.type === 'connected') {
            // 收到连接确认，发送 ready
            sendWebSocketMessage({ type: 'ready' });
        } else if (parsedTask.type === 'ping') {
            // 心跳响应
            sendWebSocketMessage({ type: 'pong' });
        }
        return;
    }
    
    // 3. 处理任务消息
    const { taskId, payload } = parsedTask;
    
    // 4. 转换为内部命令格式
    const command = convertPayloadToCommand(taskId, payload);
    const commandJson = JSON.stringify(command);
    
    // 5. 分发任务
    const idleTab = getIdleTab();
    if (idleTab) {
        startTaskTracking(taskId, idleTab.id);
        setTabStatus(idleTab.id, 'busy');
        sendTaskToTab(idleTab.id, commandJson);
    } else {
        // 没有空闲 Tab，加入队列
        taskQueue.push({ taskId, commandJson });
    }
}
```

### 4.3 Chrome 消息通信

background.js 和 content.js 之间通过 Chrome 消息 API 通信：

```javascript
// ========== background.js 发送消息到 content.js ==========
function sendTaskToTab(tabId, task) {
    chrome.tabs.sendMessage(tabId, {
        type: 'COMMAND_FROM_SERVER',
        data: task
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Failed to send task:", chrome.runtime.lastError);
        }
    });
}

// ========== content.js 接收消息 ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'COMMAND_FROM_SERVER') {
        const command = JSON.parse(message.data);
        handleGenerateImageCommand(command);
    }
});

// ========== content.js 发送消息到 background.js ==========
chrome.runtime.sendMessage({
    type: 'COLLECTED_IMAGE_URLS',
    commandId: currentCommandId,
    urls: foundImageUrls
});

// ========== background.js 接收消息 ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'COLLECTED_IMAGE_URLS') {
        const taskId = message.commandId;
        const urls = message.urls || [];
        completeTask(taskId, urls);
    }
});
```

---

## 5. 如何添加新功能

### 5.1 添加新的系统消息类型

假设服务器新增了一个 `status` 消息类型：

```javascript
// 在 parseTaskMessage() 中添加
const systemMessageTypes = ['connected', 'ping', 'pong', 'heartbeat', 'ack', 'error', 'status'];  // 添加 'status'

// 在 handleWebSocketMessage() 中处理
if (parsedTask.isSystemMessage) {
    if (parsedTask.type === 'connected') {
        sendWebSocketMessage({ type: 'ready' });
    } else if (parsedTask.type === 'ping') {
        sendWebSocketMessage({ type: 'pong' });
    } else if (parsedTask.type === 'status') {
        // 新增：处理 status 消息
        console.log("[WebSocket] Server status:", parsedTask.data);
    }
    return;
}
```

### 5.2 添加新的任务类型

假设要支持 `video` 类型的任务：

```javascript
// 1. 修改 convertPayloadToCommand()
function convertPayloadToCommand(taskId, payload) {
    // ... 现有代码 ...
    
    // 判断任务类型
    const taskType = data.task_type || payload.task_type || 'image';
    
    return {
        commandId: taskId,
        task_type: taskType,  // 可能是 'image' 或 'video'
        prompt: prompt,
        // ... 其他字段 ...
    };
}

// 2. 修改 content.js 中的处理逻辑
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'COMMAND_FROM_SERVER') {
        const command = JSON.parse(message.data);
        
        if (command.task_type === 'image') {
            handleGenerateImageCommand(command);
        } else if (command.task_type === 'video') {
            handleGenerateVideoCommand(command);  // 新增函数
        }
    }
});

// 3. 实现新的处理函数
async function handleGenerateVideoCommand(command) {
    updateTabStatus("busy");
    currentCommandId = command.commandId;
    
    // 实现视频生成逻辑...
    
    // 完成后发送结果
    safeSendMessage({
        type: "COLLECTED_VIDEO_URLS",
        commandId: currentCommandId,
        urls: videoUrls
    });
}
```

### 5.3 添加新的设置项

假设要添加一个"任务超时时间"设置：

```javascript
// 1. 在 settings-panel.js 的 HTML 中添加输入框
const panelHTML = `
    ...
    <div class="setting-item">
        <label for="taskTimeout">任务超时时间（秒）</label>
        <input type="number" id="taskTimeout" value="60" min="10" max="300">
    </div>
    ...
`;

// 2. 修改 saveOptions()
async function saveOptions() {
    const taskTimeout = parseInt(document.getElementById('taskTimeout').value) || 60;
    
    await storageSet({ 
        autoReload,
        clearCookies,
        wsUrl,
        wsGroup,
        taskTimeout  // 新增
    });
}

// 3. 修改 loadOptions()
async function loadOptions() {
    const result = await storageGet(['autoReload', 'clearCookies', 'wsUrl', 'wsGroup', 'taskTimeout']);
    // ...
    document.getElementById('taskTimeout').value = result.taskTimeout || 60;
}

// 4. 在 background.js 中使用
chrome.storage.sync.get(['taskTimeout'], (result) => {
    const timeout = (result.taskTimeout || 60) * 1000;  // 转换为毫秒
    // 使用 timeout...
});
```

---

## 6. 调试技巧

### 6.1 查看 background.js 日志

1. 打开 `chrome://extensions/`
2. 找到你的插件
3. 点击 "Service Worker" 链接
4. 在打开的 DevTools 中查看 Console

### 6.2 查看 content.js 日志

1. 打开豆包网页
2. 按 F12 打开 DevTools
3. 在 Console 中查看日志

### 6.3 常用调试代码

```javascript
// 打印 WebSocket 状态
console.log("[Debug] WebSocket state:", ws?.readyState);
// 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED

// 打印所有 Tab 状态
console.log("[Debug] All tabs:", Array.from(doubaoTabs.values()));

// 打印任务队列
console.log("[Debug] Task queue:", taskQueue);

// 打印活跃任务
console.log("[Debug] Active tasks:", Array.from(activeTasks.entries()));
```

### 6.4 重新加载插件

修改代码后需要重新加载：

1. 打开 `chrome://extensions/`
2. 点击插件卡片上的刷新按钮 🔄
3. 刷新豆包网页

---

## 7. 常见问题

### Q1: WebSocket 连接不上？

**检查清单：**
- [ ] 服务器是否在运行？
- [ ] URL 是否正确？（注意 ws:// 和 wss://）
- [ ] 是否打开了豆包页面？（插件需要至少一个豆包 Tab）
- [ ] 查看 Service Worker 控制台是否有错误

### Q2: 任务收不到？

**检查清单：**
- [ ] WebSocket 是否已连接？（设置面板显示"已连接"）
- [ ] 是否发送了 `ready` 消息？
- [ ] 服务器是否正确派发任务到你的 group？

### Q3: 图片 URL 收集不到？

**检查清单：**
- [ ] 豆包页面是否正常生成了图片？
- [ ] content.js 是否正确注入？（查看页面控制台）
- [ ] 是否有 CORS 错误？

### Q4: 如何测试？

1. **本地测试服务器**：使用 `ws://localhost:3000/ws`
2. **手动发送任务**：使用 WebSocket 测试工具发送任务消息
3. **查看日志**：在两个控制台（Service Worker 和页面）查看日志

---

## 附录：关键代码速查

| 功能 | 函数名 | 文件 |
|------|--------|------|
| 建立 WebSocket 连接 | `connectWebSocket()` | background.js |
| 解析消息 | `parseTaskMessage()` | background.js |
| 转换命令格式 | `convertPayloadToCommand()` | background.js |
| 分发任务 | `dispatchTask()` | background.js |
| 发送 WebSocket 消息 | `sendWebSocketMessage()` | background.js |
| 完成任务 | `completeTask()` | background.js |
| 失败任务 | `failTask()` | background.js |
| 执行图片生成 | `handleGenerateImageCommand()` | content.js |
| 收集图片 URL | `performSendAndCleanup()` | content.js |
| 更新 Tab 状态 | `updateTabStatus()` | content.js |
