import { describe, it, expect } from 'bun:test';
import { normalizeSlug, isValidSlug, validateSlug } from '../src/utils/slugValidator.js';

describe('slugValidator', () => {
  describe('normalizeSlug', () => {
    it('normalizes simple lowercase usernames', () => {
      expect(normalizeSlug('xqc')).toBe('xqc');
      expect(normalizeSlug('trainwreckstv')).toBe('trainwreckstv');
      expect(normalizeSlug('adinross')).toBe('adinross');
    });

    it('converts uppercase to lowercase', () => {
      expect(normalizeSlug('XQC')).toBe('xqc');
      expect(normalizeSlug('AdinRoss')).toBe('adinross');
      expect(normalizeSlug('TrainwrecksTV')).toBe('trainwreckstv');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeSlug('  xqc  ')).toBe('xqc');
      expect(normalizeSlug('\txqc\n')).toBe('xqc');
    });

    it('strips leading @ sign', () => {
      expect(normalizeSlug('@xqc')).toBe('xqc');
      expect(normalizeSlug('  @AdinRoss  ')).toBe('adinross');
    });

    it('extracts slug from full Kick HTTPS URLs', () => {
      expect(normalizeSlug('https://kick.com/xqc')).toBe('xqc');
      expect(normalizeSlug('https://kick.com/xqc/')).toBe('xqc');
      expect(normalizeSlug('https://www.kick.com/adinross')).toBe('adinross');
      expect(normalizeSlug('http://kick.com/trainwreckstv?ref=123')).toBe('trainwreckstv');
    });

    it('extracts slug from kick.com domain strings without protocol', () => {
      expect(normalizeSlug('kick.com/xqc')).toBe('xqc');
      expect(normalizeSlug('www.kick.com/xqc/about')).toBe('xqc');
    });

    it('returns empty string for invalid inputs or malformed URLs', () => {
      expect(normalizeSlug('')).toBe('');
      expect(normalizeSlug(null)).toBe('');
      expect(normalizeSlug(undefined)).toBe('');
      expect(normalizeSlug(123)).toBe('');
      expect(normalizeSlug('https://%%invalid-url%%')).toBe('');
    });
  });

  describe('isValidSlug', () => {
    it('returns true for valid alphanumeric slugs with underscores', () => {
      expect(isValidSlug('xqc')).toBe(true);
      expect(isValidSlug('trainwreckstv_')).toBe(true);
      expect(isValidSlug('streamer123')).toBe(true);
      expect(isValidSlug('a_b_c')).toBe(true);
    });

    it('returns false for slugs with invalid characters', () => {
      expect(isValidSlug('streamer!')).toBe(false);
      expect(isValidSlug('user@name')).toBe(false);
      expect(isValidSlug('user name')).toBe(false);
      expect(isValidSlug('user$')).toBe(false);
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug(null)).toBe(false);
      expect(isValidSlug(undefined)).toBe(false);
    });
  });

  describe('validateSlug', () => {
    it('returns valid object for correct usernames', () => {
      const result = validateSlug('xqc');
      expect(result.isValid).toBe(true);
      expect(result.slug).toBe('xqc');
      expect(result.error).toBeNull();
    });

    it('returns valid object for full Kick URL', () => {
      const result = validateSlug('https://kick.com/hikaru');
      expect(result.isValid).toBe(true);
      expect(result.slug).toBe('hikaru');
      expect(result.error).toBeNull();
    });

    it('returns invalid object for empty input', () => {
      const result = validateSlug('   ');
      expect(result.isValid).toBe(false);
      expect(result.slug).toBe('');
      expect(typeof result.error).toBe('string');
    });

    it('returns invalid object for illegal characters', () => {
      const result = validateSlug('user!@#$');
      expect(result.isValid).toBe(false);
      expect(typeof result.error).toBe('string');
    });

    it('rejects external non-Kick URLs', () => {
      const result = validateSlug('https://twitch.tv/xqc');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid Kick username');
    });
  });
});
