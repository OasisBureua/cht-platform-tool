/**
 * The clipper's pure logic: timecodes, captions, the clip assistant's
 * interpreter and the cut-list exporters. No DOM, so all of it is covered
 * by unit tests (src/test/components/clipper.test.ts).
 */

export type Verdict = 'strong' | 'maybe' | 'skip';

export type Clip = {
  id: string;
  title: string;
  start: number;
  end: number;
  note?: string;
  /** Set when the clip came from the moment finder. */
  verdict?: Verdict;
};

export type Cue = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

export type ProposedClip = Omit<Clip, 'id'> & { reason?: string };

/* ── timecodes ─────────────────────────────────────────────────── */

/** `3725.4` → `1:02:05.4`; under an hour → `2:05.4`. */
export function formatTime(sec: number, decimals = 1): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = s.toFixed(decimals).padStart(decimals ? 3 + decimals : 2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** SMPTE non-drop `HH:MM:SS:FF`, as edit decision lists expect. */
export function formatSmpte(sec: number, fps = 30): string {
  const total = Math.max(0, Math.round(sec * fps));
  const f = total % fps;
  const s = Math.floor(total / fps) % 60;
  const m = Math.floor(total / (fps * 60)) % 60;
  const h = Math.floor(total / (fps * 3600));
  return [h, m, s, f].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Reads the ways people write a time: `12:30`, `1:02:10`, `12:30.5`,
 * `90s`, `90 sec`, `1m30s`, `2 min`, `1h2m`, or a bare number of seconds.
 */
export function parseTime(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const colon = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d+))?$/.exec(t);
  if (colon) {
    const [, a, b, c, frac] = colon;
    const parts = c !== undefined ? [Number(a), Number(b), Number(c)] : [0, Number(a), Number(b)];
    if (parts[1] > 59 || parts[2] > 59) return null;
    return parts[0] * 3600 + parts[1] * 60 + parts[2] + (frac ? Number(`0.${frac}`) : 0);
  }
  const units = /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:utes?|s)?)?)?\s*(?:(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?|s)?)?)?$/.exec(t);
  if (units && (units[1] || units[2] || units[3])) {
    return Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0);
  }
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  return null;
}

/* ── captions ──────────────────────────────────────────────────── */

const CUE_TIME = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/;

function cueTime(raw: string): number {
  const norm = raw.trim().replace(',', '.');
  const parts = norm.split(':').map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}

/**
 * Parses WebVTT (Zoom's transcript and closed-caption files) and SRT.
 * A leading `Name:` on a cue becomes its speaker, which is how Zoom
 * attributes lines.
 */
