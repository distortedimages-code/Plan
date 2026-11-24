/* Calepin — outils avancés : fusion, cloisons, déplacement de murs, optimisation, ordre de pose, pas à pas. */
(function () {
  const PL = globalThis.PL, G = PL.geom, App = globalThis.App, S = App.state;
  const F = (App.feat = {});

  /* ---------- rattacher des ouvertures à un nouveau contour ---------- */
  F.reattach = (pts, olds, skipTo = []) => {
    const out = []; const n = pts.length;
    for (const s of olds) for (const o of s.openings || []) {
      if (o.to && skipTo.includes(o.to)) continue;
      const m = s.pts.length; if (o.wall >= m) continue;
      const a = s.pts[o.wall], b = s.pts[(o.wall + 1) % m], d = G.norm(G.sub(b, a));
      const p0 = G.add(a, G.mul(d, o.pos)), p1 = G.add(p0, G.mul(d, o.width));
      let best = null;
      for (let i = 0; i < n; i++) {
        const c = pts[i], e = pts[(i + 1) % n], ed = G.sub(e, c), el = G.len(ed); if (el < 50) continue;
        const u = G.mul(ed, 1 / el); if (G.dot(u, d) < 0.999) continue; // même sens : la face du mur côté de cette pièce, pas celle de la voisine
        const dist = Math.abs(G.cross(G.sub(p0, c), u)); if (dist > 40) continue;
        const t0 = G.dot(G.sub(p0, c), u), t1 = G.dot(G.sub(p1, c), u); const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
        if (hi < -10 || lo > el + 10) continue;
        if (!best || dist < best.dist) best = { dist, wall: i, pos: Math.max(0, lo), width: Math.min(el, hi) - Math.max(0, lo) };
      }
      if (best && best.width > 100) out.push(Object.assign({}, o, { oid: App.uid(), wall: best.wall, pos: Math.round(best.pos), width: Math.round(best.width) }));
    }
    return out;
  };

  /* ---------- fusion de pièces (fermeture morphologique) ---------- */
  F.mergePolys = (polys, gap = 420) => {
    const all = polys.flat(); const bb = G.bbox(all); const pad = gap + 200;
    const res = Math.max(8, Math.max(bb.w + 2 * pad, bb.h + 2 * pad) / 1800);
    const w = Math.ceil((bb.w + 2 * pad) / res), h = Math.ceil((bb.h + 2 * pad) / res);
    const X = (x) => (x - bb.x0 + pad) / res, Y = (y) => (bb.y1 + pad - y) / res;
    const M = new Uint8Array(w * h);
    const rings = polys.map((P) => P.map((p) => ({ x: X(p.x), y: Y(p.y) })));
    for (let j = 0; j < h; j++) for (const R of rings) for (const iv of G.intervalsAtY([R], j + 0.5)) { const x0 = Math.max(0, Math.ceil(iv[0] - 0.5)), x1 = Math.min(w - 1, Math.floor(iv[1] - 0.5)); for (let i = x0; i <= x1; i++) M[j * w + i] = 1; }
    const r = gap / 2 / res, r2 = r * r;
    const D1 = PL.raster.edt(M, w, h); const dil = new Uint8Array(w * h); for (let i = 0; i < dil.length; i++) dil[i] = D1[i] <= r2 ? 1 : 0;
    const inv = new Uint8Array(w * h); for (let i = 0; i < inv.length; i++) inv[i] = dil[i] ? 0 : 1;
    const D2 = PL.raster.edt(inv, w, h); const R = new Uint8Array(w * h); for (let i = 0; i < R.length; i++) R[i] = D2[i] > r2 ? 1 : 0;
    // contour
    const img = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    for (let i = 0; i < R.length; i++) { const v = R[i] ? 255 : 0; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    let start = -1; for (let i = 0; i < R.length; i++) if (R[i]) { start = i; break; } if (start < 0) return null;
    const wr = PL.raster.wand(img, { x: start % w, y: (start / w) | 0 }, { thr: 128, simplify: 1.2 });
    let pts = wr.poly.map((q) => ({ x: (q.x * res) - pad + bb.x0, y: bb.y1 + pad - q.y * res }));
    // les pixels blancs = pièce → wand remplit le blanc
    const dom = PL.vec.dominantAngle(polys.flatMap((P) => P.map((p, i) => ({ a: p, b: P[(i + 1) % P.length] }))));
    pts = PL.vec.regularize(G.cleanPoly(pts, 1, res * 1.2), dom, 4);
    pts = chamfers(G.cleanPoly(pts, 0.5, 5), gap);
    return G.ensureCCW(G.cleanPoly(pts, 0.5, 5));
  };
  function chamfers(P, gap) {
    let pts = P.slice(), changed = true, guard = 0;
    while (changed && guard++ < 60 && pts.length > 4) {
      changed = false; const n = pts.length;
      for (let i = 0; i < n && !changed; i++) {
        const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n], d = pts[(i + 2) % n];
        const l = G.dist(b, c); if (l > gap * 1.6) continue;
        if (G.dist(a, b) < l || G.dist(c, d) < l) continue;
        const q = G.lineInter(a, G.sub(b, a), d, G.sub(c, d)); if (!q || G.dist(q, b) > gap * 1.5 || G.dist(q, c) > gap * 1.5) continue;
        pts.splice(i, 1, q); pts.splice((i + 1) % pts.length, 1); changed = true;
      }
    }
    return pts;
  }
  F.neighbours = (room, maxGap = 450) => App.rooms(room.floor).filter((r) => r.id !== room.id && G.distPointPoly(G.centroid(r.pts), room.pts) < 1e9 && polyDist(r.pts, room.pts) < maxGap);
  function polyDist(A, B) { let m = Infinity; for (const p of A) m = Math.min(m, G.distPointPoly(p, B)); for (const p of B) m = Math.min(m, G.distPointPoly(p, A)); return m; }
  F.merge = (a, b) => {
    const pts = F.mergePolys([a.pts, b.pts]); if (!pts || pts.length < 3) { App.toast('Fusion impossible'); return null; }
    const big = Math.abs(G.area(a.pts)) >= Math.abs(G.area(b.pts)) ? a : b;
    const sh = App.makeShape('piece', pts, { name: big.name, floor: a.floor, parquet: a.parquet !== false || b.parquet !== false, cal: big.cal ? Object.assign({}, big.cal) : undefined, ceiling: big.ceiling });
    sh.openings = F.reattach(pts, [a, b], [a.id, b.id]);
    App.mutate((P) => { P.shapes = P.shapes.filter((x) => x.id !== a.id && x.id !== b.id); P.shapes.push(sh); P.shapes.forEach((r) => (r.openings || []).forEach((o) => { if (o.to === a.id || o.to === b.id) o.to = sh.id; })); });
    return sh;
  };

  /* ---------- cloison : coupe une pièce par une ligne, avec épaisseur ---------- */
  F.partition = (s, a, b, thick) => {
    const d = G.norm(G.sub(b, a)), n = G.perp(d); const half = Math.max(0, thick / 2);
    const A = G.cleanPoly(G.clipHalf(s.pts, a, n, half), 0.2, 2), B = G.cleanPoly(G.clipHalf(s.pts, a, G.mul(n, -1), half), 0.2, 2);
    if (A.length < 3 || B.length < 3 || Math.abs(G.area(A)) < 0.2e6 || Math.abs(G.area(B)) < 0.2e6) return null;
    const mk = (pts, nm) => { const sh = App.makeShape(s.kind, G.ensureCCW(pts), { name: nm, floor: s.floor, parquet: s.parquet, ceiling: s.ceiling, cal: s.cal ? Object.assign({}, s.cal) : undefined }); sh.openings = F.reattach(sh.pts, [s]); const m = PL.solver.measure(sh.pts); sh.locks = PL.solver.syncLocks(sh.pts, m.A.map((x) => ({ L: false, A: Math.abs(G.deg(x) - 90) < 0.05 || Math.abs(G.deg(x) - 270) < 0.05 }))); return sh; };
    const big = Math.abs(G.area(A)) >= Math.abs(G.area(B));
    const s1 = mk(A, big ? s.name : (s.name || 'Pièce') + ' (b)'), s2 = mk(B, big ? (s.name || 'Pièce') + ' (b)' : s.name);
    if (thick > 0) { // porte : aucune — l'utilisateur l'ajoute
    }
    App.mutate((P) => { P.shapes = P.shapes.filter((x) => x.id !== s.id); P.shapes.push(s1, s2); });
    return [s1, s2];
  };

  /* ---------- déplacer un mur (et la face opposée de la cloison) ---------- */
  F.partners = (s, i) => {
    const n = s.pts.length, a = s.pts[i], b = s.pts[(i + 1) % n], d = G.norm(G.sub(b, a)), nin = G.perp(d);
    const out = [];
    for (const r of App.shapesOn(s.floor)) {
      if (r.id === s.id || r.kind !== 'piece' || r.locked) continue;
      const m = r.pts.length;
      for (let j = 0; j < m; j++) {
        const c = r.pts[j], e = r.pts[(j + 1) % m], ed = G.norm(G.sub(e, c));
        if (G.dot(ed, d) > -0.999) continue; // face opposée : sens inverse
        const off = G.dot(G.sub(c, a), nin); if (off > -30 || off < -450) continue; // derrière le mur, à moins de 45 cm
        const t0 = G.dot(G.sub(c, a), d), t1 = G.dot(G.sub(e, a), d), L = G.dist(a, b);
        const ov = Math.min(L, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)); if (ov < 0.3 * Math.min(L, G.dist(c, e))) continue;
        out.push({ s: r, j, off: -off });
      }
    }
    return out;
  };
  F.moveEdgePts = (P, i, delta) => {
    const n = P.length, a = P[i], b = P[(i + 1) % n], d = G.norm(G.sub(b, a)), nin = G.perp(d);
    const sh = G.mul(nin, delta); const a2 = G.add(a, sh), b2 = G.add(b, sh);
    const prev = P[(i - 1 + n) % n], next = P[(i + 2) % n];
    const na = Math.abs(G.cross(G.norm(G.sub(a, prev)), d)) < 1e-3 ? a2 : G.lineInter(prev, G.sub(a, prev), a2, d);
    const nb = Math.abs(G.cross(G.norm(G.sub(next, b)), d)) < 1e-3 ? b2 : G.lineInter(b, G.sub(next, b), b2, d);
    const out = G.clone(P); out[i] = na || a2; out[(i + 1) % n] = nb || b2; return out;
  };

  /* ---------- surface habitable (hauteur ≥ 1,80 m) ---------- */
  F.zonesIn = (room) => App.shapesOn(room.floor).filter((z) => z.kind === 'plafond' && G.pointInPoly(G.centroid(z.pts), room.pts));
  F.habitable = (room) => { const A = Math.abs(G.area(room.pts)); const low = F.zonesIn(room).filter((z) => (z.hmax ?? 180) <= 180).reduce((s, z) => s + Math.min(Math.abs(G.area(z.pts)), G.overlapArea(z.pts, room.pts, 40)), 0); return { A, SH: Math.max(0, A - low), low }; };
  F.ceiling = (room) => room.ceiling || (S.p.floors.find((f) => f.id === room.floor) || {}).ceiling || 250;

  /* ---------- optimiseur de pose pour une pièce ---------- */
  F.optimize = (room) => {
    const P = S.p.parquet; const n = room.pts.length; const obstacles = App.shapesOn(room.floor).filter((s) => ['exclusion', 'escalier', 'poteau'].includes(s.kind) || (s.kind === 'meuble' && s.noParquet));
    const dirs = []; for (let i = 0; i < n; i++) { const a = room.pts[i], b = room.pts[(i + 1) % n]; if (G.dist(a, b) < 600) continue; let ang = ((G.deg(Math.atan2(b.y - a.y, b.x - a.x)) % 180) + 180) % 180; if (!dirs.some((x) => Math.abs(x.ang - ang) < 1 || Math.abs(x.ang - ang) > 179)) dirs.push({ ang, wall: i }); }
    const variants = [];
    for (const d of dirs.slice(0, 4)) {
      const starts = ['auto']; for (let i = 0; i < n; i++) { const a = room.pts[i], b = room.pts[(i + 1) % n]; const ang = ((G.deg(Math.atan2(b.y - a.y, b.x - a.x)) % 180) + 180) % 180; if (G.dist(a, b) > 800 && (Math.abs(ang - d.ang) < 1 || Math.abs(ang - d.ang) > 179)) starts.push(i); }
      for (const st of starts.slice(0, 5)) for (const pattern of [P.pattern]) {
        const clone = Object.assign({}, room, { cal: { dir: d.ang, start: st, group: '' } });
        let r; try { r = PL.layout.computeFloor([clone, ...obstacles], Object.assign({}, P, { pattern })); } catch (e) { continue; }
        const res = r.results[room.id]; if (!res) continue;
        const warns = res.advice.filter((x) => x.warn).length; const rows = res.rows;
        const minRow = Math.min(...rows.map((x) => x.ripMax).filter((x) => x > 1));
        const waste = r.totals.wasteLen / ((r.totals.boards || 1) * P.L);
        variants.push({ dir: d.ang, wallDir: d.wall, start: st, boards: r.totals.boards, waste, warns, rows: rows.length, first: rows[0] ? rows[0].ripMax : 0, last: rows.length ? rows[rows.length - 1].ripMax : 0, minRow, startIdx: res.startEdgeIdx, cuts: res.cuts });
      }
    }
    const seen = new Set(); const uniq = variants.filter((v) => { const k = v.dir.toFixed(1) + '|' + v.startIdx + '|' + v.boards + '|' + Math.round(v.first); if (seen.has(k)) return false; seen.add(k); return true; });
    uniq.sort((a, b) => a.warns - b.warns || a.boards - b.boards || a.waste - b.waste || b.minRow - a.minRow);
    return uniq.slice(0, 4);
  };

  /* ---------- liste de courses ---------- */
  F.shopping = (fid) => {
    const cal = App.calepinage(fid); const P = cal.P || S.p.parquet; const rooms = App.rooms(fid).filter((r) => r.parquet !== false);
    const floorLevel = ['porte', 'porte2', 'coulissante', 'galandage', 'passage', 'porte-fenetre', 'baie'];
    let plinth = 0, seuils = [], area = 0;
    for (const r of rooms) {
      const res = cal.results[r.id]; area += res ? res.area : Math.abs(G.area(r.pts));
      plinth += G.perimeter(r.pts) - (r.openings || []).filter((o) => floorLevel.includes(o.type)).reduce((sum, o) => sum + o.width, 0);
      const myG = (r.cal && r.cal.group) || '';
      for (const o of r.openings || []) {
        if (!['porte', 'porte2', 'coulissante', 'galandage', 'passage'].includes(o.type)) continue;
        const other = o.to ? App.byId(o.to) : null; const oG = other && other.cal && other.cal.group || '';
        if (other && myG && myG === oG && other.parquet !== false) continue;
        if (other && rooms.includes(other) && other.id < r.id) continue; // une seule barre par passage
        seuils.push(o.width);
      }
    }
    const stairs = App.shapesOn(fid).filter((x) => x.kind === 'escalier');
    const t = cal.totals || {};
    return { area: area / 1e6, boxes: t.boxes, boards: t.boards, perBox: t.perBox, underlay: (area / 1e6) * 1.05, plinth: plinth / 1000, plinthBars: Math.ceil((plinth * 1.1) / 2400), seuils, stairs: stairs.length, stairDown: stairs.filter((x) => x.stair && x.stair.dir === 'descend').length };
  };

  /* ---------- ordre de pose : du plus loin de l'escalier vers la sortie ---------- */
  F.order = (fid) => {
    const rooms = App.rooms(fid).filter((r) => r.parquet !== false); if (!rooms.length) return [];
    const stair = App.shapesOn(fid).find((s) => s.kind === 'escalier');
    let origin = null;
    if (stair) { const c = G.centroid(stair.pts); origin = rooms.slice().sort((a, b) => G.distPointPoly(c, a.pts) - G.distPointPoly(c, b.pts))[0]; }
    if (!origin) origin = rooms.slice().sort((a, b) => (b.openings || []).length - (a.openings || []).length)[0];
    const adj = new Map(rooms.map((r) => [r.id, new Set()]));
    for (const r of rooms) for (const o of r.openings || []) if (o.to && adj.has(o.to)) { adj.get(r.id).add(o.to); adj.get(o.to).add(r.id); }
    const dist = new Map([[origin.id, 0]]); const q = [origin.id];
    while (q.length) { const id = q.shift(); for (const nb of adj.get(id)) if (!dist.has(nb)) { dist.set(nb, dist.get(id) + 1); q.push(nb); } }
    const oc = G.centroid(origin.pts);
    return rooms.slice().sort((a, b) => (dist.get(b.id) ?? 99) - (dist.get(a.id) ?? 99) || G.dist(G.centroid(b.pts), oc) - G.dist(G.centroid(a.pts), oc));
  };
})();
