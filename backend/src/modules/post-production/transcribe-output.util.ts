/**
 * Turns an AWS Transcribe result (with speaker labels) into the clipper's
 * cues: Zoom-style lines of a few seconds, each with one speaker, split at
 * sentence ends, speaker changes and pauses.
 */

export type TranscriptCue = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

type Item = {
  type: 'pronunciation' | 'punctuation';
  start_time?: string;
  end_time?: string;
  speaker_label?: string;
  alternatives: { content: string }[];
};

type Segment = {
  start_time: string;
  end_time: string;
  speaker_label: string;
};

export type TranscribeOutput = {
  results: {
    items: Item[];
    speaker_labels?: { segments: Segment[] };
  };
};

const MAX_WORDS = 14;
const MAX_SECONDS = 7;
const PAUSE = 1.0;

/** `spk_0` → `Speaker 1`, so editors rename people, not codes. */
export const speakerName = (label?: string) => {
  const n = /spk_(\d+)/.exec(label ?? '');
  return n ? `Speaker ${Number(n[1]) + 1}` : undefined;
};

export function cuesFromTranscribe(out: TranscribeOutput): TranscriptCue[] {
  const segments = out.results.speaker_labels?.segments ?? [];
  const speakerAt = (t: number) =>
    segments.find(
      (s) => t >= Number(s.start_time) && t <= Number(s.end_time) + 0.01,
    )?.speaker_label;

  const cues: TranscriptCue[] = [];
  let open: (TranscriptCue & { words: number }) | null = null;
  const close = () => {
    if (open && open.text.trim()) {
      const { words: _words, ...cue } = open;
      void _words;
      cues.push({ ...cue, text: cue.text.trim() });
    }
    open = null;
  };

  for (const item of out.results.items) {
    const word = item.alternatives[0]?.content ?? '';
    if (item.type === 'punctuation') {
      if (open) {
        open.text += word;
        if (/[.!?]/.test(word) && open.words >= 4) close();
      }
      continue;
    }
    const start = Number(item.start_time);
    const end = Number(item.end_time);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const speaker = speakerName(item.speaker_label ?? speakerAt(start));
    const cur = open as (TranscriptCue & { words: number }) | null;
    if (
      cur &&
      (cur.speaker !== speaker ||
        start - cur.end > PAUSE ||
        cur.words >= MAX_WORDS ||
        end - cur.start > MAX_SECONDS)
    ) {
      close();
    }
    if (!open) open = { start, end, text: word, speaker, words: 1 };
    else {
      const o = open as TranscriptCue & { words: number };
      o.text += ` ${word}`;
      o.end = end;
      o.words += 1;
    }
  }
  close();
  return cues.map((c) =>
    c.speaker ? c : { start: c.start, end: c.end, text: c.text },
  );
}

/** Validates cues sent back from the clipper after corrections. */
export function cleanCues(input: unknown): TranscriptCue[] {
  if (!Array.isArray(input)) return [];
  const out: TranscriptCue[] = [];
  for (const raw of input.slice(0, 20000)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const start = Number(r.start);
    const end = Number(r.end);
    const text = typeof r.text === 'string' ? r.text.trim().slice(0, 2000) : '';
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end < start ||
      !text
    )
      continue;
    const speaker =
      typeof r.speaker === 'string' && r.speaker.trim()
        ? r.speaker.trim().slice(0, 80)
        : undefined;
    out.push(speaker ? { start, end, text, speaker } : { start, end, text });
  }
  return out.sort((a, b) => a.start - b.start);
}
