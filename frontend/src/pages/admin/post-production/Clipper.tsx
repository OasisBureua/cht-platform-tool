import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Minimize2,
  Pause,
  Play,
  Plus,
  Repeat,
  Scissors,
  Search,
  SkipBack,
  SkipForward,
  Smartphone,
  Trash2,
  Undo2,
} from 'lucide-react';
import { adminApi } from '../../../api/admin';
import {
  ASSISTANT_HELP,
  clipsToCsv,
  clipsToEdl,
  clipsToJson,
  formatTime,
  interpretRequest,
  parseCaptions,
  slugify,
  tightenToSpeech,
  type Clip,
  type Cue,
  type ProposedClip,
  type Verdict,
} from '../../../components/admin/clipper/clipperCore';
import type { RenderMode } from '../../../components/admin/clipper/renderClip';
import { ClipComposer } from '../../../components/admin/clipper/ClipComposer';
import { ClipTimeline } from '../../../components/admin/clipper/ClipTimeline';
import { pickTranscript, type Source } from '../../../components/admin/clipper/sources';
import { useFilmstrip, useWaveform, type Thumb } from '../../../components/admin/clipper/useMediaPreview';
import { DEFAULT_FORMAT, type CutFormat } from '../../../components/admin/clipper/socialCut';
import { CutPreview, OutputPanel } from '../../../components/admin/clipper/OutputPanel';

/**
 * Post-production › Clipper. Describe the clips, add a recording, then
 * direct the cut: ask for changes in the Direct panel, trim on the
 * timeline, or select lines of the transcript.
 *
 * Explicit requests (times, splits, tightening) apply straight away with
 * an undo; anything found in the transcript comes back as suggestions.
 *
 * Two sources. A Zoom recording plays from its signed link and exports a
 * cut list (CSV, EDL, JSON); the bucket doesn't let the browser read its
 * bytes, so it can't be cut here and the timeline shows speech instead of
 * frames and sound. A file from the computer does everything, including
 * rendering clips. Work is saved in this browser per source.
 */

type TranscriptState = 'none' | 'loading' | 'ready' | 'blocked' | 'error';
type Panel = 'direct' | 'clips' | 'transcript' | 'output';
type Suggestion = ProposedClip & { verdict?: Verdict; quote?: string };
type ChatMessage = { id: string; role: 'you' | 'assistant'; text: string; proposals?: Suggestion[]; before?: Clip[]; undone?: boolean };

const FORMAT_KEY = 'chm-clipper-format';
function loadFormat(): CutFormat {
  try {
    const raw = window.localStorage.getItem(FORMAT_KEY);
    return raw ? { ...DEFAULT_FORMAT, ...(JSON.parse(raw) as Partial<CutFormat>) } : DEFAULT_FORMAT;
  } catch {
    return DEFAULT_FORMAT;
  }
}

const VERDICT_STYLE: Record<Verdict, string> = {
  strong: 'bg-anchor text-ground',
  maybe: 'bg-amber-400/90 text-[#22303C]',
  skip: 'bg-surface-2 text-faint',
};
function VerdictBadge({ v }: { v: Verdict }) {
  return <span className={['meta inline-flex h-5 items-center rounded-full px-2 capitalize', VERDICT_STYLE[v]].join(' ')}>{v}</span>;
}

const FRAME = 1 / 30;
const CLIP_COLORS = ['#2eaacc', '#e2704a', '#8b6ad8', '#2f9e6b', '#d9a13b', '#d0548f'];
const uid = () => Math.random().toString(36).slice(2, 10);
const byStart = (a: Clip, b: Clip) => a.start - b.start;

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
const downloadText = (name: string, text: string, type: string) => downloadBlob(name, new Blob([text], { type }));

