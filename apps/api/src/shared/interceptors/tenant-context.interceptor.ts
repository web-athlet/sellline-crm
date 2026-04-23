import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { tenantContext } from '../../prisma/tenant-context';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{ tenantId?: string }>();
    const tenantId = req.tenantId;
    if (!tenantId) return next.handle();

    return new Observable((subscriber) => {
      tenantContext.run({ tenantId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
