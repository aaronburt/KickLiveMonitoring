export function formatViewerCount(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1000) return String(Math.floor(n));
  if (n < 1000000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.floor(k) : k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function formatStreamDuration(startTime, now = Date.now()) {
  if (!startTime) return '';
  const start = new Date(startTime).getTime();
  if (Number.isNaN(start)) return '';
  const diffSec = Math.max(0, Math.floor(((typeof now === 'number' ? now : new Date(now).getTime()) - start) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatRelativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return 'Never';
  const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (Number.isNaN(ts)) return 'Never';
  const diffSec = Math.max(0, Math.floor(((typeof now === 'number' ? now : new Date(now).getTime()) - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
