import { cutCues, focusAt, keepRanges, speakerSpots, spokenWords, type Clip, type ClipLook, type Cue, type Range } from './clipperCore';

/**
 * Social cuts: a clip reframed for the feed. One drawing function serves
 * the live preview and the render, so what you see is what you export.
 *
 * Framing follows the transcript: "speaker" crops to whoever is talking
 * (placed by clicking on the preview, or spread in the order people first
 * speak), holds through pauses and eases across when the talker changes;
 * "stacked" puts the left and right of a two-up recording one above the
 * other; "full" fits the whole frame over a blurred fill. Captions come
 * from the transcript, burned in or karaoke style, a few words at a time.
 *
 * A style sets the caption look and how the opening title moves; a
 * clip's accepted AI look adds stressed words, number callouts and
 * push-ins on top. Nothing drawn is text the speaker didn't say, apart
 * from the title the editor typed.
 */

export type Aspect = '9:16' | '1:1' | '16:9';
export type CutStyle = 'clean' | 'bold' | 'explainer';
export type CutFormat = {
  aspect: Aspect;
  captions: 'off' | 'burned' | 'karaoke';
  framing: 'full' | 'speaker' | 'stacked';
  logo: boolean;
  tighten: boolean;
  /** Where each speaker sits across the source frame, 0 (left) to 1 (right), placed by hand. */
  positions: Record<string, number>;
  /** The opening title, faded out after a couple of seconds. */
  title: boolean;
  style: CutStyle;
  /** Save an .srt caption file next to each render. */
  captionFile: boolean;
};

export const DEFAULT_FORMAT: CutFormat = {
  aspect: '9:16',
  captions: 'karaoke',
  framing: 'speaker',
  logo: true,
  tighten: true,
  positions: {},
  title: true,
  style: 'bold',
  captionFile: true,
};
export const OUT_SIZE: Record<Aspect, [number, number]> = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080] };

type StyleSpec = { label: string; hint: string; caption: number; upper: boolean; box: boolean; title: 'fade' | 'rise' | 'lower-third'; callouts: boolean; punch: boolean };
export const STYLES: Record<CutStyle, StyleSpec> = {
  clean: { label: 'Clean', hint: 'Plain captions, a title that fades. Stressed words only.', caption: 1, upper: false, box: false, title: 'fade', callouts: false, punch: false },
  bold: { label: 'Bold social', hint: 'Big uppercase captions, a title that rises in, number callouts and push-ins.', caption: 1.22, upper: true, box: false, title: 'rise', callouts: true, punch: true },
  explainer: { label: 'Explainer', hint: 'Captions on a band, a lower-third title, number callouts.', caption: 0.9, upper: false, box: true, title: 'lower-third', callouts: true, punch: false },
};

const INK = '#0b1116';
const AMBER = '#F5A524';
const TEAL = '#2FA9CC';
const FONT = 'Geist, "Helvetica Neue", Arial, sans-serif';
export const TITLE_HOLD = 2.2;
export const TITLE_FADE = 0.6;
const CALLOUT_LEN = 2.4;
const PUNCH_RAMP = 0.3;
const PUNCH_ZOOM = 0.14;

