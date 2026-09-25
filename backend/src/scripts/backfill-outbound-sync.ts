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
 * Env vars read: DATABASE_URL, CONTENTHUB_BASE_URL,
 *   COGNITO_M2M_PLATFORM_CLIENT_ID, COGNITO_M2M_PLATFORM_CLIENT_SECRET,
 *   COGNITO_M2M_TOKEN_URL, COGNITO_M2M_HUB_SCOPES (optional),
 *   HUBSPOT_ACCESS_TOKEN.
 */
import { PrismaClient } from '@prisma/client';

type Stats = {
  users_scanned: number;
  users_with_npi: number;
  hubspot_ok: number;
  contenthub_ok: number;
  errors: string[];
};

async function mintContentHubM2mToken(): Promise<string | null> {
  const clientId = process.env.COGNITO_M2M_PLATFORM_CLIENT_ID?.trim();
  const clientSecret = process.env.COGNITO_M2M_PLATFORM_CLIENT_SECRET?.trim();
  const tokenUrl = process.env.COGNITO_M2M_TOKEN_URL?.trim();
  const scope =
    process.env.COGNITO_M2M_HUB_SCOPES?.trim() ||
    'hub/catalog.read hub/admin.read hub/admin.create hub/admin.update hub/admin.delete';
  if (!clientId || !clientSecret || !tokenUrl) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
  };
  return res.ok && json.access_token ? json.access_token : null;
}

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

async function syncContentHub(
  accessToken: string,
  user: {
    email: string;
    firstName: string;
    lastName: string;
    specialty: string | null;
    institution: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    npiNumber: string | null;
  },
): Promise<boolean> {
  const base = (process.env.CONTENTHUB_BASE_URL || '').replace(/\/$/, '');
  if (!base || !user.npiNumber) return false;
  const res = await fetch(`${base}/hcp/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
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

    const m2mToken = dry ? null : await mintContentHubM2mToken();
    if (!dry && !m2mToken) {
      console.warn(
        'Content Hub M2M not configured (COGNITO_M2M_PLATFORM_*); skipping Hub upserts',
      );
    }

    for (const user of users) {
      stats.users_scanned += 1;
      const npi = (user.npiNumber || '').replace(/\D/g, '');
      if (npi.length !== 10) continue;
      stats.users_with_npi += 1;
      const payload = { ...user, npiNumber: npi };

      if (dry) continue;

      try {
        if (await syncHubspot(payload)) stats.hubspot_ok += 1;
      } catch (err) {
        stats.errors.push(
          `hubspot ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (m2mToken) {
        try {
          if (await syncContentHub(m2mToken, payload)) stats.contenthub_ok += 1;
        } catch (err) {
          stats.errors.push(
            `contenthub ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  return stats;
}

const dry = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
run(dry)
  .then((stats) => {
    console.log(JSON.stringify({ dry, ...stats }, null, 2));
    if (stats.errors.length) process.exitCode = 1;
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
