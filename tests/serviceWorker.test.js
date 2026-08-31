import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { installGlobalChromeMock } from './mocks/chromeMock.js';
import {
  handleRuntimeMessage,
  MESSAGE_TYPES,
  onExtensionInstalled,
  onExtensionStartup,
} from '../src/background/serviceWorker.js';
import { setStreamer, getStreamer, getSettings } from '../src/services/storageService.js';
import { POLL_ALARM_NAME } from '../src/background/alarmManager.js';

describe('serviceWorker', () => {
  let chromeMock;
  let originalFetch;

  beforeEach(() => {
    chromeMock = installGlobalChromeMock();
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        slug: 'xqc',
        user: { username: 'xQc', profile_pic: '' },
        livestream: null,
      }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('lifecycle events', () => {
    it('initializes alarms and badge on extension install', async () => {
      await setStreamer('xqc', { slug: 'xqc', isLive: true });
      await onExtensionInstalled();

      const alarm = await chromeMock.alarms.get(POLL_ALARM_NAME);
      expect(alarm).not.toBeNull();
      expect(chromeMock.action.getBadgeText()).toBe('1');
    });

    it('initializes alarms and triggers check on startup', async () => {
      await onExtensionStartup();
      const alarm = await chromeMock.alarms.get(POLL_ALARM_NAME);
      expect(alarm).not.toBeNull();
    });
  });

  describe('runtime message handling', () => {
    it('handles REFRESH_ALL message', async () => {
      await setStreamer('xqc', { slug: 'xqc', isLive: false });

      let responseResult = null;
      const sendResponse = (resp) => {
        responseResult = resp;
      };

      const handled = handleRuntimeMessage(
        { type: MESSAGE_TYPES.REFRESH_ALL },
        {},
        sendResponse,
      );

      expect(handled).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(responseResult).not.toBeNull();
      expect(responseResult.success).toBe(true);
    });

    it('handles CHECK_STREAMER message', async () => {
      await setStreamer('xqc', { slug: 'xqc', isLive: false });

      let responseResult = null;
      const sendResponse = (resp) => {
        responseResult = resp;
      };

      const handled = handleRuntimeMessage(
        { type: MESSAGE_TYPES.CHECK_STREAMER, payload: { slug: 'xqc' } },
        {},
        sendResponse,
      );

      expect(handled).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(responseResult).not.toBeNull();
      expect(responseResult.success).toBe(true);
    });

    it('handles UPDATE_SETTINGS message and updates alarm', async () => {
      let responseResult = null;
      const sendResponse = (resp) => {
        responseResult = resp;
      };

      const handled = handleRuntimeMessage(
        {
          type: MESSAGE_TYPES.UPDATE_SETTINGS,
          payload: { checkIntervalMinutes: 10, notificationsEnabled: false },
        },
        {},
        sendResponse,
      );

      expect(handled).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(responseResult.success).toBe(true);

      const settings = await getSettings();
      expect(settings.checkIntervalMinutes).toBe(10);
      expect(settings.notificationsEnabled).toBe(false);

      const alarm = await chromeMock.alarms.get(POLL_ALARM_NAME);
      expect(alarm.periodInMinutes).toBe(10);
    });

    it('handles SYNC_BADGE message', async () => {
      await setStreamer('xqc', { slug: 'xqc', isLive: true });
      await setStreamer('adinross', { slug: 'adinross', isLive: true });

      let responseResult = null;
      const sendResponse = (resp) => {
        responseResult = resp;
      };

      const handled = handleRuntimeMessage(
        { type: MESSAGE_TYPES.SYNC_BADGE },
        {},
        sendResponse,
      );

      expect(handled).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(responseResult.success).toBe(true);
      expect(responseResult.count).toBe(2);
      expect(chromeMock.action.getBadgeText()).toBe('2');
    });

    it('handles TRIGGER_TEST_NOTIFICATION message and creates notification', async () => {
      let responseResult = null;
      const sendResponse = (resp) => {
        responseResult = resp;
      };

      const handled = handleRuntimeMessage(
        {
          type: MESSAGE_TYPES.TRIGGER_TEST_NOTIFICATION,
          payload: { slug: 'xqc', username: 'xQc', title: 'Debug Stream', category: 'IRL', viewerCount: 12000 },
        },
        {},
        sendResponse,
      );

      expect(handled).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(responseResult.success).toBe(true);
      expect(responseResult.id).toBeDefined();
      const notifs = await chromeMock.notifications.getAll();
      expect(Object.keys(notifs).length).toBe(1);
    });

    it('returns false for unknown messages', () => {
      const handled = handleRuntimeMessage({ type: 'UNKNOWN_TYPE' }, {}, () => {});
      expect(handled).toBe(false);
    });
  });
});
