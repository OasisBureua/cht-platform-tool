import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, Captions, Film, FileVideo, Loader2, Search, Video, X } from 'lucide-react';
import { adminApi, type ZoomRecordingCatalogSession } from '../../../api/admin';
import { slugify } from './clipperCore';
import { isCaptionFile, isVideoFile, pickVideo, type Source } from './sources';

/**
 * The clipper's start: say what you want, add the recording, and the first
 * cut is drafted from that. Files drop straight onto the box.
 */

const PRESETS: [string, string][] = [
  ['Moments worth clipping', 'Find the moments worth clipping for TikTok'],
  ['Audience questions', 'Every audience question'],
  ['Split into 3-minute clips', 'Split into 3-minute clips'],
  ['Opening 90 seconds', 'First 90 seconds'],
  ['Closing 2 minutes', 'Last 2 minutes'],
  ['Find a topic', 'Find '],
];

const dateOf = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date';

export function ClipComposer({ onStart }: { onStart: (source: Source, captions: File | undefined, prompt: string) => void }) {
  const [prompt, setPrompt] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [captions, setCaptions] = useState<File | null>(null);
  const [zoom, setZoom] = useState<ZoomRecordingCatalogSession | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const capInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const sessions = useQuery({
    queryKey: ['admin', 'clipper', 'sessions', debounced],
    queryFn: () => adminApi.listZoomRecordingSessions({ page: 1, pageSize: 24, q: debounced || undefined }),
    staleTime: 60_000,
  });
  const withFiles = (sessions.data?.sessions ?? []).filter((s) => s.filesInS3Count > 0);

  const take = (files: FileList | File[] | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (isVideoFile(f)) {
        setVideo(f);
        setZoom(null);
      } else if (isCaptionFile(f)) setCaptions(f);
    }
    setError(null);
  };

  const ready = !!(video || zoom) && !opening;

  const start = async () => {
    if (!ready) return;
    const text = prompt.trim();
    if (video) {
      onStart(
        { kind: 'local', key: `local:${video.name}:${video.size}`, title: video.name.replace(/\.[^.]+$/, ''), fileName: video.name, url: URL.createObjectURL(video), file: video },
        captions ?? undefined,
        text,
      );
      return;
    }
    if (!zoom) return;
    setOpening(true);
    setError(null);
    try {
      const detail = await adminApi.getZoomRecordingSession(zoom.id);
      const file = pickVideo(detail.files);
      if (!file) {
        setError('That session has no MP4 in storage yet. Pull its files on the Zoom recordings page first.');
        return;
      }
      const link = await adminApi.getZoomRecordingCatalogDownloadUrl(zoom.id, file.id, 'inline');
      onStart(
        {
          kind: 'zoom',
          key: `zoom:${zoom.id}:${file.id}`,
          title: zoom.topic || zoom.programTitle || 'Zoom recording',
          fileName: `${slugify(zoom.topic || 'recording')}.mp4`,
          url: link.url,
          session: zoom,
          files: detail.files,
        },
        captions ?? undefined,
        text,
      );
    } catch {
      setError("That recording didn't open. Try again, or check it on the Zoom recordings page.");
    } finally {
      setOpening(false);
    }
  };

  const chip = 'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-surface-2 ps-3 pe-1 text-body-s text-text';

  return (
    <div className="mx-auto max-w-[58rem] space-y-8 pb-10 pt-2">
      <div className="text-center">
        <h2 className="display text-display-s text-text md:text-display-m">What should we clip?</h2>
        <p className="prose-lede mx-auto mt-2 max-w-xl text-body-s text-muted2">
          Describe the moments and add a recording. Times are cut straight away; moments found in the transcript come
          back scored strong, maybe or skip, with the exact quote, for your OK.
        </p>
      </div>

      <div
        className={[
          'relative rounded-card bg-surface shadow-card ring-1 transition-[box-shadow] duration-150',
          dragOver ? 'ring-2 ring-anchor' : 'ring-hairline',
        ].join(' ')}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          take(e.dataTransfer.files);
        }}
      >
        <label className="block">
          <span className="sr-only">Describe the clips you want</span>
          <textarea
            ref={textRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void start();
              }
            }}
            rows={3}
            placeholder="Find the moments worth clipping for TikTok, or 12:30 to 14:05 ILD monitoring"
            className="block w-full resize-none rounded-t-card bg-transparent px-5 pb-2 pt-5 text-body-l text-text outline-none placeholder:text-faint"
          />
        </label>

        {video || zoom || captions ? (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {video ? (
              <span className={chip}>
                <Film className="size-3.5 shrink-0 text-anchor" aria-hidden />
                <span className="truncate">{video.name}</span>
                <button type="button" onClick={() => setVideo(null)} aria-label={`Remove ${video.name}`} className="grid size-6 place-items-center rounded-full text-faint hover:bg-surface hover:text-text">
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ) : null}
            {zoom ? (
              <span className={chip}>
                <Video className="size-3.5 shrink-0 text-anchor" aria-hidden />
                <span className="truncate">{zoom.topic || 'Zoom recording'}</span>
                <button type="button" onClick={() => setZoom(null)} aria-label="Remove the Zoom recording" className="grid size-6 place-items-center rounded-full text-faint hover:bg-surface hover:text-text">
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ) : null}
            {captions ? (
              <span className={chip}>
                <Captions className="size-3.5 shrink-0 text-anchor" aria-hidden />
                <span className="truncate">{captions.name}</span>
                <button type="button" onClick={() => setCaptions(null)} aria-label={`Remove ${captions.name}`} className="grid size-6 place-items-center rounded-full text-faint hover:bg-surface hover:text-text">
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline px-3 py-2.5">
          <button type="button" onClick={() => videoInput.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-body-s text-dim hover:bg-surface-2 hover:text-text">
            <Film className="size-4" aria-hidden /> Video file
          </button>
          <button type="button" onClick={() => capInput.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-body-s text-dim hover:bg-surface-2 hover:text-text">
            <Captions className="size-4" aria-hidden /> Transcript
          </button>
          <span className="meta hidden text-faint sm:inline">or drop files here</span>
          <input ref={videoInput} type="file" accept="video/*" className="hidden" aria-hidden tabIndex={-1} onChange={(e) => take(e.target.files)} />
          <input ref={capInput} type="file" accept=".vtt,.srt,text/vtt" className="hidden" aria-hidden tabIndex={-1} onChange={(e) => take(e.target.files)} />
          <button
            type="button"
            onClick={() => void start()}
            disabled={!ready}
            title={video || zoom ? undefined : 'Add a recording first'}
            className="press ms-auto inline-flex h-10 items-center gap-2 rounded-[8px] bg-anchor px-4 text-body-s font-medium text-ground transition-opacity disabled:opacity-40"
          >
            {opening ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
            Start clipping
          </button>
        </div>
        {error ? <p className="border-t border-hairline px-5 py-2.5 text-body-s text-dim">{error}</p> : null}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {PRESETS.map(([label, text]) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setPrompt(text);
              requestAnimationFrame(() => {
                const el = textRef.current;
                if (el) {
                  el.focus();
                  el.setSelectionRange(text.length, text.length);
                }
              });
            }}
            className="h-9 rounded-full bg-surface px-3.5 text-body-s text-dim ring-1 ring-hairline transition-colors hover:text-text hover:ring-hairline-strong"
          >
            {label}
          </button>
        ))}
      </div>

      <section aria-labelledby="clipper-zoom" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 id="clipper-zoom" className="display text-body-l text-text">
            Zoom recordings
          </h3>
          <label className="relative ms-auto w-full sm:w-72">
            <span className="sr-only">Search Zoom recordings</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by topic or host"
              className="h-10 w-full rounded-[8px] bg-surface ps-9 pe-3 text-body-s text-text outline-none ring-1 ring-hairline focus-visible:ring-2 focus-visible:ring-anchor/40"
            />
          </label>
        </div>
        {sessions.isLoading ? (
          <p className="flex items-center gap-2 py-4 text-body-s text-muted2">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading recordings
          </p>
        ) : sessions.isError ? (
          <p className="py-4 text-body-s text-muted2">Recordings didn't load. Refresh to try again, or drop a video file above.</p>
        ) : withFiles.length === 0 ? (
          <p className="py-4 text-body-s text-muted2">
            {debounced ? `No recordings with stored files match “${debounced}”.` : 'No recordings have files in storage yet.'}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {withFiles.map((s) => {
              const on = zoom?.id === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setZoom(on ? null : s);
                      if (!on) setVideo(null);
                    }}
                    className={[
                      'flex w-full items-center gap-3 rounded-[10px] bg-surface p-3 text-left ring-1 transition-[box-shadow,background-color] duration-150',
                      on ? 'ring-2 ring-anchor' : 'ring-hairline hover:ring-hairline-strong',
                    ].join(' ')}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-anchor/10 text-anchor">
                      <FileVideo className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-s font-medium text-text">{s.topic || 'Untitled session'}</span>
                      <span className="meta block truncate text-faint">
                        {dateOf(s.startTime)}
                        {s.programTitle ? ` · ${s.programTitle}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
