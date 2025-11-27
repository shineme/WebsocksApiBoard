# Design Document

## Overview

Omni-Adapter Gemini Chrome Extension 是一个基于现有 doubao-chrome 架构的 Chrome 扩展，用于自动化 Google Business Gemini 网站的图片生成功能。该扩展采用三层架构设计，通过 WebSocket 与任务派发服务器通信，支持多标签页管理和任务队列。

### Key Features
- 文字生成图片 (Text-to-Image)
- 图片+文字生成图片 (Image-to-Image)
- 多Tab轮询任务分发
- API响应拦截获取生成结果
- 与现有 Omni-Adapter 生态系统兼容

## Architecture

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
│  - API 响应拦截 (Chrome Debugger)                            │
│  - 结果收集和上报                                            │
└─────────────────────────┬───────────────────────────────────┘
                          │ Chrome 消息通信
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    content.js                                │
│                 (内容脚本)                                    │
│  - 注入到 Gemini 网页中                                      │
│  - 操作 ProseMirror 编辑器                                   │
│  - 执行图片生成任务                                          │
│  - 处理文件上传                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. 服务器发送任务 
   ↓
2. background.js 解析任务
   ↓
3. 轮询选择空闲 Tab
   ↓
4. content.js 执行任务
   ├── 选择 "Create images (Pro)" 模式
   ├── (可选) 上传参考图片
   ├── 输入 prompt 到 ProseMirror
   └── 点击发送按钮
   ↓
5. background.js 拦截 API 响应
   ├── 解析 widgetStreamAssist 响应
   └── 提取 fileId
   ↓
6. 下载图片 (base64)
   ↓
7. 发送结果到服务器
```

## Components and Interfaces

### 1. Background Script (background.js)

#### WebSocket Manager
```javascript
// 配置常量
const DEFAULT_WEBSOCKET_URL = 'wss://websock.aihack.top/ws';
const DEFAULT_GROUP = 'gemini';
const RECONNECT_DELAY_MS = 5000;

// 接口
interface WebSocketManager {
  connect(): void;
  disconnect(): void;
  send(message: object): boolean;
  getStatus(): { connected: boolean; state: string };
}
```

#### Tab Manager
```javascript
interface TabInfo {
  id: number;
  url: string;
  status: 'idle' | 'busy';
  lastUsed: number;
}

interface TabManager {
  addTab(tabId: number, url: string): void;
  removeTab(tabId: number): void;
  setStatus(tabId: number, status: string): void;
  getIdleTab(): TabInfo | null;
  getAllTabs(): TabInfo[];
}
```

#### Task Tracker
```javascript
interface TaskInfo {
  taskId: string;
  startTime: number;
  tabId: number;
  status: 'executing' | 'completed' | 'failed';
}

interface TaskTracker {
  startTracking(taskId: string, tabId: number): void;
  completeTask(taskId: string, result: any): void;
  failTask(taskId: string, error: string): void;
}
```

#### API Response Interceptor
```javascript
// 使用 Chrome Debugger API 拦截网络请求
interface ResponseInterceptor {
  attachDebugger(tabId: number): void;
  detachDebugger(tabId: number): void;
  parseWidgetStreamResponse(body: string): FileInfo[];
}

interface FileInfo {
  fileId: string;
  mimeType: string;
}
```

### 2. Content Script (content.js)

#### DOM Selectors
```javascript
const SELECTORS = {
  // 工具选择器
  TOOL_SELECTOR: '#tool-selector-menu-anchor',
  CREATE_IMAGES_OPTION: 'div[slot="headline"]:contains("Create images")',
  
  // 输入框
  PROSEMIRROR_EDITOR: '#agent-search-prosemirror-editor .ProseMirror',
  
  // 文件上传
  ADD_FILES_BUTTON: 'button[aria-label="Add files"]',
  UPLOAD_FILES_MENU: 'md-menu-item:contains("Upload files")',
  
  // 发送按钮
  SEND_BUTTON: '.send-button.submit'
};
```

#### Task Executor
```javascript
interface TaskExecutor {
  selectImageGenerationMode(): Promise<boolean>;
  uploadReferenceImage(imageUrl: string): Promise<boolean>;
  inputPrompt(text: string): Promise<boolean>;
  submitRequest(): Promise<boolean>;
  handleTask(command: TaskCommand): Promise<void>;
}

