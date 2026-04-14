import { useCallback, useRef, useState } from 'react';
import { Loader2, MonitorPlay, X } from 'lucide-react';
import { webinarsApi } from '../../api/webinars';

type ZoomEmbeddedClient = {
  init: (args: object) => Promise<string | object>;
  join: (args: object) => Promise<string | object>;
  leaveMeeting: (userId?: number) => Promise<string | object>;
};

function isSdkFailure(r: unknown): r is { type: string; reason: string } {
  return typeof r === 'object' && r !== null && 'type' in r && 'reason' in r;
}

/**
 * Zoom Meeting SDK (component view) for Office Hours — keeps the session inside the app shell.
 * Requires Zoom Marketplace **Meeting SDK** credentials on the server (not S2S OAuth alone).
 */
export function OfficeHoursZoomEmbed({
  programId,
  disabled,
  joinUrlFallback,
}: {
  programId: string;
  disabled?: boolean;
  /** Shown in error hint if SDK auth fails */
  joinUrlFallback?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<ZoomEmbeddedClient | null>(null);

  const leave = useCallback(async () => {
    const c = clientRef.current;
    clientRef.current = null;
    if (c) {
      try {
        const r = await c.leaveMeeting();
        if (isSdkFailure(r)) {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    setError(null);
  }, []);

  const join = useCallback(async () => {
    setError(null);
    setLoading(true);
    setOpen(true);
    try {
      const creds = await webinarsApi.getMeetingSdkAuth(programId);
      await new Promise((r) => setTimeout(r, 0));

      const root = containerRef.current;
      if (!root) {
        setError('Meeting container not ready. Try again.');
        setOpen(false);
        return;
      }

      const ZoomMtgEmbedded = (await import('@zoom/meetingsdk/embedded')).default;
      const client = ZoomMtgEmbedded.createClient() as ZoomEmbeddedClient;
      clientRef.current = client;

      const initResult = await client.init({
        zoomAppRoot: root,
        language: 'en-US',
        patchJsMedia: true,
      });
      if (isSdkFailure(initResult)) {
        setError(initResult.reason || 'Could not start Zoom in the browser.');
        clientRef.current = null;
        setOpen(false);
        return;
      }

      const joinResult = await client.join({
        signature: creds.signature,
        meetingNumber: creds.meetingNumber,
        password: creds.password || '',
        userName: creds.userName,
        userEmail: creds.userEmail || undefined,
      });
      if (isSdkFailure(joinResult)) {
        setError(joinResult.reason || 'Could not join the meeting.');
        clientRef.current = null;
        setOpen(false);
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message || '')
          : '';
      setError(
        msg ||
          (e instanceof Error ? e.message : 'Could not start in-browser Zoom. Use “Open in Zoom” if needed.'),
      );
      setOpen(false);
      clientRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [programId]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void join()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-900 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorPlay className="h-4 w-4" />}
          Join in browser
        </button>
        {open && (
          <button
            type="button"
            onClick={() => void leave()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            Leave meeting
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-700 rounded-lg bg-red-50 px-3 py-2">
          {error}
          {joinUrlFallback ? (
            <>
              {' '}
              <a href={joinUrlFallback} className="font-medium underline" target="_blank" rel="noopener noreferrer">
                Open in Zoom instead
              </a>
            </>
          ) : null}
        </p>
      )}

      <p className="text-xs text-gray-500">
        Runs Zoom&apos;s embedded web client inside this page. Requires a Zoom Meeting SDK app on the server; first load
        may take a few seconds.
      </p>

      {open ? (
        <div
          ref={containerRef}
          className="min-h-[480px] w-full rounded-xl border border-gray-200 bg-black/5 overflow-hidden"
          aria-label="Zoom meeting"
        />
      ) : null}
    </div>
  );
}
