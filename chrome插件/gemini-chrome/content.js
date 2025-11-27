/**
 * Omni-Adapter Gemini Chrome Extension - Content Script
 * 
 * Gemini Shadow DOM Structure:
 * document → UCS-STANDALONE-APP.shadowRoot → UCS-CHAT-LANDING.shadowRoot 
 *   → UCS-SEARCH-BAR.shadowRoot → elements
 */

// ============================================================================
// State Management
// ============================================================================

let isProcessing = false;
let currentTaskId = null;

// ============================================================================
// Shadow DOM Navigation
// ============================================================================

/**
 * Get the search bar shadow root
 */
function getSearchBarShadow() {
  try {
    const app = document.querySelector('UCS-STANDALONE-APP');
    if (!app?.shadowRoot) return null;
    
    const chatLanding = app.shadowRoot.querySelector('UCS-CHAT-LANDING');
    if (!chatLanding?.shadowRoot) return null;
    
    const searchBar = chatLanding.shadowRoot.querySelector('UCS-SEARCH-BAR');
    if (!searchBar?.shadowRoot) return null;
    
    return searchBar.shadowRoot;
  } catch (e) {
    console.error('[Content] Error navigating Shadow DOM:', e);
    return null;
  }
}

/**
 * Get the tool selector button
 */
function getToolSelector() {
  const shadow = getSearchBarShadow();
  return shadow?.querySelector('#tool-selector-menu-anchor');
}

/**
 * Get the tools menu
 */
function getToolsMenu() {
  const shadow = getSearchBarShadow();
  return shadow?.querySelector('md-menu.tools-selector-menu');
}

/**
 * Get the ProseMirror editor
 */
function getEditor() {
  const shadow = getSearchBarShadow();
  if (!shadow) return null;
  
  const editorHost = shadow.querySelector('#agent-search-prosemirror-editor');
  if (!editorHost?.shadowRoot) return null;
  
  return editorHost.shadowRoot.querySelector('.ProseMirror');
}

/**
 * Get the submit button
 */
function getSubmitButton() {
  const shadow = getSearchBarShadow();
  if (!shadow) return null;
  
  // MD-ICON-BUTTON 是唯一的，直接选择
  const iconButton = shadow.querySelector('MD-ICON-BUTTON');
  if (!iconButton) return null;
  
  // Return the inner button if available for clicking
  if (iconButton.shadowRoot) {
    return iconButton.shadowRoot.querySelector('button') || iconButton;
  }
  return iconButton;
}

/**
 * Get the file picker menu
 */
function getFilePicker() {
  const shadow = getSearchBarShadow();
  return shadow?.querySelector('UCS-FILE-PICKER-MENU');
}

// ============================================================================
// Utility Functions
// ============================================================================

function isExtensionContextValid() {
  try { return chrome.runtime && chrome.runtime.id; } 
  catch (e) { return false; }
}

async function safeSendMessage(message) {
  if (!isExtensionContextValid()) return null;
  try { return await chrome.runtime.sendMessage(message); } 
  catch (e) { console.error('[Content] Send error:', e); return null; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function simulateClick(element) {
  if (!element) return;
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  try { element.click(); } catch (e) {}
}

async function waitFor(getter, timeout = 5000, interval = 200) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = getter();
    if (el) return el;
    await sleep(interval);
  }
  return null;
}

// ============================================================================
// Task Execution
// ============================================================================

/**
 * Select "Create images (Pro)" mode
 */
async function selectImageGenerationMode() {
  console.log('[Content] Selecting image generation mode...');
  
  // Click tool selector
  const toolSelector = await waitFor(getToolSelector, 3000);
  if (!toolSelector) {
    console.warn('[Content] Tool selector not found');
    return false;
  }
  
  simulateClick(toolSelector);
  await sleep(500);
  
  // Find and click "Create images" option
  const toolsMenu = getToolsMenu();
  if (!toolsMenu) {
    console.warn('[Content] Tools menu not found');
    return false;
  }
  
  const menuItems = toolsMenu.querySelectorAll('MD-MENU-ITEM');
  for (const item of menuItems) {
    const headline = item.querySelector('div[slot="headline"]');
    const text = headline?.textContent?.toLowerCase() || '';
    
    if (text.includes('create image') || text.includes('图片') || text.includes('imagen')) {
      console.log('[Content] Found image option:', headline?.textContent?.trim());
      simulateClick(item);
      await sleep(500);
      return true;
    }
  }
  
  console.warn('[Content] Create images option not found');
  document.body.click(); // Close menu
  return false;
}

/**
 * Input prompt into editor
 */
async function inputPrompt(text) {
  console.log('[Content] Inputting prompt:', text.substring(0, 50) + '...');
  
  const editor = await waitFor(getEditor, 5000);
  if (!editor) {
    console.error('[Content] Editor not found');
    return false;
  }
  
  editor.focus();
  await sleep(100);
  
  // Clear and set content
  editor.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = text;
  editor.appendChild(p);
  
  // Dispatch events
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  
  await sleep(200);
  console.log('[Content] Prompt entered');
  return true;
}

