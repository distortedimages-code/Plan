/* Calepin — retouche à main levée.
   Un trait : ferme une cloison (prolongée jusqu'aux murs) et coupe la pièce.
   Une zone entourée : nouvelle pièce à cet endroit, calée sur les murs voisins ; les pièces touchées sont
   redécoupées autour, avec une cloison là où il n'y en avait pas. Aperçu d'abord, puis Valider. */
(function () {
  const PL = globalThis.PL, G = PL.geom, O = PL.ortho, App = globalThis.App, S = App.state;
  const K = (App.sketch = {});
  const AXIS = 0.012; // pente max d'un mur « d'équerre »

  /* ---------- murs de l'étage dans le repère ---------- */
  function faces(fr) {
    const out = [];
    for (const r of App.rooms()) {
      const P = r.pts.map(fr.to), n = P.length, sg = G.area(P) >= 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const a = P[i], b = P[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy); if (l < 40) continue;
        const nin = G.mul(G.perp({ x: dx / l, y: dy / l }), sg);
        if (Math.abs(dy) <= Math.max(3, AXIS * l)) out.push({ o: 'H', v: (a.y + b.y) / 2, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x), n: Math.sign(nin.y), room: r, i });
        else if (Math.abs(dx) <= Math.max(3, AXIS * l)) out.push({ o: 'V', v: (a.x + b.x) / 2, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y), n: Math.sign(nin.x), room: r, i });
      }
    }
    return out;
  }
  /* épaisseur du mur derrière une face (autre face, sens opposé, entre 3 et 30 cm) */
  function thicknessOf(F, f) {
    let best = null;
    for (const g of F) { if (g.o !== f.o || g.n !== -f.n) continue; const d = (f.v - g.v) * f.n; if (d < 30 || d > 300) continue; if (Math.min(f.hi, g.hi) - Math.max(f.lo, g.lo) < 0.3 * Math.min(f.hi - f.lo, g.hi - g.lo)) continue; if (best == null || d < best) best = d; }
    return best;
  }
  function typicalThickness(F) {
    const t = []; for (const f of F) { const d = thicknessOf(F, f); if (d && d <= 200) t.push(d); }
    if (!t.length) return (S.cutThick ?? 7) * 10; t.sort((a, b) => a - b); return Math.round(t[Math.floor(t.length / 2)]);
  }
  const tolMm = () => Math.max(120, Math.min(600, 34 / S.view.z));

  /* ---------- reconnaissance du tracé ---------- */
  function strokeLen(P) { let l = 0; for (let i = 1; i < P.length; i++) l += G.dist(P[i - 1], P[i]); return l; }
  K.recognize = (W) => {
    if (!W || W.length < 4) return { err: 'Tracé trop court' };
    const z = S.view.z, len = strokeLen(W); if (len * z < 50) return { err: 'Tracé trop court' };
    const gap = G.dist(W[0], W[W.length - 1]); const bb = G.bbox(W), diag = Math.hypot(bb.w, bb.h);
    const closed = gap < Math.max(60 / z, 0.3 * diag) && len > 2.2 * diag;
    if (closed) return zone(W);
    const j = joinStroke(W); if (j) return j;
    return line(W);
  };
  const roomAt = (p) => App.rooms().find((r) => G.pointInPoly(p, r.pts));
  function frameFor(room) {
    let th = 0;
    if (room) th = O.angleOf(room.pts); else { let best = 0; for (const r of App.rooms()) { const a = Math.abs(G.area(r.pts)); if (a > best) { best = a; th = O.angleOf(r.pts); } } }
    return O.frame(th);
  }

  /* --- zone entourée → polygone d'équerre, calé sur les murs --- */
  function orthoRuns(P, eps) {
    const Q = G.simplifyDP(P.concat([P[0]]), eps, false); const segs = [];
    for (let i = 1; i < Q.length; i++) { const dx = Q[i].x - Q[i - 1].x, dy = Q[i].y - Q[i - 1].y, l = Math.hypot(dx, dy); if (l < eps) continue; const o = Math.abs(dy) <= 0.5 * Math.abs(dx) ? 'H' : Math.abs(dx) <= 0.5 * Math.abs(dy) ? 'V' : null; if (!o) continue; segs.push({ o, l, v: o === 'H' ? (Q[i].y + Q[i - 1].y) / 2 : (Q[i].x + Q[i - 1].x) / 2 }); }
    const runs = []; for (const s of segs) { const r = runs[runs.length - 1]; if (r && r.o === s.o) { r.v = (r.v * r.l + s.v * s.l) / (r.l + s.l); r.l += s.l; } else runs.push(Object.assign({}, s)); }
    if (runs.length > 1 && runs[0].o === runs[runs.length - 1].o) { const a = runs[0], b = runs.pop(); a.v = (a.v * a.l + b.v * b.l) / (a.l + b.l); a.l += b.l; }
    if (runs.length < 4 || runs.length % 2) return null;
    return runs;
  }
  const runsToPoly = (runs) => runs.map((r, k) => { const nx = runs[(k + 1) % runs.length]; return r.o === 'H' ? { x: nx.v, y: r.v } : { x: r.v, y: nx.v }; });
  function zone(W) {
    const c = G.centroid(W); const home = roomAt(c) || App.rooms().slice().sort((a, b) => G.distPointPoly(c, a.pts) - G.distPointPoly(c, b.pts))[0];
    const fr = frameFor(home); const P = W.map(fr.to); const bb = G.bbox(P); const z = S.view.z;
    let runs = null; const fill = Math.abs(G.area(P)) / Math.max(1, bb.w * bb.h);
    if (fill < 0.78) runs = orthoRuns(P, 16 / z);
    if (runs) { const t = runsToPoly(runs); if (G.isSelfIntersecting(t) || Math.abs(G.area(t)) < 0.2e6) runs = null; }
    if (!runs) runs = [{ o: 'H', v: bb.y0, l: bb.w }, { o: 'V', v: bb.x1, l: bb.h }, { o: 'H', v: bb.y1, l: bb.w }, { o: 'V', v: bb.x0, l: bb.h }];
    // calage de chaque côté sur une face de mur proche, tournée vers l'intérieur de la zone
    const F = faces(fr), tol = tolMm(), tDef = typicalThickness(F); let poly = runsToPoly(runs); const ctr = G.centroid(poly);
    const snapRun = (r, k) => {
      const prev = runs[(k - 1 + runs.length) % runs.length], next = runs[(k + 1) % runs.length]; const lo = Math.min(prev.v, next.v), hi = Math.max(prev.v, next.v);
      const mid = (lo + hi) / 2; const inward = Math.sign((r.o === 'H' ? ctr.y : ctr.x) - r.v) || 1; let best = null;
      // sens « vers l'intérieur » fiable même pour un L : on teste un point juste à côté du milieu du côté
      const probe = (s) => (r.o === 'H' ? { x: mid, y: r.v + s * 30 } : { x: r.v + s * 30, y: mid }); const inn = G.pointInPoly(probe(1), poly) ? 1 : G.pointInPoly(probe(-1), poly) ? -1 : inward;
      for (const f of F) { if (f.o !== r.o || f.n !== inn) continue; const d = Math.abs(f.v - r.v); if (d > tol) continue; const ov = Math.min(hi, f.hi) - Math.max(lo, f.lo); if (ov < Math.min(200, 0.3 * (hi - lo))) continue; if (!best || d < best.d) best = { d, f }; }
      r.inn = inn; r.snap = best ? best.f : null; r.v = best ? best.f.v : Math.round(r.v / 5) * 5; r.t = (best && thicknessOf(F, best.f)) || tDef;
    };
    runs.forEach(snapRun); poly = runsToPoly(runs);
    if (G.isSelfIntersecting(poly) || Math.abs(G.area(poly)) < 0.15e6) return { err: 'Zone trop petite ou tracé à reprendre' };
    if (G.area(poly) < 0) { poly.reverse(); }
    // bandes de cloison le long de chaque côté (sans effet là où il y a déjà un mur)
    const strips = runs.map((r, k) => {
      const prev = runs[(k - 1 + runs.length) % runs.length], next = runs[(k + 1) % runs.length]; const lo = Math.min(prev.v, next.v) - r.t, hi = Math.max(prev.v, next.v) + r.t; const a = r.v, b = r.v - r.inn * r.t;
      return r.o === 'H' ? { x0: lo, x1: hi, y0: Math.min(a, b), y1: Math.max(a, b) } : { y0: lo, y1: hi, x0: Math.min(a, b), x1: Math.max(a, b) };
    });
    return carve({ kind: 'zone', fr, zone: poly, strips, home, tDef });
  }

  /* --- trait → cloison, alignée sur un bout de cloison voisin et prolongée jusqu'aux murs --- */
  function line(W) {
    // pièce du trait : celle qui contient le plus de points du tracé (un trait posé sur un bout de cloison est entre deux)
    const m = W[Math.floor(W.length / 2)]; let home = roomAt(m);
    if (!home) { const cnt = new Map(); for (const w of W) { const r = roomAt(w); if (r) cnt.set(r, (cnt.get(r) || 0) + 1); } home = [...cnt.entries()].sort((x, y) => y[1] - x[1]).map((x) => x[0])[0]; }
    if (!home) { const near = App.rooms().map((r) => ({ r, d: G.distPointPoly(m, r.pts) })).sort((x, y) => x.d - y.d)[0]; if (near && near.d < tolMm()) home = near.r; }
    if (!home) return { err: 'Tracez le trait dans une pièce, d\'un mur à l\'autre' };
    const fr = frameFor(home); const P = W.map(fr.to); const a = P[0], b = P[P.length - 1], dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    const o = dy <= 0.45 * dx ? 'H' : dx <= 0.45 * dy ? 'V' : null; if (!o) return { err: 'Tracez un trait droit, dans le sens d\'un mur' };
    let v = P.reduce((s, p) => s + (o === 'H' ? p.y : p.x), 0) / P.length; const F = faces(fr), tol = tolMm(), tDef = typicalThickness(F);
    const sLo = Math.min(o === 'H' ? a.x : a.y, o === 'H' ? b.x : b.y), sHi = Math.max(o === 'H' ? a.x : a.y, o === 'H' ? b.x : b.y);
    // un bout de cloison (deux faces dos à dos) près du trait : on le prolonge exactement
    let band = null;
    for (const f of F) { if (f.o !== o || f.n !== 1) continue; for (const g of F) { if (g.o !== o || g.n !== -1) continue; const t = f.v - g.v; if (t < 30 || t > 300) continue; const mid = (f.v + g.v) / 2; if (Math.abs(mid - v) > tol) continue; if (Math.min(f.hi, g.hi) - Math.max(f.lo, g.lo) < 40) continue; if (Math.min(f.hi, g.hi) < sLo - tol || Math.max(f.lo, g.lo) > sHi + tol) continue; if (!band || Math.abs(mid - v) < Math.abs((band.a + band.b) / 2 - v)) band = { a: g.v, b: f.v }; } }
    if (!band) {
      // une seule face proche : la cloison part de cette face
      let one = null; for (const f of F) { if (f.o !== o || Math.abs(f.v - v) > tol * 0.5) continue; if (f.hi < sLo - tol || f.lo > sHi + tol) continue; if (!one || Math.abs(f.v - v) < Math.abs(one.v - v)) one = f; }
      if (one && one.room !== home) band = one.n > 0 ? { a: one.v - tDef, b: one.v } : { a: one.v, b: one.v + tDef };
      else { v = Math.round(v / 5) * 5; band = { a: v - tDef / 2, b: v + tDef / 2 }; }
    }
    const c = (band.a + band.b) / 2;
    // étendue : du milieu du trait jusqu'au premier mur de la pièce, de chaque côté
    const R = O.square(home.pts.map(fr.to)); if (!R) return { err: 'Cette pièce a un mur en biais : utilisez « Couper » dans son menu' };
    // étendue : tout le trait, prolongé de chaque bout jusqu'au premier mur (hors de la pièce, la bande n'a pas d'effet)
    let lo = -Infinity, hi = Infinity;
    for (let i = 0; i < R.length; i++) {
      const p = R[i], q = R[(i + 1) % R.length]; const perp = o === 'H' ? Math.abs(p.x - q.x) < 1e-6 : Math.abs(p.y - q.y) < 1e-6; if (!perp) continue;
      const pos = o === 'H' ? p.x : p.y, s0 = Math.min(o === 'H' ? p.y : p.x, o === 'H' ? q.y : q.x), s1 = Math.max(o === 'H' ? p.y : p.x, o === 'H' ? q.y : q.x);
      if (s1 < band.a - 1 || s0 > band.b + 1) continue; if (pos <= sLo + 1) lo = Math.max(lo, pos); if (pos >= sHi - 1) hi = Math.min(hi, pos);
    }
    lo = isFinite(lo) ? Math.min(lo, sLo) : sLo; hi = isFinite(hi) ? Math.max(hi, sHi) : sHi;
    if (hi - lo < 100) return { err: 'Trait trop court' };
    const strip = o === 'H' ? { x0: lo - 6, x1: hi + 6, y0: band.a, y1: band.b } : { y0: lo - 6, y1: hi + 6, x0: band.a, x1: band.b };
    return carve({ kind: 'line', fr, zone: null, strips: [strip], home, tDef, only: home });
  }

  /* ---------- joindre deux cloisons de pièces différentes : une seule cloison entre elles ---------- */
  const inAnyRoom = (p) => !!roomAt(p);
  function joinStroke(W) {
    const a = W[0], b = W[W.length - 1]; const ra = roomAt(a), rb = roomAt(b);
    const outside = W.filter((p) => !inAnyRoom(p)).length / W.length;
    if (ra && rb && ra !== rb) { // trait d'une pièce à l'autre, en travers du mur
      const fr = frameFor(ra); const A0 = fr.to(a), B0 = fr.to(b), dx = Math.abs(B0.x - A0.x), dy = Math.abs(B0.y - A0.y);
      const o = dy <= 0.6 * dx ? 'V' : dx <= 0.6 * dy ? 'H' : null; if (!o) return null; // les murs à joindre sont perpendiculaires au trait
      const along = o === 'V' ? (A0.y + B0.y) / 2 : (A0.x + B0.x) / 2, pa = o === 'V' ? A0.x : A0.y, pb = o === 'V' ? B0.x : B0.y;
      const F = faces(fr); const lo = Math.min(pa, pb), hi = Math.max(pa, pb); const tol = tolMm();
      const pick = (room) => F.filter((f) => f.room === room && f.o === o && f.v >= lo - 1 && f.v <= hi + 1 && along >= f.lo - tol && along <= f.hi + tol && f.n === (room === ra ? (pa < pb ? -1 : 1) : (pa < pb ? 1 : -1))).sort((x, y) => (room === ra ? Math.abs(pb - x.v) - Math.abs(pb - y.v) : Math.abs(pa - x.v) - Math.abs(pa - y.v)))[0];
      const fa = pick(ra), fb = pick(rb); if (!fa || !fb) return { err: 'Pas de murs face à face entre ces deux pièces' };
      return joinFaces(fr, F, fa, fb, null);
    }
    if (outside < 0.6) return null; // trait dans une pièce : c'est une cloison à fermer
    // trait le long de l'espace entre deux pièces
    const near = App.rooms().map((r) => ({ r, d: G.distPointPoly(W[Math.floor(W.length / 2)], r.pts) })).sort((x, y) => x.d - y.d)[0]; if (!near) return null;
    const fr = frameFor(near.r); const P = W.map(fr.to); const p0 = P[0], p1 = P[P.length - 1], dx = Math.abs(p1.x - p0.x), dy = Math.abs(p1.y - p0.y);
    const o = dy <= 0.45 * dx ? 'H' : dx <= 0.45 * dy ? 'V' : null; if (!o) return null;
    const v = P.reduce((t, p) => t + (o === 'H' ? p.y : p.x), 0) / P.length; const sLo = Math.min(o === 'H' ? p0.x : p0.y, o === 'H' ? p1.x : p1.y), sHi = Math.max(o === 'H' ? p0.x : p0.y, o === 'H' ? p1.x : p1.y);
    const F = faces(fr), tol = tolMm(); const ok = (f) => f.o === o && f.hi > sLo - tol && f.lo < sHi + tol;
    const fa = F.filter((f) => ok(f) && f.n === -1 && f.v <= v + 30 && v - f.v < 1500).sort((x, y) => y.v - x.v)[0];
    const fb = F.filter((f) => ok(f) && f.n === 1 && f.v >= v - 30 && f.v - v < 1500 && (!fa || f.room !== fa.room)).sort((x, y) => x.v - y.v)[0];
    if (!fa || !fb || fa.room === fb.room) return null;
    return joinFaces(fr, F, fa, fb, v);
  }
  /* fa : face d'une pièce tournée vers le haut du repère (pièce en dessous), fb : face de l'autre pièce, au-dessus */
  function joinFaces(fr, F, fa, fb, cPref) {
    if (fa.v > fb.v) { const t = fa; fa = fb; fb = t; }
    const gap = fb.v - fa.v, t = typicalThickness(F), o = fa.o;
    const lo = Math.max(fa.lo, fb.lo), hi = Math.min(fa.hi, fb.hi);
    if (hi - lo < 200) return { err: 'Ces deux murs ne se font pas face' };
    if (gap > 1500) return { err: 'Murs trop éloignés pour n\'en faire qu\'une cloison' };
    if (Math.abs(gap - t) < 15) return { err: `${fa.room.name || 'Pièce'} et ${fb.room.name || 'pièce'} : déjà une seule cloison de ${App.fmtCm(gap, 0)} cm` };
    const mid = (fa.v + fb.v) / 2; let c = mid;
    if (cPref != null && Math.abs(cPref - mid) > Math.max(gap / 4, 20 / S.view.z) && gap > t) c = Math.max(fa.v + t / 2, Math.min(fb.v - t / 2, cPref));
    const b0 = c - t / 2, b1 = c + t / 2;
    const R = (u0, u1, w0, w1) => (o === 'H' ? { x0: u0, x1: u1, y0: Math.min(w0, w1), y1: Math.max(w0, w1) } : { y0: u0, y1: u1, x0: Math.min(w0, w1), x1: Math.max(w0, w1) });
    const band = R(lo, hi, b0, b1), rA = b0 > fa.v ? R(lo, hi, fa.v, b0) : null, rB = b1 < fb.v ? R(lo, hi, b1, fb.v) : null;
    // pas une autre pièce dans l'espace comblé
    for (const r of App.rooms()) {
      if (r === fa.room || r === fb.room) continue; const P = r.pts.map(fr.to);
      for (const box of [rA, rB, band]) { if (!box) continue; const ctr = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 }; if (G.pointInPoly(ctr, P) || P.some((p) => O.inRect({ x0: box.x0 + 5, x1: box.x1 - 5, y0: box.y0 + 5, y1: box.y1 - 5 }, p.x, p.y))) return { err: `${r.name || 'Une autre pièce'} est entre les deux` }; }
    }
    const out = { kind: 'join', fr, add: [], remove: [], strips: [O.rect(band.x0, band.y0, band.x1, band.y1).map(fr.from)], zone: null, gap, t, names: [fa.room.name || 'Pièce', fb.room.name || 'Pièce'] };
    for (const [f, box] of [[fa, rA], [fb, rB]]) {
      const P = O.square(f.room.pts.map(fr.to)); if (!P) return { err: `${f.room.name || 'Pièce'} a un mur en biais` };
      const xs = O.coords(P.map((p) => p.x).concat([band.x0, band.x1], box ? [box.x0, box.x1] : [])), ys = O.coords(P.map((p) => p.y).concat([band.y0, band.y1], box ? [box.y0, box.y1] : []));
      const loops = O.trace(xs, ys, (x, y) => (G.pointInPoly({ x, y }, P) || (box && O.inRect(box, x, y))) && !O.inRect(band, x, y));
      const pos = loops.filter((l) => G.area(l) > 0.1e6); if (pos.length !== 1 || loops.some((l) => G.area(l) < 0)) return { err: 'Jonction impossible ici (la pièce serait coupée)' };
      out.remove.push(f.room); out.add.push({ pts: pos[0].map(fr.from), from: f.room, keep: true, srcs: [f.room], tol: Math.abs(f.v - (f === fa ? b0 : b1)) + 40 });
    }
    return out;
  }
  K.joinCandidate = (room, i) => {
    const fr = O.frame(O.angleOf(room.pts)); const F = faces(fr); const f = F.find((x) => x.room === room && x.i === i); if (!f) return null;
    const t = typicalThickness(F); let best = null;
    for (const g of F) { if (g.room === room || g.o !== f.o || g.n !== -f.n) continue; const d = (g.v - f.v) * -f.n; if (d < 20 || d > 1500) continue; if (Math.min(f.hi, g.hi) - Math.max(f.lo, g.lo) < 200) continue; if (!best || d < best.d) best = { g, d }; }
    if (!best || Math.abs(best.d - t) < 15) return null;
    return { room: best.g.room, gap: best.d, t, plan: () => joinFaces(fr, F, f, best.g, null) };
  };
  K.joinWall = (room, i) => { const c = K.joinCandidate(room, i); if (!c) return; const plan = c.plan(); if (!plan || plan.err) { App.toast((plan && plan.err) || 'Jonction impossible'); return; } S.skPlan = plan; App.ui.refresh(); App.render(); };

  /* ---------- redécoupage des pièces touchées ---------- */
  function carve(q) {
    const { fr } = q; const zb = q.zone ? G.bbox(q.zone) : null; const out = { kind: q.kind, fr, add: [], remove: [], strips: [], err: null };
    const inStrip = (x, y) => q.strips.some((s) => O.inRect(s, x, y)); const inZone = (x, y) => q.zone && G.pointInPoly({ x, y }, q.zone);
    const rooms = q.only ? [q.only] : App.rooms(); const skew = [];
    for (const r of rooms) {
      if (r.locked) continue; const P0 = r.pts.map(fr.to); const b = G.bbox(P0);
      const near = q.strips.some((s) => s.x1 > b.x0 && s.x0 < b.x1 && s.y1 > b.y0 && s.y0 < b.y1) || (zb && zb.x1 > b.x0 && zb.x0 < b.x1 && zb.y1 > b.y0 && zb.y0 < b.y1); if (!near) continue;
      const P = O.square(P0); if (!P) { skew.push(r); continue; }
      const xs = O.coords(P.map((p) => p.x).concat(q.zone ? q.zone.map((p) => p.x) : [], q.strips.flatMap((s) => [s.x0, s.x1])));
      const ys = O.coords(P.map((p) => p.y).concat(q.zone ? q.zone.map((p) => p.y) : [], q.strips.flatMap((s) => [s.y0, s.y1])));
      let lost = 0; const loops = O.trace(xs, ys, (x, y, i, j) => { if (!G.pointInPoly({ x, y }, P)) return false; if (inZone(x, y) || inStrip(x, y)) { lost += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]); return false; } return true; });
      if (lost < (q.kind === 'line' ? 1000 : 0.03e6)) continue; // la pièce n'est pas vraiment touchée (un trait peut ne fermer qu'une fente de quelques cm)
      if (loops.some((l) => G.area(l) < 0)) return { err: 'La zone doit toucher au moins un mur de la pièce (sinon elle ferait un îlot au milieu)' };
      const parts = loops.filter((l) => G.area(l) > 0.1e6).sort((a, b) => G.area(b) - G.area(a));
      out.remove.push(r); parts.forEach((l, k) => out.add.push({ pts: l.map(fr.from), from: r, keep: k === 0 }));
      out.touched = (out.touched || []).concat([{ r, lost, left: parts.length }]);
    }
    if (q.kind === 'line') {
      const t = out.touched && out.touched[0]; if (!t || t.left < 2) return { err: 'Ce trait ne sépare pas la pièce en deux : tracez-le d\'un mur à l\'autre' };
    } else {
      if (skew.some((r) => G.pointInPoly(fr.to(G.centroid(r.pts)), q.zone))) return { err: 'Une pièce avec un mur en biais est dans la zone : utilisez « Couper » dans son menu' };
      const main = (out.touched || []).slice().sort((a, b) => b.lost - a.lost)[0];
      out.add.push({ pts: q.zone.map(fr.from), from: main ? main.r : q.home, isNew: true, replaces: main && main.left === 0 ? main.r : null });
    }
    out.strips = q.strips.map((s) => O.rect(s.x0, s.y0, s.x1, s.y1).map(fr.from));
    out.zone = q.zone ? q.zone.map(fr.from) : null;
    if (q.zone) { const b = G.bbox(q.zone); out.dims = [b.w, b.h]; out.area = Math.abs(G.area(q.zone)); }
    out.count = out.add.length - out.remove.length;
    return out;
  }

  /* ---------- geste ---------- */
  K.begin = (w) => { K.cancel(true); S.sketch = [w]; };
  K.add = (w) => { const P = S.sketch; if (!P) return; if (G.dist(P[P.length - 1], w) * S.view.z > 3) P.push(w); };
  K.finish = () => {
    const P = S.sketch; S.sketch = null; if (!P) return;
    const plan = K.recognize(P); if (!plan || plan.err) { App.toast((plan && plan.err) || 'Tracé non reconnu'); App.render(); return; }
    S.skPlan = plan; App.ui.refresh(); App.ui.refreshHint(); App.render();
  };
  K.cancel = (silent) => { const had = S.skPlan || S.sketch; S.sketch = null; S.skPlan = null; if (had && !silent) { App.ui.refresh(); App.ui.refreshHint(); App.render(); } };
  K.validate = () => {
    const plan = S.skPlan; if (!plan) return; S.skPlan = null; let sel = null;
    App.mutate((P) => {
      const olds = plan.remove; const made = [];
      for (const a of plan.add) {
        const src = a.from; const base = { floor: S.p.floorId, parquet: src ? src.parquet : true, ceiling: src ? src.ceiling : undefined, cal: src && src.cal ? Object.assign({}, src.cal, { start: 'auto' }) : undefined };
        const sh = App.makeShape('piece', G.cleanPoly(a.pts, 0.2, 1), Object.assign(base, { name: a.isNew ? (a.replaces ? a.replaces.name : 'Pièce') : a.keep ? src.name : 'Pièce' }));
        if (a.keep && !a.isNew) sh.id = src.id; if (a.isNew && a.replaces) sh.id = a.replaces.id;
        if (src && src.noParquet != null) sh.noParquet = src.noParquet;
        sh.openings = App.feat.reattach(sh.pts, a.srcs || olds, [], a.tol || 40).map((o) => Object.assign({}, o, { oid: App.uid() }));
        const m = PL.solver.measure(sh.pts); sh.locks = PL.solver.syncLocks(sh.pts, m.A.map((x) => ({ L: false, A: Math.abs(G.deg(x) - 90) < 0.05 || Math.abs(G.deg(x) - 270) < 0.05 })));
        made.push(sh); if (a.isNew || (plan.kind === 'line' && !a.keep)) sel = sh;
      }
      const gone = new Set(olds.map((r) => r.id)); P.shapes = P.shapes.filter((x) => !gone.has(x.id)); P.shapes.push(...made);
    });
    App.ui.setTool('select'); App.ui.refreshHint(); if (sel) { S.sel = { id: sel.id }; App.ui.onSelect(); }
    if (plan.kind === 'join') { App.toast(`Une seule cloison de ${App.fmtCm(plan.t, 0)} cm entre ${plan.names.join(' et ')}`); return; }
    App.toast(plan.kind === 'line' ? 'Cloison fermée : deux pièces. Ajoutez une porte avec « + Porte » si besoin' : 'Pièce créée — renommez-la, ajoutez une porte sur la nouvelle cloison si besoin');
  };
  K.summary = () => {
    const p = S.skPlan; if (!p) return '';
    if (p.kind === 'join') return `${p.names.join(' + ')} · écart ${App.fmtCm(p.gap, 0)} → cloison ${App.fmtCm(p.t, 0)} cm`;
    if (p.kind === 'line') return `${p.remove.map((r) => r.name || 'Pièce').join(', ')} coupée en ${p.add.length} · ${p.add.map((x) => App.fmtM2(Math.abs(G.area(x.pts)))).join(' + ')} m²`;
    return `${App.fmtCm(p.dims[0], 0)} × ${App.fmtCm(p.dims[1], 0)} cm · ${App.fmtM2(p.area)} m²`;
  };
})();
