import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { installGlobalChromeMock } from './mocks/chromeMock.js';
import { logDebug } from '../src/utils/logger.js';
import { updateSettings, clearStorage } from '../src/services/storageService.js';

describe('logger', () => {
  let logged = [];
  const originalLog = console.log;

  beforeEach(async () => {
    installGlobalChromeMock();
    await clearStorage();
    logged = [];
    console.log = (...args) => logged.push(args);
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('suppresses log output when debugLogging is false', async () => {
    await updateSettings({ debugLogging: false });
    await logDebug('TestEvent', { foo: 'bar' });
    expect(logged.length).toBe(0);
  });

  it('prints formatted log output when debugLogging is true', async () => {
    await updateSettings({ debugLogging: true });
    await logDebug('TestEvent', { foo: 'bar' });
    expect(logged.length).toBe(1);
    expect(logged[0][0]).toContain('[StreamerMonitor');
    expect(logged[0][0]).toContain('TestEvent');
    expect(logged[0][1]).toEqual({ foo: 'bar' });
  });
});
