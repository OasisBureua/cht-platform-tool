"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { kolInstitutions, kolStates, kols, type Kol } from "@/lib/platform";
import { ArrowRight, SearchIcon } from "./icons";
import { EmptyState } from "./ui";

type Sort = "name" | "state" | "newest";

/**
 * Faceted directory: free-text plus state and institution, with the
 * result count in a live region so filtering announces. Grouping by
 * state is preserved from the platform's own view.
 */
export function KolDirectory() {
 const [q, setQ] = useState("");
 const [state, setState] = useState("all");
 const [institution, setInstitution] = useState("all");
 const [sort, setSort] = useState<Sort>("state");
 const [newOnly, setNewOnly] = useState(false);
 const id = useId();

 const shown = useMemo(() => {
 const needle = q.trim().toLowerCase();
 const hit = (s: string) => s.toLowerCase().includes(needle);
 const list = kols.filter(
 (k) =>
 (!needle || hit(k.name) || hit(k.institution) || hit(k.summary) || hit(k.title)) &&
 (state === "all" || k.state === state) &&
 (institution === "all" || k.institution === institution) &&
 (!newOnly || k.isNew)
 );
 const by: Record<Sort, (a: Kol, b: Kol) => number> = {
 name: (a, b) => a.name.localeCompare(b.name),
 state: (a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name),
 newest: (a, b) => Number(!!b.isNew) - Number(!!a.isNew) || a.name.localeCompare(b.name),
 };
 return [...list].sort(by[sort]);
 }, [q, state, institution, sort, newOnly]);

 const grouped = useMemo(() => {
 if (sort !== "state") return null;
 const map = new Map<string, Kol[]>();
 for (const k of shown) {
 const arr = map.get(k.state) ?? [];
 arr.push(k);
 map.set(k.state, arr);
 }
 return [...map.entries()];
 }, [shown, sort]);

 const reset = () => {
 setQ("");
 setState("all");
 setInstitution("all");
 setNewOnly(false);
 };
 const filtered = q || state !== "all" || institution !== "all" || newOnly;

 const field =
 "h-11 w-full rounded-[6px] card px-4 text-base text-text outline-none focus: sm:text-body-s";

 return (
 <>
 <div className="rail grid gap-4 pb-10 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
 <div>
 <label htmlFor={`${id}-q`} className="eyebrow mb-2 block text-faint">
 Search
 </label>
 <div className="relative">
 <SearchIcon
 className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-faint"
 strokeWidth={1.5}
 />
 <input
 id={`${id}-q`}
 type="search"
 value={q}
 onChange={(e) => setQ(e.target.value)}
 placeholder="Name, institution or specialty"
 className={`${field} ps-11`}
 />
 </div>
 </div>

 <div>
 <label htmlFor={`${id}-state`} className="eyebrow mb-2 block text-faint">
 State
 </label>
 <select id={`${id}-state`} value={state} onChange={(e) => setState(e.target.value)} className={field}>
 <option value="all">All states</option>
 {kolStates().map((s) => (
 <option key={s}>{s}</option>
 ))}
 </select>
 </div>

 <div>
 <label htmlFor={`${id}-inst`} className="eyebrow mb-2 block text-faint">
 Institution
 </label>
 <select
 id={`${id}-inst`}
 value={institution}
 onChange={(e) => setInstitution(e.target.value)}
 className={field}
 >
 <option value="all">All institutions</option>
 {kolInstitutions().map((s) => (
 <option key={s}>{s}</option>
 ))}
 </select>
 </div>

 <div>
 <label htmlFor={`${id}-sort`} className="eyebrow mb-2 block text-faint">
 Sort
 </label>
 <select
 id={`${id}-sort`}
 value={sort}
 onChange={(e) => setSort(e.target.value as Sort)}
 className={field}
 >
 <option value="state">By state</option>
 <option value="name">By name</option>
 <option value="newest">Newest first</option>
 </select>
 </div>
 </div>

 <div className="rail flex flex-wrap items-center gap-4 pb-5">
 <button
 type="button"
 onClick={() => setNewOnly((v) => !v)}
 aria-pressed={newOnly}
 className={`press rounded-[6px] px-4 py-2 text-body-s ${
 newOnly ? "bg-anchor text-ground" : "text-dim shadow-[var(--shadow-card)] hover:text-text"
 }`}
 >
 New profiles only
 </button>
 {filtered ? (
 <button
 type="button"
 onClick={reset}
 className="press rounded-[6px] px-4 py-2 text-body-s text-muted hover:text-text"
 >
 Clear filters
 </button>
 ) : null}
 <p role="status" className="meta ms-auto text-faint">
 {shown.length} shown
 </p>
 </div>

 <div className="rail py-14">
 {shown.length === 0 ? (
 <EmptyState
 title="No profiles match those filters"
 body="The network covers oncology and breast cancer specialists across seventeen states. Widen the filter to see more of it."
 action={{ label: "Clear filters", href: "/kol-network" }}
 />
 ) : grouped ? (
 <div className="space-y-16">
 {grouped.map(([st, list]) => (
 <section key={st} aria-labelledby={`${id}-${st}`}>
 <div className="flex items-baseline gap-4 pb-4">
 <h2 id={`${id}-${st}`} className="display text-display-s text-text">
 {st}
 </h2>
 <span className="meta text-faint">
 {list.length} {list.length === 1 ? "KOL" : "KOLs"}
 </span>
 </div>
 <KolGrid list={list} />
 </section>
 ))}
 </div>
 ) : (
 <KolGrid list={shown} />
 )}
 </div>
 </>
 );
}