interface TaskCommand {
  commandId: string;
  task_type: 'image';
  prompt: string;
  ratio?: string;
  file?: boolean;
  imageUrl?: string;
}
```

### 3. Settings Panel (settings-panel.js)

```javascript
interface SettingsPanel {
  show(): void;
  hide(): void;
  loadSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
}

interface Settings {
  wsUrl: string;
  wsGroup: string;
  autoReload: boolean;
  clearCookies: boolean;
}
```

## Data Models

### Task Message (Server → Extension)
```javascript
// 新格式
{
  type: 'task',
  taskId: 'uuid-string',
  payload: {
    model: 'gemini-image',
    messages: [{ role: 'user', content: 'prompt text' }],
    data: {
      prompt: 'prompt text',
      ratio: '1:1',
      imageUrl: 'https://...' // 可选，用于图生图
    },
    timeout: 60000
  }
}

// 旧格式 (兼容)
{
  commandId: 'cmd-123',
  task_type: 'image',
  prompt: 'prompt text',
  ratio: '1:1',
  file: true,
  imageUrl: 'https://...'
}
```

### Task Result (Extension → Server)
```javascript
// 成功
{
  type: 'task_complete',
  taskId: 'uuid-string',
  result: {
    images: [
      { fileId: '123', base64: 'data:image/png;base64,...' }
    ],
    status: 'completed'
  },
  duration: 15234
}

// 失败
{
  type: 'task_error',
  taskId: 'uuid-string',
  error: 'Error description',
  duration: 1234
}
```

### Gemini API Response Structure
```javascript
// widgetStreamAssist 响应
[
  {
    streamAssistResponse: {
      answer: {
        state: 'IN_PROGRESS' | 'SUCCEEDED',
        replies: [{
          groundedContent: {
            content: {
              role: 'model',
              file: {
                mimeType: 'image/png',
                fileId: '1837281645655610897'
              }
            }
          }
        }]
      }
    }
  }
]
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following properties can be verified through property-based testing:

### Property 1: WebSocket Reconnection Scheduling
*For any* WebSocket connection loss event, the system should schedule a reconnection attempt within the configured delay period (5 seconds).
**Validates: Requirements 1.2**

### Property 2: Ready Message Protocol
*For any* "connected" message received from the WebSocket server, the extension should respond with exactly one "ready" message.
**Validates: Requirements 1.3**

### Property 3: Settings Change Triggers Reconnection
*For any* change to WebSocket URL or group settings, the extension should close the existing connection and initiate a new connection with the updated settings.
**Validates: Requirements 1.4**

