/**
 * Standardized error handling for the MCP server.
 *
 * All errors returned to AI agents follow the schema:
 *   { success: false, error: ERROR_CODE, message: string }
 *
 * Sensitive information (tokens, secrets) is never included in error payloads.
 */

// ─── Error Codes ─────────────────────────────────────────────────────────────

export const ErrorCode = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INVALID_INPUT: 'INVALID_INPUT',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  GMAIL_API_ERROR: 'GMAIL_API_ERROR',
  GOOGLE_DOCS_API_ERROR: 'GOOGLE_DOCS_API_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ─── AppError Class ───────────────────────────────────────────────────────────

/**
 * Typed application error that carries an MCP-compatible error code.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCodeType,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ─── MCP Error Payload ────────────────────────────────────────────────────────

export interface McpErrorPayload {
  success: false;
  error: ErrorCodeType;
  message: string;
}

/**
 * Converts any error into a safe, structured MCP error payload.
 * Never exposes tokens, secrets, or raw stack traces.
 */
export function buildMcpError(err: unknown): McpErrorPayload {
  if (err instanceof AppError) {
    return {
      success: false,
      error: err.code,
      message: err.message,
    };
  }

  if (err instanceof Error) {
    // Sanitize the message — remove anything that looks like a token or secret
    const safeMessage = sanitizeErrorMessage(err.message);
    return {
      success: false,
      error: ErrorCode.INTERNAL_ERROR,
      message: safeMessage,
    };
  }

  return {
    success: false,
    error: ErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred.',
  };
}

/**
 * Strips patterns that could be tokens or secrets from error messages.
 */
function sanitizeErrorMessage(message: string): string {
  // Remove anything that looks like a Bearer token, OAuth token, or long base64 string
  return message
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]')
    .replace(/ya29\.[A-Za-z0-9\-_]+/g, '[REDACTED_ACCESS_TOKEN]')
    .replace(/[A-Za-z0-9\-_]{100,}/g, '[REDACTED_LONG_STRING]');
}

/**
 * Helper to create common errors concisely.
 */
export const Errors = {
  authRequired: () =>
    new AppError(ErrorCode.AUTHENTICATION_REQUIRED, 'Google authentication is required. Run `npm run auth` to authenticate.'),

  invalidInput: (message: string) =>
    new AppError(ErrorCode.INVALID_INPUT, message),

  documentNotFound: (docId: string) =>
    new AppError(ErrorCode.DOCUMENT_NOT_FOUND, `The specified Google Document could not be found or accessed: ${docId}`),

  gmailApiError: (message: string) =>
    new AppError(ErrorCode.GMAIL_API_ERROR, `Gmail API error: ${message}`),

  googleDocsApiError: (message: string) =>
    new AppError(ErrorCode.GOOGLE_DOCS_API_ERROR, `Google Docs API error: ${message}`),

  permissionDenied: (resource: string) =>
    new AppError(ErrorCode.PERMISSION_DENIED, `Permission denied for resource: ${resource}`),

  rateLimitExceeded: () =>
    new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Google API rate limit exceeded. Please retry after a short delay.'),
};
