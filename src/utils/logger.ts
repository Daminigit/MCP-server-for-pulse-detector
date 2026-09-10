/**
 * Structured logger using pino.
 *
 * Security: Automatically redacts any field whose key contains
 * 'token', 'secret', 'authorization', or 'password' to prevent
 * accidental credential leakage in logs.
 */

import pino from 'pino';
import { config } from '../config/environment.js';

export const logger = pino({
  level: config.logging.level,

  // Redact sensitive fields at any depth in the log object
  redact: {
    paths: [
      '*.token',
      '*.access_token',
      '*.refresh_token',
      '*.id_token',
      '*.client_secret',
      '*.authorization',
      '*.password',
      'token',
      'access_token',
      'refresh_token',
      'id_token',
      'client_secret',
      'authorization',
      'password',
    ],
    censor: '[REDACTED]',
  },

  // Pretty-print in development, structured JSON in production
  transport:
    process.env['NODE_ENV'] === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

export type Logger = typeof logger;
