import { describe, it, expect } from 'bun:test';
import {
  formatViewerCount,
  formatStreamDuration,
  formatRelativeTime,
  escapeHtml,
} from '../src/utils/formatters.js';

describe('formatters', () => {
  describe('formatViewerCount', () => {
    it('handles zero and negative or invalid numbers', () => {
      expect(formatViewerCount(0)).toBe('0');
      expect(formatViewerCount(-15)).toBe('0');
      expect(formatViewerCount(null)).toBe('0');
      expect(formatViewerCount(undefined)).toBe('0');
      expect(formatViewerCount('invalid')).toBe('0');
    });

    it('formats counts below 1000 verbatim', () => {
      expect(formatViewerCount(1)).toBe('1');
      expect(formatViewerCount(42)).toBe('42');
      expect(formatViewerCount(850)).toBe('850');
      expect(formatViewerCount(999)).toBe('999');
    });

    it('formats thousands with K suffix', () => {
      expect(formatViewerCount(1000)).toBe('1K');
      expect(formatViewerCount(1500)).toBe('1.5K');
      expect(formatViewerCount(9900)).toBe('9.9K');
      expect(formatViewerCount(10000)).toBe('10K');
      expect(formatViewerCount(45800)).toBe('45K');
      expect(formatViewerCount(120500)).toBe('120K');
    });

    it('formats millions with M suffix', () => {
      expect(formatViewerCount(1000000)).toBe('1M');
      expect(formatViewerCount(1200000)).toBe('1.2M');
      expect(formatViewerCount(15500000)).toBe('15.5M');
    });
  });

  describe('formatStreamDuration', () => {
    it('returns empty string for invalid inputs', () => {
      expect(formatStreamDuration(null)).toBe('');
      expect(formatStreamDuration(undefined)).toBe('');
      expect(formatStreamDuration('invalid-date')).toBe('');
    });

    it('formats minutes when under an hour', () => {
      const now = 1756653600000;
      const started = new Date(now - (25 * 60 * 1000)).toISOString();
      expect(formatStreamDuration(started, now)).toBe('25m');
    });

    it('formats hours and minutes when over an hour', () => {
      const now = 1756653600000;
      const started = new Date(now - (2 * 3600 * 1000 + 45 * 60 * 1000)).toISOString();
      expect(formatStreamDuration(started, now)).toBe('2h 45m');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns Never for empty or invalid input', () => {
      expect(formatRelativeTime(null)).toBe('Never');
      expect(formatRelativeTime(undefined)).toBe('Never');
      expect(formatRelativeTime('invalid')).toBe('Never');
    });

    it('returns Just now for timestamps under 60 seconds', () => {
      const now = 1756653600000;
      expect(formatRelativeTime(now - 30000, now)).toBe('Just now');
    });

    it('returns minutes ago for timestamps under an hour', () => {
      const now = 1756653600000;
      expect(formatRelativeTime(now - (5 * 60 * 1000), now)).toBe('5m ago');
    });

    it('returns hours ago for timestamps under 24 hours', () => {
      const now = 1756653600000;
      expect(formatRelativeTime(now - (3 * 3600 * 1000), now)).toBe('3h ago');
    });

    it('returns days ago for timestamps older than 24 hours', () => {
      const now = 1756653600000;
      expect(formatRelativeTime(now - (2 * 86400 * 1000), now)).toBe('2d ago');
    });
  });

  describe('escapeHtml', () => {
    it('handles empty or null values', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('escapes dangerous HTML characters', () => {
      const raw = '<script>alert("XSS" & \'test\')</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot; &amp; &#039;test&#039;)&lt;/script&gt;';
      expect(escapeHtml(raw)).toBe(expected);
    });
  });
});
