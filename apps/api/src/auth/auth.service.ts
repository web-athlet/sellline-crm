import { randomBytes, randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { type JwtService } from '@nestjs/jwt';
import type {
  AuthUser,
  ChangePassword,
  LoginCredentials,
  LoginResponse,
  PendingLoginResponse,
  PasswordResetConfirm,
  PendingJwtPayload,
  RefreshJwtPayload,
  Register,
  Role,
  TwoFactorDisableRequest,
  TwoFactorGenerateResponse,
  TwoFactorValidateRequest,
  TwoFactorVerifyRequest,
} from '@sellline/shared';
import { PendingJwtPayloadSchema, RefreshJwtPayloadSchema } from '@sellline/shared';
import * as bcrypt from 'bcrypt';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';

import { encryptToken } from '../common/crypto/token-cipher';
import { type AppConfigService } from '../config/config.service';
import { type MailService } from '../mail/mail.service';
import { type PrismaService } from '../prisma/prisma.service';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  twoFactorEnabled: boolean;
};

type MintResult = {
  accessToken: string;
  rawRefreshToken: string;
  user: AuthUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: AppConfigService,
  ) {}

  async login(
    dto: LoginCredentials,
  ): Promise<(LoginResponse & { rawRefreshToken: string }) | PendingLoginResponse> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    const dummyHash = '$2b$12$GhvMmNVjRW29ulnudl.LDuW9vmU52B52Xd4ve4.s.rrfqdHSRRiEa';
    const match = await bcrypt.compare(dto.password, user?.password ?? dummyHash);
    if (!user || !match) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    if (user.twoFactorEnabled) {
      const pendingToken = this.jwt.sign(
        { sub: user.id, purpose: 'totp-pending' },
        { secret: this.config.get('AUTH_JWT_SECRET'), expiresIn: '5m' },
      );
      return { twoFactorRequired: true as const, pendingToken };
    }

    const tokens = await this.mintTokenPair(user as UserRow);
    const requiresTwoFactorSetup =
      user.role === 'ADMIN' && !user.twoFactorEnabled ? true : undefined;

    return {
      ...tokens,
      ...(requiresTwoFactorSetup ? { requiresTwoFactorSetup } : {}),
    };
  }

  async refresh(rawToken: string): Promise<MintResult> {
    let payload: RefreshJwtPayload;
    try {
      const raw = this.jwt.verify<RefreshJwtPayload>(rawToken, {
        secret: this.config.get('AUTH_JWT_REFRESH_SECRET'),
      });
      const result = RefreshJwtPayloadSchema.safeParse(raw);
      if (!result.success) throw new Error('Invalid shape');
      payload = result.data;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' });
    }

    const user = await this.prisma.client.$transaction(
      async (tx) => {
        const familyTokens = await tx.refreshToken.findMany({
          where: { family: payload.family },
        });

        let matched: (typeof familyTokens)[number] | undefined;
        for (const token of familyTokens) {
          if (await bcrypt.compare(payload.jti, token.tokenHash)) {
            matched = token;
            break;
          }
        }

        if (!matched) {
          throw new UnauthorizedException({
            code: 'UNAUTHORIZED',
            message: 'Invalid refresh token',
          });
        }

        if (matched.revokedAt !== null) {
          await tx.refreshToken.updateMany({
            where: { family: payload.family },
            data: { revokedAt: new Date() },
          });
          throw new UnauthorizedException({
            code: 'UNAUTHORIZED',
            message: 'Token reuse detected',
          });
        }

        if (matched.expiresAt < new Date()) {
          throw new UnauthorizedException({
            code: 'UNAUTHORIZED',
            message: 'Refresh token expired',
          });
        }

        await tx.refreshToken.update({
          where: { id: matched.id },
          data: { revokedAt: new Date() },
        });

        return tx.user.findUniqueOrThrow({
          where: { id: payload.sub, deletedAt: null },
          select: { id: true, email: true, name: true, role: true, twoFactorEnabled: true },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    return this.mintTokenPair(user as UserRow);
  }

  async logout(rawToken: string): Promise<void> {
    try {
      const raw = this.jwt.verify<RefreshJwtPayload>(rawToken, {
        secret: this.config.get('AUTH_JWT_REFRESH_SECRET'),
        ignoreExpiration: true,
      });
      const result = RefreshJwtPayloadSchema.safeParse(raw);
      if (!result.success) return;
      await this.prisma.client.refreshToken.updateMany({
        where: { family: result.data.family },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Invalid token — already effectively logged out
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async register(dto: Register): Promise<{ user: AuthUser }> {
    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.client.user.create({
      data: { email: dto.email, name: dto.name, password: hash, role: 'SALES_REP' },
      select: { id: true, email: true, name: true, role: true, twoFactorEnabled: true },
    });
    await this.mail.sendWelcomeMail(dto.email, dto.name);
    return { user: { ...user, role: user.role as Role } };
  }

  async changePassword(userId: string, dto: ChangePassword): Promise<void> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { password: true },
    });

    const match = await bcrypt.compare(dto.currentPassword, user.password);
    if (!match) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid current password' });
    }

    const hash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { password: hash, passwordChangedAt: new Date() },
    });

    await this.logoutAll(userId);
  }

  async forgotPassword(email: string): Promise<void> {
    const start = Date.now();

    const user = await this.prisma.client.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, email: true },
    });

    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = await bcrypt.hash(rawToken, 10);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await this.prisma.client.passwordReset.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      await this.mail.sendPasswordResetMail(user.email, rawToken);
    }

    const elapsed = Date.now() - start;
    if (elapsed < 600) {
      await new Promise<void>((r) => setTimeout(r, 600 - elapsed));
    }
  }

  async resetPassword(dto: PasswordResetConfirm): Promise<void> {
    const records = await this.prisma.client.passwordReset.findMany({
      where: { expiresAt: { gt: new Date() }, usedAt: null },
      select: { id: true, userId: true, tokenHash: true },
    });

    let matched: (typeof records)[number] | undefined;
    for (const record of records) {
      if (await bcrypt.compare(dto.token, record.tokenHash)) {
        matched = record;
        break;
      }
    }

    if (!matched) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Invalid or expired reset token',
      });
    }

    const hash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: matched.userId },
        data: { password: hash, passwordChangedAt: new Date() },
      }),
      this.prisma.client.passwordReset.update({
        where: { id: matched.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.client.refreshToken.updateMany({
        where: { userId: matched.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async generateTwoFactorSecret(userId: string): Promise<TwoFactorGenerateResponse> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    const secret = generateSecret();
    const uri = generateURI({ issuer: 'sellline', label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return { secret, qrCodeDataUrl };
  }

  async verifyAndEnableTwoFactor(userId: string, dto: TwoFactorVerifyRequest): Promise<void> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });

    if (!user.twoFactorSecret) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: '2FA setup not started' });
    }

    const result = verifySync({
      secret: user.twoFactorSecret,
      token: dto.code,
      epochTolerance: 30,
    });
    if (!result.valid) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid TOTP code' });
    }

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
  }

  async validateTwoFactorLogin(dto: TwoFactorValidateRequest): Promise<MintResult> {
    let payload: PendingJwtPayload;
    try {
      const raw = this.jwt.verify<PendingJwtPayload>(dto.pendingToken, {
        secret: this.config.get('AUTH_JWT_SECRET'),
      });
      const result = PendingJwtPayloadSchema.safeParse(raw);
      if (!result.success || result.data.purpose !== 'totp-pending') throw new Error('Invalid');
      payload = result.data;
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired pending token',
      });
    }

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user.twoFactorSecret) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '2FA not configured' });
    }

    const result = verifySync({
      secret: user.twoFactorSecret,
      token: dto.code,
      epochTolerance: 30,
    });
    if (!result.valid) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid TOTP code' });
    }

    return this.mintTokenPair(user as UserRow);
  }

  async disableTwoFactor(userId: string, dto: TwoFactorDisableRequest): Promise<void> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { password: true },
    });

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid password' });
    }

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
  }

  async handleOAuthLogin(
    email: string,
    name: string,
    provider: 'google' | 'microsoft',
    rawOAuthToken: string,
  ): Promise<MintResult> {
    const encryptionKey = this.config.get('EMAIL_ENCRYPTION_KEY');
    const encrypted = encryptToken(rawOAuthToken, encryptionKey);

    const user = await this.prisma.client.user.upsert({
      where: { email },
      create: { email, name, password: randomBytes(32).toString('hex'), role: 'SALES_REP' },
      update:
        provider === 'google'
          ? { gmailTokenEncrypted: encrypted }
          : { outlookTokenEncrypted: encrypted },
      select: { id: true, email: true, name: true, role: true, twoFactorEnabled: true },
    });

    return this.mintTokenPair(user as UserRow);
  }

  private async mintTokenPair(user: UserRow): Promise<MintResult> {
    const family = randomUUID();
    const jti = randomBytes(32).toString('hex');
    const refreshSecret = this.config.get('AUTH_JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.config.get('AUTH_JWT_REFRESH_EXPIRES_IN');

    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get('AUTH_JWT_SECRET'),
        expiresIn: this.config.get('AUTH_JWT_EXPIRES_IN'),
      },
    );

    const rawRefreshToken = this.jwt.sign(
      { sub: user.id, family, jti },
      { secret: refreshSecret, expiresIn: refreshExpiresIn },
    );

    const tokenHash = await bcrypt.hash(jti, 10);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.client.refreshToken.create({
      data: { userId: user.id, tokenHash, family, expiresAt },
    });

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
    };

    return { accessToken, rawRefreshToken, user: authUser };
  }
}
