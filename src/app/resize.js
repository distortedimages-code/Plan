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

  /* nouveau contour depuis l'état de départ (orig), la poignée tenue et la position du doigt (monde) */
  R.apply = (s, orig, origOps, h, w) => {
    const b = R.box(s, orig); const fr = b.fr; const p = fr.to(w);
    const ax = h.sx > 0 ? b.x0 : b.x1, ay = h.sy > 0 ? b.y0 : b.y1; // côté fixe (opposé à la poignée)
    const cx = h.sx > 0 ? b.x1 : b.x0, cy = h.sy > 0 ? b.y1 : b.y0;
    const snapLen = (L) => Math.max(MIN, Math.round(L / 10) * 10);
    let kx = 1, ky = 1;
    if (h.sx) kx = snapLen(Math.abs(p.x - ax)) / Math.max(1, b.w); if (h.sy) ky = snapLen(Math.abs(p.y - ay)) / Math.max(1, b.h);
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
  R.label = (s, info) => `${App.fmtCm(info.w, 0)} × ${App.fmtCm(info.h, 0)} cm${info.uniform ? ' · proportions gardées' : ''}`;
  /* après coup : les longueurs verrouillées qui ont changé ne le sont plus (les angles restent) */
  R.finish = (s, orig) => {
    if (!s.locks) return; const n = s.pts.length;
    s.locks = s.locks.map((lk, i) => { const L0 = G.dist(orig[i], orig[(i + 1) % n]), L1 = G.dist(s.pts[i], s.pts[(i + 1) % n]); return Math.abs(L1 - L0) > 1 ? Object.assign({}, lk, { L: false }) : lk; });
    s.locks = PL.solver.syncLocks(s.pts, s.locks);
  };
})();
