/** Survives the Cognito logout redirect (same tab) so the landing page can explain the sign-out. */
export const TERMS_DECLINED_KEY = 'cht-terms-declined';

export function markTermsDeclined(): void {
  try {
    sessionStorage.setItem(TERMS_DECLINED_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

export function readTermsDeclined(): boolean {
  try {
    return sessionStorage.getItem(TERMS_DECLINED_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearTermsDeclined(): void {
  try {
    sessionStorage.removeItem(TERMS_DECLINED_KEY);
  } catch {
    /* storage unavailable */
  }
}
