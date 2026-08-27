export default () => ({
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  app: {
    name: process.env.APP_NAME?.trim() || 'cht-platform-backend',
    environment:
      process.env.CHT_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV?.trim() ||
      'development',
    imageTag:
      process.env.IMAGE_TAG?.trim() ||
      process.env.APP_VERSION?.trim() ||
      'local',
    containerImage: process.env.CONTAINER_IMAGE?.trim() || '',
  },

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

  // Amazon Cognito (replaces GoTrue when COGNITO_USER_POOL_ID is set)
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID?.trim() || '',
    clientId: process.env.COGNITO_CLIENT_ID?.trim() || '',
    region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1',
    /** MRR replica region — tokens may carry this region's cognito-idp host in `iss`. */
    replicaRegion:
      process.env.COGNITO_REPLICA_REGION?.trim() || 'us-east-2',
    hostedUiBaseUrl: process.env.COGNITO_HOSTED_UI_BASE_URL?.trim() || '',
    domainPrefix: process.env.COGNITO_DOMAIN_PREFIX?.trim() || '',
    jwksUri: process.env.COGNITO_JWKS_URI?.trim() || '',
  },

  // Supabase Auth (for backend login validation)
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    /**
     * When true, block MediaHub/GoTrue-backed user creation flows (signup + oauth login).
     * Existing email/password login can remain temporarily available for migrated users.
     */
    authDecommissioned:
      process.env.SUPABASE_AUTH_DECOMMISSIONED === undefined
        ? true
        : process.env.SUPABASE_AUTH_DECOMMISSIONED === 'true' ||
          process.env.SUPABASE_AUTH_DECOMMISSIONED === '1',
  },

  // Idle session TTL in seconds (default 30 min). Slid on getSession activity.
  sessionTtlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '1800', 10),
  // Absolute session TTL from create (default 8h). Not extended by activity.
  sessionAbsoluteTtlSeconds: parseInt(
    process.env.SESSION_ABSOLUTE_TTL_SECONDS || '28800',
    10,
  ),

  recaptcha: {
    secretKey: process.env.RECAPTCHA_SECRET_KEY?.trim() || '',
    minScore: parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5'),
  },

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
    /** From POST /v3/mfa/challenge/validate with rememberMe: true (expires ~30 days). Required for MFA-trusted operations like payments. */
    mfaRememberMeId: process.env.BILL_MFA_REMEMBER_ME_ID,
    /** Device nickname; must be set together with mfaRememberMeId on POST /v3/login. */
    mfaDeviceName: process.env.BILL_MFA_DEVICE_NAME,
    /**
     * When true, skips the local MFA-trust guard before POST /v3/payments. Bill may still return BDC_1361.
     * Use only when you cannot obtain rememberMe / trusted session (e.g. sandbox), not as a prod workaround.
     */
    allowUntrustedPayments:
      process.env.BILL_ALLOW_UNTRUSTED_PAYMENTS === 'true' ||
      process.env.BILL_ALLOW_UNTRUSTED_PAYMENTS === '1',
    /** Min time between POST /v3/login for the pay flow; default 30m (Bill idle ~35m). */
    paySessionCacheTtlMs: (() => {
      const d = parseInt(process.env.BILL_PAY_SESSION_CACHE_MS || '', 10);
      if (Number.isNaN(d) || d < 60_000) return 30 * 60 * 1000;
      return d;
    })(),
  },

  // AWS
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  /** Public session banner images (S3 presigned PUT from admin; learners load `sessionHeroImageUrl`). */
  sessionAssets: {
    s3Bucket: process.env.SESSION_ASSETS_S3_BUCKET?.trim() || '',
    publicUrlBase: process.env.SESSION_ASSETS_PUBLIC_URL_BASE?.trim() || '',
  },

  /**
   * Zoom cloud recordings use the existing session-assets bucket with prefix
   * `zoom-recordings/` (private; only `session-heroes/*` is public-read).
   */
  zoomRecordings: {
    s3Bucket: process.env.SESSION_ASSETS_S3_BUCKET?.trim() || '',
  },

  // Transactional email (Amazon SES): e.g. registration approved for Live / Office Hours
  email: {
    // RFC-5322 mailbox format: "Display Name" <address@domain>. SESv2 accepts
    // this form and the display name renders as the sender in the recipient's
    // inbox instead of the bare address's local-part.
    from:
      (process.env.EMAIL_FROM ||
        '"Community Health Media" <info@communityhealth.media>').trim(),
    /** Set EMAIL_ENABLED to false, 0, or no to skip sending (e.g. local dev without IAM). */
    enabled: (() => {
      const v = (process.env.EMAIL_ENABLED || 'true').toLowerCase();
      return v !== 'false' && v !== '0' && v !== 'no';
    })(),
  },

  // SQS (payment queue only for now)
  sqs: {
    paymentQueueUrl: process.env.SQS_PAYMENT_QUEUE_URL,
  },

  // Surveys (optional survey bonus payment in cents, 0 = disabled)
  surveys: {
    bonusAmountCents: parseInt(
      process.env.SURVEY_BONUS_AMOUNT_CENTS || '0',
      10,
    ),
    useNativeForms:
      process.env.SURVEYS_USE_NATIVE_FORMS?.trim().toLowerCase() !== 'false' &&
      process.env.SURVEYS_USE_LEGACY_JOTFORM_FORMS?.trim().toLowerCase() !==
        'true',
    useLegacyJotformForms:
      process.env.SURVEYS_USE_LEGACY_JOTFORM_FORMS?.trim().toLowerCase() ===
      'true',
  },

  // MediaHub Public API (catalog - clips, tags, doctors, search)
  mediahub: {
    baseUrl:
      process.env.MEDIAHUB_BASE_URL ||
      'https://mediahub.communityhealth.media/api/public',
    apiKey: process.env.MEDIAHUB_API_KEY,
  },

  // Content Hub: KOL GET /kols* and dual HCP upsert (with EC2 MediaHub when configured)
  contenthub: {
    baseUrl: process.env.CONTENTHUB_BASE_URL || '',
    adminBaseUrl: (() => {
      const explicit = process.env.CONTENTHUB_ADMIN_BASE_URL?.trim();
      if (explicit) return explicit.replace(/\/$/, '');
      const pub = (process.env.CONTENTHUB_BASE_URL || '').replace(/\/$/, '');
      if (!pub) return '';
      return pub.replace(/\/api\/public\/?$/, '/api/admin');
    })(),
    apiKey: process.env.CONTENTHUB_API_KEY,
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
        const txtPath = path.join(dataDir, 'youtube-playlist-ids.txt');
        if (fs.existsSync(txtPath)) {
          ids = fs
            .readFileSync(txtPath, 'utf8')
            .split(/\r?\n/)
            .map((l: string) => l.trim())
            .filter((l: string) => l && !l.startsWith('#') && l.startsWith('PL'));
        }
        if (ids.length === 0) {
          const csvPath = process.env.YOUTUBE_PLAYLIST_CSV
            ? path.resolve(process.cwd(), process.env.YOUTUBE_PLAYLIST_CSV)
            : [
                path.join(dataDir, 'youtube-playlists.csv'),
                path.join(dataDir, 'YT Playlist IDs - Sheet1.csv'),
              ].find((p) => fs.existsSync(p)) ||
              path.join(dataDir, 'youtube-playlists.csv');
          if (fs.existsSync(csvPath)) {
            const content = fs.readFileSync(csvPath, 'utf8');
            const lines = content.split(/\r?\n/).filter((l: string) => l.trim());
            const start = lines[0]?.toLowerCase().includes('playlist') ? 1 : 0;
            const idRegex = /PL[\w-]{20,}/g;
            for (let i = start; i < lines.length; i++) {
              const line = lines[i];
              if (line.startsWith('#')) continue;
              const matches = line.match(idRegex);
              if (matches) ids.push(...matches);
            }
          }
        }
        ids = [...new Set(ids)];
      } catch {
        /* ignore */
      }
    }
    return {
      apiKey: process.env.YOUTUBE_API_KEY,
      playlistIds: ids,
    };
  })(),

  // Jotform: REST API per https://api.jotform.com/docs/ (use EU/HIPAA host or Enterprise …/API via JOTFORM_BASE_URL when required)
  jotform: {
    apiKey: process.env.JOTFORM_API_KEY,
    baseUrl: process.env.JOTFORM_BASE_URL?.trim() || 'https://api.jotform.com',
    /** Master Jotform form ID to clone per webinar for invitation / registration (set in env; no hardcoded default). */
    invitationTemplateFormId:
      process.env.JOTFORM_WEBINAR_INVITATION_TEMPLATE_FORM_ID?.trim() ||
      process.env.JOTFORM_WEBINAR_INTAKE_TEMPLATE_FORM_ID?.trim() ||
      '',
    /** Master Jotform form ID to clone per webinar for post-event survey (ignored when postEventSharedFormId is set). */
    postEventTemplateFormId:
      process.env.JOTFORM_WEBINAR_POST_EVENT_TEMPLATE_FORM_ID?.trim() ||
      process.env.JOTFORM_TEMPLATE_FORM_ID?.trim() ||
      '',
    /**
     * When set, webinars reuse this Jotform form ID for post-event FEEDBACK (no clone/webhook from our API).
     * Prefer this for a single org-wide post-event form; leave empty to clone from postEventTemplateFormId instead.
     */
    postEventSharedFormId:
      process.env.JOTFORM_WEBINAR_POST_EVENT_SHARED_FORM_ID?.trim() || '',
    /**
     * Optional fallback intake URL when a WEBINAR has no per-program `jotformIntakeFormUrl` (prefer per-webinar clones).
     */
    webinarDefaultIntakeUrl:
      process.env.JOTFORM_WEBINAR_DEFAULT_INTAKE_URL?.trim() || '',
    webhookUrl:
      process.env.JOTFORM_WEBHOOK_URL ||
      (process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/api/webhooks/jotform`
        : 'https://testapp.communityhealth.media/api/webhooks/jotform'),
  },

  /**
   * Legacy env flag: LIVE listing now always merges upcoming Zoom webinars when Zoom is configured.
   * Kept for backwards compatibility; no longer gates listing behavior.
   */
  webinars: {
    listZoomFallback: process.env.WEBINARS_LIST_ZOOM_FALLBACK === 'true',
  },

  // Zoom (Server-to-Server OAuth for webinars)
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID,
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
    webhookSecret: process.env.ZOOM_WEBHOOK_SECRET,
    /** Meeting SDK (embed in browser) - separate Zoom Marketplace "Meeting SDK" app */
    sdkKey: process.env.ZOOM_SDK_KEY,
    sdkSecret: process.env.ZOOM_SDK_SECRET,
  },

  // Admin bootstrap (one-time first-admin promotion secret)
  adminBootstrapSecret: process.env.ADMIN_BOOTSTRAP_SECRET,

  // HubSpot (CRM contact sync - private app access token)
  hubspot: {
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
  },

  catalog: {
    useContentHub:
      process.env.CATALOG_USE_CONTENTHUB?.trim().toLowerCase() === 'true' ||
      !!process.env.CONTENTHUB_BASE_URL?.trim(),
    wordpressOnly:
      process.env.CATALOG_WORDPRESS_ONLY?.trim().toLowerCase() !== 'false',
    clipsCacheTtlSeconds: parseInt(
      process.env.CATALOG_CLIPS_CACHE_TTL_SECONDS || '1800',
      10,
    ), // 30 minutes: public clips / catalog
    wordpressCacheTtlSeconds: parseInt(
      process.env.CATALOG_WORDPRESS_CACHE_TTL_SECONDS || '300',
      10,
    ), // 5 minutes: admin Content + WP editorial
  },

  redis: {
    url: process.env.REDIS_URL?.trim() || '',
    ttlSeconds: parseInt(process.env.REDIS_CACHE_TTL_SECONDS || '1800', 10), // 30 minutes
  },

  internalCache: {
    secret: process.env.INTERNAL_CACHE_SECRET?.trim() || '',
  },

  /**
   * NIH Clinical Tables individual NPI search (CMS NPPES-backed).
   * Public free API — no secret/API key. Override only if the endpoint moves.
   */
  npi: {
    apiBaseUrl:
      process.env.NPI_API_BASE_URL?.trim() ||
      'https://clinicaltables.nlm.nih.gov/api/npi_idv/v3/search',
    timeoutMs: parseInt(process.env.NPI_API_TIMEOUT_MS || '8000', 10),
  },
});
