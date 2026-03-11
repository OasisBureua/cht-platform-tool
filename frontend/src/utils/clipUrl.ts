/**
 * Extract short clip ID for clean URLs.
 * MediaHub IDs: official:youtube:E1tTwDQgMBc -> E1tTwDQgMBc
 */
export function getShortClipId(id: string): string {
  const match = id.match(/:([a-zA-Z0-9_-]{11})$/);
  if (match) return match[1];
  return id;
}
