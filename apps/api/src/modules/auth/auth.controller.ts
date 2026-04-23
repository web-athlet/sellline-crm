import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantGuard } from './guards/tenant.guard';
import type { AuthenticatedUser } from './jwt.strategy';
import { CurrentUser } from '../../shared/decorators/user.decorator';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
