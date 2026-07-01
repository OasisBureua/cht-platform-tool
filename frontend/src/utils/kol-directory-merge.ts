import type { PublicKol, PublicKolIntel } from '../api/kol-network';
import {
  kolStaticEnrichment,
  type DolEntry,
  type KolIntel,
} from '../data/dol-network';
import { deriveKolUsState, kolInstitutionLabel } from './kol-state';

export function apiIntelToKolIntel(
  intel: PublicKolIntel | null | undefined,
): KolIntel | undefined {
  if (!intel) return undefined;
  const out: KolIntel = {};
  if (intel.npi) out.npi = intel.npi;
  if (intel.specialty) out.specialty = intel.specialty;
  if (intel.location) out.location = intel.location;
  if (intel.affiliation) out.affiliation = intel.affiliation;
  if (intel.publications_approx != null) {
    out.publicationsApprox = intel.publications_approx;
  }
  if (intel.open_payments) out.openPayments = intel.open_payments;
  if (intel.ai_brief?.whoTheyAre) {
    out.aiBrief = { whoTheyAre: intel.ai_brief.whoTheyAre };
  }
  return Object.keys(out).length ? out : undefined;
}

/** Prefer Content Hub intel; static mock fills education, social, aiBrief extras. */
export function mergeIntel(
  apiKol: PublicKol,
  stat?: DolEntry,
): KolIntel | undefined {
  const fromApi = apiIntelToKolIntel(apiKol.intel);
  const fromStat = stat?.intel;
  if (!fromApi && !fromStat) return undefined;
  return {
    ...fromStat,
    ...fromApi,
    aiBrief: {
      ...fromStat?.aiBrief,
      ...fromApi?.aiBrief,
    },
  };
}

export function mergePublicKolToEntry(apiKol: PublicKol): DolEntry {
  const stat = kolStaticEnrichment.find((e) => e.id === apiKol.slug);
  const role = stat?.role ?? apiKol.title ?? '';
  const intel = mergeIntel(apiKol, stat);
  const merged: DolEntry = {
    id: apiKol.slug,
    name: apiKol.name,
    role,
    bio: apiKol.bio || stat?.bio || '',
    education: stat?.education ?? '',
    isNew: apiKol.is_new,
    photoUrl: apiKol.photo_url ?? undefined,
    shootCount: apiKol.shoot_count,
    intel,
    institution: kolInstitutionLabel(apiKol, {
      role,
      education: stat?.education,
      intel,
    }),
    stateCode: undefined,
  };
  merged.stateCode = deriveKolUsState(apiKol, merged) ?? undefined;
  return merged;
}

export function hasAiSummary(entry: Pick<DolEntry, 'intel' | 'bio'>): boolean {
  return Boolean(entry.intel?.aiBrief?.whoTheyAre?.trim());
}
