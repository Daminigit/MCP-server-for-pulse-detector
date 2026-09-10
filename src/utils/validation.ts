/**
 * Input validation utilities.
 * Used by tool handlers before making any Google API calls.
 */

// RFC 5322-compliant email regex (simplified but robust for common cases)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Validates a single email address.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates a list of email addresses.
 * Returns the first invalid address, or null if all are valid.
 */
export function validateEmailList(emails: string[]): string | null {
  for (const email of emails) {
    if (!isValidEmail(email)) {
      return email;
    }
  }
  return null;
}

/**
 * Validates that a Google Document ID is a non-empty string.
 * Google Doc IDs are typically 44 characters, but we do a basic non-empty check.
 */
export function validateDocumentId(id: string): boolean {
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * Validates that a required string field is non-empty.
 */
export function validateRequiredString(value: unknown, fieldName: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Field "${fieldName}" is required and must be a non-empty string.`);
  }
}
