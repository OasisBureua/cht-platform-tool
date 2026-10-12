/**
 * Reserved email domains for test accounts (QA and end-to-end tests).
 * Accounts on these domains are never synced to HubSpot or the Content Hub
 * HCP roster, in any environment.
 *
 * simulator.amazonses.com is the SES mailbox simulator: mail to it is
 * accepted and discarded, so test users never reach a real inbox.
 */
export const TEST_ACCOUNT_EMAIL_DOMAINS = ['simulator.amazonses.com'] as const;

export function isTestAccountEmail(email: string | null | undefined): boolean {
  const domain = (email ?? '').trim().toLowerCase().split('@')[1];
  if (!domain) return false;
  return TEST_ACCOUNT_EMAIL_DOMAINS.some(
    (d) => domain === d || domain.endsWith(`.${d}`),
  );
}
