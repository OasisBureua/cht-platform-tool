import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  ExternalLink,
  Linkedin,
  MapPin,
  Sparkles,
  Stethoscope,
  Twitter,
} from 'lucide-react';
import { findKolWithRegion, type DolEntry, type DolRegion } from '../../data/dol-network';

type TabId = 'overview' | 'background' | 'engagement';

function avatarUrl(name: string): string {
  const q = name.replace(/^Dr\.\s*/i, '').trim() || name;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(q)}&size=256&background=0d4f6c&color=fff&bold=true`;
}

function displayHandle(entry: DolEntry): string {
  if (entry.intel?.handle) return entry.intel.handle;
  return `@${entry.id}`;
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
  return {
    displayName: entry.name,
    handle: displayHandle(entry),
    specialty: inferredSpecialty(entry),
    location: i?.location ?? 'United States',
    affiliation: i?.affiliation ?? entry.role.split('—')[0]?.trim() ?? region.title,
    npi: i?.npi,
    rosterOnly: i?.rosterOnly ?? false,
    phone: i?.phone,
    email: i?.email,
    linkedInUrl: i?.linkedInUrl,
    twitterUrl: i?.twitterUrl,
    webUrl: i?.webUrl,
    bannerImageUrl: i?.bannerImageUrl,
    awards: i?.awards,
    researchHighlights: i?.researchHighlights,
    aiBrief: i?.aiBrief,
  };
}

export default function KolProfilePage() {
  const { kolId } = useParams<{ kolId: string }>();
  const [tab, setTab] = useState<TabId>('overview');

  const found = kolId ? findKolWithRegion(kolId) : null;

  const vm = useMemo(() => {
    if (!found) return null;
    return buildViewModel(found.region, found.entry);
  }, [found]);

  if (!kolId || !found || !vm) {
    return <Navigate to="/kol-network" replace />;
  }

  const { region, entry } = found;

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
        {/* Banner — full viewport width */}
        <div className="relative h-36 w-full bg-gradient-to-br from-slate-800 via-[#0d4f6c] to-slate-900 sm:h-48">
          {vm.bannerImageUrl ? (
            <img src={vm.bannerImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>

        <div className="relative px-4 pb-4 sm:px-6 lg:px-8">
          {/* Avatar overlap */}
          <div className="relative -mt-16 flex justify-between sm:-mt-[4.25rem]">
            <img
              src={avatarUrl(entry.name)}
              alt=""
              className="h-24 w-24 rounded-full border-4 border-zinc-50 bg-zinc-200 object-cover shadow-lg ring ring-zinc-200/80 dark:border-black dark:bg-zinc-800 dark:ring-zinc-800 sm:h-[7.25rem] sm:w-[7.25rem]"
            />
            <div className="pt-20 sm:pt-24">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-[#0d4f6c] shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-brand-300">
                CHM Network
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{vm.displayName}</h1>
              <p className="mt-0.5 text-[15px] text-zinc-500 dark:text-zinc-400">{vm.handle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {vm.rosterOnly ? (
                  <span className="rounded bg-teal-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-teal-900 dark:bg-teal-950/60 dark:text-teal-200">
                    Roster
                  </span>
                ) : null}
                {vm.npi ? (
                  <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">NPI {vm.npi}</span>
                ) : null}
              </div>
            </div>

            <p className="text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">{entry.bio}</p>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[14px] text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                {vm.specialty}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                {vm.location}
              </span>
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <Building2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                <span className="truncate">{vm.affiliation}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-zinc-500">
                <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                {region.title}
              </span>
            </div>

            {(vm.phone || vm.email || vm.linkedInUrl || vm.twitterUrl || vm.webUrl) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {vm.phone ? (
                  <a
                    href={`tel:${vm.phone.replace(/\D/g, '')}`}
                    className="text-sm font-medium text-[#0d4f6c] hover:underline dark:text-brand-400"
                  >
                    {vm.phone}
                  </a>
                ) : null}
                {vm.email ? (
                  <a href={`mailto:${vm.email}`} className="text-sm font-medium text-[#0d4f6c] hover:underline dark:text-brand-400">
                    {vm.email}
                  </a>
                ) : null}
                <SocialIcon href={vm.linkedInUrl} label="LinkedIn">
                  <Linkedin className="h-4 w-4" />
                </SocialIcon>
                <SocialIcon href={vm.twitterUrl} label="Twitter / X">
                  <Twitter className="h-4 w-4" />
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
                    ? 'border-[#0d4f6c] text-zinc-900 dark:border-brand-400 dark:text-white'
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
                {vm.aiBrief?.whoTheyAre ? (
                  <article className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                      <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Intel summary</span>
                      <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-zinc-400">MediaHub</span>
                    </div>
                    <div className="space-y-4 px-4 py-4 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {vm.aiBrief.whoTheyAre ? (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Who they are</p>
                          <p className="mt-1">{vm.aiBrief.whoTheyAre}</p>
                        </div>
                      ) : null}
                      {vm.aiBrief.focus ? (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Focus</p>
                          <p className="mt-1">{vm.aiBrief.focus}</p>
                        </div>
                      ) : null}
                      {vm.aiBrief.chmContext ? (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">CHM context</p>
                          <p className="mt-1">{vm.aiBrief.chmContext}</p>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ) : (
                  <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
                    Connect MediaHub to surface AI briefs and Sunshine aggregates for this profile.
                  </p>
                )}

                <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    <Briefcase className="h-4 w-4" aria-hidden />
                    Role
                  </h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{entry.role}</p>
                </article>
              </>
            ) : null}

            {tab === 'background' ? (
              <div className="space-y-4">
                <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Education & training</h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{entry.education}</p>
                </article>
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
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <Calendar className="h-7 w-7 text-zinc-400" aria-hidden />
                </div>
                <h2 className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">No CHM engagement recorded yet</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Webinars, RSVPs, questions, and catalog activity will appear here when this physician engages with Community
                  Health Media content.
                </p>
              </div>
            ) : null}
          </div>

          <p className="mt-10 text-center text-[11px] text-zinc-400">
            Data: CHM KOL roster · optional MediaHub enrichment. Not a federal repository placeholder.
          </p>
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
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-[color,transform] hover:text-[#0d4f6c] active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      {children}
    </a>
  );
}
