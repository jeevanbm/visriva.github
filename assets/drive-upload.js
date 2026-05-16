const DRIVE_CLIENT_EMAIL = "visriva-uploader@visriva-production-uploads.iam.gserviceaccount.com";
const DRIVE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC4m//DHSgbkPMH
20J4EP0NPlLmxgzsGN1YDipx4O8U5s+0G1t+B53sobyuOB3K+psKQiPEI6UpuAKv
t8K968ejl/Z8VetET7jJyPybQvhombtW/oNxkPtujkaO8zIMlzEakjzckq+iKAqP
Qo5g6f+4LSn4ZRrCBBuDHYlXgftt0jihIJ6VyOwttOeI0wP9nogy5+8C9d4/YkWV
ALALssABpppzyBy7aA7hfD65LZkWUP9A6s8xLFWVMpyzel6/uLSIbufWyoMNY5xs
rzL9xzcW7ZE1RfEE6569uLILtGSnMKVjVTxe++8U5iXwbDh+cldtbJ4o4hXfdn2I
+mcw/tKzAgMBAAECggEACAM5WCIhVgT2D268VVLDcPo2Be8tq2eu374JqJSvO9SC
ylnvoCo7eARTGKq13FQBO7JANCip6AQlFbRfnvenXBnh6GagRgBB0HxJPoHrHzsg
7vcwBFNbHmLNfDHhB7veNT2Ip7g0KFEdmDc2z80IPNm0+yOEREyCVzAGgIZTP+Jv
cPyqKXv5cj7qpNwbY/ycspqcTH4mZpXlsakfLC7D7LquXJqH7XAqOUoshPBGK3VP
uFOiaE30Fpj4Sfu50ot9paQpizIBXX1AyAsdGwD/sO32a2fL7Kg5JMGdechyUeKF
+/On70phZure3oS6UnYJCZhI9AGYv5cQFCLsxYYZpQKBgQD1fqZJVkdCIcCpAio5
ZrqFiEsqiB9Bqj6jg78TP8dk6vKuk9f3aMAuSD/ghqlgeuKHzgUDaR12UDQ/1Wbf
hFfrrUdbaLijOYe5pH2F0ivVaLo/ZCAPtaijF6UdilfUNbakWD613FAPh/s4nv9s
I9tj5688fu/5kO0Lm3VfnUhFDwKBgQDAglyHuUMIHrsmeLtmAgiIeXISdDpiYKS1
3J+4fRYj65WJ7ljyKWIdN2q79yLg1oRdeM49i3Twlu6IhVYofoiXb2YUp7WTX+Kz
jR6g3//BzhdMeVXRygGG98WH3qbZONY4FFhejlfAp3zVV/DuFhGedl21hBjU92P9
lk+fuUEAHQKBgFVbku/e6unomHdrREkvGd2CFTiVmeCYFC2Ainhj7a1+L6FZ0Ha6
2k99WZB04gGk2I0FqiKUcuUHYBNt3NYMyxEr76qtz70ZLML0mZxlBk6umkueQbOU
oy0J9KQ/zOgBQR8Fe9B56PBthIEcb40nLoofLYPoUwJATNuDUx1Kr60rAoGASoiu
hqYF+/jaAPUxqTcUUrKipd52VGySmQ8IkAduMQ4fYb30lh3LrQAtxQTUbjTgHsiN
IWsDJbtqM1VcnGURQYCSB2E/fgXb4iS7PRI9Fa5TevpnbchGexknU4mzE9tbpW7L
ICEAfMjcHkXkNGo6/B1b/tFcQ+hcwGwX/AFf10kCgYEA9JliQGQmE8W21g92HC4p
QktRsSMqLuOqsr8+5f0uYgfyUQnL+Y1YwQZvV4K5QEBOmaeL56wUDnQBoS43lWSL
Zp/473SZ3ztMMdk2MK0APF0Kzpvf1ULc0hLka2dAGDxH+hy9qHR2vk0emHFMOIvI
1O+S7orwwfcVeVuJ2etJjP0=
-----END PRIVATE KEY-----`;
const FOLDER_ID = "0AFbUKkWBimP5Uk9PVA";

async function getGoogleDriveAccessToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: DRIVE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const sJWT = KJUR.jws.JWS.sign("RS256", JSON.stringify(header), JSON.stringify(claim), DRIVE_PRIVATE_KEY);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${sJWT}`
  });
  
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  return data.access_token;
}

async function uploadToGoogleDrive(file) {
  const accessToken = await getGoogleDriveAccessToken();
  const metadata = {
    name: file.name,
    parents: [FOLDER_ID]
  };

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const metadataStr = "--" + boundary + "\r\n" +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n';
  
  const fileHeaderStr = delimiter +
    'Content-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n';

  const bodyBlob = new Blob([
    metadataStr,
    fileHeaderStr,
    file,
    close_delim
  ]);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: bodyBlob
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data.webViewLink;
}

document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll("[data-studio-form]");
  forms.forEach(form => {
    const originalSubmit = form.submit;
    form.submit = async function() {
      const statusReadout = form.querySelector("[data-studio-status]");
      const uploadInput = form.querySelector("[data-studio-upload]");
      const artworkNameProperty = form.querySelector("[data-studio-artwork-name-property]");
      
      const file = uploadInput && uploadInput.files && uploadInput.files[0];
      if (file) {
        if (statusReadout) statusReadout.textContent = "Uploading original artwork to Google Drive...";
        try {
          const url = await uploadToGoogleDrive(file);
          if (url && artworkNameProperty) {
            // Append Google Drive link to the property name so it shows in cart
            artworkNameProperty.value = `${file.name} (Drive: ${url})`;
          }
        } catch (e) {
          console.error("Google Drive Upload Error: ", e);
          if (statusReadout) statusReadout.textContent = "Failed to upload to Google Drive, but continuing...";
        }
      }
      
      if (statusReadout) statusReadout.textContent = "Adding your custom design to cart...";
      
      try {
        const formData = new FormData(form);
        const cartResponse = await fetch('/cart/add.js', {
          method: 'POST',
          body: formData
        });
        
        const data = await cartResponse.json();
        
        if (data.status && data.status >= 400) {
          throw new Error(data.description || data.message || "Failed to add to cart");
        }
        
        if (statusReadout) statusReadout.textContent = "Added successfully!";
        
        // Open Cart Drawer using the theme's Cart object
        if (window.Cart && typeof window.Cart.refresh === 'function') {
          await window.Cart.refresh();
          window.Cart.openDrawer();
        } else {
          // Redirect to the cart page
          window.location.href = '/cart';
        }
        
        // Re-enable button just in case
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = false;
        
      } catch (err) {
        console.error("Cart error: ", err);
        if (statusReadout) statusReadout.textContent = "Error: " + err.message + ". Please try again.";
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  });
});
