import { useEffect, useState } from 'react';
import { Download, FileArchive, FileText, Plus } from 'lucide-react';
import { useStudioEngine, type DeckEngine, type DeckSlide } from '../../../components/admin/studio/engine';
import { ImageChips, Section, SlideOps, TextArea, TextField, UploadButton } from '../../../components/admin/studio/ui';
import { Stage, ViewSwitch } from '../../../components/admin/studio/stage';
import { useStageView } from '../../../components/admin/studio/stageView';

/**
 * Post-production › Deck: the CHM Studio deck builder (brand v2, 1920×1080)
 * with the platform's controls. The slide types and their fields come from
 * the studio itself, so a new template there shows up here as a form.
 */

type Meta = ReturnType<DeckEngine['meta']>;

export default function DeckStudio() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [title, setTitle] = useState('2026 Capabilities');
  const [slides, setSlides] = useState<DeckSlide[]>([]);
  const { ref, engine, onLoad, src } = useStudioEngine<DeckEngine>('deck', (e) => {
    const m = e.meta();
    setMeta(m);
    setTitle(m.title);
    setSlides(m.sample.map((s) => ({ ...s, images: [] })));
  });
  const [current, setCurrent] = useState(0);
  const [addType, setAddType] = useState('numbered');
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [view, setView] = useStageView('deck');

  useEffect(() => {
    if (!engine || !slides.length) return undefined;
    let live = true;
    const t = window.setTimeout(() => {
      void engine.set({ title, current, slides }).then(() => engine.thumbs(view === 'grid' ? 480 : 220)).then((th) => live && setThumbs(th));
    }, 60);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [engine, title, current, slides, view]);

  const slide = slides[current];
  const type = slide && meta ? meta.types[slide.type] : null;
  const edit = (patch: Partial<DeckSlide>) => setSlides((ss) => ss.map((s, i) => (i === current ? { ...s, ...patch } : s)));
  const max = type?.images ?? 0;
  const move = (d: -1 | 1) => {
    const j = current + d;
    setSlides((ss) => {
      const next = [...ss];
      [next[current], next[j]] = [next[j], next[current]];
      return next;
    });
    setCurrent(j);
  };
  const add = () => {
    const base = meta?.sample.find((s) => s.type === addType) ?? { type: addType };
    setSlides((ss) => [...ss.slice(0, current + 1), { ...base, images: [] } as DeckSlide, ...ss.slice(current + 1)]);
    setCurrent(current + 1);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[23rem_minmax(0,1fr)]">
      <aside className="card order-2 flex min-h-[24rem] flex-col overflow-hidden p-0 lg:sticky lg:top-4 lg:order-1 lg:h-[max(24rem,calc(100dvh-12.5rem))]">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <TextField label="Deck" value={title} onChange={setTitle} />

          <Section label="Add a slide">
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Slide type</span>
                <select value={addType} onChange={(e) => setAddType(e.target.value)} className="h-10 w-full rounded-[8px] bg-surface-2 px-2.5 text-body-s text-text">
                  {Object.entries(meta?.types ?? {}).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={add} disabled={!meta} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-surface-2 px-3 text-body-s text-text disabled:opacity-40">
                <Plus className="size-4" aria-hidden /> Add
              </button>
            </div>
          </Section>

          {slide && type ? (
            <div className="space-y-4 border-t border-hairline pt-4">
              <div className="space-y-1.5">
                <p className="display text-body-l text-text">
                  {current + 1} · {type.name}
                </p>
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
              </div>
              {type.fields.map(([key, label, kind]) =>
                kind === 'text' ? (
                  <TextField key={key} label={label} value={String(slide[key] ?? '')} onChange={(v) => edit({ [key]: v })} />
                ) : (
                  <TextArea key={key} label={label} value={String(slide[key] ?? '')} onChange={(v) => edit({ [key]: v })} rows={kind === 'lines' ? 6 : 3} />
                ),
              )}
              {max > 0 ? (
                <Section label={max === 1 ? 'Image' : `Images · up to ${max}`}>
                  <UploadButton max={max - slide.images.length} onImages={(ims) => edit({ images: [...slide.images, ...ims].slice(0, max) })} />
                  <ImageChips images={slide.images} onRemove={(i) => edit({ images: slide.images.filter((_, k) => k !== i) })} />
                </Section>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>

      <div className="order-1 min-w-0 lg:order-2">
        <Stage
          view={view}
          aspect={16 / 9}
          frameRef={ref}
          src={src}
          onLoad={onLoad}
          ready={!!engine && !!slides.length}
          label="Deck slide preview"
          slides={{ thumbs, current, count: slides.length, onPick: setCurrent, onAdd: add }}
          footer={
            <>
              <ViewSwitch view={view} onView={setView} />
              <span className="meta text-faint">{slides.length} slides · 1920 × 1080</span>
              <span className="ms-auto flex flex-wrap gap-2">
                <button type="button" disabled={!engine} onClick={() => engine?.exportSlide()} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-surface-2 px-3 text-body-s text-text disabled:opacity-40">
                  <Download className="size-4" aria-hidden /> This slide
                </button>
                <button type="button" disabled={!engine} onClick={() => engine?.exportZip()} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-surface-2 px-3 text-body-s text-text disabled:opacity-40">
                  <FileArchive className="size-4" aria-hidden /> ZIP
                </button>
                <button type="button" disabled={!engine} onClick={() => engine?.exportPdf()} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-anchor px-3 text-body-s font-medium text-ground disabled:opacity-40">
                  <FileText className="size-4" aria-hidden /> PDF
                </button>
              </span>
            </>
          }
        />
      </div>
    </div>
  );
}
