import Link from "next/link";
import { notFound } from "next/navigation";
import {
  byNewest,
  diseaseBySlug,
  facultyBySlug,
  itemBySlug,
  items,
  itemsByDisease,
  prettyDate,
  seriesBySlug,
  showBySlug,
  tagTone,
} from "@/lib/data";
import { Player } from "@/components/player";
import { CompactCard, Eyebrow, SectionHead } from "@/components/ui";

export function generateStaticParams() {
  return items.filter((i) => i.format !== "editorial").map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${itemBySlug(slug)?.title ?? "Watch"} · CHM` };
}

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = itemBySlug(slug);
  if (!item || item.format === "editorial") notFound();

  const disease = diseaseBySlug(item.disease);
  const parentSeries = item.series ? seriesBySlug(item.series) : undefined;
  const parentShow = item.show ? showBySlug(item.show) : undefined;

  // A track is only useful if it is actually a track. Start with the
  // series, widen to the disease state, then to everything else, and
  // stop at eight. A single lonely card was the old behaviour.
  const watchable = (i: (typeof items)[number]) => i.format !== "editorial" && i.slug !== item.slug;
  const track = [
    ...items.filter((i) => watchable(i) && item.series && i.series === item.series),
    ...itemsByDisease(item.disease).filter(watchable),
    ...byNewest(items).filter(watchable),
  ].filter((i, at, all) => all.findIndex((o) => o.slug === i.slug) === at);

  const queue = track.slice(0, 5);
  const related = track.slice(0, 3);

  return (
    <>
      <div className="rail pt-8">
        <nav aria-label="Breadcrumb" className="meta flex flex-wrap items-center gap-2 text-faint">
          <Link href="/latest" className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor">
            Latest
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/disease/${item.disease}`}
            className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
          >
            {disease?.label}
          </Link>
          {parentSeries ? (
            <>
              <span aria-hidden>/</span>
              <Link
                href={`/series/${parentSeries.slug}`}
                className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
              >
                {parentSeries.title}
              </Link>
            </>
          ) : null}
        </nav>
      </div>

      <section className="rail grid gap-10 pt-6 pb-14 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div>
          <Player item={item} queue={queue} />
        </div>

        <aside className="space-y-4">
          <div>
            <Eyebrow>
              {item.format} · {disease?.full}
            </Eyebrow>
            <h1 className="display display-tight mt-3 text-[1.75rem] leading-[1.12] text-text">
              {item.title}
            </h1>
            <p className="prose-lede mt-3 text-body-s text-muted">{item.dek}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="meta text-faint">{prettyDate(item.published)}</span>
              <span className="meta tabular-nums text-faint">{item.views} views</span>
            </div>

            {/* Tags are filters: each one opens the library narrowed to
                it. Colour is by kind, not per tag. */}
            <ul className="mt-4 flex flex-wrap gap-2">
              {item.tags.map((t) => {
                const tone = tagTone(t);
                return (
                  <li key={t}>
                    <Link
                      href={`/catalog?q=${encodeURIComponent(t)}`}
                      className="press inline-flex h-8 items-center rounded-[6px] px-3 text-body-s shadow-[var(--shadow-card)] transition-[filter] duration-150 ease-[var(--ease-standard)] hover:brightness-[0.94]"
                      style={{ background: tone.fill, color: tone.label }}
                    >
                      {t}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card p-5">
            <Eyebrow>In conversation</Eyebrow>
            <ul className="mt-4 space-y-4">
              {item.faculty.map((f) => {
                const person = facultyBySlug(f);
                if (!person) return null;
                return (
                  <li key={f}>
                    <Link href={`/faculty/${f}`} className="press group flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={person.photo}
                        alt=""
                        className="img-ring size-11 rounded-full object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-body-s font-medium text-text group-hover:text-anchor">
                          {person.name}
                        </span>
                        <span className="block truncate text-[0.75rem] text-muted">{person.org}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {parentSeries ? (
            <Link href={`/series/${parentSeries.slug}`} className="card press lift block p-5">
              <Eyebrow>Part of the series</Eyebrow>
              <p className="display mt-2 text-body-l text-text">{parentSeries.title}</p>
              <p className="mt-1.5 text-body-s text-muted">{parentSeries.summary}</p>
              <p className="eyebrow mt-3 text-anchor">{parentSeries.episodes} episodes →</p>
            </Link>
          ) : null}

          {parentShow ? (
            <Link href={`/podcasts/${parentShow.slug}`} className="card press lift block p-5">
              <Eyebrow>From the show</Eyebrow>
              <p className="display mt-2 text-body-l text-text">{parentShow.title}</p>
              <p className="mt-1.5 text-body-s text-muted">{parentShow.about}</p>
              <p className="eyebrow mt-3 text-anchor">{parentShow.episodes} episodes →</p>
            </Link>
          ) : null}
        </aside>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="track-heading" className="rail pb-16">
          <SectionHead
            id="track-heading"
            title="Next in this track"
            seeAll={{ noun: `${disease?.label} sessions`, href: `/disease/${item.disease}` }}
          />
          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <CompactCard item={r} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
