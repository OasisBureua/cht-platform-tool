import { ConfigService } from '@nestjs/config';
import { PostProductionLookService } from './post-production-look.service';

describe('PostProductionLookService.check', () => {
  const service = new PostProductionLookService({
    get: jest.fn(),
  } as unknown as ConfigService);
  const lines = [
    {
      start: 160,
      end: 166,
      text: 'A ten percent drop in forced vital capacity',
      speaker: 'Hale',
    },
    {
      start: 166,
      end: 170,
      text: 'tells me the disease is progressing.',
      speaker: 'Hale',
    },
  ];

  it('keeps only words and figures that were said, inside the clip', () => {
    const out = service.check(
      {
        titles: ['When a [10% drop] means act now', 'x'],
        emphasis: ['progressing', 'nintedanib', 'drop'],
        callouts: [
          { at: 161, text: '10%', label: 'drop in FVC' },
          { at: 161, text: '15%', label: 'invented' },
          { at: 300, text: '10%', label: 'outside' },
        ],
        punchIns: [
          { start: 166, end: 170 },
          { start: 150, end: 152 },
        ],
      },
      lines,
      158,
      171,
      'bold',
    );
    expect(out.emphasis).toEqual(['progressing', 'drop']);
    expect(out.callouts).toEqual([
      { at: 160, text: '10%', label: 'drop in FVC' },
    ]);
    expect(out.punchIns).toEqual([{ start: 166, end: 170 }]);
    expect(out.titles).toEqual(['When a [10% drop] means act now']);
  });

  it('drops push-ins for styles that do not use them', () => {
    const out = service.check(
      {
        titles: [],
        emphasis: [],
        callouts: [],
        punchIns: [{ start: 166, end: 170 }],
      },
      lines,
      158,
      171,
      'explainer',
    );
    expect(out.punchIns).toEqual([]);
  });
});
