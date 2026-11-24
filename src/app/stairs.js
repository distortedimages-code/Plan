/* Calepin — escaliers droits, en L (quart tournant) ou en U (demi-tournant).
   La forme est lue sur le contour : découpé en cases (une par volée ou par angle), on y trace la ligne de foulée
   du départ à l'arrivée ; les marches sont réparties dessus, droites dans les volées, rayonnantes dans les angles. */
(function () {
  const PL = globalThis.PL, G = PL.geom, O = PL.ortho, App = globalThis.App, S = App.state;
  const St = (App.stairs = {});

  /* ---------- lecture de la forme ---------- */
  St.layout = (s) => {
    const fr = O.frame(O.angleOf(s.pts)); const P = O.square(s.pts.map(fr.to)); if (!P) return null;
    const xs = O.coords(P.map((p) => p.x), 3), ys = O.coords(P.map((p) => p.y), 3);
    const cells = [];
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) { const c = { x: (xs[i] + xs[i + 1]) / 2, y: (ys[j] + ys[j + 1]) / 2 }; if (G.pointInPoly(c, P)) cells.push({ i, j, x0: xs[i], x1: xs[i + 1], y0: ys[j], y1: ys[j + 1], c }); }
    if (!cells.length || cells.length > 12) return null;
    const key = (i, j) => i + ',' + j; const at = new Map(cells.map((c) => [key(c.i, c.j), c]));
    const nb = (c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => at.get(key(c.i + a, c.j + b))).filter(Boolean);
    let chain;
    if (cells.length === 1) chain = cells;
    else {
      if (cells.some((c) => nb(c).length > 2)) return null; const ends = cells.filter((c) => nb(c).length === 1); if (ends.length !== 2) return null;
      chain = [ends[0]]; const seen = new Set([ends[0]]);
      while (chain.length < cells.length) { const n = nb(chain[chain.length - 1]).find((x) => !seen.has(x)); if (!n) return null; seen.add(n); chain.push(n); }
    }
    // ligne de foulée (dans le repère)
    const dir = (a, b) => ({ x: Math.sign(b.i - a.i), y: Math.sign(b.j - a.j) });
    const pts = [], corners = [];
    if (chain.length === 1) { const c = chain[0]; const hor = c.x1 - c.x0 >= c.y1 - c.y0; pts.push(hor ? { x: c.x0, y: c.c.y } : { x: c.c.x, y: c.y0 }, hor ? { x: c.x1, y: c.c.y } : { x: c.c.x, y: c.y1 }); }
    else {
      const d0 = dir(chain[0], chain[1]), c0 = chain[0]; pts.push({ x: d0.x ? (d0.x > 0 ? c0.x0 : c0.x1) : c0.c.x, y: d0.y ? (d0.y > 0 ? c0.y0 : c0.y1) : c0.c.y });
      for (let k = 1; k < chain.length - 1; k++) {
        const a = dir(chain[k - 1], chain[k]), b = dir(chain[k], chain[k + 1]); if (a.x === b.x && a.y === b.y) continue; const c = chain[k];
        pts.push(c.c); const dx = b.x - a.x, dy = b.y - a.y; corners.push({ cell: c, inner: { x: dx > 0 ? c.x1 : dx < 0 ? c.x0 : c.c.x, y: dy > 0 ? c.y1 : dy < 0 ? c.y0 : c.c.y } });
      }
      const n = chain.length, d1 = dir(chain[n - 2], chain[n - 1]), c1 = chain[n - 1]; pts.push({ x: d1.x ? (d1.x > 0 ? c1.x1 : c1.x0) : c1.c.x, y: d1.y ? (d1.y > 0 ? c1.y1 : c1.y0) : c1.c.y });
    }
    let path = pts, cs = corners;
    // sens : du départ (bas de l'escalier) vers l'arrivée
    const st = s.stair && s.stair.start ? fr.to(s.stair.start) : null;
    if (st && G.dist(st, path[path.length - 1]) < G.dist(st, path[0])) { path = path.slice().reverse(); cs = cs.slice().reverse(); }
    const segs = []; let L = 0; for (let k = 1; k < path.length; k++) { const l = G.dist(path[k - 1], path[k]); segs.push({ a: path[k - 1], b: path[k], l, t0: L }); L += l; }
    const kind = cs.length === 0 ? 'Droit' : cs.length === 1 ? 'Quart tournant' : cs.length === 2 ? (G.cross(G.sub(path[1], path[0]), G.sub(path[2], path[1])) * G.cross(G.sub(path[2], path[1]), G.sub(path[3], path[2])) > 0 ? 'Demi-tournant' : 'Deux quarts tournants') : 'Tournant';
    return { fr, cells: chain, path, corners: cs, segs, L, kind };
  };
  St.kindName = (s) => { const l = St.layout(s); return l ? l.kind : 'Forme libre'; };

  /* marches : pour chacune, un segment (repère) — droit dans une volée, rayonnant depuis l'angle intérieur dans un tournant */
  St.treads = (s, lay) => {
    const n = Math.max(2, (s.stair && s.stair.steps) || Math.round(lay.L / 250)); const out = [];
    const pointAt = (t) => { for (const g of lay.segs) if (t <= g.t0 + g.l + 1e-6) { const u = (t - g.t0) / g.l; return { p: G.lerp(g.a, g.b, u), d: G.norm(G.sub(g.b, g.a)) }; } const g = lay.segs[lay.segs.length - 1]; return { p: g.b, d: G.norm(G.sub(g.b, g.a)) }; };
    const cellOf = (p) => lay.cells.find((c) => p.x >= c.x0 - 1 && p.x <= c.x1 + 1 && p.y >= c.y0 - 1 && p.y <= c.y1 + 1);
    const exit = (c, o, u) => { let t = Infinity; if (u.x > 1e-9) t = Math.min(t, (c.x1 - o.x) / u.x); if (u.x < -1e-9) t = Math.min(t, (c.x0 - o.x) / u.x); if (u.y > 1e-9) t = Math.min(t, (c.y1 - o.y) / u.y); if (u.y < -1e-9) t = Math.min(t, (c.y0 - o.y) / u.y); return G.add(o, G.mul(u, t)); };
    for (let k = 1; k < n; k++) {
      const { p, d } = pointAt((k * lay.L) / n); const c = cellOf(p); if (!c) continue; const corner = lay.corners.find((q) => q.cell === c);
      if (corner && G.dist(p, corner.inner) > 1) { const u = G.norm(G.sub(p, corner.inner)); out.push({ a: corner.inner, b: exit(c, corner.inner, u), turn: true }); }
      else { const nrm = { x: -d.y, y: d.x }; out.push({ a: exit(c, p, G.mul(nrm, -1)), b: exit(c, p, nrm) }); }
    }
    // numéros au milieu de chaque marche
    const nums = []; for (let k = 0; k < n; k++) nums.push(pointAt(((k + 0.5) * lay.L) / n).p);
    return { n, lines: out, nums };
  };

  /* ---------- assembler un escalier et une pièce (ou un autre escalier) qui le prolonge ---------- */
  const touches = (A, B) => { for (const p of A) if (G.pointInPoly(p, B) || G.distPointPoly(p, B) < 40) return true; for (const p of B) if (G.pointInPoly(p, A) || G.distPointPoly(p, A) < 40) return true; return false; };
  St.candidates = (s) => App.shapesOn(s.floor).filter((o) => o !== s && (o.kind === 'escalier' || (o.kind === 'piece' && Math.abs(G.area(o.pts)) < 8e6)) && touches(s.pts, o.pts));
  St.stairsTouching = (room) => App.shapesOn(room.floor).filter((o) => o.kind === 'escalier' && touches(o.pts, room.pts));
  St.union = (s, o) => {
    const fr = O.frame(O.angleOf(s.pts)); const A = s.pts.map(fr.to), B = o.pts.map(fr.to);
    const xs = O.coords(A.concat(B).map((p) => p.x)), ys = O.coords(A.concat(B).map((p) => p.y));
    const loops = O.trace(xs, ys, (x, y) => G.pointInPoly({ x, y }, A) || G.pointInPoly({ x, y }, B)).filter((l) => G.area(l) > 0.05e6);
    if (loops.length !== 1) return null;
    return G.cleanPoly(loops[0].map(fr.from), 0.5, 3);
  };
  St.assemble = (s, o) => {
    const pts = St.union(s, o); if (!pts) { App.toast('L\'escalier et cette zone ne se touchent pas'); return false; }
    App.mutate((P) => {
      const far = (() => { const tmp = Object.assign({}, s, { pts, stair: Object.assign({}, s.stair, { start: null }) }); const lay = St.layout(tmp); if (!lay) return null; const oc = lay.fr.to(G.centroid(o.pts)); const a = lay.path[0], b = lay.path[lay.path.length - 1]; return lay.fr.from(G.dist(a, oc) > G.dist(b, oc) ? a : b); })();
      s.pts = G.ensureCCW(pts); s.locks = s.pts.map(() => ({ L: false, A: false })); s.stair = Object.assign({ dir: 'monte' }, s.stair, o.kind === 'escalier' && o.stair && o.stair.steps && s.stair && s.stair.steps ? { steps: s.stair.steps + o.stair.steps } : {}, far ? { start: far } : {});
      P.shapes = P.shapes.filter((x) => x.id !== o.id);
    });
    S.sel = { id: s.id }; App.ui.refresh();
    App.toast(`Escalier ${St.kindName(s).toLowerCase()} — touchez « Inverser » si le départ n'est pas au bon bout`); return true;
  };
  St.flip = (s) => { const lay = St.layout(s); if (!lay) return; App.mutate(() => { s.stair = Object.assign({}, s.stair, { start: lay.fr.from(lay.path[lay.path.length - 1]), userSet: true }); }); };
})();
