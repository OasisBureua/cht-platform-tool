/** Signup password rules: ticket AC + Cognito policy (lower + number). */
export type PasswordRuleId =
  | 'minLength'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'symbol';

export type PasswordRule = {
  id: PasswordRuleId;
  label: string;
  test: (password: string) => boolean;
};

export const SIGNUP_PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'minLength',
    label: 'At least 8 characters',
    test: (p) => p.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'One capital letter',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: 'number',
    label: 'One number',
    test: (p) => /\d/.test(p),
  },
  {
    id: 'symbol',
    label: 'One symbol (e.g. !@#$%)',
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export function evaluatePasswordRules(password: string): Record<PasswordRuleId, boolean> {
  const out = {} as Record<PasswordRuleId, boolean>;
  for (const rule of SIGNUP_PASSWORD_RULES) {
    out[rule.id] = rule.test(password);
  }
  return out;
}

export function isPasswordValid(password: string): boolean {
  return SIGNUP_PASSWORD_RULES.every((r) => r.test(password));
}
