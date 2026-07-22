import { CACHE_NAMESPACE, cachePatternsForScope } from './cache-keys';

describe('cachePatternsForScope', () => {
  it('catalog scope clears only catalog namespace', () => {
    expect(cachePatternsForScope('catalog')).toEqual([
      `${CACHE_NAMESPACE.CATALOG}:*`,
    ]);
  });

  it('contenthub scope clears catalog + contenthub + kol-network (SCRUM-82)', () => {
    // Contract: any ContentHub admin write (KOL patch, tag PATCH,
    // post_tagging Lambda) must invalidate CHT catalog reads that
    // proxy from ContentHub, otherwise the frontend serves stale
    // /catalog/tags and /catalog/playlists-tags responses.
    const patterns = cachePatternsForScope('contenthub');
    expect(patterns).toEqual(
      expect.arrayContaining([
        `${CACHE_NAMESPACE.CATALOG}:*`,
        `${CACHE_NAMESPACE.CONTENTHUB}:*`,
        `${CACHE_NAMESPACE.KOL_NETWORK}:*`,
      ]),
    );
    expect(patterns).toHaveLength(3);
    expect(patterns).not.toContain(`${CACHE_NAMESPACE.SESSION}:*`);
  });

  it('all scope clears everything except sessions', () => {
    const patterns = cachePatternsForScope('all');
    expect(patterns).toEqual(
      expect.arrayContaining([
        `${CACHE_NAMESPACE.CATALOG}:*`,
        `${CACHE_NAMESPACE.CONTENTHUB}:*`,
        `${CACHE_NAMESPACE.KOL_NETWORK}:*`,
      ]),
    );
    expect(patterns).not.toContain(`${CACHE_NAMESPACE.SESSION}:*`);
  });
});
