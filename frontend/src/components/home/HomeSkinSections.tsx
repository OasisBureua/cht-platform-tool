import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ChmMark } from '../brand/ChmMark';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import './HomeSkin.css';

/*
 * The homepage sections and the closing band, ported from the CHM
 * WordPress theme where they were designed and signed off. Markup and
 * class names match the theme's templates one to one, so HomeSkin.css
 * (the theme's CSS, scoped under .chm-skin) applies unchanged. Data
 * comes from the app: faculty portraits, the podcast catalog, featured
 * session thumbnails.
 */

export function Arrow() {
  return (
    <svg className="btn-arrow" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path d="M3.2 8.8 8.8 3.2M8.8 3.2H4.4M8.8 3.2v4.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Play() {
  return (
    <svg viewBox="0 0 10 12" fill="currentColor" aria-hidden>
      <path d="M0 0l10 6-10 6z" />
    </svg>
  );
}

/* ── disease states ─────────────────────────────────────────────── */

export type SkinArea = {
  key: string;
  label: string;
  note: string;
  /** Raw HSL triplet reference, e.g. `var(--cerebral-pink)`. */
  hue: string;
  ink: string;
  /** Anatomy file under /images/anatomy, without the extension. */
  art: string;
  to?: string;
};

export function AreasSection({ areas }: { areas: SkinArea[] }) {
  return (
    <div className="chm-skin">
      <section className="band rail areas-band" aria-labelledby="areas-heading">
        <span className="areas-mark" aria-hidden>
          <ChmMark />
        </span>
        <div className="areas-grid">
          <div className="areas-intro">
            <h2 id="areas-heading">
              Explore by
              <br />
              disease state
            </h2>
            <p>Each cluster is sized by what the area actually holds.</p>
          </div>
          <ul className="areas">
            {areas.map((a) => {
              const style = { '--cluster-hue': a.hue, '--cluster-ink': a.ink } as CSSProperties;
              const inner = (
                <>
                  <span className="area__cluster">
                    <span className={`area__art area__art--${a.art}`} />
                  </span>
                  <span className="area__body">
                    <h3>{a.label}</h3>
                    <p>{a.note}</p>
                  </span>
                </>
              );
              // Areas still in production have no page yet, so they are
              // not links; they look the same and go nowhere rather than
              // opening an empty catalog.
              return (
                <li key={a.key}>
                  {a.to ? (
                    <Link className="area" to={a.to} style={style}>
                      {inner}
                    </Link>
                  ) : (
                    <div className="area" style={style}>
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}

/* ── this moment in medicine ─────────────────────────────────────── */

export type SkinMoment = { key: string; title: string; duration?: string; imageUrl?: string; to: string };

export function MomentsSection({ moments }: { moments: SkinMoment[] }) {
  return (
    <div className="chm-skin">
      <section className="band rail band--footaction" aria-labelledby="moment-heading">
        <div className="band__head">
          <h2 id="moment-heading">This moment in medicine</h2>
          <p>Short answers to the questions that come up between patients.</p>
        </div>
        <ul className="moments">
          {moments.map((m, i) => (
            <li key={m.key}>
              <Link className="moment" to={m.to}>
                {m.imageUrl ? <img src={m.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
                <span>
                  {m.duration ? <span className="moment__dur">{m.duration}</span> : null}
                  <h3>{m.title}</h3>
                </span>
                <span className="moment__no" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {/* The link concludes the row rather than being a shortcut past
            it, so it sits under the cards, not beside the head. */}
        <div className="band__foot">
          <Link className="band__action" to="/catalog">
            See all episodes <Arrow />
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ── in conversation ─────────────────────────────────────────────── */

export type SkinPerson = {
  key: string;
  name: string;
  org: string;
  /** Background-free portrait, preferred when present. */
  cutoutUrl?: string;
  /** The original headshot, used only when there is no cut-out. */
  photoUrl?: string;
  mono: string;
  to: string;
};

export function PeopleSection({ people }: { people: SkinPerson[] }) {
  return (
    <div className="chm-skin">
      <section className="band rail" aria-labelledby="people-heading">
        <div className="band__head">
          <h2 id="people-heading">In conversation</h2>
          <p>Practising specialists who bring their own audiences.</p>
          <Link className="band__action" to="/kol-network">
            See all profiles <Arrow />
          </Link>
        </div>
        <ul className="people">
          {people.map((p) => (
            <li key={p.key}>
              <Link className="person" to={p.to}>
                <span className="person__ghost" aria-hidden>
                  <ChmMark />
                </span>
                {p.cutoutUrl ? (
                  <img src={p.cutoutUrl} alt="" loading="lazy" width={540} height={540} />
                ) : p.photoUrl ? (
                  <img className="person__photo--raw" src={p.photoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <span className="person__mono" aria-hidden>
                    {p.mono}
                  </span>
                )}
                <span className="person__label">
                  <h3>{p.name}</h3>
                  <p>{p.org}</p>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ── podcast network ─────────────────────────────────────────────── */

export type SkinShow = { key: string; title: string; category: string; tagline: string; update: string; lang?: string; to: string };

/**
 * Twenty-eight bar heights for a show's waveform, seeded from the show
 * id so a show looks the same on every render. Delays step back 70ms a
 * bar on a 1.9s cycle, as in the theme.
 */
function waveBars(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  return Array.from({ length: 28 }, (_, i) => ({
    height: 18 + Math.round(rand() * 76),
    delay: (((1.9 - i * 0.07) % 1.9) + 1.9) % 1.9,
  }));
}

export function ShowsSection({ shows }: { shows: SkinShow[] }) {
  return (
    <div className="chm-skin">
      <section className="band rail" aria-labelledby="shows-heading">
        <div className="band__head">
          <h2 id="shows-heading">CHM Podcast network</h2>
          <p>Four shows, each with its own voice.</p>
          <Link className="band__action" to="/podcast-network">
            All shows
          </Link>
        </div>
        <ul className="shows">
          {shows.map((s) => (
            <li key={s.key}>
              <Link className="show" to={s.to}>
                <span className="eyebrow">{s.category}</span>
                <h3>{s.title}</h3>
                <p className="show__tagline" lang={s.lang}>
                  {s.tagline}
                </p>
                <span className="wave" aria-hidden>
                  {waveBars(s.key).map((b, i) => (
                    <span key={i} style={{ height: `${b.height}%`, animationDelay: `${b.delay.toFixed(2)}s` }} />
                  ))}
                </span>
                <span className="show__foot">
                  <span className="show__play">
                    <Play />
                  </span>
                  <span>Listen</span>
                  <span className="eyebrow" lang={s.lang}>
                    {s.update}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ── the closing band: CTA and footer on one slate ───────────────── */

export type SkinFooterLink = { label: string; to?: string; href?: string };
export type SkinFooterColumn = { label: string; links: SkinFooterLink[] };

const SOCIALS = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/healthinourhands_/',
    glyph: (
      <>
        <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="3.2" />
        <circle cx="8" cy="8" r="2.6" />
        <circle cx="11.3" cy="4.7" r=".85" />
      </>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@CommunityHealthMedia/videos',
    glyph: (
      <>
        <rect x="1.7" y="3.7" width="12.6" height="8.6" rx="2.5" />
        <path d="M6.8 6.5 10 8l-3.2 1.5z" />
      </>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/community-health-media/',
    glyph: (
      <>
        <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.2" />
        <path d="M5.3 6.9v4.2M5.3 5v.1M7.9 11.1V6.9M7.9 8.5c0-1.5 2.7-1.6 2.7.2v2.4" />
      </>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/CHMediaHub/',
    glyph: <path d="M9.5 13.8V8.5h1.7l.3-2H9.5V5.2c0-.6.2-1 1-1h1V2.4A13 13 0 0 0 10 2.2C8.4 2.2 7.3 3.2 7.3 5v1.5H5.6v2h1.7v5.3z" />,
  },
];

export function ClosingBand({ columns }: { columns: SkinFooterColumn[] }) {
  return (
    <div className="chm-skin">
      <section className="closing">
        {/* The marks fade out down their own height, which is what makes
            the band read as lit from the top rather than as a slab with
            shapes stamped on it. */}
        <span className="closing__mark closing__mark--l" aria-hidden>
          <ChmMark />
        </span>
        <span className="closing__mark closing__mark--r" aria-hidden>
          <ChmMark />
        </span>

        <div className="rail getstarted__in">
          <h2>Free for clinicians. Always.</h2>
          <p>Create an account to save your place, claim credit and get one email a week.</p>
          <div className="getstarted__actions">
            <Link className="btn btn-primary" to="/join">
              Start watching free <Arrow />
            </Link>
            <Link className="btn btn-secondary" to="/for-hcps">
              For HCPs
            </Link>
          </div>
        </div>

        <footer className="site-foot">
          <div className="rail">
            <div className="foot-top" tabIndex={0} role="group" aria-label="Site links, scroll for more">
              <div className="foot-about">
                <Link className="site-bar__mark" to="/" aria-label="Community Health Media, home">
                  <ChmWordmarkOption2 className="h-auto w-[5rem]" />
                </Link>
                <p>Community Health Media. Peer-led oncology education, organised the way clinicians actually work.</p>
                <address>
                  2471 18th St NW&nbsp; Second Floor&nbsp; Washington, DC 20009
                  <br />
                  <a href="mailto:info@communityhealth.media">info@communityhealth.media</a>
                </address>
                <div className="socials">
                  {SOCIALS.map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        {s.glyph}
                      </svg>
                    </a>
                  ))}
                </div>
              </div>

              {columns.map((col) => (
                <div className="foot-col" key={col.label}>
                  <h4>{col.label}</h4>
                  <ul>
                    {col.links.map((l) => (
                      <li key={(l.to ?? l.href ?? '') + l.label}>
                        {l.href ? (
                          <a href={l.href} target="_blank" rel="noopener noreferrer">
                            {l.label}
                          </a>
                        ) : (
                          <Link to={l.to ?? '/'}>{l.label}</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="foot-base">
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <span className="foot-base__mid">&copy; 2026 Community Health Technologies, Inc. All rights reserved.</span>
              <span className="foot-base__tag">Medicine moves through shared knowledge</span>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
