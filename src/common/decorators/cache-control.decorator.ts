import { SetMetadata } from '@nestjs/common';

export const CACHE_CONTROL_KEY = 'cache-control';

export interface CacheOptions {
  maxAge?: number; // In seconds
  private?: boolean;
  public?: boolean;
  noCache?: boolean;
  noStore?: boolean;
}

export const CacheControl = (options: CacheOptions) => {
  const directive = createCacheDirective(options);
  return SetMetadata(CACHE_CONTROL_KEY, directive);
};

function createCacheDirective(options: CacheOptions): string {
  const directives: string[] = [];

  if (options.private) directives.push('private');
  if (options.public) directives.push('public');
  if (options.noCache) directives.push('no-cache');
  if (options.noStore) directives.push('no-store');
  if (options.maxAge) directives.push(`max-age=${options.maxAge}`);

  return directives.join(', ');
}
