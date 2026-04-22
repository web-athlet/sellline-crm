import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@sellline/database';
import type { ApiError } from '@sellline/shared';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();

    const { status, body } = this.map(exception);
    if (status >= 500) this.logger.error(exception);
    res.status(status).json({ error: body });
  }

  private map(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const payload: ApiError =
        typeof res === 'string'
          ? { code: 'INTERNAL_ERROR', message: res }
          : { code: 'INTERNAL_ERROR', message: exception.message, ...(res as object) };
      return { status: exception.getStatus(), body: payload };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: 'CONFLICT',
            message: 'Unique constraint violated',
            details: exception.meta,
          },
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: 'NOT_FOUND', message: 'Record not found' },
        };
      }
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
  }
}
