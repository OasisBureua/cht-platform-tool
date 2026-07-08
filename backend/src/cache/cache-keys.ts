/**
 * Upstream read-through cache key namespaces in ElastiCache Redis.
 *
 * One Redis cluster is intentional: each producer gets a distinct prefix so keys
 * never collide and can be cleared independently. This is not durable app state
 * (no sessions, payments, or user data) — only cached MediaHub / Content Hub / YouTube reads.
 */
export const CACHE_NAMESPACE = {
  /** YouTube playlist/channel catalog fallbacks */
  CATALOG: 'cht:catalog',
  /** Content Hub KOL network + future producer reads */
  CONTENTHUB: 'cht:contenthub',
  /** Legacy prefix from early KOL caching — cleared for backwards compatibility */
  KOL_NETWORK: 'cht:kol-network',
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
      return [
        `${CACHE_NAMESPACE.CATALOG}:*`,
        `${CACHE_NAMESPACE.CONTENTHUB}:*`,
        `${CACHE_NAMESPACE.KOL_NETWORK}:*`,
      ];
  }
}
