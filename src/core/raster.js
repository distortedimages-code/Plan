/* Calepin — baguette magique sur image : remplissage d'une pièce, contour, simplification. */
(function () {
  const PL = (globalThis.PL = globalThis.PL || {});
  const G = PL.geom;
  const INF = 1e20;

  function edt1d(f, n, d, v, z) {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  }
  /* distance euclidienne au carré jusqu'au pixel « vrai » le plus proche */
  function edt(mask, w, h) {
    const D = new Float32Array(w * h), n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = mask[y * w + x] ? 0 : INF; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) D[y * w + x] = d[y]; }
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = D[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) D[y * w + x] = d[x]; }
    return D;
  }

  function darkMask(img, thr) {
    const { data, width: w, height: h } = img, m = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < m.length; i++, j += 4) { const a = data[j + 3] / 255; const l = (0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2]) * a + 255 * (1 - a); m[i] = l < thr ? 1 : 0; }
    return m;
  }

  function flood(free, w, h, sx, sy) {
    const R = new Uint8Array(w * h); if (!free[sy * w + sx]) return { R, n: 0, leak: false };
    const st = [sy * w + sx]; R[sy * w + sx] = 1; let n = 0, leak = false;
    while (st.length) {
      const i = st.pop(); n++; const x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) leak = true;
      if (x > 0 && free[i - 1] && !R[i - 1]) { R[i - 1] = 1; st.push(i - 1); }
      if (x < w - 1 && free[i + 1] && !R[i + 1]) { R[i + 1] = 1; st.push(i + 1); }
      if (y > 0 && free[i - w] && !R[i - w]) { R[i - w] = 1; st.push(i - w); }
      if (y < h - 1 && free[i + w] && !R[i + w]) { R[i + w] = 1; st.push(i + w); }
    }
    return { R, n, leak };
  }

  /* contour extérieur (suivi de bord de Moore) */
  function trace(R, w, h) {
    let s = -1; for (let i = 0; i < R.length; i++) if (R[i]) { s = i; break; } if (s < 0) return [];
    const dx = [1, 1, 0, -1, -1, -1, 0, 1], dy = [0, 1, 1, 1, 0, -1, -1, -1];
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && R[y * w + x];
    let x = s % w, y = (s / w) | 0; const sx = x, sy = y; let dir = 6; const out = []; let guard = 0;
    do {
      out.push({ x, y }); let found = false;
      for (let k = 0; k < 8; k++) { const d = (dir + 6 + k) % 8; const nx = x + dx[d], ny = y + dy[d]; if (at(nx, ny)) { x = nx; y = ny; dir = d; found = true; break; } }
      if (!found) break;
    } while ((x !== sx || y !== sy) && guard++ < 4e6);
    return out;
  }

  /*
   * img : ImageData ; px : point de départ (pixels) ; opts : {thr, closePx, thinPx}
   * renvoie {poly (pixels), leak, n}
   */
  function wand(img, px, opts = {}) {
    const w = img.width, h = img.height, thr = opts.thr || 160;
    let dark = darkMask(img, thr);
    if (opts.thinPx > 0) { // ouverture : retire les traits fins
      const inv = new Uint8Array(w * h); for (let i = 0; i < inv.length; i++) inv[i] = dark[i] ? 0 : 1;
      const Din = edt(inv, w, h), r2 = opts.thinPx * opts.thinPx; const er = new Uint8Array(w * h); for (let i = 0; i < er.length; i++) er[i] = dark[i] && Din[i] > r2 ? 1 : 0;
      const De = edt(er, w, h); for (let i = 0; i < dark.length; i++) dark[i] = De[i] <= r2 ? 1 : 0;
    }
    const D = edt(dark, w, h); const c2 = (opts.closePx || 0) ** 2;
    const free = new Uint8Array(w * h); for (let i = 0; i < free.length; i++) free[i] = D[i] > c2 ? 1 : 0;
    const sx = Math.max(0, Math.min(w - 1, Math.round(px.x))), sy = Math.max(0, Math.min(h - 1, Math.round(px.y)));
    let f = flood(free, w, h, sx, sy);
    if (!f.n) return { poly: [], leak: false, n: 0 };
    let R = f.R;
    if (c2 > 0) { const DR = edt(R, w, h), lim = (opts.closePx + 1) ** 2; const R2 = new Uint8Array(w * h); for (let i = 0; i < R2.length; i++) R2[i] = DR[i] <= lim && !dark[i] ? 1 : 0; R = R2; }
    // boucher les trous (textes, mobilier)
    const outside = new Uint8Array(w * h); const st = [];
    for (let x = 0; x < w; x++) { for (const y of [0, h - 1]) { const i = y * w + x; if (!R[i] && !outside[i]) { outside[i] = 1; st.push(i); } } }
    for (let y = 0; y < h; y++) { for (const x of [0, w - 1]) { const i = y * w + x; if (!R[i] && !outside[i]) { outside[i] = 1; st.push(i); } } }
    while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !R[j] && !outside[j]) { outside[j] = 1; st.push(j); } }
    for (let i = 0; i < R.length; i++) if (!outside[i]) R[i] = 1;
    const c = trace(R, w, h);
    let poly = G.simplifyDP(c.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 })), opts.simplify || 1.6, true);
    poly = G.cleanPoly(poly, 2, 2);
    return { poly, leak: f.leak, n: f.n };
  }

  /* orthogonalise un polygone autour d'un angle dominant */
  function orthogonalize(P, tolDeg = 7) {
    if (P.length < 4) return P;
    const bins = new Float64Array(90);
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const l = G.dist(a, b); let ang = ((G.deg(Math.atan2(b.y - a.y, b.x - a.x)) % 90) + 90) % 90; bins[Math.round(ang) % 90] += l; }
    let bi = 0; for (let i = 1; i < 90; i++) if (bins[i] > bins[bi]) bi = i;
    const dom = G.rad(bi);
    const out = PL.vec ? PL.vec.regularize(P, dom, tolDeg) : P;
    return G.cleanPoly(out, 1, 1);
  }

  PL.raster = { edt, wand, orthogonalize, darkMask };
})();
