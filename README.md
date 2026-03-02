# 2FA-Authenticator

A lightweight browser extension to scan OTP QR codes and manage TOTP one-time passwords locally.

## Features

- Scan OTP QR codes from the popup or overlay (uses `jsQR`).
- Generate and display TOTP codes locally (`totp.js`, `otpauth/otpauth.umd.min.js`).
- Simple popup UI and background processing for refresh.

## Installation (Developer / Local)

1. Open your browser's extensions page (e.g., `chrome://extensions`).
2. Enable "Developer mode".
3. Click "Load unpacked" and select this repository folder.

## Usage

- Click the extension icon to open the popup (`popup.html`).
- Use the scanner to import OTP secrets from QR codes or add accounts manually.
- Codes refresh periodically based on TOTP algorithm.

## Important files

- [manifest.json](manifest.json) : Extension manifest and permissions.
- [popup.html](popup.html) / [popup.js](popup.js) : Popup UI and logic.
- [background.js](background.js) : Background script for timers/updates.
- [overlay.js](overlay.js) : Camera overlay and QR capture handling.
- [jsQR.js](jsQR.js) : QR detection library.
- [totp.js](totp.js) : TOTP generation helper.
- [otpauth/otpauth.umd.min.js](otpauth/otpauth.umd.min.js) : OTP utilities.
- `icons/` : Extension icons.
