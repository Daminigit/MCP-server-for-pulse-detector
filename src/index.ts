/**
 * Entry point for the MCP Google Workspace server.
 *
 * Usage:
 *   Development:  npm run dev
 *   Production:   npm run build && npm start
 */

import { startMcpServer } from './server/mcp-server.js';
import { logger } from './utils/logger.js';

startMcpServer().catch((err: unknown) => {
  // Use console.error as a last resort if logger itself fails to initialize
  logger.fatal({ err }, 'Fatal error: MCP server failed to start');
  process.exit(1);
});
