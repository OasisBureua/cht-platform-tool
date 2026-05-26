import {
  isLikelyYouTubeShort,
  isPodcastEpisodeVideo,
  parseYouTubeDurationSeconds,
} from './youtube-shorts.util';

describe('youtube-shorts.util', () => {
  it('parses ISO durations', () => {
    expect(parseYouTubeDurationSeconds('PT1M13S')).toBe(73);
    expect(parseYouTubeDurationSeconds('PT30M34S')).toBe(1834);
  });

  it('flags Shorts by duration and hashtag', () => {
    expect(
      isLikelyYouTubeShort({
        title: 'Clip',
        duration: 'PT59S',
      }),
    ).toBe(true);
    expect(
      isLikelyYouTubeShort({
        title: 'Vertical clip #Shorts',
        duration: 'PT2M30S',
      }),
    ).toBe(true);
    expect(
      isLikelyYouTubeShort({
        title: 'Full episode',
        duration: 'PT30M',
      }),
    ).toBe(false);
  });

  it('keeps only long-form podcast uploads', () => {
    expect(
      isPodcastEpisodeVideo({
        title: 'Promo',
        duration: 'PT1M13S',
        minDurationSeconds: 900,
      }),
    ).toBe(false);
    expect(
      isPodcastEpisodeVideo({
        title: 'The Breast Friends Podcast Ep. 5',
        duration: 'PT30M34S',
        minDurationSeconds: 900,
      }),
    ).toBe(true);
  });
});
