/* Calepin — visite 3D à hauteur d'yeux : rendu papier / encre, contours nets, ombres et volumes en tramage. */
(function () {
  const PL = globalThis.PL, G = PL.geom, OR = PL.ortho, App = globalThis.App, S = App.state;
  const V = (App.fps = {});
  const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const EYE = 1620, RAD = 220, WALK = 1350, SLAB = 200;
  let T = null, st = null;

  const load = () => (globalThis.THREE ? Promise.resolve(globalThis.THREE) : new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = SRC; s.async = true;
    s.onload = () => (globalThis.THREE ? res(globalThis.THREE) : rej(new Error('three'))); s.onerror = () => rej(new Error('three'));
    document.head.appendChild(s);
  }));

  /* ---------- petite fabrique de géométrie (mm du plan → m, y vers le haut) ---------- */
  /* le plan a son axe y vers le haut de l'écran : dans la scène (y en haut, z vers soi), z = −y */
  let ZO = 0; // machine posée sur un support : tout son modèle est remonté de la hauteur de l'étage
  const P3 = (p, h) => [p.x / 1000, (h + ZO) / 1000, -p.y / 1000];
  const H3 = (v, k = 1) => [k * v.x, 0, -k * v.y];
  const mk = () => ({ p: [], n: [], c: [], uv: [] });
  const tri = (B, a, b, c, hint, col, uv) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; if (uv) uv = [uv[0], uv[2], uv[1]]; }
    B.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let k = 0; k < 3; k++) { B.n.push(nx, ny, nz); if (col) B.c.push(col[0], col[1], col[2]); }
    if (uv) B.uv.push(uv[0][0], uv[0][1], uv[1][0], uv[1][1], uv[2][0], uv[2][1]);
  };
  const quad = (B, a, b, c, d, hint, col) => { tri(B, a, b, c, hint, col); tri(B, a, c, d, hint, col); };
  const ln = (a, b) => st.L.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const fill = (B, outer, holes, hAt, hint, col, uvf) => {
    const V2 = (p) => new T.Vector2(p.x, p.y); const all = outer.concat(...holes);
    let f; try { f = T.ShapeUtils.triangulateShape(outer.map(V2), holes.map((h) => h.map(V2))); } catch (e) { return; }
    for (const [i, j, k] of f) { const q = [all[i], all[j], all[k]]; if (q.some((x) => !x)) continue; tri(B, P3(q[0], hAt(q[0])), P3(q[1], hAt(q[1])), P3(q[2], hAt(q[2])), hint, col, uvf ? q.map(uvf) : null); }
  };
  const outward = (poly, a, b) => { const d = G.norm(G.sub(b, a)); let o = { x: d.y, y: -d.x }; if (G.pointInPoly(G.add(G.lerp(a, b, 0.5), G.mul(o, 2)), poly)) o = G.mul(o, -1); return o; };
  /* prisme vertical : côtés, dessus (et dessous s'il décolle du sol), arêtes */
  const prism = (B, poly, y0, y1, col, smooth) => {
    const n = poly.length; if (n < 3 || y1 - y0 < 1) return;
    for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; if (G.dist(a, b) < 0.5) continue; const o = outward(poly, a, b); quad(B, P3(a, y0), P3(b, y0), P3(b, y1), P3(a, y1), H3(o), col); }
    fill(B, poly, [], () => y1, [0, 1, 0], col); if (y0 > 5) fill(B, poly, [], () => y0, [0, -1, 0], col);
    for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; ln(P3(a, y1), P3(b, y1)); ln(P3(a, y0), P3(b, y0)); if (!smooth) ln(P3(a, y0), P3(a, y1)); }
    if (smooth) for (const k of [0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4)]) ln(P3(poly[k % n], y0), P3(poly[k % n], y1));
  };
  /* demi-plan (Sutherland–Hodgman) : garde le côté dot(p − o, nr) ≥ 0 */
  const clip = (poly, o, nr) => { const out = []; const side = (p) => G.dot(G.sub(p, o), nr); for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b); if (sa >= 0) out.push(a); if ((sa >= 0) !== (sb >= 0)) out.push(G.lerp(a, b, sa / (sa - sb))); } return out; };
  /* intersection pièce ∩ zone (faux plafond à cheval sur plusieurs pièces ou débordant dans les murs) */
  const inter = (pts, zp) => {
    const Z = G.area(zp) < 0 ? zp.slice().reverse() : zp;
    if (!Z.some((p) => G.pointInPoly(p, pts)) && !pts.some((p) => G.pointInPoly(p, Z)) && !G.pointInPoly(G.centroid(Z), pts)) return [];
    const fr = OR.frame(OR.angleOf(pts)); const A = OR.square(pts.map(fr.to)), C = OR.square(Z.map(fr.to));
    if (A && C) {
      const xs = OR.coords(A.concat(C).map((p) => p.x)), ys = OR.coords(A.concat(C).map((p) => p.y));
      return OR.trace(xs, ys, (x, y) => G.pointInPoly({ x, y }, A) && G.pointInPoly({ x, y }, C)).filter((l) => G.area(l) > 1e4).map((l) => l.map(fr.from));
    }
    const R = G.area(pts) < 0 ? pts.slice().reverse() : pts;
    const convex = (P) => P.every((p, i) => G.cross(G.sub(P[(i + 1) % P.length], p), G.sub(P[(i + 2) % P.length], P[(i + 1) % P.length])) >= -1e-6);
    const cut = (P, K) => { let o = P; for (let i = 0; i < K.length && o.length >= 3; i++) { const a = K[i], b = K[(i + 1) % K.length], d = G.sub(b, a); o = clip(o, a, { x: -d.y, y: d.x }); } return o.length >= 3 && Math.abs(G.area(o)) > 1e4 ? [o] : []; };
    if (convex(R)) return cut(Z, R);
    if (convex(Z)) return cut(R, Z);
    return G.pointInPoly(G.centroid(Z), pts) ? [Z] : [];
  };
  /* une pièce moins des trous (trémies) : par cases d'équerre si possible */
  const minus = (pts, cuts) => {
    cuts = cuts.filter((c) => c.some((p) => G.pointInPoly(p, pts)) || pts.some((p) => G.pointInPoly(p, c)) || G.pointInPoly(G.centroid(c), pts));
    if (!cuts.length) return [{ outer: pts, holes: [] }];
    const fr = OR.frame(OR.angleOf(pts)); const A = OR.square(pts.map(fr.to)), Cs = cuts.map((c) => OR.square(c.map(fr.to)));
    if (A && Cs.every(Boolean)) {
      const xs = OR.coords(A.concat(...Cs).map((p) => p.x)), ys = OR.coords(A.concat(...Cs).map((p) => p.y));
      const loops = OR.trace(xs, ys, (x, y) => G.pointInPoly({ x, y }, A) && !Cs.some((c) => G.pointInPoly({ x, y }, c)));
      const outs = loops.filter((l) => G.area(l) > 0), hs = loops.filter((l) => G.area(l) < 0);
      if (outs.length) return outs.map((o) => ({ outer: o.map(fr.from), holes: hs.filter((h) => G.pointInPoly(G.centroid(h), o)).map((h) => h.map(fr.from)) }));
    }
    return [{ outer: pts, holes: cuts.filter((c) => c.every((p) => G.pointInPoly(p, pts))) }];
  };
  const uniq = (vals, lo, hi) => { const s = vals.map((v) => Math.max(lo, Math.min(hi, v))).sort((a, b) => a - b); const o = []; for (const v of s) if (!o.length || v - o[o.length - 1] > 0.5) o.push(v); return o; };

  /* ---------- mobilier : hauteurs et volumes simples ---------- */
  const HGT = { chevet: 500, pax50: 2360, pax100: 2360, pax150: 2360, pax200: 2360, dressingL: 2360, commode3: 780, commode6: 780, hemnes8: 1310, kallax2: 770, kallax4: 1470, billy: 2020, besta: 420,
    caisson: 600, piano: 1250, pianon: 900, meublebas: 900, colonne: 2200, frigo: 1800, lv: 850, ilot: 900, vasque: 850, lavelinge: 850, angle: 420, douche90: 50, douche120: 50, baignoire: 560 };
  const frameOf = (P) => { const o = P[0], U = G.norm(G.sub(P[1], P[0])), Vv = G.norm(G.sub(P[3], P[0])); return { at: (u, v) => G.add(G.add(o, G.mul(U, u)), G.mul(Vv, v)), w: G.dist(P[0], P[1]), d: G.dist(P[0], P[3]), U, V: Vv }; };
  /* plaque verticale : contour dans le plan (u, z) du meuble, épaisseur de v0 à v1 (miroirs ronds, cadres) */
  const slab = (B, f, face, v0, v1, col, smooth) => {
    const n = face.length; if (n < 3) return; const W = (q, v) => P3(f.at(q[0], v), q[1]);
    const cu = face.reduce((a, q) => a + q[0], 0) / n, cz = face.reduce((a, q) => a + q[1], 0) / n;
    for (let i = 0; i < n; i++) { const a = face[i], b = face[(i + 1) % n]; let nu = b[1] - a[1], nz = -(b[0] - a[0]); if (nu * ((a[0] + b[0]) / 2 - cu) + nz * ((a[1] + b[1]) / 2 - cz) < 0) { nu = -nu; nz = -nz; } quad(B, W(a, v0), W(b, v0), W(b, v1), W(a, v1), [f.U.x * nu, nz, -f.U.y * nu], col); }
    let tr = []; try { tr = T.ShapeUtils.triangulateShape(face.map((q) => new T.Vector2(q[0], q[1])), []); } catch (e) { tr = []; }
    for (const [i, j, k] of tr) { tri(B, W(face[i], v0), W(face[j], v0), W(face[k], v0), H3(f.V, -1), col); tri(B, W(face[i], v1), W(face[j], v1), W(face[k], v1), H3(f.V), col); }
    for (let i = 0; i < n; i++) { const a = face[i], b = face[(i + 1) % n]; ln(W(a, v0), W(b, v0)); ln(W(a, v1), W(b, v1)); if (!smooth) ln(W(a, v0), W(a, v1)); }
    if (smooth) for (const k of [0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4)]) ln(W(face[k % n], v0), W(face[k % n], v1));
  };
  const sub = (f, u0, u1, v0, v1) => [f.at(u0, v0), f.at(u1, v0), f.at(u1, v1), f.at(u0, v1)];
  const ellipse = (f, n = 28, cu = f.w / 2, cv = f.d / 2, ru = f.w / 2, rv = f.d / 2) => { const o = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; o.push(f.at(cu + Math.cos(a) * ru, cv + Math.sin(a) * rv)); } return o; };
  /* canapés : assise, dossier le long du dos (côté 3 pour un droit, les deux côtés extérieurs pour un angle), accoudoirs aux bouts */
  App.sofaParts = (s) => {
    const id = s.lib || '', P = s.pts; if (!/^canape|^fauteuil$|^angle$/.test(id)) return null;
    if (P.length === 4) {
      const f = frameOf(P), w = f.w, d = f.d, ar = Math.min(170, w * 0.2), bk = Math.min(220, d * 0.25);
      return { seat: sub(f, ar, w - ar, 0, d - bk), back: [sub(f, 0, w, d - bk, d)], arms: [sub(f, 0, ar, 0, d - bk), sub(f, w - ar, w, 0, d - bk)] };
    }
    if (P.length !== 6 || id !== 'angle') return null;
    const sg = Math.sign(G.area(P)); let k = -1;
    for (let i = 0; i < 6; i++) { const a = P[(i + 5) % 6], b = P[i], c = P[(i + 1) % 6]; if (Math.sign(G.cross(G.sub(b, a), G.sub(c, b))) === -sg) { k = i; break; } }
    if (k < 0) return null;
    const O = P[(k + 3) % 6], A = P[(k + 4) % 6], Bp = P[(k + 5) % 6], C = P[(k + 2) % 6], D = P[(k + 1) % 6];
    const U = G.norm(G.sub(A, O)), Vv = G.norm(G.sub(C, O)), w1 = G.dist(A, O), w2 = G.dist(C, O), t1 = G.dist(Bp, A), t2 = G.dist(D, C);
    const at = (u, v) => G.add(G.add(O, G.mul(U, u)), G.mul(Vv, v)), R = (u0, u1, v0, v1) => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
    const bk = Math.min(220, Math.min(t1, t2) * 0.25), ar = Math.min(170, Math.min(w1, w2) * 0.12);
    // méridienne : la branche la plus courte se termine sans accoudoir (les deux en ont un si les branches sont égales)
    const eq = Math.abs(w1 - w2) < 0.05 * Math.max(w1, w2), a1 = eq || w1 > w2 ? ar : 0, a2 = eq || w2 > w1 ? ar : 0;
    const arms = []; if (a1) arms.push(R(w1 - a1, w1, bk, t1)); if (a2) arms.push(R(bk, t2, w2 - a2, w2));
    return { seat: [at(bk, bk), at(w1 - a1, bk), at(w1 - a1, t1), at(t2, t1), at(t2, w2 - a2), at(bk, w2 - a2)], back: [R(0, w1, 0, bk), R(0, bk, bk, w2)], arms };
  };
  const legs = (B, f, y, s, ins, col) => { for (const [u, v] of [[ins, ins], [f.w - ins - s, ins], [f.w - ins - s, f.d - ins - s], [ins, f.d - ins - s]]) prism(B, sub(f, u, u + s, v, v + s), 0, y, col); };
  const furniture = (B, s, Hc, col) => {
    const id = s.lib || '', P = s.pts;
    if (s.kind === 'poteau') return prism(B, s.round && P.length === 4 ? ellipse(frameOf(P)) : P, 0, s.h ? Math.min(Hc, s.h * 10) : Hc, col, s.round);
    if (s.kind === 'exclusion') { if (id === 'tremie') return; if (id === 'poele') { const f = P.length === 4 ? frameOf(P) : null; prism(B, P, 0, 1100, col); if (f) prism(B, ellipse(f, 16, f.w / 2, f.d / 2, 90, 90), 1100, Hc, col, true); return; } return prism(B, P, 0, Hc, col); }
    if (s.kind === 'forme') return prism(B, P, 0, s.h ? s.h * 10 : 900, col);
    const sp = App.sofaParts(s);
    if (sp) { prism(B, sp.seat, 0, 430, col); for (const q of sp.back) prism(B, q, 0, 820, col); for (const q of sp.arms) prism(B, q, 0, 620, col); return; }
    if (P.length !== 4) return prism(B, P, 0, HGT[id] || 800, col);
    const f = frameOf(P), w = f.w, d = f.d;
    const M = PL.furnModel && PL.furnModel(id, w, d, s); // meubles modélisés (bibliothèque)
    if (M) { for (const q of M.solids) prism(B, q.pts.map(([u, v]) => f.at(u, v)), q.z0, q.z1, col, q.round); for (const q of M.slabs || []) slab(q.mat === 'mirror' && BM ? BM : B, f, q.face, q.v0, q.v1, q.mat === 'mirror' && BM ? [0.9, 0.9, 0.9] : col, q.round); for (const [a, b] of M.lines) ln(P3(f.at(a[0], a[1]), a[2]), P3(f.at(b[0], b[1]), b[2])); return; }
    if (/^lit/.test(id) && id !== 'litbebe') { prism(B, sub(f, 0, w, 0, d), 0, 280, col); prism(B, sub(f, 25, w - 25, 25, d - 70), 280, 480, col); prism(B, sub(f, 0, w, d - 60, d), 280, 950, col); return; }
    if (id === 'litbebe') { prism(B, sub(f, 0, w, 0, d), 0, 900, col); return; }
    if (id === 'tableronde') { prism(B, ellipse(f), 720, 750, col, true); prism(B, sub(f, w / 2 - 45, w / 2 + 45, d / 2 - 45, d / 2 + 45), 0, 720, col); return; }
    if (/^(table|bureau)/.test(id)) { prism(B, sub(f, 0, w, 0, d), 720, 750, col); legs(B, f, 720, 50, 35, col); return; }
    if (id === 'basse') { prism(B, sub(f, 0, w, 0, d), 360, 400, col); legs(B, f, 360, 40, 25, col); return; }
    if (id === 'chaise') { prism(B, sub(f, 0, w, 0, d), 430, 460, col); legs(B, f, 430, 30, 15, col); prism(B, sub(f, 0, w, d - 35, d), 460, 880, col); return; }
    if (id === 'fauteuilbur') { prism(B, ellipse(f, 20, w / 2, d / 2, w * 0.38, d * 0.38), 440, 500, col, true); prism(B, sub(f, w / 2 - 30, w / 2 + 30, d / 2 - 30, d / 2 + 30), 0, 440, col); prism(B, sub(f, w * 0.18, w * 0.82, d - 70, d - 20), 500, 1050, col); return; }
    if (id === 'wc') { prism(B, sub(f, w * 0.12, w * 0.88, 0, d - 120), 0, 400, col); prism(B, sub(f, 0, w, d - 120, d), 0, 1100, col); return; }
    if (id === 'baignoire') { prism(B, sub(f, 0, w, 0, d), 0, 560, col); const q = sub(f, 70, w - 70, 70, d - 70); for (let i = 0; i < 4; i++) ln(P3(q[i], 560), P3(q[(i + 1) % 4], 560)); return; }
    if (/^douche/.test(id)) { prism(B, sub(f, 0, w, 0, d), 0, 50, col); for (const k of [0, 1]) ln(P3(f.at(0, k ? d : 0), 50), P3(f.at(0, k ? d : 0), 2000)); ln(P3(f.at(0, 0), 2000), P3(f.at(0, d), 2000)); return; }
    if (['meublebas', 'lv', 'ilot', 'vasque', 'lavelinge', 'colonne', 'frigo'].includes(id)) { prism(B, sub(f, 0, w, 50, d), 0, 100, col); prism(B, sub(f, 0, w, 0, d), 100, HGT[id], col); return; }
    prism(B, sub(f, 0, w, 0, d), 0, HGT[id] || 800, col);
  };

  /* ---------- escalier : marches découpées case par case, contremarches, limons en escalier ---------- */
  const stairModel = (s, Hf) => {
    const lay = App.stairs.layout(s); if (!lay) return null;
    const tr = App.stairs.treads(s, lay); const n = tr.n, L = lay.L, fr = lay.fr, cells = lay.cells; if (L < 100) return null;
    const pointAt = (t) => { for (const g of lay.segs) if (t <= g.t0 + g.l + 1e-6) { const u = g.l ? (t - g.t0) / g.l : 0; return { p: G.lerp(g.a, g.b, u), d: G.norm(G.sub(g.b, g.a)) }; } const g = lay.segs[lay.segs.length - 1]; return { p: g.b, d: G.norm(G.sub(g.b, g.a)) }; };
    const corner = (c) => lay.corners.find((q) => q.cell === c);
    const inCell = (c, p, e) => p.x >= c.x0 - e && p.x <= c.x1 + e && p.y >= c.y0 - e && p.y <= c.y1 + e;
    const rng = []; let t0 = 0;
    cells.forEach((c, k) => {
      if (k === cells.length - 1) { rng.push([t0, L]); return; }
      let t = t0 + 1; while (t < L && inCell(c, pointAt(t).p, -0.3)) t += 15; let lo = Math.max(t0, t - 15), hi = Math.min(t, L);
      for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (inCell(c, pointAt(m).p, -0.01)) lo = m; else hi = m; }
      rng.push([t0, hi]); t0 = hi;
    });
    const lineAt = (c, t) => { const { p, d } = pointAt(t); const q = corner(c); if (q && G.dist(p, q.inner) > 1) { const u = G.norm(G.sub(p, q.inner)); let nr = { x: -u.y, y: u.x }; if (G.dot(nr, d) < 0) nr = G.mul(nr, -1); return { o: q.inner, n: nr }; } return { o: p, n: d }; };
    const cellAt = (t) => { let k = rng.findIndex(([a, b]) => t >= a - 0.01 && t < b - 0.01); if (k < 0) k = cells.length - 1; return k; };
    const segIn = (c, o, dir) => { let s0 = -1e9, s1 = 1e9; for (const [p, q] of [[-dir.x, o.x - c.x0], [dir.x, c.x1 - o.x], [-dir.y, o.y - c.y0], [dir.y, c.y1 - o.y]]) { if (Math.abs(p) < 1e-12) { if (q < -0.01) return null; } else { const r = q / p; if (p < 0) s0 = Math.max(s0, r); else s1 = Math.min(s1, r); } } return s1 - s0 > 1 ? [G.add(o, G.mul(dir, s0)), G.add(o, G.mul(dir, s1))] : null; };
    const down = s.stair && s.stair.dir === 'descend', base = down ? -Hf : 0, rise = Hf / (n + 1), step = L / n, top = (k) => base + (k + 1) * rise;
    const pieces = [], risers = [];
    for (let k = 0; k < n; k++) {
      const tA = k * step, tB = (k + 1) * step;
      cells.forEach((c, ci) => {
        const [c0, c1] = rng[ci]; if (tB <= c0 + 0.5 || tA >= c1 - 0.5) return;
        let poly = OR.rect(c.x0, c.y0, c.x1, c.y1);
        if (tA > c0 + 0.5) { const l = lineAt(c, tA); poly = clip(poly, l.o, l.n); }
        if (tB < c1 - 0.5) { const l = lineAt(c, tB); poly = clip(poly, l.o, G.mul(l.n, -1)); }
        if (poly.length >= 3 && Math.abs(G.area(poly)) > 200) pieces.push({ k, poly: poly.map(fr.from) });
      });
      const ci = cellAt(tA), l = lineAt(cells[ci], tA), sg = segIn(cells[ci], l.o, { x: -l.n.y, y: l.n.x });
      if (sg) risers.push({ k, a: fr.from(sg[0]), b: fr.from(sg[1]), back: fr.from(G.mul(l.n, -1)) });
    }
    const tOf = (pw) => {
      const p = fr.to(pw); const ci = cells.findIndex((c) => inCell(c, p, 1)); if (ci < 0) return null; const c = cells[ci], [c0, c1] = rng[ci];
      const f = (t) => { const l = lineAt(c, t); return G.dot(G.sub(p, l.o), l.n); };
      if (f(c0) <= 0) return c0; if (f(c1) >= 0) return c1; let lo = c0, hi = c1;
      for (let it = 0; it < 28; it++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; } return (lo + hi) / 2;
    };
    const kOf = (p) => { const t = tOf(p); return t == null ? null : Math.max(0, Math.min(n - 1, Math.floor(t / step))); };
    return { s, n, rise, base, top, pieces, risers, kOf, down, Hf };
  };

  const buildStair = (B, m, Hc, rooms) => {
    const { s, pieces, risers, top, base, down, Hf } = m, P = s.pts, COL = st.col.stair;
    for (const pc of pieces) fill(B, pc.poly, [], () => top(pc.k), [0, 1, 0], COL);
    for (const r of risers) { const y0 = base + r.k * m.rise, y1 = top(r.k); quad(B, P3(r.a, y0), P3(r.b, y0), P3(r.b, y1), P3(r.a, y1), H3(r.back), COL); ln(P3(r.a, y1), P3(r.b, y1)); ln(P3(r.a, y0), P3(r.b, y0)); }
    // côtés : découpés aux extrémités des marches
    const ends = risers.flatMap((r) => [r.a, r.b]);
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], el = G.dist(a, b); if (el < 1) continue; const d = G.norm(G.sub(b, a)); const o = outward(P, a, b);
      const us = uniq([0, el, ...ends.filter((e) => G.distPointSeg(e, a, b) < 3).map((e) => G.dot(G.sub(e, a), d))], 0, el);
      const ks = [];
      for (let j = 0; j < us.length - 1; j++) { const mid = G.sub(G.add(a, G.mul(d, (us[j] + us[j + 1]) / 2)), G.mul(o, 4)); ks.push(m.kOf(mid)); }
      for (let j = 0; j < us.length - 1; j++) {
        const k = ks[j]; if (k == null) continue; const pa = G.add(a, G.mul(d, us[j])), pb = G.add(a, G.mul(d, us[j + 1])), h = top(k);
        if (down) quad(B, P3(pa, base), P3(pb, base), P3(pb, 0), P3(pa, 0), H3(o, -1), st.col.wall);
        else quad(B, P3(pa, 0), P3(pb, 0), P3(pb, h), P3(pa, h), H3(o), COL);
        ln(P3(pa, h), P3(pb, h));
        const hn = j + 1 < ks.length && ks[j + 1] != null ? top(ks[j + 1]) : 0; ln(P3(pb, h), P3(pb, hn));
        if (j === 0) ln(P3(pa, 0), P3(pa, h));
      }
      if (!down) ln(P3(a, 0), P3(b, 0));
      // trémie : puits au-dessus (monte) ou garde-corps (descend)
      if (!down) { quad(B, P3(a, Hc), P3(b, Hc), P3(b, Hf + 2500), P3(a, Hf + 2500), H3(o, -1), st.col.wall); ln(P3(a, Hf), P3(b, Hf)); ln(P3(a, Hc), P3(a, Hf + 2500)); }
      else { ln(P3(a, base), P3(b, base)); ln(P3(a, base), P3(a, 0)); }
    }
    // garde-corps de la trémie, sur les bords qui ne longent pas un mur
    if (down) {
      const gd = App.stairs.guard(s), H = gd.h;
      for (const e of App.stairs.openEdges(s)) {
        const a = e.a, b = e.b, el = G.dist(a, b), d = G.norm(G.sub(b, a)), o = outward(P, a, b), ins = G.mul(o, -1);
        if (gd.type === 'plein') { const q = [a, b, G.add(b, G.mul(ins, gd.th)), G.add(a, G.mul(ins, gd.th))]; prism(B, q, -SLAB, H, st.col.wall); }
        else if (gd.type === 'vitre') { const nb = Math.max(1, Math.ceil(el / 1100)); for (const y of [H, H - 40, 100]) ln(P3(a, y), P3(b, y)); for (let j = 0; j <= nb; j++) { const q = G.lerp(a, b, j / nb); ln(P3(q, 0), P3(q, H)); } const t = G.mul(ins, 25); for (let j = 0; j < nb; j++) { const q0 = G.add(G.lerp(a, b, j / nb), t), q1 = G.add(G.lerp(a, b, (j + 1) / nb), t); ln(P3(G.lerp(q0, q1, 0.12), 180), P3(G.lerp(q0, q1, 0.32), H - 120)); } }
        else if (gd.type === 'ajoure') { ln(P3(a, H), P3(b, H)); ln(P3(a, H - 40), P3(b, H - 40)); ln(P3(a, 80), P3(b, 80)); const nb = Math.max(1, Math.round(el / 120)); for (let j = 0; j <= nb; j++) { const q = G.lerp(a, b, j / nb); ln(P3(q, j === 0 || j === nb ? 0 : 80), P3(q, H)); } }
        if (gd.type !== 'aucun') st.rail.push([a, b]);
      }
    }
    if (!down) fill(B, P, [], () => Hf + 2500, [0, -1, 0], st.col.ceil);
    else fill(B, P, [], () => base, [0, 1, 0], st.col.floor);
  };

  /* ---------- plafonds rampants (zones « sous 1,80 m ») ---------- */
  const slopesOf = (room, Hc) => App.feat.zonesIn(room).filter((z) => !z.drop).map((z) => {
    const n = z.pts.length; let best = null;
    for (let i = 0; i < n; i++) { const a = z.pts[i], b = z.pts[(i + 1) % n], l = G.dist(a, b); if (G.distPointPoly(G.lerp(a, b, 0.5), room.pts) < 80 && (!best || l > best.l)) best = { a, b, l }; }
    if (!best) return null;
    const d = G.norm(G.sub(best.b, best.a)); let nin = { x: -d.y, y: d.x }; if (!G.pointInPoly(G.add(G.lerp(best.a, best.b, 0.5), G.mul(nin, 30)), z.pts)) nin = G.mul(nin, -1);
    const D = Math.max(...z.pts.map((p) => G.dot(G.sub(p, best.a), nin))), h0 = (z.hmin ?? 140) * 10, h1 = (z.hmax ?? 180) * 10; if (D < 50 || h1 <= h0 || h0 >= Hc) return null;
    const k = (h1 - h0) / D, D2 = (Hc - h0) / k; const ss = z.pts.map((p) => G.dot(G.sub(p, best.a), d)); const s0 = Math.min(...ss), s1 = Math.max(...ss);
    let poly = clip(room.pts, best.a, nin); poly = clip(poly, G.add(best.a, G.mul(nin, D2)), G.mul(nin, -1)); poly = clip(poly, G.add(best.a, G.mul(d, s0)), d); poly = clip(poly, G.add(best.a, G.mul(d, s1)), G.mul(d, -1));
    if (poly.length < 3 || Math.abs(G.area(poly)) < 1e4) return null;
    const hAt = (p) => h0 + k * Math.max(0, Math.min(D2, G.dot(G.sub(p, best.a), nin)));
    const inside = (p) => { const u = G.dot(G.sub(p, best.a), d), v = G.dot(G.sub(p, best.a), nin); return u >= s0 && u <= s1 && v >= -50 && v <= D2; };
    return { poly, hAt, inside };
  }).filter(Boolean);

  /* ---------- scène de l'étage ---------- */
  const opInfo = (r, o, Hc, nin) => {
    if (o.type === 'velux') return null; // dans le rampant, pas dans le mur
    const g = App.ops.geo(r, o); if (!g) return null; const lib = PL.lib.openings.find((x) => x.id === o.type) || {};
    const win = ['fenetre', 'fixe', 'velux', 'sautdeloup'].includes(o.type);
    const floorLevel = App.ops.DOORS.includes(o.type) || ['passage', 'porte-fenetre', 'baie'].includes(o.type); // une porte part du sol, même si elle était une fenêtre avant
    const sill = floorLevel ? 0 : Math.max(0, Math.min(Hc - 100, o.sill ?? lib.sill ?? 0)), top = Math.max(sill + 100, Math.min(Hc, sill + (o.h || lib.h || 2040)));
    const tw = App.ops.twin(r, o), tg = tw && App.ops.geo(tw.room, tw.o);
    const depth = tg ? Math.abs(G.dot(G.sub(tg.p0, g.p0), nin)) : 300;
    return { o, g, lib, sill, top, u0: g.pos, u1: g.pos + g.w, win, tw, tg, depth, pass: !win && !!tg && o.type !== 'fixe' };
  };

  const buildOpening = (B, r, I, W, nin) => {
    const { o, g, sill, top, depth, tw, lib } = I, out = G.mul(nin, -1), p0 = g.p0, p1 = g.p1, WALL = st.col.wall;
    ln(P3(p0, sill), P3(p0, top)); ln(P3(p1, sill), P3(p1, top)); if (top < App.feat.ceiling(r) * 10 - 1) ln(P3(p0, top), P3(p1, top)); if (sill > 0) ln(P3(p0, sill), P3(p1, sill));
    const mine = !tw || String(o.oid) < String(tw.o.oid);
    if (mine && depth > 5) {
      const q0 = G.add(p0, G.mul(out, depth)), q1 = G.add(p1, G.mul(out, depth));
      quad(B, P3(p0, sill), P3(q0, sill), P3(q0, top), P3(p0, top), H3(W.d), WALL);
      quad(B, P3(p1, sill), P3(q1, sill), P3(q1, top), P3(p1, top), H3(W.d, -1), WALL);
      quad(B, P3(p0, top), P3(p1, top), P3(q1, top), P3(q0, top), [0, -1, 0], WALL);
      quad(B, P3(p0, sill), P3(p1, sill), P3(q1, sill), P3(q0, sill), [0, 1, 0], sill > 0 ? WALL : st.col.sill);
      for (const h of sill > 0 ? [sill, top] : [top]) { ln(P3(p0, h), P3(q0, h)); ln(P3(p1, h), P3(q1, h)); }
      if (!tw) { ln(P3(q0, sill), P3(q0, top)); ln(P3(q1, sill), P3(q1, top)); ln(P3(q0, top), P3(q1, top)); if (sill > 0) ln(P3(q0, sill), P3(q1, sill)); }
      // dormant et montants de la fenêtre
      if (!tw && (I.win || o.type === 'porte-fenetre' || o.type === 'baie')) {
        const k = Math.max(10, Math.min(depth * 0.55, depth - 30)), f0 = G.add(p0, G.mul(out, k)), f1 = G.add(p1, G.mul(out, k)), e = 45;
        const ins = (p, q) => G.add(p, G.mul(G.norm(G.sub(q, p)), e)); const g0 = ins(f0, f1), g1 = ins(f1, f0);
        const rect = (a, b, y0, y1) => { ln(P3(a, y0), P3(b, y0)); ln(P3(a, y1), P3(b, y1)); ln(P3(a, y0), P3(a, y1)); ln(P3(b, y0), P3(b, y1)); };
        rect(g0, g1, sill + e, top - e);
        const leaves = o.type === 'fixe' ? 1 : App.ops.leaves(o); for (let j = 1; j < leaves; j++) { const q = G.lerp(g0, g1, j / leaves); ln(P3(q, sill + e), P3(q, top - e)); }
      }
    }
    // saut de loup : puits de lumière en béton devant la fenêtre, dehors (fond en caillebotis, 3 parois)
    if (o.type === 'sautdeloup' && !tw) {
      const e = depth > 5 ? depth : 0, dw = o.well || lib.well || 500, sx = 100, zb = Math.max(0, sill - 160), zt = top + 320;
      const a0 = G.add(G.add(p0, G.mul(out, e)), G.mul(W.d, -sx)), a1 = G.add(G.add(p1, G.mul(out, e)), G.mul(W.d, sx)), b0 = G.add(a0, G.mul(out, dw)), b1 = G.add(a1, G.mul(out, dw));
      quad(B, P3(a0, zb), P3(a1, zb), P3(b1, zb), P3(b0, zb), [0, 1, 0], st.col.sill);
      const CW = st.col.well || WALL; quad(B, P3(a0, zb), P3(b0, zb), P3(b0, zt), P3(a0, zt), H3(W.d), CW); quad(B, P3(a1, zb), P3(b1, zb), P3(b1, zt), P3(a1, zt), H3(W.d, -1), CW); quad(B, P3(b0, zb), P3(b1, zb), P3(b1, zt), P3(b0, zt), H3(nin), CW);
      for (let z = zb + 250; z < zt; z += 250) { ln(P3(G.add(b0, G.mul(nin, 2)), z), P3(G.add(b1, G.mul(nin, 2)), z)); ln(P3(a0, z), P3(b0, z)); ln(P3(a1, z), P3(b1, z)); } // joints de coffrage
      for (const [p, q] of [[a0, b0], [a1, b1], [b0, b1]]) { ln(P3(p, zb), P3(q, zb)); ln(P3(p, zt), P3(q, zt)); } ln(P3(b0, zb), P3(b0, zt)); ln(P3(b1, zb), P3(b1, zt));
      for (let k = 1; k < 8; k++) { const t = k / 8; ln(P3(G.lerp(a0, a1, t), zb + 2), P3(G.lerp(b0, b1, t), zb + 2)); }
    }
    // vantaux (accent) : battants ouverts, coulissants tirés
    if (o.sw !== 0 && ['porte', 'porte2', 'porte-fenetre'].includes(o.type)) {
      const side = o.out ? -1 : 1; const leaves = App.ops.leaves(o) === 1 && o.type !== 'porte2' ? [[o.hinge === 'd' ? p1 : p0, g.w, o.hinge === 'd' ? -1 : 1]] : [[p0, g.w / 2, 1], [p1, g.w / 2, -1]];
      for (const [h, lw, sg] of leaves) {
        const cd = G.mul(g.d, sg), od = G.mul(g.nin, side), // même convention que le plan
 a = 1.38, dir = G.add(G.mul(cd, Math.cos(a)), G.mul(od, Math.sin(a))), pr = G.sub(G.mul(cd, Math.sin(a)), G.mul(od, Math.cos(a)));
        const h0 = G.add(h, G.mul(od, 10)), poly = [h0, G.add(h0, G.mul(dir, lw - 20)), G.add(G.add(h0, G.mul(dir, lw - 20)), G.mul(pr, 40)), G.add(h0, G.mul(pr, 40))];
        prism(B, poly, 8, top - 8, PH ? hexLin('#efede8') : st.col.acc); st.leaves.push([h0, G.add(h0, G.mul(dir, lw - 20))]);
      }
    } else if (o.sw !== 0 && o.type === 'coulissante') {
      const side = o.out ? -1 : 1, from = o.hinge === 'd' ? p1 : p0, to = o.hinge === 'd' ? p0 : p1, off = G.mul(g.nin, side * 30), back = G.sub(from, to);
      const a = G.add(from, off), b = G.add(G.add(from, back), off), poly = [a, b, G.add(b, G.mul(g.nin, side * 35)), G.add(a, G.mul(g.nin, side * 35))];
      prism(B, poly, 8, top - 8, PH ? hexLin('#efede8') : st.col.acc);
    }
  };

  const floorTexture = (fid, rooms, bb, cal) => {
    const W = bb.x1 - bb.x0, H = bb.y1 - bb.y0, k = Math.min(2048 / W, 2048 / H, 0.5); const cw = Math.max(16, Math.ceil(W * k)), ch = Math.max(16, Math.ceil(H * k));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d');
    const tp = (p) => [(p.x - bb.x0) * k, (p.y - bb.y0) * k];
    const path = (pts) => { x.beginPath(); pts.forEach((p, i) => { const [a, b] = tp(p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); };
    x.fillStyle = '#dedede'; x.fillRect(0, 0, cw, ch);
    for (const r of rooms) {
      x.save(); path(r.pts); x.clip();
      x.fillStyle = r.parquet === false ? '#e2e2e2' : '#dbdbdb'; x.fillRect(0, 0, cw, ch);
      const polys = cal && cal.results[r.id] ? (cal.polys = cal.polys || {}, cal.polys[r.id] = cal.polys[r.id] || PL.layout.boardPolys(cal.results[r.id])) : null;
      x.strokeStyle = '#8c8c8c'; x.lineWidth = Math.max(1, 3 * k * 2);
      if (polys && polys.length) for (const b of polys) { path(b.poly); x.stroke(); }
      else if (r.parquet === false) { // carrelage 60 × 60 aligné sur la pièce
        const th = OR.angleOf(r.pts), fr = OR.frame(th), q = r.pts.map(fr.to); const X0 = Math.min(...q.map((p) => p.x)), X1 = Math.max(...q.map((p) => p.x)), Y0 = Math.min(...q.map((p) => p.y)), Y1 = Math.max(...q.map((p) => p.y));
        x.beginPath(); for (let u = X0; u <= X1; u += 600) { const [a, b] = tp(fr.from({ x: u, y: Y0 })), [c2, d2] = tp(fr.from({ x: u, y: Y1 })); x.moveTo(a, b); x.lineTo(c2, d2); } for (let v = Y0; v <= Y1; v += 600) { const [a, b] = tp(fr.from({ x: X0, y: v })), [c2, d2] = tp(fr.from({ x: X1, y: v })); x.moveTo(a, b); x.lineTo(c2, d2); } x.stroke();
      }
      // ombre portée douce au pied des murs et autour des meubles (occlusion)
      x.save(); x.shadowColor = 'rgba(0,0,0,0.42)'; x.shadowBlur = 260 * k; x.shadowOffsetX = 20000; x.lineWidth = 120 * k; x.translate(-20000, 0); path(r.pts); x.strokeStyle = '#000'; x.stroke(); x.restore();
      x.restore();
    }
    x.save(); x.shadowColor = 'rgba(0,0,0,0.38)'; x.shadowBlur = 180 * k; x.shadowOffsetX = 20000; x.translate(-20000, 0); x.fillStyle = '#000';
    for (const s of App.shapesOn(fid)) if (['meuble', 'poteau', 'forme'].includes(s.kind) || (s.kind === 'exclusion' && s.lib !== 'tremie') || (s.kind === 'escalier' && !(s.stair && s.stair.dir === 'descend'))) { path(s.pts); x.fill(); }
    x.restore();
    const tex = new T.CanvasTexture(c); tex.flipY = false; tex.anisotropy = st.R.capabilities.getMaxAnisotropy ? st.R.capabilities.getMaxAnisotropy() : 1; tex.minFilter = T.LinearMipmapLinearFilter;
    return tex;
  };

  /* ---------- photo réaliste : couleurs (linéaires), parquet planche par planche ---------- */
  let PH = false, BM = null; // BM : verre des miroirs, à part en mode photo
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const hexLin = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [0.85, 0.85, 0.85]; const n = parseInt(m[1], 16); return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)]; };
  V.PAINT0 = '#f1eee8';
  const paintCol = (r) => hexLin((r.paint && r.paint.hex) || V.PAINT0);
  const furnCol = (s) => {
    const id = s.lib || '', it = PL.lib.furniture.find((x) => x.id === id) || {};
    if (s.kind !== 'meuble') return hexLin('#e6e3dd');
    if (id === 'persan') return hexLin('#7a2b23');
    if (/^(please|pied|jaspers)$/.test(id) || it.m === 'gear' || /^knarrevik/.test(id)) return hexLin('#2d2d30');
    if (/hemnes|noah|olderdalen|idanas|basseverre|piano|banquette/.test(id)) return hexLin('#c09a6e');
    if (/^lit|canape|lindakra|fauteuil|angle/.test(id)) return hexLin('#d8d2c8');
    return hexLin('#ecebe7');
  };
  const photoFloorCanvas = (fid, rooms, bb, cal) => {
    const MX = matchMedia('(pointer:coarse)').matches ? 2048 : 4096;
    const W = bb.x1 - bb.x0, H = bb.y1 - bb.y0, k = Math.min(MX / W, MX / H, 0.8); const cw = Math.max(16, Math.ceil(W * k)), ch = Math.max(16, Math.ceil(H * k));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d');
    const tp = (p) => [(p.x - bb.x0) * k, (p.y - bb.y0) * k];
    const path = (pts) => { x.beginPath(); pts.forEach((p, i) => { const [a, b] = tp(p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); };
    let seed = 1234567; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    x.fillStyle = '#8f8a82'; x.fillRect(0, 0, cw, ch);
    const plank = (P, ang) => { // planche de chêne : teinte propre, fil du bois, nœud de temps en temps, joint chanfreiné
      const l = 0.86 + rnd() * 0.24, wm = rnd() * 0.08; path(P); x.fillStyle = `rgb(${Math.round(196 * l)},${Math.round((160 - wm * 60) * l)},${Math.round((118 - wm * 80) * l)})`; x.fill();
      const cpx = P.reduce((a, p) => a + tp(p)[0], 0) / P.length, cpy = P.reduce((a, p) => a + tp(p)[1], 0) / P.length; let a0 = ang;
      if (a0 == null) { let best = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], L = G.dist(p, q); if (L > best) { best = L; a0 = Math.atan2(q.y - p.y, q.x - p.x); } } }
      const ext = Math.max(...P.map((p) => G.dist(p, P[0]))) * k + 4;
      x.save(); path(P); x.clip(); x.translate(cpx, cpy); x.rotate(a0 || 0);
      const n = 9 + Math.floor(rnd() * 6), wd = 230 * k;
      for (let j = 0; j < n; j++) { const y0 = -wd / 2 + (wd * (j + rnd())) / n, amp = (0.6 + rnd() * 2.2) * k * 6, fq = 0.002 + rnd() * 0.006, ph = rnd() * 6.28; x.beginPath(); for (let t = -ext; t <= ext; t += 6) { const yy = y0 + Math.sin(t * fq / k * 0.35 + ph) * amp; t === -ext ? x.moveTo(t, yy) : x.lineTo(t, yy); } x.strokeStyle = `rgba(${90 + Math.round(rnd() * 30)},${58 + Math.round(rnd() * 20)},${30},${0.06 + rnd() * 0.14})`; x.lineWidth = 0.5 + rnd() * 1.4; x.stroke(); }
      if (rnd() < 0.18) { const kx = (rnd() - 0.5) * ext, ky = (rnd() - 0.5) * wd * 0.5; x.beginPath(); x.ellipse(kx, ky, (6 + rnd() * 8) * k * 3, (3 + rnd() * 3) * k * 3, 0, 0, Math.PI * 2); x.fillStyle = 'rgba(85,52,25,0.45)'; x.fill(); }
      x.restore(); path(P); x.strokeStyle = 'rgba(70,45,25,0.6)'; x.lineWidth = Math.max(0.7, 1.6 * k * 2); x.stroke();
    };
    for (const r of rooms) {
      x.save(); path(r.pts); x.clip();
      if (r.parquet === false) { // carrelage 60 × 60, joints clairs
        x.fillStyle = '#d6d2ca'; x.fillRect(0, 0, cw, ch); const th = OR.angleOf(r.pts), fr = OR.frame(th), q = r.pts.map(fr.to); const X0 = Math.min(...q.map((p) => p.x)), X1 = Math.max(...q.map((p) => p.x)), Y0 = Math.min(...q.map((p) => p.y)), Y1 = Math.max(...q.map((p) => p.y));
        for (let u = X0; u < X1; u += 600) for (let v = Y0; v < Y1; v += 600) { const t = 0.94 + rnd() * 0.08; path([fr.from({ x: u, y: v }), fr.from({ x: u + 600, y: v }), fr.from({ x: u + 600, y: v + 600 }), fr.from({ x: u, y: v + 600 })]); x.fillStyle = `rgb(${Math.round(214 * t)},${Math.round(209 * t)},${Math.round(200 * t)})`; x.fill(); x.strokeStyle = '#bdb7ac'; x.lineWidth = Math.max(1, 3 * k); x.stroke(); }
      } else {
        const res = cal && cal.results[r.id], polys = res ? (cal.polys = cal.polys || {}, cal.polys[r.id] = cal.polys[r.id] || PL.layout.boardPolys(res)) : null;
        if (polys && polys.length) for (const b of polys) plank(b.poly, null);
        else { // pas encore calepiné : lames 1286 × 214 en coupe de pierre, dans le sens de la pièce
          const th = OR.angleOf(r.pts), fr = OR.frame(th), q = r.pts.map(fr.to); const X0 = Math.min(...q.map((p) => p.x)), X1 = Math.max(...q.map((p) => p.x)), Y0 = Math.min(...q.map((p) => p.y)), Y1 = Math.max(...q.map((p) => p.y));
          let row = 0; for (let v = Y0; v < Y1; v += 214, row++) { const off = ((row * 0.37) % 1) * 1286; for (let u = X0 - off; u < X1; u += 1286) plank([fr.from({ x: u, y: v }), fr.from({ x: u + 1286, y: v }), fr.from({ x: u + 1286, y: v + 214 }), fr.from({ x: u, y: v + 214 })], th); }
        }
      }
      x.save(); x.shadowColor = 'rgba(0,0,0,0.22)'; x.shadowBlur = 160 * k; x.shadowOffsetX = 20000; x.lineWidth = 90 * k; x.translate(-20000, 0); path(r.pts); x.strokeStyle = '#000'; x.stroke(); x.restore();
      x.restore();
    }
    x.save(); x.shadowColor = 'rgba(0,0,0,0.2)'; x.shadowBlur = 110 * k; x.shadowOffsetX = 20000; x.translate(-20000, 0); x.fillStyle = '#000';
    for (const s of App.shapesOn(fid)) if (['meuble', 'poteau', 'forme'].includes(s.kind) && !(App.stack && App.stack.under(s)) && !(s.lib && /^mir|nissedal|lindbyn|larbro/.test(s.lib))) { path(s.pts); x.fill(); }
    x.restore();
    return c;
  };

  const build = () => {
    const fid = st.fid, f = S.p.floors.find((x) => x.id === fid) || App.floor(); const rooms = App.rooms(fid), shapes = App.shapesOn(fid);
    const Hf = (f.ceiling || 250) * 10 + SLAB, Hc0 = (f.ceiling || 250) * 10;
    const B = mk(), FL = mk(), BF = PH ? mk() : B, OC = PH ? mk() : null; BM = PH ? mk() : null; st.L = []; st.segs = []; st.leaves = []; st.rail = []; st.doors = []; st.slopes = {};
    const all = shapes.flatMap((s) => s.pts || []); if (!all.length) return false;
    const bb = { x0: Math.min(...all.map((p) => p.x)) - 200, y0: Math.min(...all.map((p) => p.y)) - 200, x1: Math.max(...all.map((p) => p.x)) + 200, y1: Math.max(...all.map((p) => p.y)) + 200 };
    st.bb = bb; st.rooms = rooms; st.Hf = Hf;
    const stairs = shapes.filter((s) => s.kind === 'escalier').map((s) => stairModel(s, Hf)).filter(Boolean); st.stairs = stairs;
    const ups = stairs.filter((m) => !m.down).map((m) => m.s.pts), downs = stairs.filter((m) => m.down).map((m) => m.s.pts);
    const uvf = (p) => [(p.x - bb.x0) / (bb.x1 - bb.x0), (p.y - bb.y0) / (bb.y1 - bb.y0)];
    const fps0 = shapes.filter((z) => z.kind === 'plafond' && z.drop > 0);
    for (const r of rooms) {
      const Hc = App.feat.ceiling(r) * 10, n = r.pts.length, wc = PH ? paintCol(r) : st.col.wall;
      if (OC) { const big = G.offset(r.pts, G.area(r.pts) > 0 ? -260 : 260); if (big && big.length > 2) { prism(OC, big, Hc, Hc + 320, [0.5, 0.5, 0.5]); prism(OC, big, -320, -2, [0.5, 0.5, 0.5]); } }
      for (const part of minus(r.pts, downs)) fill(FL, part.outer, part.holes, () => 0, [0, 1, 0], null, uvf);
      for (const part of minus(r.pts, ups)) fill(B, part.outer, part.holes, () => Hc, [0, -1, 0], st.col.ceil);
      const sl = slopesOf(r, Hc); st.slopes[r.id] = sl;
      for (const z of sl) { fill(B, z.poly, [], z.hAt, [0, -1, 0], st.col.ceil); for (let i = 0; i < z.poly.length; i++) { const a = z.poly[i], b = z.poly[(i + 1) % z.poly.length]; ln(P3(a, z.hAt(a)), P3(b, z.hAt(b))); } }
      // faux plafonds : plafond abaissé de l'épaisseur, avec les côtés du coffrage là où il ne touche pas un mur
      for (const z of fps0.filter((x) => x.drop > 0)) for (const Z of inter(r.pts, z.pts)) {
        const h = Hc - z.drop * 10; if (h <= 300) continue;
        fill(B, Z, [], () => h, [0, -1, 0], st.col.fp);
        for (let i = 0; i < Z.length; i++) { const a = Z[i], b = Z[(i + 1) % Z.length]; ln(P3(a, h), P3(b, h)); if (G.distPointPoly(G.lerp(a, b, 0.5), r.pts) < 40) continue; const dd = G.norm(G.sub(b, a)), nout = { x: dd.y, y: -dd.x }; quad(B, P3(a, h), P3(b, h), P3(b, Hc), P3(a, Hc), H3(nout), wc); }
      }
      for (let i = 0; i < n; i++) {
        const W = App.ops.wall(r, i); if (W.el < 1) continue;
        let nin = W.nin; if (!G.pointInPoly(G.add(G.lerp(W.a, W.b, 0.5), G.mul(nin, 15)), r.pts)) nin = G.mul(nin, -1);
        const ops = (r.openings || []).filter((o) => o.wall === i).map((o) => opInfo(r, o, Hc, nin)).filter(Boolean);
        const us = uniq([0, W.el, ...ops.flatMap((o) => [o.u0, o.u1])], 0, W.el), vs = uniq([0, Hc, ...ops.flatMap((o) => [o.sill, o.top])], 0, Hc);
        for (let a = 0; a < us.length - 1; a++) for (let b = 0; b < vs.length - 1; b++) {
          const um = (us[a] + us[a + 1]) / 2, vm = (vs[b] + vs[b + 1]) / 2; if (ops.some((o) => um > o.u0 && um < o.u1 && vm > o.sill && vm < o.top)) continue;
          const pa = G.add(W.a, G.mul(W.d, us[a])), pb = G.add(W.a, G.mul(W.d, us[a + 1]));
          quad(B, P3(pa, vs[b]), P3(pb, vs[b]), P3(pb, vs[b + 1]), P3(pa, vs[b + 1]), H3(nin), wc);
        }
        ln(P3(W.a, 0), P3(W.b, 0)); if (!sl.length) ln(P3(W.a, Hc), P3(W.b, Hc));
        const Wp = App.ops.wall(r, (i - 1 + n) % n); if (Math.abs(G.cross(Wp.d, W.d)) > 0.1 || G.dot(Wp.d, W.d) < 0) ln(P3(W.a, 0), P3(W.a, sl.length ? Math.min(Hc, ...sl.filter((z) => z.inside(W.a)).map((z) => z.hAt(W.a))) : Hc));
        // obstacles : le mur moins les passages
        let cur = 0; const pass = ops.filter((o) => o.pass).sort((p, q) => p.u0 - q.u0);
        for (const o of pass) { if (o.u0 - cur > 1) st.segs.push([G.add(W.a, G.mul(W.d, cur)), G.add(W.a, G.mul(W.d, o.u0))]); cur = Math.max(cur, o.u1); const t0 = G.dist(o.tg.p0, o.g.p0) < G.dist(o.tg.p1, o.g.p0) ? o.tg.p0 : o.tg.p1, t1 = t0 === o.tg.p0 ? o.tg.p1 : o.tg.p0; st.segs.push([o.g.p0, t0], [o.g.p1, t1]); st.doors.push([o.g.p0, o.g.p1, t1, t0]); }
        if (W.el - cur > 1) st.segs.push([G.add(W.a, G.mul(W.d, cur)), W.b]);
        for (const I of ops) buildOpening(B, r, I, W, nin);
        for (const o of (r.openings || []).filter((x) => x.wall === i && x.type === 'velux')) {
          const g = App.ops.geo(r, o); if (!g) continue; const dv = (o.h || 980) * 0.72, s0 = 150;
          const hAt = (p) => Math.min(Hc, ...sl.filter((z) => z.inside(p)).map((z) => z.hAt(p))) - 6;
          const at = (p, k) => G.add(p, G.mul(nin, k)), ins = (a, b, e) => G.add(a, G.mul(G.norm(G.sub(b, a)), e));
          const q = [at(g.p0, s0), at(g.p1, s0), at(g.p1, s0 + dv), at(g.p0, s0 + dv)], c = G.centroid(q), qi = q.map((p) => ins(p, c, 70));
          for (const R of [q, qi]) for (let k = 0; k < 4; k++) ln(P3(R[k], hAt(R[k])), P3(R[(k + 1) % 4], hAt(R[(k + 1) % 4])));
        }
      }
    }
    for (const m of stairs) buildStair(B, m, Hc0, rooms);
    for (const s of shapes) if (['meuble', 'poteau', 'forme', 'exclusion'].includes(s.kind)) {
      const home = rooms.find((r) => G.pointInPoly(G.centroid(s.pts), r.pts)); ZO = App.stack ? App.stack.zOf(s) : 0; furniture(BF, s, home ? App.feat.ceiling(home) * 10 : Hc0, PH ? furnCol(s) : st.col.furn); ZO = 0;
      if (!(s.kind === 'exclusion' && s.lib === 'tremie') && !/^douche/.test(s.lib || '')) for (let i = 0; i < s.pts.length; i++) st.segs.push([s.pts[i], s.pts[(i + 1) % s.pts.length]]);
    }
    for (const m of stairs) for (let i = 0; i < m.s.pts.length; i++) st.segs.push([m.s.pts[i], m.s.pts[(i + 1) % m.s.pts.length]]);
    st.segs.push(...st.leaves);
    // dehors : un sol à perte de vue
    const lvl = f.level || 0, gy = lvl > 0 ? -lvl * Hf - 150 : -150, cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, E = 90000;
    quad(B, P3({ x: cx - E, y: cy - E }, gy), P3({ x: cx + E, y: cy - E }, gy), P3({ x: cx + E, y: cy + E }, gy), P3({ x: cx - E, y: cy + E }, gy), [0, 1, 0], PH ? hexLin('#6d7a58') : st.col.ground);
    // maillages
    const geo = (A, withUv) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(A.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(A.n, 3)); if (A.c.length) g.setAttribute('color', new T.Float32BufferAttribute(A.c, 3)); if (withUv) g.setAttribute('uv', new T.Float32BufferAttribute(A.uv, 2)); return g; };
    const matOpts = { specular: 0x000000, shininess: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: T.FrontSide, shadowSide: T.DoubleSide };
    if (PH) { st.phData = { shell: B, floor: FL, furn: BF, occ: OC, mirror: BM, fid, rooms, bb }; return true; } // photo : tampons bruts, chaque moteur fait ses maillages
    const main = new T.Mesh(geo(B), new T.MeshPhongMaterial(Object.assign({ vertexColors: true }, matOpts)));
    const tex = floorTexture(fid, rooms, bb, App.calepinage(fid));
    const floor = new T.Mesh(geo(FL, true), new T.MeshPhongMaterial(Object.assign({ map: tex }, matOpts)));
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(st.L, 3));
    const lines = new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x000000 }));
    for (const o of [main, floor]) { o.castShadow = true; o.receiveShadow = true; }
    const grp = new T.Group(); grp.add(main, floor, lines); st.scene.add(grp); st.grp = grp;
    placeSun(); return true;
  };

  /* le soleil entre par les plus grandes baies extérieures */
  const placeSun = () => {
    const bb = st.bb, cx = (bb.x0 + bb.x1) / 2000, cz = -(bb.y0 + bb.y1) / 2000, R0 = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2000 + 3;
    if (st.sunBase == null) {
      let sx = 0, sy = 0;
      for (const r of st.rooms) for (const o of r.openings || []) { if (App.ops.twin(r, o) || o.type === 'velux') continue; const g = App.ops.geo(r, o); if (!g) continue; let nin = g.nin; if (!G.pointInPoly(G.add(g.mid, G.mul(nin, 15)), r.pts)) nin = G.mul(nin, -1); const w = g.w * ((o.h || 1200) / 1000); sx -= nin.x * w; sy -= nin.y * w; }
      st.sunBase = sx || sy ? Math.atan2(sy, sx) + 0.45 : 0.8;
    }
    const az = st.sunBase + st.sunStep * (Math.PI / 4), el = 0.56;
    const L = st.sun; L.position.set(cx + Math.cos(az) * Math.cos(el) * 40, Math.sin(el) * 40, cz - Math.sin(az) * Math.cos(el) * 40); L.target.position.set(cx, 0, cz); L.target.updateMatrixWorld();
    const cam = L.shadow.camera; cam.left = -R0; cam.right = R0; cam.top = R0; cam.bottom = -R0; cam.near = 1; cam.far = 90; cam.updateProjectionMatrix();
    st.fill.position.set(cx + Math.cos(az + 1.9) * 30, 25, cz - Math.sin(az + 1.9) * 30); st.fill.target.position.set(cx, 0, cz); st.fill.target.updateMatrixWorld();
    st.R.shadowMap.needsUpdate = true; st.dirty = true;
  };

  /* ---------- déplacement : cercle contre segments, on glisse le long des murs ---------- */
  const closest = (p, a, b) => { const d = G.sub(b, a), l2 = G.dot(d, d); const t = l2 ? Math.max(0, Math.min(1, G.dot(G.sub(p, a), d) / l2)) : 0; return G.add(a, G.mul(d, t)); };
  const clearance = (p) => { let m = Infinity; for (const [a, b] of st.segs) m = Math.min(m, G.dist(p, closest(p, a, b))); return m; };
  const walkable = (p) => st.rooms.some((r) => G.pointInPoly(p, r.pts)) || st.doors.some((q) => G.pointInPoly(p, q));
  const collide = (p) => { for (let it = 0; it < 4; it++) { let moved = false; for (const [a, b] of st.segs) { const q = closest(p, a, b), dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy); if (d < RAD && d > 1e-6) { const k = (RAD - d) / d; p.x += dx * k; p.y += dy * k; moved = true; } } if (!moved) break; } return p; };
  const roomAt = (p) => st.rooms.find((r) => G.pointInPoly(p, r.pts));
  const ceilingAt = (p) => { const r = roomAt(p); if (!r) return (App.floor().ceiling || 250) * 10; let h = App.feat.ceiling(r) * 10; for (const z of st.slopes[r.id] || []) if (z.inside(p)) h = Math.min(h, z.hAt(p)); return h; };
  const spawnIn = (r) => {
    const c = G.centroid(r.pts); const xs = r.pts.map((p) => p.x), ys = r.pts.map((p) => p.y); let best = null;
    for (let x = Math.min(...xs) + 150; x < Math.max(...xs); x += 150) for (let y = Math.min(...ys) + 150; y < Math.max(...ys); y += 150) {
      const p = { x, y }; if (!G.pointInPoly(p, r.pts)) continue; const cl = Math.min(clearance(p), 900); const sc = cl - 0.25 * G.dist(p, c); if (cl > RAD + 40 && (!best || sc > best.sc)) best = { p, sc };
    }
    const p = best ? best.p : c;
    // regarder vers la plus grande fenêtre, sinon vers le centre de la pièce
    let tgt = null, bw = 0; for (const o of r.openings || []) { const g = App.ops.geo(r, o); if (g && !App.ops.twin(r, o) && g.w > bw) { bw = g.w; tgt = g.mid; } }
    if (!tgt || G.dist(tgt, p) < 400) { let far = 0; for (const q of r.pts) { const d = G.dist(q, p); if (d > far) { far = d; tgt = G.lerp(p, q, 0.7); } } }
    st.pos = { x: p.x, y: p.y }; const d = G.sub(tgt, p); st.yaw = Math.atan2(-d.x, d.y); st.pitch = -0.05; st.eye = Math.min(EYE, ceilingAt(st.pos) - 140);
  };

  /* ---------- trame : 8 × 8 de Bayer, encre / papier / accent ---------- */
  const bayer = () => { let m = [[0]]; while (m.length < 8) { const k = m.length, M2 = [[0, 2], [3, 1]], nm = []; for (let y = 0; y < 2 * k; y++) { nm.push([]); for (let x = 0; x < 2 * k; x++) nm[y].push(4 * m[y % k][x % k] + M2[Math.floor(y / k)][Math.floor(x / k)]); } m = nm; } return m; };
  const css = (v) => { const e = document.createElement('i'); e.style.color = `var(${v})`; st.el.appendChild(e); const c = getComputedStyle(e).color; e.remove(); const m = (c.match(/[\d.]+/g) || [0, 0, 0]).map(Number); const sc = /color\(/.test(c) ? 1 : 1 / 255; return new T.Vector3(m[0] * sc, m[1] * sc, m[2] * sc); };
  const POST_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const POST_F = `uniform sampler2D tScene; uniform sampler2D tBayer; uniform vec3 uInk; uniform vec3 uPaper; uniform vec3 uAcc; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tScene, vUv).rgb;
      float acc = (c.g < 0.004 && c.r > 0.02) ? 1.0 : 0.0;
      float t = texture2D(tBayer, gl_FragCoord.xy / 8.0).r;
      if (acc > 0.5) { float dens = clamp(1.18 - c.r * 0.78, 0.25, 0.95); gl_FragColor = vec4(t < dens ? uAcc : uPaper, 1.0); return; }
      float l = clamp((c.r - 0.08) / 0.86, 0.0, 1.0);
      gl_FragColor = vec4(l < t ? uInk : uPaper, 1.0);
    }`;

  /* ---------- ouverture / fermeture ---------- */
  V.open = async (opts = {}) => {
    if (st) return;
    const host = document.createElement('div'); host.className = 'fps'; host.innerHTML = `<canvas class="view"></canvas><div class="fps-load">Préparation de la visite…</div>`;
    document.body.appendChild(host);
    try { T = await load(); }
    catch (e) { host.remove(); App.toast && App.toast('Impossible de charger le moteur 3D. Vérifiez la connexion.'); return; }
    let R; try { R = new T.WebGLRenderer({ canvas: host.querySelector('canvas'), antialias: false, powerPreference: 'high-performance' }); }
    catch (e) { host.remove(); App.toast && App.toast('La 3D n\'est pas disponible sur cet appareil.'); return; }
    st = { el: host, R, keys: {}, sunStep: 0, sunBase: null, scale: 1, dirty: true, fid: opts.floor || S.p.floorId, ptr: new Map() };
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFShadowMap; R.shadowMap.autoUpdate = false; R.setClearColor(0xffffff, 1);
    st.col = { wall: [0.97, 0.97, 0.97], ceil: [0.96, 0.96, 0.96], fp: [0.86, 0.86, 0.86], well: [0.8, 0.8, 0.8], furn: [0.97, 0.97, 0.97], stair: [0.95, 0.95, 0.95], sill: [0.93, 0.93, 0.93], floor: [0.9, 0.9, 0.9], ground: [0.9, 0.9, 0.9], acc: [0.9, 0, 0] };
    st.scene = new T.Scene(); st.cam = new T.PerspectiveCamera(70, 1, 0.05, 300); st.cam.rotation.order = 'YXZ';
    st.scene.add(new T.AmbientLight(0xffffff, 0.62)); st.scene.add(new T.HemisphereLight(0xffffff, 0xbbbbbb, 0.22));
    const sun = new T.DirectionalLight(0xffffff, 1.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; st.scene.add(sun, sun.target); st.sun = sun;
    st.fill = new T.DirectionalLight(0xffffff, 0.24); st.scene.add(st.fill, st.fill.target);
    // passe de trame
    const bm = bayer(), data = new Uint8Array(256); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = Math.round(((bm[y][x] + 0.5) / 64) * 255); data.set([v, v, v, 255], (y * 8 + x) * 4); }
    const bt = new T.DataTexture(data, 8, 8, T.RGBAFormat); bt.wrapS = bt.wrapT = T.RepeatWrapping; bt.minFilter = bt.magFilter = T.NearestFilter; bt.needsUpdate = true;
    st.rt = new T.WebGLRenderTarget(4, 4, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true });
    st.post = new T.ShaderMaterial({ vertexShader: POST_V, fragmentShader: POST_F, depthTest: false, depthWrite: false, uniforms: { tScene: { value: st.rt.texture }, tBayer: { value: bt }, uInk: { value: css('--ink') }, uPaper: { value: css('--paper') }, uAcc: { value: css('--red') } } });
    st.pScene = new T.Scene(); st.pCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); st.pScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), st.post));
    hud(); setFloor(st.fid, opts.room);
    window.addEventListener('resize', resize); window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', clearKeys);
    resize(); st.raf = requestAnimationFrame(tick);
  };
  V.close = () => {
    if (!st) return; if (st.ph && st.ph.close) st.ph.close(); cancelAnimationFrame(st.raf);
    window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', clearKeys);
    dispose(); st.rt.dispose(); st.R.dispose(); if (st.R.forceContextLoss) st.R.forceContextLoss(); st.el.remove(); st = null;
  };
  V.active = () => !!st;
  V.debug = () => st;

  /* ---------- photo réaliste ----------
     La visite reste en rendu simple pour se déplacer ; « Photo réaliste » reconstruit la vue en mode photo et la calcule à part.
     Moteur principal : lancer de rayons (three-gpu-pathtracer sur un three.js récent, chargés à la demande) : la lumière du
     soleil et du ciel entre par les fenêtres et rebondit, reflets dans les miroirs, ombres justes. Repli : rendu rapide par
     passes accumulées (soleil, ciel et rebonds approchés avec des ombres portées). */
  const QV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  let PTM = null; // modules du lancer de rayons
  const loadPT = () => PTM || (PTM = Promise.all([import('three'), import('three-gpu-pathtracer')]).then(([THREE, P]) => ({ THREE, P })).catch((e) => { PTM = null; throw e; }));

  // la vue courante reconstruite en mode photo : tampons bruts (sommets, normales, couleurs linéaires), caméra, soleil
  const photoData = () => {
    const keep = { grp: st.grp, L: st.L, segs: st.segs, leaves: st.leaves, rail: st.rail, doors: st.doors, slopes: st.slopes, stairs: st.stairs, rooms: st.rooms, bb: st.bb, Hf: st.Hf };
    let ok = false; st.phData = null; PH = true; try { ok = build(); } catch (e) { ok = false; console.warn(e); } finally { PH = false; BM = null; }
    const d = ok ? st.phData : null; st.phData = null; Object.assign(st, keep); placeSun(); if (!d) return null;
    const c = st.cam; d.cam = { fov: c.fov, pos: [c.position.x, c.position.y, c.position.z], rot: [c.rotation.x, c.rotation.y, c.rotation.z] };
    const sd = st.sun.position.clone().sub(st.sun.target.position).normalize(); d.sun = [sd.x, sd.y, sd.z];
    d.here = d.rooms.find((r) => G.pointInPoly(st.pos, r.pts)) || null; return d;
  };

  // lames de parquet : une plaque par lame posée 1 mm au-dessus d'un fond sombre (le joint), teinte propre, veinage d'une des 6 bandes de la texture
  const plankData = (d) => {
    const A = mk(), FLAT = mk(), cal = App.calepinage(d.fid), PQ = S.p.parquet || {}, Lp = PQ.L || 1286, Wp = PQ.W || 214, NV = 6;
    let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const oak = (l, wm) => [lin((196 * l) / 255), lin(((160 - wm * 60) * l) / 255), lin(((118 - wm * 80) * l) / 255)];
    for (const r of d.rooms) {
      if (r.parquet === false) { fill(FLAT, r.pts, [], () => 1, [0, 1, 0], hexLin('#d3cfc6')); continue; }
      const res = cal && cal.results[r.id], polys = res ? (cal.polys = cal.polys || {}, cal.polys[r.id] = cal.polys[r.id] || PL.layout.boardPolys(res)) : null;
      if (!polys || !polys.length) { fill(FLAT, r.pts, [], () => 1, [0, 1, 0], oak(0.98, 0.03)); continue; }
      for (const b of polys) {
        const P0 = b.poly; if (!P0 || P0.length < 3) continue; const P = G.offset(P0, G.area(P0) > 0 ? 0.8 : -0.8); if (!P || P.length < 3 || Math.abs(G.area(P)) < 100) continue;
        let a0 = 0, best = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], L = G.dist(p, q); if (L > best) { best = L; a0 = Math.atan2(q.y - p.y, q.x - p.x); } }
        const u = { x: Math.cos(a0), y: Math.sin(a0) }, v = { x: -u.y, y: u.x }, s0 = Math.min(...P.map((p) => G.dot(p, u))), t0 = Math.min(...P.map((p) => G.dot(p, v)));
        const k = Math.floor(rnd() * NV), off = rnd() * 0.35, col = oak(0.86 + rnd() * 0.26, rnd() * 0.08);
        fill(A, P, [], () => 1, [0, 1, 0], col, (p) => [Math.min(1, off + ((G.dot(p, u) - s0) / Lp) * (1 - off)), (k + Math.max(0.02, Math.min(0.98, (G.dot(p, v) - t0) / Wp))) / NV]);
      }
    }
    return { planks: A, flat: FLAT };
  };
  // texture de veinage du chêne : 6 bandes (une par variante de lame), à multiplier par la teinte de chaque lame
  const grainCanvas = (size) => {
    const c = document.createElement('canvas'); c.width = size; c.height = size; const x = c.getContext('2d'), sh = size / 6, sc = size / 2048;
    let seed = 777; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 6; k++) {
      const y0 = k * sh; x.fillStyle = '#efe6da'; x.fillRect(0, y0, size, sh); x.save(); x.beginPath(); x.rect(0, y0, size, sh); x.clip();
      for (let j = 0; j < 50; j++) { const yy = y0 + rnd() * sh, amp = (1 + rnd() * 6) * sc, fq = (0.0015 + rnd() * 0.008) / sc, ph = rnd() * 6.3; x.beginPath(); for (let t = 0; t <= size; t += 6) { const y = yy + Math.sin(t * fq + ph) * amp + Math.sin(t * fq * 3.1 + ph) * amp * 0.3; t ? x.lineTo(t, y) : x.moveTo(t, y); } x.strokeStyle = `rgba(${105 + Math.round(rnd() * 25)},${74 + Math.round(rnd() * 16)},46,${0.05 + rnd() * 0.2})`; x.lineWidth = (0.6 + rnd() * 2.4) * sc; x.stroke(); }
      for (let m = 0; m < 3; m++) if (rnd() < 0.5) { x.beginPath(); x.ellipse(rnd() * size, y0 + sh * (0.2 + rnd() * 0.6), (8 + rnd() * 14) * sc, (3 + rnd() * 4) * sc, 0, 0, Math.PI * 2); x.fillStyle = 'rgba(92,60,32,0.4)'; x.fill(); }
      const g = x.createLinearGradient(0, y0, 0, y0 + sh); g.addColorStop(0, 'rgba(90,60,30,0.10)'); g.addColorStop(0.08, 'rgba(0,0,0,0)'); g.addColorStop(0.92, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,60,30,0.10)'); x.fillStyle = g; x.fillRect(0, y0, size, sh);
      x.restore();
    }
    return c;
  };

  // prompt pour ChatGPT : rendre la capture photographique sans rien changer à la scène
  const gptPrompt = (d) => {
    const r = d && d.here, pt = r && r.paint, PQ = S.p.parquet || {};
    const murs = pt && (pt.ref || pt.hex) ? `murs peints${pt.ref ? ' « ' + pt.ref + ' »' : ''}${pt.hex ? ' (teinte ' + pt.hex + ')' : ''}` : 'murs blancs';
    return [
      "Transforme cette image en une vraie photographie d'intérieur, comme prise par un photographe d'architecture, à la lumière naturelle du jour qui entre par les fenêtres.",
      "Reste le plus fidèle possible à l'image fournie : même cadrage et même point de vue, même pièce, mêmes meubles exactement aux mêmes places, aux mêmes dimensions et dans les mêmes couleurs, mêmes fenêtres et portes, mêmes couleurs de murs et de sol.",
      "N'ajoute ni ne retire aucun meuble et ne change pas la disposition. Tu peux seulement rendre les matières réalistes (bois, mélaminé, tissu, peinture mate), les ombres douces et les reflets, et ajouter de tout petits détails discrets (plinthes, poignées, prises).",
      `Pièce : ${r && r.name ? r.name : 'chambre'} ; ${murs} ; sol : ${PQ.name || 'parquet en chêne'}.`,
      "Pas de personnes, pas de texte, pas de déformation grand-angle.",
    ].join('\n');
  };

  // fenêtre de résultat, commune aux deux moteurs
  const photoUI = (d) => {
    const ov = document.createElement('div'); ov.className = 'ph';
    ov.innerHTML = `<div class="ph-img"><div class="ph-stage"></div><img alt="Rendu réaliste de la vue" hidden></div><div class="ph-bar"><i></i></div>
      <div class="ph-tools"><span class="ph-st">Préparation…</span><button data-ph="stop" hidden>Arrêter ici</button><label class="ph-ex" hidden>Luminosité <input type="range" min="-1.5" max="1.5" step="0.1" value="0"></label><span class="ph-ab" hidden><button data-ph="vcap" aria-pressed="false">Capture</button><button data-ph="vai" aria-pressed="true">Rendu IA</button></span><a class="ph-save" hidden download="calepin-photo.jpg">Enregistrer</a><button data-ph="gpt" hidden>Envoyer à ChatGPT</button><button data-ph="ai" hidden>Rendu IA</button><button data-ph="close">Fermer</button></div>
      <div class="ph-gpt ph-key" hidden><p><b>Rendu IA avec votre clé OpenAI.</b> La clé reste sur cet appareil (jamais dans le projet ni sur GitHub) ; chaque rendu est facturé sur votre compte OpenAI. Ne marche que depuis la version GitHub Pages de Calepin.</p><input type="password" autocomplete="off" spellcheck="false" placeholder="sk-…" aria-label="Clé API OpenAI"><div class="ph-row"><button data-ph="keysave">Enregistrer sur cet appareil</button><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">Créer une clé</a><button data-ph="keydel">Oublier la clé</button><button data-ph="keyx">Annuler</button></div></div>
      <div class="ph-gpt" hidden><p>Le prompt est copié. Gardez l'image (appui long dessus, ou « Enregistrer »), ouvrez ChatGPT, joignez-la et collez le prompt :</p><textarea readonly rows="6"></textarea><div class="ph-row"><button data-ph="copy">Copier le prompt</button><a href="https://chatgpt.com/" target="_blank" rel="noopener">Ouvrir ChatGPT</a><button data-ph="gptx">OK</button></div></div>`;
    st.el.appendChild(ov); const q = (x) => ov.querySelector(x);
    const ui = { ov, stage: q('.ph-stage'), img: q('img'), bar: q('.ph-bar i'), stx: q('.ph-st'), stop: q('[data-ph=stop]'), ex: q('.ph-ex'), rng: q('.ph-ex input'), save: q('.ph-save'), gpt: q('[data-ph=gpt]'), gp: q('.ph-gpt'), blob: null };
    ui.progress = (f, txt) => { ui.bar.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; ui.stx.textContent = txt; };
    ui.capture = (cv) => { const url = cv.toDataURL('image/jpeg', 0.92); ui.img.src = url; ui.save.href = url; if (cv.toBlob) cv.toBlob((b) => { ui.blob = b; }, 'image/jpeg', 0.92); };
    ui.done = (cv, txt) => { ov.classList.add('done'); ui.stop.hidden = true; ui.ex.hidden = false; ui.save.hidden = false; ui.gpt.hidden = false; ov.querySelector('[data-ph=ai]').hidden = false; ui.stx.textContent = txt || 'Photo prête'; ui.capture(cv); ui.img.hidden = false; ui.stage.hidden = true; };
    const txt = () => gptPrompt(d), fallback = () => { ui.gp.hidden = false; ui.gp.querySelector('textarea').value = txt(); };
    ui.gpt.addEventListener('click', () => {
      const t = txt(); try { if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); } catch (e) { /* presse-papiers refusé */ }
      const f = ui.blob && typeof File === 'function' ? new File([ui.blob], 'calepin-photo.jpg', { type: 'image/jpeg' }) : null;
      if (f && navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], text: t }).then(() => {}, (e) => { if (!e || e.name !== 'AbortError') fallback(); }); App.toast && App.toast('Prompt copié : choisissez ChatGPT dans le partage'); return; }
      fallback();
    });
    q('[data-ph=copy]').addEventListener('click', () => { const ta = ui.gp.querySelector('textarea'); try { navigator.clipboard.writeText(ta.value).then(() => App.toast && App.toast('Prompt copié'), () => { ta.select(); }); } catch (e) { ta.select(); } });
    q('[data-ph=gptx]').addEventListener('click', () => { ui.gp.hidden = true; });
    // rendu IA direct par l'API OpenAI (édition d'image) : la capture + le même prompt de fidélité
    const KEY = 'calepin:openai-key', kp = q('.ph-key'), kin = kp.querySelector('input'), ab = q('.ph-ab'), aiB = q('[data-ph=ai]');
    const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
    let capUrl = '', aiUrl = '';
    const view = (which) => { const u = which === 'ai' ? aiUrl : capUrl; if (!u) return; ui.img.src = u; ui.save.href = u; ui.save.download = which === 'ai' ? 'calepin-rendu-ia.jpg' : 'calepin-photo.jpg'; q('[data-ph=vai]').setAttribute('aria-pressed', which === 'ai'); q('[data-ph=vcap]').setAttribute('aria-pressed', which !== 'ai'); };
    q('[data-ph=vai]').addEventListener('click', () => view('ai')); q('[data-ph=vcap]').addEventListener('click', () => view('cap'));
    q('[data-ph=keyx]').addEventListener('click', () => { kp.hidden = true; });
    q('[data-ph=keydel]').addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch (e) { /* rien */ } kin.value = ''; App.toast && App.toast('Clé oubliée sur cet appareil'); });
    q('[data-ph=keysave]').addEventListener('click', () => { const k = kin.value.trim(); if (!/^sk-[\w-]{20,}$/.test(k)) { App.toast && App.toast('Ce ne ressemble pas à une clé OpenAI (sk-…)'); return; } try { localStorage.setItem(KEY, k); } catch (e) { App.toast && App.toast('Impossible d\'enregistrer la clé ici'); return; } kin.value = ''; kp.hidden = true; aiB.click(); });
    aiB.addEventListener('click', async () => {
      const key = getKey(); if (!key) { kp.hidden = false; kin.focus(); return; }
      if (!ui.blob) { App.toast && App.toast('Image pas encore prête'); return; }
      capUrl = capUrl || ui.img.src; aiB.disabled = true; const prev = ui.stx.textContent; ui.stx.textContent = 'Rendu IA en cours… (jusqu\'à 1 ou 2 minutes)'; ui.ov.classList.add('busy');
      try {
        const fd = new FormData(); fd.append('image[]', new File([ui.blob], 'capture.jpg', { type: 'image/jpeg' })); fd.append('prompt', txt()); fd.append('quality', 'high'); fd.append('size', 'auto'); fd.append('output_format', 'jpeg');
        let model = ''; try { model = localStorage.getItem('calepin:openai-model') || ''; } catch (e) { /* rien */ } if (model) fd.append('model', model);
        let r; try { r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd }); } catch (e) { throw new Error('net'); }
        const j = await r.json().catch(() => ({})); if (!r.ok) { const m = (j.error && j.error.message) || ''; throw new Error(r.status === 401 ? 'Clé refusée par OpenAI : vérifiez-la (« Oublier la clé » puis recollez-la).' : r.status === 403 ? 'Accès refusé : vérifiez votre organisation OpenAI (vérification d\'identité requise pour les modèles d\'image). ' + m : r.status === 429 ? 'Crédit épuisé ou limite de dépense atteinte sur votre compte OpenAI.' : 'OpenAI a refusé le rendu : ' + (m || r.status)); }
        const b = j.data && j.data[0] && j.data[0].b64_json; if (!b) throw new Error('Réponse sans image.');
        aiUrl = 'data:image/jpeg;base64,' + b; ab.hidden = false; view('ai'); ui.stx.textContent = 'Rendu IA prêt';
      } catch (e) { ui.stx.textContent = prev; const m = e.message === 'net' ? 'Envoi impossible : le rendu IA ne marche que depuis la version GitHub Pages (distortedimages-code.github.io/Plan), avec une connexion.' : e.message; App.toast && App.toast(m); }
      finally { aiB.disabled = false; ui.ov.classList.remove('busy'); }
    });
    return ui;
  };

  V.photo = async () => {
    if (!st || st.ph) return;
    const cfg = V.photoCfg || {}, coarse = matchMedia('(pointer:coarse)').matches, asp = st.el.clientWidth / st.el.clientHeight;
    const d = photoData(); if (!d) { App.toast && App.toast('Rendu impossible sur cet étage.'); return; }
    const ui = photoUI(d); let eng = null, closed = false;
    const close = () => { closed = true; try { if (eng) eng.close(); } catch (e) { /* déjà libéré */ } ui.ov.remove(); if (st) { st.ph = null; st.dirty = true; } };
    st.ph = { ui, close }; ui.ov.querySelector('[data-ph=close]').addEventListener('click', close);
    ui.rng.addEventListener('input', () => { if (eng && eng.exposure) eng.exposure(+ui.rng.value); });
    ui.stop.addEventListener('click', () => { if (eng && eng.stop) eng.stop(); });
    const size = (LS) => { LS = cfg.LS || LS; return asp >= 1 ? [LS, Math.round(LS / asp)] : [Math.round(LS * asp), LS]; };
    if (!cfg.quick) {
      try {
        ui.progress(0.01, 'Chargement du moteur de lancer de rayons…'); const mods = await loadPT(); if (closed) return;
        const [W, H] = size(coarse ? 1100 : 1600); eng = ptEngine(mods, d, ui, W, H, cfg, coarse); await eng.start(); return;
      } catch (e) { console.warn('lancer de rayons indisponible', e); if (closed) return; try { if (eng) eng.close(); } catch (e2) { /* rien */ } eng = null; ui.stage.innerHTML = ''; ui.progress(0, 'Lancer de rayons indisponible ici : rendu rapide…'); }
    }
    const [W, H] = size(coarse ? 1400 : 1920); eng = quickEngine(d, ui, W, H, cfg, coarse); eng.start();
  };

  /* lancer de rayons : progressif, exposition automatique, arrêt possible à tout moment */
  const ptEngine = ({ THREE: M, P }, d, ui, Wp, Hp, cfg, coarse) => {
    const cv = document.createElement('canvas'); cv.width = Wp; cv.height = Hp; ui.stage.appendChild(cv);
    const R2 = new M.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    R2.setPixelRatio(1); R2.setSize(Wp, Hp, false); R2.toneMapping = M.ACESFilmicToneMapping; R2.outputColorSpace = M.SRGBColorSpace;
    const sc = new M.Scene(), owned = [];
    const geo = (A, uv) => { const g = new M.BufferGeometry(); g.setAttribute('position', new M.Float32BufferAttribute(A.p, 3)); g.setAttribute('normal', new M.Float32BufferAttribute(A.n, 3)); if (A.c.length) g.setAttribute('color', new M.Float32BufferAttribute(A.c, 3)); if (uv && A.uv.length) g.setAttribute('uv', new M.Float32BufferAttribute(A.uv, 2)); return g; };
    const add = (A, mat) => { owned.push(mat); if (!A || !A.p.length) return; const g = geo(A, !!mat.map); owned.push(g); sc.add(new M.Mesh(g, mat)); };
    const walls = new M.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 });
    add(d.shell, walls); add(d.occ, walls);
    add(d.furn, new M.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    add(d.mirror, new M.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.02 }));
    add(d.floor, new M.MeshStandardMaterial({ color: 0x3a2b1f, roughness: 1 }));
    const pk = plankData(d), TS = cfg.ts || (coarse ? 1024 : 2048), tex = new M.CanvasTexture(grainCanvas(TS)); tex.colorSpace = M.SRGBColorSpace; tex.flipY = false; owned.push(tex);
    add(pk.planks, new M.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.4 }));
    add(pk.flat, new M.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }));
    // ciel : horizon clair, zénith bleu, sol vert-gris (en HDR) ; soleil dans la direction choisie avec « Soleil »
    const sky = new P.ProceduralEquirectTexture(512, 256), dir = new M.Vector3();
    sky.generationCallback = (polar, uv, coord, color) => { dir.setFromSpherical(polar); const y = dir.y; if (y >= 0) { const t = Math.pow(y, 0.5); color.setRGB(1.5 + (0.45 - 1.5) * t, 1.55 + (0.7 - 1.55) * t, 1.6 + (1.35 - 1.6) * t); } else { const t = Math.min(1, -y * 3); color.setRGB(0.5 - 0.22 * t, 0.52 - 0.2 * t, 0.45 - 0.22 * t); } };
    sky.update(); owned.push(sky); sc.background = sky; sc.environment = sky;
    const bb = d.bb, cx = (bb.x0 + bb.x1) / 2000, cz = -(bb.y0 + bb.y1) / 2000, sd = new M.Vector3(...d.sun).normalize();
    const sun = new M.DirectionalLight(0xfff0d8, cfg.sun || 9); sun.position.set(cx + sd.x * 60, sd.y * 60, cz + sd.z * 60); sun.target.position.set(cx, 0, cz); sc.add(sun, sun.target); sun.target.updateMatrixWorld();
    const cam = new M.PerspectiveCamera(d.cam.fov, Wp / Hp, 0.05, 300); cam.position.set(...d.cam.pos); cam.rotation.set(d.cam.rot[0], d.cam.rot[1], d.cam.rot[2], 'YXZ'); cam.updateMatrixWorld();
    const pt = new P.WebGLPathTracer(R2); pt.tiles.set(cfg.tiles || 2, cfg.tiles || 2); pt.bounces = cfg.bounces || 6; pt.filterGlossyFactor = 0.5; pt.minSamples = 1; pt.renderDelay = 0; pt.fadeDuration = 0; pt.dynamicLowRes = false; pt.textureSize.set(TS, TS);
    const TARGET = cfg.samples || (coarse ? 180 : 360); let raf = 0, dead = false, stopped = false, expo = 1, user = 0, metered = 0;
    const mc = document.createElement('canvas'), mw = 160, mh = Math.max(20, Math.round((160 * Hp) / Wp)); mc.width = mw; mc.height = mh; const mx = mc.getContext('2d', { willReadFrequently: true });
    const meter = () => { // exposition auto : médiane des luminances vers 0,42
      mx.drawImage(cv, 0, 0, mw, mh); const px = mx.getImageData(0, 0, mw, mh).data, L = []; for (let i = 0; i < px.length; i += 4) L.push(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]); L.sort((a, b) => a - b);
      const m = Math.max(3, L[Math.floor(L.length * 0.5)]) / 255; expo = Math.max(0.15, Math.min(12, expo * Math.pow(0.42 / m, 1.8))); R2.toneMappingExposure = expo * Math.pow(2, user); };
    const finish = (txt) => { cancelAnimationFrame(raf); pt.pausePathTracing = true; pt.renderSample(); ui.done(cv, txt); };
    const frame = () => {
      if (dead) return; pt.renderSample(); const n = Math.floor(pt.samples);
      ui.progress(n / TARGET, pt.isCompiling ? 'Préparation des matériaux…' : `Lancer de rayons… ${n} / ${TARGET} passes`);
      if (n >= 3 && metered === 0) { meter(); metered = 1; } else if (n >= 24 && metered === 1) { meter(); metered = 2; } else if (n >= TARGET * 0.6 && metered === 2) { meter(); metered = 3; }
      if (n >= TARGET || stopped) { if (metered < 3) meter(); finish(stopped ? `Photo prête (${n} passes)` : 'Photo prête'); return; }
      raf = requestAnimationFrame(frame);
    };
    return {
      start: async () => {
        ui.progress(0.02, 'Préparation de la scène…');
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); pt.setScene(sc, cam); // arbre de volumes englobants construit d'un coup
        if (dead) return; ui.stop.hidden = false; raf = requestAnimationFrame(frame);
      },
      stop: () => { stopped = true; },
      exposure: (v) => { user = v; R2.toneMappingExposure = expo * Math.pow(2, user); if (pt.pausePathTracing) { pt.renderSample(); ui.capture(cv); } },
      close: () => { dead = true; cancelAnimationFrame(raf); try { pt.dispose(); } catch (e) { /* rien */ } for (const o of owned) if (o && o.dispose) o.dispose(); R2.dispose(); if (R2.forceContextLoss) R2.forceContextLoss(); cv.remove(); },
    };
  };

  /* rendu rapide (repli) : passes accumulées en flottant — soleil légèrement décalé (pénombre), ciel échantillonné
     direction par direction avec ses ombres (il n'entre que par les fenêtres), rebonds approchés où seuls les meubles font ombre */
  const quickEngine = (d, ui, Wp, Hp, cfg, coarse) => {
    const R = st.R, owned = [];
    const geo = (A, uv) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(A.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(A.n, 3)); if (A.c.length) g.setAttribute('color', new T.Float32BufferAttribute(A.c, 3)); if (uv) g.setAttribute('uv', new T.Float32BufferAttribute(A.uv, 2)); owned.push(g); return g; };
    const base = { roughness: 0.9, metalness: 0, side: T.FrontSide, shadowSide: T.DoubleSide };
    const mat = new T.MeshStandardMaterial(Object.assign({ vertexColors: true }, base)); owned.push(mat);
    const ftex = new T.CanvasTexture(photoFloorCanvas(d.fid, d.rooms, d.bb, App.calepinage(d.fid))); ftex.flipY = false; ftex.encoding = T.sRGBEncoding; ftex.anisotropy = R.capabilities.getMaxAnisotropy ? R.capabilities.getMaxAnisotropy() : 1; ftex.minFilter = T.LinearMipmapLinearFilter; owned.push(ftex);
    const fmat = new T.MeshStandardMaterial(Object.assign({ map: ftex }, base, { roughness: 0.62 })), mmat = new T.MeshStandardMaterial(Object.assign({}, base, { color: 0xd9dee2, roughness: 0.12, metalness: 0.25 })); owned.push(fmat, mmat);
    const pg = new T.Group(), meshes = {};
    for (const [k, A, m, uv] of [['shell', d.shell, mat], ['floor', d.floor, fmat, true], ['furn', d.furn, mat], ['occ', d.occ, mat], ['mirror', d.mirror, mmat]]) { if (!A || !A.p.length) continue; const o = new T.Mesh(geo(A, uv), m); o.castShadow = o.receiveShadow = true; meshes[k] = o; pg.add(o); }
    const scene = new T.Scene(); scene.add(pg); scene.background = new T.Color(1.35, 1.55, 1.9); scene.add(new T.AmbientLight(0xfff4e8, 0.035));
    const bb = d.bb, cx = (bb.x0 + bb.x1) / 2000, cz = -(bb.y0 + bb.y1) / 2000, R0 = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2000 + 1;
    const mkL = (size, col) => { const L = new T.DirectionalLight(col, 1); L.castShadow = true; L.shadow.mapSize.set(size, size); L.shadow.bias = -0.0004; L.shadow.normalBias = 0.006; const c = L.shadow.camera; c.left = -R0; c.right = R0; c.top = R0; c.bottom = -R0; c.near = 1; c.far = 140; c.updateProjectionMatrix(); scene.add(L, L.target); return L; };
    const sun = mkL(cfg.sh || (coarse ? 2048 : 4096), 0xfff0dc), sky = mkL(cfg.sh ? cfg.sh / 2 : coarse ? 1024 : 2048, 0xd6e4ff), amb = mkL(cfg.sh ? cfg.sh / 2 : 1024, 0xffffff);
    { const pc = d.here ? paintCol(d.here) : [0.85, 0.85, 0.85], m = Math.max(...pc, 0.01); amb.color.setRGB(0.65 + (0.35 * pc[0]) / m, 0.65 + (0.35 * pc[1]) / m, 0.65 + (0.35 * pc[2]) / m); }
    const setPass = (bounce, below) => { sun.castShadow = sky.castShadow = !bounce; amb.castShadow = bounce && !below; for (const k of ['shell', 'floor', 'occ']) if (meshes[k]) meshes[k].castShadow = !bounce; };
    const sunDir = new T.Vector3(...d.sun).normalize();
    const cam = new T.PerspectiveCamera(d.cam.fov, Wp / Hp, 0.05, 300); cam.position.set(...d.cam.pos); cam.rotation.order = 'YXZ'; cam.rotation.set(...d.cam.rot); cam.updateMatrixWorld();
    const ht = R.capabilities.isWebGL2 || R.extensions.has('OES_texture_half_float') ? T.HalfFloatType : T.FloatType, rto = { minFilter: T.NearestFilter, magFilter: T.NearestFilter };
    const rtP = new T.WebGLRenderTarget(Wp, Hp, Object.assign({ type: ht, depthBuffer: true }, rto)), rtA = new T.WebGLRenderTarget(Wp, Hp, Object.assign({ type: ht, depthBuffer: false }, rto)), rtO = new T.WebGLRenderTarget(Wp, Hp, Object.assign({ depthBuffer: false }, rto));
    const qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), plane = new T.PlaneGeometry(2, 2);
    const accM = new T.ShaderMaterial({ uniforms: { t: { value: rtP.texture }, k: { value: 1 } }, vertexShader: QV, fragmentShader: 'uniform sampler2D t; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * k, 1.); }', blending: T.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false });
    const outM = new T.ShaderMaterial({ uniforms: { t: { value: rtA.texture }, e: { value: 1 } }, vertexShader: QV, fragmentShader: 'uniform sampler2D t; uniform float e; varying vec2 vUv; vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); } void main(){ vec3 c = aces(max(texture2D(t, vUv).rgb, 0.) * e); gl_FragColor = vec4(pow(c, vec3(1./2.2)), 1.); }', depthTest: false, depthWrite: false });
    const accS = new T.Scene(), outS = new T.Scene(); accS.add(new T.Mesh(plane, accM)); outS.add(new T.Mesh(plane, outM));
    const cv = document.createElement('canvas'); cv.width = Wp; cv.height = Hp; ui.stage.appendChild(cv); const cx2 = cv.getContext('2d');
    const N = cfg.N || (coarse ? 48 : 96), SUN = 2.8, SKY = 1.25, AMB = 1.15; let i = 0, expo = 1, user = 0, dead = false, raf = 0, metered = false; const buf = new Uint8Array(Wp * Hp * 4), id = cx2.createImageData(Wp, Hp);
    let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const withState = (fn) => { const tm = R.toneMapping, enc = R.outputEncoding, ty = R.shadowMap.type, ac = R.autoClear, cc = R.getClearColor(new T.Color()).clone(), ca = R.getClearAlpha();
      R.toneMapping = T.NoToneMapping; R.outputEncoding = T.LinearEncoding; R.shadowMap.type = T.PCFSoftShadowMap;
      try { fn(); } finally { R.setRenderTarget(null); R.toneMapping = tm; R.outputEncoding = enc; R.shadowMap.type = ty; R.autoClear = ac; R.setClearColor(cc, ca); R.shadowMap.needsUpdate = true; if (st) st.dirty = true; } };
    const show = () => { outM.uniforms.e.value = expo * Math.pow(2, user) * (N / Math.max(1, i)); R.setRenderTarget(rtO); R.autoClear = true; R.render(outS, qc); R.readRenderTargetPixels(rtO, 0, 0, Wp, Hp, buf);
      const dd = id.data, row = Wp * 4; for (let y = 0; y < Hp; y++) dd.set(buf.subarray((Hp - 1 - y) * row, (Hp - y) * row), y * row); cx2.putImageData(id, 0, 0); };
    const meter = () => { const L = []; for (let p = 0; p < buf.length; p += 4 * 37) L.push(0.2126 * buf[p] + 0.7152 * buf[p + 1] + 0.0722 * buf[p + 2]); L.sort((a, b) => a - b); const m = Math.max(4, L[Math.floor(L.length * 0.5)]) / 255; expo = Math.max(0.25, Math.min(8, expo * Math.pow(0.42 / m, 2.0))); };
    const pass = () => {
      if (dead || !st) return;
      withState(() => {
        const t0 = performance.now();
        while (i < N && performance.now() - t0 < 45) {
          const sd = sunDir.clone().add(new T.Vector3((rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.04)).normalize();
          sun.position.set(cx + sd.x * 70, sd.y * 70, cz + sd.z * 70); sun.target.position.set(cx, 0, cz); sun.target.updateMatrixWorld();
          const ix = Math.floor(((i * 0.6180339887) % 1) * N), ce = 0.04 + 0.96 * ((ix + rnd()) / N), ph = ix * 2.39996 + rnd() * 0.4, se = Math.sqrt(1 - ce * ce);
          sky.position.set(cx + se * Math.cos(ph) * 70, ce * 70, cz + se * Math.sin(ph) * 70); sky.target.position.set(cx, 0, cz); sky.target.updateMatrixWorld();
          const ay = 2 * ((((i * 0.7548776662) % 1) + rnd() / N) % 1) - 1, aph = i * 2.39996 + rnd(), ar = Math.sqrt(Math.max(0, 1 - ay * ay));
          amb.position.set(cx + ar * Math.cos(aph) * 70, ay * 70, cz + ar * Math.sin(aph) * 70); amb.target.position.set(cx, 0, cz); amb.target.updateMatrixWorld();
          cam.setViewOffset(Wp, Hp, rnd() - 0.5, rnd() - 0.5, Wp, Hp);
          R.setRenderTarget(rtA); if (i === 0) { R.setClearColor(0x000000, 1); R.clear(); }
          for (const bounce of [false, true]) {
            setPass(bounce, ay < 0); sun.intensity = bounce || sd.y <= 0.02 ? 0 : SUN; sky.intensity = bounce ? 0 : SKY; amb.intensity = bounce ? AMB : 0;
            R.shadowMap.needsUpdate = true; R.autoClear = true; R.setRenderTarget(rtP); R.setClearColor(0x000000, 1);
            if (bounce) { const bg = scene.background; scene.background = null; R.render(scene, cam); scene.background = bg; } else R.render(scene, cam);
            R.setRenderTarget(rtA); R.autoClear = false; accM.uniforms.k.value = 1 / N; R.render(accS, qc);
          }
          i++;
        }
        show(); if (i >= 6 && !metered) { meter(); metered = true; show(); }
      });
      ui.progress(i / N, `Rendu rapide… ${Math.round((100 * i) / N)} %`);
      if (i < N) { raf = requestAnimationFrame(pass); return; }
      withState(() => { meter(); show(); }); ui.done(cv);
    };
    return {
      start: () => { raf = requestAnimationFrame(pass); },
      exposure: (v) => { user = v; withState(show); ui.capture(cv); },
      close: () => { dead = true; cancelAnimationFrame(raf); for (const o of owned) o.dispose(); for (const L of [sun, sky, amb]) if (L.shadow.map) L.shadow.map.dispose(); rtP.dispose(); rtA.dispose(); rtO.dispose(); accM.dispose(); outM.dispose(); plane.dispose(); cv.remove(); },
    };
  };
  const dispose = () => { if (!st.grp) return; st.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); st.scene.remove(st.grp); st.grp = null; };
  const setFloor = (fid, roomId) => {
    const prev = st.pos ? Object.assign({}, st.pos) : null; st.fid = fid; dispose(); st.sunBase = null;
    if (!build()) { st.rooms = []; st.segs = []; label(); App.toast && App.toast('Aucune pièce à visiter sur cet étage.'); return; }
    const sel = roomId ? st.rooms.find((r) => r.id === roomId) : null;
    const keep = !sel && prev && walkable(prev) && clearance(prev) > RAD ? prev : null;
    if (keep) { st.pos = keep; st.eye = Math.min(EYE, ceilingAt(keep) - 140); }
    else spawnIn(sel || st.rooms.slice().sort((a, b) => Math.abs(G.area(b.pts)) - Math.abs(G.area(a.pts)))[0]);
    st.el.querySelectorAll('[data-fl]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.fl === fid));
    const ld = st.el.querySelector('.fps-load'); if (ld) ld.remove();
    label(); st.dirty = true;
  };

  /* ---------- interface ---------- */
  const hud = () => {
    const touch = matchMedia('(pointer:coarse)').matches; const fl = S.p.floors.slice().sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    st.el.insertAdjacentHTML('beforeend', `
      <div class="fps-tl"><button class="fps-x" data-f="close" aria-label="Quitter la visite">✕</button><div class="fps-room"><b></b></div></div>
      <div class="fps-tr"><canvas class="fps-map" aria-label="Plan de situation"></canvas></div>
      <div class="fps-br">${fl.length > 1 ? `<div class="fps-seg">${fl.map((f) => `<button data-fl="${f.id}">${App.esc ? App.esc(f.name) : f.name}</button>`).join('')}</div>` : ''}
        <div class="fps-seg"><button data-f="sun">Soleil</button><button data-f="grain" aria-pressed="false">Gros grain</button></div><button class="fps-photo" data-f="photo">Photo réaliste</button></div>
      <div class="fps-hint">${touch ? 'Pouce gauche : marcher · glisser à droite : regarder' : 'ZQSD ou flèches : marcher · glisser : regarder · Maj : presser le pas'}</div>
      <div class="fps-joy"><i></i></div>`);
    st.el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.fl) { setFloor(b.dataset.fl); return; }
      if (b.dataset.f === 'close') V.close();
      else if (b.dataset.f === 'sun') { st.sunStep = (st.sunStep + 1) % 8; placeSun(); }
      else if (b.dataset.f === 'photo') V.photo();
      else if (b.dataset.f === 'grain') { st.scale = st.scale === 1 ? 0.5 : 1; b.setAttribute('aria-pressed', st.scale < 1); resize(); }
    });
    const cv = st.el.querySelector('canvas.view');
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); cv.addEventListener('lostpointercapture', onUp);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    const mp = st.el.querySelector('.fps-map'); mp.addEventListener('pointerdown', (e) => { e.preventDefault(); const p = mapToWorld(e); if (p && walkable(p) && clearance(p) > RAD + 20) { st.pos = p; st.dirty = true; label(); } });
    setTimeout(() => { const h = st && st.el.querySelector('.fps-hint'); if (h) h.style.opacity = '0'; }, 6000);
  };
  const label = () => { const r = st.pos && roomAt(st.pos); const b = st.el.querySelector('.fps-room b'); const t = r ? r.name || 'Pièce' : 'Passage'; if (b.textContent !== t) b.textContent = t; };
  const resize = () => {
    if (!st) return; const w = window.innerWidth, h = window.innerHeight; st.R.setPixelRatio(st.scale); st.R.setSize(w, h, true);
    const W = Math.max(1, Math.round(w * st.scale)), H = Math.max(1, Math.round(h * st.scale)); st.rt.setSize(W, H); st.cam.aspect = w / h; st.cam.fov = w < h ? 78 : 66; st.cam.updateProjectionMatrix();
    const mp = st.el.querySelector('.fps-map'); const d = Math.min(3, window.devicePixelRatio || 1); mp.width = mp.clientWidth * d; mp.height = mp.clientHeight * d; st.dirty = true;
  };
  const clearKeys = () => { st && (st.keys = {}); };
  const onKey = (e) => {
    if (!st) return; if (e.key === 'Escape' && e.type === 'keydown') { V.close(); return; }
    const k = e.code; if (/^(Key[WASDQZ]|Arrow|Shift)/.test(k)) { st.keys[k] = e.type === 'keydown'; e.preventDefault(); }
  };
  const onDown = (e) => {
    e.preventDefault(); e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
    const touch = e.pointerType !== 'mouse';
    if (touch && e.clientX < window.innerWidth * 0.45 && ![...st.ptr.values()].some((p) => p.joy)) { st.ptr.set(e.pointerId, { joy: true, x0: e.clientX, y0: e.clientY }); st.joy = { x: 0, y: 0 }; const j = st.el.querySelector('.fps-joy'); j.style.display = 'block'; j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; j.firstChild.style.transform = ''; }
    else st.ptr.set(e.pointerId, { look: true, x: e.clientX, y: e.clientY });
    const h = st.el.querySelector('.fps-hint'); if (h) h.style.opacity = '0';
  };
  const onMove = (e) => {
    const p = st && st.ptr.get(e.pointerId); if (!p) return;
    if (p.joy) { let dx = e.clientX - p.x0, dy = e.clientY - p.y0; const l = Math.hypot(dx, dy), m = 46; if (l > m) { dx *= m / l; dy *= m / l; } st.joy = { x: dx / m, y: dy / m }; st.el.querySelector('.fps-joy i').style.transform = `translate(${dx}px,${dy}px)`; }
    else { const k = e.pointerType === 'mouse' ? 0.0042 : 0.0058; st.yaw -= (e.clientX - p.x) * k; st.pitch = Math.max(-1.3, Math.min(1.3, st.pitch - (e.clientY - p.y) * k)); p.x = e.clientX; p.y = e.clientY; st.dirty = true; }
  };
  const onUp = (e) => { const p = st && st.ptr.get(e.pointerId); if (!p) return; st.ptr.delete(e.pointerId); if (p.joy) { st.joy = null; st.el.querySelector('.fps-joy').style.display = 'none'; } };

  /* plan de situation */
  const mapFit = () => { const mp = st.el.querySelector('.fps-map'), bb = st.bb, W = mp.width, H = mp.height, pad = 8 * (W / mp.clientWidth || 1); const k = Math.min((W - 2 * pad) / (bb.x1 - bb.x0), (H - 2 * pad) / (bb.y1 - bb.y0)); return { mp, k, ox: (W - (bb.x1 - bb.x0) * k) / 2 - bb.x0 * k, oy: (H + (bb.y1 - bb.y0) * k) / 2 + bb.y0 * k }; };
  const mapToWorld = (e) => { if (!st.bb) return null; const f = mapFit(), r = f.mp.getBoundingClientRect(), s = f.mp.width / r.width; return { x: ((e.clientX - r.left) * s - f.ox) / f.k, y: (f.oy - (e.clientY - r.top) * s) / f.k }; };
  const drawMap = () => {
    if (!st.bb) return; const f = mapFit(), x = f.mp.getContext('2d'), W = f.mp.width, H = f.mp.height, d = W / (f.mp.clientWidth || W);
    const rgb = (v) => `rgb(${v.toArray().map((c) => Math.round(c * 255)).join(',')})`, ink = rgb(st.post.uniforms.uInk.value), red = rgb(st.post.uniforms.uAcc.value);
    x.clearRect(0, 0, W, H); x.lineWidth = d; x.strokeStyle = ink;
    const tp = (p) => [p.x * f.k + f.ox, f.oy - p.y * f.k];
    for (const r of st.rooms) { x.beginPath(); r.pts.forEach((p, i) => { const [a, b] = tp(p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); x.stroke(); }
    if (!st.pos) return; const [px, py] = tp(st.pos), fx = -Math.sin(st.yaw), fy = -Math.cos(st.yaw), a = Math.atan2(fy, fx) /* écran : y vers le bas */, L = 26 * d;
    x.fillStyle = red; x.globalAlpha = 0.28; x.beginPath(); x.moveTo(px, py); x.arc(px, py, L, a - 0.55, a + 0.55); x.closePath(); x.fill(); x.globalAlpha = 1;
    x.beginPath(); x.arc(px, py, 3.2 * d, 0, Math.PI * 2); x.fill();
  };

  /* ---------- boucle ---------- */
  const tick = (now) => {
    if (!st) return; st.raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - (st.last || now)) / 1000); st.last = now; const k = st.keys;
    let fwd = 0, side = 0;
    if (k.KeyW || k.ArrowUp) fwd += 1; if (k.KeyS || k.ArrowDown) fwd -= 1; if (k.KeyA) side -= 1; if (k.KeyD) side += 1;
    if (k.ArrowLeft) { st.yaw += 1.9 * dt; st.dirty = true; } if (k.ArrowRight) { st.yaw -= 1.9 * dt; st.dirty = true; }
    if (st.joy) { fwd -= st.joy.y; side += st.joy.x; }
    if (st.pos && (fwd || side)) {
      const l = Math.hypot(fwd, side); if (l > 1) { fwd /= l; side /= l; }
      const sp = WALK * (k.ShiftLeft || k.ShiftRight ? 1.9 : 1) * dt, f = { x: -Math.sin(st.yaw), y: Math.cos(st.yaw) }, r = { x: Math.cos(st.yaw), y: Math.sin(st.yaw) };
      const old = st.pos, p = collide({ x: old.x + (f.x * fwd + r.x * side) * sp, y: old.y + (f.y * fwd + r.y * side) * sp });
      if (walkable(p)) st.pos = p; st.dirty = true; label();
    }
    if (st.pos) { const target = Math.max(900, Math.min(EYE, ceilingAt(st.pos) - 140)); if (Math.abs(target - st.eye) > 1) { st.eye += (target - st.eye) * Math.min(1, dt * 6); st.dirty = true; } }
    if (!st.dirty || !st.pos) return; st.dirty = false;
    st.cam.position.set(st.pos.x / 1000, st.eye / 1000, -st.pos.y / 1000); st.cam.rotation.set(st.pitch, st.yaw, 0);
    st.R.setRenderTarget(st.rt); st.R.render(st.scene, st.cam); st.R.setRenderTarget(null); st.R.render(st.pScene, st.pCam);
    drawMap();
  };
})();
