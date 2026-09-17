/** Public marketing KOL directory. */
export const KOL_NETWORK_PUBLIC_BASE = '/kol-network';

/** Authenticated member-shell KOL directory. */
export const KOL_NETWORK_APP_BASE = '/app/kol-network';

/** Resolve directory base from the current location (public vs /app). */
export function kolNetworkBaseFromPath(pathname: string): string {
  return pathname.startsWith('/app') ? KOL_NETWORK_APP_BASE : KOL_NETWORK_PUBLIC_BASE;
}

/** Catalog browse base for links from KOL cards/profiles. */
export function kolCatalogBaseFromPath(pathname: string): string {
  return pathname.startsWith('/app') ? '/app/catalog' : '/catalog';
}
