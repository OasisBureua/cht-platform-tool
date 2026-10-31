import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowDown, ArrowUp, Captions, Crosshair, Download, Film, Loader2, Settings2 } from 'lucide-react';
import type { PostProductionCapabilities } from '../../../api/postProduction';
import { cuesToSrt, formatTime, slugify, speakersOf, speakerSpots, type Clip, type Cue } from './clipperCore';
import { clipAt, drawCutFrame, OUT_SIZE, outputCues, renderSequence, type Aspect, type CutFormat } from './socialCut';
import type { Source } from './sources';
import { LookPanel } from './LookPanel';
import { ThumbnailMaker } from './ThumbnailMaker';
import { logClipper } from './clipperLog';

/**
 * How clips come out: shape, framing, captions, title, style and logo,
 * with a live preview beside the video and real-time renders of the
 * social cut, a caption file beside each render, a thumbnail maker and a
 * sizzle reel that strings clips together.
 */

const ASPECTS: [Aspect, string, string][] = [
  ['9:16', '9:16', 'TikTok, Reels, Shorts'],
  ['1:1', '1:1', 'Feed'],
  ['16:9', '16:9', 'Original'],
];
const FRAMINGS: [CutFormat['framing'], string, string][] = [
  ['speaker', 'Speaker focus', 'Crops to whoever is talking.'],
  ['stacked', 'Stacked', 'Both hosts, one above the other.'],
  ['full', 'Full frame', 'The whole picture over a soft fill.'],
];
const CAPTIONS: [CutFormat['captions'], string][] = [
  ['karaoke', 'Karaoke'],
  ['burned', 'Burned in'],
  ['off', 'Off'],
];

const isOriginal = (f: CutFormat) => f.aspect === '16:9' && f.framing === 'full' && f.captions === 'off' && !f.logo;
const describe = (f: CutFormat) =>
  [f.aspect, FRAMINGS.find(([v]) => v === f.framing)?.[1].toLowerCase(), f.captions === 'off' ? null : f.captions === 'karaoke' ? 'karaoke' : 'captions', f.logo ? 'logo' : null]
    .filter(Boolean)
    .join(' · ');

function Seg<T extends string | number>({ value, options, onChange, label, disabled }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string; disabled?: boolean }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-[9px] bg-surface-2 p-1">
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={value === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={[
            'h-8 min-w-0 flex-1 truncate rounded-[7px] px-2 text-xs transition-colors disabled:opacity-40',
            value === v ? 'bg-surface font-medium text-text shadow-card' : 'text-muted2 hover:text-text',
          ].join(' ')}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Switch({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="flex w-full items-start gap-3 text-left disabled:opacity-40">
      <span className={['mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-anchor' : 'bg-hairline-strong'].join(' ')}>
        <span className={['size-4 rounded-full bg-surface shadow transition-transform duration-150', on ? 'translate-x-4' : ''].join(' ')} />
      </span>
      <span className="min-w-0">
        <span className="block text-body-s text-text">{label}</span>
        {hint ? <span className="block text-xs text-muted2">{hint}</span> : null}
      </span>
    </button>
  );
}


/** The output as it will look, drawn live from the player. */
export function CutPreview({
  videoRef,
  format,
  cues,
  clips,
  selectedId,
  time,
  playing,
  onOpen,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  format: CutFormat;
  cues: Cue[];
  clips: Clip[];
  selectedId: string | null;
  time: number;
  playing: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, h] = OUT_SIZE[format.aspect].map((n) => Math.round(n / 3));

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current, v = videoRef.current;
      const ctx = c?.getContext('2d');
      if (ctx && v) {
        const t = v.currentTime;
        const clip = clipAt(clips, selectedId, t);
        drawCutFrame(ctx, v, format, cues, t, clip ? { look: clip.look, title: clip.openingTitle ?? clip.title, elapsed: t - clip.start, cutStart: clip.start } : {});
      }
      if (playing) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, format, cues, clips, selectedId, playing, time]);

  if (isOriginal(format)) return null;
  const height = format.aspect === '9:16' ? 'h-[min(54vh,32rem)]' : format.aspect === '1:1' ? 'h-[min(40vh,20rem)]' : 'h-[11rem]';
  return (
    <figure className="flex shrink-0 flex-col items-center gap-2">
      <canvas ref={ref} width={w} height={h} className={[height, 'w-auto rounded-[16px] bg-[#0b1116] shadow-card ring-1 ring-hairline'].join(' ')} aria-label={`Output preview, ${describe(format)}`} />
      <figcaption className="flex items-center gap-1.5">
        <span className="meta text-faint">{describe(format)}</span>
        <button type="button" onClick={onOpen} aria-label="Output settings" className="grid size-7 place-items-center rounded-[6px] text-dim hover:bg-surface-2 hover:text-text">
          <Settings2 className="size-3.5" aria-hidden />
        </button>
      </figcaption>
    </figure>
  );
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const REEL = '__reel__';

