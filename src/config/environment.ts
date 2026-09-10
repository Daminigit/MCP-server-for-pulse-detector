/**
 * Environment configuration loader.
 * Fails fast at startup if any required variable is missing.
 */

import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[Config] Missing required environment variable: ${name}\n` +
      `  → Copy .env.example to .env and fill in the value.`
    );
  }
  return value.trim();
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name]?.trim() || defaultValue;
}

export const config = {
  google: {
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri: requireEnv('GOOGLE_REDIRECT_URI'),
    tokenStoragePath: optionalEnv('GOOGLE_TOKEN_STORAGE', '.tokens/google-token.json'),

    /**
     * Minimum required OAuth scopes.
     * - gmail.compose: create drafts + send email
     * - documents: read + write Google Docs
     */
    scopes: [
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/documents',
    ],
  },

  server: {
    port: parseInt(optionalEnv('MCP_SERVER_PORT', '3000'), 10),
    host: optionalEnv('MCP_SERVER_HOST', 'localhost'),
  },

  logging: {
    level: optionalEnv('LOG_LEVEL', 'info') as
      | 'trace'
      | 'debug'
      | 'info'
      | 'warn'
      | 'error'
      | 'fatal',
  },
} as const;

export type Config = typeof config;
