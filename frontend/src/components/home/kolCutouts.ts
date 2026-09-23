/**
 * Faculty headshots that have a background-free cut-out in
 * /images/kol-cutouts, keyed by the headshot's file name without its
 * extension. Generated from the directory's headshots with the macOS
 * Vision subject-lift; a new face without one falls back to the original
 * photo, blended so its white backdrop takes the card's blue.
 */
export const KOL_CUTOUTS: ReadonlySet<string> = new Set([
  'aditya-bardia',
  'alison-conlin',
  'amy-krie',
  'ana-garrido-castro',
  'anne-o-dea',
  'bill-gradishar',
  'erika-hamilton',
  'fengting-yan',
  'gregory-vidal',
  'heather-mcarthur',
  'igor-makhlin',
  'irene-kang',
  'jason-mouabbi',
  'joyce-o-shaughnessy',
  'komal-jhaveri',
  'mabel-mardones',
  'mark-pegram',
  'mark-robson',
  'martin-dietrich',
  'megan-kruse',
  'michelina-cairo',
  'mothaffar-rimawi',
  'neil-iyengar',
  'nusayba-bagegni',
  'ruemu-birhiray',
  'ruta-rao',
  'tarah-ballinger',
  'tiffany-traina',
  'vk-gadi',
]);

/** A headshot file stem, or a name as a stem: "Dr. Joyce O'Shaughnessy" -> "joyce-o-shaughnessy". */
function stemFromName(name: string): string {
  return name
    .replace(/^dr\.?\s+/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The cut-out for a faculty member, if one exists.
 *
 * Tries the headshot's file name first, then the person's name, and only
 * ever returns a file whose stem matches exactly, so a face can only
 * land on the person it belongs to. The name route is what lets the
 * built-in roster show faces when the directory API is unreachable: that
 * roster carries names but no photo URLs.
 */
export function cutoutFor(name: string, photoUrl?: string | null): string | undefined {
  const fromPhoto = photoUrl?.split('?')[0].split('/').pop()?.replace(/\.[a-z]+$/i, '');
  const stem = [fromPhoto, stemFromName(name)].find((s) => s && KOL_CUTOUTS.has(s));
  return stem ? `/images/kol-cutouts/${stem}.webp` : undefined;
}
