import apiClient from '../../../api/client';
import type { LayerText, StudioLayers } from './engine';

/**
 * Send to Canva. A studio hands over its slides as artwork plus live text
 * (`__engine.layers()`); this writes them into a PowerPoint file, which is the
 * one door Canva has for outside work, and the platform imports that into the
 * admin's Canva as an editable design. Nobody sees the file itself.
 */

const PX_PER_IN = 96;
const pt = (px: number) => Math.round(px * 0.75 * 100) / 100;

/**
 * Canva's PowerPoint import groups an uploaded family and reads a weight from
 * the font name, but only thin, light, normal, medium, bold and heavy. So 600
 * and 700 go as bold, and 800 and 900 as "Heavy", which lands on the heaviest
 * weight the account has uploaded (Black, or ExtraBold if that is the top).
 */
export function canvaFace(family: string, weight: number): { face: string; bold: boolean } {
  const fam = family.trim() || 'Geist';
  if (weight >= 800) return { face: `${fam} Heavy`, bold: false };
  if (weight >= 600) return { face: fam, bold: true };
  if (weight >= 500) return { face: `${fam} Medium`, bold: false };
  if (weight <= 300) return { face: `${fam} Light`, bold: false };
  return { face: fam, bold: false };
}

export type PptxRun = {
  text: string;
  options: { fontFace: string; bold: boolean; fontSize: number; color: string; transparency?: number; charSpacing?: number; breakLine?: boolean };
};

/** One text box's lines as PowerPoint runs: soft breaks rejoin with a space, hard ones start a new paragraph. */
export function textRuns(t: LayerText): PptxRun[] {
  const out: PptxRun[] = [];
  t.lines.forEach((line) => {
    line.runs.forEach((r, i) => {
      const last = i === line.runs.length - 1;
      const { face, bold } = canvaFace(r.family, r.weight);
      out.push({
        text: last && line.br === 'soft' && !/\s$/.test(r.t) ? `${r.t} ` : r.t,
        options: {
          fontFace: face,
          bold,
          fontSize: pt(r.size),
          color: r.color,
          transparency: r.alpha < 1 ? Math.round((1 - r.alpha) * 100) : undefined,
          charSpacing: r.ls ? pt(r.ls) : undefined,
          breakLine: last && line.br === 'hard' ? true : undefined,
        },
      });
    });
  });
  return out;
}

/** Slides to a .pptx: the artwork full-bleed, every text box on top of it where it was drawn. */
export async function layersToPptx(slides: StudioLayers[], title: string): Promise<Blob> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pres = new PptxGenJS();
  const W = slides[0].width / PX_PER_IN;
  const H = slides[0].height / PX_PER_IN;
  pres.defineLayout({ name: 'CHM', width: W, height: H });
  pres.layout = 'CHM';
  pres.title = title;
  pres.company = 'Community Health Media';
  for (const s of slides) {
    const slide = pres.addSlide();
    slide.addImage({ data: s.art.replace(/^data:/, ''), x: 0, y: 0, w: W, h: H, altText: 'Slide artwork' });
    for (const t of s.texts) {
      slide.addText(textRuns(t), {
        x: t.x / PX_PER_IN,
        y: t.y / PX_PER_IN,
        w: t.w / PX_PER_IN,
        h: t.h / PX_PER_IN,
        margin: 0,
        valign: 'top',
        align: t.align,
        lineSpacing: pt(t.lead),
        paraSpaceBefore: 0,
        paraSpaceAfter: 0,
        fit: 'none',
        wrap: true,
        rotate: t.rot || undefined,
      });
    }
  }
  return (await pres.write({ outputType: 'blob' })) as Blob;
}

/* ── platform API ────────────────────────────────────────────────── */
export type CanvaStatus = { configured: boolean; connected: boolean };
export type CanvaJob = { status: 'in_progress' | 'success' | 'failed'; editUrl?: string; viewUrl?: string; error?: string };

export const canvaApi = {
  status: () => apiClient.get<CanvaStatus>('/admin/canva/status').then((r) => r.data),
  connectUrl: () => apiClient.get<{ url: string }>('/admin/canva/connect').then((r) => r.data.url),
  startImport: (file: Blob, title: string) => {
    const form = new FormData();
    form.append('title', title);
    form.append('file', file, `${title.replace(/[^\w.-]+/g, '-').slice(0, 60) || 'chm'}.pptx`);
    return apiClient
      .post<{ jobId: string }>('/admin/canva/imports', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180_000 })
      .then((r) => r.data.jobId);
  },
  importJob: (jobId: string) => apiClient.get<CanvaJob>(`/admin/canva/imports/${encodeURIComponent(jobId)}`).then((r) => r.data),
};

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** The message an error carries from the platform, or a plain fallback. */
export function canvaError(e: unknown): string {
  const res = (e as { response?: { status?: number; data?: { message?: unknown } } })?.response;
  if (res?.status === 404) return "Send to Canva isn't on this server yet.";
  if (res?.status === 401) return 'Your session ended. Sign in again, then send.';
  const data = res?.data;
  const m = data?.message;
  if (typeof m === 'string' && m) return m;
  if (m && typeof m === 'object' && typeof (m as { message?: unknown }).message === 'string') return (m as { message: string }).message;
  return e instanceof Error && e.message ? e.message : 'Something went wrong sending to Canva.';
}

export type SendStep = 'connecting' | 'building' | 'sending' | 'importing';

/**
 * The whole send. `tab` is a window opened on the click (so the browser
 * allows it): it carries Canva's sign-in when the admin hasn't connected yet,
 * then lands on the new design.
 */
export async function sendToCanva(opts: {
  layers: () => StudioLayers[];
  title: string;
  tab: Window | null;
  onStep: (s: SendStep) => void;
}): Promise<{ editUrl: string }> {
  const { tab, onStep } = opts;
  const status = await canvaApi.status();
  if (!status.configured) throw new Error("Canva isn't set up on the platform yet.");
  /* build while the admin signs in */
  const file = (async () => layersToPptx(opts.layers(), opts.title))();
  file.catch(() => undefined);
  if (!status.connected) {
    onStep('connecting');
    if (!tab) throw new Error('Allow pop-ups for this site, then press Send to Canva again.');
    tab.location.href = await canvaApi.connectUrl();
    const until = Date.now() + 5 * 60_000;
    for (;;) {
      await wait(1500);
      if ((await canvaApi.status()).connected) break;
      if (tab.closed) throw new Error('Canva sign-in was closed before it finished.');
      if (Date.now() > until) throw new Error('Canva sign-in timed out. Press Send to Canva again.');
    }
  }
  onStep('building');
  const blob = await file;
  onStep('sending');
  const jobId = await canvaApi.startImport(blob, opts.title);
  onStep('importing');
  const until = Date.now() + 3 * 60_000;
  for (;;) {
    await wait(1500);
    const job = await canvaApi.importJob(jobId);
    if (job.status === 'success' && job.editUrl) return { editUrl: job.editUrl };
    if (job.status === 'failed') throw new Error(job.error || "Canva couldn't import the design.");
    if (Date.now() > until) throw new Error('Canva is still importing. Check your Canva projects in a minute.');
  }
}
