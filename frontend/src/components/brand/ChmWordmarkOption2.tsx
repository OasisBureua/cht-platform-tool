import type { SVGProps } from 'react';

/**
 * Brand Option 2: lowercase wordmark (Community Health Media brand adjustments).
 * Uses Chillax (see index.html / tailwind fontFamily.sans).
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
        className="text-[#ea580c] dark:text-[#fb923c]"
        style={{
          fontFamily: "'Chillax', system-ui, sans-serif",
          fontSize: '20px',
          fontWeight: 700,
          letterSpacing: '-0.06em',
        }}
      >
        chm
      </text>
    </svg>
  );
}
