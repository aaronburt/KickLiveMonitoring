import { describe, it, expect, beforeEach } from 'bun:test';
import {
  CIRCUIT_STATES,
  FAILURE_THRESHOLD,
  BACKOFF_INTERVALS_MS,
  getCircuitStatus,
  canExecute,
  recordSuccess,
  recordFailure,
  resetCircuit,
  isSystemicApiError,
} from '../src/services/circuitBreaker.js';

describe('circuitBreaker', () => {
  beforeEach(() => {
    resetCircuit();
  });

  it('starts in CLOSED state with zero failures', () => {
    const status = getCircuitStatus();
    expect(status.state).toBe(CIRCUIT_STATES.CLOSED);
    expect(status.consecutiveFailures).toBe(0);
    expect(status.cooldownUntil).toBe(0);
    expect(status.lastError).toBeNull();
    expect(canExecute()).toBe(true);
  });

  it('tracks failures without opening circuit until threshold is reached', () => {
    recordFailure('HTTP 500');
    expect(getCircuitStatus().consecutiveFailures).toBe(1);
    expect(getCircuitStatus().state).toBe(CIRCUIT_STATES.CLOSED);
    expect(canExecute()).toBe(true);

    recordFailure('HTTP 502');
    expect(getCircuitStatus().consecutiveFailures).toBe(2);
    expect(getCircuitStatus().state).toBe(CIRCUIT_STATES.CLOSED);
    expect(canExecute()).toBe(true);
  });

  it('trips to OPEN state when failure threshold is reached', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      recordFailure('Cloudflare 403');
    }

    const status = getCircuitStatus();
    expect(status.state).toBe(CIRCUIT_STATES.OPEN);
    expect(status.consecutiveFailures).toBe(FAILURE_THRESHOLD);
    expect(status.cooldownUntil).toBeGreaterThan(Date.now());
    expect(status.lastError).toBe('Cloudflare 403');
    expect(canExecute()).toBe(false);
  });

  it('increases backoff duration for higher consecutive failures', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      recordFailure('Rate limited (429)');
    }
    const firstCooldownDuration = getCircuitStatus().cooldownUntil - Date.now();
    expect(firstCooldownDuration).toBeGreaterThanOrEqual(BACKOFF_INTERVALS_MS[0] - 100);

    recordFailure('Rate limited (429)');
    const secondCooldownDuration = getCircuitStatus().cooldownUntil - Date.now();
    expect(secondCooldownDuration).toBeGreaterThanOrEqual(BACKOFF_INTERVALS_MS[1] - 100);
  });

  it('recovers to CLOSED state on recordSuccess', () => {
    recordFailure('Failure 1');
    recordFailure('Failure 2');
    recordSuccess();

    const status = getCircuitStatus();
    expect(status.state).toBe(CIRCUIT_STATES.CLOSED);
    expect(status.consecutiveFailures).toBe(0);
    expect(status.lastError).toBeNull();
    expect(canExecute()).toBe(true);
  });

  it('allows manual reset of circuit state', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      recordFailure('Critical error');
    }
    expect(canExecute()).toBe(false);

    resetCircuit();
    const status = getCircuitStatus();
    expect(status.state).toBe(CIRCUIT_STATES.CLOSED);
    expect(status.consecutiveFailures).toBe(0);
    expect(canExecute()).toBe(true);
  });

  it('transitions to HALF_OPEN when cooldown expires and allows probe request', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      recordFailure('Cloudflare 403');
    }
    expect(canExecute()).toBe(false);

    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + BACKOFF_INTERVALS_MS[0] + 1000;
      expect(canExecute()).toBe(true);
      expect(getCircuitStatus().state).toBe(CIRCUIT_STATES.HALF_OPEN);
    } finally {
      Date.now = originalNow;
    }
  });

  it('correctly classifies systemic API errors versus channel-specific errors', () => {
    expect(isSystemicApiError('Access forbidden / Cloudflare challenge (403)')).toBe(true);
    expect(isSystemicApiError('Rate limit exceeded (429)')).toBe(true);
    expect(isSystemicApiError('HTTP error 500')).toBe(true);
    expect(isSystemicApiError('HTTP error 503')).toBe(true);
    expect(isSystemicApiError('Invalid schema: Unrecognized Kick API response')).toBe(true);
    expect(isSystemicApiError('Network request failed')).toBe(true);

    expect(isSystemicApiError('Channel not found (404)')).toBe(false);
    expect(isSystemicApiError('Channel slug is required')).toBe(false);
    expect(isSystemicApiError(null)).toBe(false);
    expect(isSystemicApiError('')).toBe(false);
  });
});
