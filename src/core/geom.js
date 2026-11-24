/* Calepin — géométrie de base. Unités : mm, repère y vers le haut, polygones CCW. */
(function () {
  const PL = (globalThis.PL = globalThis.PL || {});
  const G = {};
  const EPS = 1e-9;
  G.EPS = EPS;
  G.v = (x, y) => ({ x, y });
  G.add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  G.sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  G.mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  G.dot = (a, b) => a.x * b.x + a.y * b.y;
  G.cross = (a, b) => a.x * b.y - a.y * b.x;
  G.len = (a) => Math.hypot(a.x, a.y);
  G.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  G.norm = (a) => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; };
  G.lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  G.rot = (p, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; };
  G.rotAround = (p, o, ang) => G.add(o, G.rot(G.sub(p, o), ang));
  G.perp = (a) => ({ x: -a.y, y: a.x });
  G.normAng = (a) => { while (a <= -Math.PI) a += 2 * Math.PI; while (a > Math.PI) a -= 2 * Math.PI; return a; };
  G.deg = (r) => (r * 180) / Math.PI;
  G.rad = (d) => (d * Math.PI) / 180;
  G.clone = (pts) => pts.map((p) => ({ x: p.x, y: p.y }));

  G.area = (P) => { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += a.x * b.y - b.x * a.y; } return s / 2; };
  G.perimeter = (P) => { let s = 0; for (let i = 0; i < P.length; i++) s += G.dist(P[i], P[(i + 1) % P.length]); return s; };
  G.centroid = (P) => {
    const A = G.area(P); if (Math.abs(A) < EPS) { let x = 0, y = 0; P.forEach((p) => { x += p.x; y += p.y; }); return { x: x / P.length, y: y / P.length }; }
    let cx = 0, cy = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n], f = a.x * b.y - b.x * a.y; cx += (a.x + b.x) * f; cy += (a.y + b.y) * f; }
    return { x: cx / (6 * A), y: cy / (6 * A) };
  };
  G.bbox = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
  G.ensureCCW = (P) => (G.area(P) < 0 ? P.slice().reverse() : P);

  G.pointInPoly = (p, P) => {
    let inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  G.distPointSeg = (p, a, b) => { const d = G.sub(b, a), l2 = G.dot(d, d); let t = l2 ? G.dot(G.sub(p, a), d) / l2 : 0; t = Math.max(0, Math.min(1, t)); return G.dist(p, { x: a.x + d.x * t, y: a.y + d.y * t }); };
  G.projSeg = (p, a, b) => { const d = G.sub(b, a), l2 = G.dot(d, d); let t = l2 ? G.dot(G.sub(p, a), d) / l2 : 0; const tc = Math.max(0, Math.min(1, t)); return { t, tc, p: { x: a.x + d.x * tc, y: a.y + d.y * tc } }; };
  G.distPointPoly = (p, P) => { let m = Infinity; for (let i = 0; i < P.length; i++) m = Math.min(m, G.distPointSeg(p, P[i], P[(i + 1) % P.length])); return m; };

  /* intersection de segments [a,b] et [c,d] : renvoie {t,u,p} ou null */
  G.segInter = (a, b, c, d) => {
    const r = G.sub(b, a), s = G.sub(d, c), den = G.cross(r, s);
    if (Math.abs(den) < EPS) return null;
    const qp = G.sub(c, a), t = G.cross(qp, s) / den, u = G.cross(qp, r) / den;
    return { t, u, p: { x: a.x + r.x * t, y: a.y + r.y * t } };
  };
  /* intersection de droites p1+d1*t, p2+d2*u */
  G.lineInter = (p1, d1, p2, d2) => { const den = G.cross(d1, d2); if (Math.abs(den) < 1e-12) return null; const t = G.cross(G.sub(p2, p1), d2) / den; return { x: p1.x + d1.x * t, y: p1.y + d1.y * t }; };

  /* décalage d'un polygone CCW : d>0 vers l'intérieur */
  G.offset = (P, d) => {
    const n = P.length; if (n < 3 || !d) return G.clone(P);
    const lines = [];
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n], dir = G.norm(G.sub(b, a)), nrm = G.perp(dir);
      lines.push({ p: G.add(a, G.mul(nrm, d)), d: dir });
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const L0 = lines[(i - 1 + n) % n], L1 = lines[i];
      const q = Math.abs(G.cross(L0.d, L1.d)) < 1e-6 ? L1.p : G.lineInter(L0.p, L0.d, L1.p, L1.d);
      out.push(q || L1.p);
    }
    return out;
  };

  /* Douglas–Peucker */
  G.simplifyDP = (pts, tol, closed) => {
    if (pts.length < 3) return pts.slice();
    const rec = (arr, i0, i1, keep) => {
      let md = -1, mi = -1; const a = arr[i0], b = arr[i1];
      for (let i = i0 + 1; i < i1; i++) { const d = G.distPointSeg(arr[i], a, b); if (d > md) { md = d; mi = i; } }
      if (md > tol) { keep[mi] = 1; rec(arr, i0, mi, keep); rec(arr, mi, i1, keep); }
    };
    if (!closed) { const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; rec(pts, 0, pts.length - 1, keep); return pts.filter((_, i) => keep[i]); }
    // fermé : partir des deux points les plus éloignés
    let far = 0, fd = -1; for (let i = 1; i < pts.length; i++) { const d = G.dist(pts[0], pts[i]); if (d > fd) { fd = d; far = i; } }
    const arr = pts.concat([pts[0]]); const keep = new Uint8Array(arr.length); keep[0] = keep[far] = keep[arr.length - 1] = 1;
    rec(arr, 0, far, keep); rec(arr, far, arr.length - 1, keep);
    return arr.slice(0, -1).filter((_, i) => keep[i]);
  };

  /* retire points doublons et colinéaires */
  G.cleanPoly = (P, angTolDeg = 0.5, distTol = 1) => {
    let pts = P.slice(); let changed = true; const tol = G.rad(angTolDeg);
    while (changed && pts.length > 3) {
      changed = false;
      for (let i = 0; i < pts.length && pts.length > 3; i++) {
        const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
        if (G.dist(a, b) < distTol) { pts.splice(i, 1); changed = true; break; }
        const t = Math.abs(G.normAng(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x)));
        if (t < tol || G.distPointSeg(b, a, c) < distTol * 0.5) { pts.splice(i, 1); changed = true; break; }
      }
    }
    return pts;
  };

  /* intervalles [x0,x1] d'un ensemble d'anneaux (pair-impair) coupé à la hauteur y */
  G.intervalsAtY = (rings, y) => {
    const xs = [];
    for (const R of rings) for (let i = 0, n = R.length; i < n; i++) {
      const a = R[i], b = R[(i + 1) % n];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q); const out = [];
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-6) out.push([xs[i], xs[i + 1]]);
    return out;
  };
  G.mergeIntervals = (list, gap = 0) => {
    const s = list.filter((iv) => iv[1] > iv[0]).sort((a, b) => a[0] - b[0]); const out = [];
    for (const iv of s) { if (out.length && iv[0] <= out[out.length - 1][1] + gap) out[out.length - 1][1] = Math.max(out[out.length - 1][1], iv[1]); else out.push(iv.slice()); }
    return out;
  };
  G.subtractIntervals = (A, B) => {
    let res = A.map((a) => a.slice());
    for (const b of B) { const nx = []; for (const a of res) { if (b[1] <= a[0] || b[0] >= a[1]) { nx.push(a); continue; } if (b[0] > a[0]) nx.push([a[0], b[0]]); if (b[1] < a[1]) nx.push([b[1], a[1]]); } res = nx; }
    return res.filter((a) => a[1] - a[0] > 1e-6);
  };
  G.isSelfIntersecting = (P) => {
    const n = P.length;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const r = G.segInter(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n]);
      if (r && r.t > 1e-6 && r.t < 1 - 1e-6 && r.u > 1e-6 && r.u < 1 - 1e-6) return true;
    }
    return false;
  };
  G.regular = (n, r, c = { x: 0, y: 0 }, a0 = 0) => Array.from({ length: n }, (_, i) => ({ x: c.x + r * Math.cos(a0 + (2 * Math.PI * i) / n), y: c.y + r * Math.sin(a0 + (2 * Math.PI * i) / n) }));
  G.rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

  /* découpe d'un polygone par un demi-plan : garde dot(p - o, n) >= off */
  G.clipHalf = (P, o, n, off = 0) => {
    const out = [], f = (p) => (p.x - o.x) * n.x + (p.y - o.y) * n.y - off;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
    }
    return out;
  };
  /* aire d'intersection approximative de deux polygones (échantillonnage) */
  G.overlapArea = (A, B, step = 50) => {
    const bb = G.bbox(A), bb2 = G.bbox(B); const x0 = Math.max(bb.x0, bb2.x0), x1 = Math.min(bb.x1, bb2.x1), y0 = Math.max(bb.y0, bb2.y0), y1 = Math.min(bb.y1, bb2.y1);
    if (x1 <= x0 || y1 <= y0) return 0; let s = 0;
    for (let y = y0 + step / 2; y < y1; y += step) { const ia = G.intervalsAtY([A], y), ib = G.intervalsAtY([B], y); for (const a of ia) for (const b of ib) { const l = Math.min(a[1], b[1]) - Math.max(a[0], b[0]); if (l > 0) s += l * step; } }
    return s;
  };

  PL.geom = G;
})();
