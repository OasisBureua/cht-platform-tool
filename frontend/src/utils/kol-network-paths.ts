/** Public marketing KOL directory (clean URL). */
export const KOL_NETWORK_PUBLIC_BASE = '/kols';

/** Authenticated member-shell KOL directory. */
export const KOL_NETWORK_APP_BASE = '/app/kols';

/** Legacy public base — keep for redirects only. */
export const KOL_NETWORK_PUBLIC_BASE_LEGACY = '/kol-network';

/** Legacy app base — keep for redirects only. */
export const KOL_NETWORK_APP_BASE_LEGACY = '/app/kol-network';

/** Resolve directory base from the current location (public vs /app). */
export function kolNetworkBaseFromPath(pathname: string): string {
  return pathname.startsWith('/app') ? KOL_NETWORK_APP_BASE : KOL_NETWORK_PUBLIC_BASE;
}

/** Individual KOL profile: `/kols/jason-mouabbi` or `/app/kols/jason-mouabbi`. */
export function kolProfilePath(base: string, kolId: string): string {
  return `${base}/${encodeURIComponent(kolId)}`;
}

/**
 * State grouping page — nested under `/states/` so US codes never collide
 * with KOL slugs at `/kols/:kolId`.
 */
export function kolRegionPath(base: string, regionSlug: string): string {
  return `${base}/states/${encodeURIComponent(regionSlug)}`;
}

/** Catalog browse base for links from KOL cards/profiles. */
export function kolCatalogBaseFromPath(pathname: string): string {
  return pathname.startsWith('/app') ? '/app/catalog' : '/catalog';
}
