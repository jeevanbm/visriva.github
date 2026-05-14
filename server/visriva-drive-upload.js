/**
 * VISRIVA Google Drive Upload Service
 * Handles custom design uploads from the T-shirt customizer
 * Retry deployment after secret unblock
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuration - Supports both env vars and local file fallback
const CONFIG = {
  // For local development: use file path
  // For production: use GOOGLE_SERVICE_ACCOUNT env var (JSON string)
  SERVICE_ACCOUNT_KEY_PATH: process.env.SERVICE_ACCOUNT_KEY_PATH || './config/visriva-production-uploads-a265798b1976.json',
  DRIVE_FOLDER_ID: process.env.DRIVE_FOLDER_ID || '0AFbUKkWBimP5Uk9PVA',
  SCOPES: ['https://www.googleapis.com/auth/drive.file']
};

/**
 * Initialize Google Drive API with Service Account
 */
function initializeDriveClient() {
  try {
    let credentials;

    // First try environment variable (for production deployment)
    if (process.env.GOOGLE_SERVICE_ACCOUNT) {
      console.log('[VISRIVA] GOOGLE_SERVICE_ACCOUNT env var found, length:', process.env.GOOGLE_SERVICE_ACCOUNT.length);
      try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
        console.log('[VISRIVA] Using service account from environment variable');
      } catch (parseError) {
        console.error('[VISRIVA] Failed to parse GOOGLE_SERVICE_ACCOUNT:', parseError.message);
        // Fall through to try file
      }
    }

    // Fallback to local file if env var didn't work
    if (!credentials) {
      console.log('[VISRIVA] Trying to load from file:', CONFIG.SERVICE_ACCOUNT_KEY_PATH);
      try {
        credentials = JSON.parse(
          fs.readFileSync(CONFIG.SERVICE_ACCOUNT_KEY_PATH, 'utf8')
        );
        console.log('[VISRIVA] Using service account from file');
      } catch (fileError) {
        console.error('[VISRIVA] Failed to load from file:', fileError.message);
        console.warn('[VISRIVA] WARNING: Server will start but upload functionality will not work until GOOGLE_SERVICE_ACCOUNT is configured');
        return null;
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: CONFIG.SCOPES
    });

    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error('Failed to initialize Google Drive client:', error.message);
    console.warn('[VISRIVA] WARNING: Google Drive not available. Uploads will fail until credentials are configured.');
    return null;
  }
}

/**
 * Upload file to Google Drive
 * @param {Buffer|Stream} fileData - The file data (buffer or stream)
 * @param {string} fileName - Original filename with extension
 * @param {string} mimeType - MIME type of the file
 * @param {object} metadata - Additional metadata (user info, order ID, etc.)
 * @returns {Promise<object>} - Upload result with webViewLink
 */
