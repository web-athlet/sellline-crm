import { Injectable } from '@nestjs/common';
import { type JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '@sellline/shared';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  sign(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string {
    return this.jwt.sign(payload);
  }

  verify(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token);
  }
}
