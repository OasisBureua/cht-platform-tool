const NAME_SUFFIXES = new Set([
  'md',
  'do',
  'phd',
  'mba',
  'mph',
  'facp',
  'facs',
  'jr',
  'sr',
  'ii',
  'iii',
  'iv',
]);

/** Normalize a doctor slug or name token for comparison (e.g. `dr-aditya-bardia` → `adityabardia`). */
export function normalizeDoctorSlugToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/^dr-?/, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Last token from a display name, skipping credentials (Dr., MD, etc.). */
export function extractKolLastName(displayName: string): string | null {
  const stripped = displayName
    .replace(/^dr\.?\s*/i, '')
    .replace(/,.*$/, '')
    .trim();
  if (!stripped) return null;

  const parts = stripped.split(/\s+/).filter(Boolean);
  while (parts.length > 1) {
    const tail = parts[parts.length - 1].toLowerCase().replace(/\./g, '');
    if (NAME_SUFFIXES.has(tail)) {
      parts.pop();
      continue;
    }
    break;
  }
  if (parts.length === 0) return null;

  const last = parts[parts.length - 1].replace(/[^a-zA-Z'-]/g, '');
  if (!last || last.length < 2) return null;
  return last.toLowerCase();
}

/** Common MediaHub slug shapes derived from a surname. */
export function lastNameSlugCandidates(lastName: string): string[] {
  const token = lastName.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!token || token.length < 2) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (slug: string) => {
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  };
  add(token);
  add(`dr-${token}`);
  return out;
}

/**
 * Match MediaHub doctor slugs by surname when KOL id does not match catalog tags.
 * Skips ambiguous matches (multiple doctors with the same last name) unless KOL slug disambiguates.
 */
export function matchCatalogDoctorSlugsByLastName(
  lastName: string,
  doctors: { slug: string }[],
  kolSlug?: string,
): string[] {
  const ln = normalizeDoctorSlugToken(lastName);
  if (!ln || ln.length < 3) return [];

  const kolToken = kolSlug ? normalizeDoctorSlugToken(kolSlug) : '';
  const matches = doctors.filter(({ slug }) => {
    const slugNorm = normalizeDoctorSlugToken(slug);
    return slugNorm === ln || slugNorm.endsWith(ln) || slugNorm.includes(ln);
  });
  if (matches.length === 0) return [];

  if (kolToken) {
    const kolMatches = matches.filter(({ slug }) => {
      const slugNorm = normalizeDoctorSlugToken(slug);
      return slugNorm.includes(kolToken) || kolToken.includes(slugNorm);
    });
    if (kolMatches.length === 1) return [kolMatches[0].slug];
    if (kolMatches.length > 1) {
      return kolMatches.map((d) => d.slug);
    }
  }

  const exact = matches.filter(({ slug }) => normalizeDoctorSlugToken(slug) === ln);
  if (exact.length === 1) return [exact[0].slug];

  if (matches.length === 1) return [matches[0].slug];

  return [];
}
