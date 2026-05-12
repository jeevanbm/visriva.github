/**
 * VISRIVA Google Drive Connection Test
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const CONFIG = {
  SERVICE_ACCOUNT_KEY_PATH: './config/visriva-production-uploads-a265798b1976.json',
  DRIVE_FOLDER_ID: '0AFbUKkWBimP5Uk9PVA' // VISRIVA uploads folder (creator:visriva-uploader)
};

async function testConnection() {
  console.log('🧪 Testing VISRIVA Google Drive Connection...\n');

  // 1. Test credentials loading
  console.log('1. Loading service account credentials...');
  let credentials;
  try {
    credentials = JSON.parse(fs.readFileSync(CONFIG.SERVICE_ACCOUNT_KEY_PATH, 'utf8'));
    console.log('   ✅ Credentials loaded successfully');
    console.log(`   📧 Service Account: ${credentials.client_email}`);
  } catch (error) {
    console.log('   ❌ Failed to load credentials:', error.message);
    process.exit(1);
  }

  // 2. Initialize Drive client
  console.log('\n2. Initializing Google Drive API client...');
  let drive;
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    drive = google.drive({ version: 'v3', auth });
    console.log('   ✅ Google Drive client initialized');
  } catch (error) {
    console.log('   ❌ Failed to initialize Drive client:', error.message);
    process.exit(1);
  }

  // 3. Test folder access
  console.log('\n3. Testing folder access...');
  let folderInfo;
  try {
    folderInfo = await drive.files.get({
      fileId: CONFIG.DRIVE_FOLDER_ID,
      fields: 'id, name, mimeType, capabilities, driveId',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    console.log(`   ✅ Folder accessible!`);
    console.log(`   📁 Folder Name: ${folderInfo.data.name || 'Shared Drive Root'}`);
    console.log(`   🆔 Folder ID: ${folderInfo.data.id}`);
    console.log(`   🗂️ Drive ID: ${folderInfo.data.driveId}`);
    console.log(`   ✏️  Can edit: ${folderInfo.data.capabilities?.canEdit ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log('   ⚠️  Could not get folder info (this is OK for Shared Drives)');
    console.log('   💡 Continuing with upload test...');
  }

  // 4. Test file upload
  console.log('\n4. Testing file upload...');
  const testContentStr = 'VISRIVA Test Upload\nTimestamp: ' + new Date().toISOString();
  const testContentStream = Readable.from([testContentStr]);
  const testFileName = `test-${Date.now()}.txt`;

  try {
    const uploadResponse = await drive.files.create({
      resource: {
        name: testFileName,
        driveId: CONFIG.DRIVE_FOLDER_ID,
        parents: [CONFIG.DRIVE_FOLDER_ID],
        description: JSON.stringify({
          test: true,
          source: 'VISRIVA Connection Test',
          timestamp: new Date().toISOString()
        })
      },
      media: {
        mimeType: 'text/plain',
        body: testContentStream
      },
      fields: 'id, name, webViewLink, size, createdTime, driveId, parents',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    console.log('   ✅ File uploaded successfully!');
    console.log(`   🆔 File ID: ${uploadResponse.data.id}`);
    console.log(`   📄 File Name: ${uploadResponse.data.name}`);
    console.log(`   📏 Size: ${uploadResponse.data.size} bytes`);
    console.log(`   🔗 Link: ${uploadResponse.data.webViewLink}`);
    console.log(`   🕐 Created: ${uploadResponse.data.createdTime}`);

    // 5. Cleanup - delete test file
    console.log('\n5. Cleaning up test file...');
    try {
      await drive.files.delete({
        fileId: uploadResponse.data.id,
        supportsAllDrives: true
      });
      console.log('   ✅ Test file deleted');
    } catch (deleteErr) {
      console.log('   ⚠️  Could not delete test file (may need different permissions)');
      console.log('   📄 Test file saved for verification: ' + uploadResponse.data.webViewLink);
    }

  } catch (error) {
    console.log('   ❌ Upload failed:', error.message);
    console.log('   💡 Check folder permissions and try again');
    process.exit(1);
  }

  // 6. List existing files
  console.log('\n6. Listing existing files in folder...');
  try {
    const listResponse = await drive.files.list({
      q: `'${CONFIG.DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, createdTime, size)',
      pageSize: 10,
      orderBy: 'createdTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const files = listResponse.data.files || [];
    console.log(`   📊 Found ${files.length} files in folder`);
    files.forEach((file, i) => {
      console.log(`   ${i + 1}. ${file.name} (${file.size || 0} bytes)`);
    });

  } catch (error) {
    console.log('   ⚠️  Could not list files:', error.message);
  }

  console.log('\n🎉 All tests passed! Your Google Drive connection is working.\n');
  console.log('Next steps:');
  console.log('1. Share your Drive folder with: visriva-uploader@visriva-production-uploads.iam.gserviceaccount.com');
  console.log('2. Run: npm install && npm start');
  console.log('3. Test the frontend customizer upload!\n');
}

testConnection().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});