import type { PublicKol, PublicKolIntel } from '../api/kol-network';
import {
  kolStaticEnrichment,
  type DolEntry,
  type KolIntel,
} from '../data/dol-network';
import { deriveKolUsState, kolInstitutionLabel } from './kol-state';
import { normalizeKolAiBrief } from './kol-ai-brief-parser';

export type KolDisplayBrief = {
  whoTheyAre: string;
  focus?: string;
  chmContext?: string;
  /** Sourced from Content Hub / static `intel.aiBrief`, not bio fallback. */
  isAiGenerated: boolean;
};

function roleLead(role: string): string {
  return role.split(/[.;]/)[0]?.trim() ?? role.trim();
}

/** Intel card content for directory cards and profile overview — always populated when name/role/bio exist. */
export function resolveKolDisplayBrief(
  entry: Pick<DolEntry, 'name' | 'role' | 'bio' | 'intel'>,
): KolDisplayBrief | null {
  const ai = entry.intel?.aiBrief;
  const normalizedAi = normalizeKolAiBrief(ai);
  const whoFromAi = normalizedAi?.whoTheyAre?.trim();
  if (whoFromAi) {
    return {
      whoTheyAre: whoFromAi,
      focus: normalizedAi?.focus?.trim() || undefined,
      chmContext: normalizedAi?.chmContext?.trim() || undefined,
      isAiGenerated: true,
    };
  }

  const bio = entry.bio?.trim();
  const role = entry.role?.trim();
  if (bio) {
    return {
      whoTheyAre: bio,
      focus: role ? roleLead(role) : undefined,
      isAiGenerated: false,
    };
  }
  if (role) {
    return {
      whoTheyAre: `${entry.name} — ${roleLead(role)}`,
      isAiGenerated: false,
    };
  }
  if (entry.name?.trim()) {
    return {
      whoTheyAre: entry.name.trim(),
      isAiGenerated: false,
    };
  }
  return null;
}

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
  const normalized = normalizeKolAiBrief(intel.ai_brief);
  if (normalized?.whoTheyAre) {
    out.aiBrief = normalized;
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

export function hasDisplaySummary(
  entry: Pick<DolEntry, 'name' | 'role' | 'bio' | 'intel'>,
): boolean {
  return resolveKolDisplayBrief(entry) != null;
}
