import { randomUUID } from 'node:crypto';

/** Fresh UUID for each outbound Content Hub request (X-Request-Id header). */
export function newContentHubRequestId(): string {
  return randomUUID();
}
