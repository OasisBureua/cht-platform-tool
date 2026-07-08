import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { AuthService } from './auth.service';
import type { CognitoIdTokenClaims } from './cognito.service';

@Injectable()
export class CognitoStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    const userPoolId = configService.get<string>('cognito.userPoolId');
    const region =
      configService.get<string>('cognito.region') ||
      configService.get<string>('aws.region') ||
      'us-east-1';

    if (!userPoolId) {
      throw new Error(
        'CognitoStrategy requires COGNITO_USER_POOL_ID - use dev bypass when Cognito not configured',
      );
    }

    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${issuer}/.well-known/jwks.json`,
      }),
    });
  }

  async validate(payload: CognitoIdTokenClaims) {
    const authId = payload.sub;
    if (!authId) throw new UnauthorizedException('Invalid token');

    const user = await this.authService.findOrCreateByAuthId(
      authId,
      payload.email,
      payload.given_name ||
        (payload.name ? String(payload.name).split(' ')[0] : undefined),
      payload.family_name ||
        (payload.name
          ? String(payload.name).split(' ').slice(1).join(' ')
          : undefined),
    );
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
