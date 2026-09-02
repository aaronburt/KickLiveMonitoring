import { fetchChannelData } from './kickApi.js';
import {
  getStreamers,
  getStreamer,
  setStreamer,
  removeStreamer,
  getSettings,
} from './storageService.js';
import {
  canExecute,
  recordSuccess,
  recordFailure,
  resetCircuit,
  isSystemicApiError,
  getCircuitStatus,
} from './circuitBreaker.js';
import { validateSlug } from '../utils/slugValidator.js';
import { createLiveNotification } from '../background/notificationManager.js';
import { updateBadgeFromStreamers } from '../background/badgeManager.js';
import { logDebug } from '../utils/logger.js';

export async function checkStreamerStatus(slug, options = {}) {
  const customFetch = options.fetchFn || fetch;
  const previous = await getStreamer(slug);
  const current = await fetchChannelData(slug, customFetch);

  const wasLive = Boolean(previous?.isLive);
  const isNowLive = Boolean(current.error && previous ? previous.isLive : current.isLive);
  const transitionedToLive = !current.error && !wasLive && isNowLive;

  let lastNotifiedAt = previous?.lastNotifiedAt || null;

  if (transitionedToLive) {
    const settings = await getSettings();
    if (settings.notificationsEnabled) {
      await createLiveNotification(current);
      lastNotifiedAt = Date.now();
      await logDebug('Notification Sent', `Streamer ${current.username || slug} went LIVE`);
    }
  }

  await logDebug('Check Status', slug, { isLive: isNowLive, viewers: current.viewerCount, error: current.error });

  const merged = {
    ...previous,
    ...current,
    lastNotifiedAt,
    lastCheckedAt: Date.now(),
  };

  if (current.error && previous) {
    merged.isLive = previous.isLive;
    merged.avatarUrl = previous.avatarUrl || current.avatarUrl;
    merged.username = previous.username || current.username;
    merged.title = previous.title || current.title;
    merged.category = previous.category || current.category;
    merged.viewerCount = previous.viewerCount || current.viewerCount;
    merged.thumbnailUrl = previous.thumbnailUrl || current.thumbnailUrl;
    merged.startedAt = previous.startedAt || current.startedAt;
  }

  if (await getStreamer(slug)) {
    await setStreamer(slug, merged);
  }

  return { streamer: merged, transitionedToLive, previous };
}

export async function checkAllStreamers(options = {}) {
  if (!options.bypassCircuitBreaker && !canExecute()) {
    const status = getCircuitStatus();
    await logDebug('Circuit Breaker Active', `State: ${status.state}, Failures: ${status.consecutiveFailures}`);
    return { updated: [], newLive: [], circuitTripped: true };
  }

  const streamersMap = await getStreamers();
  const slugs = Object.keys(streamersMap);

  if (slugs.length === 0) {
    await updateBadgeFromStreamers({});
    return { updated: [], newLive: [] };
  }

  const [canarySlug, ...remainingSlugs] = slugs;
  const canaryResult = await checkStreamerStatus(canarySlug, options);

  if (canaryResult?.streamer?.error && isSystemicApiError(canaryResult.streamer.error)) {
    recordFailure(canaryResult.streamer.error);
    const latest = await getStreamers();
    await updateBadgeFromStreamers(latest);
    return {
      updated: [canaryResult.streamer],
      newLive: canaryResult.transitionedToLive ? [canaryResult.streamer] : [],
      canaryFailed: true,
    };
  }

  recordSuccess();

  const updated = [canaryResult.streamer];
  const newLive = canaryResult.transitionedToLive ? [canaryResult.streamer] : [];

  if (remainingSlugs.length > 0) {
    const results = await Promise.allSettled(
      remainingSlugs.map((slug) => checkStreamerStatus(slug, options)),
    );

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        updated.push(res.value.streamer);
        if (res.value.transitionedToLive) {
          newLive.push(res.value.streamer);
        }
      }
    }
  }

  const latest = await getStreamers();
  await updateBadgeFromStreamers(latest);

  return { updated, newLive };
}

export async function addNewStreamer(rawInput, options = {}) {
  const validation = validateSlug(rawInput);
  if (!validation.isValid) {
    return { success: false, error: validation.error, streamer: null };
  }

  const slug = validation.slug;
  const existing = await getStreamer(slug);
  if (existing) {
    return {
      success: false,
      error: `Streamer "${slug}" is already in your tracking list.`,
      streamer: existing,
    };
  }

  const customFetch = options.fetchFn || fetch;
  const initial = await fetchChannelData(slug, customFetch);

  if (initial.error?.includes('404')) {
    return {
      success: false,
      error: `Kick channel "${slug}" was not found. Please verify the username.`,
      streamer: null,
    };
  }

  if (initial.error && isSystemicApiError(initial.error)) {
    recordFailure(initial.error);
    return {
      success: false,
      error: initial.error,
      streamer: null,
    };
  }

  recordSuccess();

  const record = {
    ...initial,
    lastNotifiedAt: initial.isLive ? Date.now() : null,
    lastCheckedAt: Date.now(),
  };

  await setStreamer(slug, record);
  const all = await getStreamers();
  await updateBadgeFromStreamers(all);
  await logDebug('Add Streamer', slug, { username: record.username, isLive: record.isLive });

  return { success: true, error: null, streamer: record };
}

export async function removeTrackedStreamer(rawSlug) {
  if (!rawSlug || typeof rawSlug !== 'string') {
    return { success: false, error: 'Invalid streamer slug' };
  }
  const slug = rawSlug.trim().toLowerCase();
  await removeStreamer(slug);
  const remaining = await getStreamers();
  await updateBadgeFromStreamers(remaining);
  await logDebug('Remove Streamer', slug);
  return { success: true, error: null };
}
