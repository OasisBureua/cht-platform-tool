/** What sits behind a faculty cut-out, so circles, panels and chevrons keep their shape. */
export type Backdrop = 'studio' | 'hue' | 'none';
export const BACKDROPS: [Backdrop, string][] = [
  ['studio', 'Studio'],
  ['hue', 'Colourway'],
  ['none', 'None'],
];
export const BACKDROP_HINT = 'Faculty cut-outs have no background, so this fills their circle or panel. Photos with their own background are left as they are.';

/** How much Brand v2 amber a piece carries. The guide gives amber stats and labels on dark grounds. */
export type Amber = 'accents' | 'field' | 'lead';
export const AMBERS: [Amber, string][] = [
  ['accents', 'Labels'],
  ['field', 'Labels + field'],
  ['lead', 'Amber leads'],
];
export const AMBER_HINT: Record<Amber, string> = {
  accents: 'Knowledge Blue leads. Amber takes the chip, the credit and figures, the way the brand guide uses it.',
  field: 'Labels in amber, plus amber flecks through the particle field.',
  lead: 'Amber leads the field, panel and mark. Knowledge Blue takes the labels.',
};
