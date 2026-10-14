import type { ReactNode } from 'react';

export function LegalPageShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <div className="text-sm text-muted-foreground max-w-3xl leading-relaxed space-y-2">
            {intro}
          </div>
        </header>

        <div className="mt-8 rounded-card border border-border bg-card p-6 sm:p-8 space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {body ? <p className="text-sm text-muted-foreground leading-relaxed">{body}</p> : null}
      {children ? (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
      ) : null}
    </div>
  );
}

export function LegalSubheading({ children }: { children: ReactNode }) {
  return <h3 className="pt-1 text-sm font-medium text-foreground">{children}</h3>;
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalLink({ href, children }: { href: string; children?: ReactNode }) {
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children ?? href.replace(/^mailto:/, '')}
    </a>
  );
}
