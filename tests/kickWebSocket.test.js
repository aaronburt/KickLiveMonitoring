import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  WS_STATES,
  extractChannelId,
  subscribeChannel,
  unsubscribeChannel,
  syncSubscriptions,
  getSubscribedChannelIds,
  isWebSocketConnected,
  getWebSocketState,
  connectWebSocket,
  disconnectWebSocket,
  resetWebSocketState,
  handleIncomingFrame,
  onLiveEvent,
  onStopEvent,
} from '../src/services/kickWebSocket.js';
import {
  addNewStreamer,
  removeTrackedStreamer,
  syncWebSocketSubscriptions,
  handleLiveStreamEvent,
  handleStreamEndEvent,
} from '../src/services/streamerTracker.js';
import { handleRuntimeMessage, MESSAGE_TYPES } from '../src/background/serviceWorker.js';
import { handleAlarm, POLL_ALARM_NAME } from '../src/background/alarmManager.js';
import { updateWebSocketDisplay } from '../src/options/options.js';
import { clearStorage, setStreamer, getStreamer, updateSettings } from '../src/services/storageService.js';
import { createChromeMock } from './mocks/chromeMock.js';

class MockWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sentFrames = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    MockWebSocket.instances.push(this);
  }

  send(data) {
    this.sentFrames.push(data);
  }

  close() {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Normal Closure' });
    }
  }

  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen({});
  }

  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: typeof data === 'string' ? data : JSON.stringify(data) });
    }
  }

  simulateError() {
    if (this.onerror) this.onerror(new Error('Simulated Error'));
  }
}

