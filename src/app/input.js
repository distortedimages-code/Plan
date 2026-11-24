/* Calepin — interactions : navigation, sélection, outils, aimantation. */
(function () {
  const PL = globalThis.PL, G = PL.geom, App = globalThis.App, S = App.state;
  const ptrs = new Map(); let gest = null, act = null, lastTap = 0, cvEl = null;
  const TAP = 8;

  App.initInput = (canvas) => {
    cvEl = canvas;
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !ptrs.size) { S.snapMark = null; if (S.draft) { S.draft.cursor = null; } App.render(); } });
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', key);
  };
  const local = (e) => { const r = cvEl.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  /* ---------- aimantation ---------- */
  App.snap = (sp, o = {}) => {
    const w = App.s2w(sp), z = S.view.z, R = (o.r || 16) / z; let best = null;
    const consider = (p, kind, pri = 0) => { const d = G.dist(p, w) - pri / z; if (d < R && (!best || d < best.d)) best = { d, p: { x: p.x, y: p.y }, kind }; };
    const fid = S.p.floorId;
    for (const s of App.shapesOn(fid)) s.pts.forEach((p, i) => { if (o.skip && o.skip.id === s.id && (o.skip.v == null || o.skip.v === i)) return; consider(p, 'sommet', 4); });
    for (const m of App.measuresOn(fid)) { consider(m.a, 'sommet', 2); consider(m.b, 'sommet', 2); }
    const bg = S.bgs[fid];
    if (bg && bg.grid && S.layers.fond) bg.grid.query(w.x - R, w.y - R, w.x + R, w.y + R, (i) => consider(bg.pts[i], 'fond', 1));
    if (!best) {
      let eb = null; const er = 10 / z;
      const edge = (a, b) => { const pr = G.projSeg(w, a, b); const d = G.dist(pr.p, w); if (d < er && (!eb || d < eb.d)) eb = { d, p: pr.p, kind: 'bord' }; };
      for (const s of App.shapesOn(fid)) { if (o.skip && o.skip.id === s.id) continue; for (let i = 0; i < s.pts.length; i++) edge(s.pts[i], s.pts[(i + 1) % s.pts.length]); }
      if (bg && bg.segGrid && S.layers.fond) bg.segGrid.query(w.x - er, w.y - er, w.x + er, w.y + er, (i) => edge(bg.segs[i].a, bg.segs[i].b));
      best = eb;
    }
    if (o.anchor && S.ortho !== false) {
      const a = o.anchor, p = best ? best.p : w; const d = G.sub(p, a), L = G.len(d);
      if (L > 1) { const ang = Math.atan2(d.y, d.x); const q = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4); if (Math.abs(G.normAng(ang - q)) < G.rad(5) && (!best || best.kind === 'bord')) { const pp = { x: a.x + Math.cos(q) * L, y: a.y + Math.sin(q) * L }; return { p: pp, kind: 'ortho' }; } }
    }
    return best ? { p: best.p, kind: best.kind } : { p: w, kind: null };
  };

  /* ---------- test d'atteinte ---------- */
  function hitOpening(sp, w) {
    let best = null;
    for (const r of App.shapesOn().filter((x) => x.kind === 'piece')) for (const o of r.openings || []) {
      const g = App.ops.geo(r, o); if (!g) continue; const s0 = App.w2s(g.p0), s1 = App.w2s(g.p1);
      let d = G.distPointSeg(sp, s0, s1);
      if (o.sw !== 0 && o.type === 'porte' && o.width * S.view.z > 18) { const H = o.hinge === 'd' ? g.p1 : g.p0; const v = G.sub(w, H); const leaf = G.mul(g.nin, o.out ? -1 : 1); if (G.len(v) < o.width && G.dot(v, leaf) > 0 && G.dot(v, G.mul(g.d, o.hinge === 'd' ? -1 : 1)) > -60) d = Math.min(d, 7); }
      if (d < 12 && (!best || d < best.d)) best = { d, r, o };
    }
    if (!best) return null; const pr = App.ops.primary(best.r, best.o); return { t: 'opening', id: pr.room.id, oid: pr.o.oid, d: best.d };
  }
  function hitWall(sp) {
    let best = null;
    for (const r of App.rooms()) for (let i = 0; i < r.pts.length; i++) { const a = App.w2s(r.pts[i]), b = App.w2s(r.pts[(i + 1) % r.pts.length]); if (G.dist(a, b) < 16) continue; const d = G.distPointSeg(sp, a, b); if (d < 9 && (!best || d < best.d)) best = { d, id: r.id, i }; }
    return best && { t: 'wall', id: best.id, i: best.i };
  }
  App.hit = (sp) => {
    const w = App.s2w(sp), fid = S.p.floorId, sel = App.selected();
    for (const th of App.tipHandles || []) if (G.dist(th.sp, sp) < 24) return { t: 'wtip', th };
    const so = App.ops.selected(), H = App.opHandles;
    if (so && H && H.oid === so.o.oid) { if (G.dist(H.s0, sp) < 16) return { t: 'opend', oid: so.o.oid, e: 0 }; if (G.dist(H.s1, sp) < 16) return { t: 'opend', oid: so.o.oid, e: 1 }; if (G.distPointSeg(sp, H.s0, H.s1) < 14) return { t: 'opmove', oid: so.o.oid }; }
    if (S.sel && S.sel.wall != null && App.wallHandle) { const h = App.wallHandle; if (G.dist(h, sp) < 24 || G.distPointSeg(sp, h.s0, h.s1) < 11) return { t: 'wmove', id: S.sel.id, i: S.sel.wall }; }
    if (sel && sel.pts && !sel.locked && S.sel && !S.sel.oid && S.sel.wall == null) {
      const rh = S.tool === 'select' && App.resize.hit(sel, sp); if (rh) return { t: 'resize', id: sel.id, h: rh }; // poignées de taille d'abord (le mur central d'un U est près du centre)
      if (S.tool === 'select' && App.moveHandle && G.dist(sp, App.moveHandle) < 20) return { t: 'move', id: sel.id };
      if (!App.resize.active(sel)) for (let i = 0; i < sel.pts.length; i++) if (G.dist(App.w2s(sel.pts[i]), sp) < 16) return { t: 'vertex', id: sel.id, i };
      if (S.tool === 'select' && ['meuble', 'poteau', 'forme', 'escalier'].includes(sel.kind) && G.pointInPoly(w, sel.pts)) return { t: 'move', id: sel.id };
    }
    const ho = S.mode !== 'mobilier' && S.mode !== 'elec' ? hitOpening(sp, w) : null; if (ho && ho.d <= 7) return ho;
    for (const l of App.labelRects) if (G.dist(l, sp) < l.r) return { t: l.ang ? 'angle' : 'dim', id: l.id, i: l.i, x: l.x, y: l.y };
    const elecOn = S.layers.elec || S.mode === 'elec';
    if (S.mode === 'elec') for (const p of App.pointsOn(fid)) if (G.dist(App.w2s(p), sp) < 16) return { t: 'point', id: p.id };
    const shapes = App.shapesOn(fid);
    if (S.mode === 'mobilier') for (const s of shapes.filter((x) => x.kind === 'meuble').reverse()) if (G.pointInPoly(w, s.pts)) return { t: 'shape', id: s.id };
    const ho2 = ho || hitOpening(sp, w); if (ho2) return ho2;
    if (elecOn) for (const p of App.pointsOn(fid)) if (G.dist(App.w2s(p), sp) < 16) return { t: 'point', id: p.id };
    for (const m of App.measuresOn(fid)) { const a = App.w2s(m.a), b = App.w2s(m.b); if (G.distPointSeg(sp, a, b) < 10) { if (S.sel && S.sel.id === m.id) { if (G.dist(a, sp) < 14) return { t: 'mend', id: m.id, e: 'a' }; if (G.dist(b, sp) < 14) return { t: 'mend', id: m.id, e: 'b' }; } return { t: 'measure', id: m.id }; } }
    if (S.mode === 'plan') { const hw = hitWall(sp); if (hw) return hw; }
    const order = ['meuble', 'poteau', 'forme', 'exclusion', 'escalier', 'plafond', 'piece'];
    if (!(S.layers.mobilier || S.mode === 'mobilier')) order.shift();
    for (const k of order) for (const s of shapes.filter((x) => x.kind === k).reverse()) if (G.pointInPoly(w, s.pts)) return { t: 'shape', id: s.id };
    return null;
  };

  /* ---------- événements ---------- */
  function down(e) {
    cvEl.setPointerCapture(e.pointerId);
    const p = local(e); ptrs.set(e.pointerId, p);
    if (ptrs.size === 2) { // geste à deux doigts
      if (act && act.began) App.end(true);
      act = null; S.loupe = null; S.snapMark = null; S.sketch = null;
      const [a, b] = [...ptrs.values()]; gest = { d: G.dist(a, b), m: G.lerp(a, b, 0.5), view: Object.assign({}, S.view) }; App.render(); return;
    }
    if (ptrs.size > 2) return;
    const touch = e.pointerType !== 'mouse';
    act = { start: p, last: p, moved: false, touch, button: e.button };
    if (e.button === 1 || e.button === 2) { act.kind = 'pan'; act.view = Object.assign({}, S.view); return; }
    const tool = S.tool;
    const th = (App.tipHandles || []).find((q) => G.dist(q.sp, p) < 24);
    if (th && (tool === 'select' || tool === 'sketch')) { act.kind = 'wtip'; act.th = th.h; if (touch) S.loupe = p; return; }
    if (S.skPlan && S.skPlan.handle && tool === 'select') App.sketch.cancel(true);
    if (tool === 'select') {
      const h = App.hit(p); act.h = h;
      if (S.pending && !(h && h.t === 'wmove')) { App.walls.cancel(); App.toast('Déplacement annulé'); act = null; return; }
      if (h && (h.t === 'opmove' || h.t === 'opend')) { const f = App.ops.find(h.oid); act.kind = h.t; App.begin(); act.began = true; act.f = f; act.g0 = App.ops.geo(f.room, f.o); act.u0 = G.dot(G.sub(App.s2w(p), act.g0.a), act.g0.d); if (touch) S.loupe = p; }
      else if (h && h.t === 'wmove') { act.kind = 'wmove'; const r = App.byId(h.id); act.W = App.ops.wall(r, h.i); act.w0 = App.s2w(p); act.base = S.pending ? S.pending.delta : 0; if (S.pending && !(S.pending.id === h.id && S.pending.i === h.i)) { App.walls.cancel(true); act.base = 0; act.W = App.ops.wall(App.byId(h.id), h.i); } }
      else if (h && h.t === 'resize') { act.kind = 'resize'; App.begin(); act.began = true; const s0 = App.byId(h.id); act.orig = G.clone(s0.pts); act.ops = s0.openings ? JSON.parse(JSON.stringify(s0.openings)) : null; if (touch) S.loupe = p; }
      else if (h && h.t === 'vertex') { act.kind = 'vertex'; App.begin(); act.began = true; S.dragV = h.i; if (touch) S.loupe = p; }
      else if (h && h.t === 'edge') { const s0 = App.byId(h.id); act.kind = 'edge'; App.begin(); act.began = true; S.dragE = h.i; act.orig = G.clone(s0.pts); act.partners = App.feat.partners(s0, h.i).map((q) => ({ s: q.s, j: q.j, orig: G.clone(q.s.pts) })); act.w0 = App.s2w(p); const a0 = s0.pts[h.i], b0 = s0.pts[(h.i + 1) % s0.pts.length]; act.nin = G.perp(G.norm(G.sub(b0, a0))); act.mid = G.lerp(a0, b0, 0.5); }
      else if (h && h.t === 'move') { act.kind = 'move'; App.begin(); act.began = true; act.orig = G.clone(App.byId(h.id).pts); act.w0 = App.s2w(p); act.openOrig = null; }
      else if (h && h.t === 'point' && S.sel && S.sel.id === h.id && !App.byId(h.id).locked) { act.kind = 'pmove'; App.begin(); act.began = true; }
      else if (h && h.t === 'mend') { act.kind = 'mend'; App.begin(); act.began = true; if (touch) S.loupe = p; }
      else { act.kind = 'pan'; act.view = Object.assign({}, S.view); }
    } else if (tool === 'measure' || tool === 'calib') {
      const sn = App.snap(p, { anchor: S.measureA || null }); act.kind = 'measure'; act.a = S.measureA || sn.p; S.snapMark = sn; if (touch) S.loupe = p;
      if (!S.measureA) S.tempMeasure = { a: act.a, b: act.a };
    } else if (tool === 'draw') { act.kind = 'drawpan'; act.view = Object.assign({}, S.view); if (touch) { S.loupe = p; } }
    else if (tool === 'cut') { const w = App.snap(p).p; act.kind = 'cut'; S.cutLine = { a: w, b: w }; }
    else if (tool === 'sketch') { act.kind = 'sketch'; App.sketch.begin(App.s2w(p)); }
    else { act.kind = 'tap'; act.view = Object.assign({}, S.view); }
    App.render();
  }

  function move(e) {
    const p = local(e);
    if (!ptrs.has(e.pointerId)) { hover(p, e); return; }
    ptrs.set(e.pointerId, p);
    if (gest && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()]; const d = G.dist(a, b), m = G.lerp(a, b, 0.5);
      const z = Math.max(0.002, Math.min(3, gest.view.z * (d / gest.d)));
      const w0 = { x: (gest.m.x - App.viewSize().W / 2) / gest.view.z + gest.view.cx, y: (App.viewSize().H / 2 - gest.m.y) / gest.view.z + gest.view.cy };
      S.view = { z, cx: w0.x - (m.x - App.viewSize().W / 2) / z, cy: w0.y - (App.viewSize().H / 2 - m.y) / z };
      App.render(); return;
    }
    if (!act) return;
    if (G.dist(p, act.start) > TAP) act.moved = true;
    const dx = p.x - act.last.x, dy = p.y - act.last.y; act.last = p;
    if (act.kind === 'pan' || act.kind === 'drawpan' || act.kind === 'tap') {
      if (!act.moved) { if (act.kind === 'drawpan' && S.draft) { S.draft.cursor = App.snap(p, { anchor: S.draft.pts[S.draft.pts.length - 1] }).p; S.loupe = act.touch ? p : null; App.render(); } return; }
      S.loupe = null; S.view.cx -= dx / S.view.z; S.view.cy += dy / S.view.z; App.render(); return;
    }
    if (act.kind === 'vertex') {
      const s = App.byId(act.h.id); const sn = App.snap(p, { skip: { id: s.id, v: act.h.i } }); S.snapMark = sn.kind ? sn : null;
      const r = PL.solver.dragVertex(s.pts, s.locks, act.h.i, sn.p);
      if (r.ok) { s.pts = r.pts; S.calc = {}; }
      if (act.touch) S.loupe = p; App.render(); return;
    }
    if (act.kind === 'opmove' || act.kind === 'opend') {
      const f = act.f, g = act.g0; const u = G.dot(G.sub(App.s2w(p), g.a), g.d); const r10 = (x) => Math.round(x / 10) * 10;
      let cl;
      if (act.kind === 'opmove') cl = App.ops.setSpan(f.room, f.o, r10(g.pos + u - act.u0), g.w);
      else if (act.h.e === 0) cl = App.ops.setSpan(f.room, f.o, r10(u), g.pos + g.w - r10(u), { end: 0 });
      else cl = App.ops.setSpan(f.room, f.o, g.pos, r10(u - g.pos), { end: 1 });
      const ng = App.ops.geo(f.room, f.o);
      S.opInfo = { p: ng.mid, txt: `${App.fmtCm(ng.w, 0)} cm · à ${App.fmtCm(ng.pos)} cm de ${String.fromCharCode(65 + f.o.wall)}${cl ? ' · butée' : ''}` };
      if (act.touch) S.loupe = p; S.calc = {}; App.render(); return;
    }
    if (act.kind === 'wmove') {
      if (!act.moved) return;
      if (!S.pending) { const r = App.byId(act.h.id); const res = App.walls.begin(r, act.h.i); if (res.err) { App.toast(res.err); act = null; return; } }
      let delta = act.base + G.dot(G.sub(App.s2w(p), act.w0), act.W.nin); delta = Math.round(delta / 5) * 5;
      App.walls.apply(delta); App.ctx.renderOpbar(); App.render(); return;
    }
    if (act.kind === 'edge') {
      const s = App.byId(act.h.id); let delta = G.dot(G.sub(App.s2w(p), act.w0), act.nin); delta = Math.round(delta / 5) * 5;
      const np = App.feat.moveEdgePts(act.orig, act.h.i, delta);
      if (G.area(np) > 0 && !G.isSelfIntersecting(np)) { s.pts = np; act.partners.forEach((q) => { const pp = App.feat.moveEdgePts(q.orig, q.j, -delta); if (G.area(pp) > 0 && !G.isSelfIntersecting(pp)) q.s.pts = pp; }); }
      S.edgeInfo = { delta, p: G.add(act.mid, G.mul(act.nin, delta)) }; S.calc = {}; App.render(); return;
    }
    if (act.kind === 'resize') { const s = App.byId(act.h.id); const info = App.resize.apply(s, act.orig, act.ops, act.h.h, App.s2w(p)); S.opInfo = { p: G.centroid(s.pts), txt: App.resize.label(s, info) }; if (S.loupe) S.loupe = p; S.calc = {}; App.render(); return; }
    if (act.kind === 'move' && App.byId(act.h.id).kind !== 'piece') {
      const s = App.byId(act.h.id); const r = App.guides.solve(s, act.orig, G.sub(App.s2w(p), act.w0));
      s.pts = r.Q; S.guides = r; S.snapMark = null; S.calc = {}; App.render(); return;
    }
    if (act.kind === 'move') {
      const s = App.byId(act.h.id); const w = App.s2w(p); let d = G.sub(w, act.w0);
      // aimanter un sommet sur un repère proche
      let best = null; const R = 12 / S.view.z;
      for (const q of act.orig) { const moved = G.add(q, d); const sn = App.snap(App.w2s(moved), { skip: { id: s.id }, r: 12 }); if (sn.kind === 'sommet' || sn.kind === 'fond') { const dd = G.dist(sn.p, moved); if (dd < R && (!best || dd < best.dd)) best = { dd, corr: G.sub(sn.p, moved), p: sn.p }; } }
      if (best) { d = G.add(d, best.corr); S.snapMark = { p: best.p, kind: 'sommet' }; } else S.snapMark = null;
      s.pts = act.orig.map((q) => G.add(q, d)); S.calc = {};
      App.render(); return;
    }
    if (act.kind === 'pmove') { const pt = App.byId(act.h.id); const r = App.placeOnWall(App.s2w(p), pt.type); pt.x = r.x; pt.y = r.y; pt.rot = r.rot; App.render(); return; }
    if (act.kind === 'mend') { const m = App.byId(act.h.id); const other = act.h.e === 'a' ? m.b : m.a; const sn = App.snap(p, { anchor: other }); m[act.h.e] = sn.p; S.snapMark = sn.kind ? sn : null; if (act.touch) S.loupe = p; App.render(); return; }
    if (act.kind === 'measure') {
      const sn = App.snap(p, { anchor: act.a }); S.snapMark = sn.kind ? sn : null; S.tempMeasure = { a: act.a, b: sn.p }; if (act.touch) S.loupe = p;
      App.ui.measureLive(act.a, sn.p); App.render(); return;
    }
    if (act.kind === 'cut') { S.cutLine.b = App.snap(p).p; App.render(); return; }
    if (act.kind === 'sketch') { App.sketch.add(App.s2w(p)); App.render(); return; }
    if (act.kind === 'wtip') { const q = App.sketch.extendPlan(act.th, App.sketch.lenAt(act.th, App.s2w(p))); if (!q.err) S.skPlan = q; if (S.loupe) S.loupe = p; App.render(); return; }
  }

  function up(e) {
    const p = local(e); ptrs.delete(e.pointerId);
    if (gest) { if (ptrs.size < 2) { gest = null; } return; }
    if (!act) return;
    const a = act; act = null; S.loupe = null; S.dragV = null;
    if (a.kind === 'opmove' || a.kind === 'opend') { S.opInfo = null; S.loupe = null; App.end(!!a.moved); App.render(); return; }
    if (a.kind === 'resize') { S.opInfo = null; S.resizeSnap = null; const s = App.byId(a.h.id); if (a.moved) App.resize.finish(s, a.orig); App.end(!!a.moved); App.ui.refresh(); App.render(); return; }
    if (a.kind === 'wmove') { if (S.pending && Math.abs(S.pending.delta) < 0.5) App.walls.cancel(true); App.ui.refresh(); App.render(); return; }
    if (a.kind === 'vertex' || a.kind === 'move' || a.kind === 'pmove' || a.kind === 'mend' || a.kind === 'edge') {
      S.snapMark = null; S.dragE = null; S.edgeInfo = null; S.guides = null; App.end(!!a.moved || a.kind !== 'move');
      if (a.kind === 'vertex' || a.kind === 'edge') { const s = App.byId(a.h.id); s.locks = PL.solver.syncLocks(s.pts, s.locks); (a.partners || []).forEach((q) => { q.s.locks = PL.solver.syncLocks(q.s.pts, q.s.locks); }); if (a.kind === 'edge' && a.partners && a.partners.length) App.toast('Cloison déplacée avec la pièce voisine'); }
      App.render(); return;
    }
    if (a.kind === 'measure') {
      const sn = App.snap(p, { anchor: a.a }); S.snapMark = null;
      if (a.moved || S.measureA) {
        const b = sn.p; S.tempMeasure = null; S.measureA = null;
        if (G.dist(a.a, b) > 1) { if (S.tool === 'calib') App.ui.calibrate(a.a, b); else { App.mutate((P) => { P.measures.push({ id: App.uid(), floor: P.floorId, a: a.a, b }); }); S.sel = { id: S.p.measures[S.p.measures.length - 1].id }; App.ui.refresh(); } }
      } else { S.measureA = sn.p; S.tempMeasure = { a: sn.p, b: sn.p }; App.toast('Touchez le second point'); }
      App.render(); return;
    }
    if (a.kind === 'sketch') { if (a.moved) App.sketch.finish(); else { S.sketch = null; App.render(); } return; }
    if (a.kind === 'wtip') { if (!a.moved && !S.skPlan) App.toast('Tirez la flèche dans l\'axe de la cloison'); App.ui.refresh(); App.ui.refreshHint(); App.render(); return; }
    if (a.kind === 'cut') { const L = S.cutLine; S.cutLine = null; if (G.dist(App.w2s(L.a), App.w2s(L.b)) > 20) App.ui.cutSelected(L.a, L.b); App.render(); return; }
    if (a.moved) { App.render(); return; }
    // tap
    const now = performance.now(); const dbl = now - lastTap < 300 && G.dist(p, a.start) < 20; lastTap = now;
    tap(p, a, dbl);
  }
  function cancel(e) { ptrs.delete(e.pointerId); if (act && act.began) App.end(true); act = null; gest = null; S.loupe = null; App.render(); }

  function hover(p, e) {
    if (e.pointerType !== 'mouse') return;
    if (S.tool === 'draw' && S.draft) { const sn = App.snap(p, { anchor: S.draft.pts[S.draft.pts.length - 1] }); S.draft.cursor = sn.p; S.snapMark = sn.kind ? sn : null; App.render(); }
    else if (S.tool === 'measure' || S.tool === 'calib') { const sn = App.snap(p, { anchor: S.measureA }); S.snapMark = sn.kind ? sn : null; if (S.measureA) S.tempMeasure = { a: S.measureA, b: sn.p }; App.render(); }
    else if (S.tool === 'place' || S.tool === 'elec') { S.snapMark = null; }
  }

  function tap(p, a, dbl) {
    const tool = S.tool;
    if (tool === 'select') {
      const h = a.h;
      if (h && (h.t === 'dim' || h.t === 'angle')) { App.ui.quickEdit(h); return; }
      if (h && (h.t === 'opmove' || h.t === 'opend')) return;
      if (h && h.t === 'opening') { S.sel = { id: h.id, oid: h.oid }; App.ui.onSelect(); App.render(); return; }
      if (h && h.t === 'wall') { const same = S.sel && S.sel.id === h.id && S.sel.wall === h.i; S.sel = same ? { id: h.id } : { id: h.id, wall: h.i }; S.wallEnd = null; App.ui.onSelect(); App.render(); return; }
      if (h && (h.t === 'shape' || h.t === 'point' || h.t === 'measure')) {
        const was = S.sel && S.sel.id === h.id; S.sel = { id: h.id };
        if (dbl && h.t === 'shape') App.fitShape(App.byId(h.id));
        App.ui.onSelect(was); App.render(); return;
      }
      if (S.sel) { S.sel = null; App.ui.onSelect(); App.render(); return; }
      if (dbl) App.fitAll();
      return;
    }
    if (tool === 'draw') {
      const d = S.draft || (S.draft = { pts: [], kind: S.drawKind || 'piece' });
      const sn = App.snap(p, { anchor: d.pts[d.pts.length - 1] });
      if (d.pts.length >= 3 && G.dist(App.w2s(d.pts[0]), p) < 18) { App.ui.finishDraft(); return; }
      d.pts.push(sn.p); d.cursor = null; App.ui.refreshDraft(); App.render(); return;
    }
    if (tool === 'wand') { App.importer.wandAt(App.s2w(p)); return; }
    if (tool === 'place') { App.ui.placeAt(App.s2w(p)); return; }
    if (tool === 'elec') { App.ui.placeElec(App.s2w(p)); return; }
    if (tool === 'opening') { const r = App.ops.addAt(App.s2w(p), S.opType || 'porte'); if (r.exist) { S.sel = { id: r.exist.room.id, oid: r.exist.o.oid }; App.ui.setTool('select'); App.ui.onSelect(); App.toast('Il y a déjà une ouverture ici : la voici'); return; } if (r.err) { App.toast(r.err); return; } S.sel = { id: r.room.id, oid: r.o.oid }; App.ui.setTool('select'); App.ui.onSelect(); App.toast(`${App.ops.name(r.o.type)} ajoutée — orientez-la avec Inverser / Gonds`); return; }
  }

  function wheel(e) {
    e.preventDefault(); const p = local(e);
    if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)); const w0 = App.s2w(p);
      S.view.z = Math.max(0.002, Math.min(3, S.view.z * k)); const w1 = App.s2w(p); S.view.cx += w0.x - w1.x; S.view.cy += w0.y - w1.y;
    }
    App.render();
  }

  function key(e) {
    if (/input|textarea|select/i.test(document.activeElement && document.activeElement.tagName)) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? App.redo() : App.undo(); return; }
    if (e.key === 'Escape' && S.pending) { App.walls.cancel(); return; }
    if (e.key === 'Enter' && S.pending) { App.walls.validate(); return; }
    if (e.key === 'Escape') { if (S.draft) { S.draft = null; App.ui.refreshDraft(); } S.measureA = null; S.tempMeasure = null; App.ui.setTool('select'); S.sel = null; App.ui.onSelect(); App.render(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { App.ui.deleteSelected(); }
    if (e.key === 'Enter' && S.draft) App.ui.finishDraft();
  }

  /* ---------- placement d'un symbole électrique contre un mur ---------- */
  App.placeOnWall = (w, type) => {
    const ceiling = ['dcl', 'spot', 'detecteur', 'vmc'].includes(type);
    if (ceiling) return { x: w.x, y: w.y, rot: 0 };
    let best = null; const R = 40 / S.view.z;
    for (const s of App.shapesOn().filter((x) => x.kind === 'piece')) for (let i = 0; i < s.pts.length; i++) {
      const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length]; const pr = G.projSeg(w, a, b); const d = G.dist(pr.p, w);
      if (d < R && (!best || d < best.d)) { const dir = G.norm(G.sub(b, a)); best = { d, p: pr.p, dir }; }
    }
    if (!best) return { x: w.x, y: w.y, rot: 0 };
    const nin = G.perp(best.dir); const p = G.add(best.p, G.mul(nin, 6 / S.view.z));
    return { x: p.x, y: p.y, rot: Math.atan2(-best.dir.y, -best.dir.x) };
  };
})();
