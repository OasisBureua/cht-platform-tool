/** Format axios/Zoom HTTP errors with status + JSON body for job logs. */
export function formatZoomHttpError(err: unknown): string {
  const axiosErr = err as {
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const base = axiosErr.message ?? String(err);
  const status = axiosErr.response?.status;
  const detail =
    axiosErr.response?.data != null
      ? JSON.stringify(axiosErr.response.data)
      : '';
  return `${base}${status ? ` HTTP ${status}` : ''}${detail ? `: ${detail}` : ''}`;
}
