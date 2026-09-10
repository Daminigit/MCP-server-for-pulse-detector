/**
 * GoogleAuthService
 *
 * Manages the full OAuth 2.0 lifecycle:
 *   - Generates the consent URL for first-time auth
 *   - Exchanges authorization codes for tokens
 *   - Persists tokens to disk (GOOGLE_TOKEN_STORAGE)
 *   - Auto-refreshes expired access tokens
 *   - Returns a ready-to-use OAuth2Client for API calls
 *
 * Security:
 *   - Tokens are never returned to callers or logged
 *   - Credentials are loaded from environment only
 */

import { OAuth2Client } from 'google-auth-library';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { Errors } from '../utils/error-handling.js';

interface StoredTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  token_type?: string | null;
  scope?: string;
}

export class GoogleAuthService {
  private client: OAuth2Client;
  private readonly tokenPath: string;

  constructor() {
    this.client = new OAuth2Client(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    this.tokenPath = path.resolve(process.cwd(), config.google.tokenStoragePath);
  }

  /**
   * Returns the OAuth consent URL for first-time authorization.
   * The user must visit this URL and authorize the requested scopes.
   */
  getAuthUrl(): string {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: [...config.google.scopes],
      prompt: 'consent', // Force refresh token generation on every auth
    });
  }

  /**
   * Exchanges an authorization code (from the OAuth callback) for tokens,
   * then persists them to disk.
   */
  async exchangeCode(code: string): Promise<void> {
    logger.info('Exchanging authorization code for tokens');
    const { tokens } = await this.client.getToken(code);
    this.client.setCredentials(tokens);
    await this.saveTokens(tokens as StoredTokens);
    logger.info('Tokens obtained and stored successfully');
  }

  /**
   * Returns an authenticated OAuth2Client ready to use with Google APIs.
   * Loads tokens from disk and auto-refreshes if expired.
   *
   * @throws AppError(AUTHENTICATION_REQUIRED) if no tokens are stored.
   */
  async getAuthClient(): Promise<OAuth2Client> {
    const tokens = await this.loadTokens();

    if (!tokens) {
      throw Errors.authRequired();
    }

    this.client.setCredentials(tokens);

    // Register auto-refresh handler
    this.client.on('tokens', async (newTokens) => {
      logger.info('Access token refreshed automatically');
      const merged: StoredTokens = { ...tokens, ...newTokens };
      await this.saveTokens(merged);
    });

    return this.client;
  }

  /**
   * Returns true if stored tokens exist on disk.
   */
  async isAuthenticated(): Promise<boolean> {
    return existsSync(this.tokenPath);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async loadTokens(): Promise<StoredTokens | null> {
    if (!existsSync(this.tokenPath)) {
      return null;
    }

    try {
      const raw = await readFile(this.tokenPath, 'utf-8');
      return JSON.parse(raw) as StoredTokens;
    } catch {
      logger.warn({ tokenPath: this.tokenPath }, 'Failed to read token file');
      return null;
    }
  }

  private async saveTokens(tokens: StoredTokens): Promise<void> {
    const dir = path.dirname(this.tokenPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    // Write tokens to file — pino redaction does not apply here,
    // so we never log the token object itself
    await writeFile(this.tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
    logger.info({ tokenPath: this.tokenPath }, 'Tokens saved to disk');
  }
}

// Singleton instance — shared across all service consumers
export const googleAuthService = new GoogleAuthService();
