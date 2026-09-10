import { jest } from '@jest/globals';
import { existsSync } from 'node:fs';

// Mock filesystem and google-auth-library
jest.mock('node:fs');
jest.mock('node:fs/promises');

jest.mock('../../src/config/environment', () => ({
  config: {
    google: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/oauth/callback',
      tokenStoragePath: '.tokens/test.json',
      scopes: ['https://www.googleapis.com/auth/gmail.compose'],
    },
    server: { port: 3000, host: 'localhost' },
    logging: { level: 'silent' },
  },
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

import { GoogleAuthService } from '../../src/services/google-auth-service';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GoogleAuthService();
  });

  describe('getAuthUrl', () => {
    it('returns a Google OAuth URL', () => {
      const url = service.getAuthUrl();
      expect(url).toContain('accounts.google.com');
      expect(url).toContain('oauth2');
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when token file exists', async () => {
      mockExistsSync.mockReturnValue(true);
      const result = await service.isAuthenticated();
      expect(result).toBe(true);
    });

    it('returns false when token file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await service.isAuthenticated();
      expect(result).toBe(false);
    });
  });

  describe('getAuthClient', () => {
    it('throws AUTHENTICATION_REQUIRED when no tokens are stored', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(service.getAuthClient()).rejects.toMatchObject({
        code: 'AUTHENTICATION_REQUIRED',
      });
    });
  });
});
