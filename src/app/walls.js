/* Calepin — cloisons : sélection d'un mur, verrou, déplacement parallèle avec aperçu et validation. */
(function () {
  const PL = globalThis.PL, G = PL.geom, App = globalThis.App, S = App.state;
  const Wm = (App.walls = {});
  const letter = (i) => String.fromCharCode(65 + (i % 26));
  Wm.name = (room, i) => letter(i) + letter((i + 1) % room.pts.length);
  Wm.isLocked = (room, i) => !!(room.locked || (room.locks && room.locks[i] && room.locks[i].P));

  /* faces de la même cloison dans les pièces voisines (parallèles, sens opposé, à moins de 52 cm) */
  Wm.partners = (s, i) => {
    const W = App.ops.wall(s, i); const out = [];
    for (const r of App.shapesOn(s.floor)) {
      if (r === s || r.kind !== 'piece') continue;
      for (let j = 0; j < r.pts.length; j++) {
        const V = App.ops.wall(r, j); if (V.el < 50 || G.dot(V.d, W.d) > -0.999) continue;
        const off = G.dot(G.sub(V.a, W.a), W.nin); if (off > 8 || off < -520) continue;
        const t0 = G.dot(G.sub(V.a, W.a), W.d), t1 = G.dot(G.sub(V.b, W.a), W.d);
        const ov = Math.min(W.el, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)); if (ov < 0.3 * Math.min(W.el, V.el)) continue;
        out.push({ room: r, j, off: Math.max(0, -off) });
      }
    }
    return out;
  };
  Wm.thickness = (s, i) => { const p = Wm.partners(s, i); return p.length ? Math.min(...p.map((x) => x.off)) : null; };
  Wm.toggleLock = (s, i) => { const v = !Wm.isLocked(s, i); App.mutate(() => { s.locks[i] = Object.assign({}, s.locks[i], { P: v }); Wm.partners(s, i).forEach((p) => { p.room.locks[p.j] = Object.assign({}, p.room.locks[p.j], { P: v }); }); }); return v; };

  /* ---------- pièces simples : un mur = un trait ----------
     Les décrochements de moins de 30 cm (embrasure de fenêtre ou de porte, châssis, vantail coulissant lu comme
     une cloison…) sont supprimés. La ligne retenue est celle des deux bouts du mur (là où il rejoint les murs
     voisins) ; l'ouverture qui était dans le renfoncement prend toute la largeur du trou. */
  const BAND = 300, ON = 40;
  const lineX = (p, d, q, e) => { const den = G.cross(d, e); if (Math.abs(den) < 1e-6) return null; const t = G.cross(G.sub(q, p), e) / den; return G.add(p, G.mul(d, t)); };
  Wm.chainPlan = (room, i, T = BAND) => {
    const P = room.pts, n = P.length; if (n < 5) return null; const at = (k) => P[((k % n) + n) % n]; const ix = (k) => ((k % n) + n) % n;
    const W0 = App.ops.wall(room, i); if (W0.el < 20) return null; const off0 = (v) => G.dot(G.sub(v, W0.a), W0.nin);
    let k = i + 1, j = i;
    while (k - j < n - 3 && Math.abs(off0(at(k + 1))) <= T) k++;
    while (k - j < n - 3 && Math.abs(off0(at(j - 1))) <= T) j--;
    if (k - j <= 1) return null;
    // ligne du mur : celle des premiers et derniers segments parallèles de la chaîne (les bouts du mur)
    const par = []; for (let q = j; q < k; q++) { const V = App.ops.wall(room, ix(q)); if (V.el >= 20 && G.dot(V.d, W0.d) > 0.999) par.push({ q, V, off: off0(V.a) }); }
    if (!par.length) return null; const first = par[0], last = par[par.length - 1];
    let base = Math.abs(first.off - last.off) <= ON ? (first.off < last.off ? first : last) : (first.V.el >= last.V.el ? first : last); // les deux bouts d'accord : la plus extérieure
    const B0 = G.add(W0.a, G.mul(W0.nin, base.off)), d = W0.d, nin = W0.nin; const off = (v) => G.dot(G.sub(v, B0), nin), tt = (v) => G.dot(G.sub(v, B0), d);
    const A = lineX(B0, d, at(j - 1), G.sub(at(j), at(j - 1))) || G.add(B0, G.mul(d, tt(at(j))));
    const B = lineX(B0, d, at(k), G.sub(at(k + 1), at(k))) || G.add(B0, G.mul(d, tt(at(k))));
    if (tt(B) - tt(A) < 500) return null; // un vrai mur, pas le bout d'une cloison mince
    // ne pas empiéter sur une pièce voisine
    for (const o of App.shapesOn(room.floor)) { if (o === room || o.id === room.id || o.kind !== 'piece') continue; for (const p of [A, B, G.lerp(A, B, 0.5)]) if (G.pointInPoly(p, o.pts) && G.distPointPoly(p, o.pts) > 30) return null; }
    let bumps = 0; for (let q = j; q <= k; q++) if (Math.abs(off(at(q))) > 1) bumps++;
    if (k - j <= 1 && bumps === 0) return null;
    // renfoncements : sommets hors de la ligne, regroupés ; leur étendue = la largeur du trou dans le mur
    const ex = []; let cur = null;
    for (let q = j; q <= k; q++) { const v = at(q); if (Math.abs(off(v)) > ON) { const t = tt(v); if (!cur) ex.push((cur = { t0: t, t1: t })); cur.t0 = Math.min(cur.t0, t); cur.t1 = Math.max(cur.t1, t); } else cur = null; }
    const keep = []; for (let m = k + 1; m <= j - 1 + n; m++) keep.push(ix(m));
    const pts = [A, B].concat(keep.map((m) => P[m]));
    if (pts.length < 3 || G.isSelfIntersecting(pts) || !(G.area(pts) > 0)) return null;
    const a0 = Math.abs(G.area(P)), a1 = Math.abs(G.area(pts)); if (Math.abs(a1 - a0) > 0.15 * a0) return null;
    const bv = []; for (let q = j; q <= k; q++) { const v = at(q); if (Math.abs(off(v)) > ON) bv.push({ x: v.x, y: v.y }); }
    const chain = []; for (let q = j; q <= k; q++) chain.push({ x: at(q).x, y: at(q).y });
    return { pts, j, k, A, B, i, chain, bumps: bv, depth: Math.max(0, ...chain.map((v) => Math.abs(off(v)))), ex: ex.map((e) => ({ t0: e.t0 - tt(A), t1: e.t1 - tt(A) })), removed: k - j + 1 - 2, chainEdges: Array.from({ length: k - j }, (_, q) => ix(j + q)), keep, da: a1 - a0, agree: Math.abs(first.off - last.off) <= ON };
  };
  /* recale les ouvertures sur le nouveau tracé (projection, même sens de mur), puis élargit au trou */
  function reproject(room, oldPts, plan, T) {
    const out = []; const newPts = plan.pts;
    for (const o of room.openings || []) {
      const m = oldPts.length; if (o.wall >= m) continue; const a = oldPts[o.wall], b = oldPts[(o.wall + 1) % m], d = G.norm(G.sub(b, a));
      const p0 = G.add(a, G.mul(d, o.pos)), p1 = G.add(p0, G.mul(d, o.width)), mid = G.lerp(p0, p1, 0.5); const tol = plan.chainEdges.includes(o.wall) ? T + 20 : 40;
      let best = null;
      for (let e = 0; e < newPts.length; e++) {
        const c = newPts[e], f = newPts[(e + 1) % newPts.length], el = G.dist(c, f); if (el < 50) continue; const u = G.mul(G.sub(f, c), 1 / el); if (G.dot(u, d) < 0.999) continue;
        const off = Math.abs(G.cross(G.sub(mid, c), u)); if (off > tol) continue; const t0 = G.dot(G.sub(p0, c), u), t1 = G.dot(G.sub(p1, c), u); const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(el, Math.max(t0, t1));
        if (hi - lo < 100) continue; if (!best || off < best.off) best = { off, wall: e, pos: lo, width: hi - lo };
      }
      if (best) out.push(Object.assign(o, { wall: best.wall, pos: best.pos, width: best.width }));
    }
    // une ou plusieurs ouvertures dans un même renfoncement : une seule, de la largeur du trou
    const el0 = G.dist(newPts[0], newPts[1]);
    for (const e of plan.ex) {
      const w = e.t1 - e.t0; if (w < 300) continue;
      const inside = out.filter((o) => o.wall === 0 && !o.link && o.pos + o.width / 2 > e.t0 - 50 && o.pos + o.width / 2 < e.t1 + 50); if (!inside.length) continue; // fenêtres (ouvertures sur l'extérieur)
      const cover = inside.reduce((s2, o) => s2 + o.width, 0); if (cover < 0.6 * w) continue;
      const keepO = inside.slice().sort((x, y) => (y.sw !== 0) - (x.sw !== 0) || y.width - x.width)[0];
      keepO.pos = Math.max(0, e.t0); keepO.width = Math.min(el0, e.t1) - keepO.pos;
      for (const o of inside) if (o !== keepO) out.splice(out.indexOf(o), 1);
    }
    out.forEach((o) => { o.pos = Math.round(o.pos); o.width = Math.round(o.width); });
    return out;
  }
  Wm.applyPlan = (room, plan, T = BAND) => {
    const old = room.pts;
    room.openings = reproject(room, old, plan, T);
    const oldLocks = room.locks || []; room.pts = plan.pts;
    room.locks = [{ L: false, A: false }, { L: false, A: false }].concat(plan.keep.map((m) => Object.assign({}, oldLocks[m] || {})));
    room.locks[room.locks.length - 1] = Object.assign({}, room.locks[room.locks.length - 1], { L: false });
    room.locks = PL.solver.syncLocks(room.pts, room.locks);
    if (room.cal && room.cal.start != null && room.cal.start !== 'auto') room.cal.start = 'auto';
  };
  /* décrochements ignorés : coins du creux (au cm), par pièce — le même creux n'est plus proposé */
  const vk = (v) => Math.round(v.x / 10) + ',' + Math.round(v.y / 10);
  const ignoredFor = (room) => new Set(((S.p.simpIgnore || {})[room.id]) || []);
  const isIgnored = (room, plan, ign) => plan.bumps.some((v) => ign.has(vk(v)));
  Wm.spotKey = (room, plan) => room.id + '|' + plan.bumps.map(vk).sort().join(';');
  /* pièce entière : on redresse tant qu'il reste des décrochements (murs les plus longs d'abord).
     opts.only : ne redresser que ce décrochement ; opts.record : liste des décrochements rencontrés */
  Wm.simplify = (room, opts = {}) => {
    if (!room.pts || room.pts.length < 5 || room.locked) return 0; let total = 0; const ign = ignoredFor(room);
    const want = opts.only ? new Set(opts.only.split('|')[1].split(';')) : null;
    for (let g = 0; g < 24; g++) {
      const order = room.pts.map((_, i) => i).sort((x, y) => App.ops.wall(room, y).el - App.ops.wall(room, x).el); let done = false;
      // d'abord les murs dont les deux bouts sont d'accord (sans ambiguïté), ensuite les autres
      for (const strict of [true, false]) {
        for (const i of order) {
          if (Wm.isLocked(room, i)) continue; const plan = Wm.chainPlan(room, i);
          if (!plan || (strict && !plan.agree) || plan.chainEdges.some((e) => Wm.isLocked(room, e)) || isIgnored(room, plan, ign)) continue;
          if (want && !plan.bumps.some((v) => want.has(vk(v)))) continue;
          if (opts.record) opts.record.push({ key: Wm.spotKey(room, plan), roomId: room.id, A: plan.A, B: plan.B, chain: plan.chain, depth: plan.depth, width: plan.ex.reduce((a, e) => a + (e.t1 - e.t0), 0) });
          Wm.applyPlan(room, plan); total += Math.max(1, plan.removed); done = true; break;
        }
        if (done) break;
      }
      if (!done || (want && total)) break;
    }
    return total;
  };
  Wm.countFixable = (room) => { const c = JSON.parse(JSON.stringify(room)); return Wm.simplify(c) ? 1 : 0; };
  /* liste des décrochements à simplifier sur un étage (mise en cache jusqu'à la prochaine modification) */
  let spotCache = { k: null, v: [] };
  Wm.spots = (fid = S.p.floorId) => {
    const k = (S.p.updatedAt || 0) + '|' + fid; if (spotCache.k === k) return spotCache.v;
    const out = [];
    for (const r of App.rooms(fid)) { const c = JSON.parse(JSON.stringify(r)); const rec = []; Wm.simplify(c, { record: rec }); for (const sp of rec) { const ctr = G.centroid(sp.chain.concat([sp.A, sp.B])); let wi = 0, bd = Infinity; r.pts.forEach((p, i) => { const d = G.distPointSeg(ctr, p, r.pts[(i + 1) % r.pts.length]); if (d < bd) { bd = d; wi = i; } }); out.push(Object.assign(sp, { name: r.name || 'Pièce', wall: Wm.name(r, wi), center: ctr })); } }
    spotCache = { k, v: out }; return out;
  };
  Wm.acceptSpot = (key) => { const sp = Wm.spots().find((x) => x.key === key); const room = sp && App.byId(sp.roomId); if (!room) return 0; let n = 0; App.mutate(() => { n = Wm.simplify(room, { only: key }); }); return n; };
  Wm.ignoreSpot = (key) => { const sp = Wm.spots().find((x) => x.key === key); if (!sp) return; App.mutate((P) => { const m = Object.assign({}, P.simpIgnore || {}); m[sp.roomId] = [...new Set((m[sp.roomId] || []).concat(key.split('|')[1].split(';')))]; P.simpIgnore = m; }); };
  Wm.ignoredCount = (fid = S.p.floorId) => App.rooms(fid).reduce((a, r) => a + (((S.p.simpIgnore || {})[r.id] || []).length ? 1 : 0), 0);
  Wm.resetIgnored = (fid = S.p.floorId) => { App.mutate((P) => { const m = Object.assign({}, P.simpIgnore || {}); for (const r of App.rooms(fid)) delete m[r.id]; P.simpIgnore = m; }); };
  Wm.fixRecesses = Wm.simplify;
  /* ouverture dans un renfoncement : la face du mur autour est plus loin dans la pièce */
  Wm.recessBase = (room, e) => {
    const n = room.pts.length, W = App.ops.wall(room, e);
    for (let s2 = -4; s2 <= 4; s2++) { if (!s2) continue; const f = ((e + s2) % n + n) % n; const V = App.ops.wall(room, f); if (V.el < 25 || G.dot(V.d, W.d) < 0.999) continue; const off = G.dot(G.sub(V.a, W.a), W.nin); if (off >= ON && off <= BAND) return f; }
    return null;
  };
  Wm.straighten = (room, i) => { const plan = Wm.chainPlan(room, i); if (!plan) return 0; Wm.applyPlan(room, plan); return Math.max(1, plan.removed); };
  Wm.canStraighten = (room, i) => !!Wm.chainPlan(room, i);

  /* ---------- déplacement en aperçu ---------- */
  const preserveOpenings = (room, origPts) => {
    for (const o of room.openings || []) {
      const n = origPts.length; if (o.wall >= n) continue; const a0 = origPts[o.wall], b0 = origPts[(o.wall + 1) % n], d0 = G.norm(G.sub(b0, a0));
      const pw = G.add(a0, G.mul(d0, o.pos)); const W = App.ops.wall(room, o.wall);
      const width = Math.min(o.width, W.el); o.pos = Math.max(0, Math.min(W.el - width, G.dot(G.sub(pw, W.a), W.d))); o.width = width;
    }
  };

  Wm.begin = (room, i, info) => {
    Wm.cancel(true);
    if (room.locked) return { err: `${room.name || 'La pièce'} est verrouillée` };
    if (Wm.isLocked(room, i)) return { err: 'Cloison verrouillée : déverrouillez-la pour la déplacer' };
    const parts = Wm.partners(room, i);
    const bad = parts.find((p) => p.room.locked || Wm.isLocked(p.room, p.j));
    if (bad) return { err: `Cloison verrouillée côté ${bad.room.name || 'voisin'}` };
    const snap = App.snapshot(); App.begin();
    const orig = {}; App.shapesOn(room.floor).filter((r) => r.kind === 'piece').forEach((r) => { orig[r.id] = { pts: G.clone(r.pts), openings: JSON.parse(JSON.stringify(r.openings || [])) }; });
    S.pending = { id: room.id, i, moving: [{ id: room.id, i, sg: 1 }].concat(parts.map((p) => ({ id: p.room.id, i: p.j, sg: -1 }))), orig, snap, delta: 0, affected: [], valid: true, info: info || null };
    return { ok: true };
  };
  Wm.apply = (delta) => {
    const P = S.pending; if (!P) return;
    for (const id in P.orig) { const r = App.byId(id); if (!r) continue; r.pts = G.clone(P.orig[id].pts); r.openings = JSON.parse(JSON.stringify(P.orig[id].openings)); }
    let valid = true;
    for (const m of P.moving) {
      const r = App.byId(m.id); const np = App.feat.moveEdgePts(r.pts, m.i, m.sg * delta);
      if (!(G.area(np) > 0.2e6) || G.isSelfIntersecting(np)) valid = false; else r.pts = np;
    }
    const affected = [];
    for (const id in P.orig) {
      const r = App.byId(id); if (!r) continue; const o = P.orig[id].pts; if (o.length !== r.pts.length) continue;
      let changed = false;
      for (let e = 0; e < o.length; e++) {
        const L0 = G.dist(o[e], o[(e + 1) % o.length]), L1 = G.dist(r.pts[e], r.pts[(e + 1) % o.length]);
        if (G.dist(o[e], r.pts[e]) > 0.5) changed = true;
        if (Math.abs(L1 - L0) > 0.5 && !P.moving.some((m) => m.id === id && m.i === e)) affected.push({ id, i: e, L0, L1, locked: !!(r.locks[e] && r.locks[e].L), name: r.name });
      }
      if (changed) preserveOpenings(r, o);
    }
    // une ouverture recalée (mur raccourci) entraîne sa jumelle
    for (const id in P.orig) { const r = App.byId(id); if (!r) continue; (r.openings || []).forEach((o, k) => { const o0 = P.orig[id].openings[k]; if (o0 && (Math.abs(o0.pos - o.pos) > 0.5 || Math.abs(o0.width - o.width) > 0.5)) App.ops.syncTwin(r, o); }); }
    P.delta = delta; P.affected = affected; P.valid = valid; S.calc = {};
  };
  Wm.cancel = (silent) => {
    const P = S.pending; if (!P) return false;
    S.p = JSON.parse(P.snap); S.pending = null; App.end(false); S.calc = {};
    if (!silent) { App.render(); App.ui && App.ui.refresh(); }
    return true;
  };
  Wm.validate = async (force) => {
    const P = S.pending; if (!P) return;
    if (!P.valid) { App.toast('Déplacement impossible : une pièce se retournerait'); return; }
    if (Math.abs(P.delta) < 0.5) { Wm.cancel(); return; }
    const locked = P.affected.filter((a) => a.locked);
    if (locked.length && !force) {
      const ok = await App.ui.confirm('Cotes verrouillées', `Ces cotes verrouillées vont changer et seront déverrouillées : ${locked.map((a) => `${a.name || 'pièce'} ${Wm.name(App.byId(a.id), a.i)} (${App.fmtCm(a.L0)} → ${App.fmtCm(a.L1)} cm)`).join(', ')}.`, 'Valider');
      if (!ok) return; if (!S.pending) return;
    }
    for (const id in P.orig) { const r = App.byId(id); if (!r) continue; P.affected.filter((a) => a.id === id && a.locked).forEach((a) => { r.locks[a.i].L = false; }); r.locks = PL.solver.syncLocks(r.pts, r.locks); }
    const n = P.affected.length; S.pending = null; App.end(true);
    App.toast(`Cloison déplacée de ${App.fmtCm(Math.abs(P.delta))} cm${n ? ' · ' + n + ' mur' + (n > 1 ? 's' : '') + ' étiré' + (n > 1 ? 's' : '') : ''}`);
  };

  /* longueur d'un mur : on déplace le mur voisin choisi, parallèlement */
  Wm.lengthPlan = (room, i, end, newL) => {
    const n = room.pts.length, W = App.ops.wall(room, i), j = end === 'B' ? (i + 1) % n : (i - 1 + n) % n, V = App.ops.wall(room, j);
    const k = end === 'B' ? G.dot(W.d, V.nin) : -G.dot(W.d, V.nin);
    if (Math.abs(k) < 0.2) return { err: 'Le mur voisin est presque parallèle : impossible de changer la longueur de ce côté' };
    return { j, delta: (newL - W.el) * k };
  };
  Wm.defaultEnd = (room, i) => { const n = room.pts.length; const lb = Wm.isLocked(room, (i + 1) % n), la = Wm.isLocked(room, (i - 1 + n) % n); return lb && !la ? 'A' : 'B'; };
})();
