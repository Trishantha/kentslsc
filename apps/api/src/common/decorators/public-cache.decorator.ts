import { SetMetadata } from '@nestjs/common';

export const PUBLIC_CACHE_KEY = 'publicCache';

/**
 * Mark a read-only public GET route as cacheable by browsers/CDNs. The global
 * PublicCacheInterceptor turns this into a
 * `Cache-Control: public, max-age=60, stale-while-revalidate=300` response
 * header. Never apply this to auth, admin, dashboard, or user-specific routes:
 * the cache is shared between all visitors.
 */
export const PublicCache = () => SetMetadata(PUBLIC_CACHE_KEY, true);
