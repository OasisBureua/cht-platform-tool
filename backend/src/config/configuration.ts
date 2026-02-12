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
  },

  // AWS
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  // SQS
  sqs: {
    emailQueueUrl: process.env.SQS_EMAIL_QUEUE_URL,
    paymentQueueUrl: process.env.SQS_PAYMENT_QUEUE_URL,
    cmeQueueUrl: process.env.SQS_CME_QUEUE_URL,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  // Surveys (optional survey bonus payment in cents, 0 = disabled)
  surveys: {
    bonusAmountCents: parseInt(process.env.SURVEY_BONUS_AMOUNT_CENTS || '0', 10),
  },

  // YouTube Data API v3 (for catalog playlists)
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
    playlistIds: process.env.YOUTUBE_PLAYLIST_IDS?.split(',').map((id) => id.trim()).filter(Boolean) || [],
  },

  // Zoom (Server-to-Server OAuth for webinars)
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID,
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
  },
});
