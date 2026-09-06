# Project: Kick Monitor Chrome Extension (Manifest V3)

## Architecture
- **Runtime**: Google Chrome Manifest V3 Extension (Vanilla ES Modules, HTML5, CSS3)
- **Background Engine**: Service Worker (`src/background/serviceWorker.js`) managing `chrome.alarms`, `chrome.storage.local`, `chrome.notifications`, and `chrome.action` badge.
- **Service Layer**:
  - `src/services/kickApi.js`: Kick API client for channel status and metadata.
  - `src/services/storageService.js`: Interface to `chrome.storage.local`.
  - `src/services/streamerTracker.js`: State transition engine, rising-edge detection.
- **Popup UI**:
  - `src/popup/index.html`, `src/popup/popup.css`, `src/popup/popup.js`, `src/popup/uiRenderer.js`, `src/popup/eventHandlers.js`
- **Utilities**:
  - `src/utils/slugValidator.js`: Channel slug normalization, URL parsing, sanitization.
  - `src/utils/formatters.js`: Viewer counts, relative time formatting.
- **Testing Layer**:
  - `tests/mocks/chromeMock.js`: Comprehensive in-memory mock for Chrome Extension APIs.
  - Test suites for all services, background managers, UI helpers, and state transitions using `bun test`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Manifest V3 Specification | Valid manifest.json with alarms, notifications, storage permissions, and host permissions for Kick.com | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Kick.com API Client | Fetch live status, viewer count, category, avatar, title from Kick endpoints with 404/429/network error resilience | M1 | ORIGINAL_REQUEST §R2 |
| 3 | Storage & State Machine | Track offline/live transitions, rising-edge detection (`offline -> live`), persistent storage in `chrome.storage.local` | M1 | ORIGINAL_REQUEST §R2 |
| 4 | Alarm & Service Worker Lifecycle | Scheduled alarm cycles, idempotent synchronous listener registration, resilience against worker suspension | M1 | ORIGINAL_REQUEST §R1, §R2 |
| 5 | Desktop Notification System | Rising-edge notifications (`chrome.notifications.create`), click-to-open channel tab (`chrome.tabs.create`), duplicate spam suppression | M1 | ORIGINAL_REQUEST §R3 |
| 6 | Action Badge Counter | Dynamic green badge displaying number of active live streams | M1 | ORIGINAL_REQUEST §R2 |
| 7 | Popup User Interface | Dark/Kick themed UI showing streamer cards, live badges, viewer counts, stream titles, categories, offline status | M1 | ORIGINAL_REQUEST §R4 |
| 8 | Streamer Management UI | Add streamer by slug/URL with validation and error feedback; remove streamer; quick-click to open channel; settings | M1 | ORIGINAL_REQUEST §R4 |
| 9 | Automated Test Suite | Comprehensive unit/integration tests with in-memory Chrome API mocks verifying all state transitions and edge cases | M1 | ORIGINAL_REQUEST Acceptance Criteria |
| 10 | Asset Generation & Packaging | App icons (16, 32, 48, 128px) and README documentation for Load Unpacked in Chrome | M1 | ORIGINAL_REQUEST Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Core Extension & Test Suite Implementation | Manifest, background service worker, API client, storage/state machine, notifications, popup UI, icon assets, test suite | none | DONE |
| 2 | Verification, Review & Integrity Audit | Independent code review, challenger validation, forensic integrity audit | M1 | DONE |

## Interface Contracts
### `kickApi.js` -> `streamerTracker.js`
- `fetchChannelData(slug: string): Promise<StreamerData>`
- `StreamerData`: `{ slug: string, username: string, avatarUrl: string, isLive: boolean, title: string, category: string, viewerCount: number, thumbnailUrl: string, error: string | null }`

### `storageService.js` -> `streamerTracker.js` / `popup.js`
- `getStreamers(): Promise<Record<string, StreamerData>>`
- `setStreamer(slug: string, data: StreamerData): Promise<void>`
- `removeStreamer(slug: string): Promise<void>`
- `getSettings(): Promise<Settings>`
- `updateSettings(settings: Partial<Settings>): Promise<void>`

### `streamerTracker.js` -> `notificationManager.js` & `badgeManager.js`
- `checkStreamerStatus(slug: string): Promise<{ streamer: StreamerData, transitionedToLive: boolean }>`
- `checkAllStreamers(): Promise<{ updated: StreamerData[], newLive: StreamerData[] }>`

## Code Layout
```
manifest.json
package.json
README.md
assets/
  icons/
    icon-16.png
    icon-32.png
    icon-48.png
    icon-128.png
src/
  background/
    serviceWorker.js
    alarmManager.js
    notificationManager.js
    badgeManager.js
  services/
    kickApi.js
    storageService.js
    streamerTracker.js
  popup/
    index.html
    popup.css
    popup.js
    uiRenderer.js
    eventHandlers.js
  utils/
    slugValidator.js
    formatters.js
tests/
  mocks/
    chromeMock.js
  kickApi.test.js
  storageService.test.js
  streamerTracker.test.js
  notificationManager.test.js
  badgeManager.test.js
  slugValidator.test.js
  formatters.test.js
  alarmManager.test.js
```
