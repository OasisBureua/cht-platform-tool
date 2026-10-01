import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { GalleryHorizontal, LayoutGrid, Loader2, PanelLeft, Plus } from 'lucide-react';
import { SlideStrip } from './ui';

/**
 * The studios' stage: the artwork sized to fit the screen, with the slides
 * beside it, under it, or laid out together. It fills the window's height
 * so moving between slides never scrolls the page.
 */

import type { StageView } from './stageView';

export type { StageView };
const VIEWS: [StageView, string, typeof PanelLeft][] = [
  ['rail', 'Side rail', PanelLeft],
  ['strip', 'Filmstrip', GalleryHorizontal],
  ['grid', 'All slides', LayoutGrid],
];

export function ViewSwitch({ view, onView }: { view: StageView; onView: (v: StageView) => void }) {
  return (
    <div role="group" aria-label="Slide view" className="flex gap-0.5 rounded-[9px] bg-surface-2 p-1">
      {VIEWS.map(([v, label, Icon]) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          title={label}
          onClick={() => onView(v)}
          className={['inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2.5 text-xs transition-colors', view === v ? 'bg-surface font-medium text-text shadow-card' : 'text-muted2 hover:text-text'].join(' ')}
        >
          <Icon className="size-4" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** The studio page in an iframe, as large as fits the space at the output's shape. */
function Fit({ aspect, frameRef, src, onLoad, ready, label }: { aspect: number; frameRef: RefObject<HTMLIFrameElement | null>; src: string; onLoad: () => void; ready: boolean; label: string }) {
  return (
    <div className="relative min-h-0 min-w-0 flex-1" style={{ containerType: 'size' }}>
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative overflow-hidden rounded-[12px] bg-surface-2 shadow-card ring-1 ring-hairline" style={{ width: `min(100cqw, calc(100cqh * ${aspect}))`, aspectRatio: String(aspect) }}>
          <iframe ref={frameRef} src={src} onLoad={onLoad} title={label} className="absolute inset-0 size-full border-0" />
          {ready ? null : (
            <div className="absolute inset-0 grid place-items-center bg-surface-2 text-muted2">
              <Loader2 className="size-5 animate-spin" aria-hidden />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Rail({ thumbs, current, count, aspect, onPick, onAdd }: { thumbs: string[]; current: number; count: number; aspect: number; onPick: (i: number) => void; onAdd: () => void }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [current]);
  const width = aspect < 1 ? 'w-[5.75rem]' : aspect === 1 ? 'w-[6.5rem]' : 'w-[9.5rem]';
  return (
    <ol ref={ref} aria-label="Slides" className={['flex shrink-0 flex-col gap-2 overflow-y-auto pe-1 [scrollbar-width:thin]', width].join(' ')}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <span className={['meta w-4 shrink-0 pt-0.5 text-end tabular-nums', i === current ? 'text-text' : 'text-faint'].join(' ')}>{i + 1}</span>
          <button
            type="button"
            aria-label={`Slide ${i + 1}`}
            aria-current={i === current ? 'true' : undefined}
            onClick={() => onPick(i)}
            className={['min-w-0 flex-1 overflow-hidden rounded-[7px] bg-surface-2 ring-2 transition-[box-shadow]', i === current ? 'ring-anchor' : 'ring-transparent hover:ring-hairline-strong'].join(' ')}
            style={{ aspectRatio: String(aspect) }}
          >
            {thumbs[i] ? <img src={thumbs[i]} alt="" className="size-full object-cover" /> : null}
          </button>
        </li>
      ))}
      <li className="flex gap-1.5">
        <span className="w-4 shrink-0" />
        <button type="button" onClick={onAdd} aria-label="Add a slide" className="grid min-w-0 flex-1 place-items-center rounded-[7px] border border-dashed border-hairline-strong text-faint hover:bg-surface-2 hover:text-text" style={{ aspectRatio: String(aspect) }}>
          <Plus className="size-4" aria-hidden />
        </button>
      </li>
    </ol>
  );
}

function Overview({ thumbs, current, count, aspect, onPick, onAdd }: { thumbs: string[]; current: number; count: number; aspect: number; onPick: (i: number) => void; onAdd: () => void }) {
  const cols = aspect < 1 ? 'grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]' : aspect === 1 ? 'grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]';
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pe-1">
      <ol aria-label="Slides" className={['grid gap-3', cols].join(' ')}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              aria-label={`Slide ${i + 1}`}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => onPick(i)}
              className={['relative w-full overflow-hidden rounded-[10px] bg-surface-2 ring-2 transition-[box-shadow]', i === current ? 'ring-anchor' : 'ring-transparent hover:ring-hairline-strong'].join(' ')}
              style={{ aspectRatio: String(aspect) }}
            >
              {thumbs[i] ? <img src={thumbs[i]} alt="" className="size-full object-cover" /> : null}
              <span className="meta absolute start-1.5 top-1.5 rounded-[4px] bg-black/55 px-1.5 tabular-nums text-white">{i + 1}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={onAdd} aria-label="Add a slide" className="grid w-full place-items-center rounded-[10px] border border-dashed border-hairline-strong text-faint hover:bg-surface-2 hover:text-text" style={{ aspectRatio: String(aspect) }}>
            <Plus className="size-5" aria-hidden />
          </button>
        </li>
      </ol>
    </div>
  );
}

export function Stage({
  view,
  aspect,
  frameRef,
  src,
  onLoad,
  ready,
  label,
  slides,
  footer,
}: {
  view: StageView | null;
  aspect: number;
  frameRef: RefObject<HTMLIFrameElement | null>;
  src: string;
  onLoad: () => void;
  ready: boolean;
  label: string;
  slides?: { thumbs: string[]; current: number; count: number; onPick: (i: number) => void; onAdd: () => void };
  footer: ReactNode;
}) {
  return (
    <div className="card flex h-[max(24rem,calc(100dvh-12.5rem))] flex-col gap-3 p-3 lg:sticky lg:top-4">
      <div className="flex min-h-0 flex-1 gap-3">
        {slides && view === 'rail' ? <Rail {...slides} aspect={aspect} /> : null}
        {slides && view === 'grid' ? <Overview {...slides} aspect={aspect} /> : null}
        {/* the live canvas stays mounted in every view: it's what draws the slides */}
        <div className={view === 'grid' ? 'hidden' : 'flex min-h-0 min-w-0 flex-1'}>
          <Fit aspect={aspect} frameRef={frameRef} src={src} onLoad={onLoad} ready={ready} label={label} />
        </div>
      </div>
      {slides && view === 'strip' ? <SlideStrip {...slides} aspect={aspect} /> : null}
      <div className="flex flex-wrap items-center gap-2">{footer}</div>
    </div>
  );
}
