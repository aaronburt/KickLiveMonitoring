import { describe, it, expect, beforeEach } from 'bun:test';
import { installGlobalChromeMock } from './mocks/chromeMock.js';
import {
  updateBadgeCount,
  updateBadgeFromStreamers,
  KICK_BADGE_COLOR,
} from '../src/background/badgeManager.js';

describe('badgeManager', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = installGlobalChromeMock();
  });

  it('sets badge text to empty string when live count is zero', async () => {
    await updateBadgeCount(0);
    expect(chromeMock.action.getBadgeText()).toBe('');
  });

  it('sets badge text and color when live count is greater than zero', async () => {
    await updateBadgeCount(3);
    expect(chromeMock.action.getBadgeText()).toBe('3');
    expect(chromeMock.action.getBadgeBackgroundColor()).toBe(KICK_BADGE_COLOR);
  });

  it('calculates live count correctly from a streamers map', async () => {
    const streamersMap = {
      xqc: { slug: 'xqc', isLive: true },
      adinross: { slug: 'adinross', isLive: true },
      hikaru: { slug: 'hikaru', isLive: false },
    };

    const count = await updateBadgeFromStreamers(streamersMap);
    expect(count).toBe(2);
    expect(chromeMock.action.getBadgeText()).toBe('2');
  });

  it('handles empty or null streamers map gracefully', async () => {
    const count = await updateBadgeFromStreamers(null);
    expect(count).toBe(0);
    expect(chromeMock.action.getBadgeText()).toBe('');
  });
});
