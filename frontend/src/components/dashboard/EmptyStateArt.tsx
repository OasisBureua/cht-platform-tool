/**
 * Line drawings for the dashboard's empty tiles, after the ones in the
 * dashboard design. Every colour is a theme token, so they follow the
 * appearance: ink outlines, paper fills, the anchor teal as the accent.
 * Decorative only, so they are hidden from assistive tech.
 */
const INK = 'hsl(var(--text))';
const PAPER = 'hsl(var(--surface-1))';
const ACCENT = 'hsl(var(--anchor))';
const ACCENT_SOFT = 'hsl(var(--anchor) / 0.14)';
const LINE = 'hsl(var(--hairline-strong))';

/** A calendar with one day marked, and a clock over its corner. */
export function CalendarClockArt({ className = '' }: { className?: string }) {
  const cells: [number, number][] = [
    [52, 66], [71, 66], [90, 66], [109, 66], [128, 66],
    [52, 84], [71, 84], [109, 84], [128, 84],
    [52, 102], [71, 102], [90, 102],
  ];
  return (
    <svg viewBox="0 0 220 150" className={className} aria-hidden focusable="false">
      <ellipse cx="110" cy="140" rx="84" ry="6" fill={LINE} />
      <rect x="40" y="34" width="112" height="98" rx="10" fill={PAPER} stroke={INK} strokeWidth="2" />
      <path d="M40 44a10 10 0 0 1 10-10h92a10 10 0 0 1 10 10v12H40z" fill={ACCENT} stroke={INK} strokeWidth="2" />
      <rect x="64" y="24" width="7" height="18" rx="3.5" fill={INK} />
      <rect x="121" y="24" width="7" height="18" rx="3.5" fill={INK} />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="13" height="11" rx="2.5" fill={ACCENT_SOFT} />
      ))}
      <rect x="90" y="84" width="13" height="11" rx="2.5" fill={ACCENT} />
      <circle cx="160" cy="108" r="28" fill={PAPER} stroke={INK} strokeWidth="2" />
      <circle cx="160" cy="108" r="21" fill={ACCENT_SOFT} />
      <path d="M160 108V94M160 108l10 6" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="160" cy="108" r="3" fill={ACCENT} />
    </svg>
  );
}

/** A clipboard with two items ticked and one to go. */
export function SurveyClipboardArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden focusable="false">
      <ellipse cx="100" cy="132" rx="70" ry="5" fill={LINE} />
      <rect x="58" y="18" width="84" height="110" rx="9" fill={ACCENT_SOFT} stroke={INK} strokeWidth="2" />
      <rect x="67" y="30" width="66" height="90" rx="4" fill={PAPER} stroke={INK} strokeWidth="2" />
      <rect x="82" y="11" width="36" height="15" rx="4" fill={ACCENT} stroke={INK} strokeWidth="2" />
      <g stroke={INK} strokeWidth="2" fill={PAPER}>
        <rect x="75" y="46" width="12" height="12" rx="3" />
        <rect x="75" y="68" width="12" height="12" rx="3" />
        <rect x="75" y="90" width="12" height="12" rx="3" />
      </g>
      <path
        d="M77.5 52l3 3 5-6M77.5 74l3 3 5-6"
        stroke={ACCENT}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g stroke={LINE} strokeWidth="3.2" strokeLinecap="round">
        <path d="M94 52h28M94 74h22M94 96h26" />
      </g>
    </svg>
  );
}
