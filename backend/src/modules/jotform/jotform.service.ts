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
    return this.config.get<string>('jotform.baseUrl')?.replace(/\/$/, '') || 'https://communityhealthmedia.jotform.com/API';
  }

  private getApiKey(): string {
    const key = this.config.get<string>('jotform.apiKey');
    if (!key?.trim()) throw new Error('JOTFORM_API_KEY not configured');
    return key;
  }

  /**
   * Clone a Jotform form (template). Returns the new form ID.
   */
  async cloneForm(templateFormId: string): Promise<{ formId: string; title: string; url: string }> {
    const base = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const url = `${base}/form/${templateFormId}/clone?apiKey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { method: 'POST' });
    const data = (await res.json()) as JotformCloneResponse;
    if (data?.responseCode !== 200 || !data?.content?.id) {
      throw new Error(data?.message || `Clone failed: HTTP ${res.status}`);
    }
    return {
      formId: data.content.id,
      title: data.content.title || 'Cloned Survey',
      url: data.content.url || `https://communityhealthmedia.jotform.com/${data.content.id}`,
    };
  }

  /**
   * Add webhook to a Jotform form. Uses configured webhook URL if not provided.
   */
  async addWebhook(formId: string, webhookUrl?: string): Promise<void> {
    const hookUrl = webhookUrl || this.config.get<string>('jotform.webhookUrl');
    if (!hookUrl) throw new Error('JOTFORM_WEBHOOK_URL or FRONTEND_URL not configured');
    const base = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const url = `${base}/form/${formId}/webhooks`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ webhookURL: hookUrl, apiKey }).toString(),
    });
    const data = (await res.json()) as JotformWebhookResponse;
    if (data?.responseCode !== 200) {
      throw new Error(data?.message || `Add webhook failed: HTTP ${res.status}`);
    }
  }

  /**
   * Test Jotform API connectivity using the /user endpoint.
   * Returns user info if the API key is valid.
   */
  async testConnection(): Promise<{ connected: boolean; username?: string; error?: string }> {
    const apiKey = this.config.get<string>('jotform.apiKey');

    if (!apiKey?.trim()) {
      return { connected: false, error: 'JOTFORM_API_KEY not configured' };
    }

    try {
      const base = this.getBaseUrl();
      const url = `${base}/user?apiKey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      const data = (await res.json()) as JotformUserResponse;

      if (data?.responseCode === 401 || !res.ok) {
        return {
          connected: false,
          error: data?.message || `HTTP ${res.status}`,
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
