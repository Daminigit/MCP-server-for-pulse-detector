/**
 * Entry point for the MCP Google Workspace server.
 *
 * Transport selection:
 *   - Production (Railway): StreamableHttpServerTransport via http-server.ts
 *     Detected by: RAILWAY_ENVIRONMENT or NODE_ENV=production
 *   - Development (local): StdioServerTransport via mcp-server.ts
 *
 * Usage:
 *   Development:  npm run dev
 *   Production:   npm run build && npm start
 */

import { logger } from './utils/logger.js';

const isProduction =
  process.env.RAILWAY_ENVIRONMENT !== undefined ||
  process.env.NODE_ENV === 'production';

if (isProduction) {
  const { startHttpServer } = await import('./server/http-server.js');
  startHttpServer().catch((err: unknown) => {
    logger.fatal({ err }, 'Fatal error: MCP HTTP server failed to start');
    process.exit(1);
  });
} else {
  const { startMcpServer } = await import('./server/mcp-server.js');
  startMcpServer().catch((err: unknown) => {
    logger.fatal({ err }, 'Fatal error: MCP stdio server failed to start');
    process.exit(1);
  });
}
