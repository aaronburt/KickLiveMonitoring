export const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

export const FAILURE_THRESHOLD = 3;

export const BACKOFF_INTERVALS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
];

let circuitState = CIRCUIT_STATES.CLOSED;
let consecutiveFailures = 0;
let cooldownUntil = 0;
let lastError = null;
let lastSuccessTime = null;
let lastCheckTime = null;

export function getCircuitStatus() {
  const isCooldownActive = Date.now() < cooldownUntil;
  const effectiveState =
    circuitState === CIRCUIT_STATES.OPEN && !isCooldownActive
      ? CIRCUIT_STATES.HALF_OPEN
      : circuitState;

  return {
    state: effectiveState,
    consecutiveFailures,
    cooldownUntil,
    lastError,
    lastSuccessTime,
    lastCheckTime,
  };
}

export function canExecute() {
  if (circuitState === CIRCUIT_STATES.CLOSED) {
    return true;
  }

  if (Date.now() >= cooldownUntil) {
    circuitState = CIRCUIT_STATES.HALF_OPEN;
    return true;
  }

  return false;
}

export function recordSuccess() {
  circuitState = CIRCUIT_STATES.CLOSED;
  consecutiveFailures = 0;
  cooldownUntil = 0;
  lastError = null;
  lastSuccessTime = Date.now();
  lastCheckTime = Date.now();
}

export function recordFailure(errorMessage) {
  consecutiveFailures += 1;
  lastError = errorMessage || 'API failure';
  lastCheckTime = Date.now();

  if (consecutiveFailures >= FAILURE_THRESHOLD || circuitState === CIRCUIT_STATES.HALF_OPEN) {
    circuitState = CIRCUIT_STATES.OPEN;
    const backoffIndex = Math.min(
      Math.max(0, consecutiveFailures - FAILURE_THRESHOLD),
      BACKOFF_INTERVALS_MS.length - 1,
    );
    const duration = BACKOFF_INTERVALS_MS[backoffIndex];
    cooldownUntil = Date.now() + duration;
  }
}

export function resetCircuit() {
  circuitState = CIRCUIT_STATES.CLOSED;
  consecutiveFailures = 0;
  cooldownUntil = 0;
  lastError = null;
  lastCheckTime = Date.now();
}

export function isSystemicApiError(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') return false;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('403') ||
    normalized.includes('429') ||
    normalized.includes('500') ||
    normalized.includes('502') ||
    normalized.includes('503') ||
    normalized.includes('504') ||
    normalized.includes('invalid schema') ||
    normalized.includes('network request failed') ||
    normalized.includes('rate limit')
  );
}
