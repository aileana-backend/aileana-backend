// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SentryExceptionCaptured } from '@sentry/nestjs';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    /**
     * Only capture critical exceptions with Sentry, error generated and is intended to be handled, shown to users
     * should not be captured
     */
    if (
      exception instanceof HttpException &&
      (exception as any).cause &&
      Number(status) === Number(HttpStatus.INTERNAL_SERVER_ERROR)
    ) {
      Sentry.captureException((exception as any).cause);
    }

    response.status(status).json({
      status: false,
      message:
        typeof message === 'string'
          ? message
          : ((message as any)?.message ?? 'Unknown error'),
      data: null,
    });
  }
}
