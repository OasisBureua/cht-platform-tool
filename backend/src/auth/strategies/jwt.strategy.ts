import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { config } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${configService.get('AUTH0_DOMAIN')}/.well-known/jwks.json`,
      }),
      audience: configService.get('AUTH0_AUDIENCE'),
      issuer: `https://${configService.get('AUTH0_DOMAIN')}/`,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    const authId = payload.sub;
    const email = payload.email;
    const name = payload.name || '';

    // Split name into first and lat
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    // Check if users exists in our database
    let user = await this.prisma.user.findUnique({
      where: { authId },
    });

    // If user doesn't exist, create them
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          authId,
          email: email || `${authId}@temp.email`,
          firstName,
          lastName,
          role: 'HCP', // Default rolee
        },
      });

      console.log(`New user synced from Auth0: ${user.email}`)
    }
  }
}