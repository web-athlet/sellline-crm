import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ tenantId?: string }>();
    if (!req.tenantId)
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: 'TenantGuard missing — tenantId not populated',
      });
    return req.tenantId;
  },
);
