import { describe, it, expect } from 'bun:test';
import {
  fetchChannelData,
  searchChannels,
  validateKickChannelSchema,
  validateKickSearchSchema,
  verifyApiHealth,
} from '../src/services/kickApi.js';

describe('kickApi', () => {
  it('returns fallback error when slug is empty', async () => {
    const data = await fetchChannelData('');
    expect(data.error).toBe('Channel slug is required');
    expect(data.isLive).toBe(false);
  });

  it('correctly parses an active live stream response', async () => {
    const mockApiResponse = {
      id: 668,
      slug: 'xqc',
      user: {
        username: 'xQc',
        profile_pic: 'https://files.kick.com/images/user/676/profile.webp',
      },
      livestream: {
        id: 12345,
        session_title: '🔴 GTA V RP STREAM',
        is_live: true,
        viewer_count: 24500,
        start_time: '2026-08-31T14:00:00Z',
        thumbnail: {
          src: 'https://images.kick.com/thumb.webp',
        },
        categories: [
          { name: 'Grand Theft Auto V' },
        ],
      },
    };

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });

    const result = await fetchChannelData('xqc', mockFetch);
    expect(result.slug).toBe('xqc');
    expect(result.username).toBe('xQc');
    expect(result.avatarUrl).toBe('https://files.kick.com/images/user/676/profile.webp');
    expect(result.isLive).toBe(true);
    expect(result.title).toBe('🔴 GTA V RP STREAM');
    expect(result.category).toBe('Grand Theft Auto V');
    expect(result.viewerCount).toBe(24500);
    expect(result.thumbnailUrl).toBe('https://images.kick.com/thumb.webp');
    expect(result.error).toBeNull();
  });

  it('correctly parses an offline channel response', async () => {
    const mockApiResponse = {
      id: 668,
      slug: 'xqc',
      user: {
        username: 'xQc',
        profile_pic: 'https://files.kick.com/images/user/676/profile.webp',
      },
      livestream: null,
      recent_categories: [
        { name: 'Just Chatting' },
      ],
    };

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });

    const result = await fetchChannelData('xqc', mockFetch);
    expect(result.slug).toBe('xqc');
    expect(result.isLive).toBe(false);
    expect(result.title).toBe('');
    expect(result.category).toBe('Just Chatting');
    expect(result.viewerCount).toBe(0);
    expect(result.error).toBeNull();
  });

  it('handles 403 Cloudflare challenge cleanly', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
    });

    const result = await fetchChannelData('xqc', mockFetch);
    expect(result.slug).toBe('xqc');
    expect(result.isLive).toBe(false);
    expect(result.error).toBe('Access forbidden / Cloudflare challenge (403)');
  });

  it('handles 404 channel not found cleanly', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const result = await fetchChannelData('nonexistent_streamer_12345', mockFetch);
    expect(result.slug).toBe('nonexistent_streamer_12345');
    expect(result.isLive).toBe(false);
    expect(result.error).toBe('Channel not found (404)');
  });

  it('handles 429 rate limit exceeded cleanly', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    });

    const result = await fetchChannelData('xqc', mockFetch);
    expect(result.slug).toBe('xqc');
    expect(result.error).toBe('Rate limit exceeded (429)');
  });

  it('handles invalid response schema by returning fallback with schema error', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ unexpected_key: 12345 }),
    });

    const result = await fetchChannelData('xqc', mockFetch);
    expect(result.slug).toBe('xqc');
    expect(result.error).toBe('Invalid schema: Unrecognized Kick API response');
  });

  it('handles network failure cleanly without throwing unhandled exceptions', async () => {
    const mockFetch = async () => {
      throw new Error('Connection refused');
    };

    const result = await fetchChannelData('xqc', mockFetch);
    expect(result.slug).toBe('xqc');
    expect(result.isLive).toBe(false);
    expect(result.error).toBe('Connection refused');
  });

  describe('schema validation helpers', () => {
    it('validates correct channel schemas', () => {
      expect(validateKickChannelSchema({ slug: 'xqc', user: { username: 'xQc' } })).toBe(true);
      expect(validateKickChannelSchema({ slug: 'shroud' })).toBe(true);
    });

    it('rejects invalid or empty channel schemas', () => {
      expect(validateKickChannelSchema(null)).toBe(false);
      expect(validateKickChannelSchema(undefined)).toBe(false);
      expect(validateKickChannelSchema([])).toBe(false);
      expect(validateKickChannelSchema({})).toBe(false);
      expect(validateKickChannelSchema({ error: 'Blocked' })).toBe(false);
      expect(validateKickChannelSchema({ slug: 'xqc', user: 'invalid-string' })).toBe(false);
    });

    it('validates search response schemas', () => {
      expect(validateKickSearchSchema({ channels: [] })).toBe(true);
      expect(validateKickSearchSchema({ channels: [{ slug: 'xqc' }] })).toBe(true);
      expect(validateKickSearchSchema(null)).toBe(false);
      expect(validateKickSearchSchema({})).toBe(false);
      expect(validateKickSearchSchema({ channels: null })).toBe(false);
    });
  });

  describe('verifyApiHealth', () => {
    it('reports healthy when API returns valid channel data', async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ slug: 'kick', user: { username: 'Kick' } }),
      });

      const health = await verifyApiHealth('kick', mockFetch);
      expect(health.isHealthy).toBe(true);
      expect(health.error).toBeNull();
    });

    it('reports unhealthy when API returns 403 Cloudflare challenge', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({}),
      });

      const health = await verifyApiHealth('kick', mockFetch);
      expect(health.isHealthy).toBe(false);
      expect(health.error).toContain('403');
    });
  });

  describe('searchChannels', () => {
    it('returns empty array when query is too short or empty', async () => {
      const res = await searchChannels('x');
      expect(res).toEqual([]);
    });

    it('parses and limits search results correctly', async () => {
      const mockSearchData = {
        channels: [
          {
            slug: 'xqc',
            user: { username: 'xQc', profilePic: 'https://pic.webp' },
            isLive: false,
            followersCount: 500000,
          },
          {
            slug: 'xqcisoffline',
            user: { username: 'xqcisoffline', profilePic: '' },
            isLive: true,
            followersCount: 1200,
          },
          {
            slug: 'xqcow_fan',
            user: { username: 'xqcow_fan', profilePic: '' },
            isLive: false,
            followersCount: 50,
          },
          {
            slug: 'xqcextra',
            user: { username: 'xqcextra', profilePic: '' },
            isLive: false,
            followersCount: 10,
          },
        ],
      };

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => mockSearchData,
      });

      const results = await searchChannels('xqc', 3, mockFetch);
      expect(results.length).toBe(3);
      expect(results[0].slug).toBe('xqc');
      expect(results[0].username).toBe('xQc');
      expect(results[0].avatarUrl).toBe('https://pic.webp');
      expect(results[0].isLive).toBe(false);
      expect(results[1].slug).toBe('xqcisoffline');
      expect(results[1].isLive).toBe(true);
    });

    it('handles search network errors gracefully', async () => {
      const mockFetch = async () => {
        throw new Error('Search failed');
      };
      const results = await searchChannels('tarik', 3, mockFetch);
      expect(results).toEqual([]);
    });
  });
});
