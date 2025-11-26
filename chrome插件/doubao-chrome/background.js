// Function to clear all cookies
async function clearAllCookies() {
  // 检查设置
  const result = await chrome.storage.sync.get(['clearCookies']);
  if (result.clearCookies === false) {
    console.log("Cookie clearing is disabled in settings");
    return;
  }

  console.log("Clearing all cookies");
  try {
    const allCookies = await chrome.cookies.getAll({});
    for (const cookie of allCookies) {
      const protocol = cookie.secure ? "https:" : "http:";
      const cookieUrl = `${protocol}//${cookie.domain.replace(/^\./, "")}${
        cookie.path
      }`;
      await chrome.cookies.remove({
        url: cookieUrl,
        name: cookie.name,
        storeId: cookie.storeId,
      });
    }
    console.log("All cookies cleared successfully");
  } catch (error) {
    console.error("Error clearing cookies:", error);
  }
}

// 监听页面导航事件
chrome.webNavigation.onCommitted.addListener(
  async (details) => {
    if (details.frameId === 0) {
      // 只处理主框架
      await clearAllCookies();
    }
  },
  { url: [{ schemes: ["http", "https"] }] }
);

// 安装或更新时清除cookie，并尝试连接 WebSocket
chrome.runtime.onInstalled.addListener(() => {
  clearAllCookies();
  // 延迟一点再连接，确保其他初始化完成
  setTimeout(() => {
    console.log("[WebSocket] Attempting initial connection on install...");
    connectWebSocket();
  }, 1000);
});

// 插件启动时（如浏览器重启后）也尝试连接
chrome.runtime.onStartup.addListener(() => {
  console.log("[WebSocket] Attempting connection on browser startup...");
  setTimeout(() => {
    connectWebSocket();
  }, 1000);
});
streamRequestIds = new Set();
// 添加调试器监听器来拦截 EventStream 请求
chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (method === "Network.responseReceived") {
    const requestId = params.requestId; // 获取 requestId
    const response = params.response;

    // 检查 Content-Type 是否为 text/event-stream
    const contentType =
      response.headers["content-type"] || response.headers["Content-Type"]; // Header names can be case-insensitive
    if (contentType && contentType.includes("text/event-stream")) {
      console.log("EventStream Response Headers Received:", response);
      console.log("Request ID for EventStream:", requestId);
      streamRequestIds.add(requestId);
    }
  }
  // 如果你想捕获 EventSource 发送的单个消息（SSE 事件）
  // 你也可以监听 'Network.eventSourceMessageReceived'
  else if (method === "Network.loadingFinished") {
    const { requestId } = params;
    // 判断请求的id是否被记录，是stream类型
    if (streamRequestIds.has(requestId)) {
      try {
        // 使用 Network.getResponseBody 获取响应体
        // source 是 debuggee target，可以直接传递
        const responseBodyData = await chrome.debugger.sendCommand(
          source,
          "Network.getResponseBody",
          { requestId: requestId }
        );

        // responseBodyData 包含 { body: string, base64Encoded: boolean }
        let responseBody = responseBodyData.body;
        if (responseBodyData.base64Encoded) {
          // 如果是 base64 编码的，需要解码
          // 对于 text/event-stream，通常不会是 base64 编码的，但以防万一
          try {
            responseBody = atob(responseBody);
          } catch (e) {
            console.error("Failed to decode base64 body for event stream:", e);
            // Fallback to using the raw base64 string if decoding fails
          }
        }

        console.log("EventStream Response Body:", responseBody);

        // 解析EventStream响应
        const lines = responseBody.split('\n');
        const imageUrls = []; // 存储所有图片URL

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6); // 移除 'data: ' 前缀
              const data = JSON.parse(jsonStr);
              
              // 检查是否包含图片数据
              if (data.event_data) {
                const eventData = JSON.parse(data.event_data);
                if (eventData.message && eventData.message.content) {
                  const content = JSON.parse(eventData.message.content);
                  if (content.creations && Array.isArray(content.creations)) {
                    // 处理每个图片创建结果（旧结构）
                    content.creations.forEach(creation => {
                      if (creation.type === 1 && creation.image && creation.image.image_ori_raw) {
                        const imageUrl = creation.image.image_ori_raw.url;
                        if (imageUrl) {
                          imageUrls.push(imageUrl);
                          console.log('Found image URL:', imageUrl);
                        }
                      }
                    });
                  } else if (content.data && Array.isArray(content.data)) {
                    // 兼容新结构，遍历 data 数组
                    content.data.forEach(item => {
                      if (item.image_raw && item.image_raw.url) {
                        imageUrls.push(item.image_raw.url);
                        console.log('Found image URL (data):', item.image_raw.url);
                      }
                      // 如需其它格式可在此补充
                    });
                  }
                }
              }
            } catch (error) {
              console.error('Error parsing EventStream data:', error);
            }
          }
        }

        // 输出找到的所有图片URL
        if (imageUrls.length > 0) {
          console.log('Total images found:', imageUrls.length);
          console.log('All image URLs:', imageUrls);
          
          // 向content.js发送消息
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
              console.log('发送图片清单')
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'IMAGE_URLS',
                urls: imageUrls
              });
            }
          });
        }

        // 注意：对于 text/event-stream，Network.getResponseBody 可能只返回已接收到的部分
        // 或者在流结束时返回全部。如果你需要实时处理每个事件，
        // 你可能需要监听 'Network.eventSourceMessageReceived' 事件。
        // 但 'Network.getResponseBody' 会尝试获取当前可用的完整或部分主体。
      } catch (error) {
        console.error(
          `Error getting response body for requestId ${requestId}:`,
          error
        );
        // 常见错误：
        // - "No resource with given identifier found": 请求可能已完成或被取消，或者 requestId 无效。
        // - "Can only get response body on main resource": 不太可能用于 event-stream。
        // - If the stream is still actively pushing data and not yet "finished" in some sense,
        //   getResponseBody might give you what's buffered so far.
      }
      streamRequestIds.delete(requestId);
    }
  }
});

