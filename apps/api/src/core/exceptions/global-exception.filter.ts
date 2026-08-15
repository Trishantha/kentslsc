import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Prisma } from '@kentslsc/database';
import type { Response } from 'express';

/**
 * Global exception filter.
 *
 * Normalizes every unhandled error into a safe JSON response and prevents
 * Prisma/internal stack traces from leaking in production. 500-level errors are
 * logged with enough context for operators to investigate.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url?: string; method?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string | undefined;

    if (error instanceof HttpException) {
      status = error.getStatus();
      const res = error.getResponse();
      message = typeof res === 'string' ? res : ((res as Record<string, unknown>).message as string) || message;
      code = (res as Record<string, unknown>).code as string | undefined;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      code = error.code;
      switch (error.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'A record with this value already exists.';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found.';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Related record does not exist.';
          break;
        case 'P2014':
          status = HttpStatus.BAD_REQUEST;
          message = 'Invalid relation.';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = 'Database request failed.';
      }
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid input data.';
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method || 'UNK'} ${request.url || ''}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(code && { code }),
      ...(process.env.NODE_ENV !== 'production' && error instanceof Error && { detail: error.message })
    });
  }
}
