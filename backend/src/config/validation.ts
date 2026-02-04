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

  // Stripe (optional - empty strings allowed)
  STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
  STRIPE_PUBLISHABLE_KEY: Joi.string().allow('').optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').optional(),

  // AWS (optional - empty strings allowed)
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),

  // SQS (optional - empty strings allowed)
  SQS_EMAIL_QUEUE_URL: Joi.string().allow('').optional(),
  SQS_PAYMENT_QUEUE_URL: Joi.string().allow('').optional(),
  SQS_CME_QUEUE_URL: Joi.string().allow('').optional(),

  // SendGrid (optional - empty strings allowed)
  SENDGRID_API_KEY: Joi.string().allow('').optional(),
  SENDGRID_FROM_EMAIL: Joi.string()
    .email()
    .default('noreply@chtplatform.com'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  // Surveys
  SURVEY_BONUS_AMOUNT_CENTS: Joi.number().optional(),
});