// ==================== WebSocket 管理 ====================
const DEFAULT_WEBSOCKET_URL = 'wss://websock.aihack.top/ws';
const DEFAULT_GROUP = 'doubao';
const RECONNECT_DELAY_MS = 5000;

// WebSocket 状态
let ws = null;
let reconnectTimeout = null;

// 任务跟踪
const activeTasks = new Map(); // taskId -> { taskId, startTime, tabId, status }

/**
 * 构建带 group 参数的 WebSocket URL
 * @param {string} baseUrl - 基础 WebSocket URL
 * @param {string} [group] - 可选的分组名称
 * @returns {string} 完整的 WebSocket URL
 */
function buildWebSocketUrl(baseUrl, group) {
    if (!group) {
        return baseUrl;
    }
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}group=${encodeURIComponent(group)}`;
}

// ==================== 消息解析器 ====================

/**
 * 检查消息是否为新格式 (type: 'task')
 * @param {object} message - 解析后的消息对象
 * @returns {boolean} 是否为新格式消息
 */
function isNewFormatMessage(message) {
    return message && typeof message === 'object' && message.type === 'task';
}

/**
 * 解析任务消息，支持新旧两种格式
 * @param {string} rawMessage - 原始消息字符串
 * @returns {object|null} 解析后的任务对象，失败返回 null；系统消息返回 { isSystemMessage: true }
 */
function parseTaskMessage(rawMessage) {
    try {
        const message = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
        
        // 忽略系统消息（如 connected, ping, pong 等）
        const systemMessageTypes = ['connected', 'ping', 'pong', 'heartbeat', 'ack', 'error'];
        if (message.type && systemMessageTypes.includes(message.type)) {
            console.log("[Parser] System message received:", message.type, message.message || '');
            return { isSystemMessage: true, type: message.type, data: message };
        }
        
        // 尝试新格式解析
        if (isNewFormatMessage(message)) {
            if (!message.taskId) {
                console.error("[Parser] New format message missing taskId");
                return null;
            }
            return {
                isNewFormat: true,
                taskId: message.taskId,
                payload: message.payload || {}
            };
        }
        
        // 尝试旧格式解析 (直接是命令对象)
        if (message.commandId || message.prompt || message.task_type) {
            return {
                isNewFormat: false,
                taskId: message.commandId || `legacy-${Date.now()}`,
                payload: message
            };
        }
        
        console.warn("[Parser] Unknown message format, ignoring:", message);
        return null;
    } catch (e) {
        console.error("[Parser] Failed to parse message:", e);
        return null;
    }
}

/**
 * 将 payload 转换为内部命令格式
 * @param {string} taskId - 任务ID
 * @param {object} payload - 任务载荷
 * @returns {object} 内部命令格式
 */
function convertPayloadToCommand(taskId, payload) {
    // 如果 payload 已经是旧格式命令，直接使用
    if (payload.task_type || payload.prompt) {
        return {
            commandId: taskId,
            task_type: payload.task_type || 'image',
            prompt: payload.prompt || '',
            ratio: payload.ratio || '1:1',
            file: payload.file || !!payload.imageUrl,
            imageUrl: payload.imageUrl || null
        };
    }
    
    // 新格式 payload 解析
    const data = payload.data || {};
    const messages = payload.messages || [];
    
    // 从 messages 中提取 prompt (如果 data 中没有)
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

// ==================== 响应构建器 ====================

/**
 * 构建任务完成消息
 * @param {string} taskId - 任务ID
 * @param {string[]} urls - 收集到的图片URL列表
 * @param {number} startTime - 任务开始时间戳
 * @returns {object} 任务完成消息对象
 */
function buildTaskCompleteMessage(taskId, urls, startTime) {
    return {
        type: 'task_complete',
        taskId: taskId,
        result: {
            urls: urls || [],
            status: 'completed'
        },
        duration: Date.now() - startTime
    };
}

/**
 * 构建任务错误消息
 * @param {string} taskId - 任务ID
 * @param {string} error - 错误描述
 * @param {number} startTime - 任务开始时间戳
 * @returns {object} 任务错误消息对象
 */
function buildTaskErrorMessage(taskId, error, startTime) {
    return {
        type: 'task_error',
        taskId: taskId,
        error: error,
        duration: Date.now() - startTime
    };
}

/**
 * 开始跟踪任务
 * @param {string} taskId - 任务ID
 * @param {number} tabId - 执行任务的标签页ID
 */
function startTaskTracking(taskId, tabId) {
    activeTasks.set(taskId, {
        taskId: taskId,
        startTime: Date.now(),
        tabId: tabId,
        status: 'executing'
    });
}

/**
 * 完成任务跟踪并发送响应
 * @param {string} taskId - 任务ID
 * @param {string[]} urls - 收集到的图片URL列表
 */
function completeTask(taskId, urls) {
    const taskInfo = activeTasks.get(taskId);
    if (!taskInfo) {
        console.warn("[TaskTracker] Task not found:", taskId);
        // 即使没有跟踪信息，也发送完成消息
        sendWebSocketMessage(buildTaskCompleteMessage(taskId, urls, Date.now()));
        return;
    }
    
    taskInfo.status = 'completed';
    const message = buildTaskCompleteMessage(taskId, urls, taskInfo.startTime);
    sendWebSocketMessage(message);
    activeTasks.delete(taskId);
    console.log("[TaskTracker] Task completed:", taskId, "Duration:", message.duration, "ms");
}

/**
 * 任务失败处理
 * @param {string} taskId - 任务ID
 * @param {string} error - 错误描述
 */
function failTask(taskId, error) {
    const taskInfo = activeTasks.get(taskId);
    if (!taskInfo) {
        console.warn("[TaskTracker] Task not found for failure:", taskId);
        sendWebSocketMessage(buildTaskErrorMessage(taskId, error, Date.now()));
        return;
    }
    
    taskInfo.status = 'failed';
    const message = buildTaskErrorMessage(taskId, error, taskInfo.startTime);
    sendWebSocketMessage(message);
    activeTasks.delete(taskId);
    console.log("[TaskTracker] Task failed:", taskId, "Error:", error);
}

// ==================== 标签页管理 ====================
let doubaoTabs = new Map(); // tabId -> { id, url, status: 'idle' | 'busy', lastUsed: timestamp }
let taskQueue = []; // 任务队列
let currentTabIndex = 0; // 轮询索引

// tab状态管理
function addDoubaoTab(tabId, url) {
  doubaoTabs.set(tabId, {
    id: tabId,
    url: url,
    status: 'idle',
    lastUsed: Date.now()
  });
}

function removeDoubaoTab(tabId) {
  if (doubaoTabs.has(tabId)) {
    doubaoTabs.delete(tabId);
  }
}

function setTabStatus(tabId, status) {
  if (doubaoTabs.has(tabId)) {
    doubaoTabs.get(tabId).status = status;
    if (status === 'idle') {
      doubaoTabs.get(tabId).lastUsed = Date.now();
    }
  }
}

function getIdleTab() {
  // 轮询策略：找到空闲的tab
  const idleTabs = Array.from(doubaoTabs.values()).filter(tab => tab.status === 'idle');
  
  if (idleTabs.length === 0) {
    return null;
  }
  
  // 使用轮询策略选择tab
  const selectedTab = idleTabs[currentTabIndex % idleTabs.length];
  currentTabIndex = (currentTabIndex + 1) % idleTabs.length;
  
  return selectedTab;
}

function getAllDoubaoTabs() {
  return Array.from(doubaoTabs.values());
}

// 任务分发
function dispatchTask(task) {
  const idleTab = getIdleTab();
  
  if (idleTab) {
    // 有空闲tab，直接分发
    setTabStatus(idleTab.id, 'busy');
    // 支持新格式任务对象 { taskId, commandJson }
    if (task.taskId && task.commandJson) {
      startTaskTracking(task.taskId, idleTab.id);
      sendTaskToTab(idleTab.id, task.commandJson);
    } else {
      sendTaskToTab(idleTab.id, task);
    }
    return true;
  } else {
    // 没有空闲tab，加入队列
    taskQueue.push(task);
    return false;
  }
}

function sendTaskToTab(tabId, task) {
  // 先检查tab是否还存在
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) {
      console.error(`[TaskManager] Tab ${tabId} no longer exists:`, chrome.runtime.lastError);
      removeDoubaoTab(tabId);
      processTaskQueue();
      return;
    }
    
    // 发送任务到tab
    chrome.tabs.sendMessage(tabId, {
      type: 'COMMAND_FROM_SERVER',
      data: task
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`[TaskManager] Failed to send task to tab ${tabId}:`, chrome.runtime.lastError);
        // 如果发送失败，将tab标记为空闲并重新分发任务
        setTabStatus(tabId, 'idle');
        processTaskQueue();
      }
    });
  });
}

function processTaskQueue() {
  while (taskQueue.length > 0) {
    const task = taskQueue.shift();
    if (!dispatchTask(task)) {
      // 如果无法分发，重新加入队列头部
      taskQueue.unshift(task);
      break;
    }
  }
}

// 任务完成回调
function onTaskCompleted(tabId) {
  setTabStatus(tabId, 'idle');
  processTaskQueue(); // 处理队列中的任务
}

/**
 * 建立WebSocket连接
 */
function connectWebSocket() {
    // 防止重复连接
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
    }

    chrome.storage.sync.get(['wsUrl', 'wsGroup'], (result) => {
        const baseUrl = result.wsUrl || DEFAULT_WEBSOCKET_URL;
        const group = result.wsGroup || DEFAULT_GROUP;
        const websocketUrl = buildWebSocketUrl(baseUrl, group);

        try {
            console.log("[WebSocket] Connecting to:", websocketUrl);
            ws = new WebSocket(websocketUrl);
            setupWebSocketHandlers();
        } catch (e) {
            console.error("[WebSocket] Connection failed:", e);
            scheduleReconnect();
        }
    });
}

/**
 * 设置WebSocket事件处理器
 */
function setupWebSocketHandlers() {
    ws.onopen = handleWebSocketOpen;
    ws.onmessage = handleWebSocketMessage;
    ws.onerror = handleWebSocketError;
    ws.onclose = handleWebSocketClose;
}

/**
 * WebSocket连接成功处理
 */
function handleWebSocketOpen() {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
    console.log("[WebSocket] Connection established");
    
    // 注意：不在这里发送 ready，等收到 connected 消息后再发送
    // 通知所有豆包标签页连接已建立
    notifyAllTabsConnectionReady();
}

/**
 * WebSocket消息处理
 */
function handleWebSocketMessage(event) {
    console.log("[WebSocket] Received message:", event.data);
    
    // 使用新的解析器解析消息
    const parsedTask = parseTaskMessage(event.data);
    
    if (!parsedTask) {
        console.warn("[WebSocket] Failed to parse message, skipping");
        return;
    }
    
    // 处理系统消息
    if (parsedTask.isSystemMessage) {
        console.log("[WebSocket] System message handled:", parsedTask.type);
        
        // 收到 connected 消息后，发送 ready 表示准备接收任务
        if (parsedTask.type === 'connected') {
            console.log("[WebSocket] Sending ready message...");
            sendWebSocketMessage({ type: 'ready' });
        }
        // 收到 ping 消息，回复 pong
        else if (parsedTask.type === 'ping') {
            sendWebSocketMessage({ type: 'pong' });
        }
        return;
    }
    
    const { taskId, payload, isNewFormat } = parsedTask;
    console.log("[WebSocket] Parsed task:", { taskId, isNewFormat });
    
    // 转换为内部命令格式
    const command = convertPayloadToCommand(taskId, payload);
    const commandJson = JSON.stringify(command);
    
    // 检查是否指定了目标标签页
    try {
        const originalMessage = JSON.parse(event.data);
        if (originalMessage.targetTabId && doubaoTabs.has(originalMessage.targetTabId)) {
            startTaskTracking(taskId, originalMessage.targetTabId);
            sendTaskToTab(originalMessage.targetTabId, commandJson);
            return;
        }
    } catch (e) {
        // 忽略解析错误
    }
    
    // 使用轮询策略分发任务
    const idleTab = getIdleTab();
    if (idleTab) {
        startTaskTracking(taskId, idleTab.id);
        setTabStatus(idleTab.id, 'busy');
        sendTaskToTab(idleTab.id, commandJson);
    } else {
        // 没有空闲tab，加入队列
        taskQueue.push({ taskId, commandJson });
        console.log("[WebSocket] No idle tab, task queued:", taskId);
    }
}

/**
 * WebSocket错误处理
 */
function handleWebSocketError(error) {
    console.warn("[WebSocket] Error:", error);
    // 让onclose处理连接关闭
}

/**
 * WebSocket连接关闭处理
 */
function handleWebSocketClose(event) {
    ws = null;
    scheduleReconnect();
}

/**
 * 通知所有豆包标签页连接已就绪
 */
function notifyAllTabsConnectionReady() {
    const allTabs = getAllDoubaoTabs();
    allTabs.forEach(tab => {
        chrome.tabs.get(tab.id, (tabInfo) => {
            if (tabInfo) {
                sendWebSocketMessage({ 
                    type: 'scriptReady', 
                    url: tabInfo.url, 
                    tabId: tab.id,
                    platform: 'doubao'
                });
            }
        });
    });
}

/**
 * 调度重连
 */
function scheduleReconnect() {
    if (reconnectTimeout === null) {
        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connectWebSocket();
        }, RECONNECT_DELAY_MS);
    } else {
    }
}

/**
 * 监听 storage 变化，支持动态切换 WebSocket URL 或 Group
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && (changes.wsUrl || changes.wsGroup)) {
        console.log('[WebSocket] Connection settings changed, reconnecting...', 
            changes.wsUrl?.newValue, changes.wsGroup?.newValue);

        // 关闭旧连接
        try {
            if (ws) {
                ws.close();
                ws = null;
            }
        } catch (e) {
            console.error('[WebSocket] Error closing old connection:', e);
        }

        // 清除重连定时器
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        // 立即使用新设置重连
        connectWebSocket();
    }
});

/**
 * 发送WebSocket消息
 */
function sendWebSocketMessage(data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("[WebSocket] Cannot send message, connection not open");
        return false;
    }

    try {
        const message = typeof data === 'object' ? JSON.stringify(data) : String(data);
        ws.send(message);
        return true;
    } catch (e) {
        console.error("[WebSocket] Failed to send message:", e);
        return false;
    }
}

/**
 * 获取WebSocket连接状态
 */
function getWebSocketStatus() {
    if (!ws) return { connected: false, state: 'disconnected', wsState: null };
    
    const states = ['connecting', 'open', 'closing', 'closed'];
    return {
        connected: ws.readyState === WebSocket.OPEN,
        state: states[ws.readyState] || 'unknown',
        wsState: ws.readyState  // 返回数字状态供设置面板使用
    };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'COLLECTED_IMAGE_URLS') {
        const taskId = message.commandId;
        const urls = message.urls || [];
        
        // 使用新的任务完成处理
        if (taskId && activeTasks.has(taskId)) {
            completeTask(taskId, urls);
        } else {
            // 兼容旧格式：发送旧格式消息
            sendWebSocketMessage({ 
                type: 'collectedImageUrls', 
                commandId: taskId,
                urls: urls,
                tabId: sender.tab.id
            });
        }
    } else if (message.type === 'TASK_COMPLETED') {
        // content script通知任务完成
        onTaskCompleted(sender.tab.id);
        sendResponse({ success: true });
    } else if (message.type === 'TAB_STATUS_UPDATE') {
        // content script更新tab状态
        if (message.status) {
            setTabStatus(sender.tab.id, message.status);
        }
        sendResponse({ success: true });
    } else if (message.type === 'ERROR_FROM_CONTENT') {
        // content script报告错误
        console.error(`[Background] Error from tab ${sender.tab.id}:`, message.error);
        const taskId = message.error.details?.commandId;
        
        // 使用新的任务失败处理
        if (taskId && activeTasks.has(taskId)) {
            failTask(taskId, message.error.message);
        } else {
            // 兼容旧格式
            sendWebSocketMessage({
                type: 'error',
                commandId: taskId,
                errorDetails: message.error.message,
                tabId: sender.tab.id
            });
        }
        sendResponse({ success: true });
    } else if (message.type === 'GET_TAB_STATUS') {
        // 获取所有tab状态
        const tabStatus = getAllDoubaoTabs().map(tab => ({
            id: tab.id,
            status: tab.status,
            lastUsed: tab.lastUsed,
            url: tab.url
        }));
        
        const wsStatus = getWebSocketStatus();
        sendResponse({ 
            tabs: tabStatus, 
            queueLength: taskQueue.length,
            wsConnected: wsStatus.connected,
            wsState: wsStatus.wsState
        });
        return true;
    } else if (message.type === 'FORCE_TASK_DISPATCH') {
        // 强制分发指定任务到指定tab
        if (message.tabId && message.task && doubaoTabs.has(message.tabId)) {
            sendTaskToTab(message.tabId, message.task);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Invalid tab or task' });
        }
        return true;
    }
});

// 处理插件图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  
  try {
    // 检查是否在豆包页面
    if (tab.url && tab.url.includes('doubao.com')) {
      // 注入设置面板到当前页面
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['settings-panel.js']
      });
    } else {
      // 如果不是豆包页面，打开新标签页
      chrome.tabs.create({ url: 'https://www.doubao.com' });
    }
  } catch (error) {
    console.error('[Action] Error injecting settings panel:', error);
  }
});

// 为所有标签页附加调试器
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url?.startsWith("https://www.doubao.com")
  ) {
    // 添加到tab管理器
    addDoubaoTab(tabId, tab.url);
    
    // 如果这是第一个tab，建立WebSocket连接
    if (doubaoTabs.size === 1) {
      connectWebSocket();
    }
    
    try {
      chrome.debugger.attach({ tabId }, "1.0", () => {
        if (chrome.runtime.lastError) {
          console.error("Debugger attach error:", chrome.runtime.lastError);
          return;
        }
        chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
          if (chrome.runtime.lastError) {
            console.error("Network enable error:", chrome.runtime.lastError);
          }
        });
      });
    } catch (error) {
      console.error("Debugger error:", error);
    }
  }
});

// 在标签页关闭时分离调试器
chrome.tabs.onRemoved.addListener((tabId) => {
  if (doubaoTabs.has(tabId)) {
    removeDoubaoTab(tabId);
    
    // 如果没有剩余的豆包tab，关闭WebSocket但保持重连机制
    if (doubaoTabs.size === 0) {
      if (ws) {
        ws.close();
      }
      // 保持重连机制工作，清空任务队列
      taskQueue = [];
      currentTabIndex = 0;
    }
  }
  
  try {
    chrome.debugger.detach({ tabId });
  } catch (error) {
    console.error("Debugger detach error:", error);
  }
});


