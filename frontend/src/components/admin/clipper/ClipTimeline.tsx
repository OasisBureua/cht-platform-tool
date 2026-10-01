import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Captions, Film, Minus, Plus, Scissors } from 'lucide-react';
import { formatTime, type Clip, type Cue } from './clipperCore';
import type { Thumb } from './useMediaPreview';

/**
 * The clipper's timeline, in lanes like an editor's: frames, the clips,
 * the captions and the sound, under one playhead. It zooms in for long
 * recordings, and the selected clip's edges drag to trim.
 */

const ZOOMS = [1, 2, 4, 8, 16, 32];
const H = { ruler: 22, film: 52, clip: 26, caption: 26, audio: 34 };

export function ClipTimeline({
  duration,
  time,
  clips,
  colors,
  selectedId,
  markIn,
  markOut,
  cues,
  thumbs,
  peaks,
  onSeek,
  onSelect,
  onTrim,
}: {
  duration: number;
  time: number;
  clips: Clip[];
  colors: string[];
  selectedId: string | null;
  markIn: number | null;
  markOut: number | null;
  cues: Cue[];
  thumbs: Thumb[];
  peaks: number[] | null;
  onSeek: (t: number) => void;
  onSelect: (id: string) => void;
  onTrim: (id: string, edge: 'start' | 'end', t: number) => void;
}) {
  const [zi, setZi] = useState(0);
  const zoom = ZOOMS[zi];
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(800);
  const drag = useRef<null | { kind: 'seek' } | { kind: 'trim'; id: string; edge: 'start' | 'end' }>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const d = duration > 0 ? duration : 1;
  const pct = (t: number) => `${(Math.min(Math.max(t, 0), d) / d) * 100}%`;
  const timeAt = (clientX: number) => {
    const r = innerRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return 0;
    return Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * d;
  };

  // Keep the playhead in view while zoomed in.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || zoom === 1) return;
    const x = (time / d) * el.scrollWidth;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.3);
  }, [time, zoom, d]);

  const lanes = useMemo(() => {
    const ends: number[] = [];
    const lane = new Map<string, number>();
    [...clips].sort((a, b) => a.start - b.start).forEach((c) => {
      let i = ends.findIndex((e) => e <= c.start);
      if (i < 0) {
        i = ends.length;
        ends.push(0);
      }
      ends[i] = c.end;
      lane.set(c.id, i);
    });
    return { lane, count: Math.max(1, ends.length) };
  }, [clips]);

  const ticks = useMemo(() => {
    const pxPerSec = (viewW * zoom) / d;
    const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
    const step = steps.find((s) => s * pxPerSec >= 84) ?? 3600;
    return Array.from({ length: Math.floor(d / step) + 1 }, (_, i) => i * step);
  }, [viewW, zoom, d]);

  const clipH = lanes.count * (H.clip + 4) + 6;
  const total = H.ruler + H.film + clipH + H.caption + H.audio + 4 * 4;
  const top = { film: H.ruler + 4, clips: H.ruler + H.film + 8 };
  const capTop = top.clips + clipH + 4;
  const audioTop = capTop + H.caption + 4;
  const span = thumbs.length ? d / thumbs.length : 0;
  const pending = markIn != null ? { from: markIn, to: markOut ?? time } : null;

  const labels: [number, number, typeof Film, string][] = [
    [top.film, H.film, Film, 'Frames'],
    [top.clips, clipH, Scissors, 'Clips'],
    [capTop, H.caption, Captions, 'Captions'],
    [audioTop, H.audio, AudioLines, peaks ? 'Sound' : 'Speech'],
  ];

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="meta text-faint">Timeline</span>
        <span className="meta tabular-nums text-dim">
          {formatTime(time)} <span className="text-faint">/ {formatTime(duration)}</span>
        </span>
        <span className="ms-auto flex items-center gap-1">
          <button type="button" onClick={() => setZi((z) => Math.max(0, z - 1))} disabled={zi === 0} aria-label="Zoom out" className="grid size-8 place-items-center rounded-[6px] text-dim hover:bg-surface-2 disabled:opacity-40">
            <Minus className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => setZi(0)} className="meta h-8 min-w-[3.5rem] rounded-[6px] px-2 tabular-nums text-dim hover:bg-surface-2">
            {zoom === 1 ? 'Fit' : `${zoom}×`}
          </button>
          <button type="button" onClick={() => setZi((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zi === ZOOMS.length - 1} aria-label="Zoom in" className="grid size-8 place-items-center rounded-[6px] text-dim hover:bg-surface-2 disabled:opacity-40">
            <Plus className="size-4" aria-hidden />
          </button>
        </span>
      </div>

      <div className="flex gap-2">
        <div className="relative w-6 shrink-0" style={{ height: total }} aria-hidden>
          {labels.map(([y, h, Icon, label]) => (
            <span key={label} title={label} className="absolute inset-x-0 grid place-items-center text-faint" style={{ top: y, height: h }}>
              <Icon className="size-3.5" />
            </span>
          ))}
        </div>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-[10px] bg-surface-2 [scrollbar-width:thin]">
          <div
            ref={innerRef}
            className="relative cursor-text select-none touch-none"
            style={{ width: `${zoom * 100}%`, height: total }}
            onPointerDown={(e) => {
              drag.current = { kind: 'seek' };
              e.currentTarget.setPointerCapture(e.pointerId);
              onSeek(timeAt(e.clientX));
            }}
            onPointerMove={(e) => {
              const g = drag.current;
              if (!g || !(e.buttons & 1)) return;
              const t = timeAt(e.clientX);
              if (g.kind === 'seek') onSeek(t);
              else onTrim(g.id, g.edge, t);
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            {/* ruler */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Playhead"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(time)}
              aria-valuetext={formatTime(time)}
              className="absolute inset-x-0 top-0 border-b border-hairline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
              style={{ height: H.ruler }}
            >
              {ticks.map((t, i) => (
                <span key={t} className="absolute top-0 h-full border-s border-hairline" style={{ left: pct(t) }}>
                  <span className={['meta absolute top-1 whitespace-nowrap px-1 tabular-nums text-faint', i === 0 ? '' : t >= d - 1 ? '-translate-x-full' : ''].join(' ')}>
                    {formatTime(t, 0)}
                  </span>
                </span>
              ))}
            </div>

            {/* frames */}
            <div className="absolute inset-x-0 overflow-hidden" style={{ top: top.film, height: H.film }}>
              {thumbs.length ? (
                thumbs.map((th) => (
                  <img
                    key={th.t}
                    src={th.url}
                    alt=""
                    draggable={false}
                    className="absolute top-0 h-full object-cover"
                    style={{ left: pct(th.t - span / 2), width: `calc(${pct(span)} + 1px)` }}
                  />
                ))
              ) : (
                <div className="h-full bg-[repeating-linear-gradient(90deg,hsl(var(--text)/0.05)_0_1px,transparent_1px_64px)]" />
              )}
              <div className="pointer-events-none absolute inset-0 bg-black/10" />
            </div>

            {/* pending in/out */}
            {pending ? (
              <span
                className="pointer-events-none absolute bg-anchor/15 ring-1 ring-inset ring-anchor/60"
                style={{ top: top.film, height: total - top.film, left: pct(Math.min(pending.from, pending.to)), width: pct(Math.abs(pending.to - pending.from)) }}
              />
            ) : null}

            {/* clips */}
            {clips.map((c, i) => {
              const sel = c.id === selectedId;
              const color = colors[i % colors.length];
              return (
                <div
                  key={c.id}
                  className={['absolute flex items-center overflow-hidden rounded-[6px] text-[11px] font-medium text-white', sel ? 'z-10 ring-2 ring-text ring-offset-1 ring-offset-surface-2' : ''].join(' ')}
                  style={{
                    top: top.clips + 4 + (lanes.lane.get(c.id) ?? 0) * (H.clip + 4),
                    height: H.clip,
                    left: pct(c.start),
                    width: pct(c.end - c.start),
                    minWidth: 4,
                    background: color,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelect(c.id);
                  }}
                  title={`${i + 1}. ${c.title} (${formatTime(c.start)}–${formatTime(c.end)})`}
                >
                  {sel ? (
                    <span
                      role="presentation"
                      className="absolute inset-y-0 start-0 z-10 w-2 cursor-ew-resize bg-black/25 after:absolute after:inset-y-1.5 after:start-[3px] after:w-px after:bg-white/80"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        drag.current = { kind: 'trim', id: c.id, edge: 'start' };
                        innerRef.current?.setPointerCapture(e.pointerId);
                      }}
                    />
                  ) : null}
                  <span className="truncate px-2.5">
                    <span className="tabular-nums opacity-80">{i + 1}</span> {c.title}
                  </span>
                  {sel ? (
                    <span
                      role="presentation"
                      className="absolute inset-y-0 end-0 z-10 w-2 cursor-ew-resize bg-black/25 after:absolute after:inset-y-1.5 after:end-[3px] after:w-px after:bg-white/80"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        drag.current = { kind: 'trim', id: c.id, edge: 'end' };
                        innerRef.current?.setPointerCapture(e.pointerId);
                      }}
                    />
                  ) : null}
                </div>
              );
            })}

            {/* captions */}
            <div className="absolute inset-x-0" style={{ top: capTop, height: H.caption }}>
              {cues.map((c, i) => (
                <span
                  key={i}
                  title={`${c.speaker ? `${c.speaker}: ` : ''}${c.text}`}
                  className="absolute top-0 h-full overflow-hidden rounded-[4px] border border-hairline bg-surface px-1 text-[10px] leading-[24px] text-dim"
                  style={{ left: pct(c.start), width: pct(c.end - c.start) }}
                >
                  <span className="block truncate">{c.text}</span>
                </span>
              ))}
            </div>

            {/* sound, or where people spoke */}
            <div className="absolute inset-x-0" style={{ top: audioTop, height: H.audio }}>
              {peaks ? (
                <svg viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none" className="h-full w-full text-anchor/70" aria-hidden>
                  <path
                    fill="currentColor"
                    d={
                      peaks.map((p, i) => `M${i} ${50 - Math.max(2, p * 48)}h0.8V${50 + Math.max(2, p * 48)}h-0.8Z`).join('')
                    }
                  />
                </svg>
              ) : (
                cues.map((c, i) => (
                  <span key={i} className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-anchor/35" style={{ left: pct(c.start), width: pct(c.end - c.start) }} />
                ))
              )}
            </div>

            {/* playhead */}
            <span className="pointer-events-none absolute top-0 z-20 w-0.5 -translate-x-1/2 bg-text" style={{ left: pct(time), height: total }}>
              <span className="absolute -start-[5px] top-0 size-3 rounded-[3px] bg-text" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
