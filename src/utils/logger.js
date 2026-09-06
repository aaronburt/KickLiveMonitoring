import { getSettings } from '../services/storageService.js';

export async function logDebug(event, ...details) {
  try {
    const settings = await getSettings();
    if (settings.debugLogging) {
      const time = new Date().toISOString().split('T')[1].slice(0, 8);
      console.log(`[StreamerMonitor ${time}] ${event}`, ...details);
    }
  } catch {}
}
