import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface JotformUserResponse {
  responseCode?: number;
  content?: {
    username?: string;
    email?: string;
    account_type?: string;
    [key: string]: unknown;
  };
  message?: string;
}

interface JotformCloneResponse {
  responseCode?: number;
  content?: { id: string; title?: string; url?: string };
  message?: string;
}

interface JotformWebhookResponse {
  responseCode?: number;
  content?: Record<string, string>;
  message?: string;
}

@Injectable()
export class JotformService {
  constructor(private config: ConfigService) {}

  private getBaseUrl(): string {
    const raw = this.config.get<string>('jotform.baseUrl')?.replace(/\/$/, '').trim();
    return raw || 'https://api.jotform.com';
  }

  private getApiKey(): string {
    const key = this.config.get<string>('jotform.apiKey');
    if (!key?.trim()) throw new Error('JOTFORM_API_KEY not configured');
    return key.trim();
  }

  /** Jotform uses responseCode in JSON body; success is any 2xx (same rule as official Node client). */
  private isJotformSuccess(responseCode: unknown): boolean {
    return responseCode !== undefined && responseCode !== null && String(responseCode).startsWith('2');
  }

  private apiKeyHeaders(): Record<string, string> {
    return {
      APIKEY: this.getApiKey(),
      Accept: 'application/json',
    };
  }

  /**
   * Clone a Jotform form (template). Returns the new form ID.
   * @see https://api.jotform.com/docs/#clone-form
   */
  async cloneForm(templateFormId: string): Promise<{ formId: string; title: string; url: string }> {
    const base = this.getBaseUrl();
    const id = encodeURIComponent(templateFormId.trim());
    const url = `${base}/form/${id}/clone`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.apiKeyHeaders(),
    });
    const rawBody = await res.text();
    let data: JotformCloneResponse;
    try {
      data = JSON.parse(rawBody) as JotformCloneResponse;
    } catch {
      throw new Error(`Clone failed: invalid JSON (HTTP ${res.status}) ${rawBody.slice(0, 200)}`);
    }
    if (!this.isJotformSuccess(data?.responseCode) || !data?.content?.id) {
      throw new Error(
        data?.message || `Clone failed: HTTP ${res.status} (responseCode ${String(data?.responseCode)})`,
      );
    }
    return {
      formId: data.content.id,
      title: data.content.title || 'Cloned Survey',
      url: data.content.url || `https://www.jotform.com/${data.content.id}`,
    };
  }

  /**
   * Add webhook to a Jotform form. Uses configured webhook URL if not provided.
   * @see https://api.jotform.com/docs/#form-webhooks
   */
  async addWebhook(formId: string, webhookUrl?: string): Promise<void> {
    const hookUrl = webhookUrl || this.config.get<string>('jotform.webhookUrl');
    if (!hookUrl) throw new Error('JOTFORM_WEBHOOK_URL or FRONTEND_URL not configured');
    const base = this.getBaseUrl();
    const fid = encodeURIComponent(formId.trim());
    const url = `${base}/form/${fid}/webhooks`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.apiKeyHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ webhookURL: hookUrl }).toString(),
    });
    const rawWebhook = await res.text();
    let data: JotformWebhookResponse;
    try {
      data = JSON.parse(rawWebhook) as JotformWebhookResponse;
    } catch {
      throw new Error(`Add webhook failed: invalid JSON (HTTP ${res.status}) ${rawWebhook.slice(0, 200)}`);
    }
    if (!this.isJotformSuccess(data?.responseCode)) {
      throw new Error(
        data?.message || `Add webhook failed: HTTP ${res.status} (responseCode ${String(data?.responseCode)})`,
      );
    }
  }

  /**
   * Test Jotform API connectivity using the /user endpoint.
   * Returns user info if the API key is valid.
   * @see https://api.jotform.com/docs/#user
   */
  async testConnection(): Promise<{ connected: boolean; username?: string; error?: string }> {
    const apiKey = this.config.get<string>('jotform.apiKey');

    if (!apiKey?.trim()) {
      return { connected: false, error: 'JOTFORM_API_KEY not configured' };
    }

    try {
      const base = this.getBaseUrl();
      const url = `${base}/user`;
      const res = await fetch(url, { headers: this.apiKeyHeaders() });
      const rawUser = await res.text();
      let data: JotformUserResponse;
      try {
        data = JSON.parse(rawUser) as JotformUserResponse;
      } catch {
        return { connected: false, error: `Invalid JSON from Jotform (HTTP ${res.status})` };
      }

      if (!this.isJotformSuccess(data?.responseCode)) {
        return {
          connected: false,
          error: data?.message || `HTTP ${res.status} (responseCode ${String(data?.responseCode)})`,
        };
      }

      const content = data?.content;
      if (content?.username) {
        return { connected: true, username: content.username as string };
      }

      return { connected: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, error: msg };
    }
  }
}
