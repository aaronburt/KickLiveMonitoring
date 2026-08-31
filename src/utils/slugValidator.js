export function normalizeSlug(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return '';
  let cleaned = rawInput.trim().replace(/^@/, '');
  try {
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      cleaned = new URL(cleaned).pathname.split('/').filter(Boolean)[0] || '';
    } else if (/kick\.com\//i.test(cleaned)) {
      cleaned = cleaned.split(/kick\.com\//i)[1]?.split(/[/?#]/)[0] || '';
    }
  } catch {
    cleaned = cleaned.replace(/^https?:\/\//i, '');
  }
  return cleaned.replace(/^@/, '').trim().toLowerCase();
}

export function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9_]{1,40}$/.test(slug);
}

export function validateSlug(rawInput) {
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    return { isValid: false, slug: '', error: 'Streamer name or URL cannot be empty.' };
  }
  const slug = normalizeSlug(rawInput);
  if (!slug) {
    return { isValid: false, slug: '', error: 'Invalid channel slug or URL.' };
  }
  if (!isValidSlug(slug)) {
    return { isValid: false, slug, error: 'Channel slug may only contain letters, numbers, and underscores.' };
  }
  return { isValid: true, slug, error: null };
}
