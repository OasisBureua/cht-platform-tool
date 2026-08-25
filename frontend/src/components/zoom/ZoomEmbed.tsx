import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, MonitorPlay, X } from 'lucide-react';
import type { MeetingSdkAuth } from '../../api/webinars';
import { ZOOM_EMBED_HTML } from './zoomEmbedHtml';

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
  | { type: 'cht-zoom-error'; message?: string; code?: string };

function isWaitingForHostMessage(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('has not started') ||
    m.includes('not started') ||
    m.includes('waiting for the host') ||
    m.includes('waiting for host') ||
    m.includes('host has not started')
  );
}

const WAITING_FOR_HOST_COPY =
  'Waiting for the host to start this session. Once they start it in Zoom, click Join in browser again.';

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
  /**
   * `inline` — card on a detail page.
   * `fill` — nearly full viewport (session page); iframe stretches to parent.
   */
  layout?: 'inline' | 'fill';
  /** Start joining as soon as the component mounts (session page). */
  autoJoin?: boolean;
};

/**
 * Shared Zoom Meeting SDK embed for Office Hours and Live Webinars.
 *
 * Runs Zoom inside a blob: iframe that loads the SDK from Zoom's CDN with React 18.
 * Importing `@zoom/meetingsdk` into this React 19 SPA throws ReactCurrentOwner.
 * Deploy excludes `*.html` except index.html, so we do not fetch `/zoom-embed.html` from S3.
 */
export function ZoomEmbed({
  fetchAuth,
  reportAttendance,
  disabled,
  joinUrlFallback,
  joinLabel = 'Join in browser',
  leaveLabel = 'Leave session',
  hint = "Runs Zoom's embedded web client inside this page. First load may take a few seconds. Use Open in Zoom if your browser is unsupported.",
  layout = 'inline',
  autoJoin = false,
}: ZoomEmbedProps) {
  const fill = layout === 'fill';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForHost, setWaitingForHost] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameReadyRef = useRef(false);
  const joinedRef = useRef(false);
  const pendingCredsRef = useRef<MeetingSdkAuth | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const autoJoinStartedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setIframeSrc(null);
      return;
    }
    const blob = new Blob([ZOOM_EMBED_HTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setIframeSrc(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [open]);

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
    win.postMessage(msg, '*');
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
      const fromOurFrame = event.source === iframeRef.current?.contentWindow;
      if (!fromOurFrame) return;
      if (
        event.origin !== window.location.origin &&
        event.origin !== 'null'
      ) {
        return;
      }
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
        setWaitingForHost(false);
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
        joinedRef.current = false;
        const raw = data.message || '';
        if (data.code === 'waiting_for_host' || isWaitingForHostMessage(raw)) {
          setWaitingForHost(true);
          setError(null);
          return;
        }
        setWaitingForHost(false);
        setError(raw || 'Could not start in-browser Zoom. Use “Open in Zoom” if needed.');
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
    setWaitingForHost(false);
    frameReadyRef.current = false;
  }, [postToFrame, report]);

  const join = useCallback(async () => {
    setError(null);
    setWaitingForHost(false);
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

  useEffect(() => {
    if (!autoJoin || autoJoinStartedRef.current || disabled) return;
    autoJoinStartedRef.current = true;
    void join();
    // Intentionally once on mount for session pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, disabled]);

  // Tear down Zoom on unmount so Back does not leave a blank/white overlay.
  useEffect(() => {
    return () => {
      joinedRef.current = false;
      pendingCredsRef.current = null;
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'cht-zoom-leave' },
          '*',
        );
      } catch {
        /* ignore */
      }
    };
  }, []);

  const controls = (
    <div className={fill ? 'flex flex-wrap items-center gap-2' : 'flex flex-wrap gap-2'}>
      {!autoJoin || error || waitingForHost || unsupported ? (
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void join()}
          className={
            fill
              ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:opacity-50'
              : 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-900 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50'
          }
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorPlay className="h-4 w-4" />}
          {open && !loading ? 'Rejoin in browser' : joinLabel}
        </button>
      ) : loading ? (
        <span className="inline-flex items-center gap-2 text-sm text-gray-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting…
        </span>
      ) : null}
      {open && (
        <button
          type="button"
          onClick={() => void leave()}
          className={
            fill
              ? 'inline-flex items-center gap-2 rounded-lg border border-white/20 bg-transparent px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10'
              : 'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50'
          }
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
          className={
            fill
              ? 'inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10'
              : 'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50'
          }
        >
          Open in Zoom
          <ExternalLink className="h-4 w-4 opacity-80" />
        </a>
      ) : null}
    </div>
  );

  const statusBlocks = (
    <>
      {waitingForHost && (
        <p
          className={
            fill
              ? 'text-sm text-amber-100 rounded-lg bg-amber-950/80 border border-amber-700/50 px-3 py-2'
              : 'text-sm text-amber-950 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2'
          }
        >
          {WAITING_FOR_HOST_COPY}
        </p>
      )}

      {error && (
        <p
          className={
            fill
              ? 'text-sm text-red-100 rounded-lg bg-red-950/80 border border-red-700/50 px-3 py-2'
              : 'text-sm text-red-700 rounded-lg bg-red-50 px-3 py-2'
          }
        >
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

      {!fill &&
        (unsupported ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Unsupported browser or device for the embedded Zoom client. Use Open in Zoom to continue.
          </p>
        ) : (
          <p className="text-xs text-gray-500">{hint}</p>
        ))}
    </>
  );

  const iframe = open && iframeSrc ? (
    <iframe
      ref={iframeRef}
      title="Zoom session"
      src={iframeSrc}
      className={
        fill
          ? 'h-full w-full border-0 bg-black'
          : 'h-[75vh] min-h-[640px] w-full rounded-xl border border-gray-200 bg-black/5 overflow-hidden'
      }
      allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
    />
  ) : null;

  if (fill) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="shrink-0 space-y-2 px-1">
          {controls}
          {statusBlocks}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-black">
          {iframe}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {controls}
      {statusBlocks}
      {iframe}
    </div>
  );
}
