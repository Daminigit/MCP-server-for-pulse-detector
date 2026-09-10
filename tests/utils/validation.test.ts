import { isValidEmail, validateEmailList, validateDocumentId } from '../../src/utils/validation';

describe('validation utilities', () => {
  // ─── isValidEmail ───────────────────────────────────────────────────────
  describe('isValidEmail', () => {
    it('accepts a standard email address', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('accepts email with subdomain', () => {
      expect(isValidEmail('user@mail.example.co.uk')).toBe(true);
    });

    it('accepts email with plus sign', () => {
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('rejects email without @', () => {
      expect(isValidEmail('notanemail')).toBe(false);
    });

    it('rejects email without domain', () => {
      expect(isValidEmail('user@')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });

    it('rejects email without TLD', () => {
      expect(isValidEmail('user@localhost')).toBe(false);
    });
  });

  // ─── validateEmailList ──────────────────────────────────────────────────
  describe('validateEmailList', () => {
    it('returns null when all emails are valid', () => {
      expect(validateEmailList(['a@example.com', 'b@example.com'])).toBeNull();
    });

    it('returns the first invalid email', () => {
      expect(validateEmailList(['a@example.com', 'not-an-email'])).toBe('not-an-email');
    });

    it('returns null for an empty list', () => {
      expect(validateEmailList([])).toBeNull();
    });
  });

  // ─── validateDocumentId ──────────────────────────────────────────────────
  describe('validateDocumentId', () => {
    it('accepts a non-empty string', () => {
      expect(validateDocumentId('1AbCdEfGhIjKlMnOpQrStUvWxYz')).toBe(true);
    });

    it('rejects an empty string', () => {
      expect(validateDocumentId('')).toBe(false);
    });

    it('rejects a whitespace-only string', () => {
      expect(validateDocumentId('   ')).toBe(false);
    });
  });
});
