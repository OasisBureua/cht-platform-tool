import type { PublicKol } from '../api/kol-network';
import type { DolEntry } from '../data/dol-network';
import { normalizeUsStateCode } from '../data/us-states';

/** Derive a US state code from MediaHub region metadata or static intel location. */
export function deriveKolUsState(kol: PublicKol, entry?: DolEntry): string | null {
  const fromLabel = kol.region_label?.trim();
  if (fromLabel) {
    const m = fromLabel.match(/^([A-Z]{2})\b/);
    if (m) return normalizeUsStateCode(m[1]);
  }

  const region = kol.region?.trim();
  if (region) {
    const head = region.split('-')[0]?.trim();
    if (head && head.length === 2) {
      const code = normalizeUsStateCode(head);
      if (code) return code;
    }
  }

  const loc = entry?.intel?.location?.trim();
  if (loc) {
    const m = loc.match(/,\s*([A-Za-z]{2})\s*$/);
    if (m) return normalizeUsStateCode(m[1]);
  }

  return null;
}
