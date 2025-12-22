import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS
  app.enableCors({
    origin: [
      'https://communityhealth.media',
      'https://www.communityhealth.media',
      'https://app.communityhealth.media',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
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

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📊 Health check: http://localhost:${port}/health`);
  logger.log(`🔍 Health ready: http://localhost:${port}/health/ready`);
  logger.log(`💚 Health live: http://localhost:${port}/health/live`);
  logger.log(`📋 Health detail: http://localhost:${port}/health/detail`);
  logger.log(`📦 Version: ${process.env.APP_VERSION || '1.0.0'}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();