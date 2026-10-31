import { useEffect, useRef, useState, type RefObject } from 'react';
import { Camera, Download } from 'lucide-react';
import { focusAt, slugify, speakerSpots, type Clip, type Cue } from './clipperCore';
import { drawThumbnail, grabFrame, THUMB_SIZE, type CutFormat, type Picture, type ThumbLayout } from './socialCut';
import { logClipper } from './clipperLog';

/**
 * A YouTube-style thumbnail from a clip: grab the frame on screen, write
 * the headline, download a 1280×720 PNG. Big face, big type, the way the
 * channels people actually click on do it.
 */

const LAYOUTS: [ThumbLayout, string, string][] = [
  ['bold', 'Face right', 'Headline stacked on the left, the speaker large on the right.'],
  ['cinema', 'Full bleed', 'The speaker fills the frame, headline across the bottom.'],
];

export function ThumbnailMaker({
  videoRef,
  clip,
  cues,
  format,
  sourceTitle,
  canExport,
  onSeek,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  clip: Clip;
  cues: Cue[];
  format: CutFormat;
  sourceTitle: string;
  canExport: boolean;
  onSeek: (t: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<ThumbLayout>('bold');
  const [headline, setHeadline] = useState(clip.openingTitle ?? clip.title);
  const [pic, setPic] = useState<Picture | null>(null);
  const [anchor, setAnchor] = useState(0.5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHeadline(clip.openingTitle ?? clip.title);
    setPic(null);
    // the clip changed: start from its own frame, a third of the way in
    onSeek(clip.start + (clip.end - clip.start) / 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);

  // a new opening title (typed, or picked from the AI options) becomes the headline
  useEffect(() => {
    if (clip.openingTitle) setHeadline(clip.openingTitle);
  }, [clip.openingTitle]);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawThumbnail(ctx, pic, { layout, headline, anchor, logo: format.logo });
  }, [pic, layout, headline, anchor, format.logo]);

  const grab = () => {
    const v = videoRef.current;
    if (!v) return;
    const p = grabFrame(v);
    if (!p) {
      setError('The video is still loading. Try again in a moment.');
      return;
    }
    setError(null);
    setPic(p);
    setAnchor(format.framing === 'speaker' ? focusAt(cues, speakerSpots(cues, format.positions), v.currentTime) : 0.5);
  };

  const download = () => {
    const c = ref.current;
    if (!c) return;
    try {
      c.toBlob((blob) => {
        if (!blob) {
          setError('This browser could not save the image.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slugify(sourceTitle)}-${slugify(headline || clip.title)}-thumbnail.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      }, 'image/png');
    } catch (err) {
      // a Zoom recording's frames are cross-origin, which taints the canvas
      setError('Zoom recordings can’t be saved as images here. Open the recording from your computer or Dropbox.');
      logClipper('thumbnail-export', err, { clip: clip.title });
    }
  };

  return (
    <section className="space-y-2">
      <p className="meta text-faint">Thumbnail</p>
      <canvas ref={ref} width={THUMB_SIZE[0]} height={THUMB_SIZE[1]} className="aspect-video w-full rounded-[10px] bg-[#0b1116] ring-1 ring-hairline" aria-label="Thumbnail preview" />
      <div role="group" aria-label="Thumbnail layout" className="flex gap-1 rounded-[9px] bg-surface-2 p-1">
        {LAYOUTS.map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={layout === v}
            onClick={() => setLayout(v)}
            className={['h-8 flex-1 rounded-[7px] px-2 text-xs', layout === v ? 'bg-surface font-medium text-text shadow-card' : 'text-muted2 hover:text-text'].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted2">{LAYOUTS.find(([v]) => v === layout)?.[2]}</p>
      <label className="block">
        <span className="meta text-faint">Headline</span>
        <textarea
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-[6px] bg-surface-2 px-2.5 py-1.5 text-body-s text-text outline-none focus-visible:ring-2 focus-visible:ring-anchor/40"
        />
        <span className="text-xs text-muted2">Short and loud. [Square brackets] turn a phrase amber.</span>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={grab} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-surface-2 px-3 text-xs font-medium text-text">
          <Camera className="size-3.5" aria-hidden /> {pic ? 'Use the frame on screen' : 'Grab the frame on screen'}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={!pic || !canExport}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-anchor px-3 text-xs font-medium text-ground disabled:opacity-40"
        >
          <Download className="size-3.5" aria-hidden /> Download PNG
        </button>
      </div>
      {error ? <p className="text-xs text-dim">{error}</p> : !canExport ? <p className="text-xs text-muted2">Zoom recordings preview here but can’t be saved as images. Open the recording from your computer or Dropbox.</p> : <p className="text-xs text-muted2">Pause on a good face, then grab it. Speaker focus decides who the crop centres on.</p>}
    </section>
  );
}
