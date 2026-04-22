import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { JwtPayloadSchema, type JwtPayload } from '@sellline/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfigService } from '../config/config.service';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('AUTH_JWT_SECRET'),
      issuer: config.get('AUTH_JWT_ISSUER'),
      audience: config.get('AUTH_JWT_AUDIENCE'),
    });
  }

  validate(raw: unknown): AuthenticatedUser {
    const result = JwtPayloadSchema.safeParse(raw);
    if (!result.success) throw new UnauthorizedException('Invalid token payload');
    const payload: JwtPayload = result.data;
    return { userId: payload.sub, tenantId: payload.tid, email: payload.email };
  }
}