/**
 * Click submit button
 */
async function submitRequest() {
  console.log('[Content] Submitting...');
  
  await sleep(300);
  
  const button = await waitFor(getSubmitButton, 3000);
  if (!button) {
    console.error('[Content] Submit button not found');
    return false;
  }
  
  // Wait for button to be enabled
  let attempts = 0;
  while (button.disabled && attempts < 15) {
    await sleep(200);
    attempts++;
  }
  
  simulateClick(button);
  console.log('[Content] Submitted');
  return true;
}

/**
 * Upload reference image
 */
async function uploadReferenceImage(imageUrl) {
  console.log('[Content] Uploading image:', imageUrl);
  
  const shadow = getSearchBarShadow();
  if (!shadow) {
    console.error('[Content] Search bar shadow not found');
    return false;
  }
  
  // Find file picker
  const filePicker = shadow.querySelector('UCS-FILE-PICKER-MENU');
  if (!filePicker || !filePicker.shadowRoot) {
    console.error('[Content] File picker not found');
    return false;
  }
  
  const fpShadow = filePicker.shadowRoot;
  
  // Click "Add files" button to open menu
  const addButton = fpShadow.querySelector('MD-ICON-BUTTON[aria-label="Add files"]') ||
                    fpShadow.querySelector('MD-ICON-BUTTON');
  if (!addButton) {
    console.error('[Content] Add files button not found');
    return false;
  }
  
  console.log('[Content] Clicking Add files button...');
  simulateClick(addButton);
  await sleep(500);
  
  // Find and click "Upload files" menu item (first item)
  const menuItems = fpShadow.querySelectorAll('MD-MENU-ITEM');
  let uploadClicked = false;
  for (const item of menuItems) {
    const text = item.textContent?.toLowerCase() || '';
    if (text.includes('upload')) {
      console.log('[Content] Clicking Upload files option...');
      simulateClick(item);
      uploadClicked = true;
      await sleep(300);
      break;
    }
  }
  
  if (!uploadClicked) {
    console.error('[Content] Upload files option not found');
    return false;
  }
  
  // Find file input in file picker shadow
  const fileInput = fpShadow.querySelector('input.file-input') ||
                    fpShadow.querySelector('input[type="file"]');
  if (!fileInput) {
    console.error('[Content] File input not found');
    return false;
  }
  
  console.log('[Content] Found file input, downloading image...');
  
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], 'reference.png', { type: blob.type || 'image/png' });
    
    console.log('[Content] Setting file to input...');
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    await sleep(2000);
    console.log('[Content] Image uploaded');
    return true;
  } catch (e) {
    console.error('[Content] Upload failed:', e);
    return false;
  }
}

/**
 * Main task handler
 */
async function handleGenerateImageCommand(command) {
  if (isProcessing) {
    await sendErrorToBackground('Already processing');
    return;
  }

  isProcessing = true;
  currentTaskId = command.commandId;
  console.log('[Content] Starting task:', currentTaskId);

  try {
    await updateTabStatus('busy');

    // Step 1: Select image mode
    const modeSelected = await selectImageGenerationMode();
    if (!modeSelected) {
      throw new Error('Failed to select image generation mode');
    }

    // Step 2: Upload image if provided
    if (command.imageUrl) {
      const uploaded = await uploadReferenceImage(command.imageUrl);
      if (!uploaded) {
        throw new Error('Failed to upload reference image');
      }
    }

    // Step 3: Input prompt
    const prompted = await inputPrompt(command.prompt);
    if (!prompted) {
      throw new Error('Failed to input prompt');
    }

    // Step 4: Submit
    await sleep(300);
    const submitted = await submitRequest();
    if (!submitted) {
      throw new Error('Failed to submit request');
    }

    console.log('[Content] Task submitted, waiting for results...');

  } catch (error) {
    console.error('[Content] Task failed:', error);
    await sendErrorToBackground(error.message);
    isProcessing = false;
    currentTaskId = null;
    await updateTabStatus('idle');
  }
}

// ============================================================================
// Status Functions
// ============================================================================

async function updateTabStatus(status) {
  await safeSendMessage({ type: 'TAB_STATUS_UPDATE', status });
}

async function notifyTaskCompleted(images) {
  await safeSendMessage({ type: 'TASK_COMPLETED', taskId: currentTaskId, images });
  isProcessing = false;
  currentTaskId = null;
}

async function sendErrorToBackground(error) {
  await safeSendMessage({ type: 'TASK_ERROR', taskId: currentTaskId, error });
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] Message:', message.type);

  switch (message.type) {
    case 'COMMAND_FROM_SERVER':
      handleGenerateImageCommand(message.command);
      sendResponse({ received: true });
      break;
    case 'IMAGE_URLS':
      notifyTaskCompleted(message.images);
      sendResponse({ received: true });
      break;
    case 'EXTRACT_IMAGES':
      extractImagesFromPage().then(images => {
        sendResponse({ images });
      });
      return true; // Keep channel open for async response
    case 'PING':
      sendResponse({ pong: true, processing: isProcessing });
      break;
    default:
      sendResponse({ error: 'Unknown' });
  }
  return true;
});

