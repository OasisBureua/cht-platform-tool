import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import {
  CHM_PODCAST_PLATFORM_LINKS,
  PODCAST_SHOWS,
  type PodcastShow,
} from '../../data/podcastsCatalog';
import { Button, Reveal } from '../../components/ui';
import './PodcastNetwork.css';

/**
 * Public Podcast Network hub, at the clean URL `/podcast-network`.
 * Lists CHM shows and listen destinations; scales as shows are added to
 * `PODCAST_SHOWS`. In-app listening stays under `/app/podcast-network`.
 */
/**
 * One colour per show, drawn from the CHM spectrum.
 *
 * Four cards sharing a layout read as one block; the hue is what tells
 * them apart at a glance. `ring` tints the card's edge, `ink` carries
 * the category line and fills the primary action.
 */
const SHOW_TONE: Record<string, { ring: string; ink: string }> = {
  'breast-friends': { ring: 'rgb(167 27 134 / 0.34)', ink: 'rgb(167 27 134)' },
  'cancer-unfiltered': { ring: 'rgb(0 112 138 / 0.34)', ink: 'rgb(0 112 138)' },
  'big-c-energy': { ring: 'rgb(143 81 0 / 0.34)', ink: 'rgb(143 81 0)' },
  tetalks: { ring: 'rgb(100 56 194 / 0.34)', ink: 'rgb(100 56 194)' },
};

const NEUTRAL_TONE = { ring: 'var(--color-hairline)', ink: 'var(--color-dim)' };

export default function PodcastNetwork() {
  return (
    <div className="min-h-screen bg-ground">
      {/* The covers carry the hero. Four of them fanned reads as a
          network in a way a headline alone does not, and they are what a
          listener recognises. The drift is a slow float, ambient rather
          than something to watch, and it stops under reduced motion. */}
      <section className="pod-hero">
        <span className="pod-hero__glow" aria-hidden />
        <div className="rail pod-hero__in">
          <div className="pod-hero__copy">
            <p className="eyebrow text-muted2">Podcast network</p>
            <h1 className="display text-text">Four shows, one network</h1>
            <p className="pod-hero__lede">
              Expert-led conversations in oncology and breast cancer, for clinicians, patients and
              caregivers. Pick a show, then listen on your platform of choice.
            </p>
            <div className="pod-hero__actions flex flex-wrap gap-3">
              <Button to="/join" className="bg-signature text-ground hover:bg-signature hover:brightness-[0.94]">
                Join CHM
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Button>
              <Button to="/kols" variant="outline">
                Browse the KOL directory
              </Button>
            </div>
          </div>

          <ul className="pod-fan" aria-hidden>
            {PODCAST_SHOWS.map((show, i) => (
              <li key={show.id} style={{ '--i': i } as CSSProperties}>
                <img src={show.image} alt="" width={1200} height={1200} decoding="async" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rail pb-16" aria-labelledby="podcast-shows-heading">
        <h2 id="podcast-shows-heading" className="display text-display-s text-text">
          Shows
        </h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {PODCAST_SHOWS.map((show, i) => (
            <Reveal as="li" key={show.id} delay={Math.min(i, 5) * 50}>
              <ShowCard show={show} />
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="border-t border-hairline">
        <div className="rail flex flex-wrap items-center justify-between gap-8 py-16">
          <div>
            <h2 className="display text-display-m text-text">Listen on any platform</h2>
            <p className="prose-lede mt-3 max-w-[46ch] text-body-m text-muted2">
              The CHM umbrella feed covers the network. Each series also has its own
              listen destinations.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {CHM_PODCAST_PLATFORM_LINKS.map((p) => (
              <li key={p.href}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press inline-flex h-10 items-center gap-1.5 rounded-[6px] px-4 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {p.label}
                  <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function ShowCard({ show }: { show: PodcastShow }) {
  const listenHref = (show.platformLinks ?? CHM_PODCAST_PLATFORM_LINKS)[0]?.href;
  const seriesPath = `/podcast-network/${encodeURIComponent(show.id)}`;
  const tone = SHOW_TONE[show.id] ?? NEUTRAL_TONE;

  return (
    <article
      className="lift card flex h-full flex-col gap-5 p-6 sm:flex-row sm:items-start"
      style={{ boxShadow: `inset 0 0 0 1px ${tone.ring}` }}
    >
      <img
        src={show.logo ?? show.image}
        alt=""
        className={[
          'size-24 shrink-0 rounded-[6px] shadow-card sm:size-28',
          show.logo ? 'object-contain bg-surface p-2' : 'object-cover',
        ].join(' ')}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="min-w-0 flex-1">
        <p className="eyebrow" style={{ color: tone.ink }}>
          {show.category}
        </p>
        <h3 className="display mt-1 text-body-l text-text">
          <Link to={seriesPath} className="press rounded outline-offset-4 hover:text-signature">
            {show.title}
          </Link>
        </h3>
        <p className="prose-lede mt-2 text-body-s text-muted2">{show.tagline}</p>
        <p className="meta mt-3 text-faint">{show.updateNote}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to={seriesPath}
            className="press inline-flex h-9 items-center gap-1.5 rounded-[6px] px-4 text-body-s text-white hover:brightness-[1.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{ backgroundColor: tone.ink }}
          >
            View series
            <ArrowRight className="size-3.5" strokeWidth={1.75} />
          </Link>
          {listenHref ? (
            <a
              href={listenHref}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-flex h-9 items-center gap-1.5 rounded-[6px] px-4 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Listen
              <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
