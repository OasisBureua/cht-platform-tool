import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { GoTrueStrategy } from './gotrue.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboundSyncModule } from '../modules/outbound-sync/outbound-sync.module';

@Module({
  controllers: [AuthController],
  imports: [
    OutboundSyncModule,
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
  ],
  providers: [
    AuthService,
    JwtAuthGuard,
    {
      provide: JwtStrategy,
      useFactory: (config: ConfigService, auth: AuthService) => {
        if (config.get<string>('auth0.domain')) {
          return new JwtStrategy(config, auth);
        }
        if (config.get<string>('gotrue.jwtSecret')) {
          return new GoTrueStrategy(config, auth);
        }
        // No auth configured - guard uses dev bypass; strategy never invoked
        return { validate: async () => null } as unknown as JwtStrategy;
      },
      inject: [ConfigService, AuthService],
    },
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
