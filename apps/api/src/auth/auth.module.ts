import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppConfigService } from '../config/config.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantGuard } from './guards/tenant.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.get('AUTH_JWT_SECRET'),
        signOptions: {
          issuer: config.get('AUTH_JWT_ISSUER'),
          audience: config.get('AUTH_JWT_AUDIENCE'),
          expiresIn: config.get('AUTH_JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, TenantGuard],
  exports: [JwtAuthGuard, TenantGuard, AuthService],
})
export class AuthModule {}
