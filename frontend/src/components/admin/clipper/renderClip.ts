import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { Clip } from './clipperCore';

/**
 * Cuts clip files in the browser with ffmpeg.wasm. Only used for sources
 * opened from the computer: the recordings bucket doesn't allow the app
 * to read bytes cross-origin, so Zoom sources export a cut list instead.
 *
 * The library and its ~30MB core load on the first render only, never
 * with the page. The source file is mounted rather than copied into
 * memory, so an hour-long recording doesn't have to fit in the tab.
 */
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
const MOUNT = '/source';

let loading: Promise<FFmpeg> | null = null;

async function getFfmpeg(): Promise<FFmpeg> {
  if (!loading) {
    loading = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
      const ff = new FFmpeg();
      await ff.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ff;
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

export type RenderMode = 'fast' | 'precise';

/**
 * `fast` copies the streams: instant and lossless, but the start snaps to
 * the nearest keyframe before the in-point. `precise` re-encodes for a
 * frame-accurate start, at a few times slower than real time.
 */
export async function renderClip(
  file: File,
  clip: Clip,
  mode: RenderMode,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const ff = await getFfmpeg();
  const { FFFSType } = await import('@ffmpeg/ffmpeg');
  const ext = (/\.([a-z0-9]+)$/i.exec(file.name)?.[1] ?? 'mp4').toLowerCase();
  const outExt = ['mp4', 'mov', 'm4v'].includes(ext) || mode === 'precise' ? 'mp4' : ext;
  const out = `clip-${Date.now()}.${outExt}`;
  const duration = Math.max(0.1, clip.end - clip.start);

  const onProg = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(1, progress)));
  ff.on('progress', onProg);
  try {
    try {
      await ff.createDir(MOUNT);
    } catch {
      /* already there from an earlier render */
    }
    await ff.mount(FFFSType.WORKERFS, { files: [file] }, MOUNT);
    const input = `${MOUNT}/${file.name}`;
    const args =
      mode === 'fast'
        ? ['-ss', clip.start.toFixed(3), '-i', input, '-t', duration.toFixed(3), '-c', 'copy', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', out]
        : ['-ss', clip.start.toFixed(3), '-i', input, '-t', duration.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out];
    const code = await ff.exec(args);
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
    const data = (await ff.readFile(out)) as Uint8Array;
    await ff.deleteFile(out);
    // Copy out of the wasm heap: a Blob can't take a view that may sit on a SharedArrayBuffer.
    return new Blob([new Uint8Array(data)], { type: outExt === 'webm' ? 'video/webm' : 'video/mp4' });
  } finally {
    ff.off('progress', onProg);
    try {
      await ff.unmount(MOUNT);
    } catch {
      /* not mounted */
    }
  }
}
