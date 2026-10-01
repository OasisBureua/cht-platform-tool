import { useEffect, useState } from 'react';
import { Download, FileArchive } from 'lucide-react';
import { useStudioEngine, type SocialEngine, type SocialSlide } from '../../../components/admin/studio/engine';
import { creditFor, type Faculty } from '../../../components/admin/studio/faculty';
import { FacultyPicker, ImageChips, Section, Seg, SlideOps, Swatches, TextArea, TextField, UploadButton } from '../../../components/admin/studio/ui';
import { Stage, ViewSwitch } from '../../../components/admin/studio/stage';
import { useStageView } from '../../../components/admin/studio/stageView';

/**
 * Post-production › Social: the CHM Studio carousel builder with the
 * platform's controls. Slides, styles and exports are the studio's; the
 * faculty images come from the KOL network's cut-outs.
 */

type Meta = ReturnType<SocialEngine['meta']>;
const KINDS: [SocialSlide['kind'], string][] = [
  ['cover', 'Cover'],
  ['point', 'Point'],
  ['quote', 'Quote'],
  ['cta', 'Close'],
];
const MAX_IMAGES = 2;

export default function SocialStudio() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [slides, setSlides] = useState<SocialSlide[]>([]);
  const { ref, engine, onLoad, src } = useStudioEngine<SocialEngine>('social', (e) => {
    const m = e.meta();
    setMeta(m);
    setSlides(m.sample.map((s) => ({ ...s, unit: '', images: [] })));
  });
  const [style, setStyle] = useState('A');
  const [format, setFormat] = useState<'4x5' | '1x1'>('4x5');
  const [palette, setPalette] = useState<'disease' | 'v2'>('disease');
  const [area, setArea] = useState(0);
  const [grounds, setGrounds] = useState<Record<string, string>>({ Q: 'bright', P: 'v2' });
  const [current, setCurrent] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [view, setView] = useStageView('social');

  useEffect(() => {
    if (!engine || !slides.length) return undefined;
    let live = true;
    const t = window.setTimeout(() => {
      void engine.set({ style, format, palette, area, grounds, current, slides }).then(() => engine.thumbs(view === 'grid' ? 360 : 176)).then((th) => live && setThumbs(th));
    }, 60);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [engine, style, format, palette, area, grounds, current, slides, view]);

  const slide = slides[current];
  const edit = (patch: Partial<SocialSlide>) => setSlides((ss) => ss.map((s, i) => (i === current ? { ...s, ...patch } : s)));
  const pickFaculty = (f: Faculty) => {
    if (!slide) return;
    const has = slide.images.some((im) => im.url === f.url);
    const images = has ? slide.images.filter((im) => im.url !== f.url) : [...slide.images, { url: f.url, name: f.name }].slice(0, MAX_IMAGES);
    // the credit follows the faces unless someone has written their own
    const followed = !slide.credit || slide.credit === creditFor(slide.images.map((im) => im.name));
    edit({ images, credit: followed ? creditFor(images.map((im) => im.name)) : slide.credit });
  };
  const move = (d: -1 | 1) => {
    const j = current + d;
    setSlides((ss) => {
      const next = [...ss];
      [next[current], next[j]] = [next[j], next[current]];
      return next;
    });
    setCurrent(j);
  };

  const aspect = format === '4x5' ? 1080 / 1350 : 1;
  const groundOpts = meta?.grounds[style];
  const showArea = palette === 'disease' && !(style === 'P' && grounds.P === 'v2');

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[23rem_minmax(0,1fr)]">
      <aside className="card order-2 flex min-h-[24rem] flex-col overflow-hidden p-0 lg:sticky lg:top-4 lg:order-1 lg:h-[max(24rem,calc(100dvh-12.5rem))]">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <Section label="Style" hint={meta?.hints[style]}>
            <Seg label="Style" wrap value={style} options={Object.entries(meta?.styles ?? { A: 'Photo' }) as [string, string][]} onChange={setStyle} />
          </Section>
          <Section label="Format">
            <Seg label="Format" value={format} options={[['4x5', '4:5 · 1080×1350'], ['1x1', '1:1 · 1080×1080']]} onChange={setFormat} />
          </Section>
          <Section label="Colourway">
            <Seg label="Colourway" value={palette} options={[['disease', 'Disease states'], ['v2', 'Brand v2']]} onChange={setPalette} />
          </Section>
          {showArea && meta ? (
            <Section label="Disease state">
              <Swatches areas={meta.areas} value={area} onChange={setArea} />
            </Section>
          ) : null}
          {groundOpts ? (
            <Section label="Ground" hint={meta?.groundHints[style]}>
              <Seg label="Ground" value={grounds[style]} options={groundOpts} onChange={(g) => setGrounds((x) => ({ ...x, [style]: g }))} />
            </Section>
          ) : null}

        </div>
      </aside>

      <div className="order-1 min-w-0 lg:order-2">
        <Stage
          view={view}
          aspect={aspect}
          frameRef={ref}
          src={src}
          onLoad={onLoad}
          ready={!!engine && !!slides.length}
          label="Social slide preview"
          slides={{
            thumbs,
            current,
            count: slides.length,
            onPick: setCurrent,
            onAdd: () => {
              setSlides((ss) => [...ss, { kind: 'point', eyebrow: '', headline: 'New slide', body: '', credit: '', unit: '', images: [] }]);
              setCurrent(slides.length);
            },
          }}
          footer={
            <>
              <ViewSwitch view={view} onView={setView} />
              <span className="meta text-faint">
                {slides.length} slides · {format === '4x5' ? '1080 × 1350' : '1080 × 1080'}
              </span>
              <span className="ms-auto flex gap-2">
                <button type="button" disabled={!engine} onClick={() => engine?.exportSlide()} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-surface-2 px-3 text-body-s text-text disabled:opacity-40">
                  <Download className="size-4" aria-hidden /> This slide
                </button>
                <button type="button" disabled={!engine} onClick={() => engine?.exportZip()} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-anchor px-3 text-body-s font-medium text-ground disabled:opacity-40">
                  <FileArchive className="size-4" aria-hidden /> Carousel · ZIP
                </button>
              </span>
            </>
          }
        />
      </div>

      {/* the slide being edited, under the preview where there's room for its copy */}
      {slide ? (
        <section aria-label={`Slide ${current + 1}`} className="card order-3 space-y-4 p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="display text-body-l text-text">Slide {current + 1}</p>
            <div className="w-full max-w-[22rem]">
              <Seg label="Slide kind" value={slide.kind} options={KINDS} onChange={(kind) => edit({ kind })} />
            </div>
            <span className="ms-auto">
              <SlideOps
                index={current}
                count={slides.length}
                onMove={move}
                onDuplicate={() => {
                  setSlides((ss) => [...ss.slice(0, current + 1), { ...slide, images: [...slide.images] }, ...ss.slice(current + 1)]);
                  setCurrent(current + 1);
                }}
                onDelete={() => {
                  setSlides((ss) => ss.filter((_, i) => i !== current));
                  setCurrent(Math.max(0, current - 1));
                }}
              />
            </span>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <TextField label="Eyebrow" value={slide.eyebrow} onChange={(eyebrow) => edit({ eyebrow })} />
              <TextArea label="Headline" value={slide.headline} onChange={(headline) => edit({ headline })} rows={3} hint="[Square brackets] highlight a phrase; {braces} take the accent colour." />
              <TextArea label="Body" value={slide.body} onChange={(body) => edit({ body })} rows={6} />
              {style === 'N' ? <TextField label="Unit" value={slide.unit} onChange={(unit) => edit({ unit })} placeholder="MONTHS" /> : null}
            </div>
            <div className="space-y-4">
              <TextField label="Speaker credit" value={slide.credit} onChange={(credit) => edit({ credit })} placeholder="Dr. Komal Jhaveri" />
              <Section label={`Images · up to ${MAX_IMAGES}`} hint="Picking faculty writes the credit, so the faces always match the names.">
                <FacultyPicker picked={slide.images.map((im) => im.url)} onPick={pickFaculty} max={MAX_IMAGES} />
                <UploadButton max={MAX_IMAGES - slide.images.length} onImages={(ims) => edit({ images: [...slide.images, ...ims].slice(0, MAX_IMAGES) })} />
                <ImageChips images={slide.images} onRemove={(i) => edit({ images: slide.images.filter((_, k) => k !== i) })} />
              </Section>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
