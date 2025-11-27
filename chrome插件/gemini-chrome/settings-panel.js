/**
 * Omni-Adapter Gemini Chrome Extension - Settings Panel
 * 
 * Provides UI for configuring extension settings and
 * displaying status information.
 */

// ============================================================================
// Settings Panel Module
// ============================================================================

const SettingsPanel = {
  panel: null,
  isVisible: false,

  // ==========================================================================
  // Panel Creation
  // ==========================================================================

  /**
   * Create the settings panel HTML
   * @returns {HTMLElement} Panel element
   */
  createPanel() {
    const panel = document.createElement('div');
    panel.id = 'gemini-settings-panel';
    panel.innerHTML = `
      <style>
        #gemini-settings-panel {
          position: fixed;
          top: 60px;
          right: 20px;
          width: 350px;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #e0e0e0;
        }
        #gemini-settings-panel .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #333;
          background: #252525;
          border-radius: 8px 8px 0 0;
        }
        #gemini-settings-panel .panel-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }
        #gemini-settings-panel .close-btn {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
        }
        #gemini-settings-panel .close-btn:hover {
          color: #fff;
        }
        #gemini-settings-panel .panel-content {
          padding: 16px;
        }
        #gemini-settings-panel .form-group {
          margin-bottom: 16px;
        }
        #gemini-settings-panel label {
          display: block;
          font-size: 12px;
          color: #888;
          margin-bottom: 6px;
        }
        #gemini-settings-panel input[type="text"] {
          width: 100%;
          padding: 8px 12px;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 4px;
          color: #e0e0e0;
          font-size: 13px;
          box-sizing: border-box;
        }
        #gemini-settings-panel input[type="text"]:focus {
          outline: none;
          border-color: #4a9eff;
        }
        #gemini-settings-panel .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #gemini-settings-panel .checkbox-group input {
          width: 16px;
          height: 16px;
        }
        #gemini-settings-panel .checkbox-group label {
          margin: 0;
          font-size: 13px;
          color: #e0e0e0;
        }
        #gemini-settings-panel .status-section {
          background: #252525;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 16px;
        }
        #gemini-settings-panel .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 12px;
        }
        #gemini-settings-panel .status-label {
          color: #888;
        }
        #gemini-settings-panel .status-value {
          font-weight: 500;
        }
        #gemini-settings-panel .status-connected {
          color: #4caf50;
        }
        #gemini-settings-panel .status-disconnected {
          color: #f44336;
        }
        #gemini-settings-panel .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }
        #gemini-settings-panel .btn-primary {
          background: #4a9eff;
          color: #fff;
        }
        #gemini-settings-panel .btn-primary:hover {
          background: #3a8eef;
        }
        #gemini-settings-panel .btn-secondary {
          background: #444;
          color: #e0e0e0;
        }
        #gemini-settings-panel .btn-secondary:hover {
          background: #555;
        }
        #gemini-settings-panel .btn-group {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }
        #gemini-settings-panel .tab-list {
          max-height: 120px;
          overflow-y: auto;
          background: #252525;
          border-radius: 4px;
          padding: 8px;
        }
        #gemini-settings-panel .tab-item {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 12px;
        }
        #gemini-settings-panel .tab-status-idle {
          color: #4caf50;
        }
        #gemini-settings-panel .tab-status-busy {
          color: #ff9800;
        }
      </style>
      <div class="panel-header">
        <h3>🤖 Gemini Adapter Settings</h3>
        <button class="close-btn" id="close-settings">×</button>
      </div>
      <div class="panel-content">
        <div class="status-section">
          <div class="status-item">
            <span class="status-label">WebSocket</span>
            <span class="status-value" id="ws-status">Disconnected</span>
          </div>
          <div class="status-item">
            <span class="status-label">Active Tabs</span>
            <span class="status-value" id="tab-count">0</span>
          </div>
          <div class="status-item">
            <span class="status-label">Queue</span>
            <span class="status-value" id="queue-count">0</span>
          </div>
        </div>
        
        <div class="form-group">
          <label>WebSocket URL</label>
          <input type="text" id="ws-url" placeholder="wss://websock.aihack.top/ws">
        </div>
        
        <div class="form-group">
          <label>Group Name</label>
          <input type="text" id="ws-group" placeholder="gemini">
        </div>
        
        <div class="form-group">
          <div class="checkbox-group">
            <input type="checkbox" id="auto-reload">
            <label for="auto-reload">Auto reload after task</label>
          </div>
        </div>
        
        <div class="form-group">
          <label>Gemini Tabs</label>
          <div class="tab-list" id="tab-list">
            <div class="tab-item">No tabs registered</div>
          </div>
        </div>
        
        <div class="btn-group">
          <button class="btn btn-primary" id="save-settings">Save</button>
          <button class="btn btn-secondary" id="reconnect-ws">Reconnect</button>
        </div>
      </div>
    `;
    return panel;
  },

  // ==========================================================================
  // Panel Display
  // ==========================================================================

  /**
   * Show the settings panel
   */
  show() {
    if (this.panel) {
      this.panel.style.display = 'block';
      this.isVisible = true;
      this.loadSettings();
      this.updateStatus();
      return;
    }

    this.panel = this.createPanel();
    document.body.appendChild(this.panel);
    this.isVisible = true;

    // Bind events
    this.bindEvents();
    this.loadSettings();
    this.updateStatus();
  },

  /**
   * Hide the settings panel
   */
  hide() {
    if (this.panel) {
      this.panel.style.display = 'none';
      this.isVisible = false;
    }
  },

  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  },

  // ==========================================================================
  // Event Binding
  // ==========================================================================

  /**
   * Bind panel events
   */
  bindEvents() {
    // Close button
    this.panel.querySelector('#close-settings').addEventListener('click', () => {
      this.hide();
    });

    // Save button
    this.panel.querySelector('#save-settings').addEventListener('click', () => {
      this.saveSettings();
    });

    // Reconnect button
    this.panel.querySelector('#reconnect-ws').addEventListener('click', () => {
      this.reconnect();
    });
  },

  // ==========================================================================
  // Settings Management
  // ==========================================================================

  /**
   * Load settings from Chrome storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'wsUrl',
        'wsGroup',
        'autoReload'
      ]);

      this.panel.querySelector('#ws-url').value = result.wsUrl || 'wss://websock.aihack.top/ws';
      this.panel.querySelector('#ws-group').value = result.wsGroup || 'gemini';
      this.panel.querySelector('#auto-reload').checked = result.autoReload || false;
    } catch (error) {
      console.error('[Settings] Failed to load settings:', error);
    }
  },

  /**
   * Save settings to Chrome storage
   */
  async saveSettings() {
    try {
      const settings = {
        wsUrl: this.panel.querySelector('#ws-url').value,
        wsGroup: this.panel.querySelector('#ws-group').value,
        autoReload: this.panel.querySelector('#auto-reload').checked
      };

      await chrome.storage.sync.set(settings);
      console.log('[Settings] Settings saved:', settings);
      
      // Notify background to update
      chrome.runtime.sendMessage({
        type: 'SETTINGS_UPDATED',
        settings: settings
      });
    } catch (error) {
      console.error('[Settings] Failed to save settings:', error);
    }
  },

  // ==========================================================================
  // Status Updates
  // ==========================================================================

  /**
   * Update status display
   */
  async updateStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATUS'
      });

      if (response) {
        // WebSocket status
        const wsStatus = this.panel.querySelector('#ws-status');
        wsStatus.textContent = response.wsConnected ? 'Connected' : 'Disconnected';
        wsStatus.className = 'status-value ' + 
          (response.wsConnected ? 'status-connected' : 'status-disconnected');

        // Tab count
        this.panel.querySelector('#tab-count').textContent = response.tabCount || 0;

        // Queue count
        this.panel.querySelector('#queue-count').textContent = response.queueLength || 0;

        // Tab list
        this.updateTabList(response.tabs || []);
      }
    } catch (error) {
      console.error('[Settings] Failed to get status:', error);
    }
  },

  /**
   * Update tab list display
   * @param {Array} tabs - Array of tab info
   */
  updateTabList(tabs) {
    const tabList = this.panel.querySelector('#tab-list');
    
    if (tabs.length === 0) {
      tabList.innerHTML = '<div class="tab-item">No tabs registered</div>';
      return;
    }

    tabList.innerHTML = tabs.map(tab => `
      <div class="tab-item">
        <span>Tab ${tab.id}</span>
        <span class="tab-status-${tab.status}">${tab.status}</span>
      </div>
    `).join('');
  },

  /**
   * Request WebSocket reconnection
   */
  reconnect() {
    chrome.runtime.sendMessage({
      type: 'RECONNECT_WS'
    });
    
    setTimeout(() => {
      this.updateStatus();
    }, 1000);
  }
};

// ============================================================================
// Auto-inject on Gemini pages
// ============================================================================

console.log('[Gemini Extension] Settings panel script loaded');
