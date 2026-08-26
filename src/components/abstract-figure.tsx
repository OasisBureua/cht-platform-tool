/**
 * Hand-drawn hero illustrations. Only two pages use these: Live and
 * Office Hours, where the subject is an event rather than a screen.
 * Paths are deliberately a little irregular so they read as drawn
 * rather than generated, with varied stroke weight and a few open
 * ends.
 */

type Variant = "broadcast" | "conversation";

const ink = "currentColor";

/* Live: a session going out, and the room receiving it. */
function Broadcast() {
  return (
    <g fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
      {/* signal arcs, drawn loose and open */}
      <path d="M470 236 C 523 214, 585 219, 631 251" strokeWidth="2" opacity="0.9" />
      <path d="M452 190 C 531 152, 632 159, 700 213" strokeWidth="1.6" opacity="0.7" />
      <path d="M436 142 C 542 90, 679 100, 767 175" strokeWidth="1.3" opacity="0.5" />
      <path d="M421 96 C 552 30, 725 43, 831 137" strokeWidth="1.1" opacity="0.32" />

      {/* the camera body, slightly off-square */}
      <path d="M168 246 L 402 231 L 409 372 L 176 389 Z" strokeWidth="2.2" />
      <path d="M402 268 L 470 236 L 476 330 L 408 344 Z" strokeWidth="2" />
      <circle cx="243" cy="300" r="34" strokeWidth="1.8" />
      <circle cx="243" cy="300" r="17" strokeWidth="1.3" opacity="0.75" />
      <path d="M330 276 l 44 -3" strokeWidth="1.4" opacity="0.6" />
      <path d="M331 300 l 30 -2" strokeWidth="1.4" opacity="0.45" />

      {/* tripod, one leg longer than the other on purpose */}
      <path d="M286 389 L 268 520" strokeWidth="2" />
      <path d="M292 389 L 372 512" strokeWidth="2" />
      <path d="M289 400 L 231 505" strokeWidth="1.7" opacity="0.8" />

      {/* the room: a few figures watching, barely there */}
      <g opacity="0.42" strokeWidth="1.5">
        <circle cx="546" cy="404" r="15" />
        <path d="M523 448 C 528 424, 566 423, 571 448" />
        <circle cx="626" cy="392" r="13" />
        <path d="M606 432 C 610 411, 643 410, 648 432" />
        <circle cx="700" cy="410" r="14" />
        <path d="M679 452 C 683 430, 718 429, 723 452" />
      </g>

      {/* live dot */}
      <circle cx="196" cy="272" r="6" strokeWidth="0" fill={ink} opacity="0.75" />
    </g>
  );
}

/* Office Hours: a case handed over, and two people arguing about it. */
function Conversation() {
  return (
    <g fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
      {/* the question, coming in */}
      <path
        d="M120 132 C 120 106, 143 92, 178 92 L 372 92 C 407 92, 428 107, 428 133 L 428 233 C 428 258, 407 272, 372 272 L 214 272 L 152 320 L 166 272 C 133 268, 120 254, 120 231 Z"
        strokeWidth="2.2"
      />
      <path d="M164 148 l 196 -4" strokeWidth="1.5" opacity="0.55" />
      <path d="M164 180 l 168 -3" strokeWidth="1.5" opacity="0.45" />
      <path d="M164 212 l 120 -2" strokeWidth="1.5" opacity="0.35" />

      {/* the case itself: a scan, sketched */}
      <rect x="308" y="316" width="196" height="150" rx="10" strokeWidth="2" />
      <path d="M330 430 C 358 372, 386 404, 408 366 C 430 330, 458 400, 482 372" strokeWidth="1.8" opacity="0.8" />
      <path d="M330 452 l 60 -1" strokeWidth="1.3" opacity="0.4" />

      {/* the answer, coming back the other way */}
      <path
        d="M556 356 C 556 331, 578 316, 612 316 L 792 316 C 826 316, 848 331, 848 356 L 848 448 C 848 473, 826 488, 792 488 L 660 488 L 604 532 L 616 488 C 578 484, 556 470, 556 447 Z"
        strokeWidth="2"
        opacity="0.85"
      />
      <path d="M598 372 l 178 -3" strokeWidth="1.5" opacity="0.5" />
      <path d="M598 404 l 142 -2" strokeWidth="1.5" opacity="0.4" />
      <path d="M598 436 l 96 -2" strokeWidth="1.5" opacity="0.3" />

      {/* two heads, leaning in */}
      <g opacity="0.5" strokeWidth="1.7">
        <circle cx="196" cy="392" r="24" />
        <path d="M158 464 C 164 424, 228 423, 234 464" />
        <circle cx="712" cy="596" r="22" />
        <path d="M676 662 C 682 626, 742 625, 748 662" />
      </g>

      {/* the disagreement, marked */}
      <path d="M512 250 l 26 -22" strokeWidth="1.6" opacity="0.6" />
      <path d="M528 274 l 32 -6" strokeWidth="1.6" opacity="0.45" />
    </g>
  );
}

const VARIANTS: Record<Variant, () => React.ReactElement> = {
  broadcast: Broadcast,
  conversation: Conversation,
};

export function AbstractFigure({ variant }: { variant: Variant }) {
  const Shape = VARIANTS[variant];
  return (
    <div aria-hidden className="pointer-events-none relative h-[22rem] w-full md:h-[28rem]">
      <div
        className="absolute -inset-12 opacity-90 blur-3xl"
        style={{
          background:
            "radial-gradient(45% 45% at 60% 40%, color-mix(in oklab, var(--color-beam) 30%, transparent), transparent 72%), radial-gradient(40% 40% at 32% 74%, color-mix(in oklab, var(--color-pink) 26%, transparent), transparent 72%)",
        }}
      />
      <svg
        viewBox="0 0 900 660"
        className="absolute inset-0 size-full text-anchor/45"
        style={{
          maskImage: "radial-gradient(82% 82% at 46% 46%, #000 55%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(82% 82% at 46% 46%, #000 55%, transparent 100%)",
        }}
      >
        <Shape />
      </svg>
    </div>
  );
}
