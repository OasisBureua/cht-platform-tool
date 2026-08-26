"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll-triggered entry. Matches the reference's restraint:
 * opacity plus a 2px lift, nothing more. Under reduced motion the
 * CSS neutralises both and the content is simply present.
 */
export function Reveal({
 children,
 delay = 0,
 as: As = "div",
 className = "",
}: {
 children: React.ReactNode;
 delay?: number;
 as?: "div" | "section" | "li" | "span";
 className?: string;
}) {
 const ref = useRef<HTMLDivElement>(null);
 const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    // Anything already on screen, or already scrolled past, is shown
    // without waiting for a callback. Two things went wrong without
    // this: content above the fold stayed invisible until the first
    // scroll, and a fast scroll could carry an element from below the
    // fold to above it without ever crossing the threshold, leaving a
    // whole section blank. The rAF lets the hidden state paint once so
    // the transition still runs.
    const settled = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.92;
    };

    if (!("IntersectionObserver" in window) || settled()) {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    io.observe(el);

    // Safety net. The observer is the mechanism; this guarantees the
    // outcome. A threshold that never gets crossed cleanly would
    // otherwise strand a block at opacity 0 with no way back, and
    // invisible content is a far worse failure than an unanimated one.
    const check = () => {
      if (settled()) {
        setShown(true);
        io.disconnect();
        window.removeEventListener("scroll", check);
        window.removeEventListener("resize", check);
      }
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [shown]);

 return (
 <As
 ref={ref as never}
 data-shown={shown}
 style={delay ? { transitionDelay: `${delay}ms` } : undefined}
 className={`reveal ${className}`}
 >
 {children}
 </As>
 );
}
