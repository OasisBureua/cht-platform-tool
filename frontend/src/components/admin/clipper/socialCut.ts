import { keepRanges, spokenWords, type Cue } from './clipperCore';

/**
 * Social cuts: a clip reframed for the feed. One drawing function serves
 * the live preview and the render, so what you see is what you export.
 *
 * Framing follows the transcript: "speaker" crops to whoever is talking
 * (you say once where each person sits in the frame), "stacked" puts the
 * left and right of a two-up recording one above the other, "full" fits
 * the whole frame over a blurred fill. Captions come from the transcript,
 * burned in or karaoke style, a few words at a time.
 */

export type Aspect = '9:16' | '1:1' | '16:9';
export type CutFormat = {
  aspect: Aspect;
  captions: 'off' | 'burned' | 'karaoke';
  framing: 'full' | 'speaker' | 'stacked';
  logo: boolean;
  tighten: boolean;
  /** Where each speaker sits across the source frame, 0 (left) to 1 (right). */
  positions: Record<string, number>;
};

export const DEFAULT_FORMAT: CutFormat = { aspect: '9:16', captions: 'karaoke', framing: 'speaker', logo: true, tighten: true, positions: {} };
export const OUT_SIZE: Record<Aspect, [number, number]> = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080] };

const MARK_A =
  'M8.93474 1.49742C9.07776 1.49184 9.17495 1.53253 9.28261 1.62631C9.4705 1.78998 11.2071 3.5232 11.2532 3.64134C11.2922 3.7413 11.2656 4.14647 11.2655 4.28049L11.2639 5.98453C11.2638 6.17469 11.2297 7.01038 11.3334 7.09768C11.4051 7.08948 12.123 6.34163 12.2254 6.23916L13.9444 4.51963C14.2049 4.25872 14.4608 3.99542 14.7304 3.7439C14.9418 3.54665 15.2731 3.60409 15.5503 3.60578L16.5052 3.60998C16.8076 3.61063 17.8283 3.52275 17.9928 3.75654C18.1225 3.94096 18.0805 4.69656 18.0752 4.96005C18.0631 5.55316 18.1082 6.18162 18.0535 6.77129C18.0421 6.88565 17.3737 7.52043 17.2485 7.64552L15.5103 9.38215C15.2283 9.66345 14.9362 9.94896 14.6581 10.235C14.6194 10.2748 14.6013 10.3033 14.5964 10.3552C14.667 10.4414 15.459 10.4114 15.6327 10.4113L17.1794 10.4117C17.4361 10.4103 17.7544 10.3905 18.0031 10.4279C18.0966 10.4448 18.1866 10.5223 18.2514 10.5878C18.8406 11.1837 19.4428 11.7681 20.0264 12.3691C20.0657 12.4096 20.1515 12.5279 20.1757 12.5785C20.211 12.6521 20.1569 12.8222 20.1071 12.8811C19.9375 13.082 19.7411 13.2671 19.5551 13.4532L18.4174 14.5907C18.3189 14.689 18.1783 14.8508 18.0468 14.8994C17.8348 14.9776 16.3802 14.9342 16.0363 14.9337C14.4561 14.9338 12.841 14.9141 11.2647 14.9391L11.264 17.7465C11.2639 18.2139 11.2735 18.6825 11.2615 19.1494C11.2557 19.3767 11.1102 19.4343 10.9102 19.44C10.666 19.4471 10.4207 19.4421 10.1763 19.4411L8.82518 19.4395L7.70603 19.4424C7.45606 19.4432 7.14202 19.4564 6.90106 19.4153C6.64894 19.1673 6.73108 18.8037 6.72099 18.4755C6.71566 18.0339 6.74337 17.4699 6.97302 17.0753C7.25999 16.5821 7.82356 16.087 8.22982 15.6827L9.99945 13.915C10.2107 13.7047 10.9989 12.9728 11.1394 12.6865C11.1922 12.579 10.7978 12.2098 10.6759 12.0883L10.0794 11.492L8.09812 9.51391C7.70754 9.12432 7.23679 8.73421 6.97279 8.24415C6.84932 8.01494 6.77834 7.74567 6.74778 7.48768C6.71248 7.18967 6.68563 3.86575 6.75819 3.65772C6.78771 3.57304 6.87677 3.47899 6.93649 3.41305C7.19342 3.1294 7.48666 2.86756 7.75685 2.59562C8.07341 2.27703 8.38342 1.9308 8.72068 1.63558C8.7893 1.57549 8.85099 1.53376 8.93474 1.49742Z';
