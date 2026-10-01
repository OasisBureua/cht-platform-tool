/**
 * Twenty-eight bar heights for a show's waveform, seeded from the show
 * id so a show looks the same on every render. Delays step back 70ms a
 * bar on a 1.9s cycle, as in the theme.
 */
export function waveBars(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  return Array.from({ length: 28 }, (_, i) => ({
    height: 18 + Math.round(rand() * 76),
    delay: (((1.9 - i * 0.07) % 1.9) + 1.9) % 1.9,
  }));
}
