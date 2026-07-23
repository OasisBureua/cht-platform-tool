import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { getSessionTokenFromRequest } from './auth/session-cookie';
import { isProductionEnv } from './utils/is-production-env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // Honor X-Forwarded-For from ALB so throttle/lockout keys by client IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // SCRUM-108: standard security headers via helmet.
  // - HSTS enabled in production so browsers refuse http:// downgrades (2yr max-age,
  //   subdomains included, ready for HSTS preload if we opt in later).
  // - contentSecurityPolicy: disabled — CHT serves the SPA from S3/CloudFront (not
  //   through this backend), so CSP belongs at the edge. Enabling here would only
  //   affect /api/* JSON responses where CSP has no effect anyway.
  // - crossOriginResourcePolicy: 'cross-origin' so testapp SPA + admin surfaces on
  //   different hostnames can consume API responses without CORP-mismatch blocks.
  // - referrerPolicy: 'no-referrer' — API responses never need to leak the referring
  //   URL to other origins.
  // Other defaults kept: X-Content-Type-Options, X-Frame-Options: SAMEORIGIN,
  // X-DNS-Prefetch-Control, X-Download-Options, X-Permitted-Cross-Domain-Policies.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      strictTransportSecurity: isProductionEnv()
        ? { maxAge: 63072000, includeSubDomains: true, preload: false }
        : false,
    }),
  );

  app.use(cookieParser());

  // Zoom webhook MUST run first to capture raw body before any other parser consumes the stream.
  app.use(
    '/api/webhooks/zoom',
    express.json({
      verify: (req: express.Request, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody =
          buf.toString('utf8');
      },
    }),
  );

  // Parse JSON body for auth and other routes (skip Zoom - it has its own parser above).
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (req.originalUrl?.startsWith('/api/webhooks/zoom')) return next();
      if (req.headers['content-type']?.includes('application/json')) {
        return express.json()(req, res, next);
      }
      return next();
    },
  );

  // Jotform sends multipart/form-data with rawRequest field. Parse it for the webhook route.
  const multerUpload = multer();
  app.use('/api/webhooks/jotform', multerUpload.none());
  const logger = app.get(Logger);

  // CORS: allow frontend origins. FRONTEND_URL from env (e.g. ECS) is added when set.
  const corsOrigins = [
    'https://testapp.communityhealth.media',
    'https://staging.testapp.communityhealth.media',
    'https://communityhealth.media',
    'https://www.communityhealth.media',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];
  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
  if (frontendUrl && !corsOrigins.includes(frontendUrl)) {
    corsOrigins.push(frontendUrl);
  }
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Set global prefix but exclude health endpoints
  app.setGlobalPrefix('api', {
    exclude: [
      'health',
      'health/ready',
      'health/live',
      'health/detail',
      'actuator/info',
    ],
  });

  // Swagger - available in all envs but only accessible internally in prod
  const authService = app.get(AuthService);
  app.use('/api/docs', async (req, res, next) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Admin session required.' });
    }
    const user = await authService.getSession(sessionToken);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    return next();
  });
  app.use('/api/docs-json', async (req, res, next) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Admin session required.' });
    }
    const user = await authService.getSession(sessionToken);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    return next();
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CHT Platform API')
    .setDescription(
      'Internal API for CHT Platform - admin operations, user management, programs, payments',
    )
    .setVersion(process.env.APP_VERSION || '1.0.0')
    .addCookieAuth('cht_session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'cht_session',
      description:
        'Session cookie set by POST /api/auth/login. Swagger works when logged in as admin in the same browser.',
    })
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'session-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  const baseUrl =
    process.env.FRONTEND_URL ||
    process.env.API_BASE_URL ||
    `http://localhost:${port}`;
  logger.log(`🚀 Application is running on: ${baseUrl}`);
  logger.log(`📡 API base: ${baseUrl}/api`);
  logger.log(
    `🔐 Auth: ${process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? 'Supabase' : 'Dev (DB)'}`,
  );
  logger.log(`📊 Health check: ${baseUrl}/health`);
  logger.log(`🔍 Health ready: ${baseUrl}/health/ready`);
  logger.log(`💚 Health live: ${baseUrl}/health/live`);
  logger.log(`📋 Health detail: ${baseUrl}/health/detail`);
  logger.log(`ℹ️  Actuator info: ${baseUrl}/actuator/info`);
  logger.log(`📦 Version: ${process.env.IMAGE_TAG || process.env.APP_VERSION || 'local'}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`📖 Swagger docs: ${baseUrl}/api/docs`);
}

bootstrap();
