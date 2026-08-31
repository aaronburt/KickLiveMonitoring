import {
  handleAlarm,
  initializeAlarms,
  createPollAlarm,
} from './alarmManager.js';
import {
  handleNotificationClick,
  createLiveNotification,
} from './notificationManager.js';
import { updateBadgeFromStreamers } from './badgeManager.js';
import {
  checkAllStreamers,
  checkStreamerStatus,
  addNewStreamer,
} from '../services/streamerTracker.js';
import {
  getStreamers,
  updateSettings,
  getSyncedWatchlist,
} from '../services/storageService.js';
import { validateSlug } from '../utils/slugValidator.js';
import { logDebug } from '../utils/logger.js';

export const MESSAGE_TYPES = {
  REFRESH_ALL: 'REFRESH_ALL',
  CHECK_STREAMER: 'CHECK_STREAMER',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  SYNC_BADGE: 'SYNC_BADGE',
  TRIGGER_TEST_NOTIFICATION: 'TRIGGER_TEST_NOTIFICATION',
};

export function handleRuntimeMessage(message, sender, sendResponse) {
  if (!message || typeof message !== 'object') return false;
  const { type, payload } = message;
  logDebug('Runtime Message', type, payload || '');

  if (type === MESSAGE_TYPES.REFRESH_ALL) {
    checkAllStreamers()
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err?.message || 'Error' }));
    return true;
  }

  if (type === MESSAGE_TYPES.CHECK_STREAMER) {
    if (!payload?.slug) {
      sendResponse({ success: false, error: 'Slug required' });
      return false;
    }
    checkStreamerStatus(payload.slug)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err?.message || 'Error' }));
    return true;
  }

  if (type === MESSAGE_TYPES.UPDATE_SETTINGS) {
    updateSettings(payload)
      .then(async (data) => {
        if (payload?.checkIntervalMinutes) await createPollAlarm(payload.checkIntervalMinutes);
        sendResponse({ success: true, data });
      })
      .catch((err) => sendResponse({ success: false, error: err?.message || 'Error' }));
    return true;
  }

  if (type === MESSAGE_TYPES.SYNC_BADGE) {
    getStreamers()
      .then((s) => updateBadgeFromStreamers(s))
      .then((count) => sendResponse({ success: true, count }))
      .catch((err) => sendResponse({ success: false, error: err?.message || 'Error' }));
    return true;
  }

  if (type === MESSAGE_TYPES.TRIGGER_TEST_NOTIFICATION) {
    const mock = payload || {
      slug: 'xqc',
      username: 'xQc',
      title: '🔴 [DEBUG TEST] 24H Special Stream',
      category: 'Just Chatting',
      viewerCount: 42500,
    };
    createLiveNotification(mock)
      .then((id) => sendResponse({ success: true, id }))
      .catch((err) => sendResponse({ success: false, error: err?.message || 'Error' }));
    return true;
  }

  return false;
}

export function setupContextMenu() {
  if (typeof chrome === 'undefined' || !chrome.contextMenus) return;
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'track_kick_creator',
        title: 'Track this creator on Kick Monitor',
        contexts: ['page', 'link'],
        documentUrlPatterns: ['https://kick.com/*'],
        targetUrlPatterns: ['https://kick.com/*'],
      });
    });
  } catch {}
}

export async function handleContextMenuClick(info, tab) {
  if (info.menuItemId !== 'track_kick_creator') return;
  const targetUrl = info.linkUrl || info.pageUrl || tab?.url;
  if (!targetUrl) return;

  const validation = validateSlug(targetUrl);
  if (!validation.isValid) return;

  const reservedPaths = ['categories', 'following', 'browse', 'privacy', 'terms', 'community-guidelines', 'video'];
  if (reservedPaths.includes(validation.slug)) return;

  const result = await addNewStreamer(validation.slug);
  const iconUrl = typeof chrome.runtime?.getURL === 'function'
    ? chrome.runtime.getURL('assets/icons/icon-128.png')
    : 'assets/icons/icon-128.png';

  if (result.success) {
    chrome.notifications?.create?.(`tracked_${validation.slug}_${Date.now()}`, {
      type: 'basic',
      iconUrl,
      title: 'Creator Tracked!',
      message: `Added ${result.streamer?.username || validation.slug} to your Kick Monitor watchlist.`,
      priority: 1,
    });
  } else if (result.error) {
    chrome.notifications?.create?.(`track_err_${Date.now()}`, {
      type: 'basic',
      iconUrl,
      title: 'Kick Monitor',
      message: result.error,
      priority: 1,
    });
  }
}

export async function syncCloudWatchlist() {
  const syncedSlugs = await getSyncedWatchlist();
  const localStreamers = await getStreamers();
  for (const slug of syncedSlugs) {
    if (!localStreamers[slug]) {
      await addNewStreamer(slug);
    }
  }
}

export async function onExtensionStartup() {
  setupContextMenu();
  await initializeAlarms();
  await syncCloudWatchlist();
  const streamers = await getStreamers();
  await updateBadgeFromStreamers(streamers);
  await checkAllStreamers();
}

export async function onExtensionInstalled() {
  setupContextMenu();
  await initializeAlarms();
  await syncCloudWatchlist();
  const streamers = await getStreamers();
  await updateBadgeFromStreamers(streamers);
}

if (typeof chrome !== 'undefined') {
  chrome.runtime?.onInstalled?.addListener(onExtensionInstalled);
  chrome.runtime?.onStartup?.addListener(onExtensionStartup);
  chrome.alarms?.onAlarm?.addListener(handleAlarm);
  chrome.notifications?.onClicked?.addListener(handleNotificationClick);
  chrome.contextMenus?.onClicked?.addListener(handleContextMenuClick);
  chrome.runtime?.onMessage?.addListener(handleRuntimeMessage);
}