const MARK_A =
  'M8.93474 1.49742C9.07776 1.49184 9.17495 1.53253 9.28261 1.62631C9.4705 1.78998 11.2071 3.5232 11.2532 3.64134C11.2922 3.7413 11.2656 4.14647 11.2655 4.28049L11.2639 5.98453C11.2638 6.17469 11.2297 7.01038 11.3334 7.09768C11.4051 7.08948 12.123 6.34163 12.2254 6.23916L13.9444 4.51963C14.2049 4.25872 14.4608 3.99542 14.7304 3.7439C14.9418 3.54665 15.2731 3.60409 15.5503 3.60578L16.5052 3.60998C16.8076 3.61063 17.8283 3.52275 17.9928 3.75654C18.1225 3.94096 18.0805 4.69656 18.0752 4.96005C18.0631 5.55316 18.1082 6.18162 18.0535 6.77129C18.0421 6.88565 17.3737 7.52043 17.2485 7.64552L15.5103 9.38215C15.2283 9.66345 14.9362 9.94896 14.6581 10.235C14.6194 10.2748 14.6013 10.3033 14.5964 10.3552C14.667 10.4414 15.459 10.4114 15.6327 10.4113L17.1794 10.4117C17.4361 10.4103 17.7544 10.3905 18.0031 10.4279C18.0966 10.4448 18.1866 10.5223 18.2514 10.5878C18.8406 11.1837 19.4428 11.7681 20.0264 12.3691C20.0657 12.4096 20.1515 12.5279 20.1757 12.5785C20.211 12.6521 20.1569 12.8222 20.1071 12.8811C19.9375 13.082 19.7411 13.2671 19.5551 13.4532L18.4174 14.5907C18.3189 14.689 18.1783 14.8508 18.0468 14.8994C17.8348 14.9776 16.3802 14.9342 16.0363 14.9337C14.4561 14.9338 12.841 14.9141 11.2647 14.9391L11.264 17.7465C11.2639 18.2139 11.2735 18.6825 11.2615 19.1494C11.2557 19.3767 11.1102 19.4343 10.9102 19.44C10.666 19.4471 10.4207 19.4421 10.1763 19.4411L8.82518 19.4395L7.70603 19.4424C7.45606 19.4432 7.14202 19.4564 6.90106 19.4153C6.64894 19.1673 6.73108 18.8037 6.72099 18.4755C6.71566 18.0339 6.74337 17.4699 6.97302 17.0753C7.25999 16.5821 7.82356 16.087 8.22982 15.6827L9.99945 13.915C10.2107 13.7047 10.9989 12.9728 11.1394 12.6865C11.1922 12.579 10.7978 12.2098 10.6759 12.0883L10.0794 11.492L8.09812 9.51391C7.70754 9.12432 7.23679 8.73421 6.97279 8.24415C6.84932 8.01494 6.77834 7.74567 6.74778 7.48768C6.71248 7.18967 6.68563 3.86575 6.75819 3.65772C6.78771 3.57304 6.87677 3.47899 6.93649 3.41305C7.19342 3.1294 7.48666 2.86756 7.75685 2.59562C8.07341 2.27703 8.38342 1.9308 8.72068 1.63558C8.7893 1.57549 8.85099 1.53376 8.93474 1.49742Z';
const MARK_B =
  'M2.47293 10.4176C2.84684 10.3936 6.65609 10.3934 6.72007 10.427C6.77058 10.4536 6.81894 10.4861 6.86411 10.5209C6.98717 10.6156 7.09381 10.7363 7.20334 10.846L7.7586 11.4019C7.95918 11.6026 8.87788 12.4467 8.90605 12.6756C8.82771 12.9445 7.93759 13.761 7.69754 13.9996C7.45958 14.2398 7.22116 14.4813 6.98147 14.7196C6.78298 14.9169 6.68561 14.9337 6.41412 14.934C5.52449 14.9349 4.63533 14.9344 3.74592 14.9342L2.98341 14.9345C2.69673 14.9353 2.47551 14.9873 2.25879 14.7749C2.21733 14.5829 2.22752 14.2714 2.22735 14.0689L2.22701 13.1503L2.22737 11.5597C2.22747 11.301 2.20479 10.8417 2.25747 10.5797C2.27303 10.5023 2.39375 10.4443 2.47293 10.4176Z';
let markPaths: Path2D[] | null = null;

/** The clip the playhead is in, preferring the selected one. */
export function clipAt(clips: Clip[], selectedId: string | null, t: number): Clip | null {
  const sel = clips.find((c) => c.id === selectedId);
  if (sel && t >= sel.start && t <= sel.end) return sel;
  return clips.find((c) => t >= c.start && t <= c.end) ?? null;
}

export const cueAt = (cues: Cue[], t: number) => cues.find((c) => t >= c.start && t < c.end) ?? null;

const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

/** A picture to draw from: the live video, or a frame grabbed from it. */
export type Picture = { img: CanvasImageSource; w: number; h: number };
const pictureOf = (v: HTMLVideoElement): Picture => ({ img: v, w: v.videoWidth, h: v.videoHeight });

/** Cover-crop a source region into a target box, centred on `anchorX` (0–1), pushed in by `zoom`. */
function crop(ctx: CanvasRenderingContext2D, pic: Picture, sx0: number, sw0: number, anchorX: number, dx: number, dy: number, dw: number, dh: number, zoom = 1) {
  const vh = pic.h || 1;
  const target = dw / dh;
  let sw = sw0, sh = vh;
  if (sw / sh > target) sw = sh * target;
  else sh = sw / target;
  sw /= zoom;
  sh /= zoom;
  const cx = sx0 + anchorX * sw0;
  const sx = Math.min(Math.max(cx - sw / 2, sx0), sx0 + sw0 - sw);
  const sy = (vh - sh) / 2;
  ctx.drawImage(pic.img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function captionPage(cue: Cue, t: number, perPage = 6) {
  const words = cue.text.split(/\s+/).filter(Boolean);
  const said = spokenWords(cue, t);
  const page = Math.min(Math.floor(Math.max(0, said - 1) / perPage), Math.max(0, Math.ceil(words.length / perPage) - 1));
  const from = page * perPage;
  return { words: words.slice(from, from + perPage), lit: Math.max(0, said - from) };
}

const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}%]/gu, '');