// ============================================================================
// Image Extraction
// ============================================================================

/**
 * Extract generated images from the page
 */
async function extractImagesFromPage() {
  console.log('[Content] Extracting images from page...');
  const images = [];
  const foundUrls = new Set(); // Avoid duplicates
  
  try {
    const app = document.querySelector('UCS-STANDALONE-APP');
    if (!app?.shadowRoot) {
      console.log('[Content] UCS-STANDALONE-APP not found');
      return images;
    }
    
    // Try UCS-RESULTS first (after image generation)
    const results = app.shadowRoot.querySelector('UCS-RESULTS');
    if (results?.shadowRoot) {
      console.log('[Content] Searching UCS-RESULTS...');
      await searchShadowForImages(results.shadowRoot, foundUrls, images);
    }
    
    // Also try UCS-CHAT-LANDING (initial state)
    const chatLanding = app.shadowRoot.querySelector('UCS-CHAT-LANDING');
    if (chatLanding?.shadowRoot) {
      console.log('[Content] Searching UCS-CHAT-LANDING...');
      await searchShadowForImages(chatLanding.shadowRoot, foundUrls, images);
    }
    
    // Search entire app shadow root as fallback
    console.log('[Content] Searching entire app shadow root...');
    await searchShadowForImages(app.shadowRoot, foundUrls, images);
    
    console.log(`[Content] Found ${images.length} unique image(s)`);
  } catch (error) {
    console.error('[Content] Error extracting images:', error);
  }
  
  return images;
}

/**
 * Recursively search shadow DOM for images (blob, data, or https)
 */
async function searchShadowForImages(root, foundUrls, images) {
  if (!root) return;
  
  // Find img elements
  const imgs = root.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.src || '';
    
    // Skip if already processed or empty
    if (!src || foundUrls.has(src)) continue;
    
    // Skip small images (likely icons)
    if (img.naturalWidth > 0 && img.naturalWidth < 100) continue;
    if (img.naturalHeight > 0 && img.naturalHeight < 100) continue;
    
    // Process blob URLs
    if (src.startsWith('blob:')) {
      foundUrls.add(src);
      console.log('[Content] Found blob image:', src.substring(0, 60));
      const base64 = await blobUrlToBase64(src);
      if (base64) {
        images.push({ base64, mimeType: 'image/png' });
      }
    }
    // Process data URLs (already base64)
    else if (src.startsWith('data:image')) {
      foundUrls.add(src);
      console.log('[Content] Found data URL image');
      images.push({ base64: src, mimeType: extractMimeType(src) });
    }
    // Process https URLs (Google storage URLs for generated images)
    else if (src.includes('googleusercontent.com') || 
             src.includes('googleapis.com') ||
             src.includes('ggpht.com')) {
      foundUrls.add(src);
      console.log('[Content] Found Google image URL:', src.substring(0, 80));
      const base64 = await fetchImageAsBase64(src);
      if (base64) {
        images.push({ base64, mimeType: 'image/png' });
      }
    }
  }
  
  // Also check canvas elements
  const canvases = root.querySelectorAll('canvas');
  for (const canvas of canvases) {
    if (canvas.width > 100 && canvas.height > 100) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl && !foundUrls.has(dataUrl)) {
          foundUrls.add(dataUrl);
          console.log('[Content] Found canvas image');
          images.push({ base64: dataUrl, mimeType: 'image/png' });
        }
      } catch (e) {
        console.log('[Content] Canvas tainted, cannot extract');
      }
    }
  }
  
  // Recursively search shadow roots
  const elements = root.querySelectorAll('*');
  for (const el of elements) {
    if (el.shadowRoot) {
      await searchShadowForImages(el.shadowRoot, foundUrls, images);
    }
  }
}

/**
 * Extract MIME type from data URL
 */
function extractMimeType(dataUrl) {
  const match = dataUrl.match(/^data:([^;,]+)/);
  return match ? match[1] : 'image/png';
}

/**
 * Convert blob URL to base64
 */
async function blobUrlToBase64(blobUrl) {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[Content] Failed to convert blob:', error);
    return null;
  }
}

/**
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[Content] Failed to fetch image:', error);
    return null;
  }
}

// ============================================================================
// Init
// ============================================================================

console.log('[Gemini Extension] Content script loaded');

setTimeout(() => {
  console.log('[Content] Elements check:');
  console.log('  Tool selector:', !!getToolSelector());
  console.log('  Editor:', !!getEditor());
  console.log('  Submit button:', !!getSubmitButton());
}, 3000);

safeSendMessage({ type: 'CONTENT_SCRIPT_READY', url: window.location.href });
