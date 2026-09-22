/**
 * One-shot backfill: push every existing CHT user with a valid NPI to
 * Content Hub + HubSpot.
 *
 * Motivation: outbound sync is wired on signup + profile-update going forward,
 * but any user who signed up before this landed never got propagated. Both
 * downstream endpoints are idempotent (HubSpot email-upsert, Content Hub
 * NPI-upsert) so re-running is safe.
 *
 * Usage (from backend/):
 *   npx ts-node --transpile-only src/scripts/backfill-outbound-sync.ts --dry-run
 *   npx ts-node --transpile-only src/scripts/backfill-outbound-sync.ts --apply
 *
 * Env vars read: DATABASE_URL, CONTENTHUB_BASE_URL, CONTENTHUB_API_KEY,
 *                HUBSPOT_ACCESS_TOKEN.
 */
import { PrismaClient } from '@prisma/client';

type Stats = {
  users_scanned: number;
  users_with_npi: number;
  hubspot_ok: number;
  contenthub_ok: number;
  errors: string[];
};

async function syncHubspot(user: {
  email: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  institution: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  npiNumber: string | null;
}): Promise<boolean> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN?.trim();
  if (!token) return false;
  const body = {
    inputs: [
      {
        id: user.email.toLowerCase(),
        idProperty: 'email',
        properties: {
          email: user.email.toLowerCase(),
          firstname: user.firstName,
          lastname: user.lastName,
          ...(user.specialty && { jobtitle: user.specialty }),
          ...(user.institution && { company: user.institution }),
          ...(user.city && { city: user.city }),
          ...(user.state && { state: user.state }),
          ...(user.zipCode && { zip: user.zipCode }),
          ...(user.npiNumber && { npi_number: user.npiNumber }),
        },
      },
    ],
  };
  const res = await fetch(
    'https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  return res.ok;
}

async function syncContentHub(user: {
  email: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  institution: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  npiNumber: string | null;
}): Promise<boolean> {
  const key = process.env.CONTENTHUB_API_KEY?.trim();
  const base = (process.env.CONTENTHUB_BASE_URL || '').replace(/\/$/, '');
  if (!key || !base || !user.npiNumber) return false;
  const res = await fetch(`${base}/hcp/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
    body: JSON.stringify({
      npi: user.npiNumber,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      specialty: user.specialty || undefined,
      city: user.city || undefined,
      state: user.state || undefined,
      zip: user.zipCode || undefined,
      institution: user.institution || undefined,
      source: 'cht-backfill',
    }),
  });
  return res.ok;
}

async function run(dry: boolean): Promise<Stats> {
  const prisma = new PrismaClient();
  const stats: Stats = {
    users_scanned: 0,
    users_with_npi: 0,
    hubspot_ok: 0,
    contenthub_ok: 0,
    errors: [],
  };

  try {
    const users = await prisma.user.findMany({
      where: { email: { not: '' } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        specialty: true,
        institution: true,
        city: true,
        state: true,
        zipCode: true,
        npiNumber: true,
      },
    });
    stats.users_scanned = users.length;
    console.log(`[backfill] scanned ${users.length} users`);

    for (const u of users) {
      const npi = (u.npiNumber || '').replace(/\D/g, '');
      const hasNpi = npi.length === 10;
      if (hasNpi) stats.users_with_npi++;

      if (dry) {
        console.log(
          `[DRY] would sync ${u.email} (npi=${hasNpi ? npi : 'none'})`,
        );
        continue;
      }

      // HubSpot always runs (even without NPI, for CRM); Content Hub only when
      // NPI is present (it's an HCP-only roster).
      const results = await Promise.allSettled([
        syncHubspot({ ...u, npiNumber: hasNpi ? npi : null }),
        hasNpi
          ? syncContentHub({ ...u, npiNumber: npi })
          : Promise.resolve(false),
      ]);

      if (results[0].status === 'fulfilled' && results[0].value)
        stats.hubspot_ok++;
      else if (results[0].status === 'rejected')
        stats.errors.push(`hubspot ${u.email}: ${results[0].reason}`);

      if (results[1].status === 'fulfilled' && results[1].value)
        stats.contenthub_ok++;
      else if (results[1].status === 'rejected')
        stats.errors.push(`contenthub ${u.email}: ${results[1].reason}`);

      // Be polite: throttle ~5 req/s so we don't tip HubSpot rate limits.
      await new Promise((r) => setTimeout(r, 200));
    }
  } finally {
    await prisma.$disconnect();
  }
  return stats;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const dry = argv.includes('--dry-run') || !apply;
  if (!apply && !dry) {
    console.error('Must pass --dry-run or --apply');
    process.exit(2);
  }
  const stats = await run(dry);
  console.log(`${dry ? 'DRY-RUN' : 'APPLIED'}:`, stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
