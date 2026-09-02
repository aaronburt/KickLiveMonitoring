const BASE_URL = 'https://kick.com/api/v2/channels';
const SEARCH_URL = 'https://kick.com/api/search';

export function validateKickChannelSchema(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  const hasIdentifier =
    (typeof data.slug === 'string' && data.slug.length > 0) ||
    (data.user && typeof data.user.username === 'string');

  if (!hasIdentifier) {
    return false;
  }

  if (data.user !== undefined && data.user !== null && typeof data.user !== 'object') {
    return false;
  }

  if (data.livestream !== undefined && data.livestream !== null && typeof data.livestream !== 'object') {
    return false;
  }

  return true;
}

export function validateKickSearchSchema(data) {
  return Boolean(data && typeof data === 'object' && Array.isArray(data.channels));
}

function fallback(slug, error = null) {
  return {
    slug,
    username: slug,
    avatarUrl: '',
    isLive: false,
    title: '',
    category: '',
    viewerCount: 0,
    thumbnailUrl: '',
    startedAt: null,
    lastCheckedAt: Date.now(),
    error,
  };
}

export async function fetchChannelData(rawSlug, customFetch = fetch) {
  const slug = typeof rawSlug === 'string' ? rawSlug.trim().toLowerCase() : '';
  if (!slug) return fallback('', 'Channel slug is required');

  try {
    const res = await customFetch(`${BASE_URL}/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
    });

    if (res.status === 403) return fallback(slug, 'Access forbidden / Cloudflare challenge (403)');
    if (res.status === 404) return fallback(slug, 'Channel not found (404)');
    if (res.status === 429) return fallback(slug, 'Rate limit exceeded (429)');
    if (!res.ok) return fallback(slug, `HTTP error ${res.status}`);

    const data = await res.json();
    if (!validateKickChannelSchema(data)) {
      return fallback(slug, 'Invalid schema: Unrecognized Kick API response');
    }

    const livestream = data.livestream;
    const isLive = Boolean(livestream && livestream.is_live !== false);
    const category = livestream?.categories?.[0]?.name
      || data.recent_categories?.[0]?.name
      || '';

    return {
      slug: (data.slug || slug).toLowerCase(),
      username: data.user?.username || data.slug || slug,
      avatarUrl: data.user?.profile_pic || data.user?.profilepic || '',
      isLive,
      title: livestream?.session_title || '',
      category,
      viewerCount: typeof livestream?.viewer_count === 'number' ? livestream.viewer_count : 0,
      thumbnailUrl: livestream?.thumbnail?.src || livestream?.thumbnail?.url || '',
      startedAt: livestream?.start_time || livestream?.created_at || null,
      lastCheckedAt: Date.now(),
      error: null,
    };
  } catch (err) {
    return fallback(slug, err instanceof Error ? err.message : 'Network request failed');
  }
}

export async function searchChannels(query, limit = 3, customFetch = fetch) {
  const term = typeof query === 'string' ? query.trim().replace(/^@/, '') : '';
  if (term.length < 2) return [];

  try {
    const res = await customFetch(`${SEARCH_URL}?searched_word=${encodeURIComponent(term)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!validateKickSearchSchema(data)) return [];
    const channels = data.channels;
    return channels.slice(0, limit).map((c) => ({
      slug: (c.slug || '').toLowerCase(),
      username: c.user?.username || c.slug || '',
      avatarUrl: c.user?.profilePic || c.user?.profile_pic || '',
      isLive: Boolean(c.isLive),
      followersCount: c.followersCount || c.followers_count || 0,
    }));
  } catch {
    return [];
  }
}

export async function verifyApiHealth(sampleSlug = 'kick', customFetch = fetch) {
  const result = await fetchChannelData(sampleSlug, customFetch);
  const isHealthy = !result.error || result.error.includes('404');
  return {
    isHealthy,
    error: isHealthy ? null : result.error,
  };
}
