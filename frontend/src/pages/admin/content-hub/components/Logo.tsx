// CHM logo mark — ported from the report generator's src/components/Logo.tsx.
export function LogoMark({ size = 34, color = '#3da4c0' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(24,24)" fill={color}>
        <path d="M0,0 C-1,-4 0,-9 4,-12 C8,-15 12,-11 10,-6 C9,-3 5,-1 0,0Z" />
        <path d="M0,0 C4,-1 9,0 12,4 C15,8 11,12 6,10 C3,9 1,5 0,0Z" />
        <path d="M0,0 C1,4 0,9 -4,12 C-8,15 -12,11 -10,6 C-9,3 -5,1 0,0Z" />
        <path d="M0,0 C-4,1 -9,0 -12,-4 C-15,-8 -11,-12 -6,-10 C-3,-9 -1,-5 0,0Z" />
      </g>
    </svg>
  );
}
