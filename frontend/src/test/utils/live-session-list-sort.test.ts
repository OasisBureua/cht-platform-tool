import { describe, expect, it } from 'vitest';
import {
  sortLiveSessions,
  type LiveSessionSortable,
} from '../../utils/live-session-list-sort';

function row(
  partial: Partial<LiveSessionSortable> & Pick<LiveSessionSortable, 'id' | 'title'>,
): LiveSessionSortable {
  return partial;
}

describe('sortLiveSessions', () => {
  const now = new Date('2026-10-27T15:00:00.000Z');

  const live = row({
    id: 'live',
    title: 'Zebra Live',
    startTime: '2026-10-27T14:30:00.000Z',
    duration: 90,
  });
  const soon = row({
    id: 'soon',
    title: 'Alpha Soon',
    startTime: '2026-10-27T16:00:00.000Z',
    duration: 60,
  });
  const later = row({
    id: 'later',
    title: 'Beta Later',
    startTime: '2026-10-28T10:00:00.000Z',
    duration: 60,
    sponsorName: 'Acme',
  });
  const closed = row({
    id: 'closed',
    title: 'Closed Session',
    startTime: '2026-10-26T10:00:00.000Z',
    duration: 60,
  });
  const sameTimeA = row({
    id: 'same-a',
    title: 'A Same Time',
    startTime: '2026-10-29T12:00:00.000Z',
    duration: 60,
  });
  const sameTimeB = row({
    id: 'same-b',
    title: 'B Same Time',
    startTime: '2026-10-29T12:00:00.000Z',
    duration: 60,
  });

  it('pins live-now above soonest when sorting date_asc', () => {
    const sorted = sortLiveSessions([soon, live, later], 'date_asc', now);
    expect(sorted.map((r) => r.id)).toEqual(['live', 'soon', 'later']);
  });

  it('sorts date_desc latest first', () => {
    const sorted = sortLiveSessions([soon, later, closed], 'date_desc', now);
    expect(sorted.map((r) => r.id)).toEqual(['later', 'soon', 'closed']);
  });

  it('sorts title A–Z with stable id tie-break', () => {
    const sorted = sortLiveSessions([later, soon, live], 'title_asc', now);
    expect(sorted.map((r) => r.id)).toEqual(['soon', 'later', 'live']);
  });

  it('uses stable secondary title sort for identical dates', () => {
    const sorted = sortLiveSessions([sameTimeB, sameTimeA], 'date_asc', now);
    expect(sorted.map((r) => r.id)).toEqual(['same-a', 'same-b']);
  });

  it('sorts by topic/sponsor then title', () => {
    const noSponsor = row({
      id: 'ns',
      title: 'M Title',
      startTime: '2026-10-30T12:00:00.000Z',
      duration: 60,
    });
    const sorted = sortLiveSessions([noSponsor, later], 'topic_asc', now);
    expect(sorted.map((r) => r.id)).toEqual(['later', 'ns']);
  });

  it('orders status as live, upcoming, closed', () => {
    const sorted = sortLiveSessions([closed, soon, live], 'status', now);
    expect(sorted.map((r) => r.id)).toEqual(['live', 'soon', 'closed']);
  });

  it('handles empty and single-item lists', () => {
    expect(sortLiveSessions([], 'date_asc', now)).toEqual([]);
    expect(sortLiveSessions([soon], 'title_asc', now).map((r) => r.id)).toEqual(['soon']);
  });
});
