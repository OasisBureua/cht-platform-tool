import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  FRONTEND_URL: Joi.string().default('http://localhost:5173'),

  // Database (required)
  DATABASE_URL: Joi.string().required(),

  // Auth0 (optional - empty strings allowed)
  AUTH0_DOMAIN: Joi.string().allow('').optional(),
  AUTH0_AUDIENCE: Joi.string().allow('').optional(),
  AUTH0_CLIENT_ID: Joi.string().allow('').optional(),

  // Bill.com (optional - empty strings allowed)
  BILL_DEV_KEY: Joi.string().allow('').optional(),
  BILL_SESSION_ID: Joi.string().allow('').optional(),
  BILL_USERNAME: Joi.string().allow('').optional(),
  BILL_PASSWORD: Joi.string().allow('').optional(),
  BILL_ORG_ID: Joi.string().allow('').optional(),
  BILL_FUNDING_ACCOUNT_ID: Joi.string().allow('').optional(),
  BILL_API_URL: Joi.string().allow('').optional(),

  // AWS (optional - empty strings allowed)
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),

  // SQS (payment queue - optional for local dev)
  SQS_PAYMENT_QUEUE_URL: Joi.string().allow('').optional(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_TLS: Joi.string().valid('true', 'false', '1', '0').optional(),

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

  // Zoom (optional – for webinars)
  ZOOM_ACCOUNT_ID: Joi.string().allow('').optional(),
  ZOOM_CLIENT_ID: Joi.string().allow('').optional(),
  ZOOM_CLIENT_SECRET: Joi.string().allow('').optional(),
  ZOOM_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  ZOOM_SDK_KEY: Joi.string().allow('').optional(),
  ZOOM_SDK_SECRET: Joi.string().allow('').optional(),

  // HubSpot (optional – CRM contact sync)
  HUBSPOT_ACCESS_TOKEN: Joi.string().allow('').optional(),
});
