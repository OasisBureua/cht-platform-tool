import { postProductionApi } from '../../../api/postProduction';

/**
 * Sends post-production failures to the backend log (CloudWatch), so a
 * render or transcript that breaks on someone else's machine shows up
 * without a screenshot. Never throws: logging must not break the tool.
 */
export function logClipper(event: string, err: unknown, context: Record<string, unknown> = {}, level: 'error' | 'warn' | 'info' = 'error') {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
  if (level === 'error') console.error(`[post-production] ${event}`, err);
  const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 6).join('\n') : undefined;
  void postProductionApi
    .log({
      level,
      event,
      message: message.slice(0, 2000),
      context: { ...context, stack, userAgent: navigator.userAgent, at: window.location.pathname },
    })
    .catch(() => {
      /* the log endpoint is down too; the console has it */
    });
}

/** Logs uncaught errors and rejections while a post-production page is open. */
export function watchClipperErrors(page: string): () => void {
  const onError = (e: ErrorEvent) => logClipper('uncaught', e.error ?? e.message, { page, source: e.filename, line: e.lineno });
  const onRejection = (e: PromiseRejectionEvent) => logClipper('unhandled-rejection', e.reason, { page });
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
