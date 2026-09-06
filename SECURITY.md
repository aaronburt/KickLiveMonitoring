# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Reporting a Vulnerability

We take the security of **Streamer Monitor** seriously. If you discover a security vulnerability or potential threat in this extension, please follow responsible disclosure practices:

1. **Do not disclose publicly**: Avoid opening public GitHub issues, discussions, or social media posts for suspected security vulnerabilities.
2. **Submit a private report**: Send a detailed advisory with reproduction steps, proof-of-concept, and impact assessment to the repository maintainers or through GitHub Security Advisories.
3. **Response time**: Maintainers will review, triage, and acknowledge the report within 48 hours.
4. **Resolution**: If confirmed, a fix will be developed, tested against the automated test suite, and published promptly.

---

## Security Architecture & Design Principles

This extension implements security-by-default practices aligned with Google Chrome Manifest V3 standards:

### 1. Zero External Code & Strict Content Security Policy (CSP)
- The extension runs on pure, local ES modules. No remote scripts, CDNs, external analytics, or code loaders are permitted.
- `eval()`, `new Function()`, and inline event handlers (`onclick`, `onerror`, etc.) are completely prohibited and excluded from the codebase.

### 2. XSS Prevention & Output Sanitization
- All data originating from external network calls (such as Kick stream titles, category names, usernames, and profile picture URLs) is treated as untrusted.
- All dynamic HTML rendering undergoes strict character sanitization via [`escapeHtml`](file:///c:/Users/Aaron/Documents/antigravity/wise-turing/src/utils/formatters.js) before insertion into the DOM.
- Fallback image handlers are attached programmatically using standard DOM event listeners, preventing attribute-injection vectors.

### 3. Minimal Permissions Principle
- The extension requests only the minimum required Chrome extension permissions:
  - `alarms`: For background polling cycles.
  - `notifications`: For desktop broadcast alerts.
  - `storage`: For local client-side configuration.
- Host permissions are explicitly scoped exclusively to `https://kick.com/*` and `https://api.kick.com/*`.

### 4. Local Storage & Zero Telemetry
- No user data, browsing history, authentication tokens, or personal identifiers are collected, transmitted, or stored on external servers.
- All stored records reside exclusively in `chrome.storage.local` on the user's local machine and are purged immediately upon deletion or extension uninstall.
