import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ChangePasswordSchema,
  LoginCredentialsSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  RegisterSchema,
  TwoFactorDisableRequestSchema,
  TwoFactorValidateRequestSchema,
  TwoFactorVerifyRequestSchema,
  type ChangePassword,
  type LoginCredentials,
  type PasswordResetConfirm,
  type PasswordResetRequest,
  type Register,
  type TwoFactorDisableRequest,
  type TwoFactorValidateRequest,
  type TwoFactorVerifyRequest,
} from '@sellline/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { type AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MicrosoftAuthGuard } from './guards/microsoft-auth.guard';
import type { AuthenticatedUser } from './jwt.strategy';
import { CurrentUser } from '../common/decorators/tenant.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { type AppConfigService } from '../config/config.service';

const OAuthExchangeSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  provider: z.enum(['google', 'microsoft']),
  accessToken: z.string().min(1),
});
type OAuthExchange = z.infer<typeof OAuthExchangeSchema>;

const TTL = 60_000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  private setRefreshCookie(res: Response, rawToken: string): void {
    res.cookie('refreshToken', rawToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie('refreshToken', { path: '/api/auth' });
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: TTL } })
  async register(@Body(new ZodValidationPipe(RegisterSchema)) dto: Register) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: TTL } })
  async login(
    @Body(new ZodValidationPipe(LoginCredentialsSchema)) dto: LoginCredentials,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    if ('twoFactorRequired' in result) {
      return result;
    }
    const { rawRefreshToken, ...body } = result;
    this.setRefreshCookie(res, rawRefreshToken);
    return body;
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: TTL } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = (req.cookies as Record<string, string | undefined>)['refreshToken'];
    if (!rawToken) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'No refresh token' });
    }
    const result = await this.authService.refresh(rawToken);
    const { rawRefreshToken, ...body } = result;
    this.setRefreshCookie(res, rawRefreshToken);
    return body;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = (req.cookies as Record<string, string | undefined>)['refreshToken'];
    if (rawToken) await this.authService.logout(rawToken);
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logoutAll(user.userId);
    return { success: true };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: TTL } })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePassword,
  ) {
    await this.authService.changePassword(user.userId, dto);
    return { success: true };
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: TTL } })
  async forgotPassword(
    @Body(new ZodValidationPipe(PasswordResetRequestSchema)) dto: PasswordResetRequest,
  ) {
    await this.authService.forgotPassword(dto.email);
    return { success: true };
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: TTL } })
  async resetPassword(
    @Body(new ZodValidationPipe(PasswordResetConfirmSchema)) dto: PasswordResetConfirm,
  ) {
    await this.authService.resetPassword(dto);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Passport initiates the OAuth redirect
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(
    @Req() req: Request & { user: { rawRefreshToken: string } },
    @Res() res: Response,
  ): void {
    this.setRefreshCookie(res, req.user.rawRefreshToken);
    res.redirect(`${this.config.get('FRONTEND_URL')}/app`);
  }

  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  microsoftLogin() {
    // Passport initiates the OAuth redirect
  }

  @Get('microsoft/callback')
  @UseGuards(MicrosoftAuthGuard)
  microsoftCallback(
    @Req() req: Request & { user: { rawRefreshToken: string } },
    @Res() res: Response,
  ): void {
    this.setRefreshCookie(res, req.user.rawRefreshToken);
    res.redirect(`${this.config.get('FRONTEND_URL')}/app`);
  }

  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  async generateTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.generateTwoFactorSecret(user.userId);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  async verifyTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(TwoFactorVerifyRequestSchema)) dto: TwoFactorVerifyRequest,
  ) {
    await this.authService.verifyAndEnableTwoFactor(user.userId, dto);
    return { success: true };
  }

  @Post('2fa/validate')
  @Throttle({ default: { limit: 10, ttl: TTL } })
  async validateTwoFactor(
    @Body(new ZodValidationPipe(TwoFactorValidateRequestSchema)) dto: TwoFactorValidateRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.validateTwoFactorLogin(dto);
    const { rawRefreshToken, ...body } = result;
    this.setRefreshCookie(res, rawRefreshToken);
    return body;
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(TwoFactorDisableRequestSchema)) dto: TwoFactorDisableRequest,
  ) {
    await this.authService.disableTwoFactor(user.userId, dto);
    return { success: true };
  }

  @Post('oauth-exchange')
  @Throttle({ default: { limit: 10, ttl: TTL } })
  @UseGuards(InternalSecretGuard)
  async oauthExchange(@Body(new ZodValidationPipe(OAuthExchangeSchema)) dto: OAuthExchange) {
    const result = await this.authService.handleOAuthLogin(
      dto.email,
      dto.name,
      dto.provider,
      dto.accessToken,
    );
    const { rawRefreshToken: _, ...body } = result;
    return body;
  }
}
