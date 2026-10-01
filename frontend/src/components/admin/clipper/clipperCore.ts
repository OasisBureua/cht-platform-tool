/**
 * The clipper's pure logic: timecodes, captions, the clip assistant's
 * interpreter and the cut-list exporters. No DOM, so all of it is covered
 * by unit tests (src/test/components/clipper.test.ts).
 */

export type Clip = {
  id: string;
  title: string;
  start: number;
  end: number;
  note?: string;
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

export type AssistantKind = 'help' | 'clear' | 'remove' | 'times' | 'split' | 'search' | 'questions' | 'tighten' | 'none';

export type AssistantResult = {
  reply: string;
  proposals: ProposedClip[];
  /** What the request was. Times and splits are applied straight away; finds come back to accept. */
  kind?: AssistantKind;
  removeIndexes?: number[];
  clearAll?: boolean;
  tighten?: boolean;
};

export const ASSISTANT_HELP =
  'Give me times and I’ll cut them: “12:30 to 14:05 ILD monitoring”, “at 3:10 for 45s”, “first 90 seconds” or “split into 3-minute clips”. ' +
  'With a transcript I can find moments for you to check: “find olanzapine”, “every audience question”. ' +
  '“Tighten to speech”, “remove clip 2” and “clear all” work too.';

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
  const msg = message.trim();
  if (!msg) return { reply: ASSISTANT_HELP, proposals: [], kind: 'help' };
  if (/^(help|\?|what can you do)/i.test(msg)) return { reply: ASSISTANT_HELP, proposals: [], kind: 'help' };
  if (/^(clear|remove|delete)\s+(all|every|everything)/i.test(msg)) {
    return { reply: 'Cleared every clip.', proposals: [], clearAll: true, kind: 'clear' };
  }
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