async function uploadToDrive(fileData, fileName, mimeType, metadata = {}) {
  const { Readable } = require('stream');
  const drive = initializeDriveClient();

  if (!drive) {
    throw new Error('Google Drive not configured. Please set GOOGLE_SERVICE_ACCOUNT environment variable in Render dashboard.');
  }

  // Sanitize filename to prevent Drive issues
  const sanitizedFileName = sanitizeFileName(fileName);

  // Add timestamp to prevent filename conflicts
  const timestamp = Date.now();
  const finalFileName = `${timestamp}_${sanitizedFileName}`;

  try {
    // Determine file size for progress tracking
    const fileSize = Buffer.isBuffer(fileData) ? fileData.length : null;

    console.log(`[VISRIVA] Starting upload: ${finalFileName} (${formatBytes(fileSize || 0)})`);

    // Create file metadata
    const fileMetadata = {
      name: finalFileName,
      driveId: CONFIG.DRIVE_FOLDER_ID,
      parents: [CONFIG.DRIVE_FOLDER_ID],
      description: JSON.stringify({
        ...metadata,
        uploadedAt: new Date().toISOString(),
        source: 'VISRIVA Customizer'
      })
    };

    // Convert buffer to stream if needed
    let mediaBody = fileData;
    if (Buffer.isBuffer(fileData)) {
      mediaBody = Readable.from([fileData]);
    }

    // Media configuration based on file type
    const mediaConfig = {
      mimeType,
      body: mediaBody
    };

    // Upload with resumable upload for large files (>5MB)
    const response = await drive.files.create({
      resource: fileMetadata,
      media: mediaConfig,
      fields: 'id, name, webViewLink, webContentLink, size, createdTime',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const result = {
      success: true,
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
      size: response.data.size,
      createdAt: response.data.createdTime
    };

    console.log(`[VISRIVA] Upload complete: ${response.data.webViewLink}`);

    return result;

  } catch (error) {
    console.error('[VISRIVA] Upload failed:', error.message);

    // Handle specific Google Drive API errors
    const errorHandler = handleDriveError(error);
    throw errorHandler;
  }
}

/**
 * Upload file with chunked processing for large files
 * @param {string} filePath - Path to the file on disk
 * @param {string} fileName - Original filename
 * @param {object} metadata - Additional metadata
 */
async function uploadLargeFile(filePath, fileName, metadata = {}) {
  const { Readable } = require('stream');
  const drive = initializeDriveClient();
  const sanitizedFileName = sanitizeFileName(fileName);
  const timestamp = Date.now();
  const finalFileName = `${timestamp}_${sanitizedFileName}`;

  const fileSize = fs.statSync(filePath).size;
  const chunkSize = 10 * 1024 * 1024; // 10MB chunks

  console.log(`[VISRIVA] Large file upload: ${finalFileName} (${formatBytes(fileSize)})`);

  try {
    // Create resumable upload session
    const createSessionResponse = await drive.files.create({
      resource: {
        name: finalFileName,
        parents: [CONFIG.DRIVE_FOLDER_ID],
        description: JSON.stringify({
          ...metadata,
          uploadedAt: new Date().toISOString(),
          source: 'VISRIVA Customizer',
          uploadType: 'resumable'
        })
      },
      media: {
        mimeType: getMimeType(fileName)
      },
      fields: 'id, name, webViewLink, size, createdTime',
      supportsAllDrives: true,
      uploadType: 'resumable'
    });

    // Upload in chunks
    const fileStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });
    let uploaded = 0;

    fileStream.on('data', (chunk) => {
      uploaded += chunk.length;
      const progress = Math.round((uploaded / fileSize) * 100);
      console.log(`[VISRIVA] Upload progress: ${progress}%`);
    });

    const result = await new Promise((resolve, reject) => {
      const chunks = [];
      fileStream.on('data', (chunk) => chunks.push(chunk));
      fileStream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);

          const response = await drive.files.create({
            resource: {
              name: finalFileName,
              parents: [CONFIG.DRIVE_FOLDER_ID]
            },
            media: {
              mimeType: getMimeType(fileName),
              body: buffer
            },
            fields: 'id, name, webViewLink, size, createdTime'
          });

          resolve({
            success: true,
            fileId: response.data.id,
            fileName: response.data.name,
            webViewLink: response.data.webViewLink,
            size: response.data.size
          });
        } catch (err) {
          reject(err);
        }
      });
      fileStream.on('error', reject);
    });

    return result;

  } catch (error) {
    console.error('[VISRIVA] Large file upload failed:', error.message);
    throw handleDriveError(error);
  }
}

/**
 * Handle Google Drive API errors with user-friendly messages
 */
function handleDriveError(error) {
  const errorMessages = {
    'ECONNRESET': new Error('Connection lost during upload. Please try again.'),
    'ETIMEDOUT': new Error('Upload timed out. Please check your connection.'),
    '413': new Error('File too large. Maximum size is 100MB.'),
    '403': new Error('Permission denied. Check service account access.'),
    '404': new Error('Folder not found. Verify your Folder ID.'),
    '500': new Error('Google Drive server error. Please try again later.'),
    '503': new Error('Google Drive is temporarily unavailable.')
  };

  const statusCode = error.response?.status;
  const errorCode = error.code;

  if (statusCode && errorMessages[statusCode]) {
    return errorMessages[statusCode];
  }

  if (errorCode && errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }

  // Generic error with details
  const customError = new Error('Upload failed. Please try again.');
  customError.details = error.message;
  customError.code = statusCode || errorCode;

  return customError;
}

/**
 * Sanitize filename for Google Drive compatibility
 */
