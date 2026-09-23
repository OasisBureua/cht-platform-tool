import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { kolNetworkApi } from '../../api/kol-network';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';

type Props = {
  /** Catalog doctor slug (e.g. from clip.doctors). */
  slug: string;
  /** Member app vs public marketing KOL surface. */
  isInApp: boolean;
  /** Optional close control (library doctor filter). */
  onClear?: () => void;
  className?: string;
};

/**
 * Right-rail KOL bio from Content Hub. Used on clip detail and library
 * doctor filters for both `/catalog` and `/app/catalog`.
 */
export function DoctorBioRail({ slug, isInApp, onClear, className = '' }: Props) {
  const surface = isInApp ? 'app' : 'public';
  const kolHref = isInApp
    ? `/app/kols/${encodeURIComponent(slug)}`
    : `/kols/${encodeURIComponent(slug)}`;

  const { data: kol, isLoading, isError } = useQuery({
    queryKey: ['kol-network', 'doctor-bio', slug, surface],
    queryFn: () => kolNetworkApi.get(slug, surface),
    staleTime: 10 * 60 * 1000,
    enabled: !!slug,
  });

  const name = kol?.name?.trim() || doctorLabelFromSlug(slug);
  const bio =
    kol?.bio?.trim() ||
    kol?.intel?.ai_brief?.who_they_are?.trim() ||
    null;
  const focus =
    kol?.title?.trim() ||
    kol?.specialty?.trim() ||
    kol?.intel?.ai_brief?.what_they_focus_on?.trim() ||
    null;
  const institution = kol?.institution?.trim() || null;
  const photo = kol?.photo_url?.trim() || null;

  return (
    <aside
      className={`rounded-card border border-border bg-card p-5 ${className}`.trim()}
      aria-label={`${name} profile`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          In conversation
        </p>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex items-start gap-3">
        {photo ? (
          <img
            src={photo}
            alt=""
            className="size-14 shrink-0 rounded-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-14 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
          >
            {name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? '')
              .join('')}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{name}</p>
          {focus ? (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{focus}</p>
          ) : null}
          {institution ? (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {institution}
            </p>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading profile…
        </div>
      ) : null}

      {!isLoading && bio ? (
        <p className="mt-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-line line-clamp-8">
          {bio}
        </p>
      ) : null}

      {!isLoading && !bio && !isError ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No biography on file yet in Content Hub.
        </p>
      ) : null}

      {isError ? (
        <p className="mt-4 text-sm text-destructive">
          Could not load this profile from Content Hub.
        </p>
      ) : null}

      <Link
        to={kolHref}
        className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        View more on KOL Network →
      </Link>
    </aside>
  );
}