/** How far into a push-in `t` is, 0 to 1, ramped at both ends. */
export function punchAt(look: ClipLook | undefined, t: number): number {
  let best = 0;
  for (const p of look?.punchIns ?? []) {
    if (t < p.start || t > p.end) continue;
    best = Math.max(best, ease(Math.min((t - p.start) / PUNCH_RAMP, (p.end - t) / PUNCH_RAMP)));
  }
  return best;
}

/** Splits `[highlight]` phrases out of a line, for titles and thumbnails. */
export function marked(text: string): { text: string; hi: boolean }[] {
  const out: { text: string; hi: boolean }[] = [];
  text.split(/(\[[^\]]+\])/).forEach((part) => {
    if (!part) return;
    const hi = part.startsWith('[') && part.endsWith(']');
    out.push({ text: hi ? part.slice(1, -1) : part, hi });
  });
  return out;
}

/** Word-wraps marked text to `maxW`, shrinking the type until it fits `maxLines`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, size: number, minSize: number, weight = 900) {
  const words = marked(text).flatMap((seg) => seg.text.split(/\s+/).filter(Boolean).map((w) => ({ w, hi: seg.hi })));
  let s = size;
  for (;;) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    const space = ctx.measureText(' ').width;
    const lines: { w: string; hi: boolean }[][] = [[]];
    let lineW = 0;
    for (const word of words) {
      const ww = ctx.measureText(word.w).width;
      if (lineW && lineW + space + ww > maxW) {
        lines.push([]);
        lineW = 0;
      }
      lines[lines.length - 1].push(word);
      lineW += (lineW ? space : 0) + ww;
    }
    const widest = Math.max(...lines.map((l) => l.reduce((n, x, k) => n + ctx.measureText(x.w).width + (k ? space : 0), 0)));
    if ((lines.length <= maxLines && widest <= maxW) || s <= minSize) return { lines, size: s, space };
    s = Math.max(minSize, Math.round(s * 0.92));
  }
}

function drawLines(ctx: CanvasRenderingContext2D, fit: ReturnType<typeof fitText>, x: number, y: number, lh: number, align: 'left' | 'center', W: number, color = '#ffffff', hiColor = AMBER) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  fit.lines.forEach((line, li) => {
    const width = line.reduce((n, w, k) => n + ctx.measureText(w.w).width + (k ? fit.space : 0), 0);
    let cx = align === 'center' ? (W - width) / 2 : x;
    for (const w of line) {
      ctx.fillStyle = w.hi ? hiColor : color;
      ctx.fillText(w.w, cx, y + li * lh);
      cx += ctx.measureText(w.w).width + fit.space;
    }
  });
}

function drawLogo(ctx: CanvasRenderingContext2D, W: number, scale = 0.06) {
  if (!markPaths) markPaths = [new Path2D(MARK_A), new Path2D(MARK_B)];
  const s = Math.round(W * scale), x = Math.round(W * 0.05), y = Math.round(W * 0.05);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = s * 0.3;
  ctx.translate(x, y);
  ctx.scale(s / 22, s / 22);
  ctx.fillStyle = TEAL;
  markPaths.forEach((p) => ctx.fill(p));
  ctx.restore();
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = s * 0.3;
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${s * 0.94}px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('chm', x + s * 1.3, y + s * 0.82);
  ctx.restore();
}

/** What a frame needs beyond the picture: the clip's look, its title and where the title clock stands. */
export type FrameExtras = {
  look?: ClipLook;
  title?: string;
  /** Seconds since this clip's cut began, for the opening title. */
  elapsed?: number;
  /** 0 to 1 dip to black, for joins in a sizzle reel. */
  fade?: number;
  /** Where the current cut starts in the source, so speaker focus opens on whoever speaks first. */
  cutStart?: number;
};

