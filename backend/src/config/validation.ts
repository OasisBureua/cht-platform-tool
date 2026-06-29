import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().default(3000),
  FRONTEND_URL: Joi.string().default('http://localhost:5173'),
  LOG_PRETTY: Joi.string().valid('true', 'false', '1', '0', '').optional(),
  APP_NAME: Joi.string().allow('').optional(),
  CHT_ENVIRONMENT: Joi.string().allow('').optional(),
  IMAGE_TAG: Joi.string().allow('').optional(),
  APP_VERSION: Joi.string().allow('').optional(),
  CONTAINER_IMAGE: Joi.string().allow('').optional(),

  // Database (required)
  DATABASE_URL: Joi.string().required(),

  // Auth0 (optional - empty strings allowed)
  AUTH0_DOMAIN: Joi.string().allow('').optional(),
  AUTH0_AUDIENCE: Joi.string().allow('').optional(),
  AUTH0_CLIENT_ID: Joi.string().allow('').optional(),

  // GoTrue/Supabase auth wiring (optional during migration)
  GOTRUE_JWT_SECRET: Joi.string().allow('').optional(),
  SUPABASE_URL: Joi.string().allow('').optional(),
  SUPABASE_ANON_KEY: Joi.string().allow('').optional(),
  SUPABASE_AUTH_DECOMMISSIONED: Joi.string()
    .valid('true', 'false', '1', '0', '')
    .optional(),

  // Cognito (optional — when set, Cognito replaces GoTrue for auth)
  COGNITO_USER_POOL_ID: Joi.string().allow('').optional(),
  COGNITO_CLIENT_ID: Joi.string().allow('').optional(),
  COGNITO_REGION: Joi.string().allow('').optional(),
  COGNITO_HOSTED_UI_BASE_URL: Joi.string().allow('').optional(),
  COGNITO_DOMAIN_PREFIX: Joi.string().allow('').optional(),
  COGNITO_JWKS_URI: Joi.string().allow('').optional(),

  RECAPTCHA_SECRET_KEY: Joi.string().allow('').optional(),
  RECAPTCHA_MIN_SCORE: Joi.number().min(0).max(1).optional(),

  // Bill.com (optional - empty strings allowed)
  BILL_DEV_KEY: Joi.string().allow('').optional(),
  BILL_SESSION_ID: Joi.string().allow('').optional(),
  BILL_USERNAME: Joi.string().allow('').optional(),
  BILL_PASSWORD: Joi.string().allow('').optional(),
  BILL_ORG_ID: Joi.string().allow('').optional(),
  BILL_FUNDING_ACCOUNT_ID: Joi.string().allow('').optional(),
  BILL_API_URL: Joi.string().allow('').optional(),
  BILL_MFA_REMEMBER_ME_ID: Joi.string().allow('').optional(),
  BILL_MFA_DEVICE_NAME: Joi.string().allow('').optional(),
  BILL_ALLOW_UNTRUSTED_PAYMENTS: Joi.string()
    .valid('true', 'false', '1', '0', '')
    .optional(),
  BILL_PAY_SESSION_CACHE_MS: Joi.string().allow('').optional(),

  // AWS (optional - empty strings allowed)
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),

  SESSION_ASSETS_S3_BUCKET: Joi.string().allow('').optional(),
  SESSION_ASSETS_PUBLIC_URL_BASE: Joi.string().allow('').optional(),

  // Amazon SES (registration-approved, etc.)
  EMAIL_FROM: Joi.string().email().allow('').optional(),
  EMAIL_ENABLED: Joi.string()
    .valid('true', 'false', '0', '1', 'yes', 'no', '')
    .optional(),

  // SQS (payment queue - optional for local dev)
  SQS_PAYMENT_QUEUE_URL: Joi.string().allow('').optional(),

  // Surveys
  SURVEY_BONUS_AMOUNT_CENTS: Joi.number().optional(),

  // MediaHub Public API (optional – for catalog clips, tags, doctors)
  MEDIAHUB_BASE_URL: Joi.string().allow('').optional(),
  MEDIAHUB_API_KEY: Joi.string().allow('').optional(),

  // YouTube (optional – for catalog playlists, fallback when MediaHub not configured)
  YOUTUBE_API_KEY: Joi.string().allow('').optional(),
  YOUTUBE_PLAYLIST_IDS: Joi.string().allow('').optional(),

  // Jotform (optional – for surveys)
  JOTFORM_API_KEY: Joi.string().allow('').optional(),
  JOTFORM_BASE_URL: Joi.string().allow('').optional(),
  JOTFORM_WEBINAR_DEFAULT_INTAKE_URL: Joi.string().allow('').optional(),
  JOTFORM_WEBINAR_INVITATION_TEMPLATE_FORM_ID: Joi.string()
    .allow('')
    .optional(),
  JOTFORM_WEBINAR_INTAKE_TEMPLATE_FORM_ID: Joi.string().allow('').optional(),
  JOTFORM_WEBINAR_POST_EVENT_TEMPLATE_FORM_ID: Joi.string()
    .allow('')
    .optional(),
  JOTFORM_WEBINAR_POST_EVENT_SHARED_FORM_ID: Joi.string().allow('').optional(),
  JOTFORM_TEMPLATE_FORM_ID: Joi.string().allow('').optional(),
  WEBINARS_LIST_ZOOM_FALLBACK: Joi.string()
    .valid('true', 'false', '1', '0')
    .optional(),

  // Zoom (optional – for webinars)
  ZOOM_ACCOUNT_ID: Joi.string().allow('').optional(),
  ZOOM_CLIENT_ID: Joi.string().allow('').optional(),
  ZOOM_CLIENT_SECRET: Joi.string().allow('').optional(),
  ZOOM_WEBHOOK_SECRET: Joi.string().allow('').optional(),

  // HubSpot (optional – CRM contact sync)
  HUBSPOT_ACCESS_TOKEN: Joi.string().allow('').optional(),

  // Mailchimp (optional – audience sync for NPI + marketing merge fields).
  // Accept both MAILCHIMP_SERVER (MediaHub naming) and MAILCHIMP_SERVER_PREFIX.
  MAILCHIMP_API_KEY: Joi.string().allow('').optional(),
  MAILCHIMP_AUDIENCE_ID: Joi.string().allow('').optional(),
  MAILCHIMP_SERVER: Joi.string().allow('').optional(),
  MAILCHIMP_SERVER_PREFIX: Joi.string().allow('').optional(),
});
