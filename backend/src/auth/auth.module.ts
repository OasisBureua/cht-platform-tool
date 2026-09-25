import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { CognitoStrategy } from './cognito.strategy';
import { CognitoService } from './cognito.service';
import { RecaptchaService } from './recaptcha.service';
import { AuthLockoutService } from './auth-lockout.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { CognitoM2mAuthGuard } from './cognito-m2m-auth.guard';
import { CognitoM2mTokenService } from './cognito-m2m-token.service';
import { NpiRegistryService } from './npi-registry.service';
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
    CognitoService,
    RecaptchaService,
    AuthLockoutService,
    NpiRegistryService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    CognitoM2mAuthGuard,
    CognitoM2mTokenService,
    {
      provide: JwtStrategy,
      useFactory: (config: ConfigService, auth: AuthService) => {
        if (config.get<string>('cognito.userPoolId')) {
          return new CognitoStrategy(config, auth);
        }
        if (config.get<string>('auth0.domain')) {
          return new JwtStrategy(config, auth);
        }
        // No auth configured - guard uses dev bypass; strategy never invoked
        return { validate: async () => null } as unknown as JwtStrategy;
      },
      inject: [ConfigService, AuthService],
    },
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    CognitoM2mAuthGuard,
    CognitoM2mTokenService,
    CognitoService,
    NpiRegistryService,
  ],
})
export class AuthModule {}
