import { KOL_CUTOUTS } from '../../home/kolCutouts';

/** Faculty with a background-free cut-out, as studio faces. Same origin, so exports stay clean. */
export type Faculty = { stem: string; name: string; url: string };

const SPECIAL: Record<string, string> = { vk: 'VK' };

export function nameFromStem(stem: string): string {
  const parts = stem.split('-');
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === 'o' && parts[i + 1]) {
      const next = parts[++i];
      out.push(`O’${next.charAt(0).toUpperCase()}${next.slice(1)}`);
    } else out.push(SPECIAL[p] ?? p.charAt(0).toUpperCase() + p.slice(1));
  }
  return out.join(' ');
}

export const FACULTY: Faculty[] = [...KOL_CUTOUTS]
  .map((stem) => ({ stem, name: nameFromStem(stem), url: `/images/kol-cutouts/${stem}.webp` }))
  .sort((a, b) => a.name.split(' ').slice(-1)[0].localeCompare(b.name.split(' ').slice(-1)[0]));

/** "Dr. A", "Drs. A & B", "Drs. A, B & C": the credit that matches the faces. */
export function creditFor(names: string[]): string {
  if (!names.length) return '';
  if (names.length === 1) return `Dr. ${names[0]}`;
  return `Drs. ${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
