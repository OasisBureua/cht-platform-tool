import type { CSSProperties, ReactNode } from 'react';

/**
 * The CHM logo-mark watermark used throughout the deck. The standalone app referenced
 * /chm-logo-mark.png; that asset does not exist in the platform's public dir, so this
 * renders the inline SVG LogoMark (fills its container): no broken image, same motif.
 */
export function FluidMark({ color = '#007cff' }: { color?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <g transform="translate(24,24)" fill={color}>
            <path d="M0,0 C-1,-4 0,-9 4,-12 C8,-15 12,-11 10,-6 C9,-3 5,-1 0,0Z" />
            <path d="M0,0 C4,-1 9,0 12,4 C15,8 11,12 6,10 C3,9 1,5 0,0Z" />
            <path d="M0,0 C1,4 0,9 -4,12 C-8,15 -12,11 -10,6 C-9,3 -5,1 0,0Z" />
            <path d="M0,0 C-4,1 -9,0 -12,-4 C-15,-8 -11,-12 -6,-10 C-3,-9 -1,-5 0,0Z" />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** The two corner logo watermarks used on every decorated panel. */
export function CornerLogos({ color = '#007cff' }: { color?: string }) {
  return (
    <>
      <div className="pointer-events-none absolute -right-12 -top-12 select-none" style={{ opacity: 0.12 }}>
        <div className="h-52 w-52" style={{ transform: 'rotate(15deg)' }}>
          <FluidMark color={color} />
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-8 -left-8 select-none" style={{ opacity: 0.08 }}>
        <div className="h-24 w-24" style={{ transform: 'rotate(-20deg)' }}>
          <FluidMark color={color} />
        </div>
      </div>
    </>
  );
}

/** Panel with corner logo watermarks and a z-lifted content column. */
export function DecoPanel({
  className = '',
  style,
  markColor,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  markColor?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative flex flex-col overflow-hidden ${className}`} style={style}>
      <CornerLogos color={markColor} />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}

/** One 16:9 deck slide section. Colors are hardcoded (not tokens) so the deck keeps its
 *  intrinsic dark/light look regardless of the platform theme. */
export function Slide({
  id,
  dark = false,
  extra = '',
  children,
}: {
  id: string;
  dark?: boolean;
  extra?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`exec-slide relative flex w-full flex-col overflow-hidden ${
        dark ? 'bg-[#373737] text-white' : 'bg-white text-[#373737]'
      } ${extra}`}
      style={{ minHeight: '56.25vw', breakAfter: 'page', fontFamily: 'Geist, sans-serif' }}
    >
      {children}
    </section>
  );
}

/** Dark slate header band with teal kicker used on Production/Distribution slides. */
export function SlideHeaderBar({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="flex-shrink-0 bg-[#373737] px-14 py-8 text-white">
      <div className="mb-1 text-sm font-bold uppercase tracking-[0.28em] text-[#007cff]">{kicker}</div>
      <h2 className="text-5xl font-black tracking-tight">{title}</h2>
    </div>
  );
}

/** Node/dot constellation motif on the cover slide (copied verbatim from the original). */
export function CoverNodes() {
  return (
    <svg viewBox="0 0 500 640" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <line x1="325" y1="68" x2="152" y2="192" stroke="#3dc4c0" strokeWidth="1.5" strokeOpacity="0.55" />
      <line x1="325" y1="68" x2="415" y2="325" stroke="#3dc4c0" strokeWidth="1.5" strokeOpacity="0.55" />
      <line x1="152" y1="192" x2="415" y2="325" stroke="#c54ebe" strokeWidth="1.5" strokeOpacity="0.55" />
      <line x1="415" y1="325" x2="265" y2="408" stroke="#5c5c5c40" strokeWidth="1.5" strokeOpacity="0.55" />
      <line x1="265" y1="408" x2="118" y2="528" stroke="#3dc4c0" strokeWidth="1.5" strokeOpacity="0.55" />
      <line x1="118" y1="528" x2="415" y2="605" stroke="#c54ebe" strokeWidth="1.5" strokeOpacity="0.55" />
      <circle cx="325" cy="68" r="11" fill="#3dc4c0" fillOpacity="0.9" />
      <circle cx="152" cy="192" r="8" fill="#3dc4c0" fillOpacity="0.9" />
      <circle cx="415" cy="325" r="15" fill="#c54ebe" fillOpacity="0.9" />
      <circle cx="265" cy="408" r="6" fill="#5c5c5c" fillOpacity="0.9" />
      <circle cx="118" cy="528" r="12" fill="#3dc4c0" fillOpacity="0.9" />
      <circle cx="415" cy="605" r="13" fill="#f99d9d" fillOpacity="0.9" />
    </svg>
  );
}

const PLATFORM_TILE_COLORS: Record<string, string> = {
  YouTube: '#ff0000',
  LinkedIn: '#0077b5',
  Meta: '#1877f2',
};

export function PlatformTile({
  platform,
  totalViews,
  totalImpressions,
  hasData,
}: {
  platform: string;
  totalViews: number;
  totalImpressions: number;
  hasData: boolean;
}) {
  const color = PLATFORM_TILE_COLORS[platform] ?? '#5c5c5c';
  const fmt = (n: number) => (hasData ? Number(n).toLocaleString('en-US') : '-');
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: `${color}30` }}>
      <DecoPanel className="h-14 flex-shrink-0 items-end px-4 pb-2" style={{ backgroundColor: color }} markColor="#ffffff">
        <div className="text-sm font-black uppercase tracking-widest text-white">{platform}</div>
      </DecoPanel>
      <div className="flex flex-col gap-4 bg-white p-5">
        <div>
          <div className="text-5xl font-black leading-none text-[#373737]">{fmt(totalViews)}</div>
          <div className="mt-2 text-sm font-semibold uppercase tracking-wide text-[#5c5c5c]">Total Views</div>
        </div>
        <div className="h-px bg-[#f6f6f6]" />
        <div>
          <div className="text-5xl font-black leading-none text-[#373737]">{fmt(totalImpressions)}</div>
          <div className="mt-2 text-sm font-semibold uppercase tracking-wide text-[#5c5c5c]">Total Impressions</div>
        </div>
      </div>
    </div>
  );
}

export function TouchRow({
  stat,
  color,
  posts,
  hint,
}: {
  stat: string;
  color: string;
  posts: string | null;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-10">
      <div className="w-72 flex-shrink-0">
        <div className="text-4xl font-black" style={{ color }}>{stat}</div>
      </div>
      <div className="h-10 w-px flex-shrink-0 bg-white/15" />
      <div className="flex flex-1 items-center gap-6">
        {posts ? (
          <div className="text-xl font-medium text-white">{posts} posts</div>
        ) : (
          <div className="text-xl font-medium italic text-white/25">Post count not set</div>
        )}
        <div className="max-w-xs text-base leading-relaxed text-white/35">{hint}</div>
      </div>
    </div>
  );
}
