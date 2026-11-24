/* Calepin — redimensionner un objet ou une pièce d'un geste, sans toucher les points un par un.
   Cadre aligné sur la forme : les points au milieu des bords étirent dans un sens, les coins dans les deux.
   Les angles sont gardés : une forme d'équerre reste d'équerre ; une forme avec des angles quelconques
   est agrandie ou réduite en gardant ses proportions. */
(function () {
  const PL = globalThis.PL, G = PL.geom, O = PL.ortho, App = globalThis.App, S = App.state;
  const R = (App.resize = {});
  const MIN = 100;

  R.active = (s) => !!(s && s.pts && s.pts.length >= 3 && !s.locked && s.kind !== 'elec' && !s.a && !S.editPts && (s.kind !== 'piece' || S.resizeRoom === s.id));
  R.frameOf = (s) => {
    const th = s.kind === 'meuble' && s.pts.length >= 2 ? Math.atan2(s.pts[1].y - s.pts[0].y, s.pts[1].x - s.pts[0].x) : O.angleOf(s.pts);
    return O.frame(th);
  };
  R.box = (s, pts = s.pts) => {
    const fr = R.frameOf(s); const P = pts.map(fr.to); const b = G.bbox(P);
    const sq = O.square(P); const ortho = !!sq && sq.every((q, i) => G.dist(q, P[i]) < 3);
    return { fr, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, w: b.w, h: b.h, ortho };
  };
  R.handles = (s) => {
    const b = R.box(s); const pt = (x, y) => b.fr.from({ x, y }); const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2; const out = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push({ kind: 'corner', sx, sy, w: pt(sx < 0 ? b.x0 : b.x1, sy < 0 ? b.y0 : b.y1) });
    out.push({ kind: 'edge', sx: -1, sy: 0, w: pt(b.x0, my) }, { kind: 'edge', sx: 1, sy: 0, w: pt(b.x1, my) }, { kind: 'edge', sx: 0, sy: -1, w: pt(mx, b.y0) }, { kind: 'edge', sx: 0, sy: 1, w: pt(mx, b.y1) });
    return { b, list: out };
  };
  R.hit = (s, sp) => {
    if (!R.active(s)) return null; const H = R.handles(s); let best = null;
    for (const h of H.list) { const q = App.w2s(h.w); const d = G.dist(q, sp); if (d < (h.kind === 'edge' ? 20 : 18) && (!best || d < best.d)) best = { d, h }; }
    return best ? best.h : null;
  };

  /* faces de mur tournées vers la forme, parallèles à un côté du cadre (o : 'V' pour les côtés gauche/droit) */
  R.snapOn = () => S.p.snapWalls !== false;
  /* lignes où caler un côté : la face d'une pièce qui contient la forme (meuble contre son mur), ou, pour une forme
     hors pièce (escalier dans sa trémie), la face de la pièce voisine et l'autre face de la cloison (épaisseur habituelle) */
  function wallFor(s, fr, b, o, side, target, tol) {
    const F = App.sketch.faces(fr), t = App.sketch.thickness(F); const lo = o === 'V' ? b.y0 : b.x0, hi = o === 'V' ? b.y1 : b.x1; let best = null;
    for (const f of F) {
      if (f.o !== o || f.room === s) continue; const ov = Math.min(hi, f.hi) - Math.max(lo, f.lo); if (ov < Math.min(200, 0.3 * (hi - lo))) continue;
      const cands = f.n === -side ? [f.v] : [f.v, f.v - side * t];
      for (const v of cands) { const d = Math.abs(v - target); if (d <= tol && (!best || d < best.d)) best = { d, f, v }; }
    }
    return best && Object.assign({}, best.f, { v: best.v });
  }
  /* calage d'un côté : contre le mur de la pièce qui contient la forme, ou contre la pièce voisine si le côté la touche ou
     déborde dessus ; un côté déjà séparé d'une pièce voisine par l'épaisseur d'un mur (6 à 30 cm) ne bouge pas */
  function fitSide(s, fr, b, o, side, cur) {
    const F = App.sketch.faces(fr); const lo = o === 'V' ? b.y0 : b.x0, hi = o === 'V' ? b.y1 : b.x1; const items = [];
    for (const f of F) {
      if (f.o !== o || f.room === s) continue; const ov = Math.min(hi, f.hi) - Math.max(lo, f.lo); if (ov < Math.min(200, 0.3 * (hi - lo))) continue;
      if (f.n === -side) { const d = Math.abs(f.v - cur); if (d <= 400) items.push({ d, v: f.v }); continue; }
      const g = (f.v - cur) * side;
      if (Math.abs(g) <= 60) items.push({ d: Math.abs(g), v: f.v }); else if (g > 60 && g <= 300) items.push({ d: g, v: null }); else if (g < -60 && g > -800) items.push({ d: -g, v: f.v });
    }
    items.sort((x, y) => x.d - y.d); return items.length ? items[0].v : null;
  }
  const faceSeg = (fr, f) => (f.o === 'V' ? [fr.from({ x: f.v, y: f.lo }), fr.from({ x: f.v, y: f.hi })] : [fr.from({ x: f.lo, y: f.v }), fr.from({ x: f.hi, y: f.v })]);

  /* nouveau contour depuis l'état de départ (orig), la poignée tenue et la position du doigt (monde) */
  R.apply = (s, orig, origOps, h, w) => {
    const b = R.box(s, orig); const fr = b.fr; const p = fr.to(w);
    const ax = h.sx > 0 ? b.x0 : b.x1, ay = h.sy > 0 ? b.y0 : b.y1; // côté fixe (opposé à la poignée)
    const cx = h.sx > 0 ? b.x1 : b.x0, cy = h.sy > 0 ? b.y1 : b.y0;
    const snapLen = (L) => Math.max(MIN, Math.round(L / 10) * 10);
    let kx = 1, ky = 1; const snaps = []; let onX = false, onY = false;
    // aimant : le bord qui bouge se colle à la cloison la plus proche (longueur exacte, sans arrondi)
    if (R.snapOn() && b.ortho && s.kind !== 'piece') {
      const tol = Math.min(300, 18 / S.view.z);
      const clip = (f, lo, hi) => Object.assign({}, f, { lo: Math.max(f.lo, lo - 300), hi: Math.min(f.hi, hi + 300) }); // trait rouge limité autour de la forme
      if (h.sx) { const f = wallFor(s, fr, b, 'V', h.sx, p.x, tol); if (f) { p.x = f.v; onX = true; snaps.push(faceSeg(fr, clip(f, b.y0, b.y1))); } }
      if (h.sy) { const f = wallFor(s, fr, b, 'H', h.sy, p.y, tol); if (f) { p.y = f.v; onY = true; snaps.push(faceSeg(fr, clip(f, b.x0, b.x1))); } }
    }
    if (h.sx) kx = (onX ? Math.max(MIN, Math.abs(p.x - ax)) : snapLen(Math.abs(p.x - ax))) / Math.max(1, b.w);
    if (h.sy) ky = (onY ? Math.max(MIN, Math.abs(p.y - ay)) : snapLen(Math.abs(p.y - ay))) / Math.max(1, b.h);
    S.resizeSnap = snaps;
    if (h.sx && Math.sign(p.x - ax) !== Math.sign(cx - ax)) kx = MIN / Math.max(1, b.w);
    if (h.sy && Math.sign(p.y - ay) !== Math.sign(cy - ay)) ky = MIN / Math.max(1, b.h);
    let uniform = !b.ortho;
    if (uniform) { // angles quelconques : on garde les proportions (et donc tous les angles)
      const k = h.sx && h.sy ? Math.max(kx, ky) : h.sx ? kx : ky; kx = ky = k;
    }
    const oxp = h.sx ? ax : (b.x0 + b.x1) / 2, oyp = h.sy ? ay : (b.y0 + b.y1) / 2; // en proportionnel par un bord, on reste centré sur l'autre axe
    const T = (q) => { const f = fr.to(q); return fr.from({ x: oxp + (f.x - oxp) * kx, y: oyp + (f.y - oyp) * ky }); };
    s.pts = orig.map(T);
    if (s.kind === 'piece' && origOps) {
      s.openings = origOps.map((o0) => {
        const o = Object.assign({}, o0); const n = orig.length; if (o.wall >= n) return o;
        const a0 = orig[o.wall], b0 = orig[(o.wall + 1) % n], d0 = G.norm(G.sub(b0, a0)); const c0 = G.add(a0, G.mul(d0, o.pos + o.width / 2));
        const a1 = s.pts[o.wall], b1 = s.pts[(o.wall + 1) % n], el = G.dist(a1, b1), d1 = G.norm(G.sub(b1, a1)); const c1 = T(c0);
        o.width = Math.min(o.width, Math.max(300, el - 20)); o.pos = Math.max(0, Math.min(el - o.width, G.dot(G.sub(c1, a1), d1) - o.width / 2));
        return o;
      });
    }
    const nb = R.box(s); return { w: nb.w, h: nb.h, uniform, k: kx };
  };
  /* caler d'un coup chaque côté du cadre sur la cloison voisine (moins de 40 cm) */
  R.fitWalls = (s) => {
    const b = R.box(s); if (!b.ortho) return 0; const fr = b.fr; let n = 0; const nb = { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 };
    for (const [o, side, key] of [['V', -1, 'x0'], ['V', 1, 'x1'], ['H', -1, 'y0'], ['H', 1, 'y1']]) { const v = fitSide(s, fr, b, o, side, b[key]); if (v != null && Math.abs(v - b[key]) > 0.5) { nb[key] = v; n++; } }
    if (!n || nb.x1 - nb.x0 < MIN || nb.y1 - nb.y0 < MIN) return 0;
    const T = (q) => { const f = fr.to(q); return fr.from({ x: nb.x0 + ((f.x - b.x0) * (nb.x1 - nb.x0)) / b.w, y: nb.y0 + ((f.y - b.y0) * (nb.y1 - nb.y0)) / b.h }); };
    App.mutate(() => { s.pts = s.pts.map(T); if (s.stair && s.stair.start) s.stair.start = T(s.stair.start); });
    return n;
  };
  R.label = (s, info) => `${App.fmtCm(info.w, 0)} × ${App.fmtCm(info.h, 0)} cm${info.uniform ? ' · proportions gardées' : ''}${S.resizeSnap && S.resizeSnap.length ? ' · calé sur le mur' : ''}`;
  /* après coup : les longueurs verrouillées qui ont changé ne le sont plus (les angles restent) */
  R.finish = (s, orig) => {
    if (!s.locks) return; const n = s.pts.length;
    s.locks = s.locks.map((lk, i) => { const L0 = G.dist(orig[i], orig[(i + 1) % n]), L1 = G.dist(s.pts[i], s.pts[(i + 1) % n]); return Math.abs(L1 - L0) > 1 ? Object.assign({}, lk, { L: false }) : lk; });
    s.locks = PL.solver.syncLocks(s.pts, s.locks);
  };
})();
