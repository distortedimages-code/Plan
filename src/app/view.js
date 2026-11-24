/* Calepin — rendu du plan sur canvas. */
(function () {
  const PL = globalThis.PL, G = PL.geom, App = globalThis.App, S = App.state;
  let cv, ctx, W = 0, H = 0, dpr = 1, raf = 0, C = {};
  App.labelRects = [];

  App.initView = (canvas) => { cv = canvas; ctx = cv.getContext('2d'); resize(); new ResizeObserver(() => { resize(); App.render(); }).observe(cv.parentElement); };
  function resize() { const r = cv.parentElement.getBoundingClientRect(); dpr = Math.min(3, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
  App.viewSize = () => ({ W, H });
  let probe = null;
  const readColors = () => {
    if (!probe) { probe = document.createElement('i'); probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden'; document.body.appendChild(probe); }
    const r = (v) => { probe.style.color = 'var(' + v + ')'; return getComputedStyle(probe).color; };
    C = { paper: r('--paper'), ink: r('--ink'), red: r('--red'), oak: r('--oak'), ink2: r('--ink-2'), ink3: r('--ink-3'), ink4: r('--ink-4'), ink5: r('--ink-5'), oakCut: r('--oak-cut'), oakReuse: r('--oak-reuse'), oakLine: r('--oak-line') };
  };
  App.readColors = readColors;

  /* ---------- transformations ---------- */
  App.w2s = (p) => ({ x: (p.x - S.view.cx) * S.view.z + W / 2, y: H / 2 - (p.y - S.view.cy) * S.view.z });
  App.s2w = (p) => ({ x: (p.x - W / 2) / S.view.z + S.view.cx, y: (H / 2 - p.y) / S.view.z + S.view.cy });
  App.fitBox = (bb, pad = 40) => {
    if (!bb || !isFinite(bb.x0)) return;
    const sh = App.ui ? App.ui.obstruction() : { bottom: 0, right: 0, top: 0 };
    const aw = Math.max(80, W - sh.right - 2 * pad), ah = Math.max(80, H - sh.bottom - sh.top - 2 * pad);
    const z = Math.min(aw / Math.max(bb.w, 500), ah / Math.max(bb.h, 500));
    App.animateView({ cx: (bb.x0 + bb.x1) / 2 + (sh.right / 2) / z, cy: (bb.y0 + bb.y1) / 2 - ((sh.bottom - sh.top) / 2) / z, z });
  };
  App.floorBBox = (fid = S.p.floorId) => {
    const pts = App.shapesOn(fid).flatMap((s) => s.pts).concat(App.pointsOn(fid));
    const bg = S.bgs[fid]; if (!pts.length && bg && bg.bbox) pts.push({ x: bg.bbox.x0, y: bg.bbox.y0 }, { x: bg.bbox.x1, y: bg.bbox.y1 });
    if (!pts.length) return null; const bb = G.bbox(pts); return bb;
  };
  App.fitAll = (instant) => { const bb = App.floorBBox(); if (bb) { if (instant) { App.fitBox(bb); S.view = Object.assign({}, S.viewTarget || S.view); S.viewTarget = null; App.render(); } else App.fitBox(bb); } else { S.view = { cx: 5000, cy: 4000, z: Math.min(W, H) / 14000 }; App.render(); } };
  App.fitShape = (s) => { const bb = G.bbox(s.pts); const pad = Math.max(bb.w, bb.h) * 0.12 + 300; App.fitBox({ x0: bb.x0 - pad, y0: bb.y0 - pad, x1: bb.x1 + pad, y1: bb.y1 + pad, w: bb.w + 2 * pad, h: bb.h + 2 * pad }, 24); };
  let animT = null;
  App.animateView = (to) => {
    const from = Object.assign({}, S.view), t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320;
    cancelAnimationFrame(animT);
    const step = (t) => { const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3); const lz = Math.log(from.z) + (Math.log(to.z) - Math.log(from.z)) * e; S.view = { cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, z: Math.exp(lz) }; draw(); if (k < 1) animT = requestAnimationFrame(step); };
    animT = requestAnimationFrame(step);
  };

  App.render = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };

  /* ---------- helpers ---------- */
  const path = (pts) => { ctx.beginPath(); pts.forEach((p, i) => { const q = App.w2s(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath(); };
  const font = (w, px) => `${w} ${px}px "Inter Tight", "Helvetica Neue", Helvetica, Arial, sans-serif`;
  const text = (s, x, y, w = 400, px = 12, col = C.ink, align = 'center', base = 'middle') => { ctx.font = font(w, px); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y); };
  const upright = (a) => { let r = a; if (r > Math.PI / 2) r -= Math.PI; if (r <= -Math.PI / 2) r += Math.PI; return r; };

  /* ---------- dessin principal ---------- */
  function draw() {
    if (!ctx || !S.p) return; readColors();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    App.labelRects = [];
    const fid = S.p.floorId, z = S.view.z;
    drawBackground(fid);
    const shapes = App.shapesOn(fid);
    const rooms = shapes.filter((s) => s.kind === 'piece');
    const showCal = S.mode === 'calepinage' || S.layers.calepinage;
    // pièces
    for (const r of rooms) {
      path(r.pts); ctx.fillStyle = r.parquet === false && showCal ? C.ink5 : C.paper; ctx.globalAlpha = S.layers.fond && S.bgs[fid] && S.bgs[fid].img ? 0.82 : 1; ctx.fill(); ctx.globalAlpha = 1;
    }
    for (const r of rooms) if (r.parquet === false) tiles(r.pts);
    if (showCal) drawCalepinage(fid, rooms);
    for (const z of shapes) if (z.kind === 'plafond') drawZone(z);
    // zones et escaliers
    for (const s of shapes) if (s.kind === 'exclusion' || s.kind === 'escalier' || s.kind === 'poteau') drawObstacle(s);
    // murs (contours)
    for (const r of rooms) { path(r.pts); ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1.6, Math.min(4, 120 * z)); ctx.lineJoin = 'miter'; ctx.stroke(); }
    for (const r of rooms) drawOpenings(r);
    // formes libres et mobilier
    for (const s of shapes) if (s.kind === 'forme') drawFree(s);
    if (S.layers.mobilier || S.mode === 'mobilier') for (const s of shapes) if (s.kind === 'meuble') drawFurniture(s, showCal && S.mode !== 'mobilier');
    // étiquettes
    for (const r of rooms) drawRoomLabel(r, showCal);
    if (S.layers.cotes && S.mode !== 'elec' && !showCal) for (const r of rooms) drawDims(r, false);
    if (S.step && showCal) drawStep();
    const sel = App.selected();
    if (sel && sel.pts && sel.kind !== 'piece' && S.layers.cotes) drawDims(sel, true);
    if (sel && sel.kind === 'piece') drawDims(sel, true);
    // mesures
    for (const m of App.measuresOn(fid)) drawMeasure(m, S.sel && S.sel.id === m.id);
    // électricité
    if (S.layers.elec || S.mode === 'elec') for (const p of App.pointsOn(fid)) drawElec(p, S.sel && S.sel.id === p.id);
    // sélection
    if (sel) drawSelection(sel);
    if (S.draft) drawDraft();
    if (S.snapMark) drawSnap(S.snapMark);
    if (S.edgeInfo) { const e = S.edgeInfo; const q = App.w2s(e.p); ctx.font = font(700, 12); const t = (e.delta >= 0 ? '+' : '') + App.fmtCm(e.delta) + ' cm'; const tw = ctx.measureText(t).width; ctx.fillStyle = C.red; ctx.fillRect(q.x - tw / 2 - 6, q.y - 30, tw + 12, 20); ctx.fillStyle = C.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, q.x, q.y - 20); }
    if (S.cutLine) { const a = App.w2s(S.cutLine.a), b = App.w2s(S.cutLine.b); ctx.setLineDash([6, 4]); ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); }
    drawScale();
    if (S.loupe) drawLoupe();
  }

  function drawBackground(fid) {
    const bg = S.bgs[fid]; if (!bg || !S.layers.fond) return;
    if (bg.img) {
      const z = S.view.z, k = bg.k / bg.pxPerUnit;
      const e = (bg.ox - S.view.cx) * z + W / 2, f = H / 2 - (bg.oy + bg.hUnits * bg.k - S.view.cy) * z;
      ctx.save(); ctx.globalAlpha = S.mode === 'calepinage' ? 0.18 : 0.42; ctx.setTransform(dpr * k * z, 0, 0, dpr * k * z, dpr * e, dpr * f);
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bg.img, 0, 0); ctx.restore();
    } else if (bg.segs) {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = C.ink3; ctx.lineWidth = 0.7; ctx.beginPath();
      for (const s of bg.segs) { const a = App.w2s(s.a), b = App.w2s(s.b); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke(); ctx.restore();
    }
  }

  function drawCalepinage(fid, rooms) {
    const cal = App.calepinage(fid); const z = S.view.z; const P = cal.P;
    if (!cal.polys) { cal.polys = {}; for (const id in cal.results) cal.polys[id] = PL.layout.boardPolys(cal.results[id]); }
    for (const r of rooms) {
      const res = cal.results[r.id]; if (!res) continue;
      ctx.save();
      ctx.beginPath();
      const ring = (pts) => { pts.forEach((p, i) => { const q = App.w2s(G.rot(p, res.ang)); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath(); };
      ring(res.outer); res.holes.forEach(ring); ctx.clip('evenodd');
      const polys = cal.polys[r.id] || [];
      const lw = Math.max(0.5, Math.min(1.4, z * 40));
      for (const b of polys) {
        path(b.poly);
        ctx.fillStyle = b.src === 'chute' ? C.oakReuse : C.oak; ctx.fill();
        if (z > 0.012) { ctx.strokeStyle = C.oakLine; ctx.lineWidth = lw; ctx.stroke(); }
      }
      // extrémités coupées en rouge
      ctx.strokeStyle = C.red; ctx.lineWidth = Math.max(1.2, Math.min(3, z * 60)); ctx.beginPath();
      for (const b of polys) {
        if (!b.cutA && !b.cutB) continue; const q = b.poly.map(App.w2s);
        if (b.cutA) { ctx.moveTo(q[0].x, q[0].y); ctx.lineTo(q[3].x, q[3].y); }
        if (b.cutB) { ctx.moveTo(q[1].x, q[1].y); ctx.lineTo(q[2].x, q[2].y); }
      }
      ctx.stroke();
      if (z > 0.16) for (const b of polys) { if (!b.cutA && !b.cutB) continue; const c = App.w2s(G.lerp(b.poly[0], b.poly[2], 0.5)); const ang = upright(-res.ang); ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(ang); text(String(Math.round(b.len)), 0, 0, 600, 9, C.ink); ctx.restore(); }
      ctx.restore();
      // numéros de rangs et délignage
      if (z > 0.05) {
        const dirx = { x: Math.cos(res.ang), y: Math.sin(res.ang) };
        res.rows.forEach((row) => {
          const run = row.runs[0]; if (!run) return;
          const sx = res.startEdgeIdx != null || true ? (row.runs[0].u0 < row.runs[0].u1 ? null : null) : null;
          const xs = (P && true) ? (run.pieces[0].x0 + run.pieces[0].x1) / 2 : 0;
          const startX = Math.max(...row.runs.map((ru) => ru.x1));
          const p = G.rot({ x: startX - 60 / z * 0 - 25 / z, y: (row.ya + row.yb) / 2 }, res.ang); const q = App.w2s(p);
          if (row.num === 1 || row.num % (z > 0.12 ? 1 : 5) === 0) text(String(row.num), q.x, q.y, 600, 9, C.ink);
          if (row.ripMax < P.W - 0.5) { const p2 = G.rot({ x: startX - 110 / z, y: (row.ya + row.yb) / 2 }, res.ang); const q2 = App.w2s(p2); if (z > 0.09) text(Math.round(row.ripMax) + ' mm', q2.x, q2.y, 600, 9, C.red, 'right'); }
        });
      }
      // départ
      if (res.lead && res.startEdgeIdx != null) {
        const i = res.startEdgeIdx, n = r.pts.length, a = r.pts[i], b = r.pts[(i + 1) % n];
        const la = G.rot(a, -res.ang), lb = G.rot(b, -res.ang); const corner = la.x > lb.x ? a : b; const other = corner === a ? b : a;
        const c = App.w2s(corner), o = App.w2s(other); const d = G.norm(G.sub(o, c)); const nrm = { x: -d.y, y: d.x };
        const inward = G.add(c, G.mul(G.norm(G.sub(App.w2s(G.centroid(r.pts)), c)), 1));
        const side = G.dot(G.sub(inward, c), nrm) > 0 ? 1 : -1;
        const tip = G.add(G.add(c, G.mul(d, 16)), G.mul(nrm, 16 * side));
        ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + d.x * 22 - nrm.x * 0 * side, tip.y + d.y * 22); ctx.lineTo(tip.x + nrm.x * 10 * side, tip.y + nrm.y * 10 * side); ctx.closePath(); ctx.fill();
        if (z > 0.04) text('Départ', tip.x + d.x * 30 + nrm.x * 12 * side, tip.y + d.y * 30 + nrm.y * 12 * side, 700, 11, C.red, 'left');
      }
    }
  }

  function hatch(pts, col, step = 9, ang = Math.PI / 4) {
    ctx.save(); path(pts); ctx.clip(); const bb = G.bbox(pts.map(App.w2s)); ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.beginPath();
    const d = Math.hypot(bb.w, bb.h); for (let t = -d; t < d; t += step) { ctx.moveTo(bb.x0 + t, bb.y1); ctx.lineTo(bb.x0 + t + bb.h, bb.y0); }
    ctx.stroke(); ctx.restore();
  }

  function tiles(pts) {
    const z = S.view.z; const step = 600 * z; if (step < 5) return;
    ctx.save(); path(pts); ctx.clip(); const bb = G.bbox(pts.map(App.w2s)); ctx.strokeStyle = C.ink4; ctx.lineWidth = 0.7; ctx.beginPath();
    const o = App.w2s({ x: 0, y: 0 }); const x0 = o.x + Math.floor((bb.x0 - o.x) / step) * step, y0 = o.y + Math.floor((bb.y0 - o.y) / step) * step;
    for (let x = x0; x < bb.x1; x += step) { ctx.moveTo(x, bb.y0); ctx.lineTo(x, bb.y1); } for (let y = y0; y < bb.y1; y += step) { ctx.moveTo(bb.x0, y); ctx.lineTo(bb.x1, y); }
    ctx.stroke(); ctx.restore();
  }
  function drawZone(zn) {
    const z = S.view.z; ctx.save(); path(zn.pts); ctx.clip(); const bb = G.bbox(zn.pts.map(App.w2s)); ctx.fillStyle = C.ink3; const st = Math.max(5, Math.min(9, 160 * z));
    for (let y = bb.y0; y < bb.y1; y += st) for (let x = bb.x0 + ((Math.round(y / st) % 2) * st) / 2; x < bb.x1; x += st) { ctx.fillRect(x, y, 1.2, 1.2); }
    ctx.restore(); path(zn.pts); ctx.setLineDash([2, 3]); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    if (z > 0.035) { const c = App.w2s(G.centroid(zn.pts)); const f2 = (v) => (v / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); const lbl = zn.hmin ? `${f2(zn.hmin)} → ${f2(zn.hmax || 180)} m` : `< ${f2(zn.hmax || 180)} m`; ctx.font = font(600, 10); const tw = ctx.measureText(lbl).width; ctx.fillStyle = C.paper; ctx.fillRect(c.x - tw / 2 - 3, c.y - 7, tw + 6, 14); text(lbl, c.x, c.y, 600, 10, C.ink2); }
  }
  function drawStep() {
    const st = S.step; const r = App.byId(st.id); if (!r) return; const res = (App.calepinage().results || {})[st.id]; if (!res) return;
    const row = res.rows[st.row - 1]; if (!row) return;
    const x0 = Math.min(...row.runs.map((u) => u.x0)), x1 = Math.max(...row.runs.map((u) => u.x1));
    const q = [{ x: x0, y: row.ya }, { x: x1, y: row.ya }, { x: x1, y: row.yb }, { x: x0, y: row.yb }].map((p) => G.rot(p, res.ang));
    path(q); ctx.strokeStyle = C.red; ctx.lineWidth = 2.5; ctx.stroke();
    // lames du rang numérotées
    row.runs.forEach((ru) => ru.pieces.forEach((pc, k) => { const c = App.w2s(G.rot({ x: (pc.x0 + pc.x1) / 2, y: (row.ya + row.yb) / 2 }, res.ang)); const ang = upright(-res.ang); ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(ang); ctx.font = font(700, 11); const t = String(Math.round(pc.len)); const tw = ctx.measureText(t).width; ctx.fillStyle = pc.kind === 'cut' ? C.red : C.ink; ctx.fillRect(-tw / 2 - 4, -8, tw + 8, 16); ctx.fillStyle = C.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, 0, 0.5); ctx.restore(); }));
  }

  function drawObstacle(s) {
    const sel = S.sel && S.sel.id === s.id;
    if (s.kind === 'poteau') { path(s.pts); ctx.fillStyle = C.ink; ctx.fill(); return; }
    path(s.pts); ctx.fillStyle = C.paper; ctx.fill();
    if (s.kind === 'escalier') {
      // marches
      const bb = G.bbox(s.pts); const lp = s.pts; const lens = lp.map((p, i) => G.dist(p, lp[(i + 1) % lp.length]));
      const i0 = lens.indexOf(Math.max(...lens)); const a = lp[i0], b = lp[(i0 + 1) % lp.length]; const dir = G.norm(G.sub(b, a));
      ctx.save(); path(s.pts); ctx.clip(); ctx.strokeStyle = C.ink3; ctx.lineWidth = 0.8; ctx.beginPath();
      const L = G.dist(a, b), nrm = G.perp(dir); for (let t = 250; t < L; t += 250) { const p = G.add(a, G.mul(dir, t)); const q1 = App.w2s(G.add(p, G.mul(nrm, -20000))), q2 = App.w2s(G.add(p, G.mul(nrm, 20000))); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); }
      ctx.stroke(); ctx.restore();
      path(s.pts); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.stroke();
      const c = App.w2s(G.centroid(s.pts));
      const dirTxt = s.stair && s.stair.dir === 'descend' ? 'Descend' : 'Monte';
      ctx.fillStyle = C.paper; ctx.fillRect(c.x - 34, c.y - 16, 68, 32);
      text(dirTxt, c.x, c.y - 5, 700, 11, C.ink); text((s.stair && s.stair.steps ? s.stair.steps + ' marches' : 'Escalier'), c.x, c.y + 8, 300, 10, C.ink2);
      return;
    }
    hatch(s.pts, C.ink4, 8);
    path(s.pts); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.stroke();
    if (S.view.z > 0.04 && s.name) { const c = App.w2s(G.centroid(s.pts)); text(s.name, c.x, c.y, 500, 10, C.ink2); }
  }

  function drawFree(s) {
    path(s.pts); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.setLineDash([]); ctx.stroke();
    if (s.name && S.view.z > 0.03) { const c = App.w2s(G.centroid(s.pts)); text(s.name, c.x, c.y, 500, 10, C.ink2); }
  }

  function drawFurniture(s, faint) {
    ctx.save();
    if (s.round) { const c = App.w2s(G.centroid(s.pts)); const r = (G.dist(s.pts[0], s.pts[2]) / 2 / Math.SQRT2) * S.view.z; ctx.beginPath(); ctx.ellipse(c.x, c.y, (G.dist(s.pts[0], s.pts[1]) / 2) * S.view.z, (G.dist(s.pts[1], s.pts[2]) / 2) * S.view.z, -Math.atan2(s.pts[1].y - s.pts[0].y, s.pts[1].x - s.pts[0].x), 0, Math.PI * 2); }
    else path(s.pts);
    if (faint) { ctx.setLineDash([4, 3]); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); return; }
    ctx.fillStyle = C.paper; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.stroke();
    // détail : oreillers pour les lits, assise pour canapés
    if (/^lit/.test(s.lib || '') && s.pts.length === 4) {
      const a = s.pts[0], b = s.pts[1], c = s.pts[2], d = s.pts[3]; const hd = G.lerp(d, a, 0.12), hc = G.lerp(c, b, 0.12);
      const q1 = App.w2s(hd), q2 = App.w2s(hc); ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.restore();
    if (S.view.z > 0.035 && s.name) { const c = App.w2s(G.centroid(s.pts)); const lbl = s.name.replace(/ \(type .*\)/, ''); text(lbl, c.x, c.y, 500, 10, C.ink2); }
  }

  function drawOpenings(r) {
    const n = r.pts.length, z = S.view.z;
    for (const o of r.openings || []) {
      if (o.wall >= n) continue;
      const a = r.pts[o.wall], b = r.pts[(o.wall + 1) % n], el = G.dist(a, b); if (el < 1) continue;
      const d = G.norm(G.sub(b, a)), nin = G.perp(d); // intérieur à gauche (CCW)
      const p0 = G.add(a, G.mul(d, Math.max(0, o.pos))), p1 = G.add(a, G.mul(d, Math.min(el, o.pos + o.width)));
      const s0 = App.w2s(p0), s1 = App.w2s(p1);
      ctx.strokeStyle = C.paper; ctx.lineWidth = Math.max(2.4, Math.min(5, 120 * z)) + 1.2; ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
      const tick = (p) => { const q1 = App.w2s(G.add(p, G.mul(nin, 60))), q2 = App.w2s(G.add(p, G.mul(nin, -60))); ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke(); };
      const t = o.type;
      if (t === 'porte' || t === 'porte2') {
        tick(p0); tick(p1); if (o.sw === 0) continue;
        const leaves = t === 'porte2' ? [[p0, o.width / 2, 1], [p1, o.width / 2, -1]] : [[o.hinge === 'd' ? p1 : p0, o.width, o.hinge === 'd' ? -1 : 1]];
        for (const [h, w, sg] of leaves) {
          const side = o.out ? -1 : 1; const tip = G.add(h, G.mul(nin, w * side)); const hs = App.w2s(h), ts = App.w2s(tip);
          ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hs.x, hs.y); ctx.lineTo(ts.x, ts.y); ctx.stroke();
          const closed = App.w2s(G.add(h, G.mul(d, w * sg)));
          const a0 = Math.atan2(ts.y - hs.y, ts.x - hs.x), a1 = Math.atan2(closed.y - hs.y, closed.x - hs.x);
          let da = G.normAng(a1 - a0); ctx.lineWidth = 0.7; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(hs.x, hs.y, w * z, a0, a0 + da, da < 0); ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (t === 'coulissante' || t === 'galandage') {
        tick(p0); tick(p1);
        const off = G.mul(nin, 50); const q0 = App.w2s(G.add(p0, off)), q1 = App.w2s(G.add(G.add(p0, G.mul(d, o.width * (t === 'galandage' ? 0.6 : 1))), off));
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke(); ctx.lineWidth = 1;
      } else if (t === 'passage') { tick(p0); tick(p1); }
      else if (t === 'velux') {
        const q = [p0, p1, G.add(p1, G.mul(nin, 600)), G.add(p0, G.mul(nin, 600))]; ctx.setLineDash([4, 3]); path(q); ctx.stroke(); ctx.setLineDash([]);
      } else {
        tick(p0); tick(p1);
        const offs = t === 'baie' ? [-35, 0, 35] : t === 'fixe' ? [0] : [-30, 30];
        for (const of of offs) { const q0 = App.w2s(G.add(p0, G.mul(nin, of))), q1 = App.w2s(G.add(p1, G.mul(nin, of))); ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke(); }
        if (t === 'porte-fenetre') { const m = App.w2s(G.add(G.lerp(p0, p1, 0.5), G.mul(nin, 120))); ctx.beginPath(); ctx.arc(m.x, m.y, 2, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill(); }
      }
    }
  }

  function drawRoomLabel(r, cal) {
    const z = S.view.z; if (z < 0.012) return;
    const c = App.w2s(PL.geom.centroid(r.pts)); let inside = G.pointInPoly(App.s2w(c), r.pts);
    let pos = c; if (!inside) { const bb = G.bbox(r.pts); pos = App.w2s({ x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 }); }
    const area = Math.abs(G.area(r.pts));
    const big = Math.max(13, Math.min(26, z * 300));
    const compact = z < 0.035;
    if (cal) {
      ctx.font = font(600, 12); const w = Math.max(compact ? 30 : 70, ctx.measureText(r.name || 'Pièce').width + 16); ctx.fillStyle = C.paper; ctx.globalAlpha = 0.92; ctx.fillRect(pos.x - w / 2, pos.y - (compact ? 9 : 20), w, compact ? 18 : 38); ctx.globalAlpha = 1;
    }
    if (compact && cal) { text(r.name || 'Pièce', pos.x, pos.y, 600, 11, C.ink); return; }
    text(r.name || 'Pièce', pos.x, pos.y - big * 0.55, 600, 12, C.ink);
    text(App.fmtM2(area) + ' m²', pos.x, pos.y + big * 0.45, 200, big, C.ink);
  }

  function drawDims(s, selected) {
    const z = S.view.z; if (!selected && z < 0.035) return;
    const n = s.pts.length, m = PL.solver.measure(s.pts);
    const inner = s.kind === 'piece';
    for (let i = 0; i < n; i++) {
      const a = s.pts[i], b = s.pts[(i + 1) % n], L = m.L[i]; if (L * z < 34) continue;
      const d = G.norm(G.sub(b, a)), nin = G.perp(d); const off = (inner ? 1 : -1) * 14 / z;
      const mid = G.add(G.lerp(a, b, 0.5), G.mul(nin, off)); const q = App.w2s(mid);
      const ang = upright(-Math.atan2(b.y - a.y, b.x - a.x));
      const lk = s.locks && s.locks[i] && s.locks[i].L;
      const label = App.fmtCm(L);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang); ctx.font = font(lk ? 700 : 300, selected ? 12 : 11);
      const tw = ctx.measureText(label).width;
      if (selected) { ctx.fillStyle = C.paper; ctx.fillRect(-tw / 2 - 4, -8, tw + 8, 16); }
      ctx.fillStyle = selected ? (lk ? C.red : C.ink) : C.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 0);
      if (lk && selected) { ctx.fillRect(-tw / 2, 7, tw, 1.2); }
      ctx.restore();
      if (selected) App.labelRects.push({ id: s.id, i, x: q.x, y: q.y, r: Math.max(18, tw / 2 + 6) });
    }
    if (selected && z > 0.02) {
      for (let i = 0; i < n; i++) {
        const deg = G.deg(m.A[i]); const right = Math.abs(deg - 90) < 0.05 || Math.abs(deg - 270) < 0.05;
        const lk = s.locks && s.locks[i] && s.locks[i].A; if (right && !lk) continue;
        const p = s.pts[i], prev = s.pts[(i - 1 + n) % n], next = s.pts[(i + 1) % n];
        if (right && Math.abs(deg - 90) < 0.05) { const u1 = G.norm(G.sub(prev, p)), u2 = G.norm(G.sub(next, p)); const k = 11 / z; const a1 = App.w2s(G.add(p, G.mul(u1, k))), c1 = App.w2s(G.add(G.add(p, G.mul(u1, k)), G.mul(u2, k))), b1 = App.w2s(G.add(p, G.mul(u2, k))); ctx.strokeStyle = C.red; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(c1.x, c1.y); ctx.lineTo(b1.x, b1.y); ctx.stroke(); const q0 = App.w2s(G.add(p, G.mul(G.add(u1, u2), k * 0.75))); App.labelRects.push({ id: s.id, i, ang: true, x: q0.x, y: q0.y, r: 12 }); continue; }
        const bis = G.norm(G.add(G.norm(G.sub(prev, p)), G.norm(G.sub(next, p))));
        const q = App.w2s(G.add(p, G.mul(bis, (deg > 180 ? -1 : 1) * 34 / z)));
        text(deg.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + '°', q.x, q.y, lk ? 700 : 300, 10, lk ? C.red : C.ink2);
        App.labelRects.push({ id: s.id, i, ang: true, x: q.x, y: q.y, r: 16 });
      }
    }
  }

  function drawMeasure(m, sel) {
    const a = App.w2s(m.a), b = App.w2s(m.b); const d = G.norm(G.sub(b, a)), nrm = { x: -d.y, y: d.x };
    ctx.strokeStyle = C.red; ctx.lineWidth = sel ? 2 : 1.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    for (const p of [a, b]) { ctx.moveTo(p.x + nrm.x * 6 + d.x * 3, p.y + nrm.y * 6 + d.y * 3); ctx.lineTo(p.x - nrm.x * 6 - d.x * 3, p.y - nrm.y * 6 - d.y * 3); }
    ctx.stroke();
    const L = G.dist(m.a, m.b); const mid = G.lerp(a, b, 0.5); const ang = upright(Math.atan2(b.y - a.y, b.x - a.x));
    const label = App.fmtCm(L) + ' cm';
    ctx.save(); ctx.translate(mid.x, mid.y); ctx.rotate(ang); ctx.font = font(700, 12); const tw = ctx.measureText(label).width;
    ctx.fillStyle = C.paper; ctx.fillRect(-tw / 2 - 4, -19, tw + 8, 15); ctx.fillStyle = C.red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, -11.5); ctx.restore();
  }

  App.drawElecGlyph = (c, g, sz, col, rot = 0) => {
    c.save(); c.rotate(rot); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.4; const r = sz / 2;
    const semi = (x) => { c.beginPath(); c.arc(x, 0, r * 0.62, Math.PI, 0, false); c.stroke(); c.beginPath(); c.moveTo(x, -r * 0.62); c.lineTo(x, -r); c.stroke(); };
    const t = (s, y = 0, w = 700, px = sz * 0.5) => { c.font = font(w, px); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, y); };
    switch (g) {
      case 'prise': semi(0); c.beginPath(); c.moveTo(-r * 0.62, 0); c.lineTo(r * 0.62, 0); c.stroke(); break;
      case 'prise2': semi(-r * 0.55); semi(r * 0.55); c.beginPath(); c.moveTo(-r * 1.2, 0); c.lineTo(r * 1.2, 0); c.stroke(); break;
      case 'prise32': semi(0); c.beginPath(); c.moveTo(-r * 0.62, 0); c.lineTo(r * 0.62, 0); c.stroke(); t('32', r * 0.55, 700, sz * 0.38); break;
      case 'prisecmd': semi(0); c.beginPath(); c.moveTo(-r * 0.62, 0); c.lineTo(r * 0.62, 0); c.moveTo(r * 0.2, -r * 0.3); c.lineTo(r * 0.9, -r * 1); c.stroke(); break;
      case 'usb': semi(0); c.beginPath(); c.moveTo(-r * 0.62, 0); c.lineTo(r * 0.62, 0); c.stroke(); t('U', r * 0.55, 700, sz * 0.38); break;
      case 'rj45': c.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); t('R'); break;
      case 'tv': c.strokeRect(-r * 0.8, -r * 0.7, r * 1.6, r * 1.4); t('TV', 0, 700, sz * 0.4); break;
      case 'inter': c.beginPath(); c.arc(0, 0, r * 0.4, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(r * 0.28, -r * 0.28); c.lineTo(r, -r); c.stroke(); break;
      case 'vv': c.beginPath(); c.arc(0, 0, r * 0.4, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(r * 0.28, -r * 0.28); c.lineTo(r, -r); c.moveTo(-r * 0.28, r * 0.28); c.lineTo(-r, r); c.stroke(); break;
      case 'bp': c.beginPath(); c.arc(0, 0, r * 0.5, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.18, 0, Math.PI * 2); c.fill(); break;
      case 'variateur': c.beginPath(); c.arc(0, 0, r * 0.4, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(-r, r * 0.6); c.lineTo(r, -r * 0.6); c.lineTo(r * 0.5, -r * 0.65); c.stroke(); break;
      case 'dcl': c.beginPath(); c.arc(0, 0, r * 0.7, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(-r * 0.5, -r * 0.5); c.lineTo(r * 0.5, r * 0.5); c.moveTo(r * 0.5, -r * 0.5); c.lineTo(-r * 0.5, r * 0.5); c.stroke(); break;
      case 'applique': c.beginPath(); c.arc(0, 0, r * 0.7, Math.PI, 0); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-r * 0.35, -r * 0.45); c.lineTo(r * 0.35, -r * 0.05); c.moveTo(r * 0.35, -r * 0.45); c.lineTo(-r * 0.35, -r * 0.05); c.stroke(); break;
      case 'spot': c.beginPath(); c.arc(0, 0, r * 0.35, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(0, 0, r * 0.6, 0, Math.PI * 2); c.stroke(); break;
      case 'tableau': c.fillRect(-r, -r * 0.55, r * 2, r * 1.1); break;
      case 'thermostat': c.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); t('T'); break;
      case 'detecteur': c.beginPath(); c.arc(0, 0, r * 0.75, 0, Math.PI * 2); c.stroke(); t('DF', 0, 700, sz * 0.36); break;
      case 'vmc': c.beginPath(); c.arc(0, 0, r * 0.75, 0, Math.PI * 2); c.stroke(); t('V', 0, 700, sz * 0.45); break;
      default: c.beginPath(); c.arc(0, 0, r * 0.5, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  };

  function drawElec(p, sel) {
    const q = App.w2s(p); const sz = Math.max(14, Math.min(24, S.view.z * 260));
    ctx.save(); ctx.translate(q.x, q.y);
    if (sel) { ctx.beginPath(); ctx.arc(0, 0, sz * 0.95, 0, Math.PI * 2); ctx.fillStyle = C.paper; ctx.fill(); ctx.strokeStyle = C.red; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]); }
    App.drawElecGlyph(ctx, (PL.lib.elec.find((e) => e.id === p.type) || {}).g || p.type, sz, C.red, -(p.rot || 0));
    ctx.restore();
    if (S.view.z > 0.09 && p.h != null && S.mode === 'elec') text(p.h + ' cm', q.x, q.y + sz * 0.95, 400, 9, C.ink2);
  }

  function drawSelection(s) {
    if (s.kind === 'elec' || s.a) return;
    if (!s.pts) return;
    path(s.pts); ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.setLineDash(s.locked ? [5, 4] : []); ctx.stroke(); ctx.setLineDash([]);
    if (s.locked) { const c = App.w2s(G.centroid(s.pts)); ctx.fillStyle = C.red; text('Verrouillé', c.x, c.y + 34, 700, 10, C.red); return; }
    App.edgeHandles = [];
    if (s.kind === 'piece' && S.tool === 'select') for (let i = 0; i < s.pts.length; i++) {
      const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length]; if (G.dist(a, b) * S.view.z < 70) continue; const m = App.w2s(G.lerp(a, b, 0.5)); const d = G.norm(G.sub(App.w2s(b), App.w2s(a)));
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.atan2(d.y, d.x)); ctx.fillStyle = S.dragE === i ? C.red : C.paper; ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.fillRect(-11, -4, 22, 8); ctx.strokeRect(-11, -4, 22, 8); ctx.restore();
      App.edgeHandles.push({ i, x: m.x, y: m.y });
    }
    for (let i = 0; i < s.pts.length; i++) { const q = App.w2s(s.pts[i]); const hot = S.dragV === i; ctx.fillStyle = hot ? C.red : C.paper; ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.fillRect(q.x - 6, q.y - 6, 12, 12); ctx.strokeRect(q.x - 6, q.y - 6, 12, 12); }
    if (S.tool === 'select') { const c = App.w2s(G.centroid(s.pts)); const y = c.y + (s.kind === 'piece' ? 58 : 0); ctx.beginPath(); ctx.arc(c.x, y, 13, 0, Math.PI * 2); ctx.fillStyle = C.red; ctx.fill(); ctx.strokeStyle = C.paper; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(c.x - 6, y); ctx.lineTo(c.x + 6, y); ctx.moveTo(c.x, y - 6); ctx.lineTo(c.x, y + 6); ctx.stroke(); App.moveHandle = { x: c.x, y }; }
  }

  function drawDraft() {
    const d = S.draft; if (!d.pts.length && !d.cursor) return;
    const pts = d.pts.map(App.w2s); ctx.strokeStyle = C.red; ctx.lineWidth = 1.6; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (d.cursor) { const c = App.w2s(d.cursor); if (pts.length) ctx.lineTo(c.x, c.y); }
    ctx.stroke();
    pts.forEach((p, i) => { ctx.fillStyle = i === 0 ? C.red : C.paper; ctx.strokeStyle = C.red; ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 6 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    if (d.cursor && d.pts.length) { const a = d.pts[d.pts.length - 1], L = G.dist(a, d.cursor); const m = App.w2s(G.lerp(a, d.cursor, 0.5)); ctx.font = font(700, 12); const s = App.fmtCm(L) + ' cm'; const tw = ctx.measureText(s).width; ctx.fillStyle = C.paper; ctx.fillRect(m.x - tw / 2 - 4, m.y - 22, tw + 8, 16); text(s, m.x, m.y - 14, 700, 12, C.red); }
  }

  function drawSnap(m) { const q = App.w2s(m.p); ctx.strokeStyle = C.red; ctx.lineWidth = 1.2; if (m.kind === 'sommet' || m.kind === 'fond') { ctx.strokeRect(q.x - 7, q.y - 7, 14, 14); } else { ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2); ctx.stroke(); } }

  function drawScale() {
    const z = S.view.z; const sh = App.ui ? App.ui.obstruction() : { bottom: 0 };
    const target = 90 / z; const steps = [100, 200, 500, 1000, 2000, 5000, 10000]; let L = steps[0]; for (const s of steps) if (s <= target) L = s;
    const x = 16, y = H - sh.bottom - 18; const px = L * z;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 4); ctx.stroke();
    text(L >= 1000 ? L / 1000 + ' m' : L / 10 + ' cm', x + px + 6, y - 2, 400, 10, C.ink2, 'left');
  }

  function drawLoupe() {
    const l = S.loupe, R = 56, mag = 2.6; const cx = Math.min(W - R - 8, Math.max(R + 8, l.x)), cy = Math.max(R + 8, l.y - 110);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    ctx.fillStyle = C.paper; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sw = (2 * R) / mag; ctx.drawImage(cv, (l.x - sw / 2) * dpr, (l.y - sw / 2) * dpr, sw * dpr, sw * dpr, (cx - R) * dpr, (cy - R) * dpr, 2 * R * dpr, 2 * R * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = C.red; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
    ctx.restore(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
  }

  /* ---------- export image ---------- */
  App.exportPNG = () => new Promise((res) => { draw(); cv.toBlob((b) => res(b), 'image/png'); });
})();
