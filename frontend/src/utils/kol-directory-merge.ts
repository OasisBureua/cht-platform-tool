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
  /** Sourced from the Content Hub AI brief, not bio fallback. */
  isAiGenerated: boolean;
};

function roleLead(role: string): string {
  return role.split(/[.;]/)[0]?.trim() ?? role.trim();
}

/** Intel card content: prefer Hub bio, then Hub AI brief, then role. */
export function resolveKolDisplayBrief(
  entry: Pick<DolEntry, 'name' | 'role' | 'bio' | 'intel'>,
): KolDisplayBrief | null {
  const bio = entry.bio?.trim();
  const role = entry.role?.trim();
  if (bio) {
    // No `focus` here: the standalone Role field above this card already
    // shows the full role text. Echoing roleLead(role) as "What they focus
    // on" just repeated it verbatim for anyone whose role has no natural
    // short first clause (e.g. "Co-Chair, X; Chair, Y" — roleLead splits on
    // `;` and returns "Co-Chair, X" again, identical to what Role shows).
    return {
      whoTheyAre: bio,
      isAiGenerated: false,
    };
  }

  const ai = entry.intel?.aiBrief;
  const normalizedAi = normalizeKolAiBrief(ai);
  const hasIntelBrief = Boolean(
    normalizedAi?.whoTheyAre?.trim() ||
      normalizedAi?.focus?.trim() ||
      normalizedAi?.chmContext?.trim(),
  );
  if (hasIntelBrief) {
    const whoTheyAre =
      normalizedAi?.whoTheyAre?.trim() ||
      normalizedAi?.focus?.trim() ||
      normalizedAi?.chmContext?.trim() ||
      '';
    return {
      whoTheyAre,
      focus:
        normalizedAi?.focus?.trim() && normalizedAi?.focus?.trim() !== whoTheyAre
          ? normalizedAi.focus.trim()
          : undefined,
      chmContext: normalizedAi?.chmContext?.trim() || undefined,
      isAiGenerated: true,
    };
  }

  if (role) {
    return {
      whoTheyAre: `${entry.name}: ${roleLead(role)}`,
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

// NPI intel is overwritten by whatever anyone enters at platform registration
// (email, city/state, specialty, institution), so only the NPI number and the
// Hub AI brief are trusted on public surfaces.
export function apiIntelToKolIntel(
  intel: PublicKolIntel | null | undefined,
): KolIntel | undefined {
  if (!intel) return undefined;
  const out: KolIntel = {};
  if (intel.npi) out.npi = intel.npi;
  const normalized = normalizeKolAiBrief(intel.ai_brief);
  if (normalized) {
    out.aiBrief = normalized;
  }
  return Object.keys(out).length ? out : undefined;
}

export function mergePublicKolToEntry(apiKol: PublicKol): DolEntry {
  const stat = kolStaticEnrichment.find((e) => e.id === apiKol.slug);
  const role = apiKol.title ?? '';
  const intel = apiIntelToKolIntel(apiKol.intel);
  const merged: DolEntry = {
    id: apiKol.slug,
    name: apiKol.name,
    role,
    bio: apiKol.bio || '',
    education: stat?.education ?? '',
    specialty: apiKol.specialty?.trim() || undefined,
    isNew: apiKol.is_new,
    photoUrl: apiKol.photo_url ?? undefined,
    shootCount: apiKol.shoot_count,
    featured: apiKol.featured ?? false,
    displayOrder: apiKol.display_order ?? null,
    intel,
    institution: kolInstitutionLabel(apiKol, {
      role,
      education: stat?.education,
      intel,
    }),
    stateCode: undefined,
  };
  // Only the single-KOL endpoint returns NPI intel, so deriving from it would
  // make the profile page disagree with the directory for the same doctor.
  merged.stateCode = deriveKolUsState(apiKol, { role, education: stat?.education }) ?? undefined;
  return merged;
}

export function hasAiSummary(entry: Pick<DolEntry, 'intel' | 'bio'>): boolean {
  const brief = entry.intel?.aiBrief;
  return Boolean(
    brief?.whoTheyAre?.trim() ||
      brief?.focus?.trim() ||
      brief?.chmContext?.trim(),
  );
}

export function hasDisplaySummary(
  entry: Pick<DolEntry, 'name' | 'role' | 'bio' | 'intel'>,
): boolean {
  return resolveKolDisplayBrief(entry) != null;
}
