/** Pretty label for MediaHub doctor slug (matches Videos / Catalog dropdowns). */
export function doctorLabelFromSlug(slug: string): string {
  const cleaned = slug.replace(/^dr-?/i, '').replace(/-/g, ' ');
  const parts = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  return `Dr. ${parts.join(' ')}`;
}
