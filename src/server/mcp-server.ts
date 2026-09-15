/**
 * MCP Server Bootstrap
 *
 * Creates and configures the MCP server with all three tools:
 *   - gmail_create_draft
 *   - gmail_send_email
 *   - google_docs_append_content
 *
 * Transport: StdioServerTransport (stdin/stdout) for local use.
 *            StreamableHttpServerTransport for Railway/production.
 * Compatible with: Claude Desktop, Cursor, Windsurf, and any MCP client.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleCreateDraft } from '../tools/gmail/create-draft.js';
import { handleSendEmail } from '../tools/gmail/send-email.js';
import { handleAppendContent } from '../tools/google-docs/append-content.js';
import { logger } from '../utils/logger.js';

/**
 * Registers all MCP tools on the provided server instance.
 * Shared between stdio (local) and HTTP (Railway) transports.
 */
export function setupMcpTools(server: McpServer): void {
  // ─── Tool: gmail_create_draft ──────────────────────────────────────────────
  server.tool(
    'gmail_create_draft',
    `Creates an email draft in the authenticated user's Gmail account.
Use this tool when you want to prepare an email for review before sending.
This tool does NOT send the email — the draft is only saved to Gmail Drafts.
To send an email, use the gmail_send_email tool instead.`,
    {
      to: z
        .array(z.string().email())
        .min(1)
        .describe('List of recipient email addresses (required, at least one).'),
      cc: z
        .array(z.string().email())
        .optional()
        .describe('List of CC email addresses (optional).'),
      bcc: z
        .array(z.string().email())
        .optional()
        .describe('List of BCC email addresses (optional).'),
      subject: z.string().min(1).describe('The email subject line (required).'),
      body: z
        .string()
        .min(1)
        .describe('The plain-text email body (required).'),
      html_body: z
        .string()
        .optional()
        .describe('Optional HTML version of the email body. If provided, overrides plain-text body for HTML-capable email clients.'),
    },
    async (input) => {
      logger.info('MCP tool invoked: gmail_create_draft');
      const result = await handleCreateDraft(input);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ─── Tool: gmail_send_email ────────────────────────────────────────────────
  server.tool(
    'gmail_send_email',
    `Sends an email immediately via the authenticated Gmail account.
Use this tool only when the user has explicitly confirmed they want to send the email.
WARNING: This action is PERMANENT — the email will be delivered immediately and cannot be recalled.
To create a draft for review instead, use gmail_create_draft.`,
    {
      to: z
        .array(z.string().email())
        .min(1)
        .describe('List of recipient email addresses (required, at least one).'),
      cc: z
        .array(z.string().email())
        .optional()
        .describe('List of CC email addresses (optional).'),
      bcc: z
        .array(z.string().email())
        .optional()
        .describe('List of BCC email addresses (optional).'),
      subject: z.string().min(1).describe('The email subject line (required).'),
      body: z
        .string()
        .min(1)
        .describe('The plain-text email body (required).'),
      html_body: z
        .string()
        .optional()
        .describe('Optional HTML version of the email body.'),
    },
    async (input) => {
      logger.info('MCP tool invoked: gmail_send_email');
      const result = await handleSendEmail(input);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ─── Tool: google_docs_append_content ─────────────────────────────────────
  server.tool(
    'google_docs_append_content',
    `Appends plain text content to the end of an existing Google Document.
Use this tool to add new content at the bottom of a Google Doc without modifying existing content.
The document ID can be found in the Google Doc URL: docs.google.com/document/d/<DOCUMENT_ID>/edit
Existing document content is never overwritten or deleted.`,
    {
      document_id: z
        .string()
        .min(1)
        .describe('The Google Document ID from the document URL (required). Example: "1AbCdEfGhIjKlMnOpQrStUvWxYz"'),
      content: z
        .string()
        .min(1)
        .describe('The plain text content to append at the end of the document (required).'),
    },
    async (input) => {
      logger.info({ documentId: input.document_id }, 'MCP tool invoked: google_docs_append_content');
      const result = await handleAppendContent(input);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}

/**
 * Starts the MCP server with StdioServerTransport (local/dev mode).
 * For Railway/production HTTP mode, see http-server.ts.
 */
export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'mcp-google-workspace',
    version: '1.0.0',
  });

  setupMcpTools(server);

  // ─── Start stdio transport ─────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP Google Workspace server started — listening on stdio');
}
