/**
 * Omni-Adapter Gemini Chrome Extension - Message Parser
 * 
 * Handles parsing of task messages from WebSocket server,
 * supporting both new and legacy message formats.
 */

// ============================================================================
// Message Format Detection
// ============================================================================

/**
 * Check if message is in new format
 * @param {object} message - Parsed message object
 * @returns {boolean} True if new format
 */
function isNewFormatMessage(message) {
  return message && 
         typeof message === 'object' &&
         message.type === 'task' &&
         typeof message.taskId === 'string' &&
         message.payload !== undefined;
}

/**
 * Check if message is in legacy format
 * @param {object} message - Parsed message object
 * @returns {boolean} True if legacy format
 */
function isLegacyFormatMessage(message) {
  return message &&
         typeof message === 'object' &&
         typeof message.commandId === 'string' &&
         message.task_type !== undefined;
}

// ============================================================================
// Message Parsing
// ============================================================================

/**
 * Parse task message from WebSocket
 * @param {string|object} rawMessage - Raw message (string or object)
 * @returns {object|null} Parsed task info or null if invalid
 */
function parseTaskMessage(rawMessage) {
  let message = rawMessage;
  
  // Parse JSON string if needed
  if (typeof rawMessage === 'string') {
    try {
      message = JSON.parse(rawMessage);
    } catch (e) {
      console.error('[Message Parser] Failed to parse JSON:', e);
      return null;
    }
  }
  
  if (!message || typeof message !== 'object') {
    return null;
  }
  
  // Handle new format
  if (isNewFormatMessage(message)) {
    return {
      taskId: message.taskId,
      type: 'task',
      payload: message.payload,
      command: convertPayloadToCommand(message.taskId, message.payload)
    };
  }
  
  // Handle legacy format
  if (isLegacyFormatMessage(message)) {
    return {
      taskId: message.commandId,
      type: 'task',
      payload: null,
      command: {
        commandId: message.commandId,
        task_type: message.task_type,
        prompt: message.prompt || '',
        ratio: message.ratio || '1:1',
        file: message.file || false,
        imageUrl: message.imageUrl || null
      }
    };
  }
  
  // Not a task message
  return null;
}

/**
 * Convert new format payload to command object
 * @param {string} taskId - Task ID
 * @param {object} payload - Payload from new format message
 * @returns {object} Command object
 */
function convertPayloadToCommand(taskId, payload) {
  const data = payload.data || {};
  const messages = payload.messages || [];
  
  // Extract prompt from messages or data
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
    ratio: data.ratio || '1:1',
    file: !!data.imageUrl,
    imageUrl: data.imageUrl || null
  };
}

/**
 * Get message type from raw message
 * @param {string|object} rawMessage - Raw message
 * @returns {string|null} Message type or null
 */
function getMessageType(rawMessage) {
  let message = rawMessage;
  
  if (typeof rawMessage === 'string') {
    try {
      message = JSON.parse(rawMessage);
    } catch (e) {
      return null;
    }
  }
  
  if (!message || typeof message !== 'object') {
    return null;
  }
  
  // New format has explicit type
  if (message.type) {
    return message.type;
  }
  
  // Legacy format detection
  if (message.commandId && message.task_type) {
    return 'task';
  }
  
  return null;
}

// ============================================================================
// Exports (for testing and module usage)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isNewFormatMessage,
    isLegacyFormatMessage,
    parseTaskMessage,
    convertPayloadToCommand,
    getMessageType
  };
}
