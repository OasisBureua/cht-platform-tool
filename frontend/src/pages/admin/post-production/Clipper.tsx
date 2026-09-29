import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileVideo,
  Film,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Repeat,
  Scissors,
  Search,
  Send,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { adminApi, type ProgramZoomRecordingRow, type ZoomRecordingCatalogSession } from '../../../api/admin';
import {
  ASSISTANT_HELP,
  clipsToCsv,
  clipsToEdl,
  clipsToJson,
  formatTime,
  interpretRequest,
  parseCaptions,
  slugify,
  type Clip,
  type Cue,
  type ProposedClip,
} from '../../../components/admin/clipper/clipperCore';
import type { RenderMode } from '../../../components/admin/clipper/renderClip';

/**
 * Post-production › Clipper. A review-and-clip view in the spirit of
 * Frame.io: the recording large, a timeline carrying every clip, and a
 * side panel for the clip list, the transcript and the clip assistant.
 *
 * Two sources. A Zoom recording from the admin catalog plays from its
 * signed link and exports a cut list (CSV, EDL, JSON) for the editor; the
 * bucket doesn't let the browser read its bytes, so it can't be cut here.
 * A file from the computer does everything, including rendering clips.
 * Work is saved in this browser per source, so a reload loses nothing.
 */

type Source =
  | { kind: 'zoom'; key: string; title: string; fileName: string; url: string; session: ZoomRecordingCatalogSession; files: ProgramZoomRecordingRow[] }
  | { kind: 'local'; key: string; title: string; fileName: string; url: string; file: File };

type TranscriptState = 'none' | 'loading' | 'ready' | 'blocked' | 'error';
type Panel = 'clips' | 'transcript' | 'assistant';
type ChatMessage = { id: string; role: 'you' | 'assistant'; text: string; proposals?: ProposedClip[] };

const FRAME = 1 / 30;
const CLIP_COLORS = ['#2eaacc', '#e2704a', '#8b6ad8', '#2f9e6b', '#d9a13b', '#d0548f'];
const uid = () => Math.random().toString(36).slice(2, 10);

function storageKey(sourceKey: string) {
  return `chm-clipper:${sourceKey}`;
}

function loadSaved(sourceKey: string): Clip[] {
  try {
    const raw = window.localStorage.getItem(storageKey(sourceKey));
    const parsed = raw ? (JSON.parse(raw) as Clip[]) : [];
    return Array.isArray(parsed) ? parsed.filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end)) : [];
  } catch {
    return [];
  }
}

