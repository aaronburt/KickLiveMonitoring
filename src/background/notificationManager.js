import { formatViewerCount } from '../utils/formatters.js';

export function getNotificationId(slug, timestamp = Date.now()) {
  return `kick_live_${slug}_${timestamp}`;
}

export function extractSlugFromNotificationId(notificationId) {
  if (typeof notificationId !== 'string') return null;
  const match = notificationId.match(/^kick_live_(.+)_\d+$/);
  return match ? match[1] : null;
}

export async function createLiveNotification(streamer) {
  if (!streamer?.slug || typeof chrome === 'undefined' || !chrome.notifications) return null;
  const id = getNotificationId(streamer.slug);
  const title = streamer.title || 'Live Stream';
  const category = streamer.category ? `Category: ${streamer.category}` : 'Kick Stream';
  const viewers = streamer.viewerCount > 0 ? `Viewers: ${formatViewerCount(streamer.viewerCount)}` : 'Live Now';
  const iconUrl = typeof chrome.runtime?.getURL === 'function'
    ? chrome.runtime.getURL('assets/icons/icon-128.png')
    : 'assets/icons/icon-128.png';

  return new Promise((resolve) => {
    chrome.notifications.create(
      id,
      {
        type: 'basic',
        iconUrl,
        title: `${streamer.username} is live on Kick!`,
        message: `${title}\n${category}`,
        contextMessage: viewers,
        priority: 2,
      },
      (createdId) => {
        if (chrome.runtime?.lastError) {
          resolve(null);
        } else {
          resolve(createdId);
        }
      },
    );
  });
}

export function handleNotificationClick(notificationId) {
  const slug = extractSlugFromNotificationId(notificationId);
  if (!slug) return;
  chrome?.tabs?.create?.({ url: `https://kick.com/${slug}`, active: true });
  chrome?.notifications?.clear?.(notificationId);
}

export function setupNotificationListeners() {
  if (typeof chrome !== 'undefined' && chrome.notifications?.onClicked) {
    if (!chrome.notifications.onClicked.hasListener?.(handleNotificationClick)) {
      chrome.notifications.onClicked.addListener(handleNotificationClick);
    }
  }
}
