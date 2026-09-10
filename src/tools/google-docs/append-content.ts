/**
 * Tool handler: google_docs_append_content
 *
 * Appends plain text content to the end of an existing Google Document.
 * Existing document content is never overwritten.
 */

import { z } from 'zod';
import { googleDocsService } from '../../services/google-docs-service.js';
import { buildMcpError, Errors } from '../../utils/error-handling.js';
import { validateDocumentId } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';

// ─── Input Schema ─────────────────────────────────────────────────────────────

export const appendContentSchema = z.object({
  document_id: z
    .string()
    .min(1, 'document_id is required.')
    .refine((id) => validateDocumentId(id), {
      message: 'document_id must be a non-empty string (the Google Doc ID from the document URL).',
    }),
  content: z.string().min(1, 'content is required and must be non-empty.'),
});

export type AppendContentInput = z.infer<typeof appendContentSchema>;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleAppendContent(rawInput: unknown) {
  // Step 1: Parse and validate input with Zod
  const parseResult = appendContentSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const message = parseResult.error.errors.map((e) => e.message).join('; ');
    logger.warn({ input: rawInput }, `google_docs_append_content: validation failed — ${message}`);
    return buildMcpError(Errors.invalidInput(message));
  }

  const input = parseResult.data;

  // Step 2: Call the Google Docs service
  try {
    const result = await googleDocsService.appendContent(
      input.document_id,
      input.content
    );

    return result;
  } catch (err) {
    logger.error({ err, documentId: input.document_id }, 'google_docs_append_content: service error');
    return buildMcpError(err);
  }
}
