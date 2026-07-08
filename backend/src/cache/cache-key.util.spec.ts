import { cacheKeyHash } from './cache-key.util';

describe('cacheKeyHash', () => {
  it('is stable regardless of param order', () => {
    expect(cacheKeyHash({ b: '2', a: '1' })).toBe(cacheKeyHash({ a: '1', b: '2' }));
  });

  it('ignores empty values', () => {
    expect(cacheKeyHash({ q: 'x', institution: '' })).toBe(cacheKeyHash({ q: 'x' }));
  });
});
