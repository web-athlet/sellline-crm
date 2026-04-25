import { Body, Controller, Get, HttpCode, Post, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  LoginCredentialsSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  RefreshTokenRequestSchema,
  type LoginCredentials,
  type LoginResponse,
  type PasswordResetConfirm,
  type PasswordResetRequest,
  type RefreshTokenRequest,
} from '@sellline/shared-types';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './jwt.strategy';
import { CurrentUser } from '../../shared/decorators/user.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(LoginCredentialsSchema))
  login(@Body() body: LoginCredentials): Promise<LoginResponse> {
    return this.auth.login(body);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(RefreshTokenRequestSchema))
  refresh(
    @Body() body: RefreshTokenRequest,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UsePipes(new ZodValidationPipe(RefreshTokenRequestSchema))
  async logout(@Body() body: RefreshTokenRequest): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Post('password-reset')
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @UsePipes(new ZodValidationPipe(PasswordResetRequestSchema))
  async passwordReset(@Body() body: PasswordResetRequest): Promise<void> {
    await this.auth.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @UsePipes(new ZodValidationPipe(PasswordResetConfirmSchema))
  async passwordResetConfirm(@Body() body: PasswordResetConfirm): Promise<void> {
    await this.auth.confirmPasswordReset(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
