import { getSettings } from '../services/storageService.js';

export const LIVE_BADGE_COLOR = '#53FC18';
export const KICK_BADGE_COLOR = LIVE_BADGE_COLOR;

export async function updateBadgeCount(liveCount) {
  if (typeof chrome === 'undefined' || !chrome.action) return;
  const count = Number(liveCount) || 0;
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  if (count > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: LIVE_BADGE_COLOR });
    await chrome.action.setBadgeTextColor?.({ color: '#000000' });
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
