/**
 * drive-upload.js
 * Handles Google Drive artwork uploads and AJAX cart submission for the Superdesign customizer.
 */
(function() {
  const STATUS_SELECTOR = '[data-studio-status]';
  const SUBMIT_SELECTOR = '[data-studio-submit]';
  const FORM_SELECTOR = '[data-studio-form]';

  // Google Service Account Credentials (Restored from stable morning state)
  const CLIENT_EMAIL = "zariya-upload@zariya-415810.iam.gserviceaccount.com";
  const PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC69M0f7f3y4/1k\n...\n-----END PRIVATE KEY-----\n";
  const FOLDER_ID = "1p-uL9N4v5P9o_3_3q_v6y0G4X_X7pX_X"; // Example ID

  async function getAccessToken() {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };
    const sHeader = JSON.stringify(header);
    const sPayload = JSON.stringify(claim);
    const sJWT = KJUR.jws.JWS.sign("RS256", sHeader, sPayload, PRIVATE_KEY);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sJWT}`
    });
    const data = await response.json();
    return data.access_token;
  }

  async function uploadToDrive(file, accessToken) {
    const metadata = {
      name: file.name,
      parents: [FOLDER_ID]
    };
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: formData
    });
    return await response.json();
  }

  async function handleFormSubmission(event) {
    const form = event.target;
    if (!form.dataset.studioForm) return;
    
    event.preventDefault();
    const status = document.querySelector(STATUS_SELECTOR);
    const submitBtn = document.querySelector(SUBMIT_SELECTOR);
    
    if (submitBtn) submitBtn.disabled = true;
    if (status) status.textContent = "Uploading artwork to cloud storage...";

    try {
      const formData = new FormData(form);
      const artworkFile = formData.get('properties[Uploaded Artwork]');
      
      if (artworkFile && artworkFile.size > 0) {
        const token = await getAccessToken();
        const driveFile = await uploadToDrive(artworkFile, token);
        if (driveFile.id) {
          formData.set('properties[Artwork Cloud Link]', `https://drive.google.com/file/d/${driveFile.id}/view`);
        }
      }

      if (status) status.textContent = "Finalizing your design...";
      
      const cartResponse = await fetch('/cart/add.js', {
        method: 'POST',
        body: formData
      });

      if (!cartResponse.ok) throw new Error("Add to cart failed");
      
      if (status) status.textContent = "Success! Redirecting to cart...";
      window.location.href = "/cart";

    } catch (error) {
      console.error(error);
      if (status) status.textContent = "Error: " + error.message;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  document.addEventListener('submit', handleFormSubmission);
})();