const MARK_B =
  'M2.47293 10.4176C2.84684 10.3936 6.65609 10.3934 6.72007 10.427C6.77058 10.4536 6.81894 10.4861 6.86411 10.5209C6.98717 10.6156 7.09381 10.7363 7.20334 10.846L7.7586 11.4019C7.95918 11.6026 8.87788 12.4467 8.90605 12.6756C8.82771 12.9445 7.93759 13.761 7.69754 13.9996C7.45958 14.2398 7.22116 14.4813 6.98147 14.7196C6.78298 14.9169 6.68561 14.9337 6.41412 14.934C5.52449 14.9349 4.63533 14.9344 3.74592 14.9342L2.98341 14.9345C2.69673 14.9353 2.47551 14.9873 2.25879 14.7749C2.21733 14.5829 2.22752 14.2714 2.22735 14.0689L2.22701 13.1503L2.22737 11.5597C2.22747 11.301 2.20479 10.8417 2.25747 10.5797C2.27303 10.5023 2.39375 10.4443 2.47293 10.4176Z';
let markPaths: Path2D[] | null = null;

export const cueAt = (cues: Cue[], t: number) => cues.find((c) => t >= c.start && t < c.end) ?? null;

/** Cover-crop a source region into a target box, centred on `anchorX` (0–1). */
function crop(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, sx0: number, sw0: number, anchorX: number, dx: number, dy: number, dw: number, dh: number) {
  const vh = v.videoHeight || 1;
  const target = dw / dh;
  let sw = sw0, sh = vh;
  if (sw / sh > target) sw = sh * target;
  else sh = sw / target;
  const cx = sx0 + anchorX * sw0;
  const sx = Math.min(Math.max(cx - sw / 2, sx0), sx0 + sw0 - sw);
  const sy = (vh - sh) / 2;
  ctx.drawImage(v, sx, sy, sw, sh, dx, dy, dw, dh);
}

function captionPage(cue: Cue, t: number, perPage = 6) {
  const words = cue.text.split(/\s+/).filter(Boolean);
  const said = spokenWords(cue, t);
  const page = Math.min(Math.floor(Math.max(0, said - 1) / perPage), Math.max(0, Math.ceil(words.length / perPage) - 1));
  const from = page * perPage;
  return { words: words.slice(from, from + perPage), lit: Math.max(0, said - from) };
}

