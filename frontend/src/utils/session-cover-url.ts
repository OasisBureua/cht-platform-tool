/** Prefer S3 session hero, then legacy thumbnail, for live session cover art. */
export function getSessionCoverUrl(program: {
  sessionHeroImageUrl?: string | null;
  thumbnailUrl?: string | null;
}): string | undefined {
  const hero = program.sessionHeroImageUrl?.trim();
  if (hero) return hero;
  const thumb = program.thumbnailUrl?.trim();
  if (thumb) return thumb;
  return undefined;
}
