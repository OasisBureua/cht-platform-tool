import {
  axiosContentHubErrorMeta,
  contentHubErrorMessage,
  contentHubErrorRequestId,
} from './content-hub-error';

describe('contentHubErrorMessage', () => {
  it('reads error.message (MediaHub-aligned envelope)', () => {
    expect(
      contentHubErrorMessage({
        error: {
          code: 'AUTH_INVALID_KEY',
          message: 'Invalid API key',
          status: 401,
          request_id: 'abc',
        },
      }),
    ).toBe('Invalid API key');
  });

  it('falls back to errors.details', () => {
    expect(
      contentHubErrorMessage({
        errors: { status_code: 404, details: 'KOL not found' },
      }),
    ).toBe('KOL not found');
  });

  it('falls back to detail string', () => {
    expect(contentHubErrorMessage({ detail: 'Not found' })).toBe('Not found');
  });
});

describe('contentHubErrorRequestId', () => {
  it('reads error.request_id', () => {
    expect(
      contentHubErrorRequestId({
        error: { message: 'x', request_id: 'req-123' },
      }),
    ).toBe('req-123');
  });
});

describe('axiosContentHubErrorMeta', () => {
  it('extracts status, message, and request_id from axios-like error', () => {
    const meta = axiosContentHubErrorMeta({
      response: {
        status: 404,
        data: {
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'KOL not found',
            status: 404,
            request_id: 'upstream-9',
          },
        },
      },
    });
    expect(meta.status).toBe(404);
    expect(meta.message).toBe('KOL not found');
    expect(meta.requestId).toBe('upstream-9');
    expect(meta.code).toBe('RESOURCE_NOT_FOUND');
  });
});
