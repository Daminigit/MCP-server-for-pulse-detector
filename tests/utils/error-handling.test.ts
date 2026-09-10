import {
  AppError,
  buildMcpError,
  ErrorCode,
  Errors,
} from '../../src/utils/error-handling';

describe('error-handling utilities', () => {
  // ─── AppError ────────────────────────────────────────────────────────────
  describe('AppError', () => {
    it('creates an error with the correct code and message', () => {
      const err = new AppError(ErrorCode.INVALID_INPUT, 'Bad input');
      expect(err.code).toBe('INVALID_INPUT');
      expect(err.message).toBe('Bad input');
      expect(err.name).toBe('AppError');
    });
  });

  // ─── buildMcpError ───────────────────────────────────────────────────────
  describe('buildMcpError', () => {
    it('converts an AppError to a structured MCP error payload', () => {
      const err = new AppError(ErrorCode.AUTHENTICATION_REQUIRED, 'Auth required');
      const payload = buildMcpError(err);
      expect(payload).toEqual({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Auth required',
      });
    });

    it('converts a plain Error to an INTERNAL_ERROR payload', () => {
      const err = new Error('Something went wrong');
      const payload = buildMcpError(err);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('INTERNAL_ERROR');
      expect(payload.message).toContain('Something went wrong');
    });

    it('converts an unknown value to an INTERNAL_ERROR payload', () => {
      const payload = buildMcpError(42);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('INTERNAL_ERROR');
    });

    it('redacts Bearer tokens from error messages', () => {
      const err = new Error('Failed with Bearer ya29.a0AbCdEfGhIjKlMnOpQrStUvWxYz token');
      const payload = buildMcpError(err);
      expect(payload.message).not.toContain('ya29');
    });
  });

  // ─── Errors factory ──────────────────────────────────────────────────────
  describe('Errors factory', () => {
    it('creates AUTHENTICATION_REQUIRED error', () => {
      const err = Errors.authRequired();
      expect(err.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('creates INVALID_INPUT error with custom message', () => {
      const err = Errors.invalidInput('Bad email');
      expect(err.code).toBe('INVALID_INPUT');
      expect(err.message).toContain('Bad email');
    });

    it('creates DOCUMENT_NOT_FOUND error with doc ID', () => {
      const err = Errors.documentNotFound('docABC');
      expect(err.code).toBe('DOCUMENT_NOT_FOUND');
      expect(err.message).toContain('docABC');
    });

    it('creates GMAIL_API_ERROR', () => {
      const err = Errors.gmailApiError('API down');
      expect(err.code).toBe('GMAIL_API_ERROR');
    });

    it('creates RATE_LIMIT_EXCEEDED error', () => {
      const err = Errors.rateLimitExceeded();
      expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
