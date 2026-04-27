import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { JwtPayloadSchema, type JwtPayload } from '@sellline/shared';
import type { Role } from '@sellline/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { type AppConfigService } from '../config/config.service';
import { type PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('AUTH_JWT_SECRET'),
      issuer: config.get('AUTH_JWT_ISSUER'),
      audience: config.get('AUTH_JWT_AUDIENCE'),
    });
  }

  async validate(raw: unknown): Promise<AuthenticatedUser> {
    const result = JwtPayloadSchema.safeParse(raw);
    if (!result.success) throw new UnauthorizedException('Invalid token payload');
    const payload: JwtPayload = result.data;

    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, email: true, role: true, passwordChangedAt: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    if (payload.iat !== undefined && user.passwordChangedAt !== null) {
      if (payload.iat * 1000 < user.passwordChangedAt.getTime()) {
        throw new UnauthorizedException('Password changed — please log in again');
      }
    }

    return { userId: user.id, email: user.email, role: user.role as Role };
  }
}
