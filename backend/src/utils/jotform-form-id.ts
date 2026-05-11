/**
 * Best-effort parse of Jotform numeric form ID from embed / form URLs.
 * Examples: https://form.jotform.com/241234567890123, https://www.jotform.com/123456789012345
 */
export function extractJotformFormIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(
      trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
    );
    const fromQuery =
      u.searchParams.get('formId') || u.searchParams.get('formid');
    if (fromQuery && /^\d{6,}$/.test(fromQuery)) return fromQuery;
    const pathMatch = u.pathname.match(/(\d{6,})\/?$/);
    if (pathMatch) return pathMatch[1];
  } catch {
    const loose = trimmed.match(/(\d{7,})/);
    return loose ? loose[1] : null;
  }
  return null;
}
