/**
 * Omni-Adapter Gemini Chrome Extension - WebSocket Manager
 * 
 * Handles WebSocket connection to task dispatch server,
 * including reconnection logic and message handling.
 */

// ============================================================================
// WebSocket Manager Class
// ============================================================================

class WebSocketManager {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || 'wss://websock.aihack.top/ws';
    this.wsGroup = options.wsGroup || 'gemini';
    this.reconnectDelay = options.reconnectDelay || 5000;
    
    this.ws = null;
    this.connected = false;
    this.reconnectTimer = null;
    
    // Callbacks
    this.onMessage = options.onMessage || null;
    this.onConnect = options.onConnect || null;
    this.onDisconnect = options.onDisconnect || null;
    this.onError = options.onError || null;
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Build WebSocket URL with group parameter
   * @returns {string} Full WebSocket URL
   */
  buildWebSocketUrl() {
    const url = new URL(this.wsUrl);
    url.searchParams.set('group', this.wsGroup);
    return url.toString();
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || 
                    this.ws.readyState === WebSocket.OPEN)) {
      console.log('[WebSocket] Already connected or connecting');
      return;
    }

    this.clearReconnectTimer();
    
    const url = this.buildWebSocketUrl();
    console.log('[WebSocket] Connecting to:', url);
    
    try {
      this.ws = new WebSocket(url);
      this.setupWebSocketHandlers();
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
  }

  /**
   * Set up WebSocket event handlers
   */
  setupWebSocketHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.connected = true;
      if (this.onConnect) {
        this.onConnect();
      }
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket] Disconnected:', event.code, event.reason);
      this.connected = false;
      this.ws = null;
      
      if (this.onDisconnect) {
        this.onDisconnect(event);
      }
      
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      if (this.onError) {
        this.onError(error);
      }
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  /**
   * Handle incoming WebSocket message
   * @param {string} data - Raw message data
   */
  handleMessage(data) {
    let message;
    try {
      message = JSON.parse(data);
    } catch (e) {
      console.error('[WebSocket] Failed to parse message:', e);
      return;
    }

    console.log('[WebSocket] Received:', message.type || 'unknown');

    // Handle built-in message types
    switch (message.type) {
      case 'connected':
        // Server acknowledged connection, send ready
        this.sendReady();
        break;
        
      case 'ping':
        this.sendPong();
        break;
        
      default:
        // Pass to external handler
        if (this.onMessage) {
          this.onMessage(message);
        }
    }
  }

  /**
   * Send message to WebSocket server
   * @param {object} message - Message object
   * @returns {boolean} True if sent successfully
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send - not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WebSocket] Send error:', error);
      return false;
    }
  }

  /**
   * Send ready message after connection
   * @param {number} tabCount - Number of available tabs
   */
  sendReady(tabCount = 0) {
    this.send({
      type: 'ready',
      group: this.wsGroup,
      capabilities: {
        model: 'gemini-image',
        features: ['text-to-image', 'image-to-image'],
        tabCount: tabCount
      }
    });
  }

  /**
   * Send pong response to ping
   */
  sendPong() {
    this.send({
      type: 'pong',
      timestamp: Date.now()
    });
  }

  // ==========================================================================
  // Reconnection Logic
  // ==========================================================================

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.clearReconnectTimer();
    
    console.log(`[WebSocket] Scheduling reconnect in ${this.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Clear reconnection timer
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ==========================================================================
  // Settings Update
  // ==========================================================================

  /**
   * Update settings and reconnect
   * @param {object} settings - New settings
   */
  updateSettings(settings) {
    const needsReconnect = 
      settings.wsUrl !== this.wsUrl || 
      settings.wsGroup !== this.wsGroup;

    this.wsUrl = settings.wsUrl || this.wsUrl;
    this.wsGroup = settings.wsGroup || this.wsGroup;

    if (needsReconnect && this.connected) {
      console.log('[WebSocket] Settings changed, reconnecting...');
      this.disconnect();
      this.connect();
    }
  }

  // ==========================================================================
  // Status
  // ==========================================================================

  /**
   * Get connection status
   * @returns {object} Status object
   */
  getStatus() {
    return {
      connected: this.connected,
      state: this.ws ? this.ws.readyState : WebSocket.CLOSED,
      url: this.wsUrl,
      group: this.wsGroup
    };
  }
}

// ============================================================================
// Exports (for testing and module usage)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WebSocketManager };
}