### Property 4: Tab Registration with Idle Status
*For any* tab URL matching the Gemini pattern (business.gemini.google/*), when registered, the tab should have status "idle" and a valid lastUsed timestamp.
**Validates: Requirements 2.1**

### Property 5: Tab Removal Consistency
*For any* tab that is removed from the tab manager, querying for that tab should return null/undefined.
**Validates: Requirements 2.2**

### Property 6: Round-Robin Task Distribution
*For any* sequence of N tasks distributed to M idle tabs (where N > M), each tab should receive approximately N/M tasks (±1), demonstrating fair distribution.
**Validates: Requirements 2.3**

### Property 7: Task Queuing When No Idle Tabs
*For any* task received when all tabs are busy, the task queue length should increase by exactly 1.
**Validates: Requirements 2.4**

### Property 8: Queue Processing on Tab Idle
*For any* tab status change from "busy" to "idle" when the queue is non-empty, the queue length should decrease by 1 and the tab should become "busy".
**Validates: Requirements 2.5**

### Property 9: Gemini API Response Parsing
*For any* valid widgetStreamAssist response containing fileId entries, the parser should extract all fileIds without loss or duplication.
**Validates: Requirements 5.1, 5.2**

### Property 10: Download URL Construction
*For any* fileId and session information, the constructed download URL should follow the pattern: `https://biz-discoveryengine.googleapis.com/download/v1alpha/projects/{projectId}/locations/global/collections/default_collection/engines/agentspace-engine/sessions/{sessionId}:downloadFile?fileId={fileId}&alt=media`
**Validates: Requirements 5.3**

### Property 11: Task Complete Message Format
*For any* successfully completed task, the task_complete message should contain: type="task_complete", valid taskId, result object with images array, and duration > 0.
**Validates: Requirements 6.1, 6.3**

### Property 12: Task Error Message Format
*For any* failed task, the task_error message should contain: type="task_error", valid taskId, non-empty error string, and duration >= 0.
**Validates: Requirements 6.2, 6.3**

### Property 13: Tab Status Update on Completion
*For any* task completion (success or failure), the associated tab's status should be set to "idle".
**Validates: Requirements 6.4**

### Property 14: Settings Persistence Round-Trip
*For any* settings object saved to Chrome storage, reading the settings back should return an equivalent object.
**Validates: Requirements 7.3**

### Property 15: Message Parsing Robustness
*For any* valid JSON message (new format or legacy format), the parser should correctly identify the message type and extract taskId and payload without throwing exceptions.
**Validates: Requirements 5.1**

## Error Handling

### Network Errors
| Error Type | Handling Strategy |
|------------|-------------------|
| WebSocket connection failed | Log error, schedule reconnect after 5s |
| WebSocket message send failed | Log warning, return false |
| API request timeout | Report task error, update tab status |

### DOM Errors
| Error Type | Handling Strategy |
|------------|-------------------|
| Element not found | Retry up to 3 times with 1s delay, then fail task |
| ProseMirror editor unavailable | Report error, fail task gracefully |
| File upload element missing | Report error, fail task gracefully |

### API Response Errors
| Error Type | Handling Strategy |
|------------|-------------------|
| Invalid JSON response | Log error with response body, continue monitoring |
| Missing fileId | Log warning, wait for next response chunk |
| Download failed | Report task error with details |

### Extension Context Errors
| Error Type | Handling Strategy |
|------------|-------------------|
| Context invalidated | Stop message sending, log warning |
| Tab closed during task | Cancel task, clean up resources |

## Testing Strategy

### Dual Testing Approach

This extension uses both unit testing and property-based testing to ensure correctness:

#### Unit Tests
- Specific examples for message parsing
- Edge cases for DOM element finding
- Error condition handling
- Integration points between background and content scripts

#### Property-Based Tests
- Use **fast-check** library for JavaScript property-based testing
- Configure minimum 100 iterations per property test
- Tag each test with format: `**Feature: gemini-chrome-extension, Property {number}: {property_text}**`

### Test Categories

#### 1. Message Parser Tests
- Parse new format task messages
- Parse legacy format task messages
- Handle malformed JSON gracefully
- Extract taskId and payload correctly

#### 2. Tab Manager Tests
- Add/remove tabs correctly
- Round-robin selection fairness
- Queue management
- Status transitions

#### 3. API Response Parser Tests
- Extract fileIds from various response formats
- Handle partial responses
- Handle empty responses
- Construct download URLs correctly

#### 4. Task Tracker Tests
- Track task start time
- Calculate duration correctly
- Build complete/error messages
- Clean up after completion

### Test File Structure
```
gemini-chrome/
├── __tests__/
│   ├── message-parser.test.js
│   ├── tab-manager.test.js
│   ├── api-parser.test.js
│   ├── task-tracker.test.js
│   └── properties/
│       ├── message-parser.property.test.js
│       ├── tab-manager.property.test.js
│       └── api-parser.property.test.js
```

### Property Test Example
```javascript
import fc from 'fast-check';

// **Feature: gemini-chrome-extension, Property 6: Round-Robin Task Distribution**
describe('Tab Manager Round-Robin', () => {
  it('distributes tasks fairly across idle tabs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 100 }), { minLength: 1, maxLength: 10 }), // tab IDs
        fc.nat({ min: 1, max: 50 }), // number of tasks
        (tabIds, taskCount) => {
          const manager = new TabManager();
          tabIds.forEach(id => manager.addTab(id, 'https://business.gemini.google/'));
          
          const distribution = new Map();
          for (let i = 0; i < taskCount; i++) {
            const tab = manager.getIdleTab();
            distribution.set(tab.id, (distribution.get(tab.id) || 0) + 1);
          }
          
          // Check fair distribution (each tab gets ±1 of average)
          const avg = taskCount / tabIds.length;
          return [...distribution.values()].every(count => 
            Math.abs(count - avg) <= 1
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
```
