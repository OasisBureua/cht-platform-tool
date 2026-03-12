import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { GoTrueStrategy } from './gotrue.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { HubSpotModule } from '../modules/hubspot/hubspot.module';

@Module({
  controllers: [AuthController],
  imports: [
    HubSpotModule,
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
  ],
  providers: [
    AuthService,
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
  exports: [AuthService],
})
export class AuthModule {}
