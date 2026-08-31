export const DEFAULT_SETTINGS = {
  checkIntervalMinutes: 2,
  notificationsEnabled: true,
  soundEnabled: false,
  debugLogging: false,
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
    get: (k, cb) => cb({}),
    set: (i, cb) => cb?.(),
    remove: (k, cb) => cb?.(),
    clear: (cb) => cb?.(),
  };
}

export async function getStreamers() {
  return new Promise((resolve) => {
    getStorage().get(['streamers'], (result) => {
      resolve(result?.streamers || {});
    });
  });
}

export async function getStreamer(rawSlug) {
  if (!rawSlug || typeof rawSlug !== 'string') return null;
  const slug = rawSlug.trim().toLowerCase();
  const streamers = await getStreamers();
  return streamers[slug] || null;
}

export async function setStreamer(rawSlug, streamerData) {
  if (!rawSlug || typeof rawSlug !== 'string' || !streamerData) return;
  const slug = rawSlug.trim().toLowerCase();
  return enqueue(async () => {
    const streamers = await getStreamers();
    streamers[slug] = { ...streamerData, slug };
    return new Promise((resolve) => {
      getStorage().set({ streamers }, () => resolve());
    });
  });
}

export async function saveAllStreamers(streamersMap) {
  return enqueue(async () => {
    return new Promise((resolve) => {
      getStorage().set({ streamers: streamersMap || {} }, () => resolve());
    });
  });
}

export async function removeStreamer(rawSlug) {
  if (!rawSlug || typeof rawSlug !== 'string') return;
  const slug = rawSlug.trim().toLowerCase();
  return enqueue(async () => {
    const streamers = await getStreamers();
    delete streamers[slug];
    return new Promise((resolve) => {
      getStorage().set({ streamers }, () => resolve());
    });
  });
}

export async function getSettings() {
  return new Promise((resolve) => {
    getStorage().get(['settings'], (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...(result?.settings || {}) });
    });
  });
}

export async function updateSettings(partialSettings) {
  return enqueue(async () => {
    const current = await getSettings();
    const updated = { ...current, ...(partialSettings || {}) };
    return new Promise((resolve) => {
      getStorage().set({ settings: updated }, () => resolve(updated));
    });
  });
}

export async function clearStorage() {
  return enqueue(async () => {
    return new Promise((resolve) => {
      getStorage().clear(() => resolve());
    });
  });
}
