import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';

export interface GoTrueJwtPayload {
  sub: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Validates JWTs issued by GoTrue (shared CHT auth at mediahub.communityhealth.media/auth/v1).
 * Uses HS256 and GOTRUE_JWT_SECRET. Maps sub to authId for findOrCreateByAuthId.
 */
@Injectable()
export class GoTrueStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    const secret = configService.get<string>('gotrue.jwtSecret');
    if (!secret) {
      throw new Error('GoTrueStrategy requires GOTRUE_JWT_SECRET');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  async validate(payload: GoTrueJwtPayload) {
    const authId = payload.sub;
    if (!authId) throw new UnauthorizedException('Invalid token');

    const meta = payload.user_metadata || {};
    const firstName =
      meta.first_name ||
      (meta.full_name ? String(meta.full_name).split(' ')[0] : undefined);
    const lastName =
      meta.last_name ||
      (meta.full_name
        ? String(meta.full_name).split(' ').slice(1).join(' ')
        : undefined);

    const user = await this.authService.findOrCreateByAuthId(
      authId,
      payload.email,
      firstName || meta.full_name,
      lastName,
    );
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
