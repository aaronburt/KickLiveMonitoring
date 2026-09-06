# Kick Monitor

A lightweight Chrome Extension (Manifest V3) that tracks your favorite Kick.com creators and notifies you the moment they go live.

---

## Features

- **Live Desktop Alerts** — Instant notifications when streamers go live.
- **Toolbar Live Counter** — Green badge on the extension icon showing active streams.
- **Options Dashboard** — Dedicated options page for polling frequency, UI scaling, sorting preferences, test notifications, and circuit breaker diagnostics.
- **Global Search** — Search Kick channels directly with autocomplete.
- **One-Click Watch** — Click any notification or card to open the stream.
- **100% Local & Private** — All settings stay in your browser. Zero tracking, third-party analytics, or telemetry.
- **Smart API Protection & Circuit Breaker** — Canary pre-flight requests, strict schema verification, and automatic exponential backoff prevent rate-limiting or API hammering.
- **Custom Polling** — Configurable check intervals (1, 2, 5, 10, 15 minutes).

---

## Installation

Works on Chrome, Vivaldi, Brave, Edge, and any Chromium browser:

1. Clone or download this repository.
2. Open `chrome://extensions` (or `vivaldi://extensions`).
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select this folder.

---

## Development & Testing

Run the automated test suite with [Bun](https://bun.sh):

```bash
bun test
```

---

## Disclaimer

**Kick Monitor** is an independent, open-source community project and is **not** affiliated with, endorsed by, or sponsored by Kick.com or Kick Community Pty Ltd. Built with the assistance of AI and reviewed/tested by a human developer.

---

## License

[MIT](LICENSE)
