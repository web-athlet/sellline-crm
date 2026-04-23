import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiError, ErrorCode } from '@sellline/shared-types';

const statusToCode = (status: number): ErrorCode => {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.BAD_REQUEST:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'VALIDATION_ERROR';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_ERROR';
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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
      const status = exception.getStatus();
      const resBody = exception.getResponse();
      const defaultCode = statusToCode(status);

      if (typeof resBody === 'string') {
        return { status, body: { code: defaultCode, message: resBody } };
      }

      if (isRecord(resBody)) {
        const rawCode = resBody['code'];
        const code: ErrorCode = typeof rawCode === 'string' ? (rawCode as ErrorCode) : defaultCode;
        const message =
          typeof resBody['message'] === 'string'
            ? (resBody['message'] as string)
            : exception.message;
        const details = resBody['details'];
        return {
          status,
          body: {
            code,
            message,
            ...(details === undefined ? {} : { details }),
          },
        };
      }

      return { status, body: { code: defaultCode, message: exception.message } };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          body: { code: 'CONFLICT', message: 'Unique constraint violated' },
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
