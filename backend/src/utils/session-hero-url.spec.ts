import {
  programCoverImageUrl,
  resolveSessionHeroImageUrl,
} from './session-hero-url';

describe('resolveSessionHeroImageUrl', () => {
  const base = 'https://cht-platform-session-assets.s3.us-east-1.amazonaws.com';

  it('returns undefined for empty values', () => {
    expect(resolveSessionHeroImageUrl(undefined, base)).toBeUndefined();
    expect(resolveSessionHeroImageUrl('  ', base)).toBeUndefined();
  });

  it('passes through absolute URLs', () => {
    expect(
      resolveSessionHeroImageUrl('https://cdn.example.com/hero.jpg', base),
    ).toBe('https://cdn.example.com/hero.jpg');
  });

  it('prefixes session-heroes keys with the public base', () => {
    expect(
      resolveSessionHeroImageUrl('session-heroes/abc-banner.jpg', base),
    ).toBe(`${base}/session-heroes/abc-banner.jpg`);
  });

  it('returns undefined for bare keys when base is missing', () => {
    expect(
      resolveSessionHeroImageUrl('session-heroes/abc-banner.jpg', ''),
    ).toBeUndefined();
  });
});

describe('programCoverImageUrl', () => {
  const base = 'https://example-bucket.s3.us-east-1.amazonaws.com';

  it('prefers session hero over thumbnail', () => {
    expect(
      programCoverImageUrl(
        {
          sessionHeroImageUrl: 'session-heroes/hero.jpg',
          thumbnailUrl: 'https://cdn/thumb.jpg',
        },
        base,
      ),
    ).toBe(`${base}/session-heroes/hero.jpg`);
  });

  it('falls back to thumbnail then youtube', () => {
    expect(
      programCoverImageUrl({ thumbnailUrl: 'https://cdn/thumb.jpg' }, base),
    ).toBe('https://cdn/thumb.jpg');
    expect(programCoverImageUrl({}, base, 'https://img.yt/vi/x/hq.jpg')).toBe(
      'https://img.yt/vi/x/hq.jpg',
    );
  });
});
