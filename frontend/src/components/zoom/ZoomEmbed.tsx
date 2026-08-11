import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, MonitorPlay, X } from 'lucide-react';
import type { MeetingSdkAuth } from '../../api/webinars';

function isBrowserSupportedForZoomEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof WebAssembly === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/MSIE |Trident\//.test(ua)) return false;
  return true;
}

type ZoomFrameMessage =
  | { type: 'cht-zoom-ready' }
  | { type: 'cht-zoom-joined' }
  | { type: 'cht-zoom-left' }
  | { type: 'cht-zoom-error'; message?: string };

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
 * Shared Zoom Meeting SDK embed for Office Hours and Live Webinars.
 *
 * Runs Zoom inside a same-origin iframe (`/zoom-embed.html`) that loads the SDK from
 * Zoom's CDN with React 18. Importing `@zoom/meetingsdk` into this React 19 SPA throws
 * `Cannot read properties of undefined (reading 'ReactCurrentOwner')`.
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameReadyRef = useRef(false);
  const joinedRef = useRef(false);
  const pendingCredsRef = useRef<MeetingSdkAuth | null>(null);

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

  const postToFrame = useCallback((msg: object) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(msg, window.location.origin);
  }, []);

  const sendJoinWhenReady = useCallback(
    (creds: MeetingSdkAuth) => {
      if (!frameReadyRef.current) {
        pendingCredsRef.current = creds;
        return;
      }
      pendingCredsRef.current = null;
      postToFrame({ type: 'cht-zoom-join', payload: creds });
    },
    [postToFrame],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as ZoomFrameMessage | null;
      if (!data || typeof data !== 'object' || !('type' in data)) return;

      if (data.type === 'cht-zoom-ready') {
        frameReadyRef.current = true;
        if (pendingCredsRef.current) {
          const creds = pendingCredsRef.current;
          pendingCredsRef.current = null;
          postToFrame({ type: 'cht-zoom-join', payload: creds });
        }
        return;
      }

      if (data.type === 'cht-zoom-joined') {
        joinedRef.current = true;
        setLoading(false);
        setError(null);
        void report('JOINED');
        return;
      }

      if (data.type === 'cht-zoom-left') {
        if (joinedRef.current) {
          joinedRef.current = false;
          void report('LEFT');
        }
        return;
      }

      if (data.type === 'cht-zoom-error') {
        setLoading(false);
        setError(
          data.message ||
            'Could not start in-browser Zoom. Use “Open in Zoom” if needed.',
        );
        joinedRef.current = false;
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [postToFrame, report]);

  const leave = useCallback(async () => {
    const wasJoined = joinedRef.current;
    joinedRef.current = false;
    pendingCredsRef.current = null;
    postToFrame({ type: 'cht-zoom-leave' });
    if (wasJoined) {
      void report('LEFT');
    }
    setOpen(false);
    setLoading(false);
    setError(null);
    frameReadyRef.current = false;
  }, [postToFrame, report]);

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

    if (open || joinedRef.current) {
      await leave();
    }

    setLoading(true);
    setOpen(true);
    try {
      const creds = await fetchAuth();
      // Iframe mounts after setOpen(true); wait a tick then send (or queue until ready).
      await new Promise((r) => setTimeout(r, 0));
      sendJoinWhenReady(creds);
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
      setLoading(false);
    }
  }, [fetchAuth, leave, open, sendJoinWhenReady]);

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
        <iframe
          ref={iframeRef}
          title="Zoom session"
          src="/zoom-embed.html"
          className="min-h-[480px] w-full rounded-xl border border-gray-200 bg-black/5 overflow-hidden"
          allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => {
            // Some browsers don't re-fire ready if cached; nudge after load.
            // The iframe also posts cht-zoom-ready on boot.
          }}
        />
      ) : null}
    </div>
  );
}
