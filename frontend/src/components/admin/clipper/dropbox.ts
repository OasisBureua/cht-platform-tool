/**
 * Dropbox as a clipper source, through Dropbox's HTTP API with a PKCE
 * sign-in. The drop-in Chooser opens a popup, and the app's COOP header
 * (same-origin, for the Zoom Meeting SDK) cuts popups off from the page,
 * so this signs in with a full-page redirect instead.
 *
 * Needs VITE_DROPBOX_APP_KEY, and the page's address registered as a
 * redirect URI in the Dropbox app. The token lives in sessionStorage and
 * is short-lived; nothing is stored on the platform.
 */

const APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY?.trim() || '';
const TOKEN_KEY = 'chm-dropbox-token';
const VERIFIER_KEY = 'chm-dropbox-verifier';

export type DropboxEntry = { kind: 'folder' | 'file'; name: string; path: string; size?: number };

export const dropboxEnabled = () => !!APP_KEY;

const redirectUri = () => `${window.location.origin}${window.location.pathname}`;

function readToken(): string | null {
  try {
    const raw = window.sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expires } = JSON.parse(raw) as { token: string; expires: number };
    return Date.now() < expires ? token : null;
  } catch {
    return null;
  }
}

export const dropboxConnected = () => !!readToken();

export function disconnectDropbox() {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Sends the page to Dropbox to sign in; it comes back with `?code=`. */
export async function connectDropbox() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  window.sessionStorage.setItem(VERIFIER_KEY, verifier);
  const q = new URLSearchParams({
    client_id: APP_KEY,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri(),
    token_access_type: 'online',
  });
  window.location.assign(`https://www.dropbox.com/oauth2/authorize?${q}`);
}

/** Finishes the sign-in if the page was just sent back from Dropbox. */
export async function finishDropboxSignIn(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const verifier = window.sessionStorage.getItem(VERIFIER_KEY);
  if (!code || !verifier || !APP_KEY) return false;
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  window.history.replaceState(null, '', url.toString());
  window.sessionStorage.removeItem(VERIFIER_KEY);
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, grant_type: 'authorization_code', code_verifier: verifier, client_id: APP_KEY, redirect_uri: redirectUri() }),
  });
  if (!res.ok) throw new Error(`Dropbox sign-in failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: data.access_token, expires: Date.now() + (data.expires_in ?? 14400) * 1000 - 60_000 }));
  return true;
}

async function rpc<T>(endpoint: string, body: unknown): Promise<T> {
  const token = readToken();
  if (!token) throw new Error('Connect Dropbox first.');
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    disconnectDropbox();
    throw new Error('Dropbox signed out. Connect again.');
  }
  if (!res.ok) throw new Error(`Dropbox ${endpoint} failed (${res.status})`);
  return (await res.json()) as T;
}

const PLAYABLE = /\.(mp4|mov|m4v|webm|mkv|vtt|srt)$/i;

/** A folder's sub-folders and the videos and caption files in it. */
export async function listDropbox(path: string): Promise<DropboxEntry[]> {
  type Raw = { '.tag': 'folder' | 'file' | 'deleted'; name: string; path_display: string; size?: number };
  let page = await rpc<{ entries: Raw[]; cursor: string; has_more: boolean }>('files/list_folder', { path, limit: 2000 });
  const all = [...page.entries];
  while (page.has_more && all.length < 6000) {
    page = await rpc('files/list_folder/continue', { cursor: page.cursor });
    all.push(...page.entries);
  }
  return all
    .filter((e) => e['.tag'] === 'folder' || (e['.tag'] === 'file' && PLAYABLE.test(e.name)))
    .map((e) => ({ kind: e['.tag'] === 'folder' ? 'folder' : 'file', name: e.name, path: e.path_display, size: e.size }) as DropboxEntry)
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1));
}

/** Downloads a Dropbox file into the tab, reporting progress, as a File the clipper can render from. */
export async function fetchDropboxFile(entry: DropboxEntry, onProgress?: (ratio: number) => void): Promise<File> {
  const { link } = await rpc<{ link: string }>('files/get_temporary_link', { path: entry.path });
  const res = await fetch(link);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || entry.size || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    if (total) onProgress?.(got / total);
  }
  const type = /\.vtt$/i.test(entry.name) ? 'text/vtt' : /\.srt$/i.test(entry.name) ? 'application/x-subrip' : /\.webm$/i.test(entry.name) ? 'video/webm' : /\.mov$/i.test(entry.name) ? 'video/quicktime' : 'video/mp4';
  return new File(parts as BlobPart[], entry.name, { type });
}
