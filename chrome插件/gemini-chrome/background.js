/**
 * Omni-Adapter Gemini Chrome Extension - Background Script
 * 
 * Handles WebSocket connection, tab management, task distribution,
 * and API response interception for Gemini image generation.
 */

// ============================================================================
// Configuration Constants
// ============================================================================

const DEFAULT_WEBSOCKET_URL = 'wss://websock.aihack.top/ws';
const DEFAULT_GROUP = 'gemini';
const RECONNECT_DELAY_MS = 5000;
const GEMINI_URL_PATTERN = /^https:\/\/business\.gemini\.google\//;

// ============================================================================
// State Management
// ============================================================================

let ws = null;
let wsConnected = false;
let reconnectTimer = null;
let currentSettings = {
  wsUrl: DEFAULT_WEBSOCKET_URL,
  wsGroup: DEFAULT_GROUP,
  autoReload: false
};

// Tab Manager State
const geminiTabs = new Map(); // tabId -> TabInfo
let roundRobinIndex = 0;

// Task Queue
const taskQueue = [];

// Task Tracker
const activeTasks = new Map(); // taskId -> TaskInfo

// API Interceptor State
const attachedDebuggers = new Map(); // tabId -> boolean
const pendingBodies = new Map(); // requestId -> { tabId, url }

// Session info for download URLs
let currentSessionInfo = {
  projectId: null,
  sessionId: null
};

// ============================================================================
// Initialization
// ============================================================================

console.log('[Gemini Extension] Background script starting...');

// Load settings and connect
loadSettings().then(() => {
  connectWebSocket();
});

// ============================================================================
// Settings Management
// ============================================================================

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'wsUrl',
      'wsGroup',
      'autoReload'
    ]);
    
    currentSettings = {
      wsUrl: result.wsUrl || DEFAULT_WEBSOCKET_URL,
      wsGroup: result.wsGroup || DEFAULT_GROUP,
      autoReload: result.autoReload || false
    };
    
    console.log('[Background] Settings loaded:', currentSettings);
  } catch (error) {
    console.error('[Background] Failed to load settings:', error);
  }
}

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    let needsReconnect = false;
    
    if (changes.wsUrl) {
      currentSettings.wsUrl = changes.wsUrl.newValue;
      needsReconnect = true;
    }
    if (changes.wsGroup) {
      currentSettings.wsGroup = changes.wsGroup.newValue;
      needsReconnect = true;
    }
    if (changes.autoReload) {
      currentSettings.autoReload = changes.autoReload.newValue;
    }
    
    if (needsReconnect) {
      console.log('[Background] Settings changed, reconnecting...');
      disconnectWebSocket();
      connectWebSocket();
    }
  }
});

// ============================================================================
// WebSocket Management
// ============================================================================

function buildWebSocketUrl() {
  const url = new URL(currentSettings.wsUrl);
  url.searchParams.set('group', currentSettings.wsGroup);
  return url.toString();
}

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    console.log('[WebSocket] Already connected or connecting');
    return;
  }

  clearReconnectTimer();
  
  const url = buildWebSocketUrl();
  console.log('[WebSocket] Connecting to:', url);
  
  try {
    ws = new WebSocket(url);
    setupWebSocketHandlers();
  } catch (error) {
    console.error('[WebSocket] Connection error:', error);
    scheduleReconnect();
  }
}

function disconnectWebSocket() {
  clearReconnectTimer();
  
  if (ws) {
    ws.close();
    ws = null;
  }
  
  wsConnected = false;
}

