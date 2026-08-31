# Original User Request

## 2026-08-31T15:20:58Z

Requested team: max 3 agents

Build a lightweight, production-ready Google Chrome Extension (Manifest V3) that monitors whether selected Kick.com streamers are live and delivers instant desktop notifications when they start streaming.

Working directory: c:\Users\Aaron\Documents\antigravity\wise-turing
Integrity mode: development

## Requirements

### R1. Manifest V3 Chrome Extension Architecture
The extension must adhere to Google Chrome Manifest V3 standards:
- Manifest file specifying required permissions: alarms, notifications, storage.
- Host permissions for Kick endpoints: https://kick.com/* and https://api.kick.com/*.
- Background Service Worker managing scheduled alarm cycles without memory leaks or dropped state during worker suspension.

### R2. Streamer Monitoring & State Tracking Engine
- Periodically check the live status of all tracked streamers via background alarms (configurable interval, default 1-2 minutes).
- Query Kick channel status cleanly (handling live status, viewer count, category/game title, avatar, stream thumbnail).
- Track transition states (offline -> live, live -> offline, live -> live with category change) using chrome.storage.local.
- Gracefully handle network failures, rate limiting, and invalid channel slugs without crashing the background worker.

### R3. Desktop Notification System
- Trigger standard browser desktop notifications (chrome.notifications.create) exclusively on state change from offline -> live.
- Notifications must show streamer name, stream title, category, and profile avatar where available.
- Clicking the notification opens the streamer's Kick channel URL (https://kick.com/{slug}) in a new browser tab.
- Prevent duplicate spam notifications for streams that are already live across polling cycles.

### R4. Popup Interface & Streamer Management
- Clean, responsive popup UI allowing users to:
  - Add new streamers by Kick channel slug/username (with validation).
  - Remove streamers from the tracking list.
  - View current status of all tracked streamers (Live badge, Viewer count, Stream title, Category, or Offline status).
  - Quick-click any streamer card to open their channel directly.
  - Optional settings (toggle sound/notification alerts, customize polling frequency).

## Acceptance Criteria

### Functionality & Extension Lifecycle
- [ ] Extension loads successfully in Chrome (chrome://extensions Load Unpacked) with zero manifest errors or warnings.
- [ ] Adding a valid Kick streamer adds them to persistent storage and initiates tracking.
- [ ] Background alarm polls status reliably and recovers correctly even after Chrome service worker goes idle/suspends.
- [ ] Notification triggers only on the rising edge (offline -> live), including streamer title and channel link.
- [ ] Notification click correctly opens the specific streamer's Kick channel in a focused tab.
- [ ] Removing a streamer cleanly deletes them from storage and stops future notifications for that channel.

### Robustness & Code Quality
- [ ] Handles offline network state, invalid channel names, and unexpected Kick API responses gracefully with user-visible feedback.
- [ ] Adheres to strict clean code standards (small single-purpose modules, typed/clear interfaces, no dead code or unhandled promises).
- [ ] Includes an automated verification test suite mocking the Chrome Extension APIs and Kick endpoints to verify state transitions and alarms.
