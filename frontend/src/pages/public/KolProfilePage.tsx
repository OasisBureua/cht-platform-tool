import { ProfileBanner } from '../../components/kol/ProfileBanner';
import { useMemo, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
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
      <div className="w-full max-w-none">
        {/* Banner: full viewport width */}
        {/* A banner rather than a slab: the cluster motif seeded from
            this profile, so the page reads as part of the site instead
            of a stock gradient. A supplied banner image still wins. */}
        <div className="relative h-24 w-full overflow-hidden bg-surface sm:h-28">
          {vm.bannerImageUrl ? (
            <img src={vm.bannerImageUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <ProfileBanner seed={entry.id} />
          )}
        </div>


        {/* ── Dossier ──────────────────────────────────────────
            A sticky identity rail beside a scrolling record. The tabs
            are gone: they hid two thirds of the profile behind a click,
            and the fields a partner wants to compare -- sessions,
            publications, Open Payments -- were never on screen together. */}
        <div className="rail grid gap-8 pb-6 lg:grid-cols-[21rem_1fr] lg:gap-12">
          <aside className="lg:sticky lg:top-24 lg:h-fit lg:self-start">
            <img
              src={entry.photoUrl || avatarUrl(entry.name)}
              alt=""
              className="-mt-12 size-24 rounded-full bg-surface-2 object-cover shadow-card-hover ring-4 ring-ground sm:size-28"
            />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <h1 className="display text-[1.75rem] leading-[1.06] tracking-[-0.028em] text-text">
                {vm.displayName}
              </h1>
              {entry.featured ? (
                <span className="eyebrow rounded-[5px] bg-cta px-2 py-1 text-ground">Featured</span>
              ) : null}
              {vm.rosterOnly ? (
                <span className="eyebrow rounded-[5px] bg-surface-2 px-2 py-1 text-muted2">Roster</span>
              ) : null}
            </div>
            <p className="prose-lede mt-2 text-body-s text-muted2">{vm.institution}</p>

            {/* The hard numbers, pinned. This is the block that has to
                stay on screen while the narrative scrolls past it. */}
            <dl className="mt-6 border-t border-hairline">
              {(
                [
                  ['Specialty', vm.specialty],
                  ['Location', vm.stateName],
                  entry.shootCount ? ['Sessions', String(entry.shootCount)] : null,
                  entry.intel?.publicationsApprox
                    ? ['Publications', `~${entry.intel.publicationsApprox}`]
                    : null,
                  entry.intel?.openPayments
                    ? ['Open Payments', `$${entry.intel.openPayments.total.toLocaleString()}`]
                    : null,
                  entry.intel?.openPayments
                    ? ['Records', `${entry.intel.openPayments.records} · ${entry.intel.openPayments.years}`]
                    : null,
                  entry.intel?.npi ? ['NPI', entry.intel.npi] : null,
                  entry.intel?.handle ? ['Handle', entry.intel.handle] : null,
                ].filter(Boolean) as [string, string][]
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5"
                >
                  <dt className="text-body-s text-faint">{k}</dt>
                  <dd className="meta text-end tabular-nums text-text">{v}</dd>
                </div>
              ))}
            </dl>

            <Link
              to={catalogHref}
              className="press mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-cta text-body-s font-medium text-ground hover:bg-cta-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Catalog videos
              <ArrowRight className="size-4" aria-hidden />
            </Link>

            {(vm.phone || vm.linkedInUrl || vm.twitterUrl || vm.webUrl) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {vm.phone ? (
                  <a
                    href={`tel:${vm.phone.replace(/\D/g, '')}`}
                    className="press inline-flex h-10 items-center rounded-[6px] bg-surface px-3 text-body-s text-anchor shadow-card hover:brightness-110"
                  >
                    {vm.phone}
                  </a>
                ) : null}
                <SocialIcon href={vm.linkedInUrl} label="LinkedIn">
                  <IconLinkedIn className="size-4" />
                </SocialIcon>
                <SocialIcon href={vm.twitterUrl} label="Twitter / X">
                  <IconTwitter className="size-4" />
                </SocialIcon>
                <SocialIcon href={vm.webUrl} label="Website">
                  <ExternalLink className="size-4" />
                </SocialIcon>
              </div>
            )}
          </aside>

          <div className="min-w-0 lg:pt-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="eyebrow text-faint">Role</p>
                <p className="prose-lede mt-1.5 text-body-s text-dim">{entry.role}</p>
              </div>
              {entry.intel?.affiliation ? (
                <div>
                  <p className="eyebrow text-faint">Affiliation</p>
                  <p className="prose-lede mt-1.5 text-body-s text-dim">{entry.intel.affiliation}</p>
                </div>
              ) : null}
              {entry.education?.trim() ? (
                <div className="sm:col-span-2">
                  <p className="eyebrow text-faint">Education &amp; training</p>
                  <p className="prose-lede mt-1.5 text-body-s text-dim">{entry.education}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-8 space-y-4">

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

                <article className="card p-6">
                  <h2 className="display flex items-center gap-2 text-body-m text-text">
                    <Briefcase className="h-4 w-4" aria-hidden />
                    Role
                  </h2>
                  <p className="prose-lede mt-3 text-body-s text-muted2">{entry.role}</p>
                </article>

                <KolCatalogContentSection entry={entry} variant="overview" limit={8} />
              
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

                {/* Last: seventeen indexed papers is a reference list, not
                    the reason anyone opened the page. */}
                <KolPublicationsSection kolId={entry.id} />
              
            </div>
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