function setupWebSocketHandlers() {
  if (!ws) return;

  ws.onopen = () => {
    console.log('[WebSocket] Connected');
    wsConnected = true;
  };

  ws.onclose = (event) => {
    console.log('[WebSocket] Disconnected:', event.code, event.reason);
    wsConnected = false;
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = (error) => {
    console.error('[WebSocket] Error:', error);
  };

  ws.onmessage = (event) => {
    handleWebSocketMessage(event.data);
  };
}

function handleWebSocketMessage(data) {
  let message;
  try {
    message = JSON.parse(data);
  } catch (e) {
    console.error('[WebSocket] Failed to parse message:', e);
    return;
  }

  console.log('[WebSocket] Received:', message.type || 'unknown');

  switch (message.type) {
    case 'connected':
      sendReady();
      break;
      
    case 'ping':
      sendPong();
      break;
      
    case 'task':
      handleTaskMessage(message);
      break;
      
    default:
      // Legacy format check
      if (message.commandId && message.task_type) {
        handleLegacyTaskMessage(message);
      }
  }
}

function sendWebSocketMessage(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('[WebSocket] Cannot send - not connected');
    return false;
  }

  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('[WebSocket] Send error:', error);
    return false;
  }
}

function sendReady() {
  const tabCount = geminiTabs.size;
  sendWebSocketMessage({
    type: 'ready',
    group: currentSettings.wsGroup,
    capabilities: {
      model: 'gemini-image',
      features: ['text-to-image', 'image-to-image'],
      tabCount: tabCount
    }
  });
}

function sendPong() {
  sendWebSocketMessage({
    type: 'pong',
    timestamp: Date.now()
  });
}

function scheduleReconnect() {
  clearReconnectTimer();
  console.log(`[WebSocket] Scheduling reconnect in ${RECONNECT_DELAY_MS}ms`);
  reconnectTimer = setTimeout(() => {
    connectWebSocket();
  }, RECONNECT_DELAY_MS);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}


// ============================================================================
// Tab Management
// ============================================================================

function addGeminiTab(tabId, url) {
  geminiTabs.set(tabId, {
    id: tabId,
    url: url,
    status: 'idle',
    lastUsed: Date.now()
  });
  console.log(`[Tab Manager] Added tab ${tabId}, total tabs: ${geminiTabs.size}`);
  
  // Try to extract session info from page URL
  // URL format: https://business.gemini.google/home/cid/xxx?csesidx=xxx
  if (url) {
    const cidMatch = url.match(/\/cid\/([^/?]+)/);
    if (cidMatch) {
      currentSessionInfo.sessionId = cidMatch[1];
      console.log(`[Tab Manager] Extracted sessionId from URL: ${cidMatch[1]}`);
    }
  }
  
  // Attach debugger for API interception
  attachDebugger(tabId);
}

function removeGeminiTab(tabId) {
  geminiTabs.delete(tabId);
  console.log(`[Tab Manager] Removed tab ${tabId}, total tabs: ${geminiTabs.size}`);
  
  // Detach debugger
  detachDebugger(tabId);
  
  // Cancel any active tasks for this tab
  cancelTasksForTab(tabId);
}

function setTabStatus(tabId, status) {
  const tab = geminiTabs.get(tabId);
  if (tab) {
    const previousStatus = tab.status;
    tab.status = status;
    tab.lastUsed = Date.now();
    console.log(`[Tab Manager] Tab ${tabId} status: ${previousStatus} -> ${status}`);
    
    // Process queue when tab becomes idle
    if (previousStatus === 'busy' && status === 'idle') {
      processTaskQueue();
    }
  }
}

function getIdleTab() {
  const allTabs = Array.from(geminiTabs.values());
  const idleTabs = allTabs.filter(t => t.status === 'idle');
  
  if (idleTabs.length === 0) {
    return null;
  }
  
  // Round-robin selection
  const index = roundRobinIndex % idleTabs.length;
  roundRobinIndex++;
  
  return idleTabs[index];
}

function getAllGeminiTabs() {
  return Array.from(geminiTabs.values());
}

// ============================================================================
// Task Queue Management
// ============================================================================

function enqueueTask(task) {
  taskQueue.push(task);
  console.log(`[Task Queue] Task queued, queue length: ${taskQueue.length}`);
}

