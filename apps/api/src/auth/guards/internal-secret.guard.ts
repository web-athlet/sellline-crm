import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { type AppConfigService } from '../../config/config.service';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const secret = req.headers['x-internal-secret'];
    if (secret !== this.config.get('INTERNAL_AUTH_SECRET')) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Forbidden' });
    }
    return true;
  }
}
