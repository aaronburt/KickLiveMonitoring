import { getSettings } from '../services/storageService.js';

export const KICK_BADGE_COLOR = '#53FC18';
export const KICK_BADGE_TEXT_COLOR = '#000000';

export async function updateBadgeCount(liveCount) {
  if (typeof chrome === 'undefined' || !chrome.action) return;
  const count = Number(liveCount) || 0;
  const text = count > 0 ? String(count) : '';
  await chrome.action.setBadgeText({ text });
  if (count > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: KICK_BADGE_COLOR });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: KICK_BADGE_TEXT_COLOR });
    }
  }
}

export async function updateBadgeFromStreamers(streamersMap) {
  const settings = await getSettings();
  if (!settings.badgeEnabled) {
    await updateBadgeCount(0);
    return 0;
  }
  const count = Object.values(streamersMap || {}).filter((s) => s?.isLive).length;
  await updateBadgeCount(count);
  return count;
}
