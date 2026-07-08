/** Tiny class-combining helper (local to kol-network; no clsx/cva dependency). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
