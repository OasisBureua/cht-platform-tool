import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Download, Loader2, Settings2 } from 'lucide-react';
import { formatTime, slugify, type Clip, type Cue } from './clipperCore';
import { drawCutFrame, OUT_SIZE, renderCut, type Aspect, type CutFormat } from './socialCut';
import type { Source } from './sources';

/**
 * How clips come out: shape, framing, captions, logo and pauses, with a
 * live preview beside the video and real-time renders of the social cut.
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
const SPOTS: [number, string][] = [
  [0.2, 'Left'],
  [0.5, 'Centre'],
  [0.8, 'Right'],
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
  time,
  playing,
  onOpen,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  format: CutFormat;
  cues: Cue[];
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
      if (ctx && v) drawCutFrame(ctx, v, format, cues, v.currentTime);
      if (playing) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, format, cues, playing, time]);

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

export function OutputPanel({
  format,
  onChange,
  cues,
  clips,
  selectedId,
  source,
  colors,
}: {
  format: CutFormat;
  onChange: (patch: Partial<CutFormat>) => void;
  cues: Cue[];
  clips: Clip[];
  selectedId: string | null;
  source: Source;
  colors: string[];
}) {
  const [progress, setProgress] = useState<Record<string, number | 'error'>>({});
  const busy = Object.values(progress).some((p) => typeof p === 'number');
  const speakers = useMemo(() => [...new Set(cues.map((c) => c.speaker).filter(Boolean) as string[])].slice(0, 6), [cues]);
  const selected = clips.find((c) => c.id === selectedId) ?? null;

  const cut = async (c: Clip) => {
    if (source.kind !== 'local') return;
    setProgress((p) => ({ ...p, [c.id]: 0 }));
    try {
      const blob = await renderCut(source.url, c, format, cues, (v) => setProgress((p) => ({ ...p, [c.id]: v })));
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const n = String(clips.indexOf(c) + 1).padStart(2, '0');
      downloadBlob(`${slugify(source.title)}-${n}-${slugify(c.title)}-${format.aspect.replace(':', 'x')}.${ext}`, blob);
      setProgress((p) => {
        const next = { ...p };
        delete next[c.id];
        return next;
      });
    } catch {
      setProgress((p) => ({ ...p, [c.id]: 'error' }));
    }
  };
  const cutAll = async () => {
    for (const c of clips) await cut(c);
  };

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
              <div className="space-y-2 rounded-[10px] bg-surface-2/60 p-2.5">
                <p className="text-xs text-muted2">Where each person sits in the recording</p>
                {speakers.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-xs text-text" title={s}>
                      {s}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Seg label={`${s} position`} value={format.positions[s] ?? 0.5} options={SPOTS} onChange={(x) => onChange({ positions: { ...format.positions, [s]: x } })} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted2">Add a transcript with speaker names and the crop will follow whoever is talking.</p>
            )
          ) : null}
        </section>

        <section className="space-y-2">
          <p className="meta text-faint">Captions</p>
          <Seg label="Captions" value={format.captions} options={CAPTIONS} onChange={(captions) => onChange({ captions })} disabled={!cues.length} />
          <p className="text-xs text-muted2">{cues.length ? 'From the transcript, a few words at a time.' : 'Captions come from the transcript; add one first.'}</p>
        </section>

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
            the recording and open it from your computer.
          </p>
        )}
      </div>
    </div>
  );
}
