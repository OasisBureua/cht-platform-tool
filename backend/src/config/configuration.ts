export default () => ({
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Database
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // Auth0 (legacy)
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
    clientId: process.env.AUTH0_CLIENT_ID,
  },

  // GoTrue / shared CHT auth (mediahub.communityhealth.media/auth/v1)
  gotrue: {
    jwtSecret: process.env.GOTRUE_JWT_SECRET,
  },

  // Supabase Auth (for backend login validation)
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },

  // Session TTL in seconds (default 30 min). Sessions cached in Redis.
  sessionTtlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '1800', 10),

  // Bill.com
  bill: {
    devKey: process.env.BILL_DEV_KEY,
    sessionId: process.env.BILL_SESSION_ID,
    username: process.env.BILL_USERNAME,
    password: process.env.BILL_PASSWORD,
    orgId: process.env.BILL_ORG_ID,
    fundingAccountId: process.env.BILL_FUNDING_ACCOUNT_ID,
    apiUrl: process.env.BILL_API_URL,
    webhookSecret: process.env.BILL_WEBHOOK_SECRET,
  },

  // AWS
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  // SQS (payment queue only for now)
  sqs: {
    paymentQueueUrl: process.env.SQS_PAYMENT_QUEUE_URL,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: (() => {
      const p = parseInt(process.env.REDIS_PORT || '6379', 10);
      return Number.isNaN(p) ? 6379 : p;
    })(),
    tls: process.env.REDIS_TLS === 'true' || process.env.REDIS_TLS === '1',
    tlsRejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false' && process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== '0',
  },

  // Surveys (optional survey bonus payment in cents, 0 = disabled)
  surveys: {
    bonusAmountCents: parseInt(process.env.SURVEY_BONUS_AMOUNT_CENTS || '0', 10),
  },

  // MediaHub Public API (catalog - clips, tags, doctors, search)
  mediahub: {
    baseUrl: process.env.MEDIAHUB_BASE_URL || 'https://mediahub.communityhealth.media/api/public',
    apiKey: process.env.MEDIAHUB_API_KEY,
  },

  // YouTube Data API v3 (for catalog playlists - fallback when MediaHub not configured)
  youtube: (() => {
    let ids: string[] =
      process.env.YOUTUBE_PLAYLIST_IDS?.split(',')
        .map((id) => id.trim())
        .filter(Boolean) || [];
    if (ids.length === 0) {
      try {
        const fs = require('fs');
        const path = require('path');
        const dataDir = path.resolve(process.cwd(), '..', 'data');
        const csvPath = process.env.YOUTUBE_PLAYLIST_CSV
          ? path.resolve(process.cwd(), process.env.YOUTUBE_PLAYLIST_CSV)
          : [path.join(dataDir, 'youtube-playlists.csv'), path.join(dataDir, 'YT Playlist IDs - Sheet1.csv')].find(
              (p) => fs.existsSync(p),
            ) || path.join(dataDir, 'youtube-playlists.csv');
        if (fs.existsSync(csvPath)) {
          const content = fs.readFileSync(csvPath, 'utf8');
          const lines = content.split(/\r?\n/).filter((l) => l.trim());
          const start = lines[0]?.toLowerCase().includes('playlist') ? 1 : 0;
          const idRegex = /PL[\w-]{20,}/g;
          for (let i = start; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('#')) continue;
            const matches = line.match(idRegex);
            if (matches) ids.push(...matches);
          }
          ids = [...new Set(ids)];
        }
      } catch {
        /* ignore */
      }
    }
    return {
      apiKey: process.env.YOUTUBE_API_KEY,
      playlistIds: ids,
    };
  })(),

  // Jotform (surveys - enterprise at communityhealthmedia.jotform.com; note /API is uppercase)
  jotform: {
    apiKey: process.env.JOTFORM_API_KEY,
    baseUrl: process.env.JOTFORM_BASE_URL || 'https://communityhealthmedia.jotform.com/API',
    templateFormId: process.env.JOTFORM_TEMPLATE_FORM_ID || '260698533879881',
    webhookUrl:
      process.env.JOTFORM_WEBHOOK_URL ||
      (process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/api/webhooks/jotform`
        : 'https://testapp.communityhealth.media/api/webhooks/jotform'),
  },

  // Zoom (Server-to-Server OAuth for webinars)
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID,
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
    webhookSecret: process.env.ZOOM_WEBHOOK_SECRET,
    /** Meeting SDK (embed in browser) — separate Zoom Marketplace "Meeting SDK" app */
    sdkKey: process.env.ZOOM_SDK_KEY,
    sdkSecret: process.env.ZOOM_SDK_SECRET,
  },

  // Admin bootstrap (one-time first-admin promotion secret)
  adminBootstrapSecret: process.env.ADMIN_BOOTSTRAP_SECRET,

  // HubSpot (CRM contact sync - private app access token)
  hubspot: {
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
  },

  // Mailchimp (audience sync — NPI merge field on signup/profile update).
  // MAILCHIMP_SERVER is what MediaHub uses; accept either name so a single
  // shared `~/.config/chm-mediahub/mailchimp.env` works for both services.
  mailchimp: {
    apiKey: process.env.MAILCHIMP_API_KEY,
    audienceId: process.env.MAILCHIMP_AUDIENCE_ID,
    serverPrefix: process.env.MAILCHIMP_SERVER || process.env.MAILCHIMP_SERVER_PREFIX,
  },
});
