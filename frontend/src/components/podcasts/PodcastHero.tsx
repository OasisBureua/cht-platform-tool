import type { CSSProperties, ReactNode } from 'react';
import { PODCAST_SHOWS } from '../../data/podcastsCatalog';
import '../../pages/public/PodcastNetwork.css';

/**
 * The podcast network's hero, shared by the public hub and the member app
 * so the two read as one network. Each page brings its own actions.
 *
 * The covers carry the hero. Four of them fanned reads as a network in a
 * way a headline alone does not, and they are what a listener recognises.
 * The drift is a slow float, ambient rather than something to watch, and
 * it stops under reduced motion.
 */
export function PodcastHero({ actions, rail = false }: { actions: ReactNode; rail?: boolean }) {
  return (
    <section className="pod-hero">
      <span className="pod-hero__glow" aria-hidden />
      <div className={[rail ? 'rail' : '', 'pod-hero__in'].join(' ')}>
        <div className="pod-hero__copy">
          <p className="eyebrow text-muted2">Podcast network</p>
          <h1 className="display text-text">Four shows, one network</h1>
          <p className="pod-hero__lede">
            Expert-led conversations in oncology and breast cancer, for clinicians, patients and caregivers. Pick a
            show, then listen on your platform of choice.
          </p>
          <div className="pod-hero__actions flex flex-wrap gap-3">{actions}</div>
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
  );
}
