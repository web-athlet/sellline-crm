import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): ReturnType<T['parse']> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: result.error.flatten(),
      });
    }
    return result.data;
  }
}
