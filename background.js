// background Service Worker

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.type === 'CAPTURE_REGION') {
    const { region } = message;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        sendResponse({ error: 'No active tab found' });
        return;
      }

      const windowId = tabs[0].windowId;

      chrome.tabs.captureVisibleTab(
        windowId,
        { format: 'png', quality: 100 },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          if (!dataUrl) {
            sendResponse({ error: 'captureVisibleTab returned empty result' });
            return;
          }
          sendResponse({ dataUrl, region });
        }
      );
    });

    return true; 
  }

  if (message.type === 'QR_DECODED') {
    
    const { otpauthUrl } = message;
    try {
      const parsed = parseOtpauthUrl(otpauthUrl);
      
      chrome.storage.local.get(['accounts'], (result) => {
        const accounts = result.accounts || [];
        
        const exists = accounts.find(a => a.secret === parsed.secret);
        if (!exists) {
          accounts.push(parsed);
          chrome.storage.local.set({ accounts }, () => {
            sendResponse({ success: true, account: parsed });
          });
        } else {
          sendResponse({ success: false, error: 'Account already exists' });
        }
      });
      
    } catch (e) {
      sendResponse({ success: false, error: 'Invalid QR code: ' + e.message });
    }
    
    return true;
  }

  if (message.type === 'GET_ACCOUNTS') {
    chrome.storage.local.get(['accounts'], (result) => {
      sendResponse({ accounts: result.accounts || [] });
    });
    return true;
  }

  if (message.type === 'DELETE_ACCOUNT') {
    chrome.storage.local.get(['accounts'], (result) => {
      const accounts = (result.accounts || []).filter((_, i) => i !== message.index);
      chrome.storage.local.set({ accounts }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === 'START_SCAN') {
    // Inject content script into active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ error: 'No active tab' });
        return;
      }
      
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['jsqr.js']
      }, () => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['overlay.js']
        }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true });
          }
        });
      });
    });
    
    return true;
  }
});

function parseOtpauthUrl(url) {
  // otpauth://totp/LABEL?secret=SECRET&issuer=ISSUER
  const urlObj = new URL(url);
  
  if (urlObj.protocol !== 'otpauth:') {
    throw new Error('Not an otpauth URL');
  }
  
  const type = urlObj.hostname; // 'totp' or 'hotp'
  const label = decodeURIComponent(urlObj.pathname.slice(1));
  const params = urlObj.searchParams;
  
  const secret = params.get('secret');
  if (!secret) throw new Error('No secret in QR code');
  
  const issuer = params.get('issuer') || label.split(':')[0] || 'Unknown';
  const account = label.includes(':') ? label.split(':')[1] : label;
  
  return {
    issuer: issuer.trim(),
    account: account.trim(),
    secret: secret.toUpperCase(),
    type,
    addedAt: Date.now()
  };
}
