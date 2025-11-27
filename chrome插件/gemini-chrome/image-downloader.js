/**
 * Omni-Adapter Gemini Chrome Extension - Image Downloader
 * 
 * Downloads generated images and converts them to base64.
 */

// ============================================================================
// Image Downloader Class
// ============================================================================

class ImageDownloader {
  constructor() {
    this.timeout = 30000; // 30 seconds timeout
  }

  /**
   * Download image and convert to base64
   * @param {string} url - Image URL
   * @param {object} options - Download options
   * @returns {Promise<object>} Image data with base64
   */
  async downloadAsBase64(url, options = {}) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const base64 = await this.blobToBase64(blob);

      return {
        success: true,
        base64: base64,
        mimeType: blob.type || 'image/png',
        size: blob.size
      };
    } catch (error) {
      console.error('[Image Downloader] Download failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert blob to base64 string
   * @param {Blob} blob - Image blob
   * @returns {Promise<string>} Base64 data URL
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Download multiple images
   * @param {Array} fileInfos - Array of file info objects
   * @param {function} urlBuilder - Function to build download URL
   * @returns {Promise<Array>} Array of download results
   */
  async downloadMultiple(fileInfos, urlBuilder) {
    const results = [];

    for (const fileInfo of fileInfos) {
      const url = urlBuilder(fileInfo.fileId);
      const result = await this.downloadAsBase64(url);

      results.push({
        fileId: fileInfo.fileId,
        mimeType: fileInfo.mimeType,
        ...result
      });
    }

    return results;
  }

  /**
   * Download image from URL and return as base64
   * @param {string} imageUrl - Source image URL
   * @returns {Promise<object>} Image data
   */
  async downloadFromUrl(imageUrl) {
    return this.downloadAsBase64(imageUrl);
  }
}

// ============================================================================
// Exports (for testing and module usage)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImageDownloader };
}
