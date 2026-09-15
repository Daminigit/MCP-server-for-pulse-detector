/**
 * HTTP Server for Railway deployment.
 *
 * Exposes the MCP server over StreamableHttpServerTransport (HTTP/JSON).
 * This is the production transport; stdio is used for local development.
 *
 * Endpoints:
 *   GET  /health  — Railway health check
 *   POST /mcp     — MCP Streamable HTTP (stateless per-request)
 *
 * Security:
 *   Set MCP_API_KEY env var to require x-api-key header on /mcp.
 */

import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { setupMcpTools } from './mcp-server.js';

/**
 * Reads the full request body as a Buffer, then parses as JSON.
 */
async function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Starts the MCP HTTP server for Railway/production.
 * Each POST /mcp request gets a fresh stateless McpServer + transport pair.
 */
export async function startHttpServer(): Promise<void> {
  const port = config.server.port;
  const apiKey = process.env.MCP_API_KEY;

  const server = http.createServer(async (req, res) => {
    const pathname = req.url?.split('?')[0] ?? '/';

    // ─── Health check ──────────────────────────────────────────────────────
    if (pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
      return;
    }

    // ─── MCP endpoint ──────────────────────────────────────────────────────
    if (pathname === '/mcp' && (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE')) {
      // Optional API key protection
      if (apiKey && req.headers['x-api-key'] !== apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid x-api-key header' }));
        return;
      }

      try {
        const body = req.method === 'POST' ? await readBody(req) : undefined;

        // Stateless: fresh McpServer + transport per request
        const mcpServer = new McpServer({
          name: 'mcp-google-workspace',
          version: '1.0.0',
        });
        setupMcpTools(mcpServer);

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless mode — no session persistence
        });

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, body);
      } catch (err) {
        logger.error({ err }, 'MCP HTTP request failed');
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
      return;
    }

    // ─── 404 ──────────────────────────────────────────────────────────────
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      logger.info(
        { port, apiKeyEnabled: !!apiKey },
        'MCP Google Workspace HTTP server started'
      );
      resolve();
    });
  });
}