function dequeueTask() {
  return taskQueue.shift() || null;
}

function processTaskQueue() {
  if (taskQueue.length === 0) {
    return;
  }
  
  const idleTab = getIdleTab();
  if (!idleTab) {
    return;
  }
  
  const task = dequeueTask();
  if (task) {
    dispatchTaskToTab(task, idleTab.id);
  }
}

// ============================================================================
// Task Handling
// ============================================================================

function handleTaskMessage(message) {
  const taskId = message.taskId;
  const payload = message.payload || {};
  const data = payload.data || {};
  const messages = payload.messages || [];
  
  // Extract prompt
  let prompt = data.prompt || '';
  if (!prompt && messages.length > 0) {
    const userMessage = messages.find(m => m.role === 'user');
    if (userMessage) {
      prompt = userMessage.content || '';
    }
  }
  
  const command = {
    commandId: taskId,
    task_type: 'image',
    prompt: prompt,
    ratio: data.ratio || '1:1',
    file: !!data.imageUrl,
    imageUrl: data.imageUrl || null
  };
  
  dispatchTask(taskId, command);
}

function handleLegacyTaskMessage(message) {
  const command = {
    commandId: message.commandId,
    task_type: message.task_type,
    prompt: message.prompt || '',
    ratio: message.ratio || '1:1',
    file: message.file || false,
    imageUrl: message.imageUrl || null
  };
  
  dispatchTask(message.commandId, command);
}

function dispatchTask(taskId, command) {
  const idleTab = getIdleTab();
  
  if (!idleTab) {
    console.log('[Task] No idle tabs, queuing task');
    enqueueTask({ taskId, command });
    return;
  }
  
  dispatchTaskToTab({ taskId, command }, idleTab.id);
}

function dispatchTaskToTab(task, tabId) {
  const { taskId, command } = task;
  
  // Start tracking
  activeTasks.set(taskId, {
    taskId: taskId,
    tabId: tabId,
    command: command,
    startTime: Date.now(),
    status: 'executing'
  });
  
  // Update tab status
  setTabStatus(tabId, 'busy');
  
  // Send to content script
  chrome.tabs.sendMessage(tabId, {
    type: 'COMMAND_FROM_SERVER',
    command: command
  }).catch(error => {
    console.error('[Task] Failed to send to tab:', error);
    failTask(taskId, 'Failed to communicate with tab');
  });
  
  console.log(`[Task] Dispatched task ${taskId} to tab ${tabId}`);
}

function completeTask(taskId, images) {
  const task = activeTasks.get(taskId);
  if (!task) {
    console.warn(`[Task] Task ${taskId} not found`);
    return;
  }

  const duration = Date.now() - task.startTime;
  
  // Send result to server
  sendWebSocketMessage({
    type: 'task_complete',
    taskId: taskId,
    result: {
      images: images || [],
      status: 'completed'
    },
    duration: duration
  });

  console.log(`[Task] Task ${taskId} completed in ${duration}ms`);
  
  // Update tab status
  setTabStatus(task.tabId, 'idle');
  
  // Clean up
  activeTasks.delete(taskId);
  
  // Navigate to Gemini home page after task completion
  console.log(`[Task] Navigating tab ${task.tabId} to Gemini home`);
  chrome.tabs.update(task.tabId, { url: 'https://business.gemini.google/' });
}

function failTask(taskId, error) {
  const task = activeTasks.get(taskId);
  const startTime = task ? task.startTime : Date.now();
  const duration = Date.now() - startTime;

  // Send error to server
  sendWebSocketMessage({
    type: 'task_error',
    taskId: taskId,
    error: error || 'Unknown error',
    duration: duration
  });

  console.log(`[Task] Task ${taskId} failed: ${error}`);

  if (task) {
    setTabStatus(task.tabId, 'idle');
    activeTasks.delete(taskId);
    
    // Navigate to Gemini home page after task failure
    console.log(`[Task] Navigating tab ${task.tabId} to Gemini home after failure`);
    chrome.tabs.update(task.tabId, { url: 'https://business.gemini.google/' });
  }
}

