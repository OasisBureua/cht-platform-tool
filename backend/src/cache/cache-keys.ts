/**
 * Cache key namespaces in ElastiCache Redis.
 *
 * Upstream reads (catalog / Content Hub) are ephemeral and cleared by scope.
 * Session keys mirror Postgres Session rows with the same TTL (`SESSION_TTL_SECONDS`).
 */
export const CACHE_NAMESPACE = {
  /** YouTube playlist/channel catalog fallbacks */
  CATALOG: 'cht:catalog',
  /** Content Hub KOL network + future producer reads */
  CONTENTHUB: 'cht:contenthub',
  /** Legacy prefix from early KOL caching — cleared for backwards compatibility */
  KOL_NETWORK: 'cht:kol-network',
  /** Auth sessions — `cht:session:{token}`; TTL matches Postgres Session.expiresAt */
  SESSION: 'cht:session',
} as const;

export type CacheClearScope = 'catalog' | 'contenthub' | 'all';

export function cachePatternsForScope(scope: CacheClearScope): string[] {
  switch (scope) {
    case 'catalog':
      return [`${CACHE_NAMESPACE.CATALOG}:*`];
    case 'contenthub':
      return [
        `${CACHE_NAMESPACE.CONTENTHUB}:*`,
        `${CACHE_NAMESPACE.KOL_NETWORK}:*`,
      ];
    case 'all':
      // Do not wipe sessions on catalog/contenthub cache clear.
      return [
        `${CACHE_NAMESPACE.CATALOG}:*`,
        `${CACHE_NAMESPACE.CONTENTHUB}:*`,
        `${CACHE_NAMESPACE.KOL_NETWORK}:*`,
      ];
  }
}

export function sessionCacheKey(token: string): string {
  return `${CACHE_NAMESPACE.SESSION}:${token.trim()}`;
}
