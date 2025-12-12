import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if extra properties sent
      transform: true, // Automatically transform payloads to DTO instannces
    }),
  );

  await app.listen(3000);
  console.log('Application is running on http://localhost:3000');
}
bootstrap()