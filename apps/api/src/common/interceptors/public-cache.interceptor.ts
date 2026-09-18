import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { PUBLIC_CACHE_KEY } from '../decorators/public-cache.decorator.js';

const PUBLIC_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

/**
 * Sets a short-lived shared cache header on routes marked @PublicCache().
 * Only GET responses are cached; mutations and authenticated/user-specific
 * routes must never carry this header, which is why the marker is opt-in per
 * route rather than inferred from @Public().
 */
@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const cacheable = this.reflector.getAllAndOverride<boolean>(PUBLIC_CACHE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!cacheable) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const res = http.getResponse<{ setHeader: (name: string, value: string) => void }>();
    const req = http.getRequest<{ method?: string }>();

    if (req.method !== 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
      })
    );
  }
}
