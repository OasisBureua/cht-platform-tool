import { byNewest, items } from "@/lib/data";
import { Button, Eyebrow } from "@/components/ui";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { LibraryBrowser } from "@/components/library-browser";

export const metadata = { title: "Content library · CHM" };

export default function CatalogPage() {
  const featured = byNewest(items).slice(0, 3);

  return (
    <>
      <section aria-labelledby="library-heading" className="rail pt-14 pb-12 md:pt-16 md:pb-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.02fr] lg:gap-16">
          <div>
            <Eyebrow>Content library</Eyebrow>
            <h1
              id="library-heading"
              className="display mt-6 max-w-[16ch] text-[2.5rem] leading-[1.04] tracking-[-0.03em] text-text md:text-display-l"
            >
              Every conversation, every cut
            </h1>
            <p className="prose-lede mt-6 max-w-[50ch] text-body-l text-muted">
              Filter by format and disease state at the same time. Every session exists as
              long-form video, an audio cut, a written explainer and a set of clips.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="/join" variant="cta" withArrow>
                Start watching free
              </Button>
              <Button href="/kol-network" variant="outline">
                Browse by faculty
              </Button>
            </div>
          </div>

          <FeaturedCarousel items={featured} />
        </div>
      </section>

      <LibraryBrowser items={items} />
    </>
  );
}
