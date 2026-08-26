import type { ReactNode } from "react";
import { Eyebrow } from "./ui";

export function PageHeader({
 eyebrow,
 title,
 sub,
 children,
 tone = "light",
}: {
 eyebrow: string;
 title: string;
 sub?: string;
 children?: ReactNode;
 tone?: "light" | "deep";
}) {
 const deep = tone === "deep";
 return (
 <section className={deep ? "on-deep bg-cta-deep" : ""}>
 <div className="shell pt-12 pb-9">
 <Eyebrow tone={deep ? "amber" : "cyan"}>{eyebrow}</Eyebrow>
 <h1
 className={`display mt-4 max-w-[51.25rem] text-[2.375rem] md:text-[2.875rem] ${
 deep ? "text-white" : "text-text"
 }`}
 >
 {title}
 </h1>
 {sub ? (
 <p
 className={`prose-lede mt-4 max-w-[38.75rem] text-base leading-relaxed ${
 deep ? "text-white/75" : "text-muted"
 }`}
 >
 {sub}
 </p>
 ) : null}
 {children ? <div className="mt-7">{children}</div> : null}
 </div>
 </section>
 );
}