function KolGrid({ list }: { list: Kol[] }) {
 return (
 <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
 {list.map((k) => (
 <li key={k.slug}>
 {/* The card is a container, not a link: it carries two
 distinct actions, so nesting them inside one link
 would make both unreachable. */}
 <div className="lift flex h-full flex-col card p-6">
 <div className="flex items-start gap-4">
 {k.photo ? (
 /* eslint-disable-next-line @next/next/no-img-element */
 <img src={k.photo} alt="" className="img-ring size-12 shrink-0 rounded-full object-cover" />
 ) : (
 <span
 aria-hidden
 className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-2 text-body-s font-medium text-muted"
 >
 {k.name.replace("Dr. ", "").split(" ").map((w) => w[0]).join("")}
 </span>
 )}
 <div className="min-w-0">
 <h3 className="display text-body-m text-text">
 <Link
 href={`/kol-network/${k.slug}`}
 className="press rounded outline-offset-4 hover:text-accent"
 >
 {k.name}
 </Link>
 </h3>
 <p className="mt-0.5 text-body-s text-muted">{k.title}</p>
 </div>
 {k.isNew ? (
 <span className="eyebrow ms-auto shrink-0 rounded-[6px] bg-amber/20 px-2.5 py-1 text-amber-ink">
 New
 </span>
 ) : null}
 </div>

 {/* State and institution share a row; the summary runs
 full width beneath them. */}
 <dl className="mt-5">
 <div className="grid grid-cols-2 gap-4">
 <div className="min-w-0">
 <dt className="eyebrow text-faint">State</dt>
 <dd className="mt-1 text-body-s text-dim">{k.state}</dd>
 </div>
 <div className="min-w-0">
 <dt className="eyebrow text-faint">Institution</dt>
 <dd className="mt-1 text-body-s text-dim">{k.institution}</dd>
 </div>
 </div>
 <div className="mt-4">
 <dt className="eyebrow text-faint">Summary</dt>
 <dd className="prose-lede mt-1 text-body-s text-muted">{k.summary}</dd>
 </div>
 </dl>

 {/* Both actions name their destination, so each still
 makes sense read out of context. */}
 <div className="mt-auto flex flex-wrap gap-2 mt-2 pt-5">
 <Link
 href={`/kol-network/${k.slug}`}
 className="press inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-signature px-4 text-body-s text-ground hover:brightness-[0.94]"
 >
 Explore profile
 <ArrowRight className="size-3.5" strokeWidth={1.75} />
 </Link>
 <Link
 href={`/catalog?kol=${k.slug}`}
 className="press inline-flex h-9 items-center gap-1.5 rounded-[6px] px-4 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text hover:shadow-[var(--shadow-card-hover)]"
 >
 View content
 <ArrowRight className="size-3.5" strokeWidth={1.75} />
 </Link>
 </div>
 </div>
 </li>
 ))}
 </ul>
 );
}
