import { randomBytes, randomUUID } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import {
  JwtPayloadSchema,
  RefreshJwtPayloadSchema,
  type JwtPayload,
  type LoginCredentials,
  type LoginResponse,
  type PasswordResetConfirm,
  type RefreshJwtPayload,
  type Role,
} from '@sellline/shared-types';
import bcrypt from 'bcrypt';

import { AppConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

const BCRYPT_COST = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async login(creds: LoginCredentials): Promise<LoginResponse> {
    const user = await this.users.findByEmail(creds.email);
    if (!user) throw this.invalidCreds();
    const ok = await bcrypt.compare(creds.password, user.password);
    if (!ok) throw this.invalidCreds();

    const family = randomUUID();
    const { accessToken, refreshToken } = await this.mintTokenPair(user, family);
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
      },
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.verifyRefreshToken(refreshToken);

    const familyTokens = await this.prisma.client.refreshToken.findMany({
      where: { family: payload.family, userId: payload.sub },
    });

    let matched: (typeof familyTokens)[number] | null = null;
    for (const t of familyTokens) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) {
        matched = t;
        break;
      }
    }
    if (!matched) throw this.invalidRefresh();

    if (matched.revokedAt) {
      // Reuse detection: token-theft pattern. Burn the entire family.
      await this.prisma.client.refreshToken.updateMany({
        where: { family: payload.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(`Refresh-token reuse detected, revoked family=${payload.family}`);
      throw this.invalidRefresh();
    }

    if (matched.expiresAt < new Date()) throw this.invalidRefresh();

    const user = await this.users.findById(payload.sub);
    if (!user) throw this.invalidRefresh();

    await this.prisma.client.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    return this.mintTokenPair(user, payload.family);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.verifyRefreshToken(refreshToken);
      await this.prisma.client.refreshToken.updateMany({
        where: { family: payload.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Logout is idempotent: a malformed token is a no-op.
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      // Don't leak whether the email exists.
      this.logger.debug(`Password-reset requested for unknown email`);
      return;
    }
    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, BCRYPT_COST);
    await this.prisma.client.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    // Real SMTP dispatch lands in Session 11 (E-Mail-Inbox). For now the token
    // is logged so dev users can complete the flow without a mail transport.
    this.logger.log(`[PASSWORD_RESET] user=${user.email} token=${token}`);
  }

  async confirmPasswordReset({ token, newPassword }: PasswordResetConfirm): Promise<void> {
    const candidates = await this.prisma.client.passwordReset.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
    });

    let matched: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (await bcrypt.compare(token, c.tokenHash)) {
        matched = c;
        break;
      }
    }
    if (!matched)
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired reset token',
      });

    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    const now = new Date();
    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: matched.userId },
        data: { password: newHash, passwordChangedAt: now },
      }),
      this.prisma.client.passwordReset.update({
        where: { id: matched.id },
        data: { usedAt: now },
      }),
      this.prisma.client.refreshToken.updateMany({
        where: { userId: matched.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  verify(token: string): JwtPayload {
    const raw: unknown = this.jwt.verify(token);
    const parsed = JwtPayloadSchema.safeParse(raw);
    if (!parsed.success)
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid token payload' });
    return parsed.data;
  }

  private async mintTokenPair(
    user: User,
    family: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = this.jwt.sign(
      { sub: user.id, family },
      {
        secret: this.config.get('AUTH_JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('AUTH_JWT_REFRESH_EXPIRES_IN'),
        issuer: this.config.get('AUTH_JWT_ISSUER'),
        audience: this.config.get('AUTH_JWT_AUDIENCE'),
      },
    );

    const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_COST);
    const expiresAt = parseExpiresIn(this.config.get('AUTH_JWT_REFRESH_EXPIRES_IN'));
    await this.prisma.client.refreshToken.create({
      data: { userId: user.id, tokenHash, family, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  private verifyRefreshToken(token: string): RefreshJwtPayload {
    try {
      const raw: unknown = this.jwt.verify(token, {
        secret: this.config.get('AUTH_JWT_REFRESH_SECRET'),
        issuer: this.config.get('AUTH_JWT_ISSUER'),
        audience: this.config.get('AUTH_JWT_AUDIENCE'),
      });
      const parsed = RefreshJwtPayloadSchema.safeParse(raw);
      if (!parsed.success) throw this.invalidRefresh();
      return parsed.data;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw this.invalidRefresh();
    }
  }

  private invalidCreds(): UnauthorizedException {
    return new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
  }

  private invalidRefresh(): UnauthorizedException {
    return new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' });
  }
}

const parseExpiresIn = (expiresIn: string): Date => {
  const match = /^(\d+)([smhdwMy])$/.exec(expiresIn);
  const fallback = 30 * 24 * 60 * 60 * 1000;
  if (!match) return new Date(Date.now() + fallback);
  const n = parseInt(match[1] ?? '0', 10);
  const unit = match[2] ?? 'd';
  const ms: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    M: 2_592_000_000,
    y: 31_536_000_000,
  };
  return new Date(Date.now() + n * (ms[unit] ?? 86_400_000));
};
