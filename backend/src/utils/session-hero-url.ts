/**
 * Resolve a stored session hero value to a browser-loadable HTTPS URL.
 * Supports full URLs and S3 object keys under session-heroes/.
 */
export function resolveSessionHeroImageUrl(
  stored: string | null | undefined,
  publicUrlBase: string,
): string | undefined {
  const raw = stored?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = publicUrlBase.trim().replace(/\/$/, '');
  const key = raw.replace(/^\//, '');
  if (key.startsWith('session-heroes/')) {
    return base ? `${base}/${key}` : undefined;
  }
  return raw;
}

export function programCoverImageUrl(
  program: {
    sessionHeroImageUrl?: string | null;
    thumbnailUrl?: string | null;
  },
  publicUrlBase: string,
  youtubeFallback?: string,
): string | undefined {
  return (
    resolveSessionHeroImageUrl(program.sessionHeroImageUrl, publicUrlBase) ||
    program.thumbnailUrl?.trim() ||
    youtubeFallback ||
    undefined
  );
}
