import type { ReactNode } from 'react';

export function LegalPageShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">{intro}</p>
        </header>

        <div className="mt-8 rounded-card border border-border bg-card p-6 sm:p-8 space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
