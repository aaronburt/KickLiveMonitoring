const PUSHER_URL = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false';
const HEARTBEAT_INTERVAL_MS = 60000;
const INITIAL_RETRY_DELAY_MS = 3000;
const MAX_RETRY_DELAY_MS = 60000;

export const WS_STATES = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
};

let activeSocket = null;
let currentConnectionState = WS_STATES.DISCONNECTED;
let retryDelay = INITIAL_RETRY_DELAY_MS;
let retryTimer = null;
let heartbeatTimer = null;
const subscribedChannels = new Set();

const liveListeners = new Set();
const stopListeners = new Set();

export function onLiveEvent(callback) {
  liveListeners.add(callback);
  return () => liveListeners.delete(callback);
}

export function onStopEvent(callback) {
  stopListeners.add(callback);
  return () => stopListeners.delete(callback);
}

export function getWebSocketState() {
  return currentConnectionState;
}

export function isWebSocketConnected() {
  return currentConnectionState === WS_STATES.CONNECTED && activeSocket?.readyState === 1;
}

export function getSubscribedChannelIds() {
  return Array.from(subscribedChannels);
}

export function extractChannelId(channelString) {
  if (typeof channelString !== 'string') return null;
  const match = channelString.match(/^channel\.(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function sendPusherFrame(event, data = {}) {
  if (!activeSocket || activeSocket.readyState !== 1) return false;
  try {
    activeSocket.send(JSON.stringify({ event, data }));
    return true;
  } catch {
    return false;
  }
}

export function subscribeChannel(channelId) {
  const id = Number(channelId);
  if (!Number.isFinite(id) || id <= 0) return;
  subscribedChannels.add(id);
  if (isWebSocketConnected()) {
    sendPusherFrame('pusher:subscribe', { channel: `channel.${id}` });
  }
}

export function unsubscribeChannel(channelId) {
  const id = Number(channelId);
  if (!Number.isFinite(id) || id <= 0) return;
  subscribedChannels.delete(id);
  if (isWebSocketConnected()) {
    sendPusherFrame('pusher:unsubscribe', { channel: `channel.${id}` });
  }
}

export function syncSubscriptions(channelIds) {
  const targetIds = new Set(
    (Array.isArray(channelIds) ? channelIds : [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0)
  );

  for (const existingId of subscribedChannels) {
    if (!targetIds.has(existingId)) {
      unsubscribeChannel(existingId);
    }
  }

  for (const newId of targetIds) {
    if (!subscribedChannels.has(newId)) {
      subscribeChannel(newId);
    }
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (isWebSocketConnected()) {
      sendPusherFrame('pusher:ping', {});
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleReconnect(WebSocketConstructor) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryDelay = Math.min(retryDelay * 1.5, MAX_RETRY_DELAY_MS);
    connectWebSocket(WebSocketConstructor);
  }, retryDelay);
}

export function handleIncomingFrame(eventData) {
  if (typeof eventData !== 'string') return;
  let parsed;
  try {
    parsed = JSON.parse(eventData);
  } catch {
    return;
  }

  const { event, channel, data } = parsed;

  if (event === 'pusher:ping') {
    sendPusherFrame('pusher:pong', {});
    return;
  }

  if (event === 'pusher:connection_established') {
    currentConnectionState = WS_STATES.CONNECTED;
    retryDelay = INITIAL_RETRY_DELAY_MS;
    startHeartbeat();

    for (const channelId of subscribedChannels) {
      sendPusherFrame('pusher:subscribe', { channel: `channel.${channelId}` });
    }
    return;
  }

  if (event === 'App\\Events\\StreamerIsLive') {
    const channelId = extractChannelId(channel);
    if (!channelId) return;

    let payload = data;
    if (typeof data === 'string') {
      try {
        payload = JSON.parse(data);
      } catch {
        payload = {};
      }
    }

    for (const listener of liveListeners) {
      try {
        listener(channelId, payload);
      } catch {}
    }
    return;
  }

  if (event === 'App\\Events\\StopStreamBroadcast') {
    const channelId = extractChannelId(channel);
    if (!channelId) return;

    for (const listener of stopListeners) {
      try {
        listener(channelId);
      } catch {}
    }
  }
}

export function connectWebSocket(WebSocketConstructor = typeof WebSocket !== 'undefined' ? WebSocket : null) {
  if (!WebSocketConstructor) return false;
  if (isWebSocketConnected() || currentConnectionState === WS_STATES.CONNECTING) return true;

  currentConnectionState = WS_STATES.CONNECTING;

  try {
    activeSocket = new WebSocketConstructor(PUSHER_URL);

    activeSocket.onopen = () => {};

    activeSocket.onmessage = (messageEvent) => {
      handleIncomingFrame(messageEvent.data);
    };

    activeSocket.onerror = () => {
      activeSocket?.close();
    };

    activeSocket.onclose = () => {
      currentConnectionState = WS_STATES.DISCONNECTED;
      stopHeartbeat();
      activeSocket = null;
      if (subscribedChannels.size > 0) {
        scheduleReconnect(WebSocketConstructor);
      }
    };

    return true;
  } catch {
    currentConnectionState = WS_STATES.DISCONNECTED;
    activeSocket = null;
    scheduleReconnect(WebSocketConstructor);
    return false;
  }
}

export function disconnectWebSocket() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  stopHeartbeat();
  currentConnectionState = WS_STATES.DISCONNECTED;
  if (activeSocket) {
    activeSocket.onclose = null;
    activeSocket.onerror = null;
    activeSocket.onmessage = null;
    activeSocket.close();
    activeSocket = null;
  }
}

export function resetWebSocketState() {
  disconnectWebSocket();
  subscribedChannels.clear();
  liveListeners.clear();
  stopListeners.clear();
  retryDelay = INITIAL_RETRY_DELAY_MS;
}
