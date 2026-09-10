import { jest } from '@jest/globals';

jest.mock('../../../src/services/google-auth-service', () => ({
  googleAuthService: { getAuthClient: jest.fn(), isAuthenticated: jest.fn() },
}));

jest.mock('../../../src/services/google-docs-service', () => ({
  googleDocsService: { appendContent: jest.fn() },
}));

jest.mock('../../../src/config/environment', () => ({
  config: {
    google: { clientId: 'test', clientSecret: 'test', redirectUri: 'http://localhost', tokenStoragePath: '.tokens/test.json', scopes: [] },
    server: { port: 3000, host: 'localhost' },
    logging: { level: 'silent' },
  },
}));

import { handleAppendContent } from '../../../src/tools/google-docs/append-content';
import { googleDocsService } from '../../../src/services/google-docs-service';

const mockAppendContent = googleDocsService.appendContent as jest.MockedFunction<typeof googleDocsService.appendContent>;

describe('handleAppendContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success response for valid input', async () => {
    mockAppendContent.mockResolvedValueOnce({
      success: true,
      document_id: 'doc_123',
      message: 'Content appended successfully.',
    });

    const result = await handleAppendContent({
      document_id: 'doc_123',
      content: 'New content to append.',
    });

    expect(result).toEqual({
      success: true,
      document_id: 'doc_123',
      message: 'Content appended successfully.',
    });
    expect(mockAppendContent).toHaveBeenCalledWith('doc_123', 'New content to append.');
  });

  it('returns INVALID_INPUT when document_id is missing', async () => {
    const result = await handleAppendContent({
      content: 'Some content',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT when document_id is empty string', async () => {
    const result = await handleAppendContent({
      document_id: '',
      content: 'Some content',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT when content is missing', async () => {
    const result = await handleAppendContent({
      document_id: 'doc_123',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT when content is empty', async () => {
    const result = await handleAppendContent({
      document_id: 'doc_123',
      content: '',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
  });

  it('propagates DOCUMENT_NOT_FOUND error from service', async () => {
    const { AppError, ErrorCode } = await import('../../../src/utils/error-handling');
    mockAppendContent.mockRejectedValueOnce(
      new AppError(ErrorCode.DOCUMENT_NOT_FOUND, 'Document not found')
    );

    const result = await handleAppendContent({
      document_id: 'missing_doc',
      content: 'Some content',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('DOCUMENT_NOT_FOUND');
  });

  it('propagates PERMISSION_DENIED error from service', async () => {
    const { AppError, ErrorCode } = await import('../../../src/utils/error-handling');
    mockAppendContent.mockRejectedValueOnce(
      new AppError(ErrorCode.PERMISSION_DENIED, 'No access')
    );

    const result = await handleAppendContent({
      document_id: 'restricted_doc',
      content: 'Some content',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('PERMISSION_DENIED');
  });

  it('propagates AUTHENTICATION_REQUIRED error from service', async () => {
    const { AppError, ErrorCode } = await import('../../../src/utils/error-handling');
    mockAppendContent.mockRejectedValueOnce(
      new AppError(ErrorCode.AUTHENTICATION_REQUIRED, 'Auth needed')
    );

    const result = await handleAppendContent({
      document_id: 'doc_123',
      content: 'Some content',
    }) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toBe('AUTHENTICATION_REQUIRED');
  });
});
