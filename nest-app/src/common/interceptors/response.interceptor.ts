// src/common/interceptors/response.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    // const ctx = context.switchToHttp();

    const handler = context.getHandler();
    const controller = context.getClass();

    const customMessage =
      this.reflector.get<string>(RESPONSE_MESSAGE_KEY, handler) ??
      this.reflector.get<string>(RESPONSE_MESSAGE_KEY, controller) ??
      'Request successful';

    return next.handle().pipe(
      map((data) => ({
        status: true,
        message: customMessage,
        data: data ?? null,
      })),
    );
  }
}
