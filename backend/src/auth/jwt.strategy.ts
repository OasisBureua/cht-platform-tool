import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { AuthService } from './auth.service';

export interface JwtPayload {
  sub: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  [key: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    const domain = configService.get<string>('auth0.domain');
    const audience = configService.get<string>('auth0.audience');

    if (!domain) {
      throw new Error(
        'JwtStrategy requires AUTH0_DOMAIN - use dev bypass when Auth0 not configured',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: audience || undefined,
      issuer: `https://${domain}/`,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${domain}/.well-known/jwks.json`,
      }),
    });
  }

  async validate(payload: JwtPayload) {
    const authId = payload.sub;
    if (!authId) throw new UnauthorizedException('Invalid token');

    const user = await this.authService.findOrCreateByAuthId(
      authId,
      payload.email,
      payload.given_name,
      payload.family_name,
    );
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
