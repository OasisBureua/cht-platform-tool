import { useCallback, useRef, useState } from 'react';
import { ExternalLink, Loader2, MonitorPlay, X } from 'lucide-react';
import type { MeetingSdkAuth } from '../../api/webinars';

type ZoomEmbeddedClient = {
  init: (args: object) => Promise<string | object>;
  join: (args: object) => Promise<string | object>;
  leaveMeeting: (userId?: number) => Promise<string | object>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
};

function isSdkFailure(r: unknown): r is { type: string; reason: string } {
  return typeof r === 'object' && r !== null && 'type' in r && 'reason' in r;
}

function isBrowserSupportedForZoomEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof WebAssembly === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Zoom Web SDK does not support IE / very old browsers; keep a light check.
  if (/MSIE |Trident\//.test(ua)) return false;
  return true;
}

export type ZoomEmbedProps = {
  /** Fetch Meeting SDK join credentials (JWT + meeting number + password). */
  fetchAuth: () => Promise<MeetingSdkAuth>;
  /** Optional client-side attendance reporting (JOINED / LEFT). */
  reportAttendance?: (event: 'JOINED' | 'LEFT') => Promise<void>;
  disabled?: boolean;
  /** External Zoom URL shown as fallback / error recovery. */
  joinUrlFallback?: string;
  /** Primary CTA label */
  joinLabel?: string;
  leaveLabel?: string;
  /** Hint under controls */
  hint?: string;
};

/**
 * Shared Zoom Meeting SDK (component view) embed for Office Hours and Live Webinars.
 * Requires Zoom Marketplace **Meeting SDK** credentials on the server.
 */
export function ZoomEmbed({
  fetchAuth,
  reportAttendance,
  disabled,
  joinUrlFallback,
  joinLabel = 'Join in browser',
  leaveLabel = 'Leave session',
  hint = "Runs Zoom's embedded web client inside this page. First load may take a few seconds. Use Open in Zoom if your browser is unsupported.",
}: ZoomEmbedProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<ZoomEmbeddedClient | null>(null);
  const joinedRef = useRef(false);

  const report = useCallback(
    async (event: 'JOINED' | 'LEFT') => {
      if (!reportAttendance) return;
      try {
        await reportAttendance(event);
      } catch {
        /* non-fatal — webhook still covers server-side attendance */
      }
    },
    [reportAttendance],
  );

  const leave = useCallback(async () => {
    const wasJoined = joinedRef.current;
    joinedRef.current = false;
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
    if (wasJoined) {
      void report('LEFT');
    }
    setOpen(false);
    setError(null);
  }, [report]);

  const join = useCallback(async () => {
    setError(null);
    setUnsupported(false);

    if (!isBrowserSupportedForZoomEmbed()) {
      setUnsupported(true);
      setError(
        'This browser cannot run the in-app Zoom client. Use “Open in Zoom” below.',
      );
      return;
    }

    // Leave any prior session before rejoining.
    if (clientRef.current || joinedRef.current) {
      await leave();
    }

    setLoading(true);
    setOpen(true);
    try {
      const creds = await fetchAuth();
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

      const initArgs: Record<string, unknown> = {
        zoomAppRoot: root,
        language: 'en-US',
        patchJsMedia: true,
      };
      // Without COOP/COEP isolation, Zoom still joins; gallery/HD may be limited.
      if (typeof window !== 'undefined' && !window.crossOriginIsolated) {
        initArgs.disableCORP = true;
      }

      const initResult = await client.init(initArgs);
      if (isSdkFailure(initResult)) {
        setError(initResult.reason || 'Could not start Zoom in the browser.');
        clientRef.current = null;
        setOpen(false);
        return;
      }

      const joinArgs: Record<string, unknown> = {
        signature: creds.signature,
        meetingNumber: creds.meetingNumber,
        password: creds.password || '',
        userName: creds.userName,
        userEmail: creds.userEmail || undefined,
      };
      if (creds.tk) joinArgs.tk = creds.tk;
      if (creds.sdkKey) joinArgs.sdkKey = creds.sdkKey;

      const joinResult = await client.join(joinArgs);
      if (isSdkFailure(joinResult)) {
        setError(joinResult.reason || 'Could not join the session.');
        clientRef.current = null;
        setOpen(false);
        return;
      }

      joinedRef.current = true;
      void report('JOINED');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String(
              (e as { response?: { data?: { message?: string | string[] } } })
                .response?.data?.message || '',
            )
          : '';
      const normalized = Array.isArray(msg) ? msg.join(' ') : msg;
      setError(
        normalized ||
          (e instanceof Error
            ? e.message
            : 'Could not start in-browser Zoom. Use “Open in Zoom” if needed.'),
      );
      setOpen(false);
      clientRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [fetchAuth, leave, report]);

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
          {open && !loading ? 'Rejoin in browser' : joinLabel}
        </button>
        {open && (
          <button
            type="button"
            onClick={() => void leave()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            {leaveLabel}
          </button>
        )}
        {joinUrlFallback ? (
          <a
            href={joinUrlFallback}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Open in Zoom
            <ExternalLink className="h-4 w-4 opacity-80" />
          </a>
        ) : null}
      </div>

      {error && (
        <p className="text-sm text-red-700 rounded-lg bg-red-50 px-3 py-2">
          {error}
          {joinUrlFallback ? (
            <>
              {' '}
              <a
                href={joinUrlFallback}
                className="font-medium underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Zoom instead
              </a>
            </>
          ) : null}
        </p>
      )}

      {unsupported ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Unsupported browser or device for the embedded Zoom client. Use Open in Zoom to continue.
        </p>
      ) : (
        <p className="text-xs text-gray-500">{hint}</p>
      )}

      {open ? (
        <div
          ref={containerRef}
          className="min-h-[480px] w-full rounded-xl border border-gray-200 bg-black/5 overflow-hidden"
          aria-label="Zoom session"
        />
      ) : null}
    </div>
  );
}
