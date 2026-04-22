import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { tenantContext } from '@sellline/database';
import { type Observable } from 'rxjs';

import type { AuthenticatedUser } from '../jwt.strategy';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser; tenantId?: string }>();
    const user = req.user;
    if (!user?.tenantId)
      throw new ForbiddenException({ code: 'TENANT_REQUIRED', message: 'No tenant on request' });
    req.tenantId = user.tenantId;
    return new Promise((resolve) => {
      tenantContext.run({ tenantId: user.tenantId }, () => resolve(true));
    });
  }
}
