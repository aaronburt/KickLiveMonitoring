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
  getCircuitStatus,
  resetCircuit,
} from '../services/circuitBreaker.js';
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
  GET_CIRCUIT_STATUS: 'GET_CIRCUIT_STATUS',
  RESET_CIRCUIT: 'RESET_CIRCUIT',
};

export function handleRuntimeMessage(message, sender, sendResponse) {
  if (!message || typeof message !== 'object') return false;
  const { type, payload } = message;
  logDebug('Runtime Message', type, payload || '');

  if (type === MESSAGE_TYPES.REFRESH_ALL) {
    resetCircuit();
    checkAllStreamers({ bypassCircuitBreaker: true })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err?.message || 'Error' }));
    return true;
  }

  if (type === MESSAGE_TYPES.GET_CIRCUIT_STATUS) {
    const status = getCircuitStatus();
    sendResponse({ success: true, data: status });
    return false;
  }

  if (type === MESSAGE_TYPES.RESET_CIRCUIT) {
    resetCircuit();
    const status = getCircuitStatus();
    sendResponse({ success: true, data: status });
    return false;
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
  await initializeAlarms();
  await syncCloudWatchlist();
  const streamers = await getStreamers();
  await updateBadgeFromStreamers(streamers);
  await checkAllStreamers();
}

export async function onExtensionInstalled() {
  await initializeAlarms();
  await syncCloudWatchlist();
  const streamers = await getStreamers();
  await updateBadgeFromStreamers(streamers);
}

export async function onStorageChange(changes, areaName) {
  if (areaName === 'local' && (changes?.streamers || changes?.settings)) {
    const streamers = changes.streamers?.newValue || await getStreamers();
    await updateBadgeFromStreamers(streamers);
  }
}

export function registerServiceWorkerListeners() {
  if (typeof chrome !== 'undefined') {
    chrome.runtime?.onInstalled?.addListener(onExtensionInstalled);
    chrome.runtime?.onStartup?.addListener(onExtensionStartup);
    chrome.alarms?.onAlarm?.addListener(handleAlarm);
    chrome.notifications?.onClicked?.addListener(handleNotificationClick);
    chrome.runtime?.onMessage?.addListener(handleRuntimeMessage);
    chrome.storage?.onChanged?.addListener(onStorageChange);
  }
}

registerServiceWorkerListeners();