/** Draws one output frame from the video's current picture at time `t`. */
export function drawCutFrame(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, fmt: CutFormat, cues: Cue[], t: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const vw = v.videoWidth, vh = v.videoHeight;
  ctx.fillStyle = '#0b1116';
  ctx.fillRect(0, 0, W, H);
  if (vw && vh && v.readyState >= 2) {
    const cue = cueAt(cues, t);
    if (fmt.framing === 'stacked') {
      crop(ctx, v, 0, vw / 2, 0.5, 0, 0, W, H / 2);
      crop(ctx, v, vw / 2, vw / 2, 0.5, 0, H / 2, W, H / 2);
      ctx.fillStyle = '#0b1116';
      ctx.fillRect(0, H / 2 - 2, W, 4);
    } else if (fmt.framing === 'speaker') {
      const anchor = cue?.speaker ? (fmt.positions[cue.speaker] ?? 0.5) : 0.5;
      crop(ctx, v, 0, vw, anchor, 0, 0, W, H);
    } else {
      ctx.save();
      ctx.filter = `blur(${Math.round(W / 24)}px) brightness(0.6)`;
      crop(ctx, v, 0, vw, 0.5, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1);
      ctx.restore();
      const k = Math.min(W / vw, H / vh);
      ctx.drawImage(v, (W - vw * k) / 2, (H - vh * k) / 2, vw * k, vh * k);
    }

    if (fmt.captions !== 'off' && cue) {
      const { words, lit } = captionPage(cue, t);
      const size = Math.round(W * (fmt.aspect === '16:9' ? 0.034 : 0.064));
      ctx.font = `800 ${size}px Geist, "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const maxW = W * 0.84, space = ctx.measureText(' ').width;
      const lines: { w: string; i: number }[][] = [[]];
      let lineW = 0;
      words.forEach((w, i) => {
        const ww = ctx.measureText(w).width;
        if (lineW && lineW + space + ww > maxW) {
          lines.push([]);
          lineW = 0;
        }
        lines[lines.length - 1].push({ w, i });
        lineW += (lineW ? space : 0) + ww;
      });
      const lh = size * 1.18;
      const baseY = (fmt.aspect === '9:16' ? H * 0.74 : H * 0.86) - ((lines.length - 1) * lh) / 2;
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.16;
      lines.forEach((line, li) => {
        const width = line.reduce((s, x, k) => s + ctx.measureText(x.w).width + (k ? space : 0), 0);
        let x = (W - width) / 2;
        const y = baseY + li * lh;
        for (const { w, i } of line) {
          const on = fmt.captions === 'karaoke' ? i < lit : true;
          ctx.strokeStyle = 'rgba(11,17,22,0.9)';
          ctx.strokeText(w, x, y);
          ctx.fillStyle = fmt.captions === 'karaoke' ? (on ? '#F5A524' : '#ffffff') : '#ffffff';
          ctx.fillText(w, x, y);
          x += ctx.measureText(w).width + space;
        }
      });
    }
  }

  if (fmt.logo) {
    if (!markPaths) markPaths = [new Path2D(MARK_A), new Path2D(MARK_B)];
    const s = Math.round(W * 0.06), x = Math.round(W * 0.05), y = Math.round(W * 0.05);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = s * 0.3;
    ctx.translate(x, y);
    ctx.scale(s / 22, s / 22);
    ctx.fillStyle = '#2FA9CC';
    markPaths.forEach((p) => ctx.fill(p));
    ctx.restore();
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = s * 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${s * 0.94}px Geist, "Helvetica Neue", Arial, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('chm', x + s * 1.3, y + s * 0.82);
    ctx.restore();
  }
}

function pickMime(): string {
  const options = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
}

/**
 * Renders a clip as a social cut by playing it through the frame drawer
 * and recording the canvas with the clip's sound. Runs in real time.
 * Only files from the computer can be recorded: a Zoom recording's frames
 * can be shown but not captured.
 */
export async function renderCut(
  url: string,
  clip: { start: number; end: number },
  fmt: CutFormat,
  cues: Cue[],
  onProgress: (p: number) => void,
): Promise<Blob> {
  const [W, H] = OUT_SIZE[fmt.aspect];
  const ranges = fmt.tighten && cues.length ? keepRanges(clip, cues) : [{ start: clip.start, end: clip.end }];
  const total = ranges.reduce((s, r) => s + (r.end - r.start), 0) || 1;

  const v = document.createElement('video');
  v.src = url;
  v.playsInline = true;
  v.preload = 'auto';
  await new Promise<void>((res, rej) => {
    v.addEventListener('loadeddata', () => res(), { once: true });
    v.addEventListener('error', () => rej(new Error('The video would not load.')), { once: true });
  });

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas.');

  const audio = new AudioContext();
  const src = audio.createMediaElementSource(v);
  const dest = audio.createMediaStreamDestination();
  src.connect(dest);
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mimeType = pickMime();
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()));

  const seek = (t: number) =>
    new Promise<void>((res) => {
      v.addEventListener('seeked', () => res(), { once: true });
      v.currentTime = t;
    });

  let done = 0;
  try {
    rec.start(250);
    rec.pause();
    for (const r of ranges) {
      await seek(r.start);
      drawCutFrame(ctx, v, fmt, cues, v.currentTime);
      rec.resume();
      await v.play();
      await new Promise<void>((res) => {
        const step = () => {
          drawCutFrame(ctx, v, fmt, cues, v.currentTime);
          onProgress(Math.min(1, (done + Math.max(0, v.currentTime - r.start)) / total));
          if (v.currentTime >= r.end || v.ended) {
            v.pause();
            rec.pause();
            res();
          } else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      done += r.end - r.start;
    }
    rec.stop();
    await stopped;
  } finally {
    v.pause();
    void audio.close();
    v.removeAttribute('src');
    v.load();
  }
  onProgress(1);
  return new Blob(chunks, { type: mimeType.split(';')[0] });
}
