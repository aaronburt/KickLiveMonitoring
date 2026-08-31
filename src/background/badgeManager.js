export const KICK_BADGE_COLOR = '#53FC18';
export const KICK_BADGE_TEXT_COLOR = '#000000';

export async function updateBadgeCount(liveCount) {
  if (typeof chrome === 'undefined' || !chrome.action) return;
  const count = Number(liveCount) || 0;
  const text = count > 0 ? String(count) : '';
  await new Promise((resolve) => chrome.action.setBadgeText({ text }, resolve));
  if (count > 0) {
    await new Promise((resolve) => chrome.action.setBadgeBackgroundColor({ color: KICK_BADGE_COLOR }, resolve));
    if (chrome.action.setBadgeTextColor) {
      await new Promise((resolve) => chrome.action.setBadgeTextColor({ color: KICK_BADGE_TEXT_COLOR }, resolve));
    }
  }
}

export async function updateBadgeFromStreamers(streamersMap) {
  const count = Object.values(streamersMap || {}).filter((s) => s?.isLive).length;
  await updateBadgeCount(count);
  return count;
}
