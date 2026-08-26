/**
 * NAV ICON TONES
 *
 * Each nav destination carries its own hue on the ICON only; the label keeps
 * whatever colour the row is already using. The hue is declared beside the
 * destination in the nav config, so inserting, removing or reordering an item
 * leaves every other item's colour untouched. Deriving it from the map index
 * at render time would reshuffle the whole rail on a single insertion.
 *
 * These are the TEXT-safe steps of the spectrum. A 2px lucide stroke is
 * effectively text, so the bright `cerebral-*` hues cannot carry it: they sit
 * near 1.7:1 on white. The `ink-*` steps deepen in the light appearance and
 * lift in the dark one; `anchor` and `amber` are the platform's own text
 * accents and extend the set to seven.
 *
 * The tone is a resting-state colour. On an ACTIVE row the icon drops it and
 * inherits the row's own colour, because every active treatment in this app is
 * a filled or tinted chip (steel in the member shell, `primary` in admin,
 * `brand-600` in the admin drawer) whose ground a resting hue was never
 * measured against.
 *
 * One deliberate caveat: in the DARK appearance `--amber-ink` and `--ink-coral`
 * both resolve to the same salmon. Never seat `text-amber` adjacent to
 * `text-ink-coral` in the same list.
 */
export type NavIconTone =
  | 'text-ink-coral'
  | 'text-ink-purple'
  | 'text-ink-cyan'
  | 'text-ink-pink'
  | 'text-anchor'
  | 'text-ink-green'
  | 'text-amber';