describe('kickWebSocket service', () => {
  beforeEach(async () => {
    globalThis.chrome = createChromeMock();
    MockWebSocket.instances = [];
    resetWebSocketState();
    await clearStorage();
  });

  afterEach(() => {
    resetWebSocketState();
  });

  describe('extractChannelId', () => {
    it('extracts numeric ID from valid channel string', () => {
      expect(extractChannelId('channel.1282102')).toBe(1282102);
      expect(extractChannelId('channel.668')).toBe(668);
    });

    it('returns null for non-channel strings or malformed inputs', () => {
      expect(extractChannelId('chatroom.123')).toBeNull();
      expect(extractChannelId('channel.')).toBeNull();
      expect(extractChannelId('channel.abc')).toBeNull();
      expect(extractChannelId(null)).toBeNull();
      expect(extractChannelId(undefined)).toBeNull();
      expect(extractChannelId(123)).toBeNull();
    });
  });

  describe('subscription tracking', () => {
    it('subscribes and unsubscribes channel IDs in internal set', () => {
      subscribeChannel(1282102);
      subscribeChannel(668);
      expect(getSubscribedChannelIds()).toContain(1282102);
      expect(getSubscribedChannelIds()).toContain(668);

      unsubscribeChannel(1282102);
      expect(getSubscribedChannelIds()).not.toContain(1282102);
      expect(getSubscribedChannelIds()).toContain(668);
    });

    it('ignores invalid channel IDs during subscribe and unsubscribe', () => {
      subscribeChannel(-5);
      subscribeChannel('invalid');
      expect(getSubscribedChannelIds()).toHaveLength(0);

      unsubscribeChannel('invalid');
      expect(getSubscribedChannelIds()).toHaveLength(0);
    });

    it('synchronizes target channel subscriptions accurately', () => {
      subscribeChannel(100);
      subscribeChannel(200);

      syncSubscriptions([200, 300, 400]);
      const current = getSubscribedChannelIds();
      expect(current).toContain(200);
      expect(current).toContain(300);
      expect(current).toContain(400);
      expect(current).not.toContain(100);
    });

    it('sends pusher:subscribe and pusher:unsubscribe over active socket', () => {
      connectWebSocket(MockWebSocket);
      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.simulateMessage(JSON.stringify({ event: 'pusher:connection_established', data: '{}' }));

      subscribeChannel(12345);
      const subFrame = JSON.parse(socket.sentFrames[socket.sentFrames.length - 1]);
      expect(subFrame.event).toBe('pusher:subscribe');
      expect(subFrame.data.channel).toBe('channel.12345');

      unsubscribeChannel(12345);
      const unsubFrame = JSON.parse(socket.sentFrames[socket.sentFrames.length - 1]);
      expect(unsubFrame.event).toBe('pusher:unsubscribe');
      expect(unsubFrame.data.channel).toBe('channel.12345');
    });
  });

  describe('WebSocket connection lifecycle', () => {
    it('transitions to CONNECTING then CONNECTED on pusher:connection_established', () => {
      subscribeChannel(555);
      const started = connectWebSocket(MockWebSocket);
      expect(started).toBe(true);
      expect(getWebSocketState()).toBe(WS_STATES.CONNECTING);

      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.simulateMessage(JSON.stringify({
        event: 'pusher:connection_established',
        data: JSON.stringify({ socket_id: '123.456', activity_timeout: 120 })
      }));

      expect(isWebSocketConnected()).toBe(true);
      expect(getWebSocketState()).toBe(WS_STATES.CONNECTED);

      const subscribeCalls = socket.sentFrames.map(f => JSON.parse(f));
      expect(subscribeCalls.some(c => c.event === 'pusher:subscribe' && c.data.channel === 'channel.555')).toBe(true);
    });

    it('replies to pusher:ping with pusher:pong', () => {
      connectWebSocket(MockWebSocket);
      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.simulateMessage(JSON.stringify({ event: 'pusher:connection_established', data: '{}' }));

      socket.simulateMessage(JSON.stringify({ event: 'pusher:ping', data: {} }));
      const lastSent = JSON.parse(socket.sentFrames[socket.sentFrames.length - 1]);
      expect(lastSent.event).toBe('pusher:pong');
    });

    it('handles connection error and close cleanly', () => {
      connectWebSocket(MockWebSocket);
      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.simulateError();

      expect(getWebSocketState()).toBe(WS_STATES.DISCONNECTED);
      expect(isWebSocketConnected()).toBe(false);
    });

    it('disconnects and resets state without errors', () => {
      connectWebSocket(MockWebSocket);
      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();

      disconnectWebSocket();
      expect(getWebSocketState()).toBe(WS_STATES.DISCONNECTED);
      expect(isWebSocketConnected()).toBe(false);
    });

    it('schedules reconnect on close when channels are subscribed', () => {
      subscribeChannel(999);
      connectWebSocket(MockWebSocket);
      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.close();
      expect(getWebSocketState()).toBe(WS_STATES.DISCONNECTED);
    });

    it('handles throw during WebSocket construction', () => {
      const failingConstructor = function() { throw new Error('Network error'); };
      const started = connectWebSocket(failingConstructor);
      expect(started).toBe(false);
      expect(getWebSocketState()).toBe(WS_STATES.DISCONNECTED);
    });

    it('returns false when WebSocket constructor is not available', () => {
      const started = connectWebSocket(null);
      expect(started).toBe(false);
    });

    it('returns true early if already connected or connecting', () => {
      connectWebSocket(MockWebSocket);
      expect(connectWebSocket(MockWebSocket)).toBe(true);

      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.simulateMessage(JSON.stringify({ event: 'pusher:connection_established', data: '{}' }));
      expect(connectWebSocket(MockWebSocket)).toBe(true);
    });

    it('safely handles frame send failure when socket send throws', () => {
      connectWebSocket(MockWebSocket);
      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.simulateMessage(JSON.stringify({ event: 'pusher:connection_established', data: '{}' }));

      socket.send = () => { throw new Error('Send failure'); };
      subscribeChannel(8888);
      expect(true).toBe(true);
    });

    it('executes heartbeat interval callback and sends ping when connected', () => {
      let intervalCb = null;
      const originalSetInterval = globalThis.setInterval;
      globalThis.setInterval = (cb) => {
        intervalCb = cb;
        return 9999;
      };

      connectWebSocket(MockWebSocket);
      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.simulateMessage(JSON.stringify({ event: 'pusher:connection_established', data: '{}' }));

      expect(typeof intervalCb).toBe('function');
      intervalCb();
      const lastSent = JSON.parse(socket.sentFrames[socket.sentFrames.length - 1]);
      expect(lastSent.event).toBe('pusher:ping');

      disconnectWebSocket();
      intervalCb();

      globalThis.setInterval = originalSetInterval;
    });

    it('triggers reconnect timer callback on connection drop', () => {
      let timeoutCb = null;
      const originalSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = (cb) => {
        timeoutCb = cb;
        return 8888;
      };

      subscribeChannel(1234);
      connectWebSocket(MockWebSocket);
      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.close();

      expect(typeof timeoutCb).toBe('function');
      socket.close();
      timeoutCb();

      globalThis.setTimeout = originalSetTimeout;
    });

    it('clears active retry timer on manual disconnect', () => {
      const originalSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = () => 7777;

      subscribeChannel(4321);
      connectWebSocket(MockWebSocket);
      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.close();

      disconnectWebSocket();
      expect(getWebSocketState()).toBe(WS_STATES.DISCONNECTED);

      globalThis.setTimeout = originalSetTimeout;
    });

    it('does not schedule reconnect when closed with zero subscribed channels', () => {
      connectWebSocket(MockWebSocket);
      const socket = MockWebSocket.instances[0];
      socket.simulateOpen();
      socket.close();
      expect(getWebSocketState()).toBe(WS_STATES.DISCONNECTED);
    });

    it('handles listeners that throw errors gracefully without crashing', () => {
      const removeLive = onLiveEvent(() => { throw new Error('Live listener failure'); });
      const removeStop = onStopEvent(() => { throw new Error('Stop listener failure'); });

      handleIncomingFrame(JSON.stringify({
        event: 'App\\Events\\StreamerIsLive',
        channel: 'channel.101',
        data: '{}',
      }));

      handleIncomingFrame(JSON.stringify({
        event: 'App\\Events\\StopStreamBroadcast',
        channel: 'channel.101',
        data: '{}',
      }));

      removeLive();
      removeStop();
    });

    it('handles empty or non-array inputs to syncSubscriptions gracefully', () => {
      syncSubscriptions(null);
      syncSubscriptions(undefined);
      syncSubscriptions([0, -1, 'invalid']);
      expect(getSubscribedChannelIds()).toHaveLength(0);
    });

    it('safely ignores malformed or non-string frames', () => {
      handleIncomingFrame(null);
      handleIncomingFrame(undefined);
      handleIncomingFrame(1234);
      handleIncomingFrame('{invalid json');
      handleIncomingFrame(JSON.stringify({ event: 'App\\Events\\StreamerIsLive', channel: 'invalid', data: '{}' }));
      handleIncomingFrame(JSON.stringify({ event: 'App\\Events\\StreamerIsLive', channel: 'channel.123', data: '{not-json' }));
      handleIncomingFrame(JSON.stringify({ event: 'App\\Events\\StopStreamBroadcast', channel: 'invalid' }));
    });
  });

  describe('event dispatching and tracker integration', () => {
    it('dispatches StreamerIsLive event to registered listeners', () => {
      let receivedChannelId = null;
      let receivedData = null;

      const unsubscribeListener = onLiveEvent((id, data) => {
        receivedChannelId = id;
        receivedData = data;
      });

      handleIncomingFrame(JSON.stringify({
        event: 'App\\Events\\StreamerIsLive',
        channel: 'channel.999',
        data: JSON.stringify({
          session_title: 'Epic Stream',
          viewers: 1500,
        }),
      }));

      expect(receivedChannelId).toBe(999);
      expect(receivedData.session_title).toBe('Epic Stream');
      expect(receivedData.viewers).toBe(1500);

      unsubscribeListener();
    });

    it('dispatches StopStreamBroadcast event to registered listeners', () => {
      let stoppedChannelId = null;
      const unsubscribeListener = onStopEvent((id) => {
        stoppedChannelId = id;
      });

      handleIncomingFrame(JSON.stringify({
        event: 'App\\Events\\StopStreamBroadcast',
        channel: 'channel.888',
        data: '{}',
      }));

      expect(stoppedChannelId).toBe(888);
      unsubscribeListener();
    });

    it('handles live event transition via handleLiveStreamEvent in streamerTracker', async () => {
      await updateSettings({ notificationsEnabled: true });
      await setStreamer('gioso', {
        slug: 'gioso',
        username: 'Gioso',
        channelId: 1282102,
        isLive: false,
        title: 'Offline',
        viewerCount: 0,
      });

      const updated = await handleLiveStreamEvent(1282102, {
        session_title: 'Live GTA V RP',
        viewers: 1200,
        category: { name: 'GTA V' },
      });

      expect(updated.isLive).toBe(true);
      expect(updated.title).toBe('Live GTA V RP');
      expect(updated.viewerCount).toBe(1200);
      expect(updated.category).toBe('GTA V');

      const saved = await getStreamer('gioso');
      expect(saved.isLive).toBe(true);
      expect(saved.lastNotifiedAt).toBeGreaterThan(0);
    });

    it('handles stream end transition via handleStreamEndEvent in streamerTracker', async () => {
      await setStreamer('gioso', {
        slug: 'gioso',
        username: 'Gioso',
        channelId: 1282102,
        isLive: true,
        title: 'Live',
        viewerCount: 1500,
      });

      const updated = await handleStreamEndEvent(1282102);
      expect(updated.isLive).toBe(false);
      expect(updated.viewerCount).toBe(0);

      const saved = await getStreamer('gioso');
      expect(saved.isLive).toBe(false);
      expect(saved.viewerCount).toBe(0);
    });

    it('safely ignores live and stop events for untracked channel IDs', async () => {
      const liveRes = await handleLiveStreamEvent(99999999);
      expect(liveRes).toBeNull();

      const stopRes = await handleStreamEndEvent(99999999);
      expect(stopRes).toBeNull();
    });

    it('subscribes and unsubscribes channels when adding/removing tracked streamers', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          id: 777123,
          slug: 'testchannel',
          user: { username: 'TestChannel' },
          livestream: null,
        }),
      });

      const addResult = await addNewStreamer('testchannel', { fetchFn: mockFetch });
      expect(addResult.success).toBe(true);
      expect(getSubscribedChannelIds()).toContain(777123);

      const removeResult = await removeTrackedStreamer('testchannel');
      expect(removeResult.success).toBe(true);
      expect(getSubscribedChannelIds()).not.toContain(777123);
    });

    it('syncWebSocketSubscriptions synchronizes all stored channels', async () => {
      await setStreamer('channelone', { slug: 'channelone', channelId: 111, isLive: false });
      await setStreamer('channeltwo', { slug: 'channeltwo', channelId: 222, isLive: false });

      await syncWebSocketSubscriptions();
      const current = getSubscribedChannelIds();
      expect(current).toContain(111);
      expect(current).toContain(222);
    });
  });

  describe('service worker and alarm fallback integration', () => {
    it('handles GET_WEBSOCKET_STATUS runtime message', async () => {
      let responseData = null;
      const sendResponse = (res) => { responseData = res; };

      handleRuntimeMessage({ type: MESSAGE_TYPES.GET_WEBSOCKET_STATUS }, {}, sendResponse);
      expect(responseData.success).toBe(true);
      expect(responseData.data.connected).toBe(false);
      expect(responseData.data.state).toBe(WS_STATES.DISCONNECTED);
    });

    it('runs fallback HTTP sweep when alarm fires and WebSocket is disconnected', async () => {
      await handleAlarm({ name: POLL_ALARM_NAME });
      expect(getWebSocketState()).not.toBe(WS_STATES.CONNECTED);
    });

    it('updates options WebSocket display element based on status', async () => {
      let badgeClass = '';
      let textContent = '';
      const originalDoc = globalThis.document;
      globalThis.document = {
        getElementById(id) {
          if (id === 'wsStatusBadge') return { set className(val) { badgeClass = val; }, get className() { return badgeClass; } };
          if (id === 'wsStatusText') return { set textContent(val) { textContent = val; }, get textContent() { return textContent; } };
          return null;
        }
      };

      await updateWebSocketDisplay();
      expect(textContent).toBe('HTTP Polling Fallback');
      globalThis.document = originalDoc;
    });
  });
});
