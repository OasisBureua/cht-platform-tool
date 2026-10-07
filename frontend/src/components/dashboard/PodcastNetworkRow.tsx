import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { PODCAST_SHOWS } from '../../data/podcastsCatalog';
import { waveBars } from '../home/waveBars';
import { ConversationRow } from '../home/ConversationRow';

/**
 * The public site's podcast cards, brought into the dashboard as a row.
 * Same deep-expertise card and seeded waveform as the homepage, sized to
 * the other strips. The bars stand still: a dashboard is opened many
 * times a day, so the homepage's animation stays on the homepage.
 */
export function PodcastNetworkRow() {
  return (
    <ConversationRow
      title="Podcast network"
      subtitle={`${PODCAST_SHOWS.length} shows`}
      seeAllHref="/app/podcast-network"
      seeAllLabel="All shows"
    >
      {PODCAST_SHOWS.map((show) => {
        const lang = show.id === 'tetalks' ? 'es' : undefined;
        return (
          <div key={show.id} className="snap-start" style={{ scrollSnapAlign: 'start' }}>
            {/* Permanently deep: the card keeps its fixed white text in both
                appearances, as it does on the homepage. */}
            <Link
              to={`/app/podcast-network/${encodeURIComponent(show.id)}`}
              className="group flex min-h-[204px] w-[226px] flex-col rounded-card bg-[hsl(196_66%_23%)] p-4 text-white shadow-card transition-[transform,box-shadow] duration-150 ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.98] sm:w-[250px]"
            >
              <span className="eyebrow text-white/65" lang={lang}>
                {show.category}
              </span>
              <span className="display mt-2 text-body-l text-white">{show.title}</span>
              <span aria-hidden className="mt-auto flex h-11 items-end gap-[3px] pt-4">
                {waveBars(show.id).map((b, i) => (
                  <span key={i} className="flex-1 rounded-[2px] bg-white/35" style={{ height: `${b.height}%` }} />
                ))}
              </span>
              <span className="mt-3 flex items-center gap-2 text-body-s">
                <span className="grid size-7 place-items-center rounded-full bg-white text-[hsl(196_66%_23%)]">
                  <Play className="ms-px h-3 w-3 fill-current" aria-hidden />
                </span>
                Listen
                <span className="meta ms-auto truncate text-white/65" lang={lang}>
                  {show.updateNote}
                </span>
              </span>
            </Link>
          </div>
        );
      })}
    </ConversationRow>
  );
}
