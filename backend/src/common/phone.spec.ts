import { maskPhoneE164, normalizeUsPhoneE164 } from './phone';

describe('phone', () => {
  it('normalizes US formats to E.164', () => {
    expect(normalizeUsPhoneE164('(555) 123-4567')).toBe('+15551234567');
    expect(normalizeUsPhoneE164('1-555-123-4567')).toBe('+15551234567');
    expect(normalizeUsPhoneE164('+1 555 123 4567')).toBe('+15551234567');
  });

  it('rejects invalid numbers', () => {
    expect(normalizeUsPhoneE164('123')).toBeNull();
    expect(normalizeUsPhoneE164('')).toBeNull();
  });

  it('masks for display', () => {
    expect(maskPhoneE164('+15551234567')).toBe('+1••••••4567');
  });
});
