/**
 * Parse Content Hub public API error bodies.
 *
 * Primary shape (aligned with EC2 MediaHub):
 *   { error: { code, message, status, request_id } }
 *
 * Legacy fallbacks during rollout:
 *   { errors: { details } } | { detail: string }
 */

export function contentHubErrorMessage(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return 'Unknown error';
  }

  const record = body as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  const errors = record.errors;
  if (errors && typeof errors === 'object') {
    const details = (errors as Record<string, unknown>).details;
    if (typeof details === 'string' && details.trim()) {
      return details;
    }
  }

  if (typeof record.detail === 'string' && record.detail.trim()) {
    return record.detail;
  }

  return 'Unknown error';
}

export function contentHubErrorRequestId(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const error = (body as Record<string, unknown>).error;
  if (error && typeof error === 'object') {
    const requestId = (error as Record<string, unknown>).request_id;
    if (typeof requestId === 'string' && requestId.trim()) {
      return requestId.trim();
    }
  }

  return undefined;
}

export function contentHubErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const error = (body as Record<string, unknown>).error;
  if (error && typeof error === 'object') {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === 'string' && code.trim()) {
      return code.trim();
    }
  }

  return undefined;
}

export function axiosContentHubErrorMeta(err: unknown): {
  status: number;
  message: string;
  code?: string;
  requestId?: string;
} {
  const response = (err as { response?: { status?: number; data?: unknown } })
    ?.response;
  if (!response) {
    return {
      status: 500,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  return {
    status: response.status ?? 500,
    message: contentHubErrorMessage(response.data),
    code: contentHubErrorCode(response.data),
    requestId: contentHubErrorRequestId(response.data),
  };
}
