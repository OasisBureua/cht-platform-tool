import { useEffect, useState, type RefObject } from 'react';
import { Crosshair, X } from 'lucide-react';

/**
 * Speaker focus, placed by hand: pick a speaker, click on their face in the
 * picture, and the crop follows them from then on. Markers show where
 * everyone sits while the Output panel is open.
 */

const MARK_COLORS = ['#2eaacc', '#e2704a', '#8b6ad8', '#2f9e6b', '#d9a13b', '#d0548f'];

type Box = { left: number; top: number; width: number; height: number };

/** The part of the element the picture fills under object-contain, relative to the element. */
function pictureBox(v: HTMLVideoElement): Box & { rect: DOMRect } {
  const r = v.getBoundingClientRect();
  const ar = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
  const w = Math.min(r.width, r.height * ar);
  const h = w / ar;
  return { left: (r.width - w) / 2, top: (r.height - h) / 2, width: w, height: h, rect: r };
}

export function SpeakerPlacer({
  videoRef,
  speakers,
  spots,
  placing,
  showMarks,
  onPlace,
  onCancel,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  speakers: string[];
  spots: Record<string, number>;
  placing: string | null;
  showMarks: boolean;
  onPlace: (speaker: string, x: number) => void;
  onCancel: () => void;
}) {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const bump = () => {
      const { left, top, width, height } = pictureBox(v);
      setBox({ left, top, width, height });
    };
    const ro = new ResizeObserver(bump);
    ro.observe(v);
    v.addEventListener('loadedmetadata', bump);
    return () => {
      ro.disconnect();
      v.removeEventListener('loadedmetadata', bump);
    };
  }, [videoRef]);

  useEffect(() => {
    if (!placing) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing, onCancel]);

  if (!box || (!placing && !showMarks) || !speakers.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {speakers.map((s, i) => {
        const x = box.left + (spots[s] ?? 0.5) * box.width;
        const active = placing === s;
        return (
          <div key={s} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: x, transform: 'translateX(-50%)', top: box.top, height: box.height }}>
            <span className="h-full w-px opacity-70" style={{ background: MARK_COLORS[i % MARK_COLORS.length] }} />
            <span
              className={['absolute top-2 max-w-[10rem] truncate rounded-full px-2 py-0.5 text-[11px] font-medium text-white shadow', active ? 'ring-2 ring-white' : ''].join(' ')}
              style={{ background: MARK_COLORS[i % MARK_COLORS.length] }}
            >
              {s}
            </span>
          </div>
        );
      })}
      {placing ? (
        <>
          <button
            type="button"
            aria-label={`Click where ${placing} sits in the picture`}
            className="pointer-events-auto absolute inset-0 cursor-crosshair bg-black/25"
            onClick={(e) => {
              const v = videoRef.current;
              if (!v) return;
              const b = pictureBox(v);
              const x = (e.clientX - b.rect.left - b.left) / b.width;
              onPlace(placing, Math.min(1, Math.max(0, x)));
            }}
          />
          <span className="pointer-events-auto absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-2 rounded-full bg-black/75 py-1.5 ps-3 pe-1.5 text-xs text-white">
            <Crosshair className="size-3.5" aria-hidden /> Click on {placing}'s face
            <button type="button" aria-label="Cancel placing" onClick={onCancel} className="grid size-6 place-items-center rounded-full hover:bg-white/20">
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        </>
      ) : null}
    </div>
  );
}
