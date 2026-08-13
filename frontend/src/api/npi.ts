import { resolveApiBaseUrl } from '../config/app-urls';

export type NpiVerifyResponse = {
  valid: boolean;
  npi: string;
  duplicate: boolean;
  providerName?: string;
  providerType?: string;
  practiceAddress?: string;
  error?: string;
};

/** Real-time NPI check (NIH Clinical Tables via CHT backend). */
export async function verifyNpiNumber(npi: string): Promise<NpiVerifyResponse> {
  const digits = npi.replace(/\D/g, '').slice(0, 10);
  const base = resolveApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(
    `${base}/auth/npi/verify?npi=${encodeURIComponent(digits)}`,
    { method: 'GET', credentials: 'include' },
  );
  const data = (await res.json().catch(() => ({}))) as Partial<NpiVerifyResponse>;
  if (!res.ok) {
    return {
      valid: false,
      npi: digits,
      duplicate: false,
      error:
        (typeof data.error === 'string' && data.error) ||
        'NPI verification failed. Please try again.',
    };
  }
  return {
    valid: Boolean(data.valid),
    npi: typeof data.npi === 'string' ? data.npi : digits,
    duplicate: Boolean(data.duplicate),
    providerName: data.providerName,
    providerType: data.providerType,
    practiceAddress: data.practiceAddress,
    error: typeof data.error === 'string' ? data.error : undefined,
  };
}
