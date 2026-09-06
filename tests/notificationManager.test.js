import { describe, it, expect, beforeEach } from 'bun:test';
import { installGlobalChromeMock } from './mocks/chromeMock.js';
import {
  getNotificationId,
  extractSlugFromNotificationId,
  createLiveNotification,
  handleNotificationClick,
} from '../src/background/notificationManager.js';

describe('notificationManager', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = installGlobalChromeMock();
  });

  describe('extractSlugFromNotificationId', () => {
    it('extracts slug from valid notification ID format', () => {
      const id = getNotificationId('xqc', 1234567890);
      expect(extractSlugFromNotificationId(id)).toBe('xqc');
    });

    it('returns null for invalid notification IDs', () => {
      expect(extractSlugFromNotificationId('invalid_id')).toBeNull();
      expect(extractSlugFromNotificationId(null)).toBeNull();
      expect(extractSlugFromNotificationId('')).toBeNull();
    });
  });

  describe('createLiveNotification', () => {
    it('creates notification with rich streamer details', async () => {
      const streamer = {
        slug: 'xqc',
        username: 'xQc',
        isLive: true,
        title: '🔴 LIVE GAMING',
        category: 'Just Chatting',
        viewerCount: 25000,
      };

      const notifId = await createLiveNotification(streamer);
      expect(notifId).not.toBeNull();
      expect(notifId.startsWith('kick_live_xqc_')).toBe(true);

      const allNotifs = await chromeMock.notifications.getAll();
      const created = allNotifs[notifId];
      expect(created).toBeDefined();
      expect(created.title).toBe('xQc is live!');
      expect(created.message).toContain('🔴 LIVE GAMING');
      expect(created.message).toContain('Category: Just Chatting');
      expect(created.contextMessage).toContain('25K');
    });

    it('returns null when streamer is invalid', async () => {
      const notifId = await createLiveNotification(null);
      expect(notifId).toBeNull();
    });

    it('handles notification creation runtime error gracefully', async () => {
      chromeMock.notifications.create = (id, options, callback) => {
        chromeMock.runtime.lastError = { message: 'Notification quota exceeded' };
        callback?.(null);
        chromeMock.runtime.lastError = null;
      };

      const streamer = { slug: 'xqc', username: 'xQc' };
      const notifId = await createLiveNotification(streamer);
      expect(notifId).toBeNull();
    });
  });

  describe('handleNotificationClick', () => {
    it('opens new tab with Kick URL and clears notification', async () => {
      const notifId = getNotificationId('xqc', 123456);
      await chromeMock.notifications.create(notifId, { title: 'Test' });

      handleNotificationClick(notifId);

      const matchingTabs = await chromeMock.tabs.query({ active: true });
      expect(matchingTabs.length).toBe(1);
      expect(matchingTabs[0].url).toBe('https://kick.com/xqc');

      const allNotifs = await chromeMock.notifications.getAll();
      expect(allNotifs[notifId]).toBeUndefined();
    });

    it('ignores non-kick notification IDs', async () => {
      handleNotificationClick('some_other_notification');
      const tabs = await chromeMock.tabs.query({});
      expect(tabs.length).toBe(0);
    });
  });
});
