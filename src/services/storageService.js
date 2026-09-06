export const DEFAULT_SETTINGS = {
  checkIntervalMinutes: 2,
  notificationsEnabled: true,
  debugLogging: false,
  sortBy: 'viewers',
  uiScale: '100',
  badgeEnabled: true,
};

let writeQueue = Promise.resolve();
function enqueue(fn) {
  const next = writeQueue.then(() => fn());
  writeQueue = next.catch(() => {});
  return next;
}

function getStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local;
  }
  return {
    get: (k, cb) => cb?.({}),
    set: (i, cb) => cb?.(),
    clear: (cb) => cb?.(),
  };
}

function storageGet(keys) {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val) => {
      if (!resolved) {
        resolved = true;
        resolve(val || {});
      }
    };
    const res = getStorage().get(keys, safeResolve);
    if (res && typeof res.then === 'function') {
      res.then(safeResolve);
    }
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    const res = getStorage().set(items, safeResolve);
    if (res && typeof res.then === 'function') {
      res.then(safeResolve);
    }
  });
}

function storageClear() {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    const res = getStorage().clear?.(safeResolve);
    if (res && typeof res.then === 'function') {
      res.then(safeResolve);
    }
  });
}

function getSyncStorage() {
  return typeof chrome !== 'undefined' && chrome.storage?.sync ? chrome.storage.sync : null;
}

export async function syncWatchlistToCloud(streamersMap) {
  const sync = getSyncStorage();
  if (!sync) return;
  try {
    sync.set({ watchlist: Object.keys(streamersMap || {}) });
  } catch {}
}

export async function getSyncedWatchlist() {
  const sync = getSyncStorage();
  if (!sync) return [];
  return new Promise((resolve) => {
    try {
      sync.get(['watchlist'], (result) => {
        resolve(Array.isArray(result?.watchlist) ? result.watchlist : []);
      });
    } catch {
      resolve([]);
    }
  });
}

export async function getStreamers() {
  const result = await storageGet(['streamers']);
  return result?.streamers || {};
}

export async function getStreamer(rawSlug) {
  if (!rawSlug || typeof rawSlug !== 'string') return null;
  const streamers = await getStreamers();
  return streamers[rawSlug.trim().toLowerCase()] || null;
}

export async function setStreamer(rawSlug, streamerData) {
  if (!rawSlug || typeof rawSlug !== 'string' || !streamerData) return;
  const slug = rawSlug.trim().toLowerCase();
  return enqueue(async () => {
    const streamers = await getStreamers();
    streamers[slug] = { ...streamerData, slug };
    await syncWatchlistToCloud(streamers);
    await storageSet({ streamers });
  });
}

export async function saveAllStreamers(streamersMap) {
  return enqueue(async () => {
    await syncWatchlistToCloud(streamersMap);
    await storageSet({ streamers: streamersMap || {} });
  });
}

export async function removeStreamer(rawSlug) {
  if (!rawSlug || typeof rawSlug !== 'string') return;
  const slug = rawSlug.trim().toLowerCase();
  return enqueue(async () => {
    const streamers = await getStreamers();
    delete streamers[slug];
    await syncWatchlistToCloud(streamers);
    await storageSet({ streamers });
  });
}

export async function getSettings() {
  const result = await storageGet(['settings']);
  return { ...DEFAULT_SETTINGS, ...(result?.settings || {}) };
}

export async function updateSettings(partialSettings) {
  return enqueue(async () => {
    const current = await getSettings();
    const updated = { ...current, ...(partialSettings || {}) };
    const sync = getSyncStorage();
    if (sync) {
      try {
        sync.set({ settings: updated });
      } catch {}
    }
    await storageSet({ settings: updated });
    return updated;
  });
}

export async function clearStorage() {
  return enqueue(async () => {
    const sync = getSyncStorage();
    if (sync) {
      try {
        sync.clear?.();
      } catch {}
    }
    await storageClear();
  });
}
