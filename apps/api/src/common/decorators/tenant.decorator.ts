import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ tenantId?: string }>();
    if (!req.tenantId) throw new Error('TenantGuard missing — tenantId not populated');
    return req.tenantId;
  },
);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<{ user?: unknown }>();
  return req.user;
});
