import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { mountGalleryRoom, mountHeroField } from './galleryRoom';
import './GalleryHero.css';

export type GalleryWork = {
  id: string;
  title: string;
  imageUrl: string;
  href: string;
  /** Short line under the title on the card, e.g. "Video". */
  meta?: string;
};

type GalleryHeroProps = {
  works: GalleryWork[];
};

/**
 * The homepage hero: a WebGL gallery room of real sessions between the
 * headline and the lede. Ported from the CHM WordPress theme, where the
 * design was built and signed off.
 *
 * The works render as a real list of links first. The canvas draws on
 * top and parks each link over its moving card, so a click opens that
 * session. Without WebGL the list stays an ordinary grid.
 */
export function GalleryHero({ works }: GalleryHeroProps) {
  const ref = useRef<HTMLElement>(null);
  // Remount only when the set of works changes, not on every render:
  // the room owns a GL context and a render loop.
  const signature = works.map((w) => w.id).join('|');

  useEffect(() => {
    const el = ref.current;
    if (!el || works.length === 0) return;
    const offField = mountHeroField(el);
    const offRoom = mountGalleryRoom(el);
    return () => {
      offRoom?.();
      offField?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <section
      ref={ref}
      className="hero"
      data-hero
      data-gl="off"
      aria-roledescription="carousel"
      aria-label="Featured sessions"
    >
      <canvas className="hero__field" aria-hidden="true" />
      <canvas className="hero__canvas" aria-hidden="true" />

      <div className="hero__copy hero__copy--top">
        <h1>
          Medicine moves through
          <br />
          shared knowledge.
        </h1>
      </div>

      {works.length > 0 ? (
        <ul className="hero__works">
          {works.map((w) => (
            <li key={w.id}>
              <Link
                to={w.href}
                className="work-card"
                data-work=""
                data-thumb={w.imageUrl}
                data-title={w.title}
                data-meta={w.meta ?? ''}
              >
                <img src={w.imageUrl} alt="" width={640} height={360} loading="lazy" />
                <h3>{w.title}</h3>
                {w.meta ? <span>{w.meta}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="hero__copy hero__copy--bottom">
        <p>
          Expert video, podcasts and editorial for oncology, organised by disease state and by
          format, so you can browse the way you actually work.
        </p>
      </div>
    </section>
  );
}
