/**
 * GmailService
 *
 * Wraps Gmail API calls:
 *   - createDraft(): creates a draft in the authenticated user's Gmail
 *   - sendEmail(): sends an email via the authenticated Gmail account
 *
 * Throws typed AppError on any failure.
 * Never exposes authentication tokens to callers.
 */

import { google } from 'googleapis';
import { googleAuthService } from './google-auth-service.js';
import { logger } from '../utils/logger.js';
import { AppError, Errors, ErrorCode } from '../utils/error-handling.js';

export interface EmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
}

export interface CreateDraftResult {
  success: true;
  draft_id: string;
  message: string;
}

export interface SendEmailResult {
  success: true;
  message_id: string;
  thread_id: string;
  message: string;
}

export class GmailService {
  /**
   * Creates a draft in the authenticated user's Gmail account.
   * Does NOT send the email.
   */
  async createDraft(params: EmailParams): Promise<CreateDraftResult> {
    logger.info({ to: params.to, subject: params.subject }, 'gmail_create_draft: started');

    try {
      const auth = await googleAuthService.getAuthClient();
      const gmail = google.gmail({ version: 'v1', auth });

      const raw = this.buildRawEmail(params);

      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw,
          },
        },
      });

      const draftId = response.data.id;
      if (!draftId) {
        throw Errors.gmailApiError('Draft created but no draft ID returned.');
      }

      logger.info({ draftId }, 'gmail_create_draft: completed');

      return {
        success: true,
        draft_id: draftId,
        message: 'Email draft created successfully.',
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw this.mapGmailError(err, 'createDraft');
    }
  }

  /**
   * Sends an email via the authenticated Gmail account.
   * This action is PERMANENT and cannot be undone.
   */
  async sendEmail(params: EmailParams): Promise<SendEmailResult> {
    logger.info({ to: params.to, subject: params.subject }, 'gmail_send_email: started');

    try {
      const auth = await googleAuthService.getAuthClient();
      const gmail = google.gmail({ version: 'v1', auth });

      const raw = this.buildRawEmail(params);

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      const messageId = response.data.id;
      const threadId = response.data.threadId;

      if (!messageId || !threadId) {
        throw Errors.gmailApiError('Email sent but response data was incomplete.');
      }

      logger.info({ messageId, threadId }, 'gmail_send_email: completed');

      return {
        success: true,
        message_id: messageId,
        thread_id: threadId,
        message: 'Email sent successfully.',
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw this.mapGmailError(err, 'sendEmail');
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Builds a base64url-encoded RFC 2822 email message.
   */
  private buildRawEmail(params: EmailParams): string {
    const toHeader = params.to.join(', ');
    const ccHeader = params.cc && params.cc.length > 0 ? `Cc: ${params.cc.join(', ')}\r\n` : '';
    const bccHeader = params.bcc && params.bcc.length > 0 ? `Bcc: ${params.bcc.join(', ')}\r\n` : '';

    const isHtml = !!params.htmlBody;
    const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
    const bodyContent = isHtml ? params.htmlBody! : params.body;

    const emailLines = [
      `To: ${toHeader}`,
      ccHeader.trim() ? ccHeader.trim() : '',
      bccHeader.trim() ? bccHeader.trim() : '',
      `Subject: ${params.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: ${contentType}`,
      ``,
      bodyContent,
    ]
      .filter((line) => line !== '')
      .join('\r\n');

    return Buffer.from(emailLines)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Maps Gmail API errors to typed AppErrors.
   */
  private mapGmailError(err: unknown, operation: string): AppError {
    if (err instanceof Error) {
      const message = err.message.toLowerCase();

      if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid credentials')) {
        return Errors.authRequired();
      }
      if (message.includes('403') || message.includes('forbidden') || message.includes('permission')) {
        return Errors.permissionDenied('Gmail');
      }
      if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
        return Errors.rateLimitExceeded();
      }

      return new AppError(
        ErrorCode.GMAIL_API_ERROR,
        `Gmail API error during ${operation}: ${err.message}`
      );
    }
    return Errors.gmailApiError(`Unexpected error during ${operation}`);
  }
}

export const gmailService = new GmailService();
