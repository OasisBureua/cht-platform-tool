/** In-app podcast URL helpers (no YouTube in paths). */
export function podcastShowPath(showId: string): string {
  return `/app/podcasts/${showId}`;
}

export function podcastEpisodeWatchPath(showId: string, episodeId: string): string {
  return `/app/podcasts/${showId}/watch/${episodeId}`;
}
