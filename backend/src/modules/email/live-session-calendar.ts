/** Google Calendar deep-link builder for the registration-approved email body. */

export function googleCalendarTemplateUrl(params: {
  title: string;
  details: string;
  start: Date;
  end: Date;
}): string {
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  const dates = `${fmt(params.start)}/${fmt(params.end)}`;
  const q = new URLSearchParams();
  q.set('action', 'TEMPLATE');
  q.set('text', params.title.slice(0, 300));
  q.set('dates', dates);
  q.set('details', params.details.slice(0, 800));
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
