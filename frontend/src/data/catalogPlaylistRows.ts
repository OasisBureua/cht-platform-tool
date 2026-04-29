import catalogPlaylistSectionsJson from './_generated-catalog-playlists.json';

/** Curated playlist rows synced from `chm-clone/src/data/dashboardData.ts` (`rows` → `_generated-catalog-playlists.json`). Re-exported as typed sections for the app catalog and dashboard. */
export type AppPlaylistStripItem = {
  id: string;
  /** Conversation or series title */
  title: string;
  /** Doctors / meta line (shown under title) */
  speakers: string;
  imageUrl: string;
  href: string;
  tag: string;
};

export type AppPlaylistSection = {
  label: string;
  subtitle: string;
  /** Optional: override destination for strip “See all” (default: cohort CHM page from `playlistFocusFilters`). */
  browseHref?: string;
  items: AppPlaylistStripItem[];
};

export const APP_CATALOG_PLAYLIST_SECTIONS = catalogPlaylistSectionsJson as AppPlaylistSection[];
