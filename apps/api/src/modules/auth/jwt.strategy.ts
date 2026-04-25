import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { JwtPayloadSchema, type JwtPayload, type Role } from '@sellline/shared-types';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfigService } from '../../config/config.service';
import { UsersService } from '../users/users.service';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    private readonly users: UsersService,
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
    if (!result.success) throw this.unauthorized('Invalid token payload');
    const payload: JwtPayload = result.data;

    const user = await this.users.findById(payload.sub);
    if (!user) throw this.unauthorized('User not found');

    // Force re-login after a password change. `null` = never changed (pre-Session-2 user).
    if (
      user.passwordChangedAt &&
      typeof payload.iat === 'number' &&
      payload.iat * 1000 < user.passwordChangedAt.getTime()
    ) {
      throw this.unauthorized('Token issued before last password change');
    }

    return { userId: user.id, email: user.email, role: user.role as Role };
  }

  private unauthorized(message: string): UnauthorizedException {
    return new UnauthorizedException({ code: 'UNAUTHORIZED', message });
  }
}
