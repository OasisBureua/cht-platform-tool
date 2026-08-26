"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { search, formatHref, formatLabel } from "@/lib/data";
import { areas } from "@/lib/platform";
import { Wordmark } from "./mark";
import { ChevronDown, CloseIcon, MenuIcon, SearchIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

/* Mirrors the live platform's information architecture. */
const nav = [
 { href: "/catalog", label: "Content Library" },
 { href: "/kol-network", label: "KOL Network" },
 { href: "/live", label: "Live" },
 { href: "/chm-office-hours", label: "CHM Office Hours" },
];

const FOCUSABLE =
 'a[href], button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/* Auth routes are single-task screens: one column, one thing to do.
   The chrome would only offer ways to leave it. */
const BARE = ["/login", "/join"];

export function SiteHeader() {
 const pathname = usePathname();

  if (BARE.includes(pathname)) return null;
 const [diseaseOpen, setDiseaseOpen] = useState(false);
 const [searchOpen, setSearchOpen] = useState(false);
 const [mobileOpen, setMobileOpen] = useState(false);

 const [lastPath, setLastPath] = useState(pathname);
 if (lastPath !== pathname) {
 setLastPath(pathname);
 setDiseaseOpen(false);
 setSearchOpen(false);
 setMobileOpen(false);
 }

 useEffect(() => {
 const onKey = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
 e.preventDefault();
 setSearchOpen((v) => !v);
 }
 };
 window.addEventListener("keydown", onKey);
 return () => window.removeEventListener("keydown", onKey);
 }, []);

 const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

 return (
 <>
 <a
 href="#main"
 className="press eyebrow sr-only rounded-[6px] bg-text px-5 py-3 text-ground focus:not-sr-only focus:absolute focus:top-4 focus:start-4 focus:z-[70]"
 >
 Skip to content
 </a>

 <header className="sticky top-0 z-50 pt-3 md:pt-4">
        <div className="rail">
          <div className="flex h-16 flex-nowrap items-center gap-3 rounded-[6px] bg-[color-mix(in_oklab,var(--color-surface)_78%,transparent)] px-4 whitespace-nowrap shadow-[var(--shadow-nav)] ring-1 ring-[color-mix(in_oklab,var(--color-text)_10%,transparent)] backdrop-blur-2xl backdrop-saturate-150 md:px-5 xl:gap-5">
 <Link href="/" className="press shrink-0 rounded-[6px] py-1 text-xl text-text" aria-label="CHM, home">
 <Wordmark markClassName="text-accent" />
 </Link>

 <nav aria-label="Primary" className="hidden shrink-0 items-center gap-0.5 lg:flex">
 {nav.map((n) => (
 <Link
 key={n.href}
 href={n.href}
 aria-current={isActive(n.href) ? "page" : undefined}
 className={`press rounded-[6px] px-3 py-2 text-body-s ${
 isActive(n.href) ? "text-text" : "text-dim hover:text-text"
 }`}
 >
 {n.label}
 </Link>
 ))}
 <DiseaseMenu open={diseaseOpen} setOpen={setDiseaseOpen} active={pathname.startsWith("/catalog/")} />
 </nav>

 <div className="ms-auto flex shrink-0 items-center gap-2">
 <button
 type="button"
 onClick={() => setSearchOpen(true)}
 aria-label="Search the library"
 className="press grid size-9 place-items-center rounded-[6px] text-dim hover:text-text"
 >
 <SearchIcon className="size-[18px]" strokeWidth={1.5} />
 </button>

 <ThemeToggle />

 

 <Link
 href="/for-hcps"
 className="press hidden h-9 shrink-0 items-center rounded-[6px] px-3.5 text-[0.8125rem] text-text shadow-[var(--shadow-card)] hover:bg-surface-2 sm:inline-flex"
 >
 For HCPs
 </Link>

{/* Two plain controls. A chevron here read as a dropdown but
              only linked to sign-in, so the icon lied about the action. */}
          <Link
            href="/login"
            className="press hidden h-9 shrink-0 items-center rounded-[6px] px-3 text-[0.8125rem] text-dim hover:text-text sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/join"
            className="press hidden h-9 shrink-0 items-center rounded-[6px] bg-inverse px-4 text-[0.8125rem] font-medium text-ground hover:brightness-[0.92] sm:inline-flex"
          >
            Get started
          </Link>

 <button
 type="button"
 onClick={() => setMobileOpen((v) => !v)}
 aria-expanded={mobileOpen}
 aria-controls="mobile-nav"
 aria-label={mobileOpen ? "Close menu" : "Open menu"}
 className="press grid size-10 shrink-0 place-items-center rounded-[6px] text-text lg:hidden"
 >
 {mobileOpen ? <CloseIcon className="size-5" strokeWidth={1.75} /> : <MenuIcon className="size-5" strokeWidth={1.75} />}
 </button>
 </div>
 </div>

 {mobileOpen ? (
<div className="rail mt-2 lg:hidden">
            {/* The panel needs its own ground. Open over the hero it was
                previously transparent, so the links sat on the artwork
                and could not be read. Frosted, not opaque, so it still
                reads as floating above the page. */}
            <nav
              id="mobile-nav"
              aria-label="Mobile"
              className="rise max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-[6px] bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] p-2 shadow-[var(--shadow-pop)] ring-1 ring-[color-mix(in_oklab,var(--color-text)_10%,transparent)] backdrop-blur-2xl backdrop-saturate-150"
            >
              {[...nav, { href: "/for-hcps", label: "For HCPs" }, { href: "/contact", label: "Contact" }, { href: "/login", label: "Log in" }].map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="press block rounded-[6px] px-3 py-3 text-body-m text-dim hover:bg-surface-2 hover:text-text"
                >
                  {n.label}
                </Link>
              ))}
              <p className="eyebrow px-3 pt-4 pb-2 text-faint">Disease states</p>
              <div className="flex flex-wrap gap-2 px-1 pb-1">
                {areas.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/catalog/${a.slug}`}
                    className="press rounded-[6px] bg-surface-2 px-4 py-2 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text"
                  >
                    {a.label}
                  </Link>
                ))}
              </div>
            </nav>
          </div>
 ) : null}
        </div>
 </header>

 {searchOpen ? <SearchDialog onClose={() => setSearchOpen(false)} /> : null}
 </>
 );
}

function DiseaseMenu({ open, setOpen, active }: { open: boolean; setOpen: (v: boolean) => void; active: boolean }) {
 const wrapRef = useRef<HTMLDivElement>(null);
 const panelId = useId();

 useEffect(() => {
 if (!open) return;
 const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
 const onKey = (e: KeyboardEvent) => {
 if (e.key === "Escape") { setOpen(false); wrapRef.current?.querySelector("button")?.focus(); }
 };
 document.addEventListener("mousedown", onDown);
 document.addEventListener("keydown", onKey);
 return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
 }, [open, setOpen]);

 return (
 <div ref={wrapRef} className="relative">
 <button
 type="button"
 onClick={() => setOpen(!open)}
 aria-expanded={open}
 aria-controls={panelId}
 className={`press flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-body-s ${active ? "text-text" : "text-dim hover:text-text"}`}
 >
 Disease states
 <ChevronDown
 className={`size-3.5 transition-[rotate] duration-150 ease-[var(--ease-standard)] ${open ? "rotate-180" : ""}`}
 strokeWidth={1.75}
 />
 </button>

 {open ? (
 <div className="absolute top-full start-0 pt-3">
 <div
 id={panelId}
 className="w-[30rem] origin-top-left card p-2 shadow-[var(--shadow-pop)] motion-safe:animate-[fadeSlideUp_150ms_var(--ease-out-soft)_both]"
 >
 <ul className="grid gap-1">
 {areas.map((a) => (
 <li key={a.slug}>
 <Link href={`/catalog/${a.slug}`} className="press block rounded-[6px] p-4 hover:bg-surface-2">
 <span className="display block text-body-m text-text">{a.label}</span>
 <span className="prose-lede mt-1 block text-body-s text-muted">{a.blurb}</span>
 </Link>
 </li>
 ))}
 </ul>
 </div>
 </div>
 ) : null}
 </div>
 );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
 const [q, setQ] = useState("");
 const dialogRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLInputElement>(null);
 const titleId = useId();

 useEffect(() => {
 const root = document.getElementById("app-root");
 const restoreTo = document.activeElement as HTMLElement | null;
 root?.setAttribute("inert", "");
 document.body.style.overflow = "hidden";
 inputRef.current?.focus();
 return () => {
 root?.removeAttribute("inert");
 document.body.style.overflow = "";
 restoreTo?.focus?.();
 };
 }, []);

 const onKeyDown = useCallback((e: React.KeyboardEvent) => {
 if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
 if (e.key !== "Tab") return;
 const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((n) => n.offsetParent !== null);
 if (!nodes.length) return;
 const first = nodes[0], last = nodes[nodes.length - 1];
 if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
 else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
 }, [onClose]);

 const results = search(q);
 const count = results.items.length + results.series.length + results.faculty.length + results.shows.length;

 return createPortal(
 <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
 <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" />
 <div
 ref={dialogRef}
 role="dialog"
 aria-modal="true"
 aria-labelledby={titleId}
 className="relative w-full max-w-[40rem] overflow-hidden card shadow-[var(--shadow-pop)] motion-safe:animate-[fadeSlideUp_200ms_var(--ease-out-soft)_both]"
 >
 <h2 id={titleId} className="sr-only">Search CHM</h2>
 <div className="flex items-center gap-3 px-5 py-4">
 <SearchIcon className="size-[18px] text-faint" strokeWidth={1.5} />
 <label htmlFor="chm-search" className="sr-only">Search trials, faculty and disease states</label>
 <input
 id="chm-search"
 ref={inputRef}
 type="search"
 value={q}
 onChange={(e) => setQ(e.target.value)}
 placeholder="T-DXd, Pegram, maintenance"
 autoComplete="off"
 className="w-full bg-transparent text-base text-text outline-none placeholder:text-faint sm:text-body-m"
 />
 <button type="button" onClick={onClose} aria-label="Close search" className="press grid size-8 place-items-center rounded-[6px] text-faint hover:text-text">
 <CloseIcon className="size-4" strokeWidth={1.5} />
 </button>
 </div>

 <div className="max-h-[52vh] overflow-y-auto overscroll-contain p-2">
 <p role="status" className="sr-only">{q ? `${count} ${count === 1 ? "result" : "results"} for ${q}` : ""}</p>

 {!q ? (
 <div className="px-3 py-4">
 <p className="eyebrow text-faint">Try</p>
 <div className="mt-3 flex flex-wrap gap-2">
 {["T-DXd", "ILD", "maintenance", "NSCLC", "Pegram", "CAR-T"].map((s) => (
 <button key={s} type="button" onClick={() => setQ(s)} className="press rounded-[6px] px-4 py-2 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text">
 {s}
 </button>
 ))}
 </div>
 </div>
 ) : count === 0 ? (
 <div className="px-3 py-10 text-center">
 <p className="text-body-m text-text">No results for “{q}”</p>
 <p className="prose-lede mx-auto mt-1.5 max-w-[24rem] text-body-s text-muted">
 Search covers session titles, faculty, series and tumor tracks.
 </p>
 <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} className="press mt-4 rounded-[6px] px-5 py-2 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text">
 Clear search
 </button>
 </div>
 ) : (
 <>
 {results.faculty.length > 0 && <Group label="Faculty">{results.faculty.map((f) => <Row key={f.slug} href={`/faculty/${f.slug}`} title={f.name} meta={f.org} />)}</Group>}
 {results.series.length > 0 && <Group label="Series">{results.series.map((s) => <Row key={s.slug} href={`/series/${s.slug}`} title={s.title} meta={`${s.episodes} episodes`} />)}</Group>}
 {results.shows.length > 0 && <Group label="Podcasts">{results.shows.map((s) => <Row key={s.slug} href={`/podcasts/${s.slug}`} title={s.title} meta={s.tagline} />)}</Group>}
 {results.items.length > 0 && <Group label="Sessions">{results.items.slice(0, 8).map((i) => <Row key={i.slug} href={formatHref(i)} title={i.title} meta={`${formatLabel[i.format]} · ${i.duration}`} />)}</Group>}
 </>
 )}
 </div>
 </div>
 </div>,
 document.body
 );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
 return (
 <section className="mb-1">
 <h3 className="eyebrow px-3 py-2 text-faint">{label}</h3>
 <ul>{children}</ul>
 </section>
 );
}

function Row({ href, title, meta }: { href: string; title: string; meta: string }) {
 return (
 <li>
 <Link href={href} className="press flex items-center justify-between gap-4 rounded-[6px] px-3 py-2.5 hover:bg-surface-2">
 <span className="text-body-s text-text">{title}</span>
 <span className="meta shrink-0 text-faint">{meta}</span>
 </Link>
 </li>
 );
}
