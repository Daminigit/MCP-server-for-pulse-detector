import { jest } from '@jest/globals';

// Mock the google-auth-service before importing anything that depends on it
jest.mock('../../../src/services/google-auth-service', () => ({
  googleAuthService: {
    getAuthClient: jest.fn(),
    isAuthenticated: jest.fn(),
  },
}));

// Mock the gmail service module
jest.mock('../../../src/services/gmail-service', () => ({
  gmailService: {
    createDraft: jest.fn(),
  },
}));

// Mock config to avoid missing env vars
jest.mock('../../../src/config/environment', () => ({
  config: {
    google: { clientId: 'test', clientSecret: 'test', redirectUri: 'http://localhost', tokenStoragePath: '.tokens/test.json', scopes: [] },
    server: { port: 3000, host: 'localhost' },
    logging: { level: 'silent' },
  },
}));

import { handleCreateDraft } from '../../../src/tools/gmail/create-draft';
import { gmailService } from '../../../src/services/gmail-service';

const mockCreateDraft = gmailService.createDraft as jest.MockedFunction<typeof gmailService.createDraft>;

describe('handleCreateDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success response for valid input', async () => {
    mockCreateDraft.mockResolvedValueOnce({
      success: true,
      draft_id: 'draft_123',
      message: 'Email draft created successfully.',
    });

    const result = await handleCreateDraft({
      to: ['recipient@example.com'],
      subject: 'Test Subject',
      body: 'Test body',
    });

    expect(result).toEqual({
      success: true,
      draft_id: 'draft_123',
      message: 'Email draft created successfully.',
    });
    expect(mockCreateDraft).toHaveBeenCalledTimes(1);
  });

  it('returns INVALID_INPUT error for missing to field', async () => {
    const result = await handleCreateDraft({
      subject: 'Test',
      body: 'Body',
    }) as { success: false; error: string; message: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT error for invalid email in to', async () => {
    const result = await handleCreateDraft({
      to: ['not-an-email'],
      subject: 'Test',
      body: 'Body',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT error for empty subject', async () => {
    const result = await handleCreateDraft({
      to: ['user@example.com'],
      subject: '',
      body: 'Body',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT error for empty body', async () => {
    const result = await handleCreateDraft({
      to: ['user@example.com'],
      subject: 'Subject',
      body: '',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
  });

  it('propagates AUTHENTICATION_REQUIRED error from service', async () => {
    const { AppError, ErrorCode } = await import('../../../src/utils/error-handling');
    mockCreateDraft.mockRejectedValueOnce(
      new AppError(ErrorCode.AUTHENTICATION_REQUIRED, 'Auth required')
    );

    const result = await handleCreateDraft({
      to: ['user@example.com'],
      subject: 'Subject',
      body: 'Body',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('AUTHENTICATION_REQUIRED');
  });

  it('propagates GMAIL_API_ERROR from service', async () => {
    const { AppError, ErrorCode } = await import('../../../src/utils/error-handling');
    mockCreateDraft.mockRejectedValueOnce(
      new AppError(ErrorCode.GMAIL_API_ERROR, 'Gmail down')
    );

    const result = await handleCreateDraft({
      to: ['user@example.com'],
      subject: 'Subject',
      body: 'Body',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('GMAIL_API_ERROR');
  });
});
