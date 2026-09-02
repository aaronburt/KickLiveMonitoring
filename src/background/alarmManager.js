import { getSettings } from '../services/storageService.js';
import { checkAllStreamers } from '../services/streamerTracker.js';
import { logDebug } from '../utils/logger.js';

export const POLL_ALARM_NAME = 'KICK_MONITOR_POLL_ALARM';
export const DEFAULT_INTERVAL_MINUTES = 2;

export async function createPollAlarm(intervalMinutes) {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  const parsed = Number(intervalMinutes);
  const minutes = Math.max(1, Number.isFinite(parsed) ? parsed : DEFAULT_INTERVAL_MINUTES);
  await logDebug('Alarm Scheduled', `Interval: ${minutes} min`);
  chrome.alarms.create(POLL_ALARM_NAME, { periodInMinutes: minutes, delayInMinutes: minutes });
}

export function clearPollAlarm() {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  chrome.alarms.clear(POLL_ALARM_NAME);
}

export async function handleAlarm(alarm) {
  if (alarm?.name === POLL_ALARM_NAME) {
    await logDebug('Alarm Fired', alarm.name);
    try {
      await checkAllStreamers();
    } catch {}
  }
}

export async function initializeAlarms() {
  const settings = await getSettings();
  await createPollAlarm(settings.checkIntervalMinutes);
}
