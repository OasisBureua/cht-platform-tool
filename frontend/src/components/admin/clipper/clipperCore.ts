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

export type AssistantResult = {
  reply: string;
  proposals: ProposedClip[];
  removeIndexes?: number[];
  clearAll?: boolean;
};

export const ASSISTANT_HELP =
  'Give me times, like “12:30 to 14:05 ILD monitoring” or “at 3:10 for 45s”, one clip per line. ' +
  'With a transcript loaded I can also find moments: “find olanzapine” or “where do they discuss dose reductions”. ' +
  '“Remove clip 2” and “clear all” work too.';

/**
 * Reads a request typed into the assistant. Deterministic on purpose:
 * explicit times become clips exactly as written, and anything else is
 * treated as a transcript search whose matches come back as suggestions
 * to accept, so nothing lands on the timeline without a person saying so.
 */
export function interpretRequest(
  message: string,
  ctx: { duration: number; cues: Cue[]; clipCount: number },
): AssistantResult {
  const msg = message.trim();
  if (!msg) return { reply: ASSISTANT_HELP, proposals: [] };
  if (/^(help|\?|what can you do)/i.test(msg)) return { reply: ASSISTANT_HELP, proposals: [] };
  if (/^(clear|remove|delete)\s+(all|every|everything)/i.test(msg)) {
    return { reply: 'Cleared every clip.', proposals: [], clearAll: true };
  }
  const rm = /^(?:remove|delete|drop)\s+clips?\s+([\d,\sand]+)/i.exec(msg);
  if (rm) {
    const idx = [...rm[1].matchAll(/\d+/g)].map((m) => Number(m[0]) - 1).filter((n) => n >= 0 && n < ctx.clipCount);
    return idx.length
      ? { reply: `Removed clip ${idx.map((n) => n + 1).join(', ')}.`, proposals: [], removeIndexes: idx }
      : { reply: `There's no clip with that number. You have ${ctx.clipCount}.`, proposals: [] };
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
    const said = proposals.length
      ? `${proposals.length === 1 ? 'Here is 1 clip' : `Here are ${proposals.length} clips`} from your times. Add ${proposals.length === 1 ? 'it' : 'them'} to the timeline when they look right.`
      : '';
    return { reply: [said, ...problems].filter(Boolean).join(' '), proposals };
  }

  if (!ctx.cues.length) {
    return {
      reply:
        'I need times for that, like “12:30 to 14:05”. To find moments by what was said, load the transcript first.',
      proposals: [],
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
      }
    : { reply: `Nothing in the transcript matches “${msg}”. Try a different word, or give me times.`, proposals: [] };
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
