import { describe, expect, it } from 'vitest';
import {
  clipsToCsv,
  clipsToEdl,
  formatSmpte,
  formatTime,
  interpretRequest,
  parseCaptions,
  parseTime,
  searchTranscript,
  findQuestions,
  splitEvenly,
  tightenToSpeech,
  findMoments,
  keepRanges,
  sentencesOf,
  spokenWords,
  formatFrom,
} from '../../components/admin/clipper/clipperCore';

const ZOOM_VTT = `WEBVTT

1
00:12:28.000 --> 00:12:33.500
Jason Mouabbi: Let's talk about how we monitor for ILD on T-DXd.

2
00:12:33.500 --> 00:12:40.000
Ruta Rao: We get a baseline CT and repeat imaging every six to twelve weeks.

3
00:30:00.000 --> 00:30:05.000
Mark Pegram: Olanzapine has changed how patients tolerate nausea.
`;

describe('timecodes', () => {
  it('reads the ways people write times', () => {
    expect(parseTime('12:30')).toBe(750);
    expect(parseTime('1:02:10')).toBe(3730);
    expect(parseTime('12:30.5')).toBe(750.5);
    expect(parseTime('90s')).toBe(90);
    expect(parseTime('1m30s')).toBe(90);
    expect(parseTime('2 min')).toBe(120);
    expect(parseTime('45')).toBe(45);
    expect(parseTime('12:75')).toBeNull();
    expect(parseTime('soon')).toBeNull();
  });

  it('formats for display and for edit lists', () => {
    expect(formatTime(3725.4)).toBe('1:02:05.4');
    expect(formatTime(125)).toBe('2:05.0');
    expect(formatSmpte(750.5, 30)).toBe('00:12:30:15');
  });
});

describe('captions', () => {
  it('parses Zoom VTT with speakers', () => {
    const cues = parseCaptions(ZOOM_VTT);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({ start: 748, end: 753.5, speaker: 'Jason Mouabbi' });
    expect(cues[1].text).toMatch(/baseline CT/);
  });

  it('parses SRT', () => {
    const cues = parseCaptions('1\n00:00:01,000 --> 00:00:03,250\nHello there\n\n2\n00:00:04,000 --> 00:00:05,000\nSecond line\n');
    expect(cues.map((c) => [c.start, c.end, c.text])).toEqual([
      [1, 3.25, 'Hello there'],
      [4, 5, 'Second line'],
    ]);
  });
});

describe('clip assistant', () => {
  const ctx = { duration: 3600, cues: parseCaptions(ZOOM_VTT), clipCount: 0 };

  it('turns explicit ranges into clips, one per line', () => {
    const r = interpretRequest('12:30 to 14:05 ILD monitoring\n30:00-30:45 "Olanzapine and nausea"', ctx);
    expect(r.proposals).toEqual([
      { title: 'ILD monitoring', start: 750, end: 845 },
      { title: 'Olanzapine and nausea', start: 1800, end: 1845 },
    ]);
  });

  it('handles "at T for N"', () => {
    const r = interpretRequest('at 3:10 for 45s the case', ctx);
    expect(r.proposals[0]).toMatchObject({ start: 190, end: 235, title: 'The case' });
  });

  it('refuses backwards and out-of-range times with a reason', () => {
    expect(interpretRequest('14:05 to 12:30', ctx).reply).toMatch(/ends before it starts/);
    expect(interpretRequest('1:30:00 to 1:31:00', { ...ctx, duration: 600 }).reply).toMatch(/past the end/);
  });

  it('searches the transcript when there are no times', () => {
    const r = interpretRequest('where do they discuss ILD monitoring', ctx);
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].start).toBe(746);
    expect(r.proposals[0].end).toBe(755.5);
  });

  it('asks for a transcript before searching without one', () => {
    expect(interpretRequest('find olanzapine', { ...ctx, cues: [] }).reply).toMatch(/load the transcript/);
  });

  it('removes clips by number', () => {
    const r = interpretRequest('remove clip 2', { ...ctx, clipCount: 3 });
    expect(r.removeIndexes).toEqual([1]);
  });
});

describe('search and export', () => {
  it('merges nearby matches into one window', () => {
    const cues = parseCaptions(ZOOM_VTT);
    const w = searchTranscript(cues, 'ILD imaging');
    expect(w[0].start).toBe(746);
  });

  it('writes CSV and a CMX 3600 EDL', () => {
    const clips = [{ id: 'a', title: 'ILD, monitoring', start: 750, end: 845 }];
    expect(clipsToCsv(clips, 'session.mp4')).toContain('"ILD, monitoring"');
    const edl = clipsToEdl(clips, 'Session', 'session.mp4', 30);
    expect(edl).toContain('001  AX       AA/V  C        00:12:30:00 00:14:05:00 00:00:00:00 00:01:35:00');
    expect(edl).toContain('* COMMENT: ILD, monitoring');
  });
});

