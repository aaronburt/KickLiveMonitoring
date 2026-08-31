import { describe, it, expect, beforeEach } from 'bun:test';
import { installGlobalChromeMock } from './mocks/chromeMock.js';
import {
  getStreamers,
  getStreamer,
  setStreamer,
  removeStreamer,
  getSettings,
  updateSettings,
  clearStorage,
  getSyncedWatchlist,
  DEFAULT_SETTINGS,
} from '../src/services/storageService.js';

describe('storageService', () => {
  let chromeMock;

  beforeEach(async () => {
    chromeMock = installGlobalChromeMock();
    await clearStorage();
  });

  it('returns default settings when storage is empty', async () => {
    const settings = await getSettings();
    expect(settings.checkIntervalMinutes).toBe(DEFAULT_SETTINGS.checkIntervalMinutes);
    expect(settings.notificationsEnabled).toBe(DEFAULT_SETTINGS.notificationsEnabled);
    expect(settings.soundEnabled).toBe(DEFAULT_SETTINGS.soundEnabled);
    expect(settings.debugLogging).toBe(false);
  });

  it('updates and persists partial settings', async () => {
    await updateSettings({ checkIntervalMinutes: 5, soundEnabled: true, debugLogging: true });
    const updated = await getSettings();
    expect(updated.checkIntervalMinutes).toBe(5);
    expect(updated.soundEnabled).toBe(true);
    expect(updated.debugLogging).toBe(true);
    expect(updated.notificationsEnabled).toBe(DEFAULT_SETTINGS.notificationsEnabled);
  });

  it('saves and retrieves a streamer record by normalized slug', async () => {
    const streamerData = {
      slug: 'xqc',
      username: 'xQc',
      isLive: true,
      title: 'Testing',
      viewerCount: 15000,
    };

    await setStreamer('XQC', streamerData);
    const retrieved = await getStreamer('xqc');
    expect(retrieved).not.toBeNull();
    expect(retrieved.username).toBe('xQc');
    expect(retrieved.isLive).toBe(true);

    const allStreamers = await getStreamers();
    expect(Object.keys(allStreamers)).toContain('xqc');
  });

  it('removes a streamer correctly', async () => {
    await setStreamer('xqc', { slug: 'xqc', username: 'xQc' });
    await setStreamer('adinross', { slug: 'adinross', username: 'AdinRoss' });

    let allStreamers = await getStreamers();
    expect(Object.keys(allStreamers).length).toBe(2);

    await removeStreamer('xqc');
    allStreamers = await getStreamers();
    expect(Object.keys(allStreamers).length).toBe(1);
    expect(allStreamers.xqc).toBeUndefined();
    expect(allStreamers.adinross).toBeDefined();
  });

  it('clears all storage records', async () => {
    await setStreamer('xqc', { slug: 'xqc' });
    await updateSettings({ checkIntervalMinutes: 10 });
    await clearStorage();

    const streamers = await getStreamers();
    expect(Object.keys(streamers).length).toBe(0);
  });

  it('syncs watchlist slugs to cloud sync storage', async () => {
    await setStreamer('xqc', { slug: 'xqc', username: 'xQc' });
    await setStreamer('ratedepicz', { slug: 'ratedepicz', username: 'RatedEpicz' });

    const synced = await getSyncedWatchlist();
    expect(synced).toContain('xqc');
    expect(synced).toContain('ratedepicz');

    await removeStreamer('xqc');
    const updatedSynced = await getSyncedWatchlist();
    expect(updatedSynced).not.toContain('xqc');
    expect(updatedSynced).toContain('ratedepicz');
  });
});
