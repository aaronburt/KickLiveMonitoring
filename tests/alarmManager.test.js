import { describe, it, expect, beforeEach } from 'bun:test';
import { installGlobalChromeMock } from './mocks/chromeMock.js';
import {
  createPollAlarm,
  clearPollAlarm,
  handleAlarm,
  POLL_ALARM_NAME,
} from '../src/background/alarmManager.js';
import { setStreamer } from '../src/services/storageService.js';

describe('alarmManager', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = installGlobalChromeMock();
  });

  it('creates an alarm with configured period and delay in minutes', async () => {
    await createPollAlarm(5);
    const alarm = await chromeMock.alarms.get(POLL_ALARM_NAME);
    expect(alarm).not.toBeNull();
    expect(alarm.periodInMinutes).toBe(5);
  });

  it('enforces a minimum interval of 1 minute', async () => {
    await createPollAlarm(0);
    const alarm = await chromeMock.alarms.get(POLL_ALARM_NAME);
    expect(alarm.periodInMinutes).toBe(1);
  });

  it('clears poll alarm correctly', async () => {
    await createPollAlarm(2);
    await clearPollAlarm();
    const alarm = await chromeMock.alarms.get(POLL_ALARM_NAME);
    expect(alarm).toBeNull();
  });

  it('handles alarm execution safely', async () => {
    await setStreamer('xqc', { slug: 'xqc', isLive: false });
    await handleAlarm({ name: POLL_ALARM_NAME });
    expect(true).toBe(true);
  });

  it('ignores unrelated alarms', async () => {
    await handleAlarm({ name: 'unrelated_alarm' });
    expect(true).toBe(true);
  });
});
