import { formatZoomStartTime } from './zoom.service';

describe('formatZoomStartTime', () => {
  it('strips milliseconds from GMT ISO (Zoom-safe)', () => {
    expect(formatZoomStartTime('2026-04-29T20:00:00.000Z')).toBe(
      '2026-04-29T20:00:00Z',
    );
  });

  it('leaves already-valid GMT times unchanged', () => {
    expect(formatZoomStartTime('2026-04-29T20:00:00Z')).toBe(
      '2026-04-29T20:00:00Z',
    );
  });

  it('strips fractional seconds from local wall-clock times', () => {
    expect(formatZoomStartTime('2026-04-29T16:00:00.000')).toBe(
      '2026-04-29T16:00:00',
    );
  });

  it('normalizes offset ISO to GMT without milliseconds', () => {
    expect(formatZoomStartTime('2026-04-29T16:00:00.000-04:00')).toBe(
      '2026-04-29T20:00:00Z',
    );
  });
});
