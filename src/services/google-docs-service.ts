/**
 * GoogleDocsService
 *
 * Wraps Google Docs API calls:
 *   - appendContent(): appends plain text to the end of an existing Google Document
 *
 * Behavior:
 *   - Fetches the document to determine the current end index
 *   - Inserts content after the last character with a newline separator
 *   - Never overwrites existing content
 *   - Handles empty documents gracefully
 *
 * Throws typed AppError on any failure.
 */

import { google } from 'googleapis';
import { googleAuthService } from './google-auth-service.js';
import { logger } from '../utils/logger.js';
import { AppError, Errors, ErrorCode } from '../utils/error-handling.js';

export interface AppendContentResult {
  success: true;
  document_id: string;
  message: string;
}

export class GoogleDocsService {
  /**
   * Appends plain text content to the end of the specified Google Document.
   *
   * @param documentId - The Google Document ID (from the document URL)
   * @param content - The text content to append
   */
  async appendContent(documentId: string, content: string): Promise<AppendContentResult> {
    logger.info({ documentId }, 'google_docs_append_content: started');

    try {
      const auth = await googleAuthService.getAuthClient();
      const docs = google.docs({ version: 'v1', auth });

      // Step 1: Fetch the document to find the current end index
      let endIndex: number;
      try {
        const docResponse = await docs.documents.get({ documentId });
        const body = docResponse.data.body;

        // Google Docs body content ends with a newline segment at the very end.
        // The end index of the body minus 1 gives us the insertion point.
        endIndex = body?.content?.at(-1)?.endIndex ?? 1;

        // Subtract 1 to insert before the terminal newline that Google Docs maintains
        endIndex = Math.max(1, endIndex - 1);
      } catch (err) {
        throw this.mapDocsError(err, documentId);
      }

      // Step 2: Build the text to insert — prepend a newline for separation
      const textToInsert = `\n${content}`;

      // Step 3: Insert the content at the end of the document
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: endIndex },
                text: textToInsert,
              },
            },
          ],
        },
      });

      logger.info({ documentId }, 'google_docs_append_content: completed');

      return {
        success: true,
        document_id: documentId,
        message: 'Content appended successfully.',
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw this.mapDocsError(err, documentId);
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Maps Google Docs API errors to typed AppErrors.
   */
  private mapDocsError(err: unknown, documentId: string): AppError {
    if (err instanceof AppError) return err;

    if (err instanceof Error) {
      const message = err.message.toLowerCase();

      if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid credentials')) {
        return Errors.authRequired();
      }
      if (message.includes('404') || message.includes('not found')) {
        return Errors.documentNotFound(documentId);
      }
      if (message.includes('403') || message.includes('forbidden') || message.includes('permission')) {
        return Errors.permissionDenied(`Google Doc: ${documentId}`);
      }
      if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
        return Errors.rateLimitExceeded();
      }

      return new AppError(
        ErrorCode.GOOGLE_DOCS_API_ERROR,
        `Google Docs API error: ${err.message}`
      );
    }

    return Errors.googleDocsApiError('Unexpected error during appendContent');
  }
}

export const googleDocsService = new GoogleDocsService();