function cancelTasksForTab(tabId) {
  for (const [taskId, task] of activeTasks.entries()) {
    if (task.tabId === tabId) {
      failTask(taskId, 'Tab closed during task execution');
    }
  }
}


// ============================================================================
// API Response Interception (Chrome Debugger)
// ============================================================================

async function attachDebugger(tabId) {
  if (attachedDebuggers.has(tabId)) {
    return true;
  }

  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
    attachedDebuggers.set(tabId, true);
    console.log(`[Debugger] Attached to tab ${tabId}`);
    return true;
  } catch (error) {
    console.error(`[Debugger] Failed to attach to tab ${tabId}:`, error);
    return false;
  }
}

async function detachDebugger(tabId) {
  if (!attachedDebuggers.has(tabId)) {
    return;
  }

  try {
    await chrome.debugger.detach({ tabId });
    attachedDebuggers.delete(tabId);
    console.log(`[Debugger] Detached from tab ${tabId}`);
  } catch (error) {
    console.error(`[Debugger] Failed to detach from tab ${tabId}:`, error);
    attachedDebuggers.delete(tabId);
  }
}

// Debugger event handler
chrome.debugger.onEvent.addListener(async (source, method, params) => {
  const tabId = source.tabId;

  if (method === 'Network.responseReceived') {
    const { requestId, response } = params;
    const url = response.url || '';

    // Extract session info from any URL containing projects/sessions
    if (url.includes('projects/') && url.includes('/sessions/')) {
      const projectMatch = url.match(/projects\/([^/]+)/);
      const sessionMatch = url.match(/sessions\/([^/:?]+)/);
      if (projectMatch) {
        currentSessionInfo.projectId = projectMatch[1];
        console.log(`[Debugger] Found projectId: ${projectMatch[1]}`);
      }
      if (sessionMatch) {
        currentSessionInfo.sessionId = sessionMatch[1];
        console.log(`[Debugger] Found sessionId: ${sessionMatch[1]}`);
      }
    }

    // Extract project info from googleapis URLs
    if (url.includes('googleapis.com') && url.includes('projects/')) {
      const projectMatch = url.match(/projects\/([^/]+)/);
      if (projectMatch && !currentSessionInfo.projectId) {
        currentSessionInfo.projectId = projectMatch[1];
        console.log(`[Debugger] Found projectId: ${projectMatch[1]}`);
      }
    }

    // Check if this is the widgetStreamAssist API
    if (url.includes('widgetStreamAssist') || url.includes('streamAssist')) {
      console.log(`[Debugger] Detected API response: ${url}`);
      pendingBodies.set(requestId, { tabId, url });
    }
  }

  if (method === 'Network.loadingFinished') {
    const { requestId } = params;
    const pending = pendingBodies.get(requestId);

    if (pending) {
      pendingBodies.delete(requestId);
      await fetchResponseBody(pending.tabId, requestId);
    }
  }
});

async function fetchResponseBody(tabId, requestId) {
  try {
    const response = await chrome.debugger.sendCommand(
      { tabId },
      'Network.getResponseBody',
      { requestId }
    );

    if (response && response.body) {
      parseWidgetStreamResponse(tabId, response.body);
    }
  } catch (error) {
    console.error('[Debugger] Failed to get response body:', error);
  }
}

