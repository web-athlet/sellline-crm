import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import type { Role } from '@sellline/shared';

import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../jwt.strategy';

const HIERARCHY: Role[] = ['ADMIN', 'MANAGER', 'SALES_REP', 'READ_ONLY'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not authenticated' });

    const userLevel = HIERARCHY.indexOf(user.role);
    const minRequired = Math.min(...required.map((r) => HIERARCHY.indexOf(r)));
    if (userLevel > minRequired) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient role' });
    }
    return true;
  }
}
