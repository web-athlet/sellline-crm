import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayloadSchema, type JwtPayload } from '@sellline/shared-types';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  sign(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string {
    return this.jwt.sign(payload);
  }

  verify(token: string): JwtPayload {
    const raw: unknown = this.jwt.verify(token);
    const parsed = JwtPayloadSchema.safeParse(raw);
    if (!parsed.success)
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid token payload' });
    return parsed.data;
  }
}
