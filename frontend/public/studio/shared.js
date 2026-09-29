/* CHM Studio · shared.js
   Brand tokens and canvas primitives used by the Social and Deck studios.
   Plain script, no build step: everything hangs off window.CHM. */
window.CHM = (() => {
  /* ── tokens ─────────────────────────────────────────────────────── */
  const PAL = { ground: '#ffffff', surface: '#f8f7f4', surface2: '#efede8', ink: '#0f0e0d', dim: '#3a3734', muted: '#615d58', faint: '#6c6762', cta: '#1b54f0' };
  /* disease-state brights (dark grounds) and their deep inks (light grounds) */
  const AREAS = [
    { name: 'Breast Cancer', bright: '#ff9ef9', ink: '#a71b86' },
    { name: 'Lung Cancer',   bright: '#ad94ff', ink: '#6438c2' },
    { name: 'GI',            bright: '#007bff', ink: '#0b4fb3' },
    { name: 'GU',            bright: '#00ddff', ink: '#00708a' },
    { name: 'Hematology',    bright: '#70ffac', ink: '#006b32' },
    { name: 'Weight Loss',   bright: '#f99f9f', ink: '#b12b2d' },
  ];
  /* brand guide v2, the palette the Canva decks and carousel are built on */
  const V2 = { base: '#F2F4F8', ink: '#22303C', blue: '#2FA9CC', deep: '#144C60', amber: '#F5A524', paper: '#FFFFFF', line: 'rgba(34,48,60,.14)' };

  /* A colourway is an accent pair plus the two grounds it sits on. "disease"
     takes the shipped disease-state hues, "v2" the brand guide v2 set, so a
     template can be restyled without touching a single layout value. */
  function palette(id, areaIndex) {
    if (id === 'v2') return {
      id: 'v2', name: 'Brand v2', bright: V2.blue, ink: V2.deep, second: V2.amber,
      dark: V2.ink, light: V2.base, onBright: V2.ink, isV2: true,
    };
    const A = AREAS[areaIndex] ?? AREAS[0];
    return {
      id: 'disease', name: A.name, bright: A.bright, ink: A.ink, second: A.bright,
      dark: '#0f0e0d', light: PAL.surface, onBright: '#0f0e0d', isV2: false,
    };
  }

  /* ── the CHM mark, as drawn on the site (22 × 21.8 box) ─────────── */
  const MARK_A = "M8.93474 1.49742C9.07776 1.49184 9.17495 1.53253 9.28261 1.62631C9.4705 1.78998 11.2071 3.5232 11.2532 3.64134C11.2922 3.7413 11.2656 4.14647 11.2655 4.28049L11.2639 5.98453C11.2638 6.17469 11.2297 7.01038 11.3334 7.09768C11.4051 7.08948 12.123 6.34163 12.2254 6.23916L13.9444 4.51963C14.2049 4.25872 14.4608 3.99542 14.7304 3.7439C14.9418 3.54665 15.2731 3.60409 15.5503 3.60578L16.5052 3.60998C16.8076 3.61063 17.8283 3.52275 17.9928 3.75654C18.1225 3.94096 18.0805 4.69656 18.0752 4.96005C18.0631 5.55316 18.1082 6.18162 18.0535 6.77129C18.0421 6.88565 17.3737 7.52043 17.2485 7.64552L15.5103 9.38215C15.2283 9.66345 14.9362 9.94896 14.6581 10.235C14.6194 10.2748 14.6013 10.3033 14.5964 10.3552C14.667 10.4414 15.459 10.4114 15.6327 10.4113L17.1794 10.4117C17.4361 10.4103 17.7544 10.3905 18.0031 10.4279C18.0966 10.4448 18.1866 10.5223 18.2514 10.5878C18.8406 11.1837 19.4428 11.7681 20.0264 12.3691C20.0657 12.4096 20.1515 12.5279 20.1757 12.5785C20.211 12.6521 20.1569 12.8222 20.1071 12.8811C19.9375 13.082 19.7411 13.2671 19.5551 13.4532L18.4174 14.5907C18.3189 14.689 18.1783 14.8508 18.0468 14.8994C17.8348 14.9776 16.3802 14.9342 16.0363 14.9337C14.4561 14.9338 12.841 14.9141 11.2647 14.9391L11.264 17.7465C11.2639 18.2139 11.2735 18.6825 11.2615 19.1494C11.2557 19.3767 11.1102 19.4343 10.9102 19.44C10.666 19.4471 10.4207 19.4421 10.1763 19.4411L8.82518 19.4395L7.70603 19.4424C7.45606 19.4432 7.14202 19.4564 6.90106 19.4153C6.64894 19.1673 6.73108 18.8037 6.72099 18.4755C6.71566 18.0339 6.74337 17.4699 6.97302 17.0753C7.25999 16.5821 7.82356 16.087 8.22982 15.6827L9.99945 13.915C10.2107 13.7047 10.9989 12.9728 11.1394 12.6865C11.1922 12.579 10.7978 12.2098 10.6759 12.0883L10.0794 11.492L8.09812 9.51391C7.70754 9.12432 7.23679 8.73421 6.97279 8.24415C6.84932 8.01494 6.77834 7.74567 6.74778 7.48768C6.71248 7.18967 6.68563 3.86575 6.75819 3.65772C6.78771 3.57304 6.87677 3.47899 6.93649 3.41305C7.19342 3.1294 7.48666 2.86756 7.75685 2.59562C8.07341 2.27703 8.38342 1.9308 8.72068 1.63558C8.7893 1.57549 8.85099 1.53376 8.93474 1.49742Z";
  const MARK_B = "M2.47293 10.4176C2.84684 10.3936 6.65609 10.3934 6.72007 10.427C6.77058 10.4536 6.81894 10.4861 6.86411 10.5209C6.98717 10.6156 7.09381 10.7363 7.20334 10.846L7.7586 11.4019C7.95918 11.6026 8.87788 12.4467 8.90605 12.6756C8.82771 12.9445 7.93759 13.761 7.69754 13.9996C7.45958 14.2398 7.22116 14.4813 6.98147 14.7196C6.78298 14.9169 6.68561 14.9337 6.41412 14.934C5.52449 14.9349 4.63533 14.9344 3.74592 14.9342L2.98341 14.9345C2.69673 14.9353 2.47551 14.9873 2.25879 14.7749C2.21733 14.5829 2.22752 14.2714 2.22735 14.0689L2.22701 13.1503L2.22737 11.5597C2.22747 11.301 2.20479 10.8417 2.25747 10.5797C2.27303 10.5023 2.39375 10.4443 2.47293 10.4176Z";
  const markPath = [new Path2D(MARK_A), new Path2D(MARK_B)];
  function mark(ctx, x, y, size, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 22, size / 22); ctx.fillStyle = color;
    markPath.forEach(p => ctx.fill(p)); ctx.restore();
  }
  /* mark + wordmark, left-anchored at (x, y) with the given mark size */
  function lockup(ctx, x, y, size, markColor, textColor) {
    mark(ctx, x, y, size, markColor);
    ctx.fillStyle = textColor; ctx.font = `900 ${size * 0.94}px Geist`; ctx.letterSpacing = `${-size * 0.03}px`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('chm', x + size * 1.3, y + size * 0.82); ctx.letterSpacing = '0px';
  }
  /* the wordmark on its own in the mark's size language */
  function wordmark(ctx, x, y, size, color) {
    ctx.fillStyle = color; ctx.font = `900 ${size}px Geist`; ctx.letterSpacing = `${-size * 0.03}px`; ctx.textBaseline = 'alphabetic';
    ctx.fillText('chm', x, y); ctx.letterSpacing = '0px';
  }
  function svgMark(el, color) {
    el.innerHTML = `<svg viewBox="0 0 22 21.8047" aria-hidden="true"><path d="${MARK_A}" fill="${color}"/><path d="${MARK_B}" fill="${color}"/></svg>`;
  }

  /* ── the particle burst ─────────────────────────────────────────── */
  function rnd(r) { r.s = (r.s * 1664525 + 1013904223) % 4294967296; return r.s / 4294967296; }
  function gauss(r) { return (rnd(r) + rnd(r) + rnd(r) + rnd(r) - 2) / 2; }
  function burst(ctx, cx, cy, radius, hex, seed, count = 1500, cell = 1) {
    const r = { s: seed };
    const [R, G, B] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    for (let i = 0; i < count; i++) {
      const spread = Math.pow(rnd(r), 0.42);
      const x = cx + gauss(r) * radius * 0.28 * (1 + spread * 4.0);
      const y = cy + gauss(r) * radius * 0.28 * (1 + spread * 4.0);
      const s = (rnd(r) < 0.12 ? 9 : rnd(r) < 0.45 ? 6.5 : 4.5) * cell;
      const a = Math.max(0.08, Math.min(1, 1.10 - spread * 1.18));
      ctx.fillStyle = `rgba(${R},${G},${B},${a})`;
      ctx.fillRect(x, y, s, s);
    }
  }

  /* ── type ───────────────────────────────────────────────────────── */
  function wrap(ctx, text, maxW) {
    const out = [];
    String(text ?? '').split('\n').forEach(par => {
      const words = par.split(/\s+/).filter(Boolean); let line = '';
      if (!words.length) { out.push(''); return; }
      words.forEach(w => {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width <= maxW || !line) line = t; else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  }
  /* shrink from o.max until the copy fits o.lines lines at o.w wide */
  function fit(ctx, text, o) {
    const weight = o.weight ?? 900, family = o.family ?? 'Geist', track = o.track ?? -0.034, min = o.min ?? 22;
    let size = o.max, lines;
    for (;;) {
      ctx.font = `${weight} ${size}px ${family}`; ctx.letterSpacing = `${size * track}px`;
      lines = wrap(ctx, text, o.w);
      if (lines.length <= o.lines || size <= min) break; size -= 2;
    }
    return { size, lines, lead: size * (o.leading ?? 0.96) };
  }
  /* draw wrapped lines top-anchored at y; returns the y below the block */
  function block(ctx, text, x, y, o) {
    const f = fit(ctx, text, o);
    ctx.fillStyle = o.color; ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = 'alphabetic';
    f.lines.forEach((l, i) => ctx.fillText(l, x, y + (i + 1) * f.lead - f.size * 0.16));
    ctx.letterSpacing = '0px';
    return y + f.lines.length * f.lead;
  }
  /* measure without drawing */
  function measure(ctx, text, o) { const f = fit(ctx, text, o); ctx.letterSpacing = '0px'; return { ...f, height: f.lines.length * f.lead }; }
  function mono(ctx, text, x, y, size, color, o = {}) {
    ctx.fillStyle = color; ctx.font = `${o.weight ?? 700} ${size}px "Geist Mono"`; ctx.letterSpacing = `${o.track ?? size * 0.08}px`;
    ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(o.upper === false ? text : String(text).toUpperCase(), x, y); ctx.letterSpacing = '0px';
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ── images ─────────────────────────────────────────────────────── */
  /* cover a cell, anchored so the likely face point (fx, fy of the image)
     lands on (ax, ay); scale grows only as far as coverage needs */
  function cover(ctx, f, c, o = {}) {
    if (!f || !f.img) return;
    const fx = o.fx ?? 0.5, fy = o.fy ?? 0.42, ax = o.ax ?? c.x + c.w / 2, ay = o.ay ?? c.y + c.h * 0.46;
    const iw = f.img.width, ih = f.img.height;
    const s = Math.max((ax - c.x) / (fx * iw), (c.x + c.w - ax) / ((1 - fx) * iw), (ay - c.y) / (fy * ih), (c.y + c.h - ay) / ((1 - fy) * ih)) * (f.zoom ?? 1);
    ctx.save(); ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
    if (o.filter) ctx.filter = o.filter;
    ctx.drawImage(f.img, ax - fx * iw * s + (f.dx ?? 0), ay - fy * ih * s + (f.dy ?? 0), iw * s, ih * s);
    ctx.filter = 'none'; ctx.restore();
  }
  function circle(ctx, f, cx, cy, d, o = {}) {
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.clip();
    if (f && f.img) cover(ctx, f, { x: cx - d / 2, y: cy - d / 2, w: d, h: d }, { ...o, ay: cy - d * 0.04 });
    else { ctx.fillStyle = o.empty ?? '#1a1917'; ctx.fillRect(cx - d / 2, cy - d / 2, d, d); }
    ctx.restore();
    if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = o.ringW ?? 8; ctx.beginPath(); ctx.arc(cx, cy, d / 2 + (o.ringW ?? 8) / 2, 0, Math.PI * 2); ctx.stroke(); }
  }
  function placeholder(ctx, x, y, w, h, label = 'ADD IMAGE', bg = '#1a1917', fg = 'rgba(255,255,255,.35)') {
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    mono(ctx, label, x + w / 2, y + h / 2 + 5, Math.max(12, Math.min(w, h) * 0.06), fg, { align: 'center', weight: 500 });
  }
  function loadFiles(list, max = 8) {
    return Promise.all([...list].slice(0, max).map(file => new Promise(res => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => res({ img, url, name: file.name.replace(/\.[^.]+$/, ''), zoom: 1, dx: 0, dy: 0 });
      img.onerror = () => res(null); img.src = url;
    }))).then(a => a.filter(Boolean));
  }
  function loadUrl(url, name) {
    return new Promise(res => { const img = new Image(); img.onload = () => res({ img, url, name: name ?? url.split('/').pop().replace(/\.[^.]+$/, ''), zoom: 1, dx: 0, dy: 0 }); img.onerror = () => res(null); img.src = url; });
  }
  function fontsReady() {
    return Promise.all(['900 64px Geist', '600 32px Geist', '500 32px Geist', '400 32px Geist', '700 18px "Geist Mono"', '500 18px "Geist Mono"'].map(f => document.fonts.load(f)));
  }

  /* ── export ─────────────────────────────────────────────────────── */
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  function bytes(canvas, type = 'image/png', q = 0.92) { return new Promise(res => canvas.toBlob(b => b.arrayBuffer().then(ab => res(new Uint8Array(ab))), type, q)); }
  const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'chm';

  /* zip (store only): enough for a folder of PNGs, no dependency */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(entries) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    entries.forEach(e => {
      const name = enc.encode(e.name), data = e.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
      cd.setUint16(12, time, true); cd.setUint16(14, date, true); cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true); cd.setUint16(34, 0, true); cd.setUint16(36, 0, true); cd.setUint32(38, 0, true); cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true); eo.setUint16(4, 0, true); eo.setUint16(6, 0, true); eo.setUint16(8, entries.length, true); eo.setUint16(10, entries.length, true); eo.setUint32(12, cdSize, true); eo.setUint32(16, offset, true); eo.setUint16(20, 0, true);
    return new Blob([...parts, ...central, new Uint8Array(eo.buffer)], { type: 'application/zip' });
  }
  /* pdf: one full-bleed JPEG per page, no dependency */
  function pdf(pages) {
    const enc = new TextEncoder(), chunks = [], offsets = []; let pos = 0;
    const push = (s) => { const b = typeof s === 'string' ? enc.encode(s) : s; chunks.push(b); pos += b.length; };
    const obj = (id, head, data) => { offsets[id] = pos; push(`${id} 0 obj\n${head}`); if (data) { push('\nstream\n'); push(data); push('\nendstream'); } push('\nendobj\n'); };
    push('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${pages.length} >>`);
    pages.forEach((p, i) => {
      const pid = 3 + i * 3, content = enc.encode(`q ${p.w} 0 0 ${p.h} 0 0 cm /Im1 Do Q`);
      obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.w} ${p.h}] /Resources << /XObject << /Im1 ${pid + 2} 0 R >> >> /Contents ${pid + 1} 0 R >>`);
      obj(pid + 1, `<< /Length ${content.length} >>`, content);
      obj(pid + 2, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>`, p.jpeg);
    });
    const xref = pos, total = 3 + pages.length * 3;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`; for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(x); push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
  }


  /* ── headlines with marked phrases ──────────────────────────────
     [words] → mark a, {words} → mark b. Each style decides what a mark looks like. */
  function tokenize(text) {
    return String(text ?? '').split('\n').map(par => {
      const toks = []; let open = null;
      par.split(/\s+/).filter(Boolean).forEach(raw => {
        const m = raw.match(/^([\[{])?(.*?)([\]}])?([.,;:!?…"”’)]*)$/);
        const w = m ? m[2] + m[4] : raw;
        if (m && m[1]) open = m[1] === '[' ? 'a' : 'b';
        toks.push({ w, m: open });
        if (m && m[3]) open = null;
      });
      return toks;
    });
  }
  function layoutMarked(ctx, text, maxW) {
    const out = [], space = ctx.measureText(' ').width, extra = space * 0.7;
    tokenize(text).forEach(par => {
      let line = [], x = 0, prev = null;
      par.forEach(t => {
        const width = ctx.measureText(t.w).width;
        /* a marker needs room for its box: open the gap where a marked run starts or ends */
        if (line.length && prev && (t.m !== prev.m)) x += extra;
        if (line.length && x + width > maxW) { out.push({ toks: line, width: x - space }); line = []; x = 0; }
        line.push({ ...t, x, width }); x += width + space; prev = t;
      });
      out.push({ toks: line, width: Math.max(0, x - space) });
    });
    return out;
  }
  /* shrink-to-fit then draw. o: { w, lines, max, min, weight, family, track, leading, align, color,
     marks: { a: { rect, text }, b: { rect, text } } }. dry = measure only. Returns { size, lead, height, bottom }. */
  function marked(ctx, text, x, y, o, dry) {
    let size = o.max, lines;
    for (;;) {
      ctx.font = `${o.weight ?? 900} ${size}px ${o.family ?? 'Geist'}`; ctx.letterSpacing = `${size * (o.track ?? -0.034)}px`;
      lines = layoutMarked(ctx, text, o.w);
      if (lines.length <= o.lines || size <= (o.min ?? 24)) break; size -= 2;
    }
    const lead = size * (o.leading ?? 0.96);
    if (!dry) lines.forEach((l, i) => {
      const base = y + (i + 1) * lead - size * 0.16, x0 = o.align === 'center' ? x - l.width / 2 : x;
      const runs = []; let run = null;
      l.toks.forEach(t => { if (t.m) { if (run && run.m === t.m) run.end = t.x + t.width; else { run = { m: t.m, start: t.x, end: t.x + t.width }; runs.push(run); } } else run = null; });
      runs.forEach(r => { const st = o.marks && o.marks[r.m]; if (st && st.rect) { ctx.fillStyle = st.rect; roundRect(ctx, x0 + r.start - size * 0.14, base - size * 0.76, r.end - r.start + size * 0.28, size * 0.98, size * 0.1); ctx.fill(); } });
      l.toks.forEach(t => { const st = t.m && o.marks && o.marks[t.m]; ctx.fillStyle = st ? st.text : o.color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t.w, x0 + t.x, base); });
    });
    ctx.letterSpacing = '0px';
    return { size, lead, height: lines.length * lead, bottom: y + lines.length * lead, lines: lines.length };
  }
  const strip = (t) => String(t ?? '').replace(/[\[\]{}]/g, '');

  return { PAL, AREAS, V2, palette, tokenize, layoutMarked, marked, strip, MARK_A, MARK_B, mark, lockup, wordmark, svgMark, burst, wrap, fit, block, measure, mono, roundRect, cover, circle, placeholder, loadFiles, loadUrl, fontsReady, download, bytes, slug, zip, pdf };
})();