/** Draws one output frame from the video's current picture at time `t`. */
export function drawCutFrame(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, fmt: CutFormat, cues: Cue[], t: number, extras: FrameExtras = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const vw = v.videoWidth, vh = v.videoHeight;
  const style = STYLES[fmt.style] ?? STYLES.bold;
  const look = extras.look;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  if (vw && vh && v.readyState >= 2) {
    const cue = cueAt(cues, t);
    const zoom = style.punch ? 1 + PUNCH_ZOOM * punchAt(look, t) : 1;
    const pic = pictureOf(v);
    if (fmt.framing === 'stacked') {
      crop(ctx, pic, 0, vw / 2, 0.5, 0, 0, W, H / 2, zoom);
      crop(ctx, pic, vw / 2, vw / 2, 0.5, 0, H / 2, W, H / 2, zoom);
      ctx.fillStyle = INK;
      ctx.fillRect(0, H / 2 - 2, W, 4);
    } else if (fmt.framing === 'speaker') {
      crop(ctx, pic, 0, vw, focusAt(cues, speakerSpots(cues, fmt.positions), t, extras.cutStart), 0, 0, W, H, zoom);
    } else {
      ctx.save();
      ctx.filter = `blur(${Math.round(W / 24)}px) brightness(0.6)`;
      crop(ctx, pic, 0, vw, 0.5, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1);
      ctx.restore();
      const k = Math.min(W / vw, H / vh) * zoom;
      ctx.drawImage(v, (W - vw * k) / 2, (H - vh * k) / 2, vw * k, vh * k);
    }

    if (fmt.captions !== 'off' && cue) drawCaptions(ctx, fmt, style, cue, t, look);
    if (style.callouts && look?.callouts.length) drawCallout(ctx, fmt, look, t);
  }

  if (fmt.logo) drawLogo(ctx, W);
  if (fmt.title && extras.title?.trim() && extras.elapsed != null) drawTitle(ctx, fmt, style, extras.title.trim(), extras.elapsed);
  if (extras.fade) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, extras.fade)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawCaptions(ctx: CanvasRenderingContext2D, fmt: CutFormat, style: StyleSpec, cue: Cue, t: number, look?: ClipLook) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const { words, lit } = captionPage(cue, t);
  const stress = new Set(look?.emphasis.map(bare) ?? []);
  const size = Math.round(W * (fmt.aspect === '16:9' ? 0.034 : 0.064) * style.caption);
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const shown = words.map((w) => (style.upper ? w.toUpperCase() : w));
  const maxW = W * 0.84, space = ctx.measureText(' ').width;
  const lines: { w: string; i: number }[][] = [[]];
  let lineW = 0;
  shown.forEach((w, i) => {
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
  const widths = lines.map((line) => line.reduce((s, x, k) => s + ctx.measureText(x.w).width + (k ? space : 0), 0));
  if (style.box) {
    const bw = Math.max(...widths) + size * 1.1, bh = lines.length * lh + size * 0.55;
    ctx.fillStyle = 'rgba(11,17,22,0.78)';
    ctx.beginPath();
    ctx.roundRect((W - bw) / 2, baseY - size * 1.02, bw, bh, size * 0.3);
    ctx.fill();
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  lines.forEach((line, li) => {
    let x = (W - widths[li]) / 2;
    const y = baseY + li * lh;
    for (const { w, i } of line) {
      const hot = stress.has(bare(words[i]));
      const on = fmt.captions === 'karaoke' ? i < lit : true;
      if (!style.box) {
        ctx.strokeStyle = 'rgba(11,17,22,0.9)';
        ctx.strokeText(w, x, y);
      }
      ctx.fillStyle = hot && on ? TEAL : fmt.captions === 'karaoke' ? (on ? AMBER : '#ffffff') : '#ffffff';
      ctx.fillText(w, x, y);
      x += ctx.measureText(w).width + space;
    }
  });
}

function drawCallout(ctx: CanvasRenderingContext2D, fmt: CutFormat, look: ClipLook, t: number) {
  const c = look.callouts.find((x) => t >= x.at && t < x.at + CALLOUT_LEN);
  if (!c) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const p = t - c.at;
  const pop = 0.7 + 0.3 * ease(p / 0.25);
  const alpha = Math.min(1, p / 0.12, (CALLOUT_LEN - p) / 0.3);
  const size = Math.round(W * (fmt.aspect === '16:9' ? 0.11 : 0.2));
  const cx = fmt.aspect === '16:9' ? W * 0.78 : W / 2;
  const cy = fmt.aspect === '9:16' ? H * 0.2 : fmt.aspect === '1:1' ? H * 0.24 : H * 0.36;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.1;
  ctx.strokeStyle = 'rgba(11,17,22,0.85)';
  ctx.strokeText(c.text, 0, 0);
  ctx.fillStyle = AMBER;
  ctx.fillText(c.text, 0, 0);
  if (c.label) {
    const ls = Math.round(size * 0.24);
    ctx.font = `800 ${ls}px ${FONT}`;
    ctx.lineWidth = ls * 0.18;
    ctx.strokeText(c.label.toUpperCase(), 0, ls * 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(c.label.toUpperCase(), 0, ls * 1.5);
  }
  ctx.restore();
}

function drawTitle(ctx: CanvasRenderingContext2D, fmt: CutFormat, style: StyleSpec, title: string, elapsed: number) {
  if (elapsed < 0 || elapsed > TITLE_HOLD + TITLE_FADE) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const alpha = Math.min(1, elapsed / 0.2, elapsed < TITLE_HOLD ? 1 : 1 - (elapsed - TITLE_HOLD) / TITLE_FADE);
  const tall = fmt.aspect === '9:16';
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  if (style.title === 'lower-third') {
    const size = Math.round(W * (tall ? 0.052 : 0.032));
    const fit = fitText(ctx, title, W * 0.78, 2, size, Math.round(size * 0.7), 800);
    const lh = fit.size * 1.15;
    const slide = (1 - ease(elapsed / 0.35)) * W * 0.06;
    const bw = Math.max(...fit.lines.map((l) => l.reduce((n, w, k) => n + ctx.measureText(w.w).width + (k ? fit.space : 0), 0))) + fit.size * 1.2;
    const bh = fit.lines.length * lh + fit.size * 0.7;
    const x = W * 0.06 - slide, y = (tall ? H * 0.6 : H * 0.62) - bh;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = AMBER;
    ctx.fillRect(x, y, fit.size * 0.22, bh);
    drawLines(ctx, fit, x + fit.size * 0.6, y + fit.size * 1.05, lh, 'left', W, INK, '#B7791F');
  } else {
    const size = Math.round(W * (tall ? 0.078 : fmt.aspect === '1:1' ? 0.07 : 0.05));
    const shown = style.upper ? title.toUpperCase() : title;
    const fit = fitText(ctx, shown, W * 0.84, 3, size, Math.round(size * 0.6));
    const lh = fit.size * 1.12;
    const rise = style.title === 'rise' ? (1 - ease(elapsed / 0.4)) * fit.size * 0.8 : 0;
    const top = (tall ? H * 0.17 : H * 0.2) + rise;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = fit.size * 0.35;
    drawLines(ctx, fit, 0, top + fit.size, lh, 'center', W);
    ctx.shadowBlur = 0;
    const barW = W * 0.16 * (style.title === 'rise' ? ease(elapsed / 0.5) : 1);
    ctx.fillStyle = AMBER;
    ctx.fillRect((W - barW) / 2, top + fit.size + (fit.lines.length - 1) * lh + fit.size * 0.45, barW, Math.max(4, fit.size * 0.09));
  }
  ctx.restore();
}

/* ── thumbnails ────────────────────────────────────────────────── */

/** Copies the video's current frame, so a thumbnail can be restyled without holding the playhead. */
export function grabFrame(v: HTMLVideoElement): Picture | null {
  if (!v.videoWidth || v.readyState < 2) return null;
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d')?.drawImage(v, 0, 0);
  return { img: c, w: c.width, h: c.height };
}

export type ThumbLayout = 'bold' | 'cinema';
export const THUMB_SIZE: [number, number] = [1280, 720];

/**
 * A YouTube-style thumbnail from the frame the video is showing: a big
 * face and big type. `[brackets]` in the headline take the amber.
 */
export function drawThumbnail(ctx: CanvasRenderingContext2D, pic: Picture | null, opts: { layout: ThumbLayout; headline: string; anchor: number; logo: boolean }) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const vw = pic?.w ?? 0;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  if (pic && vw) {
    if (opts.layout === 'bold') {
      const fw = W * 0.56;
      crop(ctx, pic, 0, vw, opts.anchor, W - fw, 0, fw, H, 1.3);
      const g = ctx.createLinearGradient(W - fw, 0, W - fw + W * 0.16, 0);
      g.addColorStop(0, INK);
      g.addColorStop(1, 'rgba(11,17,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(W - fw, 0, W * 0.16, H);
    } else {
      crop(ctx, pic, 0, vw, opts.anchor, 0, 0, W, H, 1.2);
      const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
      g.addColorStop(0, 'rgba(11,17,22,0)');
      g.addColorStop(1, 'rgba(11,17,22,0.92)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
  const text = opts.headline.trim().toUpperCase() || 'ADD A HEADLINE';
  if (opts.layout === 'bold') {
    const fit = fitText(ctx, text, W * 0.46, 4, 104, 52);
    const lh = fit.size * 1.02;
    const block = fit.lines.length * lh;
    const top = (H - block) / 2 + fit.size * 0.82;
    ctx.fillStyle = AMBER;
    ctx.fillRect(W * 0.05, top - fit.size * 1.25, 84, 10);
    drawLines(ctx, fit, W * 0.05, top, lh, 'left', W);
  } else {
    const fit = fitText(ctx, text, W * 0.9, 2, 120, 60);
    const lh = fit.size * 1.02;
    const top = H - H * 0.08 - (fit.lines.length - 1) * lh;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 24;
    drawLines(ctx, fit, W * 0.05, top, lh, 'left', W);
    ctx.shadowBlur = 0;
  }
  if (opts.logo) drawLogo(ctx, W, 0.04);
}

/* ── rendering ─────────────────────────────────────────────────── */

function pickMime(): string {
  const options = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
}

/** The source ranges a clip plays in the cut: the whole clip, or the parts kept when pauses are cut. */
export function clipRanges(clip: Range, fmt: CutFormat, cues: Cue[]): Range[] {
  return fmt.tighten && cues.length ? keepRanges(clip, cues) : [{ start: clip.start, end: clip.end }];
}

const lengthOf = (rs: Range[]) => rs.reduce((s, r) => s + (r.end - r.start), 0);

/** The caption lines of a rendered cut or reel, retimed to the output file. */
export function outputCues(clips: Clip[], fmt: CutFormat, cues: Cue[]): Cue[] {
  const out: Cue[] = [];
  let offset = 0;
  for (const c of clips) {
    const rs = clipRanges(c, fmt, cues);
    out.push(...cutCues(rs, cues, offset));
    offset += lengthOf(rs);
  }
  return out;
}

const JOIN = 0.3;

/**
 * Renders clips as one social cut by playing them through the frame
 * drawer and recording the canvas with the clips' sound. One clip is a
 * cut; several are a sizzle reel, each with its own opening title and a
 * quick dip to black at the joins. Runs in real time. Only files the
 * browser can read (from the computer or Dropbox) can be recorded: a
 * Zoom recording's frames can be shown but not captured.
 */
export async function renderSequence(url: string, clips: Clip[], fmt: CutFormat, cues: Cue[], onProgress: (p: number) => void): Promise<Blob> {
  const [W, H] = OUT_SIZE[fmt.aspect];
  const plan = clips.map((clip) => ({ clip, ranges: clipRanges(clip, fmt, cues) }));
  const total = plan.reduce((s, p) => s + lengthOf(p.ranges), 0) || 1;
  const reel = clips.length > 1;

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
    for (const { clip, ranges } of plan) {
      const clipLen = lengthOf(ranges);
      const extras = (inClip: number): FrameExtras => ({
        cutStart: ranges[0]?.start,
        look: clip.look,
        title: clip.openingTitle ?? clip.title,
        elapsed: inClip,
        fade: reel ? Math.max(0, 1 - inClip / JOIN, 1 - (clipLen - inClip) / JOIN) : 0,
      });
      let inClipDone = 0;
      for (const r of ranges) {
        await seek(r.start);
        drawCutFrame(ctx, v, fmt, cues, v.currentTime, extras(inClipDone));
        rec.resume();
        await v.play();
        await new Promise<void>((res) => {
          const step = () => {
            const inClip = inClipDone + Math.max(0, v.currentTime - r.start);
            drawCutFrame(ctx, v, fmt, cues, v.currentTime, extras(inClip));
            onProgress(Math.min(1, (done + inClip) / total));
            if (v.currentTime >= r.end || v.ended) {
              v.pause();
              rec.pause();
              res();
            } else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
        inClipDone += r.end - r.start;
      }
      done += clipLen;
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

/** A single clip as a social cut. */
export const renderCut = (url: string, clip: Clip, fmt: CutFormat, cues: Cue[], onProgress: (p: number) => void) => renderSequence(url, [clip], fmt, cues, onProgress);
