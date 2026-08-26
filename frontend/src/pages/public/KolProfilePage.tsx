import { ProfileBanner } from '../../components/kol/ProfileBanner';
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
      <div className="min-h-screen w-full bg-ground px-6 py-20 text-center text-muted2">
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
    <div className="min-h-screen w-full bg-ground pb-20 text-text">
      <div className="sticky top-16 z-30 w-full bg-[color-mix(in_oklab,var(--color-surface)_88%,transparent)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex w-full max-w-none items-center gap-1 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            to="/kol-network"
            className="press grid size-11 shrink-0 place-items-center rounded-[6px] text-dim hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Back to KOL directory"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="display truncate text-body-m leading-tight text-text">{vm.displayName}</p>
            <p className="truncate text-body-s text-muted2">
              {(entry.role.split(/[.;]/)[0]?.trim() ?? '').slice(0, 56)}
              {(entry.role.split(/[.;]/)[0]?.trim() ?? '').length > 56 ? '…' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-none">
        {/* Banner: full viewport width */}
        {/* A banner rather than a slab: the cluster motif seeded from
            this profile, so the page reads as part of the site instead
            of a stock gradient. A supplied banner image still wins. */}
        <div className="relative h-40 w-full overflow-hidden bg-surface sm:h-52">
          {vm.bannerImageUrl ? (
            <img src={vm.bannerImageUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <ProfileBanner seed={entry.id} />
          )}
        </div>

        <div className="rail relative pb-6">
          {/* Avatar overlap */}
          <div className="relative -mt-16 flex justify-between sm:-mt-[4.25rem]">
            <img
              src={entry.photoUrl || avatarUrl(entry.name)}
              alt=""
              className="size-28 rounded-full bg-surface-2 object-cover shadow-card-hover ring-4 ring-ground sm:size-32"
            />
            <div className="flex flex-col items-end gap-2 pt-20 sm:pt-24">
              <span className="eyebrow inline-flex items-center rounded-[6px] bg-surface px-3 py-1.5 text-anchor shadow-card">
                CHM Network
              </span>
              <Link
                to={catalogHref}
                className="press inline-flex h-10 items-center gap-2 rounded-[6px] bg-cta px-4 text-body-s font-medium text-ground hover:bg-cta-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Catalog videos
                <ArrowRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="display text-[2rem] leading-[1.04] tracking-[-0.03em] text-text sm:text-[2.6rem]">
                  {vm.displayName}
                </h1>
                {entry.featured ? (
                  <span
                    className="eyebrow rounded-[5px] bg-cta px-2 py-1 text-ground"
                    title="Curator-featured KOL"
                  >
                    ★ Featured
                  </span>
                ) : null}
              </div>
              {vm.rosterOnly ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="eyebrow rounded-[5px] bg-surface-2 px-2 py-1 text-muted2">
                    Roster
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-x-10 gap-y-4 border-t border-hairline pt-6 text-body-s sm:grid-cols-2">
              <div>
                <p className="eyebrow text-faint">Specialty</p>
                <p className="mt-1.5 text-dim">{vm.specialty}</p>
              </div>
              <div>
                <p className="eyebrow text-faint">State</p>
                <p className="mt-1.5 text-dim">{vm.stateName}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="eyebrow text-faint">Institution</p>
                <p className="mt-1.5 text-dim">{vm.institution}</p>
              </div>
              {entry.education?.trim() ? (
                <div className="sm:col-span-2">
                  <p className="eyebrow text-faint">Education &amp; training</p>
                  <p className="prose-lede mt-1.5 text-dim">{entry.education}</p>
                </div>
              ) : null}
            </div>

            {(vm.phone || vm.linkedInUrl || vm.twitterUrl || vm.webUrl) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {vm.phone ? (
                  <a
                    href={`tel:${vm.phone.replace(/\D/g, '')}`}
                    className="press inline-flex h-9 items-center rounded-[6px] text-body-s text-anchor hover:brightness-110"
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
          <nav className="mt-9 flex gap-1 border-b border-hairline" aria-label="Profile sections">
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
                  'press relative min-h-[44px] rounded-t-[6px] px-4 pb-3 pt-2 text-body-m transition-colors duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor',
                  tab === id ? 'font-medium text-text' : 'text-muted2 hover:text-text',
                ].join(' ')}
              >
                {label}
                {tab === id ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-anchor"
                  />
                ) : null}
              </button>
            ))}
          </nav>

          <div className="mt-8 space-y-4" role="tabpanel">
            {tab === 'overview' ? (
              <>
                {displayBrief ? (
                  <article className="card overflow-hidden p-0">
                    <div className="flex items-center gap-2 border-b border-hairline px-6 py-4">
                      <Sparkles
                        className={`size-4 ${displayBrief.isAiGenerated ? 'text-anchor' : 'text-faint'}`}
                        aria-hidden
                      />
                      <span className="display text-body-m text-text">Intel summary</span>
                      <span className="eyebrow ms-auto text-faint">
                        {displayBrief.isAiGenerated ? 'AI-generated' : 'Profile summary'}
                      </span>
                    </div>
                    <div className="space-y-5 px-6 py-5 text-body-s leading-relaxed text-muted2">
                      <div>
                        <p className="eyebrow text-faint">Who they are</p>
                        <p className="mt-2">{displayBrief.whoTheyAre}</p>
                      </div>
                      {displayBrief.focus ? (
                        <div>
                          <p className="eyebrow text-faint">What they focus on</p>
                          <p className="mt-2">{displayBrief.focus}</p>
                        </div>
                      ) : null}
                      {displayBrief.chmContext ? (
                        <div>
                          <p className="eyebrow text-faint">CHM context</p>
                          <p className="mt-2">{displayBrief.chmContext}</p>
                        </div>
                      ) : null}
                    </div>
                    {displayBrief.isAiGenerated ? (
                      <div className="border-t border-hairline px-6 py-4">
                        <p className="text-body-s leading-snug text-faint">
                          AI-generated summaries are provided for convenience and may contain inaccuracies. Verify
                          important details against primary sources.
                        </p>
                      </div>
                    ) : null}
                  </article>
                ) : null}

                <KolPublicationsSection kolId={entry.id} />

                <article className="card p-6">
                  <h2 className="display flex items-center gap-2 text-body-m text-text">
                    <Briefcase className="h-4 w-4" aria-hidden />
                    Role
                  </h2>
                  <p className="prose-lede mt-3 text-body-s text-muted2">{entry.role}</p>
                </article>

                <KolCatalogContentSection entry={entry} variant="overview" limit={8} />
              </>
            ) : null}

            {tab === 'background' ? (
              <div className="space-y-4">
                {showBioOnBackground ? (
                  <article className="card p-6">
                    <h2 className="display text-body-m text-text">Summary</h2>
                    <p className="prose-lede mt-3 text-body-s text-muted2">{entry.bio}</p>
                  </article>
                ) : null}
                {vm.researchHighlights ? (
                  <article className="card p-6">
                    <h2 className="display text-body-m text-text">Research highlights</h2>
                    <p className="prose-lede mt-3 text-body-s text-muted2">{vm.researchHighlights}</p>
                  </article>
                ) : null}
                {vm.awards && vm.awards.length > 0 ? (
                  <article className="card p-6">
                    <h2 className="display text-body-m text-text">Recognition</h2>
                    <ul className="mt-3 list-inside list-disc space-y-1.5 text-body-s text-muted2">
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
      className="press grid size-10 place-items-center rounded-[6px] bg-surface text-muted2 shadow-card transition-colors duration-150 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </a>
  );
}