describe('directing the cut', () => {
  const QA = parseCaptions(`WEBVTT

1
00:01:00.000 --> 00:01:06.000
Audience: How often do you repeat the CT when patients are stable?

2
00:01:06.000 --> 00:01:20.000
Ruta Rao: Every six to twelve weeks, and sooner with any new cough.

3
00:02:30.000 --> 00:02:34.000
Jason Mouabbi: Okay.

4
00:03:00.000 --> 00:03:05.000
Audience: Would you rechallenge after a grade one event?

5
00:03:05.000 --> 00:03:18.000
Mark Pegram: After it resolves, yes, with close monitoring.
`);

  it('applies explicit times straight away', () => {
    const r = interpretRequest('12:30 to 14:05 ILD monitoring', { duration: 3600, cues: [], clipCount: 0 });
    expect(r.kind).toBe('times');
    expect(r.reply).toMatch(/^Done\./);
  });

  it('finds audience questions with the answer that follows', () => {
    const qs = findQuestions(QA);
    expect(qs).toHaveLength(2);
    expect(qs[0].start).toBe(59);
    expect(qs[0].end).toBe(81);
    expect(qs[1].title).toMatch(/rechallenge/);
    const r = interpretRequest('every audience question', { duration: 600, cues: QA, clipCount: 0 });
    expect(r.kind).toBe('questions');
    expect(r.proposals).toHaveLength(2);
  });

  it('splits the recording into even parts', () => {
    expect(splitEvenly(400, 180).map((c) => [c.start, c.end])).toEqual([
      [0, 180],
      [180, 360],
      [360, 400],
    ]);
    const r = interpretRequest('Split into 3-minute clips', { duration: 400, cues: [], clipCount: 0 });
    expect(r.kind).toBe('split');
    expect(r.proposals).toHaveLength(3);
  });

  it('tightens a clip to the speech inside it', () => {
    expect(tightenToSpeech({ start: 50, end: 100 }, QA)).toEqual({ start: 59.75, end: 80.25 });
    expect(tightenToSpeech({ start: 400, end: 420 }, QA)).toEqual({ start: 400, end: 420 });
    expect(interpretRequest('tighten to speech', { duration: 600, cues: QA, clipCount: 2 }).tighten).toBe(true);
    expect(interpretRequest('tighten to speech', { duration: 600, cues: [], clipCount: 2 }).tighten).toBeUndefined();
  });
});

describe('moments worth clipping (the clip bot rubric)', () => {
  const TALK = parseCaptions(`WEBVTT

1
00:00:00.000 --> 00:00:09.000
Dr. Iyengar: Okay, so, um, can everyone hear me? Let me just share my screen here.

2
00:00:09.000 --> 00:00:30.000
Dr. Iyengar: Uh, thanks for having us, it's, you know, great to be here and, um, we'll kind of get into it, so yeah.

3
00:12:48.000 --> 00:13:05.000
Dr. Badve: So 85% were negative to begin with, now 85% are positive and only 15 are negative.

4
00:13:05.000 --> 00:13:29.000
Dr. Badve: That's a huge population of patients who now qualify for therapy they could never get before.

5
00:23:08.000 --> 00:23:26.000
Dr. Badve: If one lesson you want to take out from today's talk, from the pathology side I would say retest the samples.

6
00:23:26.000 --> 00:23:42.000
Dr. Badve: An old negative result is not the final answer for a patient with metastatic disease.

7
00:28:11.000 --> 00:28:40.000
Dr. Iyengar: Just accepting zero at face value is no longer a good practice.

8
00:28:40.000 --> 00:29:16.000
Dr. Iyengar: We should ask pathology to report the ultra-low range, because the trial data shows real benefit there.
`);

  it('turns cues into sentences with times', () => {
    const ss = sentencesOf(TALK);
    expect(ss.find((s) => s.text.startsWith('If one lesson'))?.start).toBe(23 * 60 + 8);
    expect(ss.every((s) => s.end > s.start)).toBe(true);
  });

  it('finds the complete, quotable thoughts and skips the setup', () => {
    const ms = findMoments(TALK);
    const strong = ms.filter((m) => m.verdict === 'strong');
    expect(strong.length).toBeGreaterThanOrEqual(2);
    expect(strong.some((m) => m.quote.startsWith('So 85% were negative'))).toBe(true);
    expect(ms.some((m) => m.quote.startsWith('Just accepting zero'))).toBe(true);
    for (const m of ms) {
      expect(m.end - m.start).toBeGreaterThanOrEqual(20);
      expect(m.end - m.start).toBeLessThanOrEqual(90);
      // every quote is a real line of the transcript
      expect(TALK.some((c) => c.text.includes(m.quote))).toBe(true);
    }
    expect(ms.some((m) => m.start < 30 && m.verdict === 'strong')).toBe(false);
  });

  it('reads output requests the way the trial rounds asked for them', () => {
    expect(formatFrom('clip this for TikTok').hint.aspect).toBe('9:16');
    expect(formatFrom('make a stacked view so we see both hosts, karaoke captions').hint).toMatchObject({ framing: 'stacked', captions: 'karaoke' });
    expect(formatFrom('add a logo').hint.logo).toBe(true);
    expect(formatFrom('cut filler words and stutters').hint.tighten).toBe(true);
    const r = interpretRequest('find the moments worth clipping for TikTok', { duration: 1800, cues: TALK, clipCount: 0 });
    expect(r.kind).toBe('moments');
    expect(r.format?.aspect).toBe('9:16');
    expect(interpretRequest('add a logo', { duration: 1800, cues: TALK, clipCount: 1 }).kind).toBe('format');
  });

  it('cuts filler-only lines and long pauses out of a clip', () => {
    const cues = parseCaptions(`WEBVTT

1
00:00:00.000 --> 00:00:04.000
Ana: The first point.

2
00:00:04.200 --> 00:00:05.000
Ana: Um, uh.

3
00:00:08.000 --> 00:00:12.000
Ana: The second point.
`);
    expect(keepRanges({ start: 0, end: 12 }, cues)).toEqual([
      { start: 0, end: 4 },
      { start: 8, end: 12 },
    ]);
    expect(spokenWords(cues[2], 10)).toBe(2);
  });
});
