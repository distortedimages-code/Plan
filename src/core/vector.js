/* Calepin — analyse d'un plan vectoriel : échelle, calques, murs, pièces, ouvertures, escaliers. */
(function () {
  const PL = (globalThis.PL = globalThis.PL || {});
  const G = PL.geom;

  /* ---------- index spatial ---------- */
  class Grid {
    constructor(cell) { this.c = cell; this.m = new Map(); }
    key(i, j) { return i * 73856093 ^ j * 19349663; }
    insertBox(x0, y0, x1, y1, v) {
      const c = this.c; for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) { const k = this.key(i, j); let a = this.m.get(k); if (!a) this.m.set(k, (a = [])); a.push(v); }
    }
    query(x0, y0, x1, y1, cb) {
      const c = this.c, seen = new Set();
      for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) { const a = this.m.get(this.key(i, j)); if (a) for (const v of a) if (!seen.has(v)) { seen.add(v); cb(v); } }
    }
  }
  const segBox = (s, pad = 0) => [Math.min(s.a.x, s.b.x) - pad, Math.min(s.a.y, s.b.y) - pad, Math.max(s.a.x, s.b.x) + pad, Math.max(s.a.y, s.b.y) + pad];
  const lum = (hex) => { if (!hex || hex[0] !== '#') return 0; const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

  /* ---------- nombres ---------- */
  function parseNum(s) {
    const t = s.replace(/ | /g, ' ').trim();
    if (!/^\d[\d ]*([.,]\d+)?$/.test(t)) return null;
    const hasDec = /[.,]/.test(t); const v = parseFloat(t.replace(/ /g, '').replace(',', '.'));
    if (!isFinite(v) || v <= 0) return null; return { v, hasDec };
  }

  /* ---------- échelle ---------- */
  function scaleFromTexts(lines) {
    for (const l of lines) { const m = l.s.match(/(?:[ée]ch(?:elle)?\.?\s*:?\s*)1\s*[:\/]\s*(\d{1,4})\b/i); if (m) return +m[1]; }
    for (const l of lines) { const m = l.s.match(/^\s*1\s*[:\/]\s*(20|25|50|75|100|200|250|500)\s*$/); if (m) return +m[1]; }
    return null;
  }

  /* cotes : texte numérique posé sur une ligne de cote, mesurée entre ses traits obliques */
  function findCotes(raw, lines) {
    const segs = raw.segs; const grid = new Grid(40);
    const strokeSt = raw.styles.map((st) => st.kind !== 'F');
    segs.forEach((s, i) => { if (!strokeSt[s.st]) return; const b = segBox(s); grid.insertBox(b[0], b[1], b[2], b[3], i); });
    const out = [];
    for (const t of lines) {
      const num = parseNum(t.s); if (!num) continue;
      const d = { x: Math.cos(t.rot), y: Math.sin(t.rot) }, up = { x: d.y, y: -d.x };
      const c = { x: t.x + d.x * t.w / 2 + up.x * t.h * 0.35, y: t.y + d.y * t.w / 2 + up.y * t.h * 0.35 };
      const R = t.h * 1.6 + t.w;
      let best = null;
      grid.query(c.x - R, c.y - R, c.x + R, c.y + R, (i) => {
        const s = segs[i], sd = G.sub(s.b, s.a), l = G.len(sd); if (l < t.h * 0.8) return;
        if (Math.abs(G.cross(sd, d)) / l > 0.035) return;
        const perp = Math.abs(G.cross(G.sub(c, s.a), sd)) / l; if (perp > t.h * 1.3) return;
        const u = G.dot(G.sub(c, s.a), sd) / (l * l); const ext = (t.w / 2 + 2 * t.h) / l;
        if (u < -ext || u > 1 + ext) return;
        if (!best || perp < best.perp) best = { i, perp };
      });
      if (!best) continue;
      const s0 = segs[best.i], dir = G.norm(G.sub(s0.b, s0.a)), nrm = G.perp(dir);
      const off = G.dot(s0.a, nrm);
      const tc = G.dot(c, dir);
      // segments colinéaires + traits
      const BIG = 400; const pos = [], ticks = [];
      grid.query(c.x - BIG, c.y - BIG, c.x + BIG, c.y + BIG, (i) => {
        const s = segs[i], sd = G.sub(s.b, s.a), l = G.len(sd); if (l < 0.3) return;
        const par = Math.abs(G.cross(sd, dir)) / l;
        if (par < 0.01 && Math.abs(G.dot(s.a, nrm) - off) < 0.4) { pos.push([Math.min(G.dot(s.a, dir), G.dot(s.b, dir)), Math.max(G.dot(s.a, dir), G.dot(s.b, dir))]); return; }
        if (l < t.h * 3.5 && par > 0.4) { // trait oblique ou perpendiculaire
          const ma = G.dot(s.a, nrm) - off, mb = G.dot(s.b, nrm) - off;
          if (ma * mb < 0) { const f = ma / (ma - mb); const q = G.lerp(s.a, s.b, f); if (f > 0.15 && f < 0.85) ticks.push(G.dot(q, dir)); }
        }
      });
      let lo = null, hi = null;
      for (const tk of ticks) { if (tk < tc - 0.2 && (lo == null || tk > lo)) lo = tk; if (tk > tc + 0.2 && (hi == null || tk < hi)) hi = tk; }
      let len = null, how = 'traits';
      if (lo != null && hi != null) len = hi - lo;
      else {
        // pas de traits : étendue de la chaîne colinéaire autour du texte
        const iv = G.mergeIntervals(pos, t.w + 2 * t.h); const m = iv.find((v) => v[0] <= tc + t.w && v[1] >= tc - t.w);
        if (m) { len = m[1] - m[0]; how = 'ligne'; }
      }
      if (!len || len < t.h) continue;
      out.push({ text: t, v: num.v, hasDec: num.hasDec, len, how, c, dir, a: lo != null ? G.add(G.mul(dir, lo), G.mul(nrm, off)) : null, b: hi != null ? G.add(G.mul(dir, hi), G.mul(nrm, off)) : null });
    }
    return out;
  }

  function detectScale(raw, lines) {
    const ptmm = 25.4 / 72;
    const textScale = scaleFromTexts(lines);
    const cotes = findCotes(raw, lines);
    const cands = [];
    for (const c of cotes) {
      if (c.hasDec) { if (c.v < 60) cands.push({ k: (c.v * 1000) / c.len, u: 'm', c }); cands.push({ k: (c.v * 10) / c.len, u: 'cm', c }); }
      else { cands.push({ k: (c.v * 10) / c.len, u: 'cm', c }); cands.push({ k: c.v / c.len, u: 'mm', c }); if (c.v < 60) cands.push({ k: (c.v * 1000) / c.len, u: 'm', c }); }
    }
    const pageMax = Math.max(raw.width || 1000, raw.height || 700);
    const plausible = (k) => { const ext = pageMax * k; return ext > 6000 && ext < 250000; };
    const cluster = (k0) => { const set = new Set(); const ks = []; for (const b of cands) if (Math.abs(Math.log(b.k / k0)) < 0.012 && !set.has(b.c)) { set.add(b.c); ks.push(b.k); } ks.sort((x, y) => x - y); return { n: set.size, k: ks.length ? ks[Math.floor(ks.length / 2)] : k0 }; };
    let best = null;
    for (const a of cands) { if (!plausible(a.k)) continue; const cl = cluster(a.k); if (!best || cl.n > best.n) best = { k: cl.k, n: cl.n, u: a.u }; }
    let k = null, method = '', conf = 0, unit = best ? best.u : 'cm';
    if (textScale) {
      const kt = ptmm * textScale; const ct = cluster(kt);
      if (ct.n >= 3) { k = kt; method = `échelle 1:${textScale} confirmée par ${ct.n} cotes`; conf = 1; }
      else if (best && best.n >= 8 && best.n >= 0.4 * cotes.length) { k = best.k; method = `${best.n} cotes concordantes (le cartouche indique 1:${textScale})`; conf = 0.8; }
      else { k = kt; method = `échelle 1:${textScale} lue sur le plan`; conf = 0.7; }
    } else if (best && best.n >= 4) { k = best.k; method = `${best.n} cotes concordantes`; conf = Math.min(0.9, 0.4 + best.n / 20); }
    const ratio = k ? k / ptmm : null;
    const goodCotes = k ? cotes.filter((c) => cands.some((x) => x.c === c && Math.abs(Math.log(x.k / k)) < 0.02)) : [];
    return { k, method, conf, textScale, ratio: ratio ? Math.round(ratio) : null, cotes, goodCotes, unit };
  }

  /* ---------- passage au monde (mm, y vers le haut) ---------- */
  function toWorld(raw, k) {
    const H = raw.height; const T = (p) => ({ x: p.x * k, y: (H - p.y) * k });
    return {
      k, segs: raw.segs.map((s) => ({ a: T(s.a), b: T(s.b), st: s.st })),
      curves: raw.curves.map((c) => ({ p0: T(c.p0), c1: T(c.c1), c2: T(c.c2), p3: T(c.p3), st: c.st })),
      T,
    };
  }
  const textToWorld = (t, raw, k) => {
    const H = raw.height; const d = { x: Math.cos(t.rot), y: Math.sin(t.rot) }, up = { x: d.y, y: -d.x };
    const c = { x: t.x + d.x * t.w / 2 + up.x * t.h * 0.35, y: t.y + d.y * t.w / 2 + up.y * t.h * 0.35 };
    return { s: t.s, x: c.x * k, y: (H - c.y) * k, h: t.h * k, w: t.w * k, rot: -t.rot };
  };

  /* ---------- angle dominant ---------- */
  function dominantAngle(segs) {
    const bins = new Float64Array(180);
    for (const s of segs) { const d = G.sub(s.b, s.a), l = G.len(d); if (l < 300) continue; let a = Math.atan2(d.y, d.x); a = ((G.deg(a) % 90) + 90) % 90; bins[Math.round(a * 2) % 180] += l; }
    let bi = 0; for (let i = 1; i < 180; i++) if (bins[i] > bins[bi]) bi = i;
    return G.rad(bi / 2);
  }

  /* ---------- calques : rôle de chaque style ---------- */
  function analyzeStyles(raw, W, cotes) {
    const styles = raw.styles.map((s, i) => ({ ...s, i, segN: 0, segLen: 0, paired: 0, hits: 0, role: 'autre' }));
    const segs = W.segs; const grid = new Grid(1000);
    const info = segs.map((s, i) => { const d = G.sub(s.b, s.a), l = G.len(d); const st = styles[s.st]; st.segN++; st.segLen += l; return { i, l, d: l ? G.mul(d, 1 / l) : { x: 1, y: 0 } }; });
    segs.forEach((s, i) => { if (info[i].l >= 120) { const b = segBox(s); grid.insertBox(b[0], b[1], b[2], b[3], i); } });
    const paired = new Uint8Array(segs.length);
    segs.forEach((s, i) => {
      const I = info[i]; if (I.l < 120) return;
      const b = segBox(s, 600); let found = false;
      grid.query(b[0], b[1], b[2], b[3], (j) => {
        if (found || j === i) return; const J = info[j];
        if (Math.abs(G.cross(I.d, J.d)) > 0.0175) return;
        const t = segs[j]; const dist = Math.abs(G.cross(G.sub(t.a, s.a), I.d)); if (dist < 40 || dist > 600) return;
        const p0 = G.dot(G.sub(t.a, s.a), I.d), p1 = G.dot(G.sub(t.b, s.a), I.d);
        const ov = Math.min(I.l, Math.max(p0, p1)) - Math.max(0, Math.min(p0, p1));
        if (ov >= Math.max(100, 0.3 * Math.min(I.l, J.l))) found = true;
      });
      if (found) { paired[i] = 1; styles[s.st].paired += I.l; }
    });
    // styles « cote » : supportent les textes de cotes
    for (const c of cotes) { /* c.styleIdx rempli par l'appelant */ if (c.st != null && styles[c.st]) styles[c.st].hits++; }
    let maxPaired = 0; styles.forEach((s) => { maxPaired = Math.max(maxPaired, s.paired); });
    styles.forEach((s) => {
      s.pairRatio = s.segLen ? s.paired / s.segLen : 0;
      const isMask = (s.kind === 'F') && lum(s.fill) > 0.8;
      if (isMask) s.role = 'masque';
      else if (s.hits >= 3 && s.hits >= 0.04 * s.segN) s.role = 'cote';
      else if (s.pairRatio >= 0.3 && s.paired >= 0.03 * maxPaired && s.paired > 2000) s.role = 'mur';
      else s.role = 'autre';
    });
    return { styles, paired };
  }

  /* ---------- graphe planaire & faces ---------- */
  function buildGraph(segs, tol) {
    // fusion des points proches
    const pts = [], grid = new Map(), cell = tol;
    const keyOf = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
    const addPt = (p) => {
      const ix = Math.floor(p.x / cell), iy = Math.floor(p.y / cell);
      for (let i = ix - 1; i <= ix + 1; i++) for (let j = iy - 1; j <= iy + 1; j++) { const a = grid.get(i + ',' + j); if (a) for (const id of a) if (G.dist(pts[id], p) <= tol) return id; }
      const id = pts.length; pts.push({ x: p.x, y: p.y }); const k = keyOf(p.x, p.y); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(id); return id;
    };
    const edges = new Map(); const adj = [];
    const addEdge = (i, j) => { if (i === j) return; const k = i < j ? i + '_' + j : j + '_' + i; if (edges.has(k)) return; edges.set(k, [i, j]); (adj[i] = adj[i] || []).push(j); (adj[j] = adj[j] || []).push(i); };
    for (const s of segs) addEdge(addPt(s.a), addPt(s.b));
    return { pts, edges, adj, addPt, addEdge };
  }

  function splitSegments(segs, tol) {
    // découpe aux intersections et jonctions en T
    const grid = new Grid(800); segs.forEach((s, i) => { const b = segBox(s, tol); grid.insertBox(b[0], b[1], b[2], b[3], i); });
    const cuts = segs.map(() => [0, 1]);
    segs.forEach((s, i) => {
      const b = segBox(s, tol), sd = G.sub(s.b, s.a), l = G.len(sd); if (l < 1e-6) return;
      grid.query(b[0], b[1], b[2], b[3], (j) => {
        if (j <= i) return; const t = segs[j];
        const r = G.segInter(s.a, s.b, t.a, t.b);
        const lt = G.dist(t.a, t.b);
        if (r) {
          const et = tol / l, eu = tol / lt;
          if (r.t >= -et && r.t <= 1 + et && r.u >= -eu && r.u <= 1 + eu) { cuts[i].push(Math.max(0, Math.min(1, r.t))); cuts[j].push(Math.max(0, Math.min(1, r.u))); }
        } else {
          // colinéaires qui se chevauchent : couper aux extrémités
          if (Math.abs(G.cross(G.sub(t.a, s.a), sd)) / l > tol) return;
          for (const q of [t.a, t.b]) { const u = G.dot(G.sub(q, s.a), sd) / (l * l); if (u > 0 && u < 1) cuts[i].push(u); }
          const td = G.sub(t.b, t.a); for (const q of [s.a, s.b]) { const u = G.dot(G.sub(q, t.a), td) / (lt * lt); if (u > 0 && u < 1) cuts[j].push(u); }
        }
      });
      // extrémités des autres segments proches de l'intérieur (T)
    });
    const out = [];
    segs.forEach((s, i) => {
      const c = Array.from(new Set(cuts[i].map((u) => Math.round(u * 1e6) / 1e6))).sort((a, b) => a - b);
      for (let k = 0; k + 1 < c.length; k++) { const a = G.lerp(s.a, s.b, c[k]), b = G.lerp(s.a, s.b, c[k + 1]); if (G.dist(a, b) > tol * 0.5) out.push({ a, b, st: s.st, br: s.br }); }
    });
    return out;
  }

  /* ponts : referment les ouvertures (portes, fenêtres, passages) entre extrémités de murs alignées */
  function bridges(segs, opts) {
    const tol = opts.tol, minG = opts.minGap, maxG = opts.maxGap;
    const g = buildGraph(segs, tol);
    const { pts, adj } = g; const out = [];
    const dirs = pts.map((p, i) => (adj[i] || []).map((j) => G.norm(G.sub(pts[j], p))));
    const grid = new Grid(maxG); pts.forEach((p, i) => grid.insertBox(p.x, p.y, p.x, p.y, i));
    const segGrid = new Grid(1000); segs.forEach((s, i) => { const b = segBox(s, 2); segGrid.insertBox(b[0], b[1], b[2], b[3], i); });
    const blocked = (a, b) => {
      // un segment existant couvre déjà le milieu → pas une ouverture
      const m = G.lerp(a, b, 0.5); let hit = false;
      segGrid.query(m.x - 3, m.y - 3, m.x + 3, m.y + 3, (i) => { if (!hit && G.distPointSeg(m, segs[i].a, segs[i].b) < 3) hit = true; });
      return hit;
    };
    const cand = pts.map(() => null);
    pts.forEach((p, i) => {
      if (!dirs[i].length || dirs[i].length > 3) return;
      grid.query(p.x - maxG, p.y - maxG, p.x + maxG, p.y + maxG, (j) => {
        if (j === i) return; const q = pts[j]; const d = G.dist(p, q); if (d < minG || d > maxG) return;
        const u = G.mul(G.sub(q, p), 1 / d);
        // p doit avoir un mur qui part à l'opposé de q, colinéaire
        const okP = dirs[i].some((v) => G.dot(v, u) < -0.9994);
        const okQ = dirs[j].some((v) => G.dot(v, u) > 0.9994);
        if (!okP || !okQ) return;
        if (!cand[i] || d < cand[i].d) cand[i] = { j, d };
      });
    });
    const done = new Set();
    cand.forEach((c, i) => {
      if (!c) return; const j = c.j; const back = cand[j];
      if (!back || back.j !== i) return; const k = i < j ? i + '_' + j : j + '_' + i; if (done.has(k)) return; done.add(k);
      if (blocked(pts[i], pts[j])) return;
      out.push({ a: pts[i], b: pts[j], br: true });
    });
    return out;
  }

  function pruneDangling(g) {
    const deg = g.adj.map((a) => (a ? a.length : 0)); const alive = g.adj.map((a) => (a ? a.slice() : []));
    const stack = []; deg.forEach((d, i) => { if (d === 1) stack.push(i); });
    while (stack.length) { const i = stack.pop(); if (deg[i] !== 1) continue; const j = alive[i][0]; alive[i] = []; deg[i] = 0; alive[j] = alive[j].filter((x) => x !== i); deg[j]--; if (deg[j] === 1) stack.push(j); }
    return alive;
  }

  function faces(pts, adj) {
    const order = adj.map((nb, i) => (nb || []).slice().sort((a, b) => Math.atan2(pts[a].y - pts[i].y, pts[a].x - pts[i].x) - Math.atan2(pts[b].y - pts[i].y, pts[b].x - pts[i].x)));
    const pos = order.map((nb) => { const m = new Map(); nb.forEach((j, k) => m.set(j, k)); return m; });
    const visited = new Set(); const cycles = [];
    for (let u = 0; u < order.length; u++) for (const v of order[u]) {
      const key = u + '>' + v; if (visited.has(key)) continue;
      const cyc = []; let a = u, b = v, guard = 0;
      while (!visited.has(a + '>' + b) && guard++ < 100000) {
        visited.add(a + '>' + b); cyc.push(a);
        const nb = order[b]; const k = pos[b].get(a); const next = nb[(k - 1 + nb.length) % nb.length];
        a = b; b = next;
      }
      if (cyc.length >= 3) cycles.push(cyc.map((i) => pts[i]));
    }
    return cycles;
  }

  function regularize(P, dom, tolDeg = 1.5) {
    const n = P.length; if (n < 3) return P;
    const lines = [];
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n]; let ang = Math.atan2(b.y - a.y, b.x - a.x);
      const rel = G.normAng(ang - dom); const q = Math.round(rel / (Math.PI / 2)) * (Math.PI / 2);
      if (Math.abs(rel - q) < G.rad(tolDeg)) ang = dom + q;
      lines.push({ p: G.lerp(a, b, 0.5), d: { x: Math.cos(ang), y: Math.sin(ang) } });
    }
    const out = [];
    for (let i = 0; i < n; i++) { const L0 = lines[(i - 1 + n) % n], L1 = lines[i]; const q = Math.abs(G.cross(L0.d, L1.d)) < 1e-6 ? P[i] : G.lineInter(L0.p, L0.d, L1.p, L1.d); out.push(q && G.dist(q, P[i]) < 200 ? q : P[i]); }
    return out;
  }

  /* ---------- détection principale ---------- */
  const AREA_RE = /^(SS|SH|S\.?\s?H|S\.?\s?S|SU|S)?\s*[:=]?\s*(\d+[.,]\d+)\s*m?\s*[²2]?$/i;
  const BAD_NAME = /^(AF|VR|BSO|VMC|EU|AXE|Brut|Contre|Cloison|Trappe|Linge|Chute|MOUSTIQUAIRE|ITE|SOUS-FACE|LINTEAUX|PIED-DROIT|CHARPENTE|CROUPE|KLIMA|ABF|Ech|N)\b/i;

  function prepare(raw, k, o = {}) {
    const lines = PL.pdfvec ? PL.pdfvec.mergeTextLines(raw.texts) : raw.texts;
    const W = toWorld(raw, k);
    const texts = lines.map((t) => textToWorld(t, raw, k));
    const cotes = o.cotes || findCotes(raw, lines);
    const strokeSt = raw.styles.map((st) => st.kind !== 'F');
    const grid = new Grid(40); raw.segs.forEach((s, i) => { if (strokeSt[s.st]) { const b = segBox(s); grid.insertBox(b[0], b[1], b[2], b[3], i); } });
    cotes.forEach((c) => {
      let best = null; const R = c.text.h * 1.5 + c.text.w;
      grid.query(c.c.x - R, c.c.y - R, c.c.x + R, c.c.y + R, (i) => { const s = raw.segs[i]; const sd = G.sub(s.b, s.a); if (Math.abs(G.cross(sd, c.dir)) / (G.len(sd) || 1) > 0.035) return; const d = G.distPointSeg(c.c, s.a, s.b); if (d < c.text.h * 1.4 && (!best || d < best.d)) best = { d, st: s.st }; });
      c.st = best ? best.st : null;
    });
    const an = analyzeStyles(raw, W, cotes);
    // tirets : segments courts colinéaires séparés de petits vides
    const byStyle = {}; W.segs.forEach((s, i) => { (byStyle[s.st] = byStyle[s.st] || []).push(i); });
    for (const st of an.styles) {
      const ids = byStyle[st.i] || []; if (ids.length < 6) { st.dashed = 0; continue; }
      const g = new Grid(500); ids.forEach((i) => { const b = segBox(W.segs[i], 5); g.insertBox(b[0], b[1], b[2], b[3], i); });
      let dash = 0, tot = ids.length;
      for (const i of ids) {
        const s = W.segs[i], d = G.sub(s.b, s.a), l = G.len(d); if (l > 700 || l < 1) continue;
        const u = G.mul(d, 1 / l); let before = false, after = false; const b = segBox(s, 320);
        g.query(b[0], b[1], b[2], b[3], (j) => {
          if (j === i) return; const t = W.segs[j]; const td = G.sub(t.b, t.a), tl = G.len(td);
          if (tl < 1 || tl > 3 * l + 30 || tl < l / 3 - 30 || Math.abs(G.cross(u, G.mul(td, 1 / tl))) > 0.02) return;
          if (Math.abs(G.cross(G.sub(t.a, s.a), u)) > 3) return;
          const p0 = G.dot(G.sub(t.a, s.a), u), p1 = G.dot(G.sub(t.b, s.a), u), lo = Math.min(p0, p1), hi = Math.max(p0, p1);
          if (hi < -6 && hi > -300) before = true; if (lo > l + 6 && lo < l + 300) after = true;
        });
        if (before && after) dash++;
      }
      st.dashed = tot ? dash / tot : 0;
      if (st.role === 'mur' && st.dashed > 0.6) st.role = 'tirets';
    }
    // étiquettes de surface (groupes SS/SH)
    const labels = [];
    texts.forEach((t) => { const m = t.s.match(AREA_RE); if (!m || !/m|S/i.test(t.s)) return; const kind = (m[1] || '').toUpperCase().replace(/[.\s]/g, ''); const v = parseFloat(m[2].replace(',', '.')); let L = labels.find((l) => G.dist(l, t) < 4 * t.h + 400); if (!L) labels.push((L = { x: t.x, y: t.y, h: t.h })); L[kind || 'S'] = v; });
    return { raw, k, lines, W, texts, cotes, an, labels };
  }

  /* retire les petites saillies vers l'extérieur (embrasures de fenêtres, niches de portes) */
  function removeBumps(P, maxDepth = 420, maxWidth = 3200) {
    let pts = P.slice(), changed = true, guard = 0;
    while (changed && guard++ < 50 && pts.length > 4) {
      changed = false; const n = pts.length;
      for (let i = 0; i < n && !changed; i++) {
        const v = (k) => pts[(i + k + n) % n];
        const e0 = G.sub(v(0), v(-1)), e1 = G.sub(v(1), v(0)), e2 = G.sub(v(2), v(1)), e3 = G.sub(v(3), v(2)), e4 = G.sub(v(4), v(3));
        const l0 = G.len(e0), l1 = G.len(e1), l2 = G.len(e2), l3 = G.len(e3), l4 = G.len(e4);
        if (l0 < 50 || l4 < 50 || l1 > maxDepth || l3 > maxDepth || l2 > maxWidth || l1 < 5 || l3 < 5) continue;
        if (G.cross(e0, e1) >= 0 || G.cross(e3, e4) >= 0) continue; // virages à droite = vers l'extérieur
        if (G.dot(G.norm(e0), G.norm(e4)) < 0.999 || G.dot(G.norm(e0), G.norm(e2)) < 0.995) continue;
        const nrm = G.perp(G.norm(e0)); if (Math.abs(G.dot(G.sub(v(3), v(0)), nrm)) > 20) continue;
        pts = pts.filter((_, k) => k !== (i + 1) % n && k !== (i + 2) % n); changed = true;
      }
    }
    return G.cleanPoly(pts, 0.5, 5);
  }

  function buildRooms(ctx, roles, o, light) {
    const { W, an, texts } = ctx;
    const dom = dominantAngle(W.segs.filter((s) => roles[s.st] === 'mur'));
    const isWall = W.segs.map((s, i) => roles[s.st] === 'mur' && an.paired[i]);
    const wall = []; W.segs.forEach((s, i) => { if (isWall[i]) wall.push(s); });
    {
      const g0 = buildGraph(wall, o.tol * 2);
      const ptGrid = new Grid(200); g0.pts.forEach((p, i) => ptGrid.insertBox(p.x, p.y, p.x, p.y, i));
      const touches = (p) => { let hit = false; ptGrid.query(p.x - o.tol * 3, p.y - o.tol * 3, p.x + o.tol * 3, p.y + o.tol * 3, (i) => { if (G.dist(g0.pts[i], p) <= o.tol * 3) hit = true; }); return hit; };
      W.segs.forEach((s, i) => { if (isWall[i] || roles[s.st] !== 'mur') return; const l = G.dist(s.a, s.b); if (l <= 450 && touches(s.a) && touches(s.b)) wall.push(s); });
    }
    const br = bridges(wall, o);
    const all = splitSegments(wall.concat(br), o.tol);
    const g = buildGraph(all, o.tol);
    const alive = pruneDangling(g);
    const cycles = faces(g.pts, alive);
    const ccw = [], cw = [];
    cycles.forEach((c) => { const a = G.area(c); if (a > 1) ccw.push({ P: c, a, holes: [] }); else if (a < -1) cw.push({ P: c, a }); });
    for (const h of cw) {
      let li = 0, ll = -1; for (let i = 0; i < h.P.length; i++) { const l = G.dist(h.P[i], h.P[(i + 1) % h.P.length]); if (l > ll) { ll = l; li = i; } }
      const a = h.P[li], b = h.P[(li + 1) % h.P.length], m = G.lerp(a, b, 0.5), nrm = G.perp(G.norm(G.sub(b, a)));
      const probe = G.add(m, G.mul(nrm, 1.5));
      let owner = null; for (const f of ccw) if (f.a > -h.a && (!owner || f.a < owner.a) && G.pointInPoly(probe, f.P)) owner = f;
      if (owner) owner.holes.push(h);
    }
    let rooms = [], containers = [];
    for (const f of ccw) {
      const net = f.a + f.holes.reduce((s, h) => s + h.a, 0);
      const per = G.perimeter(f.P) + f.holes.reduce((s, h) => s + G.perimeter(h.P), 0);
      const thick = (2 * net) / per;
      if (f.a > 4e6 && net < 0.6 * f.a) containers.push(f);
      if (net < o.minArea || thick < o.minThick || net > 400e6) continue;
      rooms.push({ f, net, thick });
    }
    rooms = rooms.filter((r) => !rooms.some((q) => q !== r && q.f.a < r.f.a && G.pointInPoly(G.centroid(q.f.P), r.f.P) && q.f.a > 0.25 * r.f.a));
    if (containers.length) { const big = containers.sort((a, b) => b.a - a.a)[0]; rooms = rooms.filter((r) => G.pointInPoly(G.centroid(r.f.P), big.P) || r.f === big); }
    const score = scoreRooms(rooms.map((r) => ({ P: r.f.P, area: r.f.a })), ctx.labels);
    if (light) return { score, n: rooms.length };
    const out = [];
    for (const r of rooms) {
      let P = G.simplifyDP(r.f.P, o.simplify, true); P = G.cleanPoly(P, 2, 15); P = regularize(P, dom); P = G.cleanPoly(P, 0.5, 10); P = G.ensureCCW(P);
      if (o.bumps !== false) P = removeBumps(P);
      if (P.length < 3) continue;
      out.push({ pts: P, area: Math.abs(G.area(P)), net: r.net, thick: r.thick, holes: r.f.holes.map((h) => G.ensureCCW(h.P)), raw: r.f.P });
    }
    name(out, texts, ctx.labels);
    const openings = attachOpenings(out, br, ctx, roles);
    return { rooms: out, openings, dom, wallSegs: wall, bridges: br, score };
  }

  function scoreRooms(rooms, labels) {
    let s = 0; const hits = new Map();
    for (const L of labels) {
      const r = rooms.find((x) => G.pointInPoly(L, x.P)); if (!r) continue;
      hits.set(r, (hits.get(r) || 0) + 1);
      const a = r.area / 1e6, hi = Math.max(L.SS || 0, L.S || 0, L.SU || 0), lo = L.SH || hi;
      const ref = hi || lo; if (!ref) continue;
      if (a >= Math.min(lo, hi || lo) * 0.95 && a <= Math.max(hi, lo) * 1.06) s += 1;
      else if (Math.abs(a - ref) / ref < 0.25) s += 0.3;
    }
    hits.forEach((n) => { if (n > 1) s -= 0.25 * (n - 1); });
    return s;
  }

  function name(rooms, texts) {
    rooms.forEach((r) => {
      const inside = texts.filter((t) => G.pointInPoly(t, r.pts));
      const areas = [], names = [];
      inside.forEach((t) => {
        const m = t.s.match(AREA_RE);
        if (m && /m|S/i.test(t.s)) areas.push({ kind: (m[1] || '').toUpperCase().replace(/[.\s]/g, ''), v: parseFloat(m[2].replace(',', '.')), t });
        else if (/[A-Za-zÀ-ÿ]{2,}/.test(t.s) && !BAD_NAME.test(t.s) && t.s.length <= 28 && !/\d{3}/.test(t.s)) names.push(t);
      });
      areas.sort((a, b) => b.v - a.v);
      const ss = areas.find((a) => a.kind === 'SS') || areas.find((a) => a.kind === 'S' || a.kind === '') || areas.find((a) => a.kind === 'SH');
      r.areaLabel = ss ? ss.v : null; r.areaKind = ss ? ss.kind || 'S' : null; r.areaSH = (areas.find((a) => a.kind === 'SH') || {}).v || null;
      let nm = null;
      if (ss) nm = names.filter((n) => n.y > ss.t.y && n.y - ss.t.y < 5 * ss.t.h && Math.abs(n.x - ss.t.x) < 3000).sort((a, b) => a.y - b.y)[0];
      if (!nm) nm = names.sort((a, b) => b.h - a.h)[0];
      r.name = nm ? nm.s.replace(/\s+/g, ' ') : null;
    });
  }

  const bezPt = (c, t) => { const u = 1 - t; return { x: u * u * u * c.p0.x + 3 * u * u * t * c.c1.x + 3 * u * t * t * c.c2.x + t * t * t * c.p3.x, y: u * u * u * c.p0.y + 3 * u * u * t * c.c1.y + 3 * u * t * t * c.c2.y + t * t * t * c.p3.y }; };

  /* arcs d'ouverture : centre = gonds, rayon = largeur du vantail */
  const circum = (A, B, C) => { const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y)); if (Math.abs(d) < 1e-9) return null; const a2 = A.x * A.x + A.y * A.y, b2 = B.x * B.x + B.y * B.y, c2 = C.x * C.x + C.y * C.y; return { x: (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d, y: (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d }; };

  /* arcs d'ouverture : centre de l'arc = gonds, rayon = largeur du vantail, validé par le trait du vantail */
  function findHinges(op, curves, leafSegs) {
    const w = op.w, d = op.d, n = G.perp(d); const ts = op.faces.flatMap((f) => [G.dot(f.a, d), G.dot(f.b, d)]); const t0 = Math.min(...ts), t1 = Math.max(...ts); const cand = [];
    const leaf = (H, tips, r) => !leafSegs || leafSegs.some((s) => { const e1 = Math.max(80, 0.11 * r), e2 = 0.16 * r; for (const [p, q] of [[s.a, s.b], [s.b, s.a]]) if (G.dist(p, H) < e1 && tips.some((t) => G.dist(q, t) < e2)) return true; return false; });
    for (const c of curves) {
      const M = c.m || bezPt(c, 0.5); if (G.dist(M, op.m) > 1.6 * w) continue;
      const H = circum(c.p0, M, c.p3); if (!H) continue;
      const r = G.dist(H, c.p0); if (r < 0.3 * w || r > 1.35 * w) continue;
      const err = Math.abs(G.dist(H, c.p3) - r) + Math.abs(G.dist(H, M) - r); if (err > 0.12 * r) continue;
      const along = G.dot(H, d); if (Math.min(Math.abs(along - t0), Math.abs(along - t1)) > 0.15 * w + 60) continue;
      if (Math.abs(G.dot(G.sub(H, op.m), n)) > 520) continue;
      if (Math.abs(G.dot(G.sub(M, H), n)) < 0.12 * r) continue;
      if (!leaf(H, [c.p0, c.p3], r)) continue;
      cand.push({ H, r, M, err, along });
    }
    cand.sort((x, y) => x.err - y.err); const out = [];
    for (const c of cand) if (!out.some((o) => Math.abs(o.along - c.along) < 0.3 * w)) out.push(c);
    return out;
  }

  /* vantail coulissant : trait parallèle à l'ouverture, juste devant */
  function slidingLeaf(op, W, roles) {
    const d = op.d, n = G.perp(d), w = op.w, t0 = Math.min(...op.faces.flatMap((f) => [G.dot(f.a, d), G.dot(f.b, d)])), t1 = t0 + w;
    for (const s of W.segs) {
      const r = roles[s.st]; if (r === 'masque' || r === 'cote') continue;
      const sd = G.sub(s.b, s.a), l = G.len(sd); if (l < 0.6 * w || l > 1.5 * w) continue;
      if (Math.abs(G.cross(G.mul(sd, 1 / l), d)) > 0.02) continue;
      const off = Math.abs(G.dot(G.sub(G.lerp(s.a, s.b, 0.5), op.m), n)); if (off > 320 || off < 20) continue;
      const u0 = Math.min(G.dot(s.a, d), G.dot(s.b, d)), u1 = Math.max(G.dot(s.a, d), G.dot(s.b, d));
      const ov = Math.min(u1, t1) - Math.max(u0, t0); if (ov > 0.2 * w && ov < 0.97 * l) return true;
    }
    return false;
  }

  function attachOpenings(final, br, ctx, roles) {
    const W = ctx ? ctx.W : null; const curves = W ? W.curves || [] : [];
    const ops = [];
    br.forEach((b) => {
      const d = G.norm(G.sub(b.b, b.a)), l = G.dist(b.a, b.b), m = G.lerp(b.a, b.b, 0.5);
      let grp = ops.find((o2) => Math.abs(G.cross(o2.d, d)) < 0.02 && Math.abs(G.cross(G.sub(m, o2.m), o2.d)) < 650 && Math.abs(G.dot(G.sub(m, o2.m), o2.d)) < 0.5 * Math.max(l, o2.w));
      if (!grp) ops.push((grp = { d, m, w: l, faces: [] }));
      grp.faces.push(b);
    });
    const openings = ops.map((o2) => ({ faces: o2.faces, d: o2.d, w: o2.faces.reduce((s, f) => s + G.dist(f.a, f.b), 0) / o2.faces.length, m: G.mul(o2.faces.reduce((s, f) => G.add(s, G.lerp(f.a, f.b, 0.5)), { x: 0, y: 0 }), 1 / o2.faces.length) }));
    final.forEach((r) => { r.openings = []; });
    // 1. candidats : face d'ouverture sur un mur de pièce (ou dans son embrasure, jusqu'à 45 cm derrière)
    const cands = [];
    openings.forEach((op, oi) => {
      final.forEach((r, ri) => {
        const n = r.pts.length; let best = null;
        for (const f of op.faces) {
          const fm = G.lerp(f.a, f.b, 0.5), fd = G.norm(G.sub(f.b, f.a)), fl = G.dist(f.a, f.b);
          for (let i = 0; i < n; i++) {
            const a = r.pts[i], b = r.pts[(i + 1) % n], ed = G.sub(b, a), el = G.len(ed); if (el < 100) continue;
            const eu = G.mul(ed, 1 / el); if (Math.abs(G.cross(fd, eu)) > 0.03) continue;
            const off = G.dot(G.sub(fm, a), G.perp(eu)); if (off > 40 || off < -450) continue;
            const ua = G.dot(G.sub(f.a, a), eu), ub = G.dot(G.sub(f.b, a), eu);
            const p0 = Math.max(0, Math.min(ua, ub)), p1 = Math.min(el, Math.max(ua, ub));
            if (p1 - p0 < 0.6 * fl) continue;
            if (!best || Math.abs(off) < best.off) best = { oi, ri, wall: i, pos: p0, width: p1 - p0, off: Math.abs(off), fm, nin: G.perp(eu), a, eu };
          }
        }
        if (best) cands.push(best);
      });
    });
    // 2. une seule ouverture par pièce et par emplacement (la face la plus proche du mur l'emporte)
    cands.sort((x, y) => x.off - y.off);
    const kept = [];
    for (const c of cands) {
      const span = (x) => { const p0 = G.add(x.a, G.mul(x.eu, x.pos)), p1 = G.add(x.a, G.mul(x.eu, x.pos + x.width)); return [p0, p1]; };
      const [c0, c1] = span(c), cd = x => G.dot(x, c.eu);
      if (kept.some((k) => { if (k.ri !== c.ri || Math.abs(G.dot(k.eu, c.eu)) < 0.999) return false; const [k0, k1] = span(k); if (Math.abs(G.dot(G.sub(k0, c0), c.nin)) > 460) return false; const ov = Math.min(Math.max(cd(k0), cd(k1)), Math.max(cd(c0), cd(c1))) - Math.max(Math.min(cd(k0), cd(k1)), Math.min(cd(c0), cd(c1))); return ov > 0.5 * Math.min(k.width, c.width); })) continue;
      kept.push(c);
    }
    openings.forEach((op, oi) => { op.rooms = kept.filter((k) => k.oi === oi).sort((x, y) => x.off - y.off).slice(0, 2); });
    const exterior = (h) => {
      for (const dd of [900, 1500]) { const p = G.add(h.fm, G.mul(h.nin, -dd)); if (final.some((r) => G.pointInPoly(p, r.pts) || G.distPointPoly(p, r.pts) < 550)) return false; }
      return true;
    };
    const hasArcs = curves.length >= 2; let leafSegs = null;
    openings.forEach((op, oi) => {
      const hs = op.rooms; if (!hs.length) return;
      const two = hs.length >= 2; const ext = !two && exterior(hs[0]);
      let type, hinges = [];
      if (ext) type = op.w >= 1800 ? 'baie' : 'fenetre';
      else {
        if (!leafSegs) { const bb = G.bbox(final.flatMap((r) => r.pts)); leafSegs = W.segs.filter((sg) => roles[sg.st] !== 'masque' && roles[sg.st] !== 'cote' && G.dist(sg.a, sg.b) > 200 && G.dist(sg.a, sg.b) < 1500 && sg.a.x > bb.x0 - 2000 && sg.a.x < bb.x1 + 2000 && sg.a.y > bb.y0 - 2000 && sg.a.y < bb.y1 + 2000); }
        hinges = curves.length ? findHinges(op, curves, leafSegs) : [];
        if (hinges.length >= 2 && Math.abs(hinges[0].along - hinges[1].along) > 0.6 * op.w && hinges.every((h) => h.r < 0.75 * op.w)) type = 'porte2';
        else if (hinges.length) type = 'porte';
        else if (op.w <= 1300 && W && slidingLeaf(op, W, roles)) type = 'coulissante';
        else if (two && hs.every((h) => h.off <= 40)) type = hasArcs ? 'passage' : 'porte';
        else return; // trou dans une cloison sans porte ni passage : ignoré
      }
      op.type = type;
      const H = hinges[0];
      let prim = hs[0], out = false;
      if (H) {
        const into = hs.find((h) => G.dot(G.sub(H.M, H.H), h.nin) > 0);
        if (into) prim = into; else out = true;
      }
      hs.forEach((h) => {
        const other = two ? hs.find((x) => x.ri !== h.ri) : null;
        let hinge = 'g';
        if (H && h === prim) { const t = G.dot(G.sub(H.H, h.a), h.eu); hinge = t < h.pos + h.width / 2 ? 'g' : 'd'; }
        final[h.ri].openings.push({ type, wall: h.wall, pos: Math.round(h.pos), width: Math.round(h.width), toIdx: other ? other.ri : null, op: oi, prim: h === prim, hinge, out: h === prim ? out : false });
      });
    });
    return openings;
  }

  /* choix automatique des calques de murs : sélection gloutonne guidée par les surfaces écrites sur le plan */
  function autoRoles(ctx, o, onProgress) {
    const st = ctx.an.styles;
    const base = st.map((s) => (s.role === 'mur' ? 'cand' : s.role));
    const cands = st.filter((s) => base[s.i] === 'cand').sort((a, b) => b.paired - a.paired);
    const mk = (set) => st.map((s) => (set.has(s.i) ? 'mur' : base[s.i] === 'cand' ? 'autre' : base[s.i]));
    if (!cands.length) return { roles: mk(new Set()), score: 0, tried: 0 };
    if (!ctx.labels.length) { const sel = new Set([cands[0].i]); cands.forEach((c) => { if (c.kind !== 'S' && c.pairRatio > 0.8) sel.add(c.i); }); return { roles: mk(sel), score: 0, tried: 0 }; }
    let tried = 0, b0 = null;
    for (const c of cands.slice(0, 8)) { const sc = buildRooms(ctx, mk(new Set([c.i])), o, true).score; tried++; if (onProgress) onProgress(tried); if (!b0 || sc > b0.sc + 0.01) b0 = { i: c.i, sc }; }
    const sel = new Set([b0.i]); let cur = b0.sc;
    for (let round = 0; round < 4; round++) {
      let best = null;
      for (const c of cands) {
        if (sel.has(c.i)) continue; const s2 = new Set(sel); s2.add(c.i);
        const sc = buildRooms(ctx, mk(s2), o, true).score; tried++;
        if (onProgress) onProgress(tried);
        if (!best || sc > best.sc) best = { i: c.i, sc };
      }
      if (best && best.sc > cur + 0.05) { sel.add(best.i); cur = best.sc; } else break;
    }
    return { roles: mk(sel), score: cur, tried };
  }

  function detect(raw, k, opts = {}) {
    const o = Object.assign({ tol: 4, minGap: 450, maxGap: 1400, minArea: 0.8e6, minThick: 450, simplify: 25 }, opts);
    const ctx = prepare(raw, k, o);
    let roles = o.roles, auto = null;
    if (!roles) { auto = autoRoles(ctx, o, o.onProgress); roles = auto.roles; }
    const res = buildRooms(ctx, roles, o, false);
    const stairs = detectStairs(ctx.W, ctx.texts, roles, ctx.an);
    let zones = [];
    try { zones = detectLowCeiling(ctx, res.rooms); } catch (e) { zones = []; }
    return Object.assign(res, { stairs, zones, texts: ctx.texts, styles: ctx.an.styles, roles, W: ctx.W, labels: ctx.labels, auto, cotes: ctx.cotes });
  }

  /* ---------- zones sous 1,80 m (lignes « 1 m 80 » des combles) ---------- */
  function detectLowCeiling(ctx, rooms) {
    const { W, texts } = ctx;
    const mark = texts.filter((t) => /^1\s*m\s*8\s*0$|^1[,.]80\s*m?$|^h\s*=?\s*1[,.]80/i.test(t.s.trim()));
    if (!mark.length) return [];
    const pd = texts.map((t) => t.s.match(/PIED[\s-]*DROIT.*?(\d)\s*m\s*(\d)\s*(\d)/i)).find(Boolean);
    const hmin = pd ? +(pd[1] + pd[2] + pd[3]) : null;
    // lignes candidates : segments courts colinéaires (tirets) regroupés
    const cand = W.segs.filter((s) => { const l = G.dist(s.a, s.b); return l > 20 && l < 2500; });
    const groups = [];
    for (const s of cand) {
      const d = G.norm(G.sub(s.b, s.a)); const nrm = G.perp(d); const off = G.dot(s.a, nrm); const t0 = G.dot(s.a, d), t1 = G.dot(s.b, d);
      let g = groups.find((x) => Math.abs(Math.abs(G.dot(x.d, d)) - 1) < 1e-4 && Math.abs(x.off - (G.dot(x.d, d) > 0 ? off : -off)) < 15 && x.st === s.st);
      const sg = g && G.dot(g.d, d) < 0 ? -1 : 1;
      if (!g) groups.push((g = { d, nrm, off, st: s.st, iv: [] }));
      g.iv.push([Math.min(t0 * sg, t1 * sg), Math.max(t0 * sg, t1 * sg)]);
    }
    const lines = [];
    for (const g of groups) {
      if (g.iv.length < 4) continue; const iv = G.mergeIntervals(g.iv, 650);
      for (const v of iv) { if (v[1] - v[0] < 2500) continue; const a = G.add(G.mul(g.d, v[0]), G.mul(g.nrm, g.off)), b = G.add(G.mul(g.d, v[1]), G.mul(g.nrm, g.off));
        const near = mark.some((t) => { const td = { x: Math.cos(t.rot), y: Math.sin(t.rot) }; return Math.abs(G.cross(td, g.d)) < 0.1 && G.distPointSeg(t, a, b) < Math.max(250, 2.2 * t.h); });
        const dashed = g.iv.length >= 6 && g.iv.reduce((s, x) => s + (x[1] - x[0]), 0) < 0.85 * (v[1] - v[0]);
        if (near && dashed) lines.push({ a, b, d: g.d, nrm: g.nrm, st: g.st }); }
    }
    const zones = [];
    for (const r of rooms) {
      const A = Math.abs(G.area(r.pts));
      for (const L of lines) {
        const pr = r.pts.map((p) => G.dot(p, L.d)); const r0 = Math.min(...pr), rr1 = Math.max(...pr); const ta = Math.min(G.dot(L.a, L.d), G.dot(L.b, L.d)), tb = Math.max(G.dot(L.a, L.d), G.dot(L.b, L.d));
        if (Math.min(rr1, tb) - Math.max(r0, ta) < 0.6 * (rr1 - r0)) continue;
        const r1 = G.clipHalf(r.pts, L.a, L.nrm, 0), r2 = G.clipHalf(r.pts, L.a, G.mul(L.nrm, -1), 0);
        if (r1.length < 3 || r2.length < 3) continue; const a1 = Math.abs(G.area(r1)), a2 = Math.abs(G.area(r2));
        if (a1 < 0.05e6 || a2 < 0.05e6) continue;
        const small = a1 < a2 ? r1 : r2; if (Math.abs(G.area(small)) > 0.5 * A) continue;
        zones.push({ pts: G.ensureCCW(G.cleanPoly(small, 0.5, 2)), hmax: 180, hmin, name: 'Sous 1,80 m' });
      }
    }
    return zones;
  }

  /* ---------- escaliers ---------- */
  function detectStairs(W, texts, roles, an) {
    const nums = texts.filter((t) => /^\d{1,2}$/.test(t.s)).map((t) => ({ ...t, v: +t.s }));
    const out = []; const usedT = new Set();
    if (nums.length) {
      const hMed = nums.map((t) => t.h).sort((a, b) => a - b)[Math.floor(nums.length / 2)];
      for (const s1 of nums.filter((t) => t.v === 1)) {
        if (usedT.has(s1)) continue;
        const chain = [s1]; let cur = s1;
        for (;;) { const nx = nums.filter((t) => t.v === cur.v + 1 && !usedT.has(t) && G.dist(t, cur) < 700 && t.h < hMed * 1.6).sort((a, b) => G.dist(a, cur) - G.dist(b, cur))[0]; if (!nx) break; chain.push(nx); cur = nx; }
        if (chain.length < 6) continue;
        chain.forEach((t) => usedT.add(t));
        out.push(stairZone(W, roles, chain.map((t) => ({ x: t.x, y: t.y })), { steps: chain.length, first: chain[0], last: chain[chain.length - 1] }));
      }
    }
    // marqueurs de sens
    for (const st of out) {
      const near = texts.filter((t) => G.pointInPoly(t, st.pts) || G.distPointPoly(t, st.pts) < 800);
      if (near.some((t) => /mont|^m$|up|↑/i.test(t.s))) st.mark = 'monte';
      else if (near.some((t) => /desc|^d$|dn|down|↓/i.test(t.s))) st.mark = 'descend';
    }
    return out.filter(Boolean);
  }

  function stairZone(W, roles, walk, meta) {
    const bb = G.bbox(walk); const pad = 1300;
    const inBox = (p) => p.x > bb.x0 - pad && p.x < bb.x1 + pad && p.y > bb.y0 - pad && p.y < bb.y1 + pad;
    // segments qui croisent la ligne de foulée (marches)
    const segs = W.segs.filter((s) => roles[s.st] !== 'masque' && inBox(s.a) && inBox(s.b) && G.dist(s.a, s.b) < 3000);
    const walkSegs = []; for (let i = 0; i + 1 < walk.length; i++) walkSegs.push([walk[i], walk[i + 1]]);
    const treads = segs.filter((s) => walkSegs.some(([a, b]) => { const r = G.segInter(s.a, s.b, a, b); return r && r.t >= 0 && r.t <= 1 && r.u >= -0.2 && r.u <= 1.2; }));
    // style dominant des marches puis composante connexe
    const cnt = {}; treads.forEach((s) => { cnt[s.st] = (cnt[s.st] || 0) + 1; });
    const st = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    let comp = treads.filter((s) => s.st === st);
    const pool = segs.filter((s) => s.st === st);
    const inComp = new Set(comp);
    let grew = true, guard = 0;
    while (grew && guard++ < 20) {
      grew = false;
      for (const s of pool) {
        if (inComp.has(s)) continue;
        if (comp.some((c) => Math.min(G.distPointSeg(s.a, c.a, c.b), G.distPointSeg(s.b, c.a, c.b), G.distPointSeg(c.a, s.a, s.b), G.distPointSeg(c.b, s.a, s.b)) < 8)) { comp.push(s); inComp.add(s); grew = true; }
      }
    }
    const ptsAll = comp.flatMap((s) => [s.a, s.b]).concat(walk);
    const dom = dominantAngle(comp.length ? comp : W.segs);
    const loc = ptsAll.map((p) => G.rot(p, -dom)); const b2 = G.bbox(loc);
    const pts = G.rect(b2.x0, b2.y0, b2.w, b2.h).map((p) => G.rot(p, dom));
    return { pts, steps: meta.steps, first: meta.first, last: meta.last, treads: treads.length };
  }

  PL.vec = { removeBumps, prepare, buildRooms, autoRoles, Grid, parseNum, detectScale, findCotes, toWorld, textToWorld, dominantAngle, analyzeStyles, detect, faces, buildGraph, splitSegments, bridges, regularize, lum };
})();