export function parseCaptions(text: string): Cue[] {
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const am = CUE_TIME.exec(a);
    const bm = CUE_TIME.exec(b ?? '');
    if (!am || !bm) continue;
    const body = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (!body) continue;
    const sp = /^([A-Z][\w.'’ -]{1,48}):\s+(.+)$/.exec(body);
    cues.push({
      start: cueTime(am[0]),
      end: cueTime(bm[0]),
      text: sp ? sp[2] : body,
      speaker: sp ? sp[1].trim() : undefined,
    });
  }
  return cues.sort((x, y) => x.start - y.start);
}

/* ── the clip assistant ────────────────────────────────────────── */

const TIME_TOKEN =
  String.raw`(?:\d{1,2}:\d{1,2}(?::\d{1,2})?(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)(?:\s*\d+(?:\.\d+)?\s*(?:m|min|mins|minutes?|s|sec|secs|seconds?))*)`;
const RANGE = new RegExp(String.raw`(${TIME_TOKEN})\s*(?:-|–|—|to|until|till|through|thru)\s*(${TIME_TOKEN})`, 'gi');
const AT_FOR = new RegExp(String.raw`(?:at|from)\s+(${TIME_TOKEN})\s+for\s+(${TIME_TOKEN})`, 'i');
const FIRST_LAST = new RegExp(String.raw`\b(first|last|final|opening|closing)\s+(${TIME_TOKEN})`, 'i');

const STOP = new Set(
  'a an the and or of to in on for with about from where when what who how is are was were be it its this that these those they them their he she his her we our you your i me my do does did can could would should please clip clips make cut find search show look get give pull part parts bit bits section sections moment moments talk talks talking discuss discusses discussing discussed mention mentions mentioning mentioned say says said any all some there here just also into over out up them topic'.split(
    ' ',
  ),
);

function titleFrom(rest: string, fallback: string): string {
  const quoted = /["“'‘]([^"”'’]{2,90})["”'’]/.exec(rest);
  if (quoted) return quoted[1].trim();
  const cleaned = rest
    .replace(/^[\s,:;–—-]*(?:clip|cut|make|add|call it|titled?|named?|about|on|re|for)?[\s,:;–—-]*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 91) : fallback;
}

function termsOf(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+\-\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Transcript search: cues that mention the terms, merged into windows
 * when they sit within 20 seconds of each other, padded a little so a
 * clip doesn't start mid-word, capped at three minutes, best first.
 */
export function searchTranscript(cues: Cue[], query: string, limit = 5): ProposedClip[] {
  const terms = termsOf(query);
  if (!terms.length || !cues.length) return [];
  const hits = cues
    .map((c) => {
      const hay = c.text.toLowerCase();
      const score = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
      return { c, score };
    })
    .filter((h) => h.score > 0);
  const windows: { start: number; end: number; score: number; first: Cue }[] = [];
  for (const { c, score } of hits) {
    const last = windows[windows.length - 1];
    if (last && c.start - last.end <= 20 && c.end - last.start <= 180) {
      last.end = Math.max(last.end, c.end);
      last.score += score;
    } else {
      windows.push({ start: c.start, end: c.end, score, first: c });
    }
  }
  const label = query.trim().replace(/^(find|search|where|show me|look for)\s+/i, '');
  return windows
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, limit)
    .map((w) => ({
      title: titleFrom(label, 'Transcript match'),
      start: Math.max(0, w.start - 2),
      end: w.end + 2,
      reason: `${w.first.speaker ? `${w.first.speaker}: ` : ''}“${w.first.text.slice(0, 120)}${w.first.text.length > 120 ? '…' : ''}”`,
    }));
}

/**
 * Audience questions: cues that ask something, each taken with the answer
 * that follows it, up to the next question or `maxLen` seconds.
 */
export function findQuestions(cues: Cue[], maxLen = 120, limit = 12): ProposedClip[] {
  const asks = cues.map((c, i) => ({ c, i })).filter(({ c }) => /\?\s*$|\?["”']?\s/.test(c.text) && c.text.trim().split(/\s+/).length >= 4);
  return asks.slice(0, limit).map(({ c, i }, k) => {
    const nextAsk = asks[k + 1]?.c.start ?? Infinity;
    let end = c.end;
    // the answer runs until the next question, a pause of more than 8s, or maxLen
    for (let j = i + 1; j < cues.length && cues[j].start < nextAsk && cues[j].start - end <= 8 && cues[j].end - c.start <= maxLen; j++) end = cues[j].end;
    const words = c.text.replace(/\?.*$/s, '?');
    return {
      title: titleFrom(words.length > 70 ? words.slice(0, 68) + '…' : words, 'Audience question'),
      start: Math.max(0, c.start - 1),
      end: end + 1,
      reason: `${c.speaker ? `${c.speaker}: ` : ''}“${c.text.slice(0, 120)}${c.text.length > 120 ? '…' : ''}”`,
    };
  });
}

/** Back-to-back clips of `len` seconds across the recording. */
export function splitEvenly(duration: number, len: number, startIndex = 0): ProposedClip[] {
  if (!(duration > 0) || !(len > 0)) return [];
  const out: ProposedClip[] = [];
  for (let s = 0, i = 0; s < duration - 0.5 && i < 200; s += len, i++) {
    out.push({ title: `Part ${startIndex + i + 1}`, start: s, end: Math.min(duration, s + len) });
  }
  return out;
}

/**
 * Pulls a clip's edges in to the speech inside it, so it doesn't open or
 * close on dead air. Leaves the clip alone if no one speaks inside it.
 */
export function tightenToSpeech<T extends { start: number; end: number }>(clip: T, cues: Cue[], pad = 0.25): T {
  const inside = cues.filter((c) => c.end > clip.start && c.start < clip.end);
  if (!inside.length) return clip;
  const start = Math.max(clip.start, inside[0].start - pad);
  const end = Math.min(clip.end, inside[inside.length - 1].end + pad);
  return end - start > 0.5 ? { ...clip, start, end } : clip;
}

/* ── moments worth clipping ────────────────────────────────────── */

export type Sentence = { start: number; end: number; text: string; speaker?: string };

/**
 * The transcript as sentences with times. Cues are split on sentence ends,
 * with time shared out by length, and a sentence that runs across cues is
 * joined back up when the same person keeps talking.
 */
export function sentencesOf(cues: Cue[]): Sentence[] {
  const out: Sentence[] = [];
  let open: Sentence | null = null;
  for (const c of cues) {
    const text = c.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (open && (open.speaker !== c.speaker || c.start - open.end > 1.5)) {
      out.push(open);
      open = null;
    }
    const pieces = text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [text];
    const span = Math.max(0.01, c.end - c.start);
    let at = 0;
    for (const raw of pieces) {
      const piece = raw.trim();
      const from = c.start + (at / text.length) * span;
      at += raw.length;
      const to = c.start + (Math.min(at, text.length) / text.length) * span;
      if (!piece) continue;
      if (open) {
        open.text += ` ${piece}`;
        open.end = to;
      } else open = { start: from, end: to, text: piece, speaker: c.speaker };
      if (/[.!?]["”’)]*$/.test(piece)) {
        out.push(open);
        open = null;
      }
    }
  }
  if (open) out.push(open);
  return out;
}

const FILLER = /\b(um+|uh+|erm+|ah+|hmm+|you know|kind of|sort of|i mean)\b/gi;
const HOOK = /\b(lesson|the key|most important|biggest|never|always|no longer|malpractice|huge|game[- ]?changer|remember|mistake|myth|surpris\w*|changed|changing|breakthrough|life[- ]?saving|retest|bottom line|take[- ]?away|what matters|the problem|the reason|the truth|nobody|everyone|every patient|stop|don'?t)\b/i;
const SETUP = /^(so,? (today|let'?s|we'?re going)|um|uh|okay|ok|alright|all right|thank you|thanks|next slide|can you (hear|see)|let me (share|pull|just)|good (morning|afternoon|evening)|welcome|hi,? everyone|hello|yeah)\b/i;
const CLAIM = /(\d|%|\b(more|less|better|worse|than|should|must|need to|have to|important|key|only|every|never|always|positive|negative|survival|response|benefit|risk)\b)/i;
const SOFT_END = /\b(so|and|but|or|right|yeah|okay|you know|anyway|stuff|things)[.!?]*$/i;

const words = (s: string) => s.split(/\s+/).filter(Boolean);

export type Moment = ProposedClip & { verdict: Verdict; quote: string; speaker?: string; score: number; why: string[] };

function scoreRun(run: Sentence[]): { score: number; quote: string; why: string[] } {
  const first = run[0].text;
  const all = run.map((s) => s.text).join(' ');
  const n = words(all).length;
  const why: string[] = [];
  let score = 0;
  if (SETUP.test(first)) {
    score -= 3;
    why.push('opens on setup');
  } else if (/^(and|but|because|or|which)\b/i.test(first)) {
    score -= 1.5;
    why.push('starts mid-thought');
  } else {
    if (/\d/.test(first)) score += 2;
    if (HOOK.test(first)) score += 2;
    if (words(first).length <= 22) score += 1;
    if (score >= 2) why.push('hooks in the first line');
  }
  const claims = run.filter((s) => CLAIM.test(s.text)).length;
  score += Math.min(3, claims);
  if (claims >= 2) why.push('makes a concrete claim');
  // the quote: the strongest single line, kept exactly as said
  let quote = run[0].text, best = -Infinity;
  for (const s of run) {
    const w = words(s.text).length;
    const fill = (s.text.match(FILLER) ?? []).length;
    const v = (w >= 8 && w <= 32 ? 2 : 0) + (/\d|%/.test(s.text) ? 1.5 : 0) + (HOOK.test(s.text) ? 1.5 : 0) - fill;
    if (v > best) {
      best = v;
      quote = s.text;
    }
  }
  if (best >= 3) {
    score += 2;
    why.push('has a quotable line');
  }
  if (SOFT_END.test(run[run.length - 1].text)) {
    score -= 2;
    why.push('soft ending');
  } else score += 1;
  const fillers = (all.match(FILLER) ?? []).length;
  const rate = n ? (fillers / n) * 100 : 0;
  if (rate > 3) {
    score -= Math.min(3, rate / 2);
    why.push('a lot of filler');
  }
  const len = run[run.length - 1].end - run[0].start;
  if (len >= 30 && len <= 60) score += 1;
  return { score, quote, why };
}

function momentTitle(quote: string): string {
  const num = /(\d[\d.,]*\s*%|\b\d[\d.,]*\b)\s+(\S+)(?:\s+(\S+))?/.exec(quote);
  const clean = (s: string) => s.replace(FILLER, '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  if (num) return clean(`${num[1]} ${num[2]}${num[3] ? ` ${num[3]}` : ''}`).replace(/[,.;:!?]+$/, '');
  const w = words(clean(quote)).slice(0, 6).join(' ').replace(/[,.;:!?]+$/, '');
  return w.charAt(0).toUpperCase() + w.slice(1) + (words(quote).length > 6 ? '…' : '');
}

/**
 * Moments worth clipping, scored the way the CHM clip bot does: a complete
 * idea that stands alone, a hook in the first line, one claim, and a
 * natural ending on a sentence boundary. Tangents, setup chatter and soft
 * endings score maybe or skip. Every quote is a real line of the
 * transcript; nothing is written for the speaker.
 */
export function findMoments(cues: Cue[], opts: { minLen?: number; maxLen?: number; limit?: number } = {}): Moment[] {
  const minLen = opts.minLen ?? 20, maxLen = opts.maxLen ?? 90, limit = opts.limit ?? 8;
  const ss = sentencesOf(cues);
  const cands: Moment[] = [];
  for (let i = 0; i < ss.length; i++) {
    let best: Moment | null = null;
    for (let j = i; j < ss.length; j++) {
      if (ss[j].speaker !== ss[i].speaker || (j > i && ss[j].start - ss[j - 1].end > 4)) break;
      const len = ss[j].end - ss[i].start;
      if (len > maxLen) break;
      if (len < minLen) continue;
      const run = ss.slice(i, j + 1);
      const s = scoreRun(run);
      if (!best || s.score > best.score) {
        best = {
          title: momentTitle(s.quote),
          start: ss[i].start,
          end: ss[j].end,
          quote: s.quote,
          speaker: ss[i].speaker,
          score: s.score,
          why: s.why,
          verdict: 'skip',
          reason: '',
        };
      }
    }
    if (best) cands.push(best);
  }
  cands.sort((a, b) => b.score - a.score || a.start - b.start);
  const picked: Moment[] = [];
  for (const c of cands) {
    // back-to-back moments are fine; real overlaps are not
    if (picked.some((p) => c.start < p.end - 0.5 && c.end > p.start + 0.5)) continue;
    c.verdict = c.score >= 6 ? 'strong' : c.score >= 3 ? 'maybe' : 'skip';
    c.reason = `${c.speaker ? `${c.speaker}: ` : ''}“${c.quote}”`;
    picked.push(c);
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * The parts of a clip worth keeping when pauses and filler are cut: the
 * lines inside it, minus lines that are only filler, with gaps longer
 * than `maxGap` closed up.
 */
export function keepRanges(clip: { start: number; end: number }, cues: Cue[], maxGap = 0.6): { start: number; end: number }[] {
  const inside = cues
    .filter((c) => c.end > clip.start && c.start < clip.end)
    .filter((c) => c.text.replace(FILLER, '').replace(/[^\p{L}\p{N}]/gu, '').length > 0)
    .map((c) => ({ start: Math.max(clip.start, c.start), end: Math.min(clip.end, c.end) }));
  if (!inside.length) return [{ start: clip.start, end: clip.end }];
  const out = [{ ...inside[0] }];
  for (const r of inside.slice(1)) {
    const last = out[out.length - 1];
    if (r.start - last.end <= maxGap) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/** How far through a cue's words the speaker is at `t`, for karaoke captions. */
export function spokenWords(cue: Cue, t: number): number {
  const n = words(cue.text).length;
  if (t <= cue.start) return 0;
  if (t >= cue.end) return n;
  return Math.floor(((t - cue.start) / (cue.end - cue.start)) * n + 0.5);
}

export type FormatHint = {
  aspect?: '9:16' | '1:1' | '16:9';
  captions?: 'off' | 'burned' | 'karaoke';
  framing?: 'full' | 'speaker' | 'stacked';
  logo?: boolean;
  tighten?: boolean;
};

export type AssistantKind = 'help' | 'clear' | 'remove' | 'times' | 'split' | 'search' | 'questions' | 'tighten' | 'moments' | 'format' | 'none';

export type AssistantResult = {
  reply: string;
  proposals: (ProposedClip | Moment)[];
  /** Output changes asked for in the same message (vertical, captions, logo…). */
  format?: FormatHint;
  /** What the request was. Times and splits are applied straight away; finds come back to accept. */
  kind?: AssistantKind;
  removeIndexes?: number[];
  clearAll?: boolean;
  tighten?: boolean;
};

export const ASSISTANT_HELP =
  'With a transcript I can find the moments worth clipping, scored strong, maybe or skip with the exact quote: “moments for TikTok”. ' +
  'Or search it: “find olanzapine”, “every audience question”. ' +
  'Give me times and I’ll cut them: “12:30 to 14:05 ILD monitoring”, “split into 3-minute clips”. ' +
  'For the output: “vertical”, “focus on the speaker”, “stacked view”, “karaoke captions”, “add the logo”, “cut fillers”.';

/** Output requests in plain words: vertical, stacked, karaoke, logo… */
export function formatFrom(msg: string): { hint: FormatHint; said: string[] } {
  const hint: FormatHint = {};
  const said: string[] = [];
  if (/\b(tik ?tok|reels?|shorts|vertical|9[:x]16|portrait)\b/i.test(msg)) {
    hint.aspect = '9:16';
    said.push('vertical 9:16');
  } else if (/\b(square|1[:x]1)\b/i.test(msg)) {
    hint.aspect = '1:1';
    said.push('square');
  } else if (/\b(widescreen|landscape|16[:x]9|horizontal)\b/i.test(msg)) {
    hint.aspect = '16:9';
    said.push('widescreen');
  }
  if (/\b(stack(ed)?|both (hosts|speakers|people|doctors)|split screen)\b/i.test(msg)) {
    hint.framing = 'stacked';
    said.push('stacked view');
  } else if (/\b(focus|follow|track)\w* (on )?(the )?(speaker|whoever|person talking)|speaker focus\b/i.test(msg)) {
    hint.framing = 'speaker';
    said.push('speaker focus');
  }
  if (/\bkaraoke\b/i.test(msg)) {
    hint.captions = 'karaoke';
    said.push('karaoke captions');
  } else if (/\b(no|without|turn off|remove) captions?\b/i.test(msg)) {
    hint.captions = 'off';
    said.push('no captions');
  } else if (/\b(burn(ed)?[- ]in|captions?|subtitles?)\b/i.test(msg)) {
    hint.captions = 'burned';
    said.push('captions burned in');
  }
  if (/\b(no|without|remove|drop) (the )?logo\b/i.test(msg)) {
    hint.logo = false;
    said.push('no logo');
  } else if (/\blogo\b/i.test(msg)) {
    hint.logo = true;
    said.push('the CHM logo');
  }
  if (/\b(fillers?|stutters?|ums?|uhs?|unbroken|dead air|pauses)\b/i.test(msg) && !/\btighten\b/i.test(msg)) {
    hint.tighten = true;
    said.push('filler lines and pauses cut');
  }
  return { hint, said };
}

/**
 * Reads a request typed into the assistant. Deterministic on purpose:
 * explicit times and splits become clips exactly as written, and anything
 * found in the transcript (a search, the audience questions) comes back
 * as suggestions to accept, so nothing it guessed lands on the timeline
 * without a person saying so.
 */
export function interpretRequest(
  message: string,
  ctx: { duration: number; cues: Cue[]; clipCount: number },
): AssistantResult {
  const result = interpretClips(message, ctx);
  if (result.format) return result;
  const { hint, said } = formatFrom(message);
  return said.length ? { ...result, format: hint } : result;
}

function interpretClips(
  message: string,
  ctx: { duration: number; cues: Cue[]; clipCount: number },
): AssistantResult {
  const msg = message.trim();
  if (!msg) return { reply: ASSISTANT_HELP, proposals: [], kind: 'help' };
  if (/^(help|\?|what can you do)/i.test(msg)) return { reply: ASSISTANT_HELP, proposals: [], kind: 'help' };
  if (/^(clear|remove|delete)\s+(all|every|everything)/i.test(msg)) {
    return { reply: 'Cleared every clip.', proposals: [], clearAll: true, kind: 'clear' };
  }
  const fmt = formatFrom(msg);
  const asksMoments = /\b(moments?|worth (clipping|cutting)|best (clips|bits|parts)|highlights?|clip (it|this|the video) for|social clips?)\b/i.test(msg) ||
    (fmt.hint.aspect === '9:16' && !/\d{1,2}:\d{2}/.test(msg) && !/\bfind\b/i.test(msg) && msg.split(/\s+/).length <= 12 && /\b(clip|cut|make|find|get|pull)\b/i.test(msg));
  if (asksMoments) {
    if (!ctx.cues.length) return { reply: 'I need the transcript to find moments. Add one in the Transcript tab.', proposals: [], kind: 'none', format: fmt.hint };
    const ms = findMoments(ctx.cues);
    const strong = ms.filter((m) => m.verdict === 'strong').length;
    const maybe = ms.filter((m) => m.verdict === 'maybe').length;
    const out = fmt.said.length ? ` Output set to ${fmt.said.join(', ')}.` : '';
    return ms.length
      ? {
          reply: `Scored the recording for complete, quotable thoughts: ${strong} strong, ${maybe} maybe. Each has a hook up front and ends on a sentence; every quote is a real line.${out}`,
          proposals: ms.filter((m) => m.verdict !== 'skip'),
          kind: 'moments',
          format: fmt.hint,
        }
      : { reply: 'Nothing in this transcript runs 20 to 90 seconds as one complete thought.', proposals: [], kind: 'moments', format: fmt.hint };
  }
  if (fmt.said.length && !RANGE.test(msg) && !/\b(find|search|where|split|every|questions?)\b/i.test(msg)) {
    RANGE.lastIndex = 0;
    return { reply: `Done. Output set to ${fmt.said.join(', ')}.`, proposals: [], kind: 'format', format: fmt.hint };
  }
  RANGE.lastIndex = 0;
  if (/\b(tighten|trim (?:them |clips |it )?to (?:the )?speech|cut (?:the )?(?:dead air|silences?))\b/i.test(msg)) {
    if (!ctx.cues.length) return { reply: 'I need the transcript to see where people speak. Add one in the Transcript tab.', proposals: [], kind: 'none' };
    if (!ctx.clipCount) return { reply: 'There are no clips to tighten yet.', proposals: [], kind: 'none' };
    return { reply: `Done. Pulled ${ctx.clipCount === 1 ? 'the clip' : `all ${ctx.clipCount} clips`} in to the speech.`, proposals: [], tighten: true, kind: 'tighten' };
  }
  const split = /\b(?:split|chop|cut)\b.*?\b(?:into|in)\s+(\d+(?:\.\d+)?)\s*-?\s*(min(?:ute)?s?|sec(?:ond)?s?|s|m)\b/i.exec(msg) ??
    /\bevery\s+(\d+(?:\.\d+)?)\s*-?\s*(min(?:ute)?s?|sec(?:ond)?s?|s|m)\b/i.exec(msg);
  if (split) {
    const len = Number(split[1]) * (/^m/i.test(split[2]) ? 60 : 1);
    const parts = splitEvenly(ctx.duration, len, ctx.clipCount);
    return parts.length
      ? { reply: `Done. Split the recording into ${parts.length} clips of ${formatTime(len, 0)}.`, proposals: parts, kind: 'split' }
      : { reply: 'The recording is still loading. Try that again in a moment.', proposals: [], kind: 'none' };
  }
  if (/\b(questions?|q\s?&\s?a|asked)\b/i.test(msg) && !/\bfind\b.*\bquestion\b.*\babout\b/i.test(msg)) {
    if (!ctx.cues.length) return { reply: 'I need the transcript to find questions. Add one in the Transcript tab.', proposals: [], kind: 'none' };
    const qs = findQuestions(ctx.cues);
    return qs.length
      ? { reply: `Found ${qs.length === 1 ? '1 question' : `${qs.length} questions`}, each with the answer after it. Add the ones you want.`, proposals: qs, kind: 'questions' }
      : { reply: 'No one asks a question in this transcript.', proposals: [], kind: 'questions' };
  }
  const rm = /^(?:remove|delete|drop)\s+clips?\s+([\d,\sand]+)/i.exec(msg);
  if (rm) {
    const idx = [...rm[1].matchAll(/\d+/g)].map((m) => Number(m[0]) - 1).filter((n) => n >= 0 && n < ctx.clipCount);
    return idx.length
      ? { reply: `Removed clip ${idx.map((n) => n + 1).join(', ')}.`, proposals: [], removeIndexes: idx, kind: 'remove' }
      : { reply: `There's no clip with that number. You have ${ctx.clipCount}.`, proposals: [], kind: 'none' };
  }

  const proposals: ProposedClip[] = [];
  const problems: string[] = [];
  const clamp = (s: number) => (ctx.duration > 0 ? Math.min(s, ctx.duration) : s);

  for (const line of msg.split(/\n|;/)) {
    const ranges = [...line.matchAll(RANGE)];
    if (ranges.length) {
      ranges.forEach((m, k) => {
        const start = parseTime(m[1]);
        const end = parseTime(m[2]);
        const after = line.slice((m.index ?? 0) + m[0].length);
        const before = k === 0 ? line.slice(0, m.index ?? 0).replace(/\b(clip|cut|from|between|please|make|a|an)\b/gi, '') : '';
        const title = titleFrom(after.split(RANGE)[0] || before, `Clip ${ctx.clipCount + proposals.length + 1}`);
        if (start == null || end == null) problems.push(`I couldn't read “${m[0]}”.`);
        else if (end <= start) problems.push(`“${m[0]}” ends before it starts.`);
        else if (ctx.duration > 0 && start >= ctx.duration)
          problems.push(`${formatTime(start, 0)} is past the end of the video (${formatTime(ctx.duration, 0)}).`);
        else proposals.push({ title, start, end: clamp(end) });
      });
      continue;
    }
    const at = AT_FOR.exec(line);
    if (at) {
      const start = parseTime(at[1]);
      const len = parseTime(at[2]);
      if (start != null && len != null && len > 0) {
        proposals.push({
          title: titleFrom(line.slice((at.index ?? 0) + at[0].length), `Clip ${ctx.clipCount + proposals.length + 1}`),
          start,
          end: clamp(start + len),
        });
        continue;
      }
    }
    const fl = FIRST_LAST.exec(line);
    if (fl && ctx.duration > 0) {
      const len = parseTime(fl[2]);
      if (len != null && len > 0) {
        const fromEnd = /last|final|closing/i.test(fl[1]);
        proposals.push({
          title: fromEnd ? 'Closing' : 'Opening',
          start: fromEnd ? Math.max(0, ctx.duration - len) : 0,
          end: fromEnd ? ctx.duration : Math.min(len, ctx.duration),
        });
        continue;
      }
    }
  }

  if (proposals.length || problems.length) {
    const said = proposals.length ? `Done. Added ${proposals.length === 1 ? '1 clip' : `${proposals.length} clips`} from your times.` : '';
    return { reply: [said, ...problems].filter(Boolean).join(' '), proposals, kind: proposals.length ? 'times' : 'none' };
  }

  if (!ctx.cues.length) {
    return {
      reply:
        'I need times for that, like “12:30 to 14:05”. To find moments by what was said, load the transcript first.',
      proposals: [],
      kind: 'none',
    };
  }
  const found = searchTranscript(ctx.cues, msg);
  return found.length
    ? {
        reply:
          found.length === 1
            ? 'Found 1 moment in the transcript. Check it, then add it if it’s the right one.'
            : `Found ${found.length} moments in the transcript. Check them and add the ones you want.`,
        proposals: found,
        kind: 'search',
      }
    : { reply: `Nothing in the transcript matches “${msg}”. Try a different word, or give me times.`, proposals: [], kind: 'search' };
}

/* ── exporters ─────────────────────────────────────────────────── */

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function clipsToCsv(clips: Clip[], source: string): string {
  const rows = [['#', 'Title', 'In', 'Out', 'Duration (s)', 'Source', 'Note']];
  clips.forEach((c, i) =>
    rows.push([
      String(i + 1),
      c.title,
      formatTime(c.start, 3),
      formatTime(c.end, 3),
      (c.end - c.start).toFixed(3),
      source,
      c.note ?? '',
    ]),
  );
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** CMX 3600 edit decision list: imports into Premiere, Resolve and Avid. */
export function clipsToEdl(clips: Clip[], title: string, source: string, fps = 30): string {
  const lines = [`TITLE: ${title.slice(0, 70)}`, 'FCM: NON-DROP FRAME', ''];
  let rec = 0;
  clips.forEach((c, i) => {
    const len = c.end - c.start;
    lines.push(
      `${String(i + 1).padStart(3, '0')}  AX       AA/V  C        ${formatSmpte(c.start, fps)} ${formatSmpte(c.end, fps)} ${formatSmpte(rec, fps)} ${formatSmpte(rec + len, fps)}`,
      `* FROM CLIP NAME: ${source}`,
      `* COMMENT: ${c.title}`,
      '',
    );
    rec += len;
  });
  return lines.join('\n');
}

export function clipsToJson(clips: Clip[], source: string): string {
  return JSON.stringify(
    {
      source,
      clips: clips.map((c, i) => ({
        n: i + 1,
        title: c.title,
        start: Number(c.start.toFixed(3)),
        end: Number(c.end.toFixed(3)),
        in: formatTime(c.start, 3),
        out: formatTime(c.end, 3),
        note: c.note || undefined,
      })),
    },
    null,
    2,
  );
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'clip'
  );
}
