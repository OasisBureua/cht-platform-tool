/* eslint-disable */
/**
 * The homepage gallery room and the particle field behind it.
 *
 * Ported from the CHM WordPress theme (chm-wp-home/assets/js/hero.js),
 * which is where the design was built and signed off. Plain WebGL2, no
 * Three.js. Kept as JS with a .d.ts beside it rather than retyped, so
 * the two copies stay diffable.
 *
 * Two differences from the theme, both for React:
 *   - each mount returns a cleanup that stops the loop, disconnects the
 *     observers and releases the GL context, so navigating away does
 *     not leave a GPU loop running on a detached canvas;
 *   - thumbnails load with crossOrigin, because here they come from
 *     i.ytimg.com rather than the same origin.
 */

export function mountGalleryRoom(hero) {
  if (!hero) return undefined;
  const cleanups = [];
  let disposed = false;
  // Declared here because the theme's copy assigns it without a
  // declaration, which a sloppy-mode script allows and a module does not.
  // Nothing reads it; it is kept only so the two copies stay diffable.
  let dirty = false;

  const canvas = hero.querySelector('.hero__canvas');
  const list = hero.querySelector('.hero__works');
  if (!canvas || !list) return;

  const nodes = [...list.querySelectorAll('[data-work]')];
  if (!nodes.length) return;

  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
  if (!gl) { hero.dataset.gl = 'off'; return; }

  // ── constants, from the approved build ───────────────────────
  const SEGMENTS = 96;
  const CAM = 2000;
  const SIZE = 0.84;          // piece height as a fraction of base
  const GAP = 0.48;           // spacing between pieces, in means (20% tighter than the reference)
  const LABEL_H = 0.24;       // label height as a fraction of base
  const LABEL_GAP = 0.04;
  // Each work is drawn as a card, surface, inset thumbnail, title and
   // meta composited into one texture, rather than a bare plane with a
   // caption floating under it. Flip to false for the open version.
  const CARDS = true;
  const INTRO_DELAY = 1500;
  const INTRO_RUN = 2400;
  const INTRO_DISTANCE = 1080;
  // The room is centred between the two copy blocks rather than in the
  // hero, because the heading block is taller than the lede, centring
  // on the hero leaves a band of air under the cards and none above.
  // Measured in plan(), so it stays right as the type reflows.
  let dropPx = 0;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // Cards rest slightly faded and come up to full on hover, with a
  // small lift in scale. The pointer target is the tracked anchor, so
  // this is an ordinary hover on a real link, no raycasting.
  const REST_ALPHA = 0.8;
  const HOVER_SCALE = 1.25;
  // The room eases to a stop while a card is hovered or focused, so the
  // card under the pointer holds still long enough to read and click,
  // then eases back to cruise when it is left. Same smoothing curve as
  // the hover itself, so the two move together.
  let pauseT = 0;

  // ── shaders ──────────────────────────────────────────────────
  const VERT = `#version 300 es
  precision highp float;
  in vec3 aPos; in vec2 aUV;
  uniform mat4 uProj; uniform float uCam;
  out vec2 vUV;
  void main(){ vUV = aUV; gl_Position = uProj * vec4(aPos.x, aPos.y, aPos.z - uCam, 1.0); }`;

  const FRAG = `#version 300 es
  precision highp float;
  in vec2 vUV; uniform sampler2D uTex; uniform float uAlpha; out vec4 frag;
  void main(){
    vec4 c = texture(uTex, vUV);
    if (c.a < 0.01) discard;
    frag = vec4(c.rgb, c.a * uAlpha);
  }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.warn('[chm hero] falling back to the static grid:', err);
    hero.dataset.gl = 'off';
    return;
  }
  gl.useProgram(prog);
  hero.dataset.gl = 'on';

  const A_POS = gl.getAttribLocation(prog, 'aPos');
  const A_UV = gl.getAttribLocation(prog, 'aUV');
  const U_PROJ = gl.getUniformLocation(prog, 'uProj');
  const U_CAM = gl.getUniformLocation(prog, 'uCam');
  const U_TEX = gl.getUniformLocation(prog, 'uTex');
  const U_ALPHA = gl.getUniformLocation(prog, 'uAlpha');

  // No mipmaps and LINEAR on both filters, as the reference does.
  // A piece is never minified far below 1:1 here, and mipmapping
  // visibly softens the works at the back wall.
  function texture(source) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // Order is shuffled per visit, as it is in the reference, so the
  // room is not the same walk twice.
  const pieces = nodes.map((node) => ({
    node,
    src: node.dataset.thumb,
    title: node.dataset.title || '',
    meta: node.dataset.meta || '',
    size: parseFloat(node.dataset.size) || SIZE,
    aspect: 1.6,
    labelAspect: 1,
    hover: 0,   // target, 0 or 1
    hoverT: 0,  // smoothed
  }));

  for (const piece of pieces) {
    piece.node.addEventListener('pointerenter', () => { piece.hover = 1; });
    piece.node.addEventListener('pointerleave', () => { piece.hover = 0; });
    // A card can slide out from under a stationary cursor, and a link
    // that never gets its leave event would stay lit.
    piece.node.addEventListener('focus', () => { piece.hover = 1; });
    piece.node.addEventListener('blur', () => { piece.hover = 0; });
  }
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }

  function readToken(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v ? `hsl(${v})` : fallback;
  }

  // The reference labels carry gallery captions, "The Starry Night"
  // which never need wrapping. CHM session titles run four times that,
  // so the title wraps to at most two lines and the plane is capped.
  // Height is fixed at three rows whatever the title does, so the type
  // stays one size across the room instead of shrinking on long titles.
  const LABEL_MAX = 620;
  const LABEL_TOP = 17.6;
  const LABEL_LINE = 56.32;
  const LABEL_ROWS = 3;

  function labelTexture(piece) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const titleFont = '400 44px Geist, system-ui, sans-serif';
    const metaFont = '500 32px "Geist Mono", monospace';

    g.font = titleFont;
    const titleLines = [];
    let line = '';
    for (const word of piece.title.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (g.measureText(test).width > LABEL_MAX && line) {
        titleLines.push(line);
        line = word;
        if (titleLines.length === 2) break;
      } else line = test;
    }
    if (titleLines.length < 2 && line) titleLines.push(line);

    // Anything past two lines is cut rather than shrunk, so the label
    // cannot grow taller than the room allows for it.
    if (titleLines.length === 2) {
      let last = titleLines[1];
      if (g.measureText(last).width > LABEL_MAX) {
        while (last.length > 1 && g.measureText(last + '…').width > LABEL_MAX) last = last.slice(0, -1);
        titleLines[1] = last + '…';
      }
    }

    const rows = [...titleLines.map((t) => [t, titleFont, true])];
    if (piece.meta) rows.push([piece.meta, metaFont, false]);

    let width = 0;
    for (const [text, font] of rows) { g.font = font; width = Math.max(width, g.measureText(text).width); }

    c.width = Math.max(2, Math.ceil(Math.min(width, LABEL_MAX)) * 2);
    c.height = Math.round((LABEL_TOP + LABEL_ROWS * LABEL_LINE + 20) * 2);
    g.scale(2, 2);
    g.textBaseline = 'top';

    rows.forEach(([text, font, isTitle], i) => {
      g.font = font;
      g.fillStyle = isTitle ? readToken('--foreground', '#0d0d0d') : readToken('--muted-foreground', '#4f4f4f');
      g.fillText(text, 0, LABEL_TOP + i * LABEL_LINE);
    });

    piece.labelAspect = c.width / c.height;
    return c;
  }

  // ── the floor plan ───────────────────────────────────────────
  let path = null, loopLength = 1, base = 0;

  function plan(w, h) {
    const above = hero.querySelector('.hero__copy--top');
    const below = hero.querySelector('.hero__copy--bottom');
    const bandTop = above ? above.offsetTop + above.offsetHeight : 0;
    const bandBottom = below ? below.offsetTop : h;
    const band = Math.max(140, bandBottom - bandTop);
    dropPx = (bandTop + bandBottom) / 2 - h / 2;

    // Cards are sized to the band between the copy blocks rather than
    // to the hero, so growing the heading takes room from the cards
    // instead of sliding them underneath it.
    // 1.02 rather than a strict fit: the cards that exceed the band are
    // the near ones on the side walls, and those sit at the frame edges
    // where the centred heading is not.
    base = Math.min(0.64 * h, 560, (band * 1.02) / SIZE);

    let total = 0;
    for (const p of pieces) {
      p.h = base * p.size;
      p.w = p.h * p.aspect;
      p.lh = LABEL_H * base;
      p.lw = p.lh * p.labelAspect;
      p.ly = -p.h / 2 - LABEL_GAP * base - p.lh / 2;
      total += p.w;
    }

    const mean = total / pieces.length;
    const narrow = w < 700;
    const width = mean * (narrow ? 1.248 : 2.304);
    const depth = mean * (narrow ? 3.5 : 4.5);
    const front = Math.max(0, Math.min(2000 * (1 - width / w) + 200, 1200));
    const radius = Math.max(0, Math.min(0.75 * mean, width / 2, depth + front));

    path = {
      width, depth, front, radius,
      side: (depth + front - radius) / 1.25,
      corner: (Math.PI * radius) / 2.25,
      back: width - 2 * radius,
    };
    path.length = 2 * path.side + 2 * path.corner + path.back;

    let cursor = 0;
    for (const p of pieces) { p.center = cursor + p.w / 2; cursor += p.w + GAP * mean; }
    loopLength = Math.max(cursor, path.length + 2 * mean);
    dirty = true;
  }

  // Eased corner traversal. A constant-radius sweep makes a piece
  // cross the corner at a steady rate, which reads as a turntable;
  // this accelerates into the turn and out of it.
  function cornerAngle(f, start, end) {
    return (Math.PI * (start * f + (end - start) * (f ** 3 - f ** 4 / 2))) / (start + end);
  }

  function point(distance) {
    const { width, depth, front, radius, side, corner, back } = path;
    let d = Math.max(0, Math.min(distance, path.length));

    if (d <= side) return [-width / 2, front - d * 1.25];
    d -= side;
    if (d <= corner) {
      const a = cornerAngle(d / corner, 1.25, 1);
      return [-width / 2 + radius - radius * Math.cos(a), -depth + radius - radius * Math.sin(a)];
    }
    d -= corner;
    if (d <= back) return [-width / 2 + radius + d, -depth];
    d -= back;
    if (d <= corner) {
      const a = cornerAngle(d / corner, 1, 1.25);
      return [width / 2 - radius + radius * Math.sin(a), -depth + radius - radius * Math.cos(a)];
    }
    d -= corner;
    return [width / 2, -depth + radius + d * 1.25];
  }

  // ── meshes ───────────────────────────────────────────────────
  const FLOATS = SEGMENTS * 6 * 5;
  const vao = gl.createVertexArray();
  const buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, FLOATS * 4, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(A_POS); gl.vertexAttribPointer(A_POS, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(A_UV); gl.vertexAttribPointer(A_UV, 2, gl.FLOAT, false, 20, 12);
  gl.bindVertexArray(null);
  const scratch = new Float32Array(FLOATS);

  // Clipped to the visible span rather than drawn whole, and the UV
  // is remapped across the clip, so a piece running off the end of
  // the path is cropped instead of squashed.
  function bend(center, width, height, y) {
    const left = center - width / 2;
    const start = Math.max(left, 0);
    const end = Math.min(left + width, path.length);
    if (end <= start) return 0;

    let n = 0;
    for (let i = 0; i < SEGMENTS; i++) {
      const d0 = start + ((end - start) * i) / SEGMENTS;
      const d1 = start + ((end - start) * (i + 1)) / SEGMENTS;
      const u0 = (d0 - left) / width, u1 = (d1 - left) / width;
      const [x0, z0] = point(d0), [x1, z1] = point(d1);
      const top = y + height / 2, bottom = y - height / 2;
      const push = (x, yy, z, u, v) => {
        scratch[n++] = x; scratch[n++] = yy; scratch[n++] = z; scratch[n++] = u; scratch[n++] = v;
      };
      push(x0, top, z0, u0, 0); push(x1, top, z1, u1, 0); push(x0, bottom, z0, u0, 1);
      push(x1, top, z1, u1, 0); push(x1, bottom, z1, u1, 1); push(x0, bottom, z0, u0, 1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, scratch, 0, n);
    return SEGMENTS * 6;
  }

  const proj = new Float32Array(16);

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = hero.clientWidth, h = hero.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    plan(w, h);

    // fov = 2·atan(h/4000), the reference's camera. One world unit is
    // one CSS pixel at the back wall, so the window decides how much
    // of the room is in shot and never how big anything is.
    const fov = 2 * Math.atan(h / (2 * CAM));
    const f = 1 / Math.tan(fov / 2);
    const near = 1, far = 20000;
    proj.fill(0);
    proj[0] = f / (w / h); proj[5] = f;
    proj[10] = (far + near) / (near - far); proj[11] = -1;
    proj[14] = (2 * far * near) / (near - far);
  }

  // ── motion ───────────────────────────────────────────────────
  // The room never stops and nothing interrupts it. The opening move
  // is a deceleration into the cruise rather than a stop, so there is
  // no seam where the entrance hands over to the loop.
  const PEAK = 1350;   // units per second at the start of the entrance
  const CRUISE = 130;  // units per second, forever after
  let current = 0;
  let lastFrame = performance.now(), started = lastFrame;
  let running = true;

  // Speed decays from the entrance peak to the cruise across the
  // intro. (1-u)² lands on CRUISE with matching slope, so the handover
  // is invisible.
  function speedAt(now) {
    if (reduced.matches) return 0;
    const t = now - started - INTRO_DELAY;
    if (t <= 0) return 0;
    const u = Math.min(1, t / INTRO_RUN);
    return CRUISE + (PEAK - CRUISE) * (1 - u) ** 2;
  }

  // Pause off-screen and in background tabs. A carousel nobody is
  // looking at should not hold a GPU awake.
  const onVisibility = () => {
    running = !document.hidden;
    if (running) { lastFrame = performance.now(); requestAnimationFrame(render); }
  };
  document.addEventListener('visibilitychange', onVisibility);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));

  let onScreen = true;
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    if (onScreen && running) { lastFrame = performance.now(); requestAnimationFrame(render); }
  }, { threshold: 0 });
  io.observe(hero);
  cleanups.push(() => io.disconnect());

  // ── screen-space link tracking ───────────────────────────────
  // Each piece already has a real <a> in the markup. Rather than
  // raycasting the canvas, the piece's corners are projected back to
  // CSS pixels each frame and the anchor is parked over them. Clicks,
  // middle-click, right-click and keyboard focus then all behave like
  // the ordinary links they are.
  function project(x, y, z, w, h) {
    const clipW = CAM - z;
    if (clipW <= 1) return null;
    const ndcX = (proj[0] * x) / clipW;
    const ndcY = (proj[5] * y) / clipW;
    return [(ndcX * 0.5 + 0.5) * w, (1 - (ndcY * 0.5 + 0.5)) * h];
  }

  function trackLink(piece, center, w, h) {
    const node = piece.node;
    // The box follows the hover scale, or the pointer target drifts off
    // the card it belongs to while the card is lifted.
    const k = 1 + (HOVER_SCALE - 1) * piece.hoverT;
    const pw = piece.w * k, ph = piece.h * k;
    const left = center - pw / 2;
    const start = Math.max(left, 0);
    const end = Math.min(left + pw, path.length);
    if (end <= start) { node.style.display = 'none'; return; }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, depth = 0;
    // Five samples across the span catch the bend round a corner; the
    // bounding box of a curved piece is not its two end points.
    for (let i = 0; i <= 4; i++) {
      const d = start + ((end - start) * i) / 4;
      const [x, z] = point(d);
      depth += z;
      const drop = -dropPx;
      for (const yy of [ph / 2 + drop, -ph / 2 + drop]) {
        const p = project(x, yy, z, w, h);
        if (!p) { node.style.display = 'none'; return; }
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
    }

    node.style.display = '';
    node.style.left = `${minX}px`;
    node.style.top = `${minY}px`;
    node.style.width = `${Math.max(0, maxX - minX)}px`;
    node.style.height = `${Math.max(0, maxY - minY)}px`;
    // Nearer pieces take the click where two overlap at a corner.
    // depth is a sum of z values, all negative and more negative the
    // further back a piece sits, so this has to be scaled and floored
    // into a positive band, a negative z-index would drop the link
    // behind its own stacking context.
    node.style.zIndex = String(Math.max(1, Math.round(1000 + depth / 25)));
  }

  function render(now) {
    if (disposed || !running || !onScreen) return;

    const dt = Math.min(now - lastFrame, 80);
    lastFrame = now;
    const pauseTarget = pieces.some((p) => p.hover) ? 1 : 0;
    pauseT += (pauseTarget - pauseT) * (1 - Math.pow(0.82, dt / (1000 / 60)));
    if (Math.abs(pauseTarget - pauseT) < 0.001) pauseT = pauseTarget;
    current += (speedAt(now) * (1 - pauseT) * dt) / 1000;

    const w = hero.clientWidth, h = hero.clientHeight;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniformMatrix4fv(U_PROJ, false, proj);
    gl.uniform1f(U_CAM, CAM);
    gl.uniform1i(U_TEX, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(vao);

    // Placed first, then drawn far to near. With the cards no longer
    // fully opaque, draw order decides whether a near card blends over
    // the one behind it or punches a hole in it.
    const order = [];
    for (const p of pieces) {
      if (!p.tex) continue;
      let center = ((p.center - current) % loopLength + loopLength) % loopLength;
      // A piece past the end of the path may still have its tail in
      // shot one loop back.
      if (center - p.w / 2 >= path.length && center - loopLength + p.w / 2 > 0) center -= loopLength;

      p.hoverT += (p.hover - p.hoverT) * (1 - Math.pow(0.82, dt / (1000 / 60)));
      if (Math.abs(p.hover - p.hoverT) < 0.001) p.hoverT = p.hover;

      const [, z] = point(Math.max(0, Math.min(center, path.length)));
      order.push({ p, center, z });
    }
    order.sort((a, b) => a.z - b.z);

    const drop = -dropPx;
    for (const { p, center } of order) {
      gl.uniform1f(U_ALPHA, REST_ALPHA + (1 - REST_ALPHA) * p.hoverT);
      const k = reduced.matches ? 1 : 1 + (HOVER_SCALE - 1) * p.hoverT;

      gl.bindTexture(gl.TEXTURE_2D, p.tex);
      let n = bend(center, p.w * k, p.h * k, drop);
      if (n) gl.drawArrays(gl.TRIANGLES, 0, n);

      if (p.labelTex && !CARDS) {
        gl.bindTexture(gl.TEXTURE_2D, p.labelTex);
        n = bend(center - p.w / 2 + p.lw / 2, p.lw, p.lh, p.ly + drop);
        if (n) gl.drawArrays(gl.TRIANGLES, 0, n);
      }

      trackLink(p, center, w, h);
    }

    gl.bindVertexArray(null);
    requestAnimationFrame(render);
  }

  // ── load ─────────────────────────────────────────────────────
  // ── the card ─────────────────────────────────────────────────
  // Composited in a 2D canvas and uploaded as one texture, so a card
  // is still a single quad in the room. The surface is the --card
  // token rather than white: on a white page a white card has no edge,
  // and the design system already puts cards a step down from the page.
  function roundRect(g, x, y, w, h, r) {
    if (g.roundRect) { g.beginPath(); g.roundRect(x, y, w, h, r); return; }
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  const CARD_W = 340, CARD_PAD = 12, CARD_GAP = 10;
  const CARD_TITLE = 15, CARD_LINE = 20, CARD_META = 14;

  function cardTexture(piece, img) {
    const inner = CARD_W - CARD_PAD * 2;
    const imgH = Math.round(inner / (img.width / img.height || 1.6));

    const probe = document.createElement('canvas').getContext('2d');
    probe.font = `400 ${CARD_TITLE}px Geist, system-ui, sans-serif`;
    const lines = [];
    let line = '';
    for (const word of piece.title.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (probe.measureText(test).width > inner && line) {
        lines.push(line); line = word;
        if (lines.length === 2) break;
      } else line = test;
    }
    if (lines.length < 2 && line) lines.push(line);
    if (lines.length === 2 && probe.measureText(lines[1]).width > inner) {
      let last = lines[1];
      while (last.length > 1 && probe.measureText(last + '…').width > inner) last = last.slice(0, -1);
      lines[1] = last + '…';
    }

    // Height is fixed at two title lines whatever the title runs to, so
    // every card in the room is the same shape.
    const textH = 2 * CARD_LINE + 6 + CARD_META;
    const CH = CARD_PAD + imgH + CARD_GAP + textH + CARD_PAD;

    const SC = 2;
    const c = document.createElement('canvas');
    c.width = CARD_W * SC; c.height = Math.round(CH * SC);
    const g = c.getContext('2d');
    g.scale(SC, SC);

    g.fillStyle = readToken('--card', '#f5f5f5');
    roundRect(g, 0, 0, CARD_W, CH, 14); g.fill();

    g.save();
    roundRect(g, CARD_PAD, CARD_PAD, inner, imgH, 8); g.clip();
    g.drawImage(img, CARD_PAD, CARD_PAD, inner, imgH);
    g.restore();

    g.textBaseline = 'top';
    g.fillStyle = readToken('--foreground', '#0d0d0d');
    g.font = `400 ${CARD_TITLE}px Geist, system-ui, sans-serif`;
    lines.forEach((l, i) => g.fillText(l, CARD_PAD, CARD_PAD + imgH + CARD_GAP + i * CARD_LINE));

    g.fillStyle = readToken('--muted-foreground', '#4f4f4f');
    g.font = '500 11px "Geist Mono", monospace';
    g.letterSpacing = '0.06em';
    g.fillText(piece.meta.toUpperCase(), CARD_PAD, CARD_PAD + imgH + CARD_GAP + 2 * CARD_LINE + 6);

    piece.aspect = CARD_W / CH;
    return c;
  }

  function mount(piece) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      // YouTube thumbnails are cross-origin. They send ACAO: *, but the
      // canvas they are drawn into is tainted unless the request asks.
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (CARDS) {
          piece.tex = texture(cardTexture(piece, img));
        } else {
          piece.aspect = img.width / img.height;
          piece.tex = texture(img);
        }
        resize();
        resolve();
      };
      img.onerror = () => {
        // Not every video has a maxres thumbnail. mqdefault is 16:9 with
        // no letterbox bars, unlike hq and sd, so it drops into the card.
        if (!img.dataset.retried && /maxresdefault/.test(img.src)) {
          img.dataset.retried = '1';
          img.src = img.src.replace('maxresdefault', 'mqdefault');
          return;
        }
        console.warn('[chm hero] thumbnail failed, piece skipped:', piece.src);
        resolve();
      };
      img.src = piece.src;
    });
  }

  function start() {
    if (disposed) return;
    if (!CARDS) for (const p of pieces) p.labelTex = texture(labelTexture(p));
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(hero);
    cleanups.push(() => ro.disconnect());
    started = lastFrame = performance.now();
    requestAnimationFrame(render);
  }

  Promise.all(pieces.map(mount)).then(() => {
    if (disposed) return;
    if (!pieces.some((p) => p.tex)) { hero.dataset.gl = 'off'; return; }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    else start();
  });
  return () => {
    disposed = true;
    cleanups.forEach((fn) => fn());
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  };
}

export function mountHeroField(hero) {
  const cv = hero && hero.querySelector('.hero__field');
  if (!cv) return undefined;
  let disposed = false;
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  const host = cv.parentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, motes = [], frame = 0, onScreen = true;

  const seed = () => {
    // Density scales with area so a wide monitor does not thin out.
    const n = Math.round(Math.min(1600, (w * h) / 950));
    motes = Array.from({ length: n }, () => ({
      x: Math.random(),
      y: Math.random(),
      // Mostly drifting right, at a spread of speeds, so the field has
      // depth of its own without competing with the room's direction.
      vx: 0.004 + Math.random() * 0.012,
      vy: (Math.random() - 0.5) * 0.004,
      z: Math.random() < 0.3 ? 2.4 : 1.6,
      o: 0.1 + Math.random() * 0.34,
    }));
  };

  const fit = () => {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    w = r.width; h = r.height;
    seed();
  };

  const ink = () => {
    const t = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
    return t ? `hsl(${t})` : '#0d0d0d';
  };

  let last = performance.now();
  const draw = (now) => {
    const dt = Math.min((now || performance.now()) - last, 80);
    last = now || last;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ink();
    for (const m of motes) {
      if (!still) {
        m.x += (m.vx * dt) / 100;
        m.y += (m.vy * dt) / 100;
        if (m.x > 1.02) m.x = -0.02;
        if (m.y > 1.02) m.y = -0.02;
        if (m.y < -0.02) m.y = 1.02;
      }
      ctx.globalAlpha = m.o;
      ctx.fillRect(m.x * w, m.y * h, m.z, m.z);
    }
    ctx.globalAlpha = 1;
    if (!disposed && !still && onScreen) frame = requestAnimationFrame(draw);
  };

  fit();
  draw();

  const io = new IntersectionObserver(([e]) => {
    if (disposed || e.isIntersecting === onScreen) return;
    onScreen = e.isIntersecting;
    if (onScreen) { last = performance.now(); draw(); }
    else cancelAnimationFrame(frame);
  }, { rootMargin: '120px' });
  io.observe(cv);

  let pending;
  const onResize = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => { if (!disposed) { fit(); if (still) draw(); } });
  };
  window.addEventListener('resize', onResize);

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(pending);
    io.disconnect();
    window.removeEventListener('resize', onResize);
  };
}
