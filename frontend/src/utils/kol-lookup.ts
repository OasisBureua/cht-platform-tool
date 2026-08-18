import { kolStaticEnrichment } from '../data/dol-network';
import type { DolEntry } from '../data/dol-network';

/**
 * Static index: MediaHub doctor slug → DOL directory KOL entry.
 * Matches by `id`, `intel.catalogDoctorSlug`, or lowercase surname of `name`.
 * Built once at module load — the DOL directory is a compile-time constant.
 */
const INDEX: Map<string, DolEntry> = (() => {
  const m = new Map<string, DolEntry>();
  for (const entry of kolStaticEnrichment) {
    const keys = new Set<string>();
    if (entry.id) keys.add(entry.id.toLowerCase());
    if (entry.intel?.catalogDoctorSlug) keys.add(entry.intel.catalogDoctorSlug.toLowerCase());
    // Last-name fallback for slug matches like "bardia" ← "Dr. Aditya Bardia"
    const last = entry.name
      .replace(/^Dr\.?\s*/i, '')
      .split(/\s+/)
      .pop();
    if (last) keys.add(last.toLowerCase().replace(/['’]/g, ''));
    for (const k of keys) {
      if (!m.has(k)) m.set(k, entry);
    }
  }
  return m;
})();

export function findKolByDoctorSlug(slug: string): DolEntry | undefined {
  return INDEX.get(slug.toLowerCase());
}