const nearestThumb = (thumbs: Thumb[], t: number) =>
  thumbs.length ? thumbs.reduce((best, th) => (Math.abs(th.t - t) < Math.abs(best.t - t) ? th : best)) : null;

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
  const [panel, setPanel] = useState<Panel>('direct');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [transcriptQuery, setTranscriptQuery] = useState('');
  const [lineSel, setLineSel] = useState<{ from: number; to: number } | null>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('fast');
  const [format, setFormat] = useState<CutFormat>(loadFormat);
  const [rendering, setRendering] = useState<Record<string, number | 'error'>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<Clip | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const live = useRef({ duration: 0, cues: [] as Cue[], clips: [] as Clip[] });
  const pending = useRef<{ prompt: string | null; transcriptDone: boolean }>({ prompt: null, transcriptDone: true });

  const localFile = source?.kind === 'local' ? source.file : null;
  const thumbs = useFilmstrip(source?.kind === 'local' ? source.url : null, duration);
  const peaks = useWaveform(localFile);

  useEffect(() => {
    live.current = { duration, cues, clips };
  }, [duration, cues, clips]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FORMAT_KEY, JSON.stringify(format));
    } catch {
      /* ignore */
    }
  }, [format]);

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

  /* the assistant */
  const runRequest = useCallback((text: string, override?: { duration?: number; cues?: Cue[] }) => {
    const ctx = { ...live.current, ...override };
    const result = interpretRequest(text, { duration: ctx.duration, cues: ctx.cues, clipCount: ctx.clips.length });
    let before: Clip[] | undefined;
    let proposals: Suggestion[] = result.proposals;
    if (result.format) setFormat((f) => ({ ...f, ...result.format }));
    if (result.clearAll) {
      before = ctx.clips;
      setClips([]);
    }
    if (result.removeIndexes?.length) {
      before = ctx.clips;
      const drop = new Set(result.removeIndexes);
      setClips((cs) => cs.filter((_, i) => !drop.has(i)));
    }
    if (result.tighten) {
      before = ctx.clips;
      setClips((cs) => cs.map((c) => tightenToSpeech(c, ctx.cues)));
    }
    if ((result.kind === 'times' || result.kind === 'split') && proposals.length) {
      before = ctx.clips;
      const added = proposals.map((p) => ({ id: uid(), title: p.title, start: p.start, end: p.end, note: p.reason }));
      setClips((cs) => [...cs, ...added].sort(byStart));
      setSelectedId(added[0].id);
      proposals = [];
    }
    setChat((m) => [
      ...m,
      { id: uid(), role: 'you', text },
      { id: uid(), role: 'assistant', text: result.reply, proposals: proposals.length ? proposals : undefined, before },
    ]);
  }, []);

  const tryPending = useCallback(
    (override?: { duration?: number; cues?: Cue[] }) => {
      const p = pending.current;
      const dur = override?.duration ?? live.current.duration;
      if (!p.prompt || !p.transcriptDone || !(dur > 0)) return;
      const prompt = p.prompt;
      p.prompt = null;
      runRequest(prompt, override);
    },
    [runRequest],
  );

  const finishTranscript = useCallback(
    (parsed: Cue[], state: TranscriptState) => {
      setCues(parsed);
      setTranscript(state);
      pending.current.transcriptDone = true;
      tryPending({ cues: parsed });
    },
    [tryPending],
  );

  const loadTranscriptText = useCallback(
    (text: string) => {
      const parsed = parseCaptions(text);
      finishTranscript(parsed, parsed.length ? 'ready' : 'error');
    },
    [finishTranscript],
  );

  const openSource = useCallback(
    async (s: Source, captions: File | undefined, prompt: string) => {
      setSource(s);
      setClips(loadSaved(s.key));
      setSelectedId(null);
      setMarkIn(null);
      setMarkOut(null);
      setCues([]);
      setDuration(0);
      setTime(0);
      setLineSel(null);
      setTranscriptLink(null);
      setPanel('direct');
      setChat([{ id: uid(), role: 'assistant', text: ASSISTANT_HELP }]);
      pending.current = { prompt: prompt || null, transcriptDone: false };
      if (captions) {
        setTranscript('loading');
        loadTranscriptText(await captions.text());
        return;
      }
      if (s.kind === 'zoom') {
        const t = pickTranscript(s.files);
        if (!t) {
          finishTranscript([], 'none');
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
          finishTranscript([], 'blocked');
        }
      } else {
        finishTranscript([], 'none');
      }
    },
    [loadTranscriptText, finishTranscript],
  );

  /* playback */
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
    const el = videoRef.current;
    if (!el) return;
    setSelectedId(c.id);
    loopRef.current = c;
    el.currentTime = c.start;
    void el.play();
  };

  /* clips */
  const addClip = useCallback((p: Omit<Clip, 'id'>) => {
    const clip: Clip = { ...p, id: uid(), start: Math.max(0, p.start), end: Math.max(p.start + 0.1, p.end) };
    setClips((cs) => [...cs, clip].sort(byStart));
    setSelectedId(clip.id);
    return clip;
  }, []);
  const addFromMarks = useCallback(() => {
    if (markIn == null) return;
    const end = markOut ?? videoRef.current?.currentTime ?? markIn;
    if (end <= markIn) return;
    addClip({ title: `Clip ${clips.length + 1}`, start: markIn, end });
    setMarkIn(null);
    setMarkOut(null);
  }, [markIn, markOut, clips.length, addClip]);
  const updateClip = (id: string, patch: Partial<Clip>) =>
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)).sort(byStart));
  const removeClip = (id: string) => setClips((cs) => cs.filter((c) => c.id !== id));
  const trimClip = useCallback((id: string, edge: 'start' | 'end', t: number) => {
    setClips((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c;
        return edge === 'start' ? { ...c, start: Math.max(0, Math.min(t, c.end - 0.2)) } : { ...c, end: Math.max(t, c.start + 0.2) };
      }),
    );
  }, []);

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

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    runRequest(text);
    setDraft('');
  };
  const asClip = (p: Suggestion): Omit<Clip, 'id'> => ({ title: p.title, start: p.start, end: p.end, note: p.quote ? `“${p.quote}”` : p.reason, verdict: p.verdict });
  const acceptProposal = (msgId: string, p: Suggestion) => {
    addClip(asClip(p));
    setChat((m) => m.map((x) => (x.id === msgId ? { ...x, proposals: x.proposals?.filter((q) => q !== p) } : x)));
  };
  const acceptAll = (msgId: string, ps: Suggestion[]) => {
    const added = ps.map((p) => ({ id: uid(), ...asClip(p) }));
    setClips((cs) => [...cs, ...added].sort(byStart));
    const taken = new Set(ps);
    setChat((m) => m.map((x) => (x.id === msgId ? { ...x, proposals: x.proposals?.filter((q) => !taken.has(q)) } : x)));
  };
  const undo = (msg: ChatMessage) => {
    if (!msg.before) return;
    setClips(msg.before);
    setChat((m) => m.map((x) => (x.id === msg.id ? { ...x, undone: true } : x)));
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

  /* transcript */
  const activeCue = useMemo(() => cues.findIndex((c) => time >= c.start && time < c.end), [cues, time]);
  const shownCues = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase();
    return cues.map((c, i) => ({ c, i })).filter(({ c }) => !q || c.text.toLowerCase().includes(q) || c.speaker?.toLowerCase().includes(q));
  }, [cues, transcriptQuery]);
  const selRange = lineSel ? { from: Math.min(lineSel.from, lineSel.to), to: Math.max(lineSel.from, lineSel.to) } : null;
  const pickLine = (i: number, extend: boolean) =>
    setLineSel((s) => (extend && s ? { from: s.from, to: i } : s && s.from === i && s.to === i ? null : { from: i, to: i }));
  const clipLines = () => {
    if (!selRange) return;
    const first = cues[selRange.from];
    const last = cues[selRange.to];
    const words = first.text.split(/\s+/).slice(0, 8).join(' ');
    addClip({
      title: words.length < first.text.length ? `${words}…` : words,
      start: Math.max(0, first.start - 0.3),
      end: last.end + 0.3,
      note: cues.slice(selRange.from, selRange.to + 1).map((c) => c.text).join(' ').slice(0, 280),
    });
    setLineSel(null);
    setPanel('clips');
  };

  if (!source) {
    return <ClipComposer onStart={(s, captions, prompt) => void openSource(s, captions, prompt)} />;
  }

  const pendingOut = markOut ?? (markIn != null ? time : null);
  const quick = [
    cues.length ? 'Moments worth clipping' : null,
    cues.length ? 'Every audience question' : null,
    cues.length && clips.length ? 'Tighten to speech' : null,
    'Split into 3-minute clips',
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            videoRef.current?.pause();
            setSource(null);
          }}
          className="inline-flex h-9 items-center gap-1 rounded-[8px] px-2 text-body-s text-muted2 hover:bg-surface-2 hover:text-text"
        >
          <ChevronLeft className="size-4" aria-hidden /> New clip job
        </button>
        <h2 className="display min-w-0 flex-1 truncate text-body-l text-text" title={source.title}>
          {source.title}
        </h2>
        <span className="meta rounded-[6px] bg-surface-2 px-2 py-1 text-faint">
          {source.kind === 'zoom' ? 'Zoom recording · cut list export' : 'Local file · renders MP4'}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[23rem_minmax(0,1fr)]">
        {/* left: direct, clips, transcript */}
        <aside className="card order-2 flex min-h-[30rem] flex-col overflow-hidden p-0 xl:sticky xl:top-4 xl:order-1 xl:h-[calc(100dvh-9.5rem)]">
          <div role="tablist" aria-label="Clipper panels" className="flex border-b border-hairline">
            {(
              [
                ['direct', 'Direct', MessageSquare],
                ['clips', `Clips${clips.length ? ` (${clips.length})` : ''}`, Scissors],
                ['transcript', 'Transcript', FileText],
                ['output', 'Output', Smartphone],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={panel === id}
                onClick={() => setPanel(id)}
                className={[
                  'relative flex flex-1 items-center justify-center gap-1.5 px-1.5 py-3 text-[13px] transition-colors',
                  panel === id ? 'font-medium text-text' : 'text-muted2 hover:text-text',
                ].join(' ')}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {panel === id ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-anchor" /> : null}
              </button>
            ))}
          </div>

          {panel === 'direct' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                {chat.map((m) =>
                  m.role === 'you' ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[88%] rounded-[12px] bg-surface-2 px-3 py-2 text-body-s text-text">{m.text}</p>
                    </div>
                  ) : (
                    <div key={m.id} className="space-y-2">
                      <p className="flex gap-2 text-body-s text-dim">
                        {m.before ? <Check className="mt-0.5 size-4 shrink-0 text-anchor" aria-hidden /> : null}
                        <span className="whitespace-pre-line">{m.text}</span>
                      </p>
                      {m.before ? (
                        m.undone ? (
                          <p className="meta ps-6 text-faint">Undone</p>
                        ) : (
                          <button type="button" onClick={() => undo(m)} className="meta ms-6 inline-flex items-center gap-1 text-anchor hover:underline">
                            <Undo2 className="size-3.5" aria-hidden /> Undo
                          </button>
                        )
                      ) : null}
                      {m.proposals?.length ? (
                        <div className="space-y-1.5">
                          <ul className="space-y-1.5">
                            {m.proposals.map((p, i) => {
                              const th = nearestThumb(thumbs, p.start);
                              return (
                                <li key={i} className="flex items-start gap-2.5 rounded-[10px] bg-surface-2 p-2">
                                  {th ? <img src={th.url} alt="" className="aspect-video w-16 shrink-0 rounded-[6px] object-cover" /> : null}
                                  <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1.5">
                                      {p.verdict ? <VerdictBadge v={p.verdict} /> : null}
                                      <span className="truncate text-body-s font-medium text-text">{p.title}</span>
                                    </p>
                                    <button type="button" onClick={() => seek(p.start)} className="meta tabular-nums text-anchor hover:underline">
                                      {formatTime(p.start, 0)} – {formatTime(p.end, 0)} · {Math.round(p.end - p.start)}s
                                    </button>
                                    {p.quote ? (
                                      <p className="mt-1 line-clamp-3 text-xs text-dim">“{p.quote}”</p>
                                    ) : p.reason ? (
                                      <p className="mt-0.5 line-clamp-2 text-xs text-muted2">{p.reason}</p>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => acceptProposal(m.id, p)}
                                    aria-label={`Add ${p.title}`}
                                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[6px] bg-anchor px-2.5 text-xs font-medium text-ground"
                                  >
                                    <Plus className="size-3.5" aria-hidden /> Add
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                          <div className="flex flex-wrap gap-3">
                            {m.proposals.filter((p) => p.verdict === 'strong').length > 1 ? (
                              <button type="button" onClick={() => acceptAll(m.id, (m.proposals ?? []).filter((p) => p.verdict === 'strong'))} className="meta inline-flex items-center gap-1 text-anchor hover:underline">
                                <Plus className="size-3.5" aria-hidden /> Add the {m.proposals.filter((p) => p.verdict === 'strong').length} strong ones
                              </button>
                            ) : null}
                            {m.proposals.length > 1 ? (
                              <button type="button" onClick={() => acceptAll(m.id, m.proposals ?? [])} className="meta inline-flex items-center gap-1 text-anchor hover:underline">
                                <Plus className="size-3.5" aria-hidden /> Add all {m.proposals.length}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ),
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-hairline p-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {quick.map((text) => (
                    <button key={text} type="button" onClick={() => runRequest(text)} className="h-7 rounded-full bg-surface-2 px-2.5 text-xs text-dim hover:text-text">
                      {text}
                    </button>
                  ))}
                </div>
                <form onSubmit={send} className="flex items-end gap-2 rounded-[12px] bg-surface-2 p-1.5 ps-3 focus-within:ring-2 focus-within:ring-anchor/40">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Tell the clipper what to change</span>
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
                      placeholder={cues.length ? 'Find olanzapine, or 12:30 to 14:05 ILD monitoring' : '12:30 to 14:05 ILD monitoring'}
                      className="block w-full resize-none bg-transparent py-1.5 text-body-s text-text outline-none placeholder:text-faint"
                    />
                  </label>
                  <button type="submit" aria-label="Send" disabled={!draft.trim()} className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-anchor text-ground disabled:opacity-40">
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {panel === 'clips' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                {clips.length === 0 ? (
                  <p className="p-4 text-body-s text-muted2">No clips yet. Ask in Direct, select transcript lines, or mark in (I) and out (O) and press Enter.</p>
                ) : (
                  <ol className="divide-y divide-hairline">
                    {clips.map((c, i) => {
                      const r = rendering[c.id];
                      const open = c.id === selectedId;
                      const th = nearestThumb(thumbs, c.start);
                      return (
                        <li key={c.id} className={open ? 'bg-anchor/[0.05]' : ''}>
                          <div className="flex items-center gap-2.5 px-3 py-2.5">
                            {th ? (
                              <span className="relative shrink-0">
                                <img src={th.url} alt="" className="aspect-video w-14 rounded-[6px] object-cover" />
                                <span className="absolute inset-x-0 bottom-0 h-1 rounded-b-[6px]" style={{ background: CLIP_COLORS[i % CLIP_COLORS.length] }} />
                              </span>
                            ) : (
                              <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: CLIP_COLORS[i % CLIP_COLORS.length] }} />
                            )}
                            <button type="button" onClick={() => setSelectedId(open ? null : c.id)} className="min-w-0 flex-1 text-left">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-body-s font-medium text-text">
                                  {i + 1}. {c.title}
                                </span>
                                {c.verdict ? <VerdictBadge v={c.verdict} /> : null}
                              </span>
                              <span className="meta block tabular-nums text-faint">
                                {formatTime(c.start)} – {formatTime(c.end)} · {formatTime(c.end - c.start)}
                              </span>
                            </button>
                            <button type="button" onClick={() => previewClip(c)} aria-label={`Loop clip ${i + 1}`} title="Loop this clip" className="grid size-8 place-items-center rounded-[6px] text-dim hover:bg-surface-2">
                              <Repeat className="size-4" aria-hidden />
                            </button>
                            {source.kind === 'local' ? (
                              <button type="button" onClick={() => render(c)} disabled={typeof r === 'number'} aria-label={`Render clip ${i + 1}`} title="Render MP4" className="grid size-8 place-items-center rounded-[6px] text-dim hover:bg-surface-2 disabled:opacity-50">
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
                                <input value={c.title} onChange={(e) => updateClip(c.id, { title: e.target.value })} className="mt-1 h-9 w-full rounded-[6px] bg-surface-2 px-2.5 text-body-s text-text outline-none focus-visible:ring-2 focus-visible:ring-anchor/40" />
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
                              {cues.length ? (
                                <button type="button" onClick={() => setClips((cs) => cs.map((x) => (x.id === c.id ? tightenToSpeech(x, cues) : x)))} className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-surface-2 px-2.5 text-xs text-dim hover:text-text">
                                  <Minimize2 className="size-3.5" aria-hidden /> Tighten to speech
                                </button>
                              ) : null}
                              <label className="block">
                                <span className="meta text-faint">Note for the editor</span>
                                <textarea value={c.note ?? ''} onChange={(e) => updateClip(c.id, { note: e.target.value })} rows={2} className="mt-1 w-full resize-none rounded-[6px] bg-surface-2 px-2.5 py-1.5 text-body-s text-text outline-none focus-visible:ring-2 focus-visible:ring-anchor/40" />
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
                    <button key={k} type="button" disabled={!clips.length} onClick={() => exportList(k)} className="h-8 rounded-[6px] bg-surface-2 px-2.5 text-xs font-medium uppercase text-dim hover:text-text disabled:opacity-40">
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
                  <p className="text-xs leading-snug text-muted2">Zoom recordings export a cut list. To render clip files here, download the recording and open it from your computer.</p>
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
                    <input type="search" value={transcriptQuery} onChange={(e) => setTranscriptQuery(e.target.value)} placeholder="Search what was said" className="h-9 w-full rounded-[8px] bg-surface-2 ps-9 pe-3 text-body-s text-text outline-none focus-visible:ring-2 focus-visible:ring-anchor/40" />
                  </label>
                  <p className="meta px-4 pt-2 text-faint">Select a line to clip it; shift-click to take a run of lines.</p>
                  <ol className="min-h-0 flex-1 overflow-y-auto p-2">
                    {shownCues.map(({ c, i }) => {
                      const picked = selRange != null && i >= selRange.from && i <= selRange.to;
                      return (
                        <li key={i}>
                          <div className={['flex gap-2 rounded-[8px] px-2 py-1.5', picked ? 'bg-anchor/15 ring-1 ring-inset ring-anchor/40' : i === activeCue ? 'bg-surface-2' : 'hover:bg-surface-2'].join(' ')}>
                            <button type="button" onClick={() => seek(c.start)} className="meta w-12 shrink-0 pt-0.5 text-left tabular-nums text-anchor" aria-label={`Play from ${formatTime(c.start, 0)}`}>
                              {formatTime(c.start, 0)}
                            </button>
                            <button type="button" aria-pressed={picked} onClick={(e) => pickLine(i, e.shiftKey)} className="min-w-0 flex-1 text-left text-body-s text-dim">
                              {c.speaker ? <span className="font-medium text-text">{c.speaker}: </span> : null}
                              {c.text}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {selRange ? (
                    <div className="flex items-center gap-2 border-t border-hairline p-3">
                      <span className="meta min-w-0 flex-1 tabular-nums text-dim">
                        {selRange.to - selRange.from + 1} {selRange.to === selRange.from ? 'line' : 'lines'} · {formatTime(cues[selRange.to].end - cues[selRange.from].start, 0)}
                      </span>
                      <button type="button" onClick={() => setLineSel(null)} className="h-8 rounded-[6px] px-2.5 text-xs text-dim hover:bg-surface-2">
                        Clear
                      </button>
                      <button type="button" onClick={clipLines} className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-anchor px-3 text-xs font-medium text-ground">
                        <Scissors className="size-3.5" aria-hidden /> Make clip
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3 p-4 text-body-s text-muted2">
                  {transcript === 'loading' ? (
                    <p className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the transcript
                    </p>
                  ) : transcript === 'blocked' ? (
                    <p>This recording has a transcript, but storage won't hand it to the browser directly. Download it, then add it below.</p>
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

          {panel === 'output' ? (
            <OutputPanel
              format={format}
              onChange={(patch) => setFormat((f) => ({ ...f, ...patch }))}
              cues={cues}
              clips={clips}
              selectedId={selectedId}
              source={source}
              colors={CLIP_COLORS}
            />
          ) : null}
        </aside>

        {/* right: the picture, transport and timeline */}
        <div className="order-1 min-w-0 space-y-3 xl:order-2">
          <div className="flex flex-col gap-3 lg:flex-row">
          <div className="min-w-0 flex-1 overflow-hidden rounded-card bg-black shadow-card">
            <video
              ref={videoRef}
              src={source.url}
              className="aspect-video max-h-[min(54vh,32rem)] w-full bg-black object-contain"
              preload="metadata"
              playsInline
              onLoadedMetadata={(e) => {
                const dur = e.currentTarget.duration || 0;
                setDuration(dur);
                tryPending({ duration: dur });
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => {
                setPlaying(false);
                setTime(videoRef.current?.currentTime ?? 0);
              }}
              onSeeked={() => setTime(videoRef.current?.currentTime ?? 0)}
              onClick={togglePlay}
            />
          </div>
          <CutPreview videoRef={videoRef} format={format} cues={cues} time={time} playing={playing} onOpen={() => setPanel('output')} />
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

          <ClipTimeline
            duration={duration}
            time={time}
            clips={clips}
            colors={CLIP_COLORS}
            selectedId={selectedId}
            markIn={markIn}
            markOut={markOut}
            cues={cues}
            thumbs={thumbs}
            peaks={peaks}
            onSeek={seek}
            onSelect={(id) => {
              setSelectedId(id);
              const c = clips.find((x) => x.id === id);
              if (c) seek(c.start);
            }}
            onTrim={trimClip}
          />
          <p className="meta text-faint">Space play · I in · O out · Enter add clip · ← → 1s · Shift 5s · , . one frame · drag a selected clip's edges to trim</p>
        </div>
      </div>
    </div>
  );
}