function sanitizeFileName(fileName) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace invalid chars with underscore
    .replace(/_+/g, '_')              // Collapse multiple underscores
    .replace(/^_|_$/g, '')            // Remove leading/trailing underscores
    .substring(0, 200);               // Limit filename length
}

/**
 * Get MIME type from filename
 */
function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.gif': 'image/gif'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Express.js route handler for file uploads
 */
const express = require('express');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, SVG, and PDF are allowed.'));
    }
  }
});

const router = express.Router();

/**
 * POST /api/upload-design
 * Upload custom design to Google Drive
 */
router.post('/upload-design', upload.single('design'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const metadata = {
      orderId: req.body.orderId || 'direct-upload',
      customerId: req.body.customerId || 'anonymous',
      productId: req.body.productId || 'unknown'
    };

    const result = await uploadToDrive(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      metadata
    );

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[VISRIVA] Upload endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.details || null
    });
  }
});

/**
 * GET /api/design/:fileId
 * Get design file info from Google Drive
 */
router.get('/design/:fileId', async (req, res) => {
  try {
    const drive = initializeDriveClient();
    const fileId = req.params.fileId;

    const response = await drive.files.get({
      fileId,
      fields: 'id, name, webViewLink, size, createdTime, description'
    });

    res.json({
      success: true,
      file: {
        id: response.data.id,
        name: response.data.name,
        webViewLink: response.data.webViewLink,
        size: response.data.size,
        createdAt: response.data.createdTime,
        metadata: response.data.description ? JSON.parse(response.data.description) : {}
      }
    });

  } catch (error) {
    console.error('[VISRIVA] Get design error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/design/:fileId
 * Delete design file from Google Drive
 */
router.delete('/design/:fileId', async (req, res) => {
  try {
    const drive = initializeDriveClient();
    const fileId = req.params.fileId;

    await drive.files.delete({
      fileId,
      supportsAllDrives: true
    });

    res.json({
      success: true,
      message: 'Design deleted successfully'
    });

  } catch (error) {
    console.error('[VISRIVA] Delete design error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List all designs in the folder
 */
router.get('/designs', async (req, res) => {
  try {
    const drive = initializeDriveClient();

    const response = await drive.files.list({
      q: `'${CONFIG.DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink, size, createdTime, description)',
      orderBy: 'createdTime desc',
      pageSize: 50,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives'
    });

    const designs = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      webViewLink: file.webViewLink,
      size: file.size,
      createdAt: file.createdTime,
      metadata: file.description ? JSON.parse(file.description) : {}
    }));

    res.json({
      success: true,
      count: designs.length,
      designs
    });

  } catch (error) {
    console.error('[VISRIVA] List designs error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export functions for use in other modules
module.exports = {
  uploadToDrive,
  uploadLargeFile,
  initializeDriveClient,
  CONFIG,
  router
};

// ============== Start Server if run directly ==============
if (require.main === module) {
  const express = require('express');
  const cors = require('cors');
  const app = express();

  // Enhanced startup logging
  console.log('[VISRIVA] Starting upload service...');
  console.log('[VISRIVA] Node version:', process.version);
  console.log('[VISRIVA] NODE_ENV:', process.env.NODE_ENV || 'not set');
  console.log('[VISRIVA] PORT:', process.env.PORT || 'default 3000');
  console.log('[VISRIVA] DRIVE_FOLDER_ID:', CONFIG.DRIVE_FOLDER_ID);
  console.log('[VISRIVA] SERVICE_ACCOUNT_KEY_PATH:', CONFIG.SERVICE_ACCOUNT_KEY_PATH);
  console.log('[VISRIVA] GOOGLE_SERVICE_ACCOUNT set:', !!process.env.GOOGLE_SERVICE_ACCOUNT);
  if (process.env.GOOGLE_SERVICE_ACCOUNT) {
    console.log('[VISRIVA] GOOGLE_SERVICE_ACCOUNT length:', process.env.GOOGLE_SERVICE_ACCOUNT.length, 'chars');
  }

  // Enable CORS for all origins (Shopify storefront)
  app.use(cors());

  // Parse JSON and multipart form data
  app.use(express.json());

  // Mount API routes
  app.use('/api', router);

  // Health check endpoint
  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'VISRIVA Upload Service' });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[VISRIVA] Server running on port ${PORT}`);
  });
}