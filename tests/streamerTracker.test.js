import { describe, it, expect, beforeEach } from 'bun:test';
import { installGlobalChromeMock } from './mocks/chromeMock.js';
import {
  checkStreamerStatus,
  checkAllStreamers,
  addNewStreamer,
  removeTrackedStreamer,
} from '../src/services/streamerTracker.js';
import {
  setStreamer,
  getStreamer,
  getStreamers,
  updateSettings,
  clearStorage,
} from '../src/services/storageService.js';

describe('streamerTracker', () => {
  let chromeMock;

  beforeEach(async () => {
    chromeMock = installGlobalChromeMock();
    await clearStorage();
  });

  describe('checkStreamerStatus state transitions', () => {
    it('triggers notification on rising edge (offline -> live)', async () => {
      await setStreamer('xqc', {
        slug: 'xqc',
        username: 'xQc',
        isLive: false,
        lastNotifiedAt: null,
      });

      const mockFetchLive = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          slug: 'xqc',
          user: { username: 'xQc', profile_pic: '' },
          livestream: {
            is_live: true,
            session_title: 'Live now!',
            viewer_count: 5000,
            categories: [{ name: 'Just Chatting' }],
          },
        }),
      });

      const result = await checkStreamerStatus('xqc', { fetchFn: mockFetchLive });
      expect(result.transitionedToLive).toBe(true);
      expect(result.streamer.isLive).toBe(true);
      expect(result.streamer.lastNotifiedAt).not.toBeNull();

      const notifs = await chromeMock.notifications.getAll();
      const notifKeys = Object.keys(notifs);
      expect(notifKeys.length).toBe(1);
      expect(notifs[notifKeys[0]].title).toContain('xQc is live on Kick!');
    });

    it('does not trigger duplicate notification on steady live (live -> live)', async () => {
      const initialTimestamp = 1756653000000;
      await setStreamer('xqc', {
        slug: 'xqc',
        username: 'xQc',
        isLive: true,
        lastNotifiedAt: initialTimestamp,
      });

      const mockFetchStillLive = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          slug: 'xqc',
          user: { username: 'xQc' },
          livestream: {
            is_live: true,
            session_title: 'Still live!',
            viewer_count: 6500,
          },
        }),
      });

      const result = await checkStreamerStatus('xqc', { fetchFn: mockFetchStillLive });
      expect(result.transitionedToLive).toBe(false);
      expect(result.streamer.isLive).toBe(true);
      expect(result.streamer.lastNotifiedAt).toBe(initialTimestamp);

      const notifs = await chromeMock.notifications.getAll();
      expect(Object.keys(notifs).length).toBe(0);
    });

    it('handles falling edge (live -> offline) without notifications', async () => {
      await setStreamer('xqc', {
        slug: 'xqc',
        username: 'xQc',
        isLive: true,
        lastNotifiedAt: 1756653000000,
      });

      const mockFetchOffline = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          slug: 'xqc',
          user: { username: 'xQc' },
          livestream: null,
        }),
      });

      const result = await checkStreamerStatus('xqc', { fetchFn: mockFetchOffline });
      expect(result.transitionedToLive).toBe(false);
      expect(result.streamer.isLive).toBe(false);

      const notifs = await chromeMock.notifications.getAll();
      expect(Object.keys(notifs).length).toBe(0);
    });

    it('suppresses notifications when notificationsEnabled setting is false', async () => {
      await updateSettings({ notificationsEnabled: false });
      await setStreamer('xqc', {
        slug: 'xqc',
        username: 'xQc',
        isLive: false,
      });

      const mockFetchLive = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          slug: 'xqc',
          user: { username: 'xQc' },
          livestream: { is_live: true, session_title: 'Stream' },
        }),
      });

      const result = await checkStreamerStatus('xqc', { fetchFn: mockFetchLive });
      expect(result.transitionedToLive).toBe(true);

      const notifs = await chromeMock.notifications.getAll();
      expect(Object.keys(notifs).length).toBe(0);
    });
  });

  describe('addNewStreamer', () => {
    it('adds a valid new streamer and updates badge', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          slug: 'adinross',
          user: { username: 'AdinRoss' },
          livestream: { is_live: true, viewer_count: 50000 },
        }),
      });

      const result = await addNewStreamer('https://kick.com/adinross', { fetchFn: mockFetch });
      expect(result.success).toBe(true);
      expect(result.streamer.slug).toBe('adinross');
      expect(result.streamer.isLive).toBe(true);

      const stored = await getStreamer('adinross');
      expect(stored).not.toBeNull();
      expect(chromeMock.action.getBadgeText()).toBe('1');
    });

    it('rejects adding duplicate streamer', async () => {
      await setStreamer('adinross', { slug: 'adinross' });

      const result = await addNewStreamer('adinross');
      expect(result.success).toBe(false);
      expect(result.error).toContain('already in your tracking list');
    });

    it('rejects invalid streamer slug input', async () => {
      const result = await addNewStreamer('!@#$%');
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
    });

    it('rejects nonexistent 404 channels', async () => {
      const mockFetch404 = async () => ({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      const result = await addNewStreamer('nonexistent_streamer_slug', { fetchFn: mockFetch404 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('removeTrackedStreamer', () => {
    it('removes streamer and updates badge counter', async () => {
      await setStreamer('xqc', { slug: 'xqc', isLive: true });
      await setStreamer('adinross', { slug: 'adinross', isLive: true });

      const removeResult = await removeTrackedStreamer('xqc');
      expect(removeResult.success).toBe(true);

      const streamers = await getStreamers();
      expect(Object.keys(streamers)).toEqual(['adinross']);
      expect(chromeMock.action.getBadgeText()).toBe('1');
    });
  });

  describe('checkAllStreamers', () => {
    it('polls all tracked streamers and computes new live streams', async () => {
      await setStreamer('xqc', { slug: 'xqc', isLive: false });
      await setStreamer('adinross', { slug: 'adinross', isLive: true });

      const mockFetch = async (url) => {
        if (url.includes('xqc')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              slug: 'xqc',
              user: { username: 'xQc' },
              livestream: { is_live: true, session_title: 'xQc Live', viewer_count: 30000 },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            slug: 'adinross',
            user: { username: 'AdinRoss' },
            livestream: { is_live: true, session_title: 'Adin Live', viewer_count: 40000 },
          }),
        };
      };

      const result = await checkAllStreamers({ fetchFn: mockFetch });
      expect(result.updated.length).toBe(2);
      expect(result.newLive.length).toBe(1);
      expect(result.newLive[0].slug).toBe('xqc');
      expect(chromeMock.action.getBadgeText()).toBe('2');
    });

    it('aborts polling remaining streamers when canary request encounters a systemic API failure', async () => {
      await setStreamer('streamer1', { slug: 'streamer1', isLive: false });
      await setStreamer('streamer2', { slug: 'streamer2', isLive: false });

      let fetchCallCount = 0;
      const mockFetch = async () => {
        fetchCallCount += 1;
        return {
          ok: false,
          status: 403,
          json: async () => ({}),
        };
      };

      const result = await checkAllStreamers({ fetchFn: mockFetch });
      expect(result.canaryFailed).toBe(true);
      expect(fetchCallCount).toBe(1);
    });

    it('suppresses polling when circuit breaker is tripped unless bypassed', async () => {
      await setStreamer('streamer1', { slug: 'streamer1', isLive: false });

      const mockFetch403 = async () => ({
        ok: false,
        status: 403,
        json: async () => ({}),
      });

      await checkAllStreamers({ fetchFn: mockFetch403 });
      await checkAllStreamers({ fetchFn: mockFetch403 });
      await checkAllStreamers({ fetchFn: mockFetch403 });

      let fetchCalled = false;
      const mockFetchNormal = async () => {
        fetchCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ slug: 'streamer1', user: { username: 'Streamer1' } }),
        };
      };

      const suppressedResult = await checkAllStreamers({ fetchFn: mockFetchNormal });
      expect(suppressedResult.circuitTripped).toBe(true);
      expect(fetchCalled).toBe(false);

      const bypassResult = await checkAllStreamers({ fetchFn: mockFetchNormal, bypassCircuitBreaker: true });
      expect(bypassResult.circuitTripped).toBeUndefined();
      expect(fetchCalled).toBe(true);
    });

    it('returns empty lists when no streamers are tracked', async () => {
      const result = await checkAllStreamers();
      expect(result.updated.length).toBe(0);
      expect(result.newLive.length).toBe(0);
      expect(chromeMock.action.getBadgeText()).toBe('');
    });
  });
});
