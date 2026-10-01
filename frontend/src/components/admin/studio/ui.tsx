import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { FACULTY, type Faculty } from './faculty';
import { filesToImages, type StudioImage } from './engine';

/** The native studios' controls, in the app's own language. */

export function Section({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="meta text-faint">{label}</p>
      {children}
      {hint ? <p className="text-xs leading-snug text-muted2">{hint}</p> : null}
    </section>
  );
}

export function Seg<T extends string>({ value, options, onChange, label, wrap }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string; wrap?: boolean }) {
  return (
    <div role="group" aria-label={label} className={['flex gap-1 rounded-[9px] bg-surface-2 p-1', wrap ? 'flex-wrap' : ''].join(' ')}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={[
            'h-8 min-w-0 truncate rounded-[7px] px-2.5 text-xs transition-colors',
            wrap ? 'flex-[1_1_30%]' : 'flex-1',
            value === v ? 'bg-surface font-medium text-text shadow-card' : 'text-muted2 hover:text-text',
          ].join(' ')}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const input =
  'w-full rounded-[8px] bg-surface-2 px-3 text-body-s text-text outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-anchor/40';

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="meta block text-faint">{label}</span>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={[input, 'h-10'].join(' ')} />
    </label>
  );
}

export function TextArea({ label, value, onChange, rows = 3, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="meta block text-faint">{label}</span>
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className={[input, 'resize-y py-2 leading-snug'].join(' ')} />
      {hint ? <span className="block text-xs text-muted2">{hint}</span> : null}
    </label>
  );
}

export function Swatches({ areas, value, onChange }: { areas: { name: string; hex: string }[]; value: number; onChange: (i: number) => void }) {
  return (
    <div role="group" aria-label="Disease state" className="grid grid-cols-2 gap-1.5">
      {areas.map((a, i) => (
        <button
          key={a.name}
          type="button"
          aria-pressed={value === i}
          onClick={() => onChange(i)}
          className={['flex h-9 items-center gap-2 rounded-[8px] px-2.5 text-left text-xs ring-1 transition-colors', value === i ? 'bg-surface text-text ring-text' : 'text-dim ring-hairline hover:ring-hairline-strong'].join(' ')}
        >
          <span className="size-3 shrink-0 rounded-[3px]" style={{ background: a.hex }} />
          <span className="truncate">{a.name}</span>
        </button>
      ))}
    </div>
  );
}

/** Faculty with cut-outs, plus uploads. Picking a face is how the credit gets written. */
export function FacultyPicker({ picked, onPick, max }: { picked: string[]; onPick: (f: Faculty) => void; max: number }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? FACULTY.filter((f) => f.name.toLowerCase().includes(s)) : FACULTY;
  }, [q]);
  const full = picked.length >= max;
  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="sr-only">Search faculty</span>
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search faculty" className={[input, 'h-9 ps-9'].join(' ')} />
      </label>
      <ul className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto pe-1">
        {list.map((f) => {
          const on = picked.includes(f.url);
          return (
            <li key={f.stem}>
              <button
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => onPick(f)}
                className={['flex w-full items-center gap-2 rounded-[8px] p-1.5 text-left text-xs transition-colors disabled:opacity-40', on ? 'bg-anchor/10 text-text' : 'text-dim hover:bg-surface-2'].join(' ')}
              >
                <span className="relative size-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#2a8aa6] to-[#8fc3d3]">
                  <img src={f.url} alt="" loading="lazy" className="absolute inset-x-0 bottom-0 mx-auto h-[115%] w-auto max-w-none" />
                  {on ? (
                    <span className="absolute inset-0 grid place-items-center bg-anchor/70 text-ground">
                      <Check className="size-4" aria-hidden />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 truncate">Dr. {f.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ImageChips({ images, onRemove, onZoom }: { images: StudioImage[]; onRemove: (i: number) => void; onZoom?: (i: number, z: number) => void }) {
  if (!images.length) return null;
  return (
    <ul className="space-y-1.5">
      {images.map((im, i) => (
        <li key={im.url} className="flex items-center gap-2.5 rounded-[8px] bg-surface-2 p-1.5 pe-1">
          <img src={im.url} alt="" className="size-9 shrink-0 rounded-full bg-surface object-cover object-top" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-text">{im.name}</span>
            {onZoom ? (
              <input type="range" min={1} max={2.2} step={0.02} value={im.zoom ?? 1} onChange={(e) => onZoom(i, Number(e.target.value))} aria-label={`Zoom ${im.name}`} className="mt-1 w-full accent-[hsl(var(--anchor))]" />
            ) : null}
          </span>
          <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${im.name}`} className="grid size-7 shrink-0 place-items-center rounded-[6px] text-faint hover:bg-surface hover:text-text">
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function UploadButton({ onImages, max, label = 'Upload images' }: { onImages: (ims: StudioImage[]) => void; max: number; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={max <= 0}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onImages(filesToImages(e.dataTransfer.files, max));
        }}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-hairline-strong text-xs text-dim transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-40"
      >
        <Upload className="size-3.5" aria-hidden /> {label} <span className="text-faint">or drop here</span>
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          onImages(filesToImages(e.target.files, max));
          e.target.value = '';
        }}
      />
    </>
  );
}

export function SlideStrip({ thumbs, current, count, aspect, onPick, onAdd }: { thumbs: string[]; current: number; count: number; aspect: number; onPick: (i: number) => void; onAdd: () => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Slide ${i + 1}`}
          aria-current={i === current ? 'true' : undefined}
          onClick={() => onPick(i)}
          className={['relative shrink-0 overflow-hidden rounded-[8px] bg-surface-2 ring-2 transition-[box-shadow]', i === current ? 'ring-anchor' : 'ring-transparent hover:ring-hairline-strong'].join(' ')}
          style={{ height: 88, aspectRatio: String(aspect) }}
        >
          {thumbs[i] ? <img src={thumbs[i]} alt="" className="size-full object-cover" /> : null}
          <span className="meta absolute start-1 top-1 rounded-[4px] bg-black/55 px-1 tabular-nums text-white">{i + 1}</span>
        </button>
      ))}
      <button type="button" onClick={onAdd} aria-label="Add a slide" className="grid shrink-0 place-items-center rounded-[8px] border border-dashed border-hairline-strong text-faint hover:bg-surface-2 hover:text-text" style={{ height: 88, aspectRatio: String(aspect) }}>
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  );
}

export function SlideOps({ index, count, onMove, onDuplicate, onDelete }: { index: number; count: number; onMove: (d: -1 | 1) => void; onDuplicate: () => void; onDelete: () => void }) {
  const b = 'inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2.5 text-xs text-dim hover:bg-surface-2 hover:text-text disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" className={b} disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move slide earlier">
        <ChevronLeft className="size-3.5" aria-hidden />
      </button>
      <button type="button" className={b} disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move slide later">
        <ChevronRight className="size-3.5" aria-hidden />
      </button>
      <button type="button" className={b} onClick={onDuplicate}>
        <Copy className="size-3.5" aria-hidden /> Duplicate
      </button>
      <button type="button" className={b} disabled={count === 1} onClick={onDelete}>
        <Trash2 className="size-3.5" aria-hidden /> Delete
      </button>
    </div>
  );
}
