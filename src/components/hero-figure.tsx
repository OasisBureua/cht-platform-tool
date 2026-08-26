"use client";

import { useEffect, useRef, useState } from "react";
import { Mark } from "./mark";

/**
 * The brand's angular, arrow-derived shapes used to mask imagery,
 * per the design brief. Three plates drift on a slow parallax tied
 * to pointer position, with a spring-ish easing so the movement has
 * weight rather than tracking the cursor exactly.
 *
 * Motion stays subtle and purposeful: the brief explicitly asks for
 * a credible professional tone, not a consumer-entertainment feel.
 */

const PLATES = [
 {
 src: "/img/thumb-cleopatra.jpg",
 label: "Video interview",
 cls: "left-0 top-6 h-[13rem] w-[17rem] md:h-[15rem] md:w-[20rem]",
 clip: "polygon(0 0, 100% 0, 100% 78%, 82% 100%, 0 100%)",
 depth: 26,
 },
 {
 src: "/img/thumb-ild.jpg",
 label: "Video podcast",
 cls: "right-2 top-0 h-[11rem] w-[14rem] md:h-[13rem] md:w-[16.5rem]",
 clip: "polygon(18% 0, 100% 0, 100% 100%, 0 100%, 0 22%)",
 depth: -34,
 },
 {
 src: "/img/thumb-db09.jpg",
 label: "Editorial",
 cls: "left-16 bottom-0 h-[10.5rem] w-[15rem] md:left-24 md:h-[12rem] md:w-[17rem]",
 clip: "polygon(0 0, 88% 0, 100% 26%, 100% 100%, 0 100%)",
 depth: 18,
 },
];

export function HeroFigure() {
 const ref = useRef<HTMLDivElement>(null);
 const [offset, setOffset] = useState({ x: 0, y: 0 });
 const [shown, setShown] = useState(false);

 useEffect(() => {
 const id = requestAnimationFrame(() => setShown(true));
 return () => cancelAnimationFrame(id);
 }, []);

 useEffect(() => {
 if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
 if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
 const el = ref.current;
 if (!el) return;
 let frame = 0;
 const onMove = (e: PointerEvent) => {
 cancelAnimationFrame(frame);
 frame = requestAnimationFrame(() => {
 const r = el.getBoundingClientRect();
 setOffset({
 x: (e.clientX - (r.left + r.width / 2)) / r.width,
 y: (e.clientY - (r.top + r.height / 2)) / r.height,
 });
 });
 };
 window.addEventListener("pointermove", onMove, { passive: true });
 return () => {
 window.removeEventListener("pointermove", onMove);
 cancelAnimationFrame(frame);
 };
 }, []);

 return (
 <div ref={ref} aria-hidden className="relative h-[22rem] w-full md:h-[26rem]">
 <span
 className="pointer-events-none absolute -inset-12 rounded-[6px] opacity-70 blur-3xl"
 style={{
 background:
 "radial-gradient(45% 45% at 60% 40%, rgb(47 169 204 / 0.18), transparent 70%), radial-gradient(40% 40% at 30% 70%, rgb(245 165 36 / 0.14), transparent 70%)",
 }}
 />

 {PLATES.map((p, i) => (
 <figure
 key={p.src}
 className={`absolute overflow-hidden shadow-[0_18px_40px_-12px_rgb(34_48_60_/_0.28)] ${p.cls}`}
 style={{
 clipPath: p.clip,
 transform: `translate3d(${offset.x * p.depth}px, ${offset.y * p.depth * 0.6}px, 0)`,
 transition: "transform 700ms cubic-bezier(0.23, 1, 0.32, 1), opacity 600ms ease-out",
 opacity: shown ? 1 : 0,
 transitionDelay: `${i * 90}ms`,
 }}
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={p.src} alt="" className="size-full object-cover" />
 <span className="absolute inset-0 bg-gradient-to-t from-anchor/70 via-transparent to-transparent" />
 <figcaption className="eyebrow absolute bottom-3 left-3 text-white/90">{p.label}</figcaption>
 </figure>
 ))}

 <Mark
 className="absolute right-6 bottom-10 size-12 text-signature drop-shadow-sm md:size-16"
 style={{
 transform: `translate3d(${offset.x * -42}px, ${offset.y * -24}px, 0)`,
 transition: "transform 700ms cubic-bezier(0.23, 1, 0.32, 1)",
 }}
 />
 </div>
 );
}
