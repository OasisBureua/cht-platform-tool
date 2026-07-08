import { describe, it, expect } from 'vitest';
import { getPercentChangeLabel } from '../../utils/percentChange';

describe('getPercentChangeLabel', () => {
  it('returns 0% when both current and previous are 0', () => {
    const result = getPercentChangeLabel(0, 0);
    expect(result.label).toBe('0%');
    expect(result.colorClass).toContain('yellow');
  });

  it('returns +100% when previous is 0 and current > 0', () => {
    const result = getPercentChangeLabel(5, 0);
    expect(result.label).toBe('+100%');
    expect(result.colorClass).toContain('green');
  });

  it('returns 0% when no change (current === previous)', () => {
    const result = getPercentChangeLabel(10, 10);
    expect(result.label).toBe('0%');
    expect(result.colorClass).toContain('yellow');
  });

  it('returns positive percent when current > previous', () => {
    const result = getPercentChangeLabel(15, 10);
    expect(result.label).toBe('+50%');
    expect(result.colorClass).toContain('green');
  });

  it('returns negative percent when current < previous', () => {
    const result = getPercentChangeLabel(8, 10);
    expect(result.label).toBe('-20%');
    expect(result.colorClass).toContain('red');
  });

  it('rounds percent change correctly', () => {
    expect(getPercentChangeLabel(11, 10).label).toBe('+10%');
    expect(getPercentChangeLabel(12, 10).label).toBe('+20%');
    expect(getPercentChangeLabel(9, 10).label).toBe('-10%');
  });

  it('handles small changes (rounds to 0%)', () => {
    const result = getPercentChangeLabel(10, 10); // 0% exactly
    expect(result.label).toBe('0%');
  });
});
