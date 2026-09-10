/**
 * Tool handler: gmail_send_email
 *
 * Sends an email via the authenticated Gmail account.
 *
 * WARNING: This action is PERMANENT. The email will be delivered immediately.
 * The consuming AI agent should implement a user-confirmation step before
 * invoking this tool.
 */

import { z } from 'zod';
import { gmailService } from '../../services/gmail-service.js';
import { buildMcpError, Errors } from '../../utils/error-handling.js';
import { validateEmailList } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';

// ─── Input Schema ─────────────────────────────────────────────────────────────

export const sendEmailSchema = z.object({
  to: z
    .array(z.string().email('Each recipient must be a valid email address.'))
    .min(1, 'At least one recipient (to) is required.'),
  cc: z
    .array(z.string().email('Each CC address must be a valid email address.'))
    .optional()
    .default([]),
  bcc: z
    .array(z.string().email('Each BCC address must be a valid email address.'))
    .optional()
    .default([]),
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Body is required.'),
  html_body: z.string().optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleSendEmail(rawInput: unknown) {
  // Step 1: Parse and validate input with Zod
  const parseResult = sendEmailSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const message = parseResult.error.errors.map((e) => e.message).join('; ');
    logger.warn({ input: rawInput }, `gmail_send_email: validation failed — ${message}`);
    return buildMcpError(Errors.invalidInput(message));
  }

  const input = parseResult.data;

  // Step 2: Additional email validation
  const allEmails = [...input.to, ...input.cc, ...input.bcc];
  const invalidEmail = validateEmailList(allEmails);
  if (invalidEmail) {
    return buildMcpError(Errors.invalidInput(`Invalid email address: "${invalidEmail}"`));
  }

  // Step 3: Call the Gmail service
  try {
    const result = await gmailService.sendEmail({
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      body: input.body,
      htmlBody: input.html_body,
    });

    return result;
  } catch (err) {
    logger.error({ err }, 'gmail_send_email: service error');
    return buildMcpError(err);
  }
}