export function OutputPanel({
  format,
  onChange,
  cues,
  clips,
  selectedId,
  source,
  colors,
  videoRef,
  caps,
  placing,
  onPlace,
  onUpdateClip,
  onSeek,
}: {
  format: CutFormat;
  onChange: (patch: Partial<CutFormat>) => void;
  cues: Cue[];
  clips: Clip[];
  selectedId: string | null;
  source: Source;
  colors: string[];
  videoRef: RefObject<HTMLVideoElement | null>;
  caps: PostProductionCapabilities | undefined;
  placing: string | null;
  onPlace: (speaker: string | null) => void;
  onUpdateClip: (id: string, patch: Partial<Clip>) => void;
  onSeek: (t: number) => void;
}) {
  const [progress, setProgress] = useState<Record<string, number | 'error'>>({});
  const [reel, setReel] = useState<string[]>([]);
  const busy = Object.values(progress).some((p) => typeof p === 'number');
  const speakers = useMemo(() => speakersOf(cues).slice(0, 6), [cues]);
  const spots = useMemo(() => speakerSpots(cues, format.positions), [cues, format.positions]);
  const selected = clips.find((c) => c.id === selectedId) ?? null;
  const base = slugify(source.title);
  const shape = format.aspect.replace(':', 'x');

  const saveCaptions = (name: string, list: Clip[]) => {
    const lines = outputCues(list, format, cues);
    if (lines.length) downloadBlob(`${name}.srt`, new Blob([cuesToSrt(lines)], { type: 'application/x-subrip' }));
  };

  const run = async (key: string, list: Clip[], name: string) => {
    if (source.kind !== 'local' || !list.length) return;
    setProgress((p) => ({ ...p, [key]: 0 }));
    try {
      const blob = await renderSequence(source.url, list, format, cues, (v) => setProgress((p) => ({ ...p, [key]: v })));
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(`${name}.${ext}`, blob);
      if (format.captionFile && cues.length) saveCaptions(name, list);
      setProgress((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    } catch (err) {
      setProgress((p) => ({ ...p, [key]: 'error' }));
      logClipper('render-cut', err, { clips: list.map((c) => c.title), format, source: source.fileName });
    }
  };
  const nameOf = (c: Clip) => `${base}-${String(clips.indexOf(c) + 1).padStart(2, '0')}-${slugify(c.title)}-${shape}`;
  const cut = (c: Clip) => run(c.id, [c], nameOf(c));
  const cutAll = async () => {
    for (const c of clips) await cut(c);
  };
  // the reel keeps its own order; deleted clips just drop out of it
  const reelClips = reel.map((id) => clips.find((c) => c.id === id)).filter(Boolean) as Clip[];
  const reelIds = reelClips.map((c) => c.id);
  const move = (i: number, d: -1 | 1) =>
    setReel(() => {
      const r = reelIds;
      const n = [...r];
      const j = i + d;
      if (j < 0 || j >= n.length) return r;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section className="space-y-2">
          <p className="meta text-faint">Shape</p>
          <Seg label="Shape" value={format.aspect} options={ASPECTS.map(([v, t]) => [v, t])} onChange={(aspect) => onChange({ aspect })} />
          <p className="text-xs text-muted2">{ASPECTS.find(([v]) => v === format.aspect)?.[2]}</p>
        </section>

        <section className="space-y-2">
          <p className="meta text-faint">Framing</p>
          <Seg label="Framing" value={format.framing} options={FRAMINGS.map(([v, t]) => [v, t])} onChange={(framing) => onChange({ framing })} />
          <p className="text-xs text-muted2">{FRAMINGS.find(([v]) => v === format.framing)?.[2]}</p>
          {format.framing === 'speaker' ? (
            speakers.length ? (
              <div className="space-y-1.5 rounded-[10px] bg-surface-2/60 p-2.5">
                <p className="text-xs text-muted2">Click a name, then click on that person in the picture. The crop holds through pauses and glides between speakers.</p>
                {speakers.map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
                    <span className="min-w-0 flex-1 truncate text-xs text-text" title={s}>
                      {s}
                    </span>
                    <span className="meta tabular-nums text-faint">{format.positions[s] != null ? `${Math.round(spots[s] * 100)}%` : `auto ${Math.round(spots[s] * 100)}%`}</span>
                    <button
                      type="button"
                      aria-pressed={placing === s}
                      onClick={() => onPlace(placing === s ? null : s)}
                      className={['inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-xs', placing === s ? 'bg-anchor text-ground' : 'bg-surface text-dim hover:text-text'].join(' ')}
                    >
                      <Crosshair className="size-3.5" aria-hidden /> {placing === s ? 'Click the picture' : 'Place'}
                    </button>
                  </div>
                ))}
                {Object.keys(format.positions).length ? (
                  <button type="button" onClick={() => onChange({ positions: {} })} className="meta text-anchor hover:underline">
                    Reset to automatic
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted2">Speaker focus needs a transcript with speakers. Add one, or generate it from the audio in the Transcript tab.</p>
            )
          ) : null}
        </section>

        <section className="space-y-2">
          <p className="meta text-faint">Captions</p>
          <Seg label="Captions" value={format.captions} options={CAPTIONS} onChange={(captions) => onChange({ captions })} disabled={!cues.length} />
          {cues.length ? (
            <>
              <p className="text-xs text-muted2">Drawn from the transcript, a few words at a time.</p>
              <Switch on={format.captionFile} onChange={(captionFile) => onChange({ captionFile })} label="Save a caption file (.srt)" hint="Closed captions viewers can turn on and off on YouTube, LinkedIn and Meta. Timed to the render." />
              {selected ? (
                <button type="button" onClick={() => saveCaptions(nameOf(selected), [selected])} className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-surface-2 px-2.5 text-xs text-dim hover:text-text">
                  <Captions className="size-3.5" aria-hidden /> Download captions for this clip
                </button>
              ) : null}
            </>
          ) : (
            <p className="rounded-[8px] bg-amber-400/15 px-2.5 py-2 text-xs text-text">No transcript, so no captions. Add a .vtt or .srt, or generate one from the audio in the Transcript tab.</p>
          )}
        </section>

        <section className="space-y-2">
          <Switch on={format.title} onChange={(title) => onChange({ title })} label="Opening title" hint="Over the first two seconds, then it fades. Each clip has its own." />
          {format.title && selected ? (
            <label className="block">
              <span className="meta text-faint">Title for “{selected.title}”</span>
              <input
                value={selected.openingTitle ?? selected.title}
                onChange={(e) => onUpdateClip(selected.id, { openingTitle: e.target.value })}
                className="mt-1 h-9 w-full rounded-[6px] bg-surface-2 px-2.5 text-body-s text-text outline-none focus-visible:ring-2 focus-visible:ring-anchor/40"
              />
              <span className="text-xs text-muted2">[Square brackets] turn a phrase amber.</span>
            </label>
          ) : format.title ? (
            <p className="text-xs text-muted2">Select a clip to write its title.</p>
          ) : null}
        </section>

        <LookPanel format={format} onChange={onChange} clip={selected} cues={cues} caps={caps} onUpdateClip={onUpdateClip} />

        <section className="space-y-3">
          <Switch on={format.logo} onChange={(logo) => onChange({ logo })} label="CHM logo" hint="Top left, over the picture." />
          <Switch
            on={format.tighten}
            onChange={(tighten) => onChange({ tighten })}
            label="Cut filler lines and pauses"
            hint={cues.length ? 'Drops lines that are only “um” and “uh”, and closes gaps over 0.6s.' : 'Needs the transcript.'}
            disabled={!cues.length}
          />
        </section>

        {selected ? (
          <ThumbnailMaker videoRef={videoRef} clip={selected} cues={cues} format={format} sourceTitle={source.title} canExport={source.kind === 'local'} onSeek={onSeek} />
        ) : (
          <section className="space-y-1">
            <p className="meta text-faint">Thumbnail</p>
            <p className="text-xs text-muted2">Select a clip to make its thumbnail.</p>
          </section>
        )}

        <section className="space-y-2">
          <p className="meta text-faint">Sizzle reel</p>
          <p className="text-xs text-muted2">Tick clips to string them into one cut, each with its own title and a quick dip to black between.</p>
          {clips.length ? (
            <ul className="space-y-1">
              {clips.map((c, i) => {
                const at = reelIds.indexOf(c.id);
                return (
                  <li key={c.id} className="flex items-center gap-2">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs text-text">
                      <input
                        type="checkbox"
                        checked={at >= 0}
                        onChange={(e) => setReel((r) => (e.target.checked ? [...r, c.id] : r.filter((id) => id !== c.id)))}
                        className="size-4 accent-[var(--color-anchor,#2eaacc)]"
                      />
                      <span className="size-2 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
                      <span className="truncate">{c.title}</span>
                    </label>
                    {at >= 0 ? (
                      <span className="flex items-center gap-0.5">
                        <span className="meta w-4 text-center tabular-nums text-faint">{at + 1}</span>
                        <button type="button" onClick={() => move(at, -1)} disabled={at === 0} aria-label={`Move ${c.title} earlier`} className="grid size-6 place-items-center rounded-[5px] text-dim hover:bg-surface-2 disabled:opacity-30">
                          <ArrowUp className="size-3.5" aria-hidden />
                        </button>
                        <button type="button" onClick={() => move(at, 1)} disabled={at === reelIds.length - 1} aria-label={`Move ${c.title} later`} className="grid size-6 place-items-center rounded-[5px] text-dim hover:bg-surface-2 disabled:opacity-30">
                          <ArrowDown className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted2">Add clips first.</p>
          )}
          {source.kind === 'local' ? (
            <button
              type="button"
              disabled={reelClips.length < 2 || busy}
              onClick={() => void run(REEL, reelClips, `${base}-sizzle-${shape}`)}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] bg-surface-2 px-3 text-xs font-medium text-text disabled:opacity-40"
            >
              {progress[REEL] !== undefined && progress[REEL] !== 'error' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Film className="size-3.5" aria-hidden />}
              {progress[REEL] !== undefined && progress[REEL] !== 'error'
                ? `Rendering reel ${Math.round((progress[REEL] as number) * 100)}%`
                : `Render sizzle reel${reelClips.length > 1 ? ` · ${formatTime(reelClips.reduce((s, c) => s + c.end - c.start, 0), 0)}` : ''}`}
            </button>
          ) : null}
          {progress[REEL] === 'error' ? <p className="text-xs text-dim">The reel didn’t render. It’s been logged; try fewer clips.</p> : null}
        </section>
      </div>

      <div className="space-y-2 border-t border-hairline p-3">
        {source.kind === 'local' ? (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!selected || busy}
                onClick={() => selected && void cut(selected)}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-surface-2 px-3 text-xs font-medium text-text disabled:opacity-40"
              >
                <Download className="size-3.5" aria-hidden /> {selected ? 'Render this clip' : 'Select a clip'}
              </button>
              <button
                type="button"
                disabled={!clips.length || busy}
                onClick={() => void cutAll()}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-anchor px-3 text-xs font-medium text-ground disabled:opacity-40"
              >
                <Download className="size-3.5" aria-hidden /> Render all {clips.length || ''}
              </button>
            </div>
            {clips.some((c) => progress[c.id] !== undefined) ? (
              <ul className="space-y-1">
                {clips.map((c, i) =>
                  progress[c.id] === undefined ? null : (
                    <li key={c.id} className="flex items-center gap-2 text-xs text-dim">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      {progress[c.id] === 'error' ? (
                        <span className="text-dim">Didn't render</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 tabular-nums text-anchor">
                          <Loader2 className="size-3 animate-spin" aria-hidden /> {Math.round((progress[c.id] as number) * 100)}%
                        </span>
                      )}
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p className="text-xs leading-snug text-muted2">
                Renders play in real time in this tab, so a {formatTime(selected ? selected.end - selected.start : 45, 0)} clip takes about that long.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs leading-snug text-muted2">
            Zoom recordings play from storage that won't let the browser record them. The preview works; to render, download
            the recording and open it from your computer or Dropbox.
          </p>
        )}
      </div>
    </div>
  );
}
