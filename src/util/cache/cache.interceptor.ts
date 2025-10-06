import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { DEFAULT_CACHE_TTL_SECONDS } from './cache.constants';

@Injectable()
export class ControllerCacheInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { headers: Record<string, string> }>();
    const key = this.createCacheKey(request);
    const headerTtl = (request.headers?.['x-cache-ttl'] ||
      request.headers?.['X-Cache-Ttl']) as string | undefined;
    const ttl = headerTtl
      ? Math.max(parseInt(headerTtl, 10) || DEFAULT_CACHE_TTL_SECONDS, 1)
      : DEFAULT_CACHE_TTL_SECONDS;

    return from(this.cacheManager.get(key)).pipe(
      switchMap((cached) => {
        if (cached !== undefined && cached !== null) {
          return of(cached);
        }
        return next.handle().pipe(
          map(async (data) => {
            try {
              await this.cacheManager.set(key, data, ttl);
            } catch {}
            return data;
          }),
          switchMap((p) => from(p)),
        );
      }),
    );
  }

  private createCacheKey(req: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    query?: any;
  }): string {
    const method = (req.method || 'GET').toUpperCase();
    const url = req.url || '';
    const query = req.query ? JSON.stringify(req.query) : '';
    return `${method}:${url}:${query}`;
  }
}
