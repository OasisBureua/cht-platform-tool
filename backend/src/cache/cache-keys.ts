/**
 * Cache key namespaces in ElastiCache Redis.
 *
 * Upstream reads (catalog / Content Hub) are ephemeral and cleared by scope.
 * Session keys mirror Postgres Session rows; Redis TTL matches remaining idle
 * expiry (`SESSION_TTL_SECONDS`, slid on activity; capped by absolute TTL).
 */
export const CACHE_NAMESPACE = {
  /** YouTube playlist/channel catalog fallbacks */
  CATALOG: 'cht:catalog',
  /** Content Hub KOL network + future producer reads */
  CONTENTHUB: 'cht:contenthub',
  /** Legacy prefix from early KOL caching — cleared for backwards compatibility */
  KOL_NETWORK: 'cht:kol-network',
  /** Auth sessions — `cht:session:{token}`; TTL matches remaining Session.expiresAt */
  SESSION: 'cht:session',
} as const;

export type CacheClearScope = 'catalog' | 'contenthub' | 'all';

export function cachePatternsForScope(scope: CacheClearScope): string[] {
  switch (scope) {
    case 'catalog':
      return [`${CACHE_NAMESPACE.CATALOG}:*`];
    case 'contenthub':
      // SCRUM-82 (2026-07-21): catalog cache includes proxied
      // /api/catalog/tags, /playlists-tags, /clips, /doctors — all
      // fed from ContentHub. Any ContentHub admin write (KOL patch,
      // clip tag override, playlist tag PATCH, post_tagging Lambda
      // yt:* refresh) invalidates catalog reads. Include CATALOG in
      // the contenthub scope so curator edits propagate to the
      // frontend within a request cycle, not stale-TTL later.
      return [
        `${CACHE_NAMESPACE.CATALOG}:*`,
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
