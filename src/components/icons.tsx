/**
 * One SVG per glyph, drawn on a 24px grid with `currentColor`.
 * States come from CSS color and opacity, never from a second asset.
 * `strokeWidth` matches the optical weight of adjacent text:
 * 1.5 beside regular, 2 beside semibold.
 */
type IconProps = {
 className?: string;
 strokeWidth?: number;
};

const base = "shrink-0";

function Svg({
 className = "",
 strokeWidth = 1.5,
 children,
}: IconProps & { children: React.ReactNode }) {
 return (
 <svg
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth={strokeWidth}
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 focusable="false"
 className={`${base} ${className}`}
 >
 {children}
 </svg>
 );
}

export function ChevronDown(props: IconProps) {
 return (
 <Svg {...props}>
 <path d="M5 9l7 7 7-7" />
 </Svg>
 );
}

/* Reading-direction glyph: mirrors under dir="rtl". */
export function ArrowRight({ className = "", ...rest }: IconProps) {
 return (
 <Svg className={`rtl:-scale-x-100 ${className}`} {...rest}>
 <path d="M4 12h15M13 6l6 6-6 6" />
 </Svg>
 );
}

export function ArrowLeft({ className = "", ...rest }: IconProps) {
 return (
 <Svg className={`rtl:-scale-x-100 ${className}`} {...rest}>
 <path d="M20 12H5M11 18l-6-6 6-6" />
 </Svg>
 );
}

export function SearchIcon(props: IconProps) {
 return (
 <Svg {...props}>
 <circle cx="11" cy="11" r="7" />
 <path d="M20 20l-3.5-3.5" />
 </Svg>
 );
}

export function CloseIcon(props: IconProps) {
 return (
 <Svg {...props}>
 <path d="M6 6l12 12M18 6L6 18" />
 </Svg>
 );
}

export function MenuIcon(props: IconProps) {
 return (
 <Svg {...props}>
 <path d="M4 7h16M4 12h16M4 17h16" />
 </Svg>
 );
}

/* Filled: play and pause are solid shapes, not outlines.
 The triangle is nudged 1px along the inline axis because its
 geometric centre sits left of its visual centre. */
export function PlayIcon({ className = "" }: { className?: string }) {
 return (
 <svg
 viewBox="0 0 24 24"
 fill="currentColor"
 aria-hidden="true"
 focusable="false"
 className={`${base} translate-x-[1px] ${className}`}
 >
 <path d="M8 5.2a1 1 0 011.53-.85l9 6.8a1 1 0 010 1.7l-9 6.8A1 1 0 018 18.8z" />
 </svg>
 );
}

export function PauseIcon({ className = "" }: { className?: string }) {
 return (
 <svg
 viewBox="0 0 24 24"
 fill="currentColor"
 aria-hidden="true"
 focusable="false"
 className={`${base} ${className}`}
 >
 <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
 <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
 </svg>
 );
}
