import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type Phase = 'pending' | 'hidden' | 'shown';

/**
 * Scroll-triggered entry: opacity plus a 2px lift, nothing more.
 *
 * This fails VISIBLE. The obvious implementation starts every block at
 * opacity 0 and waits for an observer to reveal it, which means any
 * missed callback leaves content permanently invisible — and that is a
 * far worse failure than an unanimated one. It bit this page for real:
 * dragging the scrollbar left eight on-screen blocks blank.
 *
 * So the block only hides if, at first paint, it is genuinely below the
 * fold. Anything else renders shown and never depends on JS at all.
 * Once hidden, three independent things can reveal it — the observer,
 * a scroll/resize check, and a slow poll — because the poll cannot miss
 * an edge the way a threshold can.
 */
export function Reveal({
  children,
  delay = 0,
  as: As = 'div',
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'span';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('pending');

  // Before paint, so hiding a below-fold block never flashes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const belowFold = el.getBoundingClientRect().top > window.innerHeight * 0.92;
    setPhase(belowFold ? 'hidden' : 'shown');
  }, []);

  useEffect(() => {
    if (phase !== 'hidden') return;
    const el = ref.current;
    if (!el) return;

    const settled = () => el.getBoundingClientRect().top < window.innerHeight * 0.92;
    const show = () => setPhase('shown');
    if (settled()) {
      show();
      return;
    }

    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting || entry.boundingClientRect.top < 0) show();
            },
            { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
          )
        : null;
    io?.observe(el);

    const check = () => {
      if (settled()) show();
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });

    // The poll is the guarantee. A threshold can be jumped clean over by
    // a scrollbar drag; a position check every 400ms cannot.
    const poll = window.setInterval(check, 400);

    return () => {
      io?.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      window.clearInterval(poll);
    };
  }, [phase]);

  return (
    <As
      ref={ref as never}
      data-shown={phase !== 'hidden'}
      style={delay && phase === 'hidden' ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${className}`}
    >
      {children}
    </As>
  );
}
