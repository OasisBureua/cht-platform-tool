import type { ReactNode } from "react";
import { Eyebrow } from "./ui";

/**
 * Inner-page masthead. When a `figure` is supplied the hero splits
 * into copy on the leading side and a raised product panel on the
 * trailing side, matching the homepage's weight.
 */
export function PageHead({
  eyebrow,
  title,
  lede,
  children,
  figure,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: string;
  children?: ReactNode;
  figure?: ReactNode;
}) {
  const copy = (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="display mt-6 max-w-[18ch] text-[2.5rem] leading-[1.04] tracking-[-0.03em] text-text md:text-display-l">
        {title}
      </h1>
      {lede ? (
        <p className="prose-lede mt-6 max-w-[50ch] text-body-l text-muted">{lede}</p>
      ) : null}
      {children ? <div className="mt-9">{children}</div> : null}
    </>
  );

  if (!figure) {
    return <section className="rail pt-16 pb-14 md:pt-20 md:pb-16">{copy}</section>;
  }

  return (
    <section className="rail pt-14 pb-12 md:pt-16 md:pb-16">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.02fr] lg:gap-16">
        <div>{copy}</div>
        <div>{figure}</div>
      </div>
    </section>
  );
}
