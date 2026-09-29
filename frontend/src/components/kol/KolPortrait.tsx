import { cutoutFor } from '../home/kolCutouts';

/**
 * A large faculty portrait in the homepage's treatment: the card blue
 * easing from a mid teal to a pale wash, with the person standing in it.
 *
 * A background-free cut-out is preferred and sits on the ground. A plain
 * headshot fills the frame instead, cropped to the face, so its studio
 * backdrop never shows as a box inside the blue. With no photo at all the
 * initials stand in, large.
 */
const CARD_BLUE =
  'linear-gradient(to bottom, hsl(193 52% 34%) 0%, hsl(193 42% 46%) 48%, hsl(195 30% 70%) 100%)';

function initialsOf(name: string): string {
  return name
    .replace(/^Dr\.?\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function KolPortrait({
  name,
  photoUrl,
  className = '',
}: {
  name: string;
  photoUrl?: string | null;
  /** Size and aspect come from the caller, e.g. `aspect-[4/5] w-full`. */
  className?: string;
}) {
  const cutout = cutoutFor(name, photoUrl);
  return (
    <div
      className={`relative overflow-hidden rounded-card ${className}`}
      style={{ background: CARD_BLUE }}
    >
      {cutout ? (
        <img
          src={cutout}
          alt=""
          loading="lazy"
          className="absolute bottom-0 left-1/2 h-auto w-[86%] max-w-none -translate-x-1/2"
        />
      ) : photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover object-[50%_22%]"
        />
      ) : (
        <span
          aria-hidden
          className="display absolute inset-0 grid place-items-center text-[clamp(2rem,5vw,3.25rem)] text-white/55"
        >
          {initialsOf(name)}
        </span>
      )}
    </div>
  );
}
