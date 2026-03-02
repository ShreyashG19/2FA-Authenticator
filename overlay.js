// overlay.js - Injected into the active tab for QR region selection

(function() {
  if (document.getElementById('__totp_overlay__')) return;

  let startX = 0, startY = 0;
  let isDrawing = false;
  let locked = false;

  // ── Build UI elements ──────────────────────────────────────────────────────
  const dim = document.createElement('div');
  dim.id = '__totp_overlay__';
  dim.style.cssText = 'position:fixed;inset:0;z-index:2147483640;cursor:crosshair;user-select:none;';

  const panelTop    = mkPanel();
  const panelBottom = mkPanel();
  const panelLeft   = mkPanel();
  const panelRight  = mkPanel();

  function mkPanel() {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;background:rgba(0,0,0,0.6);z-index:2147483641;pointer-events:none;';
    return d;
  }

  const selBox = document.createElement('div');
  selBox.style.cssText = 'position:fixed;border:2px solid #00d4ff;z-index:2147483642;pointer-events:none;display:none;';
  ['tl','tr','bl','br'].forEach(c => {
    const m = document.createElement('div');
    m.style.cssText = `position:absolute;width:12px;height:12px;background:#00d4ff;${c[0]==='t'?'top:-1px':'bottom:-1px'};${c[1]==='l'?'left:-1px':'right:-1px'};`;
    selBox.appendChild(m);
  });
  const sizeLabel = document.createElement('div');
  sizeLabel.style.cssText = 'position:absolute;bottom:-26px;left:0;color:#00d4ff;font:bold 11px monospace;white-space:nowrap;';
  selBox.appendChild(sizeLabel);

  // Banner — NEVER removed during processing, always visible
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;top:18px;left:50%;transform:translateX(-50%);
    background:#0d1220;color:#00d4ff;
    font:bold 13px 'DM Mono',monospace;
    padding:10px 22px;border-radius:8px;border:1.5px solid #00d4ff;
    box-shadow:0 0 24px rgba(0,212,255,0.25);
    z-index:2147483647;pointer-events:none;
    letter-spacing:0.8px;text-align:center;max-width:88vw;white-space:pre-line;
  `;
  banner.textContent = '▦  DRAG to select QR code area  •  ESC to cancel';

  const root = document.documentElement;
  [dim, panelTop, panelBottom, panelLeft, panelRight, selBox, banner].forEach(el => root.appendChild(el));
  updatePanels(0, 0, 0, 0);

  // ── Panel helpers ─────────────────────────────────────────────────────────
  function updatePanels(x, y, w, h) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const base = 'position:fixed;background:rgba(0,0,0,0.6);z-index:2147483641;pointer-events:none;';
    panelTop.style.cssText    = `${base}left:0;top:0;width:${vw}px;height:${y}px`;
    panelBottom.style.cssText = `${base}left:0;top:${y+h}px;width:${vw}px;height:${Math.max(0,vh-y-h)}px`;
    panelLeft.style.cssText   = `${base}left:0;top:${y}px;width:${x}px;height:${h}px`;
    panelRight.style.cssText  = `${base}left:${x+w}px;top:${y}px;width:${Math.max(0,vw-x-w)}px;height:${h}px`;
  }

  // ── Mouse events ──────────────────────────────────────────────────────────
  function getRect(cx, cy) {
    return {
      x: Math.round(Math.min(startX, cx)),
      y: Math.round(Math.min(startY, cy)),
      w: Math.round(Math.abs(cx - startX)),
      h: Math.round(Math.abs(cy - startY)),
    };
  }

  dim.addEventListener('mousedown', e => {
    if (locked) return;
    e.preventDefault();
    isDrawing = true;
    startX = e.clientX; startY = e.clientY;
    selBox.style.display = 'block';
  });

  dim.addEventListener('mousemove', e => {
    if (!isDrawing || locked) return;
    e.preventDefault();
    const {x,y,w,h} = getRect(e.clientX, e.clientY);
    selBox.style.cssText = `position:fixed;border:2px solid #00d4ff;z-index:2147483642;pointer-events:none;display:block;left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;
    sizeLabel.textContent = `${w} × ${h}`;
    selBox.appendChild(sizeLabel);
    updatePanels(x,y,w,h);
  });

  dim.addEventListener('mouseup', e => {
    if (!isDrawing || locked) return;
    e.preventDefault();
    isDrawing = false;

    const {x,y,w,h} = getRect(e.clientX, e.clientY);

    if (w < 40 || h < 40) {
      setMsg('Too small — drag a bigger area around the QR code', 'error');
      return;
    }

    locked = true;
    dim.style.cursor = 'wait';
    captureAndDecode(x, y, w, h);
  });

  // ── Main pipeline ─────────────────────────────────────────────────────────
  function captureAndDecode(cssX, cssY, cssW, cssH) {
    setMsg('📸  Capturing tab screenshot…', 'info');

    const dpr = window.devicePixelRatio || 1;
    const region = {
      x: Math.round(cssX * dpr),
      y: Math.round(cssY * dpr),
      w: Math.round(cssW * dpr),
      h: Math.round(cssH * dpr),
    };

    let responded = false;
    const guard = setTimeout(() => {
      if (responded) return;
      responded = true;
      setMsg('⏱  Timed out waiting for background.\nGo to chrome://extensions → click the extension\'s\n"Service Worker" link to check for errors.', 'error');
      unlockAfter(7000);
    }, 7000);

    try {
      chrome.runtime.sendMessage({ type: 'CAPTURE_REGION', region }, response => {
        clearTimeout(guard);
        if (responded) return;
        responded = true;

        if (chrome.runtime.lastError) {
          setMsg('❌  chrome.runtime error:\n' + chrome.runtime.lastError.message, 'error');
          unlockAfter(5000); return;
        }
        if (!response) {
          setMsg('❌  Background returned no response.\nReload the extension at chrome://extensions', 'error');
          unlockAfter(5000); return;
        }
        if (response.error) {
          setMsg('❌  Screenshot error:\n' + response.error, 'error');
          unlockAfter(5000); return;
        }
        if (!response.dataUrl || !response.dataUrl.startsWith('data:image')) {
          setMsg('❌  Screenshot empty (dataUrl missing).\nEnsure extension has "tabs" permission.', 'error');
          unlockAfter(5000); return;
        }

        setMsg('✂️  Screenshot captured — decoding QR…', 'info');
        decodeQR(response.dataUrl, region);
      });
    } catch(err) {
      clearTimeout(guard);
      setMsg('❌  sendMessage threw:\n' + err.message, 'error');
      unlockAfter(5000);
    }
  }

  function decodeQR(dataUrl, region) {
    if (typeof jsQR === 'undefined') {
      setMsg(
        '❌  jsQR library not loaded!\n\n' +
        'You have the placeholder file.\n' +
        'Download the real jsqr.js:\n' +
        'cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js\n' +
        'Replace totp-extension/jsqr.js then reload extension.',
        'error'
      );
      unlockAfter(10000);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const {x, y, w, h} = region;
      // Clamp to image bounds
      const sx = Math.max(0, Math.min(x, img.width  - 1));
      const sy = Math.max(0, Math.min(y, img.height - 1));
      const sw = Math.min(w, img.width  - sx);
      const sh = Math.min(h, img.height - sy);

      if (sw < 1 || sh < 1) {
        setMsg(`❌  Region out of bounds.\nImage: ${img.width}×${img.height}, Region: ${x},${y} ${w}×${h}`, 'error');
        unlockAfter(5000); return;
      }

      // Attempt 1: native size
      let code = tryDecode(img, sx, sy, sw, sh, 1);
      if (code) { onDecoded(code.data); return; }

      // Attempt 2: 3× upscale
      code = tryDecode(img, sx, sy, sw, sh, 3);
      if (code) { onDecoded(code.data); return; }

      // Attempt 3: contrast boost + threshold
      code = tryDecodeEnhanced(img, sx, sy, sw, sh);
      if (code) { onDecoded(code.data); return; }

      setMsg(
        '❌  No QR code found in that region.\n\n' +
        '• Select TIGHTLY around the QR square only\n' +
        '• Zoom in the page first (Ctrl/Cmd +)\n' +
        '• Make sure the QR is fully visible\n\n' +
        'ESC to cancel and try again.',
        'error'
      );
      unlockAfter(6000);
    };
    img.onerror = () => {
      setMsg('❌  Failed to load screenshot as image.', 'error');
      unlockAfter(3000);
    };
    img.src = dataUrl;
  }

  function tryDecode(img, sx, sy, sw, sh, scale) {
    const c = document.createElement('canvas');
    c.width = sw * scale; c.height = sh * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const id = ctx.getImageData(0, 0, c.width, c.height);
    return jsQR(id.data, id.width, id.height, { inversionAttempts: 'attemptBoth' });
  }

  function tryDecodeEnhanced(img, sx, sy, sw, sh) {
    const scale = 4;
    const c = document.createElement('canvas');
    c.width = sw * scale; c.height = sh * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const luma = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      const v = luma < 140 ? 0 : 255;
      d[i] = d[i+1] = d[i+2] = v;
    }
    ctx.putImageData(id, 0, 0);
    const id2 = ctx.getImageData(0, 0, c.width, c.height);
    return jsQR(id2.data, id2.width, id2.height, { inversionAttempts: 'attemptBoth' });
  }

  function onDecoded(data) {
    console.log('[TOTP] QR decoded:', data);
    if (!data.startsWith('otpauth://')) {
      setMsg('⚠️  QR found but not a 2FA code:\n' + data.substring(0, 80), 'warn');
      unlockAfter(5000); return;
    }
    setMsg('✅  QR decoded! Saving…', 'success');
    chrome.runtime.sendMessage({ type: 'QR_DECODED', otpauthUrl: data }, response => {
      if (chrome.runtime.lastError) {
        setMsg('❌  Save error: ' + chrome.runtime.lastError.message, 'error');
        unlockAfter(3000); return;
      }
      if (response && response.success) {
        const a = response.account;
        setMsg(`✅  Account saved!\n\n${a.issuer}  —  ${a.account}\n\nOpen the extension to see your code.`, 'success');
      } else {
        const err = (response && response.error) || 'Unknown save error';
        setMsg((err.includes('already') ? '⚠️  ' : '❌  ') + err, err.includes('already') ? 'warn' : 'error');
      }
      unlockAfter(3500);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setMsg(text, type) {
    const s = { info:['#0d1220','#00d4ff','#00d4ff'], success:['#0d1f10','#00ff88','#00ff88'], error:['#1f0d0d','#ff4455','#ff6677'], warn:['#1a1500','#ffaa00','#ffcc33'] }[type] || ['#0d1220','#00d4ff','#00d4ff'];
    banner.style.background  = s[0];
    banner.style.borderColor = s[1];
    banner.style.color       = s[2];
    banner.style.boxShadow   = `0 0 24px ${s[1]}44`;
    banner.textContent       = text;
  }

  function unlockAfter(ms) {
    setTimeout(cleanup, ms);
  }

  function cleanup() {
    document.removeEventListener('keydown', onKey);
    [dim, panelTop, panelBottom, panelLeft, panelRight, selBox, banner].forEach(el => { try { el.remove(); } catch(e){} });
  }

  function onKey(e) { if (e.key === 'Escape') cleanup(); }
  document.addEventListener('keydown', onKey);

})();
