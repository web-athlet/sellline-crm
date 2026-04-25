import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { AppConfigService } from '../../config/config.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
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
        verifyOptions: {
          issuer: config.get('AUTH_JWT_ISSUER'),
          audience: config.get('AUTH_JWT_AUDIENCE'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard, AuthService],
})
export class AuthModule {}
