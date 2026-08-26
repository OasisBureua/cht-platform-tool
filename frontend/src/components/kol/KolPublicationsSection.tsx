import { useQuery } from '@tanstack/react-query';
import { BookOpen, ExternalLink, Loader2 } from 'lucide-react';
import { kolNetworkApi } from '../../api/kol-network';

type Props = {
  kolId: string;
  limit?: number;
};

function formatPubDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

export function KolPublicationsSection({ kolId, limit = 10 }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kol-network', 'publications', kolId, limit],
    queryFn: () => kolNetworkApi.publications(kolId, { limit }),
    enabled: Boolean(kolId?.trim()),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <article className="rounded-card border border-zinc-200 bg-card p-4 shadow-sm ">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading publications…
        </div>
      </article>
    );
  }

  if (isError || !data?.items?.length) {
    return null;
  }

  return (
    <article className="rounded-card border border-zinc-200 bg-card p-4 shadow-sm ">
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <BookOpen className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
        Publications
        {data.total > data.items.length ? (
          <span className="text-xs font-normal text-muted-foreground">({data.total} indexed)</span>
        ) : null}
      </h2>
      <ul className="mt-3 space-y-3">
        {data.items.map((pub, idx) => {
          const authorship = [
            pub.is_first_author ? 'First author' : null,
            pub.is_last_author ? 'Senior author' : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const meta = [pub.journal, formatPubDate(pub.published_at), authorship].filter(Boolean).join(' · ');
          return (
            <li key={`${pub.title}-${idx}`} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0 ">
              {pub.url ? (
                <a
                  href={pub.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-start gap-1.5 text-[15px] font-semibold leading-snug text-foreground hover:text-brand-700 dark:hover:text-brand-400"
                >
                  <span className="min-w-0">{pub.title}</span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />
                </a>
              ) : (
                <p className="text-[15px] font-semibold leading-snug text-foreground">{pub.title}</p>
              )}
              {meta ? <p className="mt-1 text-xs text-muted-foreground">{meta}</p> : null}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