function parseWidgetStreamResponse(tabId, body) {
  const fileInfos = [];

  try {
    // Try parsing as JSON array or newline-delimited JSON
    const lines = body.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        const extracted = extractFileInfoFromResponse(data);
        fileInfos.push(...extracted);
      } catch (e) {
        if (line.startsWith('[')) {
          try {
            const arr = JSON.parse(line);
            for (const item of arr) {
              const extracted = extractFileInfoFromResponse(item);
              fileInfos.push(...extracted);
            }
          } catch (e2) {}
        }
      }
    }

    // Try parsing entire body
    if (fileInfos.length === 0) {
      try {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          for (const item of data) {
            const extracted = extractFileInfoFromResponse(item);
            fileInfos.push(...extracted);
          }
        } else {
          const extracted = extractFileInfoFromResponse(data);
          fileInfos.push(...extracted);
        }
      } catch (e) {}
    }

    if (fileInfos.length > 0) {
      console.log(`[Debugger] Found ${fileInfos.length} file(s):`, fileInfos);
      handleImagesFound(tabId, fileInfos);
    }
  } catch (error) {
    console.error('[Debugger] Failed to parse response:', error);
  }
}

function extractFileInfoFromResponse(data) {
  const fileInfos = [];
  if (!data) return fileInfos;

  const streamAssistResponse = data.streamAssistResponse || data;
  const answer = streamAssistResponse.answer;
  if (!answer) return fileInfos;

  const state = answer.state;
  if (state !== 'SUCCEEDED' && state !== 'IN_PROGRESS') {
    return fileInfos;
  }

  const replies = answer.replies || [];
  for (const reply of replies) {
    const groundedContent = reply.groundedContent;
    if (!groundedContent) continue;

    const content = groundedContent.content;
    if (!content) continue;

    const file = content.file;
    if (file && file.fileId) {
      fileInfos.push({
        fileId: file.fileId,
        mimeType: file.mimeType || 'image/png'
      });
    }
  }

  return fileInfos;
}

async function handleImagesFound(tabId, fileInfos) {
  // Find the task for this tab
  let taskId = null;
  for (const [id, task] of activeTasks.entries()) {
    if (task.tabId === tabId) {
      taskId = id;
      break;
    }
  }

  if (!taskId) {
    console.warn('[Debugger] No active task for tab', tabId);
    return;
  }

  console.log(`[Debugger] Found ${fileInfos.length} fileId(s), waiting for images to render...`);
  
  // Wait for images to render on the page (retry multiple times)
  for (let attempt = 1; attempt <= 8; attempt++) {
    // Wait before trying (images need time to render)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`[Debugger] Attempt ${attempt}/8: Requesting images from content script`);
    
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'EXTRACT_IMAGES',
        fileIds: fileInfos.map(f => f.fileId)
      });
      
      console.log(`[Debugger] Content script response:`, response);
      
      if (response && response.images && response.images.length > 0) {
        console.log(`[Debugger] Got ${response.images.length} image(s) from content script`);
        completeTask(taskId, response.images);
        return;
      }
    } catch (error) {
      console.error(`[Debugger] Attempt ${attempt} failed:`, error);
    }
  }
  
  // Fallback: Try to download images directly using the download URL
  console.log(`[Debugger] Trying to download images directly...`);
  const images = [];
  
  for (const fileInfo of fileInfos) {
    const downloadUrl = buildDownloadUrl(fileInfo.fileId);
    if (downloadUrl) {
      const base64 = await downloadImage(downloadUrl);
      if (base64) {
        images.push({ 
          base64, 
          mimeType: fileInfo.mimeType,
          fileId: fileInfo.fileId
        });
        console.log(`[Debugger] Downloaded image: ${fileInfo.fileId}`);
      }
    }
  }
  
  if (images.length > 0) {
    console.log(`[Debugger] Successfully downloaded ${images.length} image(s)`);
    completeTask(taskId, images);
    return;
  }
  
  // Final fallback: return fileIds with download URLs only
  const fallbackImages = fileInfos.map(fileInfo => ({
    fileId: fileInfo.fileId,
    mimeType: fileInfo.mimeType,
    downloadUrl: buildDownloadUrl(fileInfo.fileId)
  }));
  
  console.log(`[Debugger] Final fallback: Completing task with fileIds only`);
  completeTask(taskId, fallbackImages);
}

