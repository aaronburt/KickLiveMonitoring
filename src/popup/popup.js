import {
  addNewStreamer,
  removeTrackedStreamer,
  checkAllStreamers,
} from '../services/streamerTracker.js';
import {
  getStreamers,
  getSettings,
  updateSettings,
} from '../services/storageService.js';
import {
  formatViewerCount,
  formatRelativeTime,
  formatStreamDuration,
  escapeHtml,
} from '../utils/formatters.js';
import { validateSlug } from '../utils/slugValidator.js';
import { searchChannels } from '../services/kickApi.js';

const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%238A939B%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%228%22%20r%3D%224%22%2F%3E%3Cpath%20d%3D%22M4%2020c0-4%204-6%208-6s8%202%208%206%22%2F%3E%3C%2Fsvg%3E';

let state = {
  streamers: {},
  settings: {},
  filter: 'all',
};

function showFeedback(msg, type = 'error') {
  const el = document.getElementById('formFeedback');
  if (!el) return;
  el.textContent = msg;
  el.className = `feedback-banner ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function updateCounters() {
  const list = Object.values(state.streamers);
  const liveCount = list.filter((s) => s.isLive).length;
  const offlineCount = list.length - liveCount;

  const countAll = document.getElementById('countAll');
  if (countAll) countAll.textContent = String(list.length);
  const countLive = document.getElementById('countLive');
  if (countLive) countLive.textContent = String(liveCount);
  const countOffline = document.getElementById('countOffline');
  if (countOffline) countOffline.textContent = String(offlineCount);

  const headerLiveCounter = document.getElementById('headerLiveCounter') || document.getElementById('headerLiveCount');
  if (headerLiveCounter) {
    headerLiveCounter.textContent = `${liveCount} Live`;
    if (liveCount > 0) {
      headerLiveCounter.classList.add('has-live');
    } else {
      headerLiveCounter.classList.remove('has-live');
    }
  }
}

function renderList() {
  const container = document.getElementById('streamersList');
  if (!container) return;

  const list = Object.values(state.streamers);
  const sortBy = state.settings?.sortBy || 'viewers';
  const filtered = list.filter((s) => {
    if (state.filter === 'live') return s.isLive;
    if (state.filter === 'offline') return !s.isLive;
    return true;
  }).sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    if (sortBy === 'alphabetical') {
      return (a.username || a.slug).localeCompare(b.username || b.slug);
    }
    if (sortBy === 'uptime') {
      const aStart = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bStart = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return aStart - bStart;
    }
    if (sortBy === 'recent') {
      return (b.lastCheckedAt || 0) - (a.lastCheckedAt || 0);
    }
    if (a.isLive && b.isLive) {
      const diff = (b.viewerCount || 0) - (a.viewerCount || 0);
      if (diff !== 0) return diff;
    }
    return (a.username || a.slug).localeCompare(b.username || b.slug);
  });

  if (filtered.length === 0) {
    const msg = state.filter === 'all'
      ? 'No streamers added yet. Track your first creator above!'
      : state.filter === 'live'
      ? 'No tracked streamers are currently live.'
      : 'No tracked streamers are offline.';
    container.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p class="empty-title">Nothing to show</p>
        <p class="empty-subtitle">${msg}</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  for (const s of filtered) {
    const card = document.createElement('div');
    card.className = `streamer-card ${s.isLive ? 'is-live' : ''}`;
    card.dataset.slug = s.slug;

    const avatar = s.avatarUrl || DEFAULT_AVATAR;
    const name = escapeHtml(s.username || s.slug);
    const badge = s.isLive
      ? `<span class="badge-live">LIVE &bull; ${formatViewerCount(s.viewerCount)}</span>`
      : `<span class="badge-offline">${s.error ? 'Error' : 'Offline'}</span>`;

    const duration = s.isLive && s.startedAt ? formatStreamDuration(s.startedAt) : '';
    const details = s.isLive
      ? `<div class="card-bottom-row">
           <span class="category-tag">${escapeHtml(s.category || 'Kick')}</span>
           ${duration ? `<span class="stream-uptime" title="Stream uptime">${duration}</span>` : ''}
         </div>`
      : `<div class="card-bottom-row">
           <span class="offline-time">${s.lastCheckedAt ? `Checked ${formatRelativeTime(s.lastCheckedAt)}` : 'Offline'}</span>
         </div>`;

    card.innerHTML = `
      <div class="avatar-wrapper">
        <img class="avatar-img" src="${avatar}" alt="${name}">
        ${s.isLive ? '<div class="live-indicator-dot"></div>' : ''}
      </div>
      <div class="card-details">
        <div class="card-top-row"><span class="streamer-name">${name}</span>${badge}</div>
        ${details}
      </div>
      <div class="card-actions">
        <button class="action-btn delete-btn" data-action="delete" data-slug="${s.slug}" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>`;

    const avatarImg = card.querySelector('.avatar-img');
    if (avatarImg) {
      avatarImg.addEventListener('error', () => {
        avatarImg.src = DEFAULT_AVATAR;
      }, { once: true });
    }

    container.appendChild(card);
  }
}

async function refreshData() {
  state.streamers = await getStreamers();
  renderList();
  updateCounters();
}

function bindEvents() {
  const input = document.getElementById('streamerInput');
  const dropdown = document.getElementById('searchDropdown');
  let searchDebounce = null;

  input?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = input.value.trim().replace(/^@/, '');
    if (q.length < 2) {
      if (dropdown) dropdown.classList.add('hidden');
      return;
    }

    searchDebounce = setTimeout(async () => {
      const results = await searchChannels(q, 3);
      if (!dropdown) return;
      if (results.length === 0) {
        dropdown.classList.add('hidden');
        return;
      }

      dropdown.innerHTML = '';
      results.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'search-item';
        const avatar = item.avatarUrl || DEFAULT_AVATAR;
        const name = escapeHtml(item.username || item.slug);
        const livePill = item.isLive ? '<span class="search-live-badge">LIVE</span>' : '';
        row.innerHTML = `
          <img class="search-avatar" src="${avatar}" alt="${name}">
          <div class="search-info">
            <span class="search-name">${name}</span>
            <span class="search-slug">@${escapeHtml(item.slug)}</span>
          </div>
          ${livePill}
        `;

        const rowImg = row.querySelector('.search-avatar');
        if (rowImg) {
          rowImg.addEventListener('error', () => {
            rowImg.src = DEFAULT_AVATAR;
          }, { once: true });
        }

        row.addEventListener('click', () => {
          dropdown.classList.add('hidden');
          input.value = item.slug;
          document.getElementById('addStreamerButton')?.click();
        });
        dropdown.appendChild(row);
      });
      dropdown.classList.remove('hidden');
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-wrapper')) {
      dropdown?.classList.add('hidden');
    }
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown?.classList.add('hidden');
    }
  });

  document.getElementById('addStreamerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (dropdown) dropdown.classList.add('hidden');
    const val = input?.value?.trim();
    if (!val) return;
    const res = await addNewStreamer(val);
    if (!res.success) {
      showFeedback(res.error || 'Failed to add streamer', 'error');
    } else {
      showFeedback(`Added ${res.streamer?.username || val}!`, 'success');
      if (input) input.value = '';
      await refreshData();
    }
  });

  document.getElementById('streamersList')?.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-action="delete"]');
    if (del?.dataset.slug) {
      e.stopPropagation();
      await removeTrackedStreamer(del.dataset.slug);
      await refreshData();
      showFeedback(`Removed ${del.dataset.slug}`, 'success');
      return;
    }
    const card = e.target.closest('.streamer-card');
    if (card?.dataset.slug) {
      const url = `https://kick.com/${card.dataset.slug}`;
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url, active: true });
      } else {
        window.open(url, '_blank');
      }
    }
  });

  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.filter = tab.dataset.filter || 'all';
      renderList();
    });
  });

  document.getElementById('popoutButton')?.addEventListener('click', () => {
    const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('src/popup/index.html?popout=1')
      : 'index.html?popout=1';

    if (typeof chrome !== 'undefined' && chrome.windows?.create) {
      chrome.windows.create({
        url,
        type: 'popup',
        width: 380,
        height: 600,
        focused: true,
      });
      window.close?.();
    } else {
      window.open(url, 'KickMonitorPopout', 'width=380,height=600,menubar=no,toolbar=no,location=no');
      window.close?.();
    }
  });

  document.getElementById('refreshButton')?.addEventListener('click', async () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await new Promise((r) => chrome.runtime.sendMessage({ type: 'REFRESH_ALL' }, r));
    } else {
      await checkAllStreamers();
    }
    await refreshData();
    const timeEl = document.getElementById('lastUpdatedTime');
    if (timeEl) {
      const d = new Date();
      timeEl.textContent = `Updated ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }
  });

  document.getElementById('settingsToggle')?.addEventListener('click', () => {
    document.getElementById('settingsPanel')?.classList.toggle('hidden');
  });
  document.getElementById('settingsClose')?.addEventListener('click', () => {
    document.getElementById('settingsPanel')?.classList.add('hidden');
  });

  document.getElementById('checkIntervalSelect')?.addEventListener('change', async (e) => {
    const mins = Number(e.target.value) || 2;
    await updateSettings({ checkIntervalMinutes: mins });
    chrome?.runtime?.sendMessage?.({ type: 'UPDATE_SETTINGS', payload: { checkIntervalMinutes: mins } });
  });

  document.getElementById('sortBySelect')?.addEventListener('change', async (e) => {
    const val = e.target.value;
    state.settings.sortBy = val;
    await updateSettings({ sortBy: val });
    renderList();
  });

  document.getElementById('notificationsToggle')?.addEventListener('change', async (e) => {
    await updateSettings({ notificationsEnabled: e.target.checked });
  });

  document.getElementById('soundToggle')?.addEventListener('change', async (e) => {
    await updateSettings({ soundEnabled: e.target.checked });
  });

  document.getElementById('debugLoggingToggle')?.addEventListener('change', async (e) => {
    await updateSettings({ debugLogging: e.target.checked });
  });

  document.getElementById('debugLiveNotifBtn')?.addEventListener('click', async () => {
    const list = Object.values(state.streamers);
    const mock = list[0]
      ? {
          ...list[0],
          title: `🔴 [DEBUG ALERT] ${list[0].title || 'Live Broadcast Test'}`,
        }
      : {
          slug: 'xqc',
          username: 'xQc',
          title: '🔴 [DEBUG ALERT] 24H Special Stream',
          category: 'Just Chatting',
          viewerCount: 42500,
        };

    const id = `kick_live_${mock.slug}_${Date.now()}`;
    const iconUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('assets/icons/icon-128.png')
      : 'assets/icons/icon-128.png';

    if (typeof chrome !== 'undefined' && chrome.notifications?.create) {
      chrome.notifications.create(
        id,
        {
          type: 'basic',
          iconUrl,
          title: `${mock.username} is live on Kick!`,
          message: `${mock.title}\nCategory: ${mock.category || 'Kick'}`,
          contextMessage: `Viewers: ${formatViewerCount(mock.viewerCount || 0)}`,
          priority: 2,
        },
        (createdId) => {
          if (chrome.runtime?.lastError) {
            showFeedback(chrome.runtime.lastError.message || 'Notification error', 'error');
          } else {
            showFeedback('Test notification sent!', 'success');
          }
        },
      );
    } else {
      showFeedback('Test notification sent (mock mode)!', 'success');
    }
  });

  document.getElementById('privacyLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('src/privacy/privacy.html')
      : '../privacy/privacy.html';
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  });
}

export function checkActiveKickTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeUrl = tabs?.[0]?.url;
    if (!activeUrl || !activeUrl.includes('kick.com')) return;

    const validation = validateSlug(activeUrl);
    const reserved = ['categories', 'following', 'browse', 'privacy', 'terms', 'community-guidelines', 'video', 'search'];
    if (!validation.isValid || reserved.includes(validation.slug)) return;

    const isAlreadyTracked = Boolean(state.streamers[validation.slug]);
    const input = document.getElementById('streamerInput');
    if (input && !isAlreadyTracked && !input.value) {
      input.value = validation.slug;
    }
  });
}

export async function init() {
  const [streamers, settings] = await Promise.all([getStreamers(), getSettings()]);
  state.streamers = streamers;
  state.settings = settings;

  const intSelect = document.getElementById('checkIntervalSelect');
  if (intSelect && settings.checkIntervalMinutes) intSelect.value = String(settings.checkIntervalMinutes);
  const sortSelect = document.getElementById('sortBySelect');
  if (sortSelect && settings.sortBy) sortSelect.value = settings.sortBy;
  const notifToggle = document.getElementById('notificationsToggle');
  if (notifToggle) notifToggle.checked = Boolean(settings.notificationsEnabled);
  const soundToggle = document.getElementById('soundToggle');
  if (soundToggle) soundToggle.checked = Boolean(settings.soundEnabled);
  const debugToggle = document.getElementById('debugLoggingToggle');
  if (debugToggle) debugToggle.checked = Boolean(settings.debugLogging);

  renderList();
  updateCounters();
  bindEvents();
  checkActiveKickTab();

  if (typeof window !== 'undefined' && (window.location?.search?.includes('popout=1') || window.innerWidth > 400)) {
    document.body.classList.add('popout-mode');
    document.getElementById('popoutButton')?.classList.add('hidden');
  }

  setInterval(() => {
    const list = Object.values(state.streamers);
    if (list.some((s) => s.isLive)) {
      renderList();
    }
  }, 30000);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
