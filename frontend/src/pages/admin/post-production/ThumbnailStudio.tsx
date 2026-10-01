import { useEffect, useMemo, useState } from 'react';
import { Download, Shuffle } from 'lucide-react';
import { useStudioEngine, type StudioImage, type ThumbEngine } from '../../../components/admin/studio/engine';
import { creditFor, FACULTY, type Faculty } from '../../../components/admin/studio/faculty';
import { FacultyPicker, ImageChips, Section, Seg, Swatches, TextArea, TextField, UploadButton } from '../../../components/admin/studio/ui';
import { AMBER_HINT, AMBERS, BACKDROP_HINT, BACKDROPS, type Amber, type Backdrop } from '../../../components/admin/studio/look';
import { Stage } from '../../../components/admin/studio/stage';

/**
 * Post-production › Thumbnails: the CHM Studio thumbnail generator with the
 * platform's controls. Faculty come from the KOL network's cut-outs, and
 * picking them writes the credit, so the faces always match the names.
 */

type Face = StudioImage & { stem?: string };
const MAX_FACES = 5;
const START = ['komal-jhaveri', 'aditya-bardia'];

export default function ThumbnailStudio() {
  const { ref, engine, onLoad, src } = useStudioEngine<ThumbEngine>('index');
  const [title, setTitle] = useState('Why first-line HER2+ therapy selection matters');
  const [palette, setPalette] = useState<'disease' | 'v2'>('disease');
  const [area, setArea] = useState(0);
  const [layout, setLayout] = useState('auto');
  const [hero, setHero] = useState('PFS');
  const [heroMode, setHeroMode] = useState<'fit' | 'stack'>('fit');
  const [backdrop, setBackdrop] = useState<Backdrop>('studio');
  const [amber, setAmber] = useState<Amber>('field');
  const [faces, setFaces] = useState<Face[]>(() =>
    START.map((s) => FACULTY.find((f) => f.stem === s)).filter(Boolean).map((f) => ({ url: f!.url, name: f!.name, stem: f!.stem, zoom: 1 })),
  );
  const [ownCredit, setOwnCredit] = useState<string | null>(null);
  const meta = useMemo(() => engine?.meta(), [engine]);

  // Auto is Side for one or two faces and Row from three, so say which it is rather than show a twin
  const layouts = ((meta?.layouts ?? [['auto', 'Auto']]) as [string, string][]).map(([v, name]): [string, string] => (v === 'auto' ? [v, `Auto · ${faces.length <= 2 ? 'Side' : 'Row'}`] : [v, name]));
  const autoCredit = creditFor(faces.filter((f) => f.stem).map((f) => f.name));
  const credit = ownCredit ?? autoCredit;

  useEffect(() => {
    if (!engine) return;
    void engine.set({ title, credit, palette, area, layout, hero, heroMode, backdrop, amber, faces: faces.map(({ url, name, zoom }) => ({ url, name, zoom })) });
  }, [engine, title, credit, palette, area, layout, hero, heroMode, backdrop, amber, faces]);

  const toggleFaculty = (f: Faculty) =>
    setFaces((fs) => (fs.some((x) => x.url === f.url) ? fs.filter((x) => x.url !== f.url) : [...fs, { url: f.url, name: f.name, stem: f.stem, zoom: 1 }].slice(0, MAX_FACES)));

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[23rem_minmax(0,1fr)]">
      <aside className="card order-2 flex min-h-[24rem] flex-col overflow-hidden p-0 lg:sticky lg:top-4 lg:order-1 lg:h-[max(24rem,calc(100dvh-12.5rem))]">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <TextArea label="Title" value={title} onChange={setTitle} rows={3} />

          <Section label={`Faculty · up to ${MAX_FACES}`} hint="Picking faculty writes the credit, so the faces always match the names.">
            <FacultyPicker picked={faces.map((f) => f.url)} onPick={toggleFaculty} max={MAX_FACES} />
            <UploadButton max={MAX_FACES - faces.length} label="Upload a headshot" onImages={(ims) => setFaces((fs) => [...fs, ...ims].slice(0, MAX_FACES))} />
            <ImageChips
              images={faces}
              onRemove={(i) => setFaces((fs) => fs.filter((_, k) => k !== i))}
              onZoom={(i, z) => setFaces((fs) => fs.map((f, k) => (k === i ? { ...f, zoom: z } : f)))}
            />
          </Section>

          <div className="space-y-1.5">
            <TextField label="Credit" value={credit} onChange={(v) => setOwnCredit(v)} placeholder="Drs. Name & Name" />
            {ownCredit !== null && autoCredit ? (
              <button type="button" onClick={() => setOwnCredit(null)} className="meta text-anchor hover:underline">
                Use the faculty names
              </button>
            ) : null}
          </div>

        </div>
      </aside>

      <div className="order-1 min-w-0 lg:order-2">
        <Stage
          view={null}
          aspect={16 / 9}
          frameRef={ref}
          src={src}
          onLoad={onLoad}
          ready={!!engine}
          label="Thumbnail preview"
          footer={
            <>
              <span className="meta ms-1 text-faint">1280 × 720 · drag a face in the preview to move it</span>
              <span className="ms-auto flex gap-2">
                <button type="button" disabled={!engine} onClick={() => engine?.regenerate()} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-surface-2 px-3 text-body-s text-text disabled:opacity-40">
                  <Shuffle className="size-4" aria-hidden /> New field
                </button>
                <button type="button" disabled={!engine} onClick={() => engine?.exportPng()} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-anchor px-3 text-body-s font-medium text-ground disabled:opacity-40">
                  <Download className="size-4" aria-hidden /> Export PNG
                </button>
              </span>
            </>
          }
        />
      </div>

      {/* the look: colour, layout and hero, under the preview so the content panel stays short */}
      <section aria-label="Look" className="card order-3 grid gap-5 p-4 md:grid-cols-2 lg:col-span-2 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-5">
          <Section label="Colourway">
            <Seg label="Colourway" value={palette} options={[['disease', 'Disease states'], ['v2', 'Brand v2']]} onChange={setPalette} />
          </Section>
          <Section label="Backdrop" hint={BACKDROP_HINT}>
            <Seg label="Backdrop" value={backdrop} options={BACKDROPS} onChange={setBackdrop} />
          </Section>
        </div>
        {palette === 'disease' && meta ? (
          <Section label="Disease state">
            <Swatches areas={meta.areas} value={area} onChange={setArea} />
          </Section>
        ) : (
          <Section label="Amber" hint={AMBER_HINT[amber]}>
            <Seg label="Amber" value={amber} options={AMBERS} onChange={setAmber} />
          </Section>
        )}
        <div className="space-y-5 md:col-span-2 xl:col-span-1">
          <Section label="Layout">
            <Seg label="Layout" wrap value={layout} options={layouts} onChange={setLayout} />
          </Section>
          {layout === 'bigword' ? (
            <Section label="Hero term">
              <TextField label="Term" value={hero} onChange={setHero} />
              <Seg label="Hero style" value={heroMode} options={[['fit', 'Overlap'], ['stack', 'Stacked']]} onChange={setHeroMode} />
            </Section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