function buildDownloadUrl(fileId) {
  const { projectId, sessionId } = currentSessionInfo;
  if (!projectId || !sessionId) {
    console.warn('[Debugger] Missing session info for download URL');
    return null;
  }
  
  const baseUrl = 'https://biz-discoveryengine.googleapis.com/download/v1alpha';
  const path = `projects/${projectId}/locations/global/collections/default_collection/engines/agentspace-engine/sessions/${sessionId}:downloadFile`;
  return `${baseUrl}/${path}?fileId=${fileId}&alt=media`;
}

async function downloadImage(url) {
  if (!url) return null;
  
  try {
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const blob = await response.blob();
    return await blobToBase64(blob);
  } catch (error) {
    console.error('[Debugger] Download failed:', error);
    return null;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


// ============================================================================
// Chrome Event Listeners
// ============================================================================

// Extension icon clicked
chrome.action.onClicked.addListener(async (tab) => {
  const url = tab.url || '';
  
  if (GEMINI_URL_PATTERN.test(url)) {
    // On Gemini page - inject and show settings panel
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['settings-panel.js']
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (typeof SettingsPanel !== 'undefined') {
            SettingsPanel.toggle();
          }
        }
      });
    } catch (error) {
      console.error('[Background] Failed to inject settings panel:', error);
    }
  } else {
    // Not on Gemini - open Gemini page
    chrome.tabs.create({
      url: 'https://business.gemini.google/'
    });
  }
});

// Tab updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (GEMINI_URL_PATTERN.test(tab.url)) {
      if (!geminiTabs.has(tabId)) {
        addGeminiTab(tabId, tab.url);
      }
    }
  }
});

// Tab removed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (geminiTabs.has(tabId)) {
    removeGeminiTab(tabId);
  }
});

// Web navigation completed
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0 && GEMINI_URL_PATTERN.test(details.url)) {
    if (!geminiTabs.has(details.tabId)) {
      addGeminiTab(details.tabId, details.url);
    }
  }
});

// ============================================================================
// Message Handling from Content Script
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  
  switch (message.type) {
    case 'CONTENT_SCRIPT_READY':
      console.log('[Background] Content script ready in tab', tabId);
      if (tabId && !geminiTabs.has(tabId)) {
        addGeminiTab(tabId, message.url);
      }
      sendResponse({ acknowledged: true });
      break;
      
    case 'TAB_STATUS_UPDATE':
      if (tabId) {
        setTabStatus(tabId, message.status);
      }
      sendResponse({ acknowledged: true });
      break;
      
    case 'TASK_COMPLETED':
      completeTask(message.taskId, message.images);
      sendResponse({ acknowledged: true });
      break;
      
    case 'TASK_ERROR':
      failTask(message.taskId, message.error);
      sendResponse({ acknowledged: true });
      break;
      
    case 'GET_STATUS':
      sendResponse({
        wsConnected: wsConnected,
        tabCount: geminiTabs.size,
        queueLength: taskQueue.length,
        tabs: getAllGeminiTabs()
      });
      break;
      
    case 'SETTINGS_UPDATED':
      // Settings will be picked up by storage.onChanged listener
      sendResponse({ acknowledged: true });
      break;
      
    case 'RECONNECT_WS':
      disconnectWebSocket();
      connectWebSocket();
      sendResponse({ acknowledged: true });
      break;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
  
  return true;
});

// ============================================================================
// Startup - Check for existing Gemini tabs
// ============================================================================

chrome.tabs.query({ url: 'https://business.gemini.google/*' }, (tabs) => {
  for (const tab of tabs) {
    if (tab.id && !geminiTabs.has(tab.id)) {
      addGeminiTab(tab.id, tab.url);
    }
  }
  console.log(`[Background] Found ${tabs.length} existing Gemini tab(s)`);
});

console.log('[Gemini Extension] Background script initialized');
