# Kick Streamer Monitor — Chrome Extension (Manifest V3)

A fast, lightweight Google Chrome & Chromium extension built on Manifest V3 that monitors your favorite Kick.com creators and delivers instant desktop notifications the moment they go live.

---

## Features

- **Rising-Edge Live Notifications**: Triggers native desktop notifications exclusively when a creator transitions from offline to live (prevents duplicate spam).
- **Direct Stream Launch**: Clicking any notification or streamer card immediately opens their Kick broadcast in a focused browser tab.
- **Global Channel Autocomplete**: Search across Kick's channel directory as you type with live status previews, avatars, and one-click tracking.
- **Live Toolbar Badge Counter**: Displays an active neon-green (`#53FC18`) count of currently live creators directly on the browser toolbar icon.
- **Dark Kick UI**: Dark-themed popup dashboard with live viewer counts, category badges, stream titles, and filter tabs (All, Live, Offline).
- **Configurable Settings**:
  - Polling interval: 1, 2, 5, 10, or 15 minutes.
  - Desktop notifications toggle.
  - Notification sound toggle.
  - In-app test alert button for verification.
  - Debug logging toggle for developer diagnostics.
- **Privacy-First Architecture**: 100% client-side storage via `chrome.storage.local`. Zero analytics, zero tracking, and no external servers.
- **Zero Runtime Dependencies**: Pure ES modules and native Web APIs with no bundler or build step required.

---

## Non-Affiliation Disclaimer

**Kick Streamer Monitor** is an independent, open-source community tool. It is **NOT** affiliated with, endorsed by, sponsored by, or officially associated with **Kick.com**, Kick Community Pty Ltd, or any of their affiliates.

All trademarks, service marks, logos (including the pixel "K" mark), and brand assets referenced in this project belong to their respective owners and are used strictly for **nominative identification and descriptive compatibility purposes** under fair use.

---

## Installation (Developer Mode / Load Unpacked)

Works on Google Chrome, Vivaldi, Brave, Microsoft Edge, and any Chromium-based browser:

1. Clone or download this repository to your local machine.
2. Open your browser and navigate to the extensions page:
   - Chrome / Brave / Edge: `chrome://extensions/`
   - Vivaldi: `vivaldi://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (top-left corner).
5. Select the repository root folder (`wise-turing`).
6. Pin the **Kick Streamer Monitor** icon to your toolbar for quick access.

---

## Project Structure

```
wise-turing/
├── manifest.json                  # Manifest V3 configuration & permissions
├── package.json                   # Project metadata & test scripts
├── README.md                      # Project documentation
├── assets/
│   └── icons/                     # Official pixel "K" icons (16, 32, 48, 128px)
├── src/
│   ├── background/
│   │   ├── serviceWorker.js       # Service worker lifecycle & runtime messaging
│   │   ├── alarmManager.js        # Scheduled polling alarm creator & handler
│   │   ├── notificationManager.js # Native desktop notification creator & click router
│   │   └── badgeManager.js        # Toolbar action badge counter & color manager
│   ├── services/
│   │   ├── kickApi.js             # Kick API client (status checks & search autocomplete)
│   │   ├── storageService.js      # chrome.storage.local wrapper with atomic write queue
│   │   └── streamerTracker.js     # State transition engine & rising-edge detector
│   ├── popup/
│   │   ├── index.html             # Popup HTML structure
│   │   ├── popup.css              # Dark Kick-themed responsive stylesheet
│   │   └── popup.js               # Popup controller, search autocomplete & event bindings
│   ├── privacy/
│   │   └── privacy.html           # Full-page privacy policy & legal disclaimer
│   └── utils/
│       ├── slugValidator.js       # Username & URL normalizer and regex validator
│       ├── formatters.js          # Viewer count, duration, & relative time formatters
│       └── logger.js              # Conditional debug logger
└── tests/
    ├── mocks/
    │   └── chromeMock.js          # In-memory mock for Chrome Extension APIs
    ├── adversarial.test.js        # Concurrency, race condition & resilience tests
    ├── alarmManager.test.js       # Alarm lifecycle tests
    ├── badgeManager.test.js       # Badge counter tests
    ├── formatters.test.js         # String formatting tests
    ├── kickApi.test.js            # API parsing & search tests
    ├── logger.test.js             # Debug logging tests
    ├── notificationManager.test.js# Notification creation & routing tests
    ├── serviceWorker.test.js      # Message handling & lifecycle tests
    ├── slugValidator.test.js      # Username & URL normalization tests
    ├── storageService.test.js     # Persistence & settings tests
    └── streamerTracker.test.js    # State transition & polling tests
```

---

## Running Automated Tests

Run the complete test suite using [Bun](https://bun.sh):

```bash
bun test
```

All 89 unit and adversarial integration tests run in under 600ms without browser dependencies.

---

## License

MIT License. Open source for community use.
