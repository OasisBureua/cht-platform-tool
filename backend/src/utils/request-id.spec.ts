import { newContentHubRequestId } from './request-id';

describe('newContentHubRequestId', () => {
  it('returns a UUID v4 string', () => {
    const id = newContentHubRequestId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('generates unique values', () => {
    expect(newContentHubRequestId()).not.toBe(newContentHubRequestId());
  });
});
