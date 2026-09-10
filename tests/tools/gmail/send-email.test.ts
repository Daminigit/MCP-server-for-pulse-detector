import { jest } from '@jest/globals';

jest.mock('../../../src/services/google-auth-service', () => ({
  googleAuthService: { getAuthClient: jest.fn(), isAuthenticated: jest.fn() },
}));

jest.mock('../../../src/services/gmail-service', () => ({
  gmailService: { sendEmail: jest.fn() },
}));

jest.mock('../../../src/config/environment', () => ({
  config: {
    google: { clientId: 'test', clientSecret: 'test', redirectUri: 'http://localhost', tokenStoragePath: '.tokens/test.json', scopes: [] },
    server: { port: 3000, host: 'localhost' },
    logging: { level: 'silent' },
  },
}));

import { handleSendEmail } from '../../../src/tools/gmail/send-email';
import { gmailService } from '../../../src/services/gmail-service';

const mockSendEmail = gmailService.sendEmail as jest.MockedFunction<typeof gmailService.sendEmail>;

describe('handleSendEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success response for valid input', async () => {
    mockSendEmail.mockResolvedValueOnce({
      success: true,
      message_id: 'msg_456',
      thread_id: 'thread_789',
      message: 'Email sent successfully.',
    });

    const result = await handleSendEmail({
      to: ['recipient@example.com'],
      subject: 'Hello',
      body: 'World',
    });

    expect(result).toEqual({
      success: true,
      message_id: 'msg_456',
      thread_id: 'thread_789',
      message: 'Email sent successfully.',
    });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('returns INVALID_INPUT for missing to field', async () => {
    const result = await handleSendEmail({
      subject: 'Hello',
      body: 'World',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT for malformed email address', async () => {
    const result = await handleSendEmail({
      to: ['bad-email'],
      subject: 'Hello',
      body: 'World',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
  });

  it('propagates Gmail API errors from service', async () => {
    const { AppError, ErrorCode } = await import('../../../src/utils/error-handling');
    mockSendEmail.mockRejectedValueOnce(
      new AppError(ErrorCode.GMAIL_API_ERROR, 'API error')
    );

    const result = await handleSendEmail({
      to: ['user@example.com'],
      subject: 'Hello',
      body: 'World',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('GMAIL_API_ERROR');
  });
});
