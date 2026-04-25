import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

export interface MailchimpUpsertInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  npi?: string | null;
  specialty?: string | null;
  institution?: string | null;
  city?: string | null;
  state?: string | null;
}

/**
 * Mailchimp Marketing API client — List/Audience member upsert.
 *
 * Audience schema (verified in CHM Mailchimp dashboard 2026-04-24):
 *   NPI     — Text (10), tag NPI       — present
 *   FNAME   — Text, default            — present
 *   LNAME   — Text, default            — present
 *   COMPANY — Text, tag COMPANY        — present (used for institution)
 *
 * Missing merge tags are silently dropped by Mailchimp without failing the
 * PUT, so the rest of the request still succeeds.
 */
@Injectable()
export class MailchimpSyncService {
  private readonly logger = new Logger(MailchimpSyncService.name);
  private readonly apiKey: string | null;
  private readonly serverPrefix: string | null;
  private readonly audienceId: string | null;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('mailchimp.apiKey')?.trim() || null;
    this.audienceId = this.config.get<string>('mailchimp.audienceId')?.trim() || null;
    // Mailchimp API keys are suffixed with the DC (e.g. `abc123-us14`); we
    // accept either `MAILCHIMP_SERVER_PREFIX=us14` or parse it from the key.
    this.serverPrefix =
      this.config.get<string>('mailchimp.serverPrefix')?.trim() ||
      this.apiKey?.split('-').pop() ||
      null;

    if (!this.apiKey || !this.audienceId || !this.serverPrefix) {
      this.logger.warn(
        '[Mailchimp] not configured (missing MAILCHIMP_API_KEY / MAILCHIMP_AUDIENCE_ID / MAILCHIMP_SERVER_PREFIX) — sync disabled',
      );
    }
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.audienceId && this.serverPrefix);
  }

  /**
   * Upsert a subscriber in the Mailchimp audience, keyed on md5(lowercase(email)).
   * Uses PUT /lists/{list_id}/members/{subscriber_hash} which is idempotent and
   * does not flip an unsubscribed contact back to subscribed (uses status_if_new).
   */
  async upsertMember(input: MailchimpUpsertInput): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const email = (input.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.logger.debug(`[Mailchimp] skip upsert: invalid email`);
      return false;
    }

    const subscriberHash = createHash('md5').update(email).digest('hex');

    const mergeFields: Record<string, string> = {};
    if (input.firstName) mergeFields.FNAME = input.firstName.trim();
    if (input.lastName) mergeFields.LNAME = input.lastName.trim();
    if (input.npi) mergeFields.NPI = String(input.npi).replace(/\D/g, '').slice(0, 10);
    if (input.institution) mergeFields.COMPANY = input.institution.trim();
    // specialty has no merge field in the audience today — drop silently.

    const body = {
      email_address: email,
      status_if_new: 'subscribed',
      merge_fields: mergeFields,
    };

    const url = `https://${this.serverPrefix}.api.mailchimp.com/3.0/lists/${this.audienceId}/members/${subscriberHash}`;

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`apikey:${this.apiKey}`).toString('base64')}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `[Mailchimp] upsert failed: ${res.status} ${res.statusText} - ${text.slice(0, 200)}`,
        );
        return false;
      }
      this.logger.debug(`[Mailchimp] member upserted: ${email}`);
      return true;
    } catch (err) {
      this.logger.error(`[Mailchimp] upsert error for ${email}:`, err);
      return false;
    }
  }
}
