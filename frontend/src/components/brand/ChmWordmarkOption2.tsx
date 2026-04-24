import type { SVGProps } from 'react';

/**
 * Brand Option 2: lowercase wordmark (Community Health Media brand adjustments).
 * Uses DM Sans (loaded in index.html) to match CHM digital guidelines.
 */
export default function ChmWordmarkOption2(props: SVGProps<SVGSVGElement>) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 58 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...rest}
    >
      <text
        x="10"
        y="18.5"
        fill="currentColor"
        style={{
          fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
          fontSize: '20px',
          fontWeight: 800,
          letterSpacing: '-0.06em',
        }}
      >
        chm
      </text>
    </svg>
  );
}
