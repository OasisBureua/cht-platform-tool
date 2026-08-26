"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
 byNewest,
 diseaseStates,
 facultyBySlug,
 formatHref,
 prettyDate,
 type Format,
 type Item,
} from "@/lib/data";
import { EmptyState, FormatBadge, Thumb } from "./ui";

const formats: { key: Format | "all"; label: string }[] = [
 { key: "all", label: "All formats" },
 { key: "video", label: "Video" },
 { key: "podcast", label: "Podcast" },
 { key: "editorial", label: "Editorial" },
];

export function Feed({
 items,
 showFormatFilter = true,
 showDiseaseFilter = true,
}: {
 items: Item[];
 showFormatFilter?: boolean;
 showDiseaseFilter?: boolean;
}) {
 const [format, setFormat] = useState<Format | "all">("all");
 const [disease, setDisease] = useState<string>("all");

 const filtered = useMemo(
 () =>
 byNewest(
 items.filter(
 (i) =>
 (format === "all" || i.format === format) &&
 (disease === "all" || i.disease === disease)
 )
 ),
 [items, format, disease]
 );

 const filtered_ = filtered.length;
 const hasFilter = format !== "all" || disease !== "all";
 const clearAll = () => {
 setFormat("all");
 setDisease("all");
 };

 return (
 <div className="shell pb-16">
 {(showFormatFilter || showDiseaseFilter) && (
 <div className="flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-hairline pb-6">
 {showFormatFilter && (
 <fieldset className="flex flex-wrap items-center gap-3">
 <legend className="sr-only">Filter by format</legend>
 {formats.map((f) => (
 <Filter
 key={f.key}
 pressed={format === f.key}
 onClick={() => setFormat(f.key)}
 >
 {f.label}
 </Filter>
 ))}
 </fieldset>
 )}

 {showFormatFilter && showDiseaseFilter && (
 <span aria-hidden className="mx-1 h-6 w-px bg-hairline" />
 )}

 {showDiseaseFilter && (
 <fieldset className="flex flex-wrap items-center gap-3">
 <legend className="sr-only">Filter by tumor track</legend>
 <Filter pressed={disease === "all"} onClick={() => setDisease("all")}>
 Every track
 </Filter>
 {diseaseStates.map((d) => (
 <Filter
 key={d.slug}
 pressed={disease === d.slug}
 onClick={() => setDisease(d.slug)}
 >
 {d.label}
 </Filter>
 ))}
 </fieldset>
 )}

 {/* Stable region: the count announces on every filter change. */}
 <p role="status" className="meta ms-auto text-faint">
 {filtered_} {filtered_ === 1 ? "session" : "sessions"}
 </p>
 </div>
 )}

 {filtered_ === 0 ? (
 <div className="pt-10">
 <EmptyState
 title="Nothing published here yet"
 body="Every tumor track carries video, podcast and editorial, but not every combination is filled at launch. Widen the filter to see what is."
 action={{ label: "Show everything", href: "/latest" }}
 />
 {hasFilter ? (
 <div className="mt-4 flex justify-center">
 <button
 type="button"
 onClick={clearAll}
 className="press rounded-[6px] px-5 py-2.5 text-body-s font-medium text-text shadow-[var(--shadow-card)]"
 >
 Clear filters
 </button>
 </div>
 ) : null}
 </div>
 ) : (
 <ul>
 {filtered.map((item, i) => (
 <li key={item.slug} className={i > 0 ? "border-t border-hairline" : ""}>
 <Link
 href={formatHref(item)}
 className="press press lift group grid items-center gap-5 rounded-[6px] py-6 md:grid-cols-[13.75rem_1fr_auto]"
 >
 <div className="relative">
 <Thumb src={item.thumb} className="aspect-[16/9] w-full" />
 <span className="absolute top-3 start-3">
 <FormatBadge format={item.format} />
 </span>
 </div>

 <div>
 <h3 className="display display-tight text-display-s text-text group-hover:text-anchor">
 {item.title}
 </h3>
 <p className="prose-lede mt-2 max-w-[38rem] text-[0.875rem] leading-normal text-muted">
 {item.dek}
 </p>
 <p className="meta mt-3 text-faint">
 {item.faculty.map((s) => facultyBySlug(s)?.name).join(" · ")}
 </p>
 </div>

 <div className="text-start md:text-end">
 <p className="meta text-anchor">{item.duration}</p>
 <p className="meta mt-1 text-faint">{prettyDate(item.published)}</p>
 </div>
 </Link>
 </li>
 ))}
 </ul>
 )}
 </div>
 );
}

function Filter({
 pressed,
 onClick,
 children,
}: {
 pressed: boolean;
 onClick: () => void;
 children: React.ReactNode;
}) {
 return (
 <button
 type="button"
 onClick={onClick}
 aria-pressed={pressed}
 className={`press inline-flex h-10 items-center rounded-[6px] px-4 text-body-s font-medium ${
 pressed ? "bg-inverse text-white" : "bg-white text-text shadow-[var(--shadow-card)]"
 }`}
 >
 {children}
 </button>
 );
}
