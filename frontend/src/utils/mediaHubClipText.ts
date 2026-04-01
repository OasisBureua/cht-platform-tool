/**
 * Detects LLM refusal text MediaHub sometimes stores in ai_summary instead of a real summary.
 */
export function isAiEducationRefusalText(text: string | undefined | null): boolean {
  if (text == null || typeof text !== 'string') return false;
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (t.includes('unable to generate a medical education')) return true;
  if (t.includes('unable to generate') && t.includes('medical education')) return true;
  if (t.includes('i appreciate you sharing this') && t.includes('unable to generate')) return true;
  if (t.includes("i'd be happy to create an appropriate description")) return true;
  if (t.includes('happy to create an appropriate description')) return true;
  if (t.includes('if you have a video featuring a kol')) return true;
  if (t.includes('healthcare professionals discussing medical topics')) return true;
  if (t.includes('not clinical or medical educational content')) return true;
  if (t.includes('voting initiative rather than clinical')) return true;
  if (t.includes('rather than clinical or medical educational')) return true;
  return false;
}

function stripRefusal(text: string | undefined | null): string {
  if (text == null || typeof text !== 'string') return '';
  const s = text.trim();
  if (!s || isAiEducationRefusalText(s)) return '';
  return s;
}

function clipAiSummaryRaw(clip: Record<string, unknown>): string | undefined {
  const v = clip.ai_summary ?? clip.aiSummary;
  return typeof v === 'string' ? v : undefined;
}

function clipDescriptionRaw(clip: Record<string, unknown>): string | undefined {
  const v = clip.description;
  return typeof v === 'string' ? v : undefined;
}

/**
 * Card / list preview: prefer usable ai_summary (or aiSummary), else description (if not refusal). Empty = show title only.
 */
export function clipDisplaySummary(
  clip: { ai_summary?: string; aiSummary?: string; description?: string } | Record<string, unknown>,
): string {
  const raw = clip as Record<string, unknown>;
  const fromAi = stripRefusal(clipAiSummaryRaw(raw));
  if (fromAi) return fromAi;
  return stripRefusal(clipDescriptionRaw(raw));
}
