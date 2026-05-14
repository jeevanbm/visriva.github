/**
 * VISRIVA Custom Design Uploader
 * Connects frontend customizer to backend upload service
 */

const VisrivaUploader = (function() {
  const CONFIG = {
    // VISRIVA Backend Upload Endpoint
    UPLOAD_ENDPOINT: 'https://claude-visriva-shopify.onrender.com/api/upload-design',
    // For localhost testing:
    // UPLOAD_ENDPOINT: 'http://localhost:3000/api/upload-design',
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_TYPES: ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'],
    TIMEOUT: 120000 // 120 seconds for large uploads
  };

  let uploadEndpoint = CONFIG.UPLOAD_ENDPOINT;

  /**
   * Configure the upload endpoint URL
   * @param {string} url - Your backend upload endpoint URL
   */
  function configure(endpointUrl) {
    uploadEndpoint = endpointUrl;
    console.log('[VISRIVA Uploader] Endpoint configured:', uploadEndpoint);
  }

  /**
   * Upload design to Google Drive via backend
   * @param {string} imageDataUrl - Base64 data URL from canvas
   * @param {string} fileName - Original filename
   * @param {object} metadata - Additional metadata
   * @returns {Promise<object>} - Upload result
   */
  async function uploadDesign(imageDataUrl, fileName, metadata = {}) {
    try {
      // Convert data URL to blob
      const blob = dataURLtoBlob(imageDataUrl);

      // Create form data
      const formData = new FormData();
      formData.append('design', blob, fileName);
      formData.append('orderId', metadata.orderId || generateOrderId());
      formData.append('customerId', metadata.customerId || 'anonymous');
      formData.append('productId', metadata.productId || window.productId || 'unknown');
      formData.append('color', metadata.color || '#ffffff');
      formData.append('gsm', metadata.gsm || '220');
      formData.append('size', metadata.size || 'M');

      // Upload with fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      return {
        success: true,
        ...result
      };

    } catch (error) {
      console.error('[VISRIVA Uploader] Error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert data URL to Blob
   */
  function dataURLtoBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Generate unique order ID
   */
  function generateOrderId() {
    return 'VISRIVA-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Validate file before upload
   */
  function validateFile(file) {
    const errors = [];

    if (!CONFIG.ALLOWED_TYPES.includes(file.type)) {
      errors.push('Invalid file type. Only PNG, JPG, SVG, and PDF are allowed.');
    }

    if (file.size > CONFIG.MAX_FILE_SIZE) {
      errors.push(`File too large. Maximum size is ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get design info from backend
   */
  async function getDesignInfo(fileId) {
    try {
      const response = await fetch(`${uploadEndpoint.replace('/upload-design', '')}/design/${fileId}`);
      if (!response.ok) throw new Error('Failed to get design info');
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete design from backend
   */
  async function deleteDesign(fileId) {
    try {
      const response = await fetch(`${uploadEndpoint.replace('/upload-design', '')}/design/${fileId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete design');
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test connection to backend
   */
  async function testConnection() {
    try {
      const response = await fetch(uploadEndpoint.replace('/upload-design', '/designs'), {
        method: 'GET'
      });
      return { success: response.ok, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return {
    configure,
    uploadDesign,
    validateFile,
    getDesignInfo,
    deleteDesign,
    testConnection,
    CONFIG
  };
})();

// Make available globally
window.VisrivaUploader = VisrivaUploader;