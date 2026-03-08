import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import multer from 'multer';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Jotform sends multipart/form-data with rawRequest field. Parse it for the webhook route.
  const multerUpload = multer();
  app.use('/api/webhooks/jotform', multerUpload.none());
  const logger = app.get(Logger);

  // CORS: allow frontend origins. FRONTEND_URL from env (e.g. ECS) is added when set.
  const corsOrigins = [
    'https://testapp.communityhealth.media',
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
    ],
  });

  // Swagger — available in all envs but only accessible internally in prod
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CHT Platform API')
    .setDescription('Internal API for CHT Platform — admin operations, user management, programs, payments')
    .setVersion(process.env.APP_VERSION || '1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'session-token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  const baseUrl = process.env.FRONTEND_URL || process.env.API_BASE_URL || `http://localhost:${port}`;
  logger.log(`🚀 Application is running on: ${baseUrl}`);
  logger.log(`📡 API base: ${baseUrl}/api`);
  logger.log(`🔐 Auth: ${process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? 'Supabase' : 'Dev (DB)'}`);
  logger.log(`📊 Health check: ${baseUrl}/health`);
  logger.log(`🔍 Health ready: ${baseUrl}/health/ready`);
  logger.log(`💚 Health live: ${baseUrl}/health/live`);
  logger.log(`📋 Health detail: ${baseUrl}/health/detail`);
  logger.log(`📦 Version: ${process.env.APP_VERSION || '1.0.0'}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`📖 Swagger docs: ${baseUrl}/api/docs`);
}

bootstrap();