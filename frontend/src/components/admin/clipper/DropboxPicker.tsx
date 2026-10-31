import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Cloud, FileVideo, Folder, Loader2, LogOut } from 'lucide-react';
import { connectDropbox, disconnectDropbox, dropboxConnected, dropboxEnabled, fetchDropboxFile, finishDropboxSignIn, listDropbox, type DropboxEntry } from './dropbox';
import { logClipper } from './clipperLog';

/**
 * Recordings from the team's Dropbox: browse folders, pick a video, and it
 * downloads into the tab to clip and render like a local file. A caption
 * file with the same name in the same folder comes along with it.
 */

const sizeOf = (n?: number) => (n == null ? '' : n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`);
const baseName = (name: string) => name.replace(/\.[^.]+$/, '').toLowerCase();

export function DropboxPicker({ onPick }: { onPick: (video: File, captions: File | null, path: string) => void }) {
  const [connected, setConnected] = useState(dropboxConnected);
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<DropboxEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<{ name: string; ratio: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    finishDropboxSignIn()
      .then((done) => done && setConnected(true))
      .catch((err) => {
        setError('Dropbox sign-in didn’t finish. Try connecting again.');
        logClipper('dropbox-signin', err);
      });
  }, []);

  const open = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listDropbox(p));
      setPath(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That folder didn’t open.');
      setConnected(dropboxConnected());
      logClipper('dropbox-list', err, { path: p }, 'warn');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected && entries == null) void open('');
  }, [connected, entries, open]);

  if (!dropboxEnabled()) return null;

  const pick = async (e: DropboxEntry) => {
    setDownloading({ name: e.name, ratio: 0 });
    setError(null);
    try {
      const video = await fetchDropboxFile(e, (ratio) => setDownloading({ name: e.name, ratio }));
      const cap = entries?.find((x) => x.kind === 'file' && /\.(vtt|srt)$/i.test(x.name) && baseName(x.name) === baseName(e.name));
      const captions = cap ? await fetchDropboxFile(cap) : null;
      onPick(video, captions, e.path);
    } catch (err) {
      setError('That file didn’t download. Try again.');
      logClipper('dropbox-download', err, { path: e.path, size: e.size });
    } finally {
      setDownloading(null);
    }
  };

  const crumbs = path.split('/').filter(Boolean);
  const videos = (entries ?? []).filter((e) => e.kind === 'folder' || !/\.(vtt|srt)$/i.test(e.name));

  return (
    <section aria-labelledby="clipper-dropbox" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="clipper-dropbox" className="display text-body-l text-text">
          Dropbox
        </h3>
        {connected ? (
          <button
            type="button"
            onClick={() => {
              disconnectDropbox();
              setConnected(false);
              setEntries(null);
            }}
            className="ms-auto inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-xs text-dim hover:bg-surface-2"
          >
            <LogOut className="size-3.5" aria-hidden /> Disconnect
          </button>
        ) : null}
      </div>
      {!connected ? (
        <button type="button" onClick={() => void connectDropbox()} className="flex w-full items-center gap-3 rounded-[10px] bg-surface p-3 text-left ring-1 ring-hairline hover:ring-hairline-strong">
          <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-anchor/10 text-anchor">
            <Cloud className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-body-s font-medium text-text">Connect Dropbox</span>
            <span className="block text-xs text-muted2">Clip recordings straight from the team folder, no download to your computer first.</span>
          </span>
        </button>
      ) : (
        <div className="rounded-[10px] bg-surface ring-1 ring-hairline">
          <nav aria-label="Dropbox folder" className="flex flex-wrap items-center gap-1 border-b border-hairline px-3 py-2 text-xs">
            <button type="button" onClick={() => void open('')} className="text-anchor hover:underline">
              Dropbox
            </button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="size-3 text-faint" aria-hidden />
                <button type="button" onClick={() => void open(`/${crumbs.slice(0, i + 1).join('/')}`)} className="text-anchor hover:underline">
                  {c}
                </button>
              </span>
            ))}
            {loading ? <Loader2 className="ms-auto size-3.5 animate-spin text-faint" aria-hidden /> : null}
          </nav>
          {downloading ? (
            <p className="flex items-center gap-2 px-3 py-3 text-body-s text-text">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Downloading {downloading.name} · {Math.round(downloading.ratio * 100)}%
            </p>
          ) : videos.length === 0 && !loading ? (
            <p className="px-3 py-3 text-body-s text-muted2">No folders or videos here.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-hairline overflow-y-auto">
              {videos.map((e) => (
                <li key={e.path}>
                  <button type="button" onClick={() => (e.kind === 'folder' ? void open(e.path) : void pick(e))} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2">
                    {e.kind === 'folder' ? <Folder className="size-4 shrink-0 text-anchor" aria-hidden /> : <FileVideo className="size-4 shrink-0 text-anchor" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate text-body-s text-text">{e.name}</span>
                    <span className="meta text-faint">{e.kind === 'file' ? sizeOf(e.size) : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error ? <p className="text-body-s text-dim">{error}</p> : null}
    </section>
  );
}
