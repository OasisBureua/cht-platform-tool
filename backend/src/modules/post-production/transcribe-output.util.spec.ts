import {
  cleanCues,
  cuesFromTranscribe,
  speakerName,
} from './transcribe-output.util';

const word = (
  content: string,
  start: number,
  end: number,
  speaker = 'spk_0',
) => ({
  type: 'pronunciation' as const,
  start_time: String(start),
  end_time: String(end),
  speaker_label: speaker,
  alternatives: [{ content }],
});
const punct = (content: string) => ({
  type: 'punctuation' as const,
  alternatives: [{ content }],
});

describe('cuesFromTranscribe', () => {
  it('splits on speaker changes and sentence ends, keeping punctuation', () => {
    const cues = cuesFromTranscribe({
      results: {
        items: [
          word('How', 0, 0.2),
          word('common', 0.2, 0.5),
          word('is', 0.5, 0.6),
          word('this', 0.6, 0.9),
          punct('?'),
          word('More', 1.2, 1.4, 'spk_1'),
          word('common', 1.4, 1.7, 'spk_1'),
          punct('.'),
        ],
      },
    });
    expect(cues).toEqual([
      { start: 0, end: 0.9, text: 'How common is this?', speaker: 'Speaker 1' },
      { start: 1.2, end: 1.7, text: 'More common.', speaker: 'Speaker 2' },
    ]);
  });

  it('breaks long runs and pauses, and falls back to speaker segments', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      ...word(`w${i}`, i * 0.3, i * 0.3 + 0.25),
      speaker_label: undefined,
    }));
    items.push({ ...word('later', 10, 10.3), speaker_label: undefined });
    const cues = cuesFromTranscribe({
      results: {
        items,
        speaker_labels: {
          segments: [
            { start_time: '0', end_time: '20', speaker_label: 'spk_2' },
          ],
        },
      },
    });
    expect(cues.length).toBe(3);
    expect(cues[0].text.split(' ').length).toBe(14);
    expect(cues[2]).toMatchObject({ text: 'later', speaker: 'Speaker 3' });
  });

  it('names speakers', () => {
    expect(speakerName('spk_0')).toBe('Speaker 1');
    expect(speakerName(undefined)).toBeUndefined();
  });
});

describe('cleanCues', () => {
  it('drops malformed lines, trims and sorts', () => {
    expect(
      cleanCues([
        { start: 5, end: 6, text: ' Second ', speaker: 'Dr. Hale' },
        { start: 1, end: 2, text: 'First' },
        { start: 3, end: 2, text: 'backwards' },
        { start: 'x', end: 2, text: 'bad' },
        { start: 4, end: 5, text: '   ' },
      ]),
    ).toEqual([
      { start: 1, end: 2, text: 'First' },
      { start: 5, end: 6, text: 'Second', speaker: 'Dr. Hale' },
    ]);
  });
});
