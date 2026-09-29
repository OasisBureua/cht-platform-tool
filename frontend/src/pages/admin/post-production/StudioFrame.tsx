/**
 * One of the CHM Studio pages, served from /studio and framed here. The
 * studio runs entirely in the browser (canvas, PNG and ZIP export), and
 * `?embed` hides its own logo and tabs so the admin tabs lead.
 */
export default function StudioFrame({ page, title }: { page: 'index' | 'social'; title: string }) {
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-card">
      <iframe
        key={page}
        src={`/studio/${page}.html?embed`}
        title={title}
        className="block h-[calc(100vh-11rem)] min-h-[40rem] w-full border-0"
      />
    </div>
  );
}
