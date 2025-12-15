import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { QueueModule } from 'src/queue/queue.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { UserModule } from './modules/users/user.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { VideosModuule } from './modules/videos/videos.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    QueueModule,
    UserModule,
    ProgramsModule,
    VideosModuule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Authentication (first)
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // Authorization (second)
    }
  ],
})
export class AppModule {}