function downloadText(name: string, text: string, type: string) {
  downloadBlob(name, new Blob([text], { type }));
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

/** The recording to clip: the largest MP4 in S3, which is Zoom's main view. */
function pickVideo(files: ProgramZoomRecordingRow[]): ProgramZoomRecordingRow | undefined {
  return files
    .filter((f) => f.storedInS3 && /mp4/i.test(`${f.fileType} ${f.fileExtension ?? ''}`))
    .sort((a, b) => (b.fileSizeBytes ?? 0) - (a.fileSizeBytes ?? 0))[0];
}

function pickTranscript(files: ProgramZoomRecordingRow[]): ProgramZoomRecordingRow | undefined {
  const inS3 = files.filter((f) => f.storedInS3);
  return inS3.find((f) => /transcript/i.test(f.fileType)) ?? inS3.find((f) => /^cc$/i.test(f.fileType) || /vtt/i.test(f.fileExtension ?? ''));
}

/* ── source picker ─────────────────────────────────────────────── */

function SourcePicker({ onPick }: { onPick: (s: Source, transcript?: File) => void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [captions, setCaptions] = useState<File | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const sessions = useQuery({
    queryKey: ['admin', 'clipper', 'sessions', debounced],
    queryFn: () => adminApi.listZoomRecordingSessions({ page: 1, pageSize: 25, q: debounced || undefined }),
    staleTime: 60_000,
  });
  const withFiles = (sessions.data?.sessions ?? []).filter((s) => s.filesInS3Count > 0);

  const openSession = async (s: ZoomRecordingCatalogSession) => {
    setError(null);
    setOpening(s.id);
    try {
      const detail = await adminApi.getZoomRecordingSession(s.id);
      const file = pickVideo(detail.files);
      if (!file) {
        setError('That session has no MP4 in storage yet. Pull its files on the Zoom recordings page first.');
        return;
      }
      const link = await adminApi.getZoomRecordingCatalogDownloadUrl(s.id, file.id, 'inline');
      onPick({
        kind: 'zoom',
        key: `zoom:${s.id}:${file.id}`,
        title: s.topic || s.programTitle || 'Zoom recording',
        fileName: `${slugify(s.topic || 'recording')}.mp4`,
        url: link.url,
        session: s,
        files: detail.files,
      });
    } catch {
      setError("That recording didn't open. Try again, or check it on the Zoom recordings page.");
    } finally {
      setOpening(null);
    }
  };

  const openLocal = () => {
    if (!video) return;
    onPick(
      {
        kind: 'local',
        key: `local:${video.name}:${video.size}`,
        title: video.name.replace(/\.[^.]+$/, ''),
        fileName: video.name,
        url: URL.createObjectURL(video),
        file: video,
      },
      captions ?? undefined,
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="card flex min-h-[26rem] flex-col p-5">
        <div className="flex items-center gap-2">
          <Video className="size-4 text-anchor" aria-hidden />
          <h2 className="display text-body-l text-text">Zoom recordings</h2>
        </div>
        <p className="mt-1 text-body-s text-muted2">Sessions with files in storage. Clips export as a cut list for the editor.</p>
        <label className="relative mt-4 block">
          <span className="sr-only">Search sessions</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by topic or host"
            className="h-10 w-full rounded-[8px] bg-surface-2 ps-9 pe-3 text-body-s text-text outline-none focus-visible:ring-2 focus-visible:ring-anchor/40"
          />
        </label>
        {error ? <p className="mt-3 rounded-[8px] bg-amber-500/10 px-3 py-2 text-body-s text-dim">{error}</p> : null}
        <ul className="mt-3 flex-1 space-y-1 overflow-y-auto">
          {sessions.isLoading ? (
            <li className="flex items-center gap-2 py-6 text-body-s text-muted2">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Loading sessions
            </li>
          ) : sessions.isError ? (
            <li className="py-6 text-body-s text-muted2">Sessions didn't load. Refresh to try again.</li>
          ) : withFiles.length === 0 ? (
            <li className="py-6 text-body-s text-muted2">
              {debounced ? `No sessions with stored files match “${debounced}”.` : 'No sessions have files in storage yet.'}
            </li>
          ) : (
            withFiles.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => openSession(s)}
                  disabled={opening !== null}
                  className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
                >
                  <FileVideo className="size-4 shrink-0 text-faint" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-s font-medium text-text">{s.topic || 'Untitled session'}</span>
                    <span className="meta block truncate text-faint">
                      {s.startTime ? new Date(s.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                      {s.programTitle ? ` · ${s.programTitle}` : ''}
                    </span>
                  </span>
                  {opening === s.id ? <Loader2 className="size-4 animate-spin text-anchor" aria-hidden /> : <ChevronRight className="size-4 text-faint" aria-hidden />}
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="card flex flex-col p-5">
        <div className="flex items-center gap-2">
          <Upload className="size-4 text-anchor" aria-hidden />
          <h2 className="display text-body-l text-text">From your computer</h2>
        </div>
        <p className="mt-1 text-body-s text-muted2">Clip it here and render MP4s in the browser. Nothing is uploaded.</p>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-hairline-strong px-4 py-8 text-center transition-colors hover:bg-surface-2">
          <Film className="size-6 text-faint" aria-hidden />
          <span className="text-body-s font-medium text-text">{video ? video.name : 'Choose a video'}</span>
          <span className="meta text-faint">MP4, MOV or WebM</span>
          <input type="file" accept="video/*" className="sr-only" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
        </label>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-[8px] bg-surface-2 px-3 py-2.5 text-body-s">
          <span className="min-w-0 truncate text-dim">{captions ? captions.name : 'Transcript (optional): .vtt or .srt'}</span>
          <span className="shrink-0 font-medium text-anchor">Choose</span>
          <input type="file" accept=".vtt,.srt,text/vtt" className="sr-only" onChange={(e) => setCaptions(e.target.files?.[0] ?? null)} />
        </label>
        <button
          type="button"
          onClick={openLocal}
          disabled={!video}
          className="press mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-anchor px-4 text-body-s font-medium text-ground disabled:opacity-40"
        >
          <Scissors className="size-4" aria-hidden />
          Open in the clipper
        </button>
      </section>
    </div>
  );
}

/* ── timeline ──────────────────────────────────────────────────── */

function Timeline({
  duration,
  time,
  clips,
  selectedId,
  markIn,
  markOut,
  cues,
  onSeek,
  onSelect,
}: {
  duration: number;
  time: number;
  clips: Clip[];
  selectedId: string | null;
  markIn: number | null;
  markOut: number | null;
  cues: Cue[];
  onSeek: (t: number) => void;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = (t: number) => (duration > 0 ? `${(Math.min(Math.max(t, 0), duration) / duration) * 100}%` : '0%');
  const seekFrom = (clientX: number) => {
    const el = ref.current;
    if (!el || duration <= 0) return;
    const r = el.getBoundingClientRect();
    onSeek(((clientX - r.left) / r.width) * duration);
  };
  /* Overlapping clips take separate lanes, first fit, so none hides another. */
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
  const laneH = lanes.count > 1 ? 22 : 36;
  const trackH = Math.max(80, 12 + lanes.count * (laneH + 4) + 12);
  const ticks = useMemo(() => {
    if (duration <= 0) return [];
    const step = duration > 3600 ? 600 : duration > 900 ? 300 : duration > 240 ? 60 : 15;
    return Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step);
  }, [duration]);

  return (
    <div className="select-none">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={formatTime(time)}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          seekFrom(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) seekFrom(e.clientX);
        }}
        className="relative cursor-pointer overflow-hidden rounded-[10px] bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={{ height: trackH }}
      >
        {/* Where people spoke: a faint strip of cue marks along the foot. */}
        {cues.length ? (
          <div className="absolute inset-x-0 bottom-0 h-2">
            {cues.map((c, i) => (
              <span key={i} className="absolute bottom-0 h-full bg-text/10" style={{ left: pct(c.start), width: pct(c.end - c.start) }} />
            ))}
          </div>
        ) : null}
        {markIn != null ? (
          <span
            className="absolute inset-y-0 bg-anchor/15 ring-1 ring-inset ring-anchor/50"
            style={{ left: pct(markIn), width: pct((markOut ?? time) - markIn) }}
          />
        ) : null}
        {clips.map((c, i) => (
          <button
            key={c.id}
            type="button"
            title={`${i + 1}. ${c.title} (${formatTime(c.start)}–${formatTime(c.end)})`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSelect(c.id)}
            className={[
              'absolute min-w-[3px] overflow-hidden rounded-[6px] px-1.5 text-left text-[10px] font-medium text-white',
              c.id === selectedId ? 'ring-2 ring-text ring-offset-1 ring-offset-surface-2' : 'opacity-90 hover:opacity-100',
            ].join(' ')}
            style={{
              left: pct(c.start),
              width: pct(c.end - c.start),
              top: 10 + (lanes.lane.get(c.id) ?? 0) * (laneH + 4),
              height: laneH,
              lineHeight: `${laneH}px`,
              background: CLIP_COLORS[i % CLIP_COLORS.length],
            }}
          >
            <span className="truncate">{i + 1}</span>
          </button>
        ))}
        <span className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-text" style={{ left: pct(time) }} />
      </div>
      <div className="relative mt-1 h-4">
        {ticks.map((t, i) => (
          <span
            key={t}
            className={[
              'meta absolute tabular-nums text-faint',
              // the first label sits right of its tick and the last one left, so neither runs off the edge
              i === 0 ? '' : t >= duration - 1 ? '-translate-x-full' : '-translate-x-1/2',
            ].join(' ')}
            style={{ left: pct(t) }}
          >
            {formatTime(t, 0)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── the clipper ───────────────────────────────────────────────── */

export default function Clipper() {
  const [source, setSource] = useState<Source | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [transcript, setTranscript] = useState<TranscriptState>('none');
  const [transcriptLink, setTranscriptLink] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markIn, setMarkIn] = useState<number | null>(null);
  const [markOut, setMarkOut] = useState<number | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [panel, setPanel] = useState<Panel>('assistant');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [transcriptQuery, setTranscriptQuery] = useState('');
  const [renderMode, setRenderMode] = useState<RenderMode>('fast');
  const [rendering, setRendering] = useState<Record<string, number | 'error'>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<Clip | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* keep clips saved per source */
  useEffect(() => {
    if (!source) return;
    try {
      window.localStorage.setItem(storageKey(source.key), JSON.stringify(clips));
    } catch {
      /* storage full or blocked: the session still works */
    }
  }, [clips, source]);

  useEffect(() => () => {
    if (source?.kind === 'local') URL.revokeObjectURL(source.url);
  }, [source]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chat]);

  const loadTranscriptText = useCallback((text: string) => {
    const parsed = parseCaptions(text);
    setCues(parsed);
    setTranscript(parsed.length ? 'ready' : 'error');
  }, []);

  const openSource = useCallback(
    async (s: Source, captions?: File) => {
      setSource(s);
      setClips(loadSaved(s.key));
      setSelectedId(null);
      setMarkIn(null);
      setMarkOut(null);
      setCues([]);
      setTranscriptLink(null);
      setChat([{ id: uid(), role: 'assistant', text: ASSISTANT_HELP }]);
      if (captions) {
        setTranscript('loading');
        loadTranscriptText(await captions.text());
        return;
      }
      if (s.kind === 'zoom') {
        const t = pickTranscript(s.files);
        if (!t) {
          setTranscript('none');
          return;
        }
        setTranscript('loading');
        try {
          const link = await adminApi.getZoomRecordingCatalogDownloadUrl(s.session.id, t.id, 'inline');
          setTranscriptLink(link.url);
          const res = await fetch(link.url);
          if (!res.ok) throw new Error(String(res.status));
          loadTranscriptText(await res.text());
        } catch {
          // The bucket's CORS rule has no GET for the app origin, so the
          // text can't be read here; offer it as a download to drop back in.
          setTranscript('blocked');
        }
      } else {
        setTranscript('none');
      }
    },
    [loadTranscriptText],
  );

  /* playback */
  const v = () => videoRef.current;
  const seek = useCallback((t: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(t, el.duration || t));
    setTime(el.currentTime);
  }, []);
  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    loopRef.current = null;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    const tick = () => {
      const el = videoRef.current;
      if (el) {
        const loop = loopRef.current;
        if (loop && el.currentTime >= loop.end) el.currentTime = loop.start;
        setTime(el.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const previewClip = (c: Clip) => {
    const el = v();
    if (!el) return;
    setSelectedId(c.id);
    loopRef.current = c;
    el.currentTime = c.start;
    void el.play();
  };

  /* clips */
  const addClip = useCallback(
    (p: Omit<Clip, 'id'>) => {
      const clip: Clip = { ...p, id: uid(), start: Math.max(0, p.start), end: Math.max(p.start + 0.1, p.end) };
      setClips((cs) => [...cs, clip].sort((a, b) => a.start - b.start));
      setSelectedId(clip.id);
      return clip;
    },
    [],
  );
  const addFromMarks = useCallback(() => {
    if (markIn == null) return;
    const end = markOut ?? videoRef.current?.currentTime ?? markIn;
    if (end <= markIn) return;
    addClip({ title: `Clip ${clips.length + 1}`, start: markIn, end });
    setMarkIn(null);
    setMarkOut(null);
    setPanel('clips');
  }, [markIn, markOut, clips.length, addClip]);
  const updateClip = (id: string, patch: Partial<Clip>) =>
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)).sort((a, b) => a.start - b.start));
  const removeClip = (id: string) => setClips((cs) => cs.filter((c) => c.id !== id));

  /* keyboard: space, I, O, enter, arrows, comma and full stop */
  useEffect(() => {
    if (!source) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      const el = videoRef.current;
      if (!el) return;
      const k = e.key;
      if (k === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (k === 'i' || k === 'I') setMarkIn(el.currentTime);
      else if (k === 'o' || k === 'O') setMarkOut(el.currentTime);
      else if (k === 'Enter') addFromMarks();
      else if (k === 'ArrowLeft') seek(el.currentTime - (e.shiftKey ? 5 : 1));
      else if (k === 'ArrowRight') seek(el.currentTime + (e.shiftKey ? 5 : 1));
      else if (k === ',') seek(el.currentTime - FRAME);
      else if (k === '.') seek(el.currentTime + FRAME);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source, togglePlay, addFromMarks, seek]);

  /* assistant */
  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const result = interpretRequest(text, { duration, cues, clipCount: clips.length });
    if (result.clearAll) setClips([]);
    if (result.removeIndexes?.length) {
      const drop = new Set(result.removeIndexes.map((i) => clips[i]?.id));
      setClips((cs) => cs.filter((c) => !drop.has(c.id)));
    }
    setChat((m) => [
      ...m,
      { id: uid(), role: 'you', text },
      { id: uid(), role: 'assistant', text: result.reply, proposals: result.proposals },
    ]);
    setDraft('');
  };
  const acceptProposal = (msgId: string, p: ProposedClip) => {
    addClip({ title: p.title, start: p.start, end: p.end, note: p.reason });
    setChat((m) =>
      m.map((x) => (x.id === msgId ? { ...x, proposals: x.proposals?.filter((q) => q !== p) } : x)),
    );
  };

  /* exports */
  const exportList = (kind: 'csv' | 'edl' | 'json') => {
    if (!source) return;
    const base = slugify(source.title);
    if (kind === 'csv') downloadText(`${base}-clips.csv`, clipsToCsv(clips, source.fileName), 'text/csv');
    if (kind === 'edl') downloadText(`${base}.edl`, clipsToEdl(clips, source.title, source.fileName), 'text/plain');
    if (kind === 'json') downloadText(`${base}-clips.json`, clipsToJson(clips, source.fileName), 'application/json');
  };
  const render = async (c: Clip) => {
    if (source?.kind !== 'local') return;
    setRendering((r) => ({ ...r, [c.id]: 0 }));
    try {
      const { renderClip } = await import('../../../components/admin/clipper/renderClip');
      const blob = await renderClip(source.file, c, renderMode, (p) => setRendering((r) => ({ ...r, [c.id]: p })));
      const ext = blob.type === 'video/webm' ? 'webm' : 'mp4';
      downloadBlob(`${slugify(source.title)}-${String(clips.indexOf(c) + 1).padStart(2, '0')}-${slugify(c.title)}.${ext}`, blob);
      setRendering((r) => {
        const next = { ...r };
        delete next[c.id];
        return next;
      });
    } catch {
      setRendering((r) => ({ ...r, [c.id]: 'error' }));
    }
  };
  const renderAll = async () => {
    for (const c of clips) {
      // one at a time: ffmpeg.wasm runs a single job
      await render(c);
    }
  };

  const activeCue = useMemo(() => cues.findIndex((c) => time >= c.start && time < c.end), [cues, time]);
  const shownCues = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase();
    return cues.map((c, i) => ({ c, i })).filter(({ c }) => !q || c.text.toLowerCase().includes(q) || c.speaker?.toLowerCase().includes(q));
  }, [cues, transcriptQuery]);

  if (!source) {
    return (
      <div className="space-y-4">
        <p className="max-w-2xl text-body-s text-muted2">
          Open a recording, then clip it three ways: tell the assistant what you want, mark in and out on the timeline,
          or pick lines from the transcript.
        </p>
        <SourcePicker onPick={openSource} />
      </div>
    );
  }

  const pendingOut = markOut ?? (markIn != null ? time : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            videoRef.current?.pause();
            setSource(null);
          }}
          className="inline-flex items-center gap-1 text-body-s text-muted2 hover:text-text"
        >
          <ChevronLeft className="size-4" aria-hidden /> Sources
        </button>
        <h2 className="display min-w-0 flex-1 truncate text-body-l text-text" title={source.title}>
          {source.title}
        </h2>
        <span className="meta rounded-[6px] bg-surface-2 px-2 py-1 text-faint">
          {source.kind === 'zoom' ? 'Zoom recording · cut list export' : 'Local file · renders MP4'}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-card bg-black shadow-card">
            <video
              ref={videoRef}
              src={source.url}
              className="aspect-video w-full bg-black"
              preload="metadata"
              playsInline
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => {
                setPlaying(false);
                setTime(videoRef.current?.currentTime ?? 0);
              }}
              onSeeked={() => setTime(videoRef.current?.currentTime ?? 0)}
              onClick={togglePlay}
            />
          </div>

          <div className="card flex flex-wrap items-center gap-2 p-2.5">
            <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} className="grid size-10 place-items-center rounded-[8px] bg-anchor text-ground">
              {playing ? <Pause className="size-4 fill-current" aria-hidden /> : <Play className="ms-0.5 size-4 fill-current" aria-hidden />}
            </button>
            <button type="button" onClick={() => seek(time - 5)} aria-label="Back 5 seconds" title="Back 5s (Shift+←)" className="grid size-9 place-items-center rounded-[8px] text-dim hover:bg-surface-2">
              <SkipBack className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => seek(time - FRAME)} aria-label="Back one frame" title="Back one frame (,)" className="grid size-9 place-items-center rounded-[8px] text-dim hover:bg-surface-2">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => seek(time + FRAME)} aria-label="Forward one frame" title="Forward one frame (.)" className="grid size-9 place-items-center rounded-[8px] text-dim hover:bg-surface-2">
              <ChevronRight className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => seek(time + 5)} aria-label="Forward 5 seconds" title="Forward 5s (Shift+→)" className="grid size-9 place-items-center rounded-[8px] text-dim hover:bg-surface-2">
              <SkipForward className="size-4" aria-hidden />
            </button>
            <span className="meta ms-1 tabular-nums text-dim">
              {formatTime(time)} <span className="text-faint">/ {formatTime(duration)}</span>
            </span>
            <label className="ms-1">
              <span className="sr-only">Playback speed</span>
              <select
                value={rate}
                onChange={(e) => {
                  const r = Number(e.target.value);
                  setRate(r);
                  if (videoRef.current) videoRef.current.playbackRate = r;
                }}
                className="h-9 rounded-[8px] bg-surface-2 px-2 text-body-s text-dim"
              >
                {[0.5, 1, 1.25, 1.5, 2].map((r) => (
                  <option key={r} value={r}>
                    {r}×
                  </option>
                ))}
              </select>
            </label>
            <span className="ms-auto flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setMarkIn(time)} title="Mark in (I)" className="h-9 rounded-[8px] bg-surface-2 px-3 text-body-s text-text hover:brightness-95">
                In <span className="meta tabular-nums text-faint">{markIn != null ? formatTime(markIn) : 'I'}</span>
              </button>
              <button type="button" onClick={() => setMarkOut(time)} title="Mark out (O)" className="h-9 rounded-[8px] bg-surface-2 px-3 text-body-s text-text hover:brightness-95">
                Out <span className="meta tabular-nums text-faint">{markOut != null ? formatTime(markOut) : 'O'}</span>
              </button>
              <button
                type="button"
                onClick={addFromMarks}
                disabled={markIn == null || (pendingOut ?? 0) <= markIn}
                title="Add clip (Enter)"
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-anchor px-3 text-body-s font-medium text-ground disabled:opacity-40"
              >
                <Plus className="size-4" aria-hidden /> Add clip
              </button>
            </span>
          </div>

          <Timeline
            duration={duration}
            time={time}
            clips={clips}
            selectedId={selectedId}
            markIn={markIn}
            markOut={markOut}
            cues={cues}
            onSeek={seek}
            onSelect={(id) => {
              setSelectedId(id);
              setPanel('clips');
              const c = clips.find((x) => x.id === id);
              if (c) seek(c.start);
            }}
          />
          <p className="meta text-faint">
            Space play · I in · O out · Enter add clip · ← → 1s · Shift 5s · , . one frame
          </p>
        </div>

        <aside className="card flex min-h-[32rem] flex-col overflow-hidden p-0 xl:max-h-[calc(100vh-12rem)]">
          <div role="tablist" aria-label="Clipper panels" className="flex border-b border-hairline">
            {(
              [
                ['assistant', 'Assistant', MessageSquare],
                ['clips', `Clips${clips.length ? ` (${clips.length})` : ''}`, Scissors],
                ['transcript', 'Transcript', FileVideo],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={panel === id}
                onClick={() => setPanel(id)}
                className={[
                  'relative flex flex-1 items-center justify-center gap-1.5 px-2 py-3 text-body-s transition-colors',
                  panel === id ? 'font-medium text-text' : 'text-muted2 hover:text-text',
                ].join(' ')}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {panel === id ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-anchor" /> : null}
              </button>
            ))}
          </div>

          {panel === 'assistant' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                {chat.map((m) => (
                  <div key={m.id} className={m.role === 'you' ? 'flex justify-end' : ''}>
                    <div
                      className={[
                        'max-w-[92%] rounded-[12px] px-3 py-2 text-body-s',
                        m.role === 'you' ? 'bg-anchor text-ground' : 'bg-surface-2 text-dim',
                      ].join(' ')}
                    >
                      <p className="whitespace-pre-line">{m.text}</p>
                      {m.proposals?.length ? (
                        <ul className="mt-2 space-y-1.5">
                          {m.proposals.map((p, i) => (
                            <li key={i} className="rounded-[8px] bg-surface p-2">
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-text">{p.title}</p>
                                  <button type="button" onClick={() => seek(p.start)} className="meta tabular-nums text-anchor hover:underline">
                                    {formatTime(p.start)} – {formatTime(p.end)}
                                  </button>
                                  {p.reason ? <p className="mt-1 line-clamp-2 text-xs text-muted2">{p.reason}</p> : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => acceptProposal(m.id, p)}
                                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[6px] bg-anchor px-2.5 text-xs font-medium text-ground"
                                >
                                  <Plus className="size-3.5" aria-hidden /> Add
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={send} className="flex items-end gap-2 border-t border-hairline p-3">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Tell the assistant what to clip</span>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={2}
                    placeholder={cues.length ? '12:30 to 14:05 ILD monitoring, or: find olanzapine' : '12:30 to 14:05 ILD monitoring'}
                    className="w-full resize-none rounded-[8px] bg-surface-2 px-3 py-2 text-body-s text-text outline-none focus-visible:ring-2 focus-visible:ring-anchor/40"
                  />
                </label>
                <button type="submit" aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-anchor text-ground">
                  <Send className="size-4" aria-hidden />
                </button>
              </form>
            </div>
          ) : null}

          {panel === 'clips' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                {clips.length === 0 ? (
                  <p className="p-4 text-body-s text-muted2">
                    No clips yet. Ask the assistant, or mark in (I) and out (O) and press Enter.
                  </p>
                ) : (
                  <ol className="divide-y divide-hairline">
                    {clips.map((c, i) => {
                      const r = rendering[c.id];
                      const open = c.id === selectedId;
                      return (
                        <li key={c.id} className={open ? 'bg-anchor/[0.05]' : ''}>
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: CLIP_COLORS[i % CLIP_COLORS.length] }} />
                            <button type="button" onClick={() => setSelectedId(open ? null : c.id)} className="min-w-0 flex-1 text-left">
                              <span className="block truncate text-body-s font-medium text-text">
                                {i + 1}. {c.title}
                              </span>
                              <span className="meta block tabular-nums text-faint">
                                {formatTime(c.start)} – {formatTime(c.end)} · {formatTime(c.end - c.start)}
                              </span>
                            </button>
                            <button type="button" onClick={() => previewClip(c)} aria-label={`Loop clip ${i + 1}`} title="Loop this clip" className="grid size-8 place-items-center rounded-[6px] text-dim hover:bg-surface-2">
                              <Repeat className="size-4" aria-hidden />
                            </button>
                            {source.kind === 'local' ? (
                              <button
                                type="button"
                                onClick={() => render(c)}
                                disabled={typeof r === 'number'}
                                aria-label={`Render clip ${i + 1}`}
                                title="Render MP4"
                                className="grid size-8 place-items-center rounded-[6px] text-dim hover:bg-surface-2 disabled:opacity-50"
                              >
                                {typeof r === 'number' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                              </button>
                            ) : null}
                            <button type="button" onClick={() => removeClip(c.id)} aria-label={`Delete clip ${i + 1}`} className="grid size-8 place-items-center rounded-[6px] text-dim hover:bg-surface-2 hover:text-text">
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </div>
                          {typeof r === 'number' ? (
                            <p className="meta px-5 pb-2 tabular-nums text-anchor">Rendering {Math.round(r * 100)}%</p>
                          ) : r === 'error' ? (
                            <p className="px-5 pb-2 text-xs text-dim">That render failed. Try Precise, or a shorter clip.</p>
                          ) : null}
                          {open ? (
                            <div className="space-y-2 px-5 pb-3">
                              <label className="block">
                                <span className="meta text-faint">Title</span>
                                <input
                                  value={c.title}
                                  onChange={(e) => updateClip(c.id, { title: e.target.value })}
                                  className="mt-1 h-9 w-full rounded-[6px] bg-surface-2 px-2.5 text-body-s text-text outline-none focus-visible:ring-2 focus-visible:ring-anchor/40"
                                />
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {(['start', 'end'] as const).map((edge) => (
                                  <div key={edge} className="rounded-[6px] bg-surface-2 p-2">
                                    <p className="meta text-faint">{edge === 'start' ? 'In' : 'Out'}</p>
                                    <p className="meta tabular-nums text-text">{formatTime(c[edge], 2)}</p>
                                    <div className="mt-1.5 flex gap-1">
                                      <button type="button" onClick={() => updateClip(c.id, { [edge]: Math.max(0, c[edge] - FRAME) })} className="h-7 flex-1 rounded-[5px] bg-surface text-xs text-dim" aria-label={`${edge === 'start' ? 'In' : 'Out'} back one frame`}>
                                        −1f
                                      </button>
                                      <button type="button" onClick={() => updateClip(c.id, { [edge]: time })} className="h-7 flex-[2] rounded-[5px] bg-surface text-xs text-anchor">
                                        Playhead
                                      </button>
                                      <button type="button" onClick={() => updateClip(c.id, { [edge]: c[edge] + FRAME })} className="h-7 flex-1 rounded-[5px] bg-surface text-xs text-dim" aria-label={`${edge === 'start' ? 'In' : 'Out'} forward one frame`}>
                                        +1f
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <label className="block">
                                <span className="meta text-faint">Note for the editor</span>
                                <textarea
                                  value={c.note ?? ''}
                                  onChange={(e) => updateClip(c.id, { note: e.target.value })}
                                  rows={2}
                                  className="mt-1 w-full resize-none rounded-[6px] bg-surface-2 px-2.5 py-1.5 text-body-s text-text outline-none focus-visible:ring-2 focus-visible:ring-anchor/40"
                                />
                              </label>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
              <div className="space-y-2 border-t border-hairline p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="meta me-1 text-faint">Cut list</span>
                  {(['csv', 'edl', 'json'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={!clips.length}
                      onClick={() => exportList(k)}
                      className="h-8 rounded-[6px] bg-surface-2 px-2.5 text-xs font-medium uppercase text-dim hover:text-text disabled:opacity-40"
                    >
                      {k}
                    </button>
                  ))}
                </div>
                {source.kind === 'local' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-dim">
                      <span className="sr-only">Render mode</span>
                      <select value={renderMode} onChange={(e) => setRenderMode(e.target.value as RenderMode)} className="h-8 rounded-[6px] bg-surface-2 px-2 text-xs">
                        <option value="fast">Fast (keyframe start)</option>
                        <option value="precise">Precise (re-encode)</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={renderAll}
                      disabled={!clips.length || Object.values(rendering).some((r) => typeof r === 'number')}
                      className="ms-auto inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-anchor px-3 text-xs font-medium text-ground disabled:opacity-40"
                    >
                      <Download className="size-3.5" aria-hidden /> Render all
                    </button>
                  </div>
                ) : (
                  <p className="text-xs leading-snug text-muted2">
                    Zoom recordings export a cut list. To render clip files here, download the recording and open it from your computer.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {panel === 'transcript' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              {transcript === 'ready' ? (
                <>
                  <label className="relative block border-b border-hairline p-3">
                    <span className="sr-only">Search the transcript</span>
                    <Search className="pointer-events-none absolute start-6 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
                    <input
                      type="search"
                      value={transcriptQuery}
                      onChange={(e) => setTranscriptQuery(e.target.value)}
                      placeholder="Search what was said"
                      className="h-9 w-full rounded-[8px] bg-surface-2 ps-9 pe-3 text-body-s text-text outline-none focus-visible:ring-2 focus-visible:ring-anchor/40"
                    />
                  </label>
                  <ol className="min-h-0 flex-1 overflow-y-auto p-2">
                    {shownCues.map(({ c, i }) => (
                      <li key={i}>
                        <div className={['group flex gap-2 rounded-[8px] px-2 py-1.5', i === activeCue ? 'bg-anchor/10' : 'hover:bg-surface-2'].join(' ')}>
                          <button type="button" onClick={() => seek(c.start)} className="meta w-14 shrink-0 pt-0.5 text-left tabular-nums text-anchor">
                            {formatTime(c.start, 0)}
                          </button>
                          <p className="min-w-0 flex-1 text-body-s text-dim">
                            {c.speaker ? <span className="font-medium text-text">{c.speaker}: </span> : null}
                            {c.text}
                          </p>
                          <span className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <button type="button" onClick={() => setMarkIn(c.start)} className="rounded-[5px] bg-surface px-1.5 text-[10px] text-dim" title="Mark in here">
                              In
                            </button>
                            <button type="button" onClick={() => setMarkOut(c.end)} className="rounded-[5px] bg-surface px-1.5 text-[10px] text-dim" title="Mark out here">
                              Out
                            </button>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <div className="space-y-3 p-4 text-body-s text-muted2">
                  {transcript === 'loading' ? (
                    <p className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the transcript
                    </p>
                  ) : transcript === 'blocked' ? (
                    <p>
                      This recording has a transcript, but storage won't hand it to the browser directly. Download it, then add it
                      below.
                    </p>
                  ) : transcript === 'error' ? (
                    <p>That file had no captions I could read. Try the .vtt from Zoom.</p>
                  ) : (
                    <p>No transcript for this recording. Add a .vtt or .srt to search what was said and clip from it.</p>
                  )}
                  {transcript === 'blocked' && transcriptLink ? (
                    <a href={transcriptLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-surface-2 px-3 font-medium text-anchor">
                      <Download className="size-4" aria-hidden /> Download transcript
                    </a>
                  ) : null}
                  {transcript !== 'loading' ? (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[8px] bg-surface-2 px-3 py-2.5">
                      <span className="text-dim">Add a transcript (.vtt or .srt)</span>
                      <span className="font-medium text-anchor">Choose</span>
                      <input
                        type="file"
                        accept=".vtt,.srt,text/vtt"
                        className="sr-only"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setTranscript('loading');
                          loadTranscriptText(await f.text());
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
