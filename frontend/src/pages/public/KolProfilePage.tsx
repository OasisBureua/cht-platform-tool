import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { KolCatalogContentSection } from '../../components/kol/KolCatalogContentSection';
import { KolPublicationsSection } from '../../components/kol/KolPublicationsSection';
import { useKolProfile } from '../../hooks/useKolProfile';
import type { DolEntry, DolRegion } from '../../hooks/useKolDirectory';
import { resolveKolDisplayBrief } from '../../utils/kol-directory-merge';
import { kolCatalogBrowseHref } from '../../utils/kol-catalog-link';

// X/Twitter brand icon was removed from lucide-react in v1.x, local outline SVG.
function IconTwitter({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

// LinkedIn brand icon was removed from lucide-react in v1.x, local outline SVG.
function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

type TabId = 'overview' | 'background' | 'engagement';

function avatarUrl(name: string): string {
  const q = name.replace(/^Dr\.\s*/i, '').trim() || name;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(q)}&size=256&background=c2410c&color=fff&bold=true`;
}

function inferredSpecialty(entry: DolEntry): string {
  if (entry.intel?.specialty) return entry.intel.specialty;
  const r = entry.role;
  if (/oncology|oncologist/i.test(r)) return 'Medical Oncology · Breast Cancer';
  if (/hematology/i.test(r)) return 'Hematology / Oncology';
  return 'Oncology & breast cancer';
}

function buildViewModel(region: DolRegion, entry: DolEntry) {
  const i = entry.intel;
  const stateName = region.title;
  const institution =
    entry.institution?.trim() && entry.institution !== '-'
      ? entry.institution
      : i?.affiliation?.split('·')[0]?.trim() ?? '-';

  return {
    displayName: entry.name,
    specialty: inferredSpecialty(entry),
    stateName,
    institution,
    location: i?.location ?? stateName,
    affiliation: institution !== '-' ? institution : (i?.affiliation ?? entry.role.split('—')[0]?.trim() ?? ''),
    rosterOnly: i?.rosterOnly ?? false,
    phone: i?.phone,
    linkedInUrl: i?.linkedInUrl,
    twitterUrl: i?.twitterUrl,
    webUrl: i?.webUrl,
    bannerImageUrl: i?.bannerImageUrl,
    awards: i?.awards,
    researchHighlights: i?.researchHighlights,
  };
}

export default function KolProfilePage() {
  const { kolId } = useParams<{ kolId: string }>();
  const [tab, setTab] = useState<TabId>('overview');

  const profile = useKolProfile(kolId);

  const vm = useMemo(() => {
    if (profile.loadState !== 'ready') return null;
    return buildViewModel(profile.region, profile.entry);
  }, [profile]);

  if (profile.loadState === 'loading') {
    return (
      <div className="min-h-screen w-full bg-zinc-50 px-6 py-20 text-center text-zinc-500 dark:bg-black dark:text-zinc-400">
        Loading profile…
      </div>
    );
  }
  if (!kolId || profile.loadState !== 'ready' || !vm) {
    return <Navigate to="/kol-network" replace />;
  }

  const { entry } = profile;
  const displayBrief = resolveKolDisplayBrief(entry);
  const catalogHref = kolCatalogBrowseHref(entry);
  const showBioOnBackground =
    Boolean(entry.bio?.trim()) &&
    (!displayBrief || entry.bio!.trim() !== displayBrief.whoTheyAre);

  return (
    <div className="min-h-screen w-full bg-zinc-50 pb-20 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <div className="sticky top-0 z-30 w-full border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex w-full max-w-none items-center gap-1 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            to="/kol-network"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Back to KOL directory"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight">{vm.displayName}</p>
            <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">
              {(entry.role.split(/[.;]/)[0]?.trim() ?? '').slice(0, 56)}
              {(entry.role.split(/[.;]/)[0]?.trim() ?? '').length > 56 ? '…' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-none">
        {/* Banner: full viewport width */}
        <div className="relative h-36 w-full bg-gradient-to-br from-slate-800 via-brand-900 to-zinc-950 sm:h-48">
          {vm.bannerImageUrl ? (
            <img src={vm.bannerImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>

        <div className="relative px-4 pb-4 sm:px-6 lg:px-8">
          {/* Avatar overlap */}
          <div className="relative -mt-16 flex justify-between sm:-mt-[4.25rem]">
            <img
              src={entry.photoUrl || avatarUrl(entry.name)}
              alt=""
              className="h-24 w-24 rounded-full border-4 border-zinc-50 bg-zinc-200 object-cover shadow-lg ring ring-zinc-200/80 dark:border-black dark:bg-zinc-800 dark:ring-zinc-800 sm:h-[7.25rem] sm:w-[7.25rem]"
            />
            <div className="flex flex-col items-end gap-2 pt-20 sm:pt-24">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-brand-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-brand-200">
                CHM Network
              </span>
              <Link
                to={catalogHref}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Catalog videos
                <ArrowRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{vm.displayName}</h1>
                {entry.featured ? (
                  <span
                    className="rounded bg-brand-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
                    title="Curator-featured KOL"
                  >
                    ★ Featured
                  </span>
                ) : null}
              </div>
              {vm.rosterOnly ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-teal-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-teal-900 dark:bg-teal-950/60 dark:text-teal-200">
                    Roster
                  </span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-[14px]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Specialty</p>
                <p className="mt-1 text-zinc-800 dark:text-zinc-200">{vm.specialty}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">State</p>
                <p className="mt-1 text-zinc-800 dark:text-zinc-200">{vm.stateName}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Institution</p>
                <p className="mt-1 text-zinc-800 dark:text-zinc-200">{vm.institution}</p>
              </div>
              {entry.education?.trim() ? (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Education & training</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">{entry.education}</p>
                </div>
              ) : null}
            </div>

            {(vm.phone || vm.linkedInUrl || vm.twitterUrl || vm.webUrl) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {vm.phone ? (
                  <a
                    href={`tel:${vm.phone.replace(/\D/g, '')}`}
                    className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
                  >
                    {vm.phone}
                  </a>
                ) : null}
                <SocialIcon href={vm.linkedInUrl} label="LinkedIn">
                  <IconLinkedIn className="h-4 w-4" />
                </SocialIcon>
                <SocialIcon href={vm.twitterUrl} label="Twitter / X">
                  <IconTwitter className="h-4 w-4" />
                </SocialIcon>
                <SocialIcon href={vm.webUrl} label="Website">
                  <ExternalLink className="h-4 w-4" />
                </SocialIcon>
              </div>
            )}
          </div>

          {/* Tabs */}
          <nav className="mt-5 flex border-b border-zinc-200 dark:border-zinc-800" aria-label="Profile sections">
            {(
              [
                ['overview', 'Overview'],
                ['background', 'Background'],
                ['engagement', 'Engagement'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={[
                  'min-h-[44px] flex-1 border-b-[3px] py-3 text-sm font-semibold transition-colors',
                  tab === id
                    ? 'border-brand-600 text-zinc-900 dark:border-brand-400 dark:text-white'
                    : 'border-transparent text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900/80',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-4 space-y-4" role="tabpanel">
            {tab === 'overview' ? (
              <>
                {displayBrief ? (
                  <article className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                      <Sparkles
                        className={`h-4 w-4 ${displayBrief.isAiGenerated ? 'text-amber-500' : 'text-zinc-400'}`}
                        aria-hidden
                      />
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Intel summary</span>
                      <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        {displayBrief.isAiGenerated ? 'AI-generated' : 'Profile summary'}
                      </span>
                    </div>
                    <div className="space-y-4 px-4 py-4 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Who they are</p>
                        <p className="mt-1">{displayBrief.whoTheyAre}</p>
                      </div>
                      {displayBrief.focus ? (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                            What they focus on
                          </p>
                          <p className="mt-1">{displayBrief.focus}</p>
                        </div>
                      ) : null}
                      {displayBrief.chmContext ? (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">CHM context</p>
                          <p className="mt-1">{displayBrief.chmContext}</p>
                        </div>
                      ) : null}
                    </div>
                    {displayBrief.isAiGenerated ? (
                      <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                        <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">
                          AI-generated summaries are provided for convenience and may contain inaccuracies. Verify
                          important details against primary sources.
                        </p>
                      </div>
                    ) : null}
                  </article>
                ) : null}

                <KolPublicationsSection kolId={entry.id} />

                <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    <Briefcase className="h-4 w-4" aria-hidden />
                    Role
                  </h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{entry.role}</p>
                </article>

                <KolCatalogContentSection entry={entry} variant="overview" limit={8} />
              </>
            ) : null}

            {tab === 'background' ? (
              <div className="space-y-4">
                {showBioOnBackground ? (
                  <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Summary</h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{entry.bio}</p>
                  </article>
                ) : null}
                {vm.researchHighlights ? (
                  <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Research highlights</h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{vm.researchHighlights}</p>
                  </article>
                ) : null}
                {vm.awards && vm.awards.length > 0 ? (
                  <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Recognition</h2>
                    <ul className="mt-3 list-inside list-disc space-y-1 text-[15px] text-zinc-700 dark:text-zinc-300">
                      {vm.awards.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </article>
                ) : null}
              </div>
            ) : null}

            {tab === 'engagement' ? (
              <KolCatalogContentSection entry={entry} variant="engagement" limit={12} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialIcon({ href, label, children }: { href?: string; label: string; children: ReactNode }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-[color,transform] hover:text-brand-700 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      {children}
    </a>
  );
}
