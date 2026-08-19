import { describe, it, expect } from 'vitest';
import { extractYoutubeVideoIdFromUrl } from '../../utils/clipUrl';

describe('extractYoutubeVideoIdFromUrl: YouTube Shorts', () => {
  it('extracts video id from a /shorts/ URL', () => {
    expect(
      extractYoutubeVideoIdFromUrl('https://www.youtube.com/shorts/O79pOj7q9YQ'),
    ).toBe('O79pOj7q9YQ');
  });

  it('still handles standard watch URLs', () => {
    expect(
      extractYoutubeVideoIdFromUrl('https://www.youtube.com/watch?v=iIlrrYEY8RY'),
    ).toBe('iIlrrYEY8RY');
  });

  it('still handles youtu.be short links', () => {
    expect(extractYoutubeVideoIdFromUrl('https://youtu.be/iIlrrYEY8RY')).toBe(
      'iIlrrYEY8RY',
    );
  });

  it('still handles /embed/ URLs', () => {
    expect(
      extractYoutubeVideoIdFromUrl(
        'https://www.youtube.com/embed/iIlrrYEY8RY?autoplay=1',
      ),
    ).toBe('iIlrrYEY8RY');
  });

  it('returns null for non-YouTube URLs', () => {
    expect(extractYoutubeVideoIdFromUrl('https://vimeo.com/123456')).toBeNull();
    expect(extractYoutubeVideoIdFromUrl('')).toBeNull();
    expect(extractYoutubeVideoIdFromUrl(null)).toBeNull();
  });
});
