import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { installGlobalChromeMock } from './mocks/chromeMock.js';
import {
  populateForm,
  updateCircuitDisplay,
  showToast,
  bindOptionEvents,
  initOptions,
} from '../src/options/options.js';
import {
  getSettings,
  updateSettings,
  clearStorage,
  DEFAULT_SETTINGS,
} from '../src/services/storageService.js';
import {
  recordFailure,
  resetCircuit,
} from '../src/services/circuitBreaker.js';

function createMockElement(id, initial = {}) {
  const listeners = {};
  const classSet = new Set();
  if (initial.className) {
    initial.className.split(' ').forEach((c) => c && classSet.add(c));
  }
  return {
    id,
    value: initial.value ?? '',
    checked: Boolean(initial.checked),
    textContent: initial.textContent ?? '',
    className: initial.className ?? '',
    classList: {
      add(c) { classSet.add(c); },
      remove(c) { classSet.delete(c); },
      contains(c) { return classSet.has(c); },
    },
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    async dispatchEvent(event, data = {}) {
      if (listeners[event]) {
        for (const fn of listeners[event]) {
          await fn({ target: this, ...data });
        }
      }
    },
  };
}

describe('options page', () => {
  let chromeMock;
  let elements;
  let originalDocument;
  let originalWindow;

  beforeEach(async () => {
    chromeMock = installGlobalChromeMock();
    await clearStorage();
    resetCircuit();

    elements = {
      checkIntervalSelect: createMockElement('checkIntervalSelect', { value: '2' }),
      sortBySelect: createMockElement('sortBySelect', { value: 'viewers' }),
      uiScaleSelect: createMockElement('uiScaleSelect', { value: '100' }),
      badgeToggle: createMockElement('badgeToggle', { checked: true }),
      notificationsToggle: createMockElement('notificationsToggle', { checked: true }),
      debugLoggingToggle: createMockElement('debugLoggingToggle', { checked: false }),
      circuitStatusBadge: createMockElement('circuitStatusBadge'),
      circuitStatusText: createMockElement('circuitStatusText'),
      resetCircuitBtn: createMockElement('resetCircuitBtn'),
      testNotifBtn: createMockElement('testNotifBtn'),
      resetDefaultsBtn: createMockElement('resetDefaultsBtn'),
      clearDataBtn: createMockElement('clearDataBtn'),
      toast: createMockElement('toast'),
    };

    originalDocument = globalThis.document;
    originalWindow = globalThis.window;

    globalThis.document = {
      getElementById(id) {
        return elements[id] || null;
      },
      addEventListener() {},
    };

    globalThis.window = {
      confirm: () => true,
    };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  });

  it('populates form with default settings', async () => {
    await populateForm();
    expect(elements.checkIntervalSelect.value).toBe('2');
    expect(elements.sortBySelect.value).toBe('viewers');
    expect(elements.uiScaleSelect.value).toBe('100');
    expect(elements.badgeToggle.checked).toBe(true);
    expect(elements.notificationsToggle.checked).toBe(true);
    expect(elements.debugLoggingToggle.checked).toBe(false);
  });

  it('populates form with custom settings from storage', async () => {
    await updateSettings({
      checkIntervalMinutes: 10,
      sortBy: 'alphabetical',
      uiScale: '120',
      badgeEnabled: false,
      notificationsEnabled: false,
      debugLogging: true,
    });

    await populateForm();
    expect(elements.checkIntervalSelect.value).toBe('10');
    expect(elements.sortBySelect.value).toBe('alphabetical');
    expect(elements.uiScaleSelect.value).toBe('120');
    expect(elements.badgeToggle.checked).toBe(false);
    expect(elements.notificationsToggle.checked).toBe(false);
    expect(elements.debugLoggingToggle.checked).toBe(true);
  });

  it('updates circuit status display for operational and throttled states', () => {
    updateCircuitDisplay();
    expect(elements.circuitStatusText.textContent).toBe('Operational');
    expect(elements.circuitStatusBadge.className).toBe('status-badge status-closed');

    recordFailure('429 Rate limited');
    recordFailure('429 Rate limited');
    recordFailure('429 Rate limited');

    updateCircuitDisplay();
    expect(elements.circuitStatusBadge.className).toBe('status-badge status-open');
    expect(elements.circuitStatusText.textContent).toContain('Throttled');

    const realNow = Date.now;
    Date.now = () => realNow() + 10 * 60 * 1000;
    try {
      updateCircuitDisplay();
      expect(elements.circuitStatusBadge.className).toBe('status-badge status-open');
      expect(elements.circuitStatusText.textContent).toBe('Testing Canary');
    } finally {
      Date.now = realNow;
    }
  });

  it('shows toast notification with provided message and replaces active timeout', () => {
    showToast('First toast');
    showToast('Preferences updated');
    expect(elements.toast.textContent).toBe('Preferences updated');
    expect(elements.toast.classList.contains('visible')).toBe(true);
  });

  it('persists checkIntervalSelect change and notifies background', async () => {
    bindOptionEvents();
    elements.checkIntervalSelect.value = '5';
    await elements.checkIntervalSelect.dispatchEvent('change');

    const updated = await getSettings();
    expect(updated.checkIntervalMinutes).toBe(5);
    expect(elements.toast.textContent).toBe('Poll interval updated');
  });

  it('persists sortBySelect change', async () => {
    bindOptionEvents();
    elements.sortBySelect.value = 'uptime';
    await elements.sortBySelect.dispatchEvent('change');

    const updated = await getSettings();
    expect(updated.sortBy).toBe('uptime');
    expect(elements.toast.textContent).toBe('Sort order saved');
  });

  it('persists uiScaleSelect change', async () => {
    bindOptionEvents();
    elements.uiScaleSelect.value = '130';
    await elements.uiScaleSelect.dispatchEvent('change');

    const updated = await getSettings();
    expect(updated.uiScale).toBe('130');
    expect(elements.toast.textContent).toBe('UI scale saved');
  });

  it('persists badgeToggle change', async () => {
    bindOptionEvents();
    elements.badgeToggle.checked = false;
    await elements.badgeToggle.dispatchEvent('change');

    const updated = await getSettings();
    expect(updated.badgeEnabled).toBe(false);
    expect(elements.toast.textContent).toBe('Badge counter toggled');
  });

  it('persists notificationsToggle change', async () => {
    bindOptionEvents();
    elements.notificationsToggle.checked = false;
    await elements.notificationsToggle.dispatchEvent('change');

    const updated = await getSettings();
    expect(updated.notificationsEnabled).toBe(false);
    expect(elements.toast.textContent).toBe('Notification preference saved');
  });

  it('persists debugLoggingToggle change', async () => {
    bindOptionEvents();
    elements.debugLoggingToggle.checked = true;
    await elements.debugLoggingToggle.dispatchEvent('change');

    const updated = await getSettings();
    expect(updated.debugLogging).toBe(true);
    expect(elements.toast.textContent).toBe('Debug logging updated');
  });

  it('resets circuit on resetCircuitBtn click', async () => {
    recordFailure('500 Server error');
    recordFailure('500 Server error');
    recordFailure('500 Server error');

    bindOptionEvents();
    await elements.resetCircuitBtn.dispatchEvent('click');

    expect(elements.toast.textContent).toBe('Circuit breaker reset');
    expect(elements.circuitStatusText.textContent).toBe('Operational');
  });

  it('triggers test alert on testNotifBtn click', async () => {
    bindOptionEvents();
    await elements.testNotifBtn.dispatchEvent('click');
    expect(elements.toast.textContent).toBe('Test notification sent');
  });

  it('resets settings to defaults on resetDefaultsBtn click', async () => {
    await updateSettings({ checkIntervalMinutes: 15, sortBy: 'uptime' });
    bindOptionEvents();

    await elements.resetDefaultsBtn.dispatchEvent('click');

    const current = await getSettings();
    expect(current.checkIntervalMinutes).toBe(DEFAULT_SETTINGS.checkIntervalMinutes);
    expect(current.sortBy).toBe(DEFAULT_SETTINGS.sortBy);
    expect(elements.toast.textContent).toBe('Settings reset to default');
  });

  it('clears storage data on clearDataBtn click when confirmed', async () => {
    await updateSettings({ checkIntervalMinutes: 15 });
    bindOptionEvents();

    await elements.clearDataBtn.dispatchEvent('click');

    const current = await getSettings();
    expect(current.checkIntervalMinutes).toBe(DEFAULT_SETTINGS.checkIntervalMinutes);
    expect(elements.toast.textContent).toBe('All storage data cleared');
  });

  it('aborts clear data if user cancels confirmation', async () => {
    globalThis.window.confirm = () => false;
    await updateSettings({ checkIntervalMinutes: 15 });
    bindOptionEvents();

    await elements.clearDataBtn.dispatchEvent('click');

    const current = await getSettings();
    expect(current.checkIntervalMinutes).toBe(15);
  });

  it('runs initOptions seamlessly', async () => {
    await initOptions();
    expect(elements.checkIntervalSelect.value).toBe('2');
  });

  it('handles background notification failure gracefully', async () => {
    chromeMock.runtime.sendMessage = () => Promise.reject(new Error('Background unreachable'));
    bindOptionEvents();
    elements.checkIntervalSelect.value = '15';
    await elements.checkIntervalSelect.dispatchEvent('change');
    expect(elements.toast.textContent).toBe('Poll interval updated');
  });
});
