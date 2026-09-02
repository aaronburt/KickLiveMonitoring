import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { installGlobalChromeMock } from './mocks/chromeMock.js';
import {
  checkStreamerStatus,
  checkAllStreamers,
  addNewStreamer,
  removeTrackedStreamer,
} from '../src/services/streamerTracker.js';
import {
  getStreamers,
  getStreamer,
  setStreamer,
  getSettings,
  updateSettings,
  clearStorage,
} from '../src/services/storageService.js';
import { validateSlug, normalizeSlug } from '../src/utils/slugValidator.js';
import { handleRuntimeMessage, MESSAGE_TYPES } from '../src/background/serviceWorker.js';

describe('Adversarial Stress & State Transition Rigor', () => {
  let chromeMock;

  beforeEach(async () => {
    chromeMock = installGlobalChromeMock();
    await clearStorage();
  });

  it('verifies rising edge offline -> live triggers notification with correct payload', async () => {
    const offlinePayload = {
      slug: 'trainwreckstv',
      user: { username: 'Trainwreckstv', profile_pic: 'https://kick.com/train.png' },
      livestream: null,
    };

    const livePayload = {
      slug: 'trainwreckstv',
      user: { username: 'Trainwreckstv', profile_pic: 'https://kick.com/train.png' },
      livestream: {
        is_live: true,
        session_title: 'SQUAD CAST PODCAST',
        categories: [{ name: 'Just Chatting' }],
        viewer_count: 15400,
        thumbnail: { url: 'https://kick.com/thumb.png' },
      },
    };

    const mockFetchOffline = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => offlinePayload,
    }));

    const addResult = await addNewStreamer('trainwreckstv', { fetchFn: mockFetchOffline });
    expect(addResult.success).toBe(true);
    expect(chromeMock.notifications.getAll).toBeDefined();
    let notifications = await chromeMock.notifications.getAll();
    expect(Object.keys(notifications).length).toBe(0);

    const mockFetchLive = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => livePayload,
    }));

    const checkResult = await checkStreamerStatus('trainwreckstv', { fetchFn: mockFetchLive });
    expect(checkResult.transitionedToLive).toBe(true);
    expect(checkResult.streamer.isLive).toBe(true);

    notifications = await chromeMock.notifications.getAll();
    const notifKeys = Object.keys(notifications);
    expect(notifKeys.length).toBe(1);
    const notif = notifications[notifKeys[0]];
    expect(notif.title).toBe('Trainwreckstv is live on Kick!');
    expect(notif.message).toContain('SQUAD CAST PODCAST');
    expect(notif.message).toContain('Just Chatting');
  });

  it('suppresses notifications during steady-state live -> live across multiple cycles with metadata fluctuations', async () => {
    let viewerCount = 5000;
    let streamTitle = 'Initial Title';
    let currentCategory = 'Slots & Casino';

    const liveFetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        slug: 'roshtein',
        user: { username: 'Roshtein', profile_pic: 'https://kick.com/rosh.png' },
        livestream: {
          is_live: true,
          session_title: streamTitle,
          categories: [{ name: currentCategory }],
          viewer_count: viewerCount,
        },
      }),
    }));

    await addNewStreamer('roshtein', { fetchFn: liveFetch });
    let notifications = await chromeMock.notifications.getAll();
    expect(Object.keys(notifications).length).toBe(0);

    for (let cycle = 1; cycle <= 10; cycle += 1) {
      viewerCount += 250;
      streamTitle = `Title at cycle ${cycle}`;
      currentCategory = cycle % 2 === 0 ? 'Gaming' : 'Slots & Casino';

      const result = await checkStreamerStatus('roshtein', { fetchFn: liveFetch });
      expect(result.transitionedToLive).toBe(false);
      expect(result.streamer.isLive).toBe(true);
      expect(result.streamer.viewerCount).toBe(viewerCount);
      expect(result.streamer.title).toBe(streamTitle);
    }

    notifications = await chromeMock.notifications.getAll();
    expect(Object.keys(notifications).length).toBe(0);
  });

  it('handles multi-cycle rapid transitions cleanly without missing or spurious notifications', async () => {
    let isLiveState = false;

    const dynamicFetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        slug: 'adinross',
        user: { username: 'AdinRoss', profile_pic: 'https://kick.com/adin.png' },
        livestream: isLiveState
          ? {
              is_live: true,
              session_title: 'Adin Live',
              categories: [{ name: 'Just Chatting' }],
              viewer_count: 50000,
            }
          : null,
      }),
    }));

    await addNewStreamer('adinross', { fetchFn: dynamicFetch });

    let totalRisingEdges = 0;
    const cycles = [true, false, true, false, true, true, false, true];

    for (const targetLive of cycles) {
      isLiveState = targetLive;
      await new Promise((resolve) => setTimeout(resolve, 2));
      const result = await checkStreamerStatus('adinross', { fetchFn: dynamicFetch });
      if (result.transitionedToLive) {
        totalRisingEdges += 1;
      }
    }

    expect(totalRisingEdges).toBe(4);
    const notifications = await chromeMock.notifications.getAll();
    expect(Object.keys(notifications).length).toBe(4);
  });

  it('verifies notification setting toggle suppression', async () => {
    const offlineFetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        slug: 'hikaru',
        user: { username: 'Hikaru', profile_pic: '' },
        livestream: null,
      }),
    }));

    const liveFetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        slug: 'hikaru',
        user: { username: 'Hikaru', profile_pic: '' },
        livestream: {
          is_live: true,
          session_title: 'Speed Chess',
          categories: [{ name: 'Chess' }],
          viewer_count: 12000,
        },
      }),
    }));

    await addNewStreamer('hikaru', { fetchFn: offlineFetch });
    await updateSettings({ notificationsEnabled: false });

    const result = await checkStreamerStatus('hikaru', { fetchFn: liveFetch });
    expect(result.transitionedToLive).toBe(true);
    expect(result.streamer.isLive).toBe(true);

    const notifications = await chromeMock.notifications.getAll();
    expect(Object.keys(notifications).length).toBe(0);
  });

  it('tests network error handling during live polling cycle', async () => {
    const liveFetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        slug: 'xqc',
        user: { username: 'xQc', profile_pic: 'https://kick.com/xqc.png' },
        livestream: {
          is_live: true,
          session_title: 'Overwatch 2 Ranked',
          categories: [{ name: 'Overwatch 2' }],
          viewer_count: 45000,
        },
      }),
    }));

    const errorFetch = mock(async () => {
      throw new Error('Network timeout');
    });

    await addNewStreamer('xqc', { fetchFn: liveFetch });
    let record = await getStreamer('xqc');
    expect(record.isLive).toBe(true);

    const errorResult = await checkStreamerStatus('xqc', { fetchFn: errorFetch });
    expect(errorResult.streamer.error).toBe('Network timeout');

    const nextLiveResult = await checkStreamerStatus('xqc', { fetchFn: liveFetch });
    expect(nextLiveResult.transitionedToLive).toBe(false);
    const notifications = await chromeMock.notifications.getAll();
    expect(Object.keys(notifications).length).toBe(0);
  });

  it('tests 429 rate limit response handling without crashing background operations', async () => {
    const rateLimitFetch = mock(async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ message: 'Rate limited' }),
    }));

    const result = await checkStreamerStatus('tarik', { fetchFn: rateLimitFetch });
    expect(result.streamer.error).toContain('429');
    expect(result.transitionedToLive).toBe(false);
  });

  it('tests concurrent checkAllStreamers under simulated network latency', async () => {
    const channelSlugs = Array.from({ length: 15 }, (_, i) => `streamer_${i}`);

    for (const slug of channelSlugs) {
      await setStreamer(slug, {
        slug,
        username: slug.toUpperCase(),
        avatarUrl: `https://kick.com/${slug}.png`,
        isLive: false,
        title: 'Offline',
        category: '',
        viewerCount: 0,
        thumbnailUrl: '',
        startedAt: null,
        lastCheckedAt: 0,
        lastNotifiedAt: null,
        error: null,
      });
    }

    const concurrentFetch = mock(async (url) => {
      const slugMatch = url.match(/channels\/([^/?#]+)/);
      const slug = slugMatch ? slugMatch[1] : 'unknown';
      const index = parseInt(slug.replace('streamer_', ''), 10) || 0;
      const delayMs = 5 + (index % 5) * 5;
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const isLive = index % 2 === 0;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          slug,
          user: { username: slug.toUpperCase(), profile_pic: '' },
          livestream: isLive
            ? {
                is_live: true,
                session_title: `Stream by ${slug}`,
                categories: [{ name: 'Gaming' }],
                viewer_count: 1000 * (index + 1),
              }
            : null,
        }),
      };
    });

    const checkAllResult = await checkAllStreamers({ fetchFn: concurrentFetch });
    expect(checkAllResult.updated.length).toBe(15);
    expect(checkAllResult.newLive.length).toBe(8);

    const storedStreamers = await getStreamers();
    expect(Object.keys(storedStreamers).length).toBe(15);

    for (let i = 0; i < 15; i += 1) {
      const slug = `streamer_${i}`;
      const record = storedStreamers[slug];
      expect(record).toBeDefined();
      expect(record.isLive).toBe(i % 2 === 0);
      expect(record.lastCheckedAt).toBeGreaterThan(0);
    }
  });

  it('tests concurrent setStreamer calls for race condition / lost updates', async () => {
    const originalGet = chromeMock.storage.local.get;
    const originalSet = chromeMock.storage.local.set;

    chromeMock.storage.local.get = (keys, callback) => {
      setTimeout(() => {
        originalGet.call(chromeMock.storage.local, keys, callback);
      }, 5);
    };

    chromeMock.storage.local.set = (items, callback) => {
      setTimeout(() => {
        originalSet.call(chromeMock.storage.local, items, callback);
      }, 5);
    };

    await Promise.all([
      setStreamer('streamer_a', { slug: 'streamer_a', isLive: true, title: 'Title A' }),
      setStreamer('streamer_b', { slug: 'streamer_b', isLive: false, title: 'Title B' }),
      setStreamer('streamer_c', { slug: 'streamer_c', isLive: true, title: 'Title C' }),
    ]);

    const streamers = await getStreamers();
    expect(Object.keys(streamers).length).toBe(3);
    expect(streamers.streamer_a).toBeDefined();
    expect(streamers.streamer_b).toBeDefined();
    expect(streamers.streamer_c).toBeDefined();
  });

  it('tests race condition: removing streamer while status check is in-flight does not resurrect streamer', async () => {
    let resolveFetch;
    const pendingFetch = mock(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    await setStreamer('shroud', { slug: 'shroud', isLive: true, title: 'Valorant' });

    const checkPromise = checkStreamerStatus('shroud', { fetchFn: pendingFetch });

    await removeTrackedStreamer('shroud');
    let stored = await getStreamers();
    expect(stored.shroud).toBeUndefined();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        slug: 'shroud',
        user: { username: 'Shroud', profile_pic: '' },
        livestream: { is_live: true, session_title: 'Valorant', categories: [] },
      }),
    });

    await checkPromise;

    stored = await getStreamers();
    expect(stored.shroud).toBeUndefined();
  });

  it('tests slug validator with adversarial inputs and injection payloads', async () => {
    const maliciousInputs = [
      '<script>alert(1)</script>',
      'javascript:void(0)',
      '../../etc/passwd',
      'xqc/extra/path/segments',
      'user with spaces',
      'user!@#$%',
      '',
      '   ',
      'https://kick.com/',
      'https://evil.com/xqc',
      'a'.repeat(45),
    ];

    for (const input of maliciousInputs) {
      const res = validateSlug(input);
      expect(res.isValid).toBe(false);
    }

    const validVariants = [
      ['https://kick.com/xqc', 'xqc'],
      ['https://kick.com/xqc/', 'xqc'],
      ['https://kick.com/xqc?ref=banner#chat', 'xqc'],
      ['kick.com/xqc', 'xqc'],
      ['@xqc', 'xqc'],
      ['  xqc  ', 'xqc'],
      ['Streamer_123', 'streamer_123'],
    ];

    for (const [raw, expected] of validVariants) {
      const res = validateSlug(raw);
      expect(res.isValid).toBe(true);
      expect(res.slug).toBe(expected);
    }
  });

  it('tests notification click tab URL generation for slugs containing underscores', async () => {
    const { handleNotificationClick, extractSlugFromNotificationId } = await import(
      '../src/background/notificationManager.js'
    );
    chrome.notifications.onClicked.addListener(handleNotificationClick);

    const slugWithUnderscores = 'big_streamer_99';
    const extracted = extractSlugFromNotificationId(`kick_live_${slugWithUnderscores}_123456789`);
    expect(extracted).toBe(slugWithUnderscores);

    const notifId = await chromeMock.notifications.create(
      `kick_live_${slugWithUnderscores}_${Date.now()}`,
      { title: 'Live' },
    );

    await chromeMock.notifications.onClicked.trigger(notifId);

    const tabs = await chromeMock.tabs.query({ active: true });
    expect(tabs.length).toBeGreaterThan(0);
    const openedTab = tabs[tabs.length - 1];
    expect(openedTab.url).toBe(`https://kick.com/${slugWithUnderscores}`);
  });

  it('tests service worker runtime messaging with edge case payloads', async () => {
    let responseData = null;
    const sendResponse = (resp) => {
      responseData = resp;
    };

    const handledNull = handleRuntimeMessage(null, {}, sendResponse);
    expect(handledNull).toBe(false);

    const handledUnknown = handleRuntimeMessage({ type: 'NON_EXISTENT_TYPE' }, {}, sendResponse);
    expect(handledUnknown).toBe(false);

    const handledMissingSlug = handleRuntimeMessage(
      { type: MESSAGE_TYPES.CHECK_STREAMER, payload: {} },
      {},
      sendResponse,
    );
    expect(handledMissingSlug).toBe(false);
    expect(responseData.success).toBe(false);

    responseData = null;
    const handledSettings = handleRuntimeMessage(
      {
        type: MESSAGE_TYPES.UPDATE_SETTINGS,
        payload: { checkIntervalMinutes: 5, soundEnabled: true },
      },
      {},
      sendResponse,
    );
    expect(handledSettings).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(responseData.success).toBe(true);
    expect(responseData.data.checkIntervalMinutes).toBe(5);
    expect(responseData.data.soundEnabled).toBe(true);
  });
});
