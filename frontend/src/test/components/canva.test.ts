import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { canvaFace, layersToPptx, textRuns } from '../../components/admin/studio/canva';
import type { LayerText, StudioLayers } from '../../components/admin/studio/engine';

const run = (t: string, over: Partial<LayerText['lines'][number]['runs'][number]> = {}) => ({ t, family: 'Geist', weight: 400, size: 32, color: '22303C', alpha: 1, ls: 0, ...over });

describe('Send to Canva', () => {
  it('names weights the way Canva reads them', () => {
    expect(canvaFace('Geist', 400)).toEqual({ face: 'Geist', bold: false });
    expect(canvaFace('Geist', 500)).toEqual({ face: 'Geist Medium', bold: false });
    expect(canvaFace('Geist', 600)).toEqual({ face: 'Geist', bold: true });
    expect(canvaFace('Geist', 700)).toEqual({ face: 'Geist', bold: true });
    expect(canvaFace('Geist', 900)).toEqual({ face: 'Geist Heavy', bold: false });
    expect(canvaFace('Geist Mono', 700)).toEqual({ face: 'Geist Mono', bold: true });
  });

  it('rejoins soft-wrapped lines and keeps hard breaks, in points', () => {
    const t: LayerText = {
      x: 0, y: 0, w: 400, h: 120, rot: 0, align: 'left', lead: 40,
      lines: [
        { br: 'soft', runs: [run('The FDA just', { weight: 900, size: 72, ls: -2.4 })] },
        { br: 'hard', runs: [run('changed', { weight: 900, size: 72, ls: -2.4 }), run(' ', { weight: 900, size: 72, ls: 4 }), run('care', { weight: 900, size: 72, color: 'FF9EF9', ls: -2.4 })] },
        { br: null, runs: [run('Here is why.', { alpha: 0.5 })] },
      ],
    };
    const r = textRuns(t);
    expect(r.map((x) => x.text)).toEqual(['The FDA just ', 'changed', ' ', 'care', 'Here is why.']);
    expect(r[0].options).toMatchObject({ fontFace: 'Geist Heavy', fontSize: 54, charSpacing: -1.8 });
    expect(r[0].options.breakLine).toBeUndefined();
    expect(r[3].options).toMatchObject({ color: 'FF9EF9', breakLine: true });
    expect(r[4].options).toMatchObject({ fontFace: 'Geist', transparency: 50 });
  });

  it('writes a deck whose slides carry the artwork and live text', async () => {
    const art = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
    const slide: StudioLayers = {
      width: 1920, height: 1080, art,
      texts: [{ x: 96, y: 120, w: 900, h: 160, rot: 0, align: 'left', lead: 80, lines: [{ br: null, runs: [run('Where expertise meets impact', { weight: 600, size: 64, ls: -2 })] }] }],
    };
    const blob = await layersToPptx([slide, { ...slide, texts: [] }], '2026 Capabilities');
    const zip = await JSZip.loadAsync(blob);
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(xml).toContain('Where expertise meets impact');
    expect(xml).toContain('typeface="Geist"');
    expect(xml).toContain('b="1"');
    expect(xml).toContain('<a:spcPts val="6000"/>');
    expect(Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))).toHaveLength(2);
    expect(Object.keys(zip.files).some((f) => f.startsWith('ppt/media/'))).toBe(true);
    const pres = await zip.file('ppt/presentation.xml')!.async('string');
    expect(pres).toContain('<p:sldSz cx="18288000" cy="10287000"');
  });
});
