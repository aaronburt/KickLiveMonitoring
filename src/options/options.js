import {
  getSettings,
  updateSettings,
  clearStorage,
  DEFAULT_SETTINGS,
} from '../services/storageService.js';
import {
  getCircuitStatus,
  resetCircuit,
} from '../services/circuitBreaker.js';

let toastTimeout = null;

export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2200);
}

export function updateCircuitDisplay() {
  const badge = document.getElementById('circuitStatusBadge');
  const text = document.getElementById('circuitStatusText');
  if (!badge || !text) return;

  const status = getCircuitStatus();
  if (status.state === 'OPEN') {
    const remainingSeconds = Math.max(0, Math.ceil((status.cooldownUntil - Date.now()) / 1000));
    badge.className = 'status-badge status-open';
    text.textContent = `Throttled (${remainingSeconds}s cooldown)`;
  } else if (status.state === 'HALF_OPEN') {
    badge.className = 'status-badge status-open';
    text.textContent = 'Testing Canary';
  } else {
    badge.className = 'status-badge status-closed';
    text.textContent = 'Operational';
  }
}

export async function populateForm() {
  const settings = await getSettings();

  const checkIntervalSelect = document.getElementById('checkIntervalSelect');
  if (checkIntervalSelect) {
    checkIntervalSelect.value = String(settings.checkIntervalMinutes || 2);
  }

  const sortBySelect = document.getElementById('sortBySelect');
  if (sortBySelect) {
    sortBySelect.value = settings.sortBy || 'viewers';
  }

  const uiScaleSelect = document.getElementById('uiScaleSelect');
  if (uiScaleSelect) {
    uiScaleSelect.value = settings.uiScale || '100';
  }

  const badgeToggle = document.getElementById('badgeToggle');
  if (badgeToggle) {
    badgeToggle.checked = Boolean(settings.badgeEnabled);
  }

  const notificationsToggle = document.getElementById('notificationsToggle');
  if (notificationsToggle) {
    notificationsToggle.checked = Boolean(settings.notificationsEnabled);
  }

  const debugLoggingToggle = document.getElementById('debugLoggingToggle');
  if (debugLoggingToggle) {
    debugLoggingToggle.checked = Boolean(settings.debugLogging);
  }

  updateCircuitDisplay();
}

async function notifyBackground(type, payload) {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      return await chrome.runtime.sendMessage({ type, payload });
    } catch {
      return null;
    }
  }
  return null;
}

export function bindOptionEvents() {
  document.getElementById('checkIntervalSelect')?.addEventListener('change', async (e) => {
    const checkIntervalMinutes = Number(e.target.value);
    await updateSettings({ checkIntervalMinutes });
    await notifyBackground('UPDATE_SETTINGS', { checkIntervalMinutes });
    showToast('Poll interval updated');
  });

  document.getElementById('sortBySelect')?.addEventListener('change', async (e) => {
    await updateSettings({ sortBy: e.target.value });
    showToast('Sort order saved');
  });

  document.getElementById('uiScaleSelect')?.addEventListener('change', async (e) => {
    await updateSettings({ uiScale: e.target.value });
    showToast('UI scale saved');
  });

  document.getElementById('badgeToggle')?.addEventListener('change', async (e) => {
    const badgeEnabled = e.target.checked;
    await updateSettings({ badgeEnabled });
    await notifyBackground('UPDATE_SETTINGS', { badgeEnabled });
    await notifyBackground('SYNC_BADGE');
    showToast('Badge counter toggled');
  });

  document.getElementById('notificationsToggle')?.addEventListener('change', async (e) => {
    const notificationsEnabled = e.target.checked;
    await updateSettings({ notificationsEnabled });
    await notifyBackground('UPDATE_SETTINGS', { notificationsEnabled });
    showToast('Notification preference saved');
  });

  document.getElementById('debugLoggingToggle')?.addEventListener('change', async (e) => {
    const debugLogging = e.target.checked;
    await updateSettings({ debugLogging });
    await notifyBackground('UPDATE_SETTINGS', { debugLogging });
    showToast('Debug logging updated');
  });

  document.getElementById('resetCircuitBtn')?.addEventListener('click', async () => {
    resetCircuit();
    await notifyBackground('RESET_CIRCUIT');
    updateCircuitDisplay();
    showToast('Circuit breaker reset');
  });

  document.getElementById('testNotifBtn')?.addEventListener('click', async () => {
    const mock = {
      slug: 'xqc',
      username: 'xQc',
      title: '🔴 Special Stream',
      category: 'Just Chatting',
      viewerCount: 45000,
    };
    await notifyBackground('TRIGGER_TEST_NOTIFICATION', mock);
    showToast('Test notification sent');
  });

  document.getElementById('resetDefaultsBtn')?.addEventListener('click', async () => {
    await updateSettings(DEFAULT_SETTINGS);
    await notifyBackground('UPDATE_SETTINGS', DEFAULT_SETTINGS);
    await populateForm();
    showToast('Settings reset to default');
  });

  document.getElementById('clearDataBtn')?.addEventListener('click', async () => {
    const confirmed = window.confirm('Are you sure you want to delete all saved streamers and reset options?');
    if (!confirmed) return;
    await clearStorage();
    await populateForm();
    await notifyBackground('SYNC_BADGE');
    showToast('All storage data cleared');
  });
}

export async function initOptions() {
  await populateForm();
  bindOptionEvents();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initOptions);
}
