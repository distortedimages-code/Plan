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

  /* ---------- redresser un mur : décrochements (embrasure de porte, vantail coulissant lu comme un mur…) ---------- */
  const lineX = (p, d, q, e) => { const den = G.cross(d, e); if (Math.abs(den) < 1e-6) return null; const t = G.cross(G.sub(q, p), e) / den; return G.add(p, G.mul(d, t)); };
  /* chaîne de sommets à moins de T de la ligne du mur i ; renvoie le nouveau tracé et la correspondance des côtés */
  Wm.chainPlan = (room, i, T = 300) => {
    const P = room.pts, n = P.length; if (n < 5) return null; const at = (k) => P[((k % n) + n) % n];
    const W = App.ops.wall(room, i); if (W.el < 20) return null; const dist = (v) => Math.abs(G.dot(G.sub(v, W.a), W.nin));
    let k = i + 1, j = i;
    while (k - j < n - 3 && dist(at(k + 1)) <= T) k++;
    while (k - j < n - 3 && dist(at(j - 1)) <= T) j--;
    if (k - j <= 1 && dist(at(j)) < 1 && dist(at(k)) < 1) return null;
    const A = lineX(W.a, W.d, at(j - 1), G.sub(at(j), at(j - 1))) || G.add(W.a, G.mul(W.d, G.dot(G.sub(at(j), W.a), W.d)));
    const B = lineX(W.a, W.d, at(k), G.sub(at(k + 1), at(k))) || G.add(W.a, G.mul(W.d, G.dot(G.sub(at(k), W.a), W.d)));
    if (G.dot(G.sub(B, A), W.d) < 100) return null;
    const keep = []; for (let m = k + 1; m <= j - 1 + n; m++) keep.push(((m % n) + n) % n); // de k+1 à j-1 (sens du tracé)
    const pts = [A, B].concat(keep.map((m) => P[m]));
    if (pts.length < 3 || G.isSelfIntersecting(pts) || !(G.area(pts) > 0)) return null;
    return { pts, j, k, A, B, removed: k - j + 1 - 2, chainEdges: Array.from({ length: k - j }, (_, q) => ((j + q) % n + n) % n), keep };
  };
  /* recale les ouvertures sur le nouveau tracé (projection, même sens de mur) */
  function reproject(room, oldPts, newPts, chainEdges, T) {
    const out = [];
    for (const o of room.openings || []) {
      const m = oldPts.length; if (o.wall >= m) continue; const a = oldPts[o.wall], b = oldPts[(o.wall + 1) % m], d = G.norm(G.sub(b, a));
      const p0 = G.add(a, G.mul(d, o.pos)), p1 = G.add(p0, G.mul(d, o.width)), mid = G.lerp(p0, p1, 0.5); const tol = chainEdges.includes(o.wall) ? T + 20 : 40;
      let best = null;
      for (let e = 0; e < newPts.length; e++) {
        const c = newPts[e], f = newPts[(e + 1) % newPts.length], el = G.dist(c, f); if (el < 50) continue; const u = G.mul(G.sub(f, c), 1 / el); if (G.dot(u, d) < 0.999) continue;
        const off = Math.abs(G.cross(G.sub(mid, c), u)); if (off > tol) continue; const t0 = G.dot(G.sub(p0, c), u), t1 = G.dot(G.sub(p1, c), u); const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(el, Math.max(t0, t1));
        if (hi - lo < 100) continue; if (!best || off < best.off) best = { off, wall: e, pos: lo, width: hi - lo };
      }
      if (best) out.push(Object.assign(o, { wall: best.wall, pos: Math.round(best.pos), width: Math.round(best.width) }));
    }
    return out;
  }
  Wm.applyPlan = (room, plan, T = 300) => {
    const old = room.pts; const n = old.length;
    room.openings = reproject(room, old, plan.pts, plan.chainEdges, T);
    const oldLocks = room.locks || []; room.pts = plan.pts;
    room.locks = [{ L: false, A: false }, { L: false, A: false }].concat(plan.keep.map((m) => Object.assign({}, oldLocks[m] || {})));
    if (room.locks.length) { room.locks[room.locks.length - 1] = Object.assign({}, room.locks[room.locks.length - 1], { L: false }); }
    room.locks = PL.solver.syncLocks(room.pts, room.locks);
    if (room.cal && room.cal.start != null && room.cal.start !== 'auto') room.cal.start = 'auto';
  };
  /* décrochements autour d'une ouverture : la face du mur est un peu plus loin dans la pièce, de part et d'autre */
  Wm.recessBase = (room, e) => {
    const n = room.pts.length, W = App.ops.wall(room, e); const cands = [];
    for (let s = -4; s <= 4; s++) {
      if (!s) continue; const f = ((e + s) % n + n) % n; const V = App.ops.wall(room, f); if (V.el < 25 || G.dot(V.d, W.d) < 0.999) continue;
      const off = G.dot(G.sub(V.a, W.a), W.nin); if (off < 40 || off > 300) continue; cands.push({ f, off, el: V.el });
    }
    if (!cands.length) return null; const mx = Math.max(...cands.map((c) => c.el));
    return cands.filter((c) => c.el >= 0.4 * mx).sort((a, b) => a.off - b.off)[0].f;
  };
  Wm.recesses = (room) => { const out = []; const seen = new Set(); for (const o of room.openings || []) { if (seen.has(o.wall)) continue; seen.add(o.wall); const b = Wm.recessBase(room, o.wall); if (b != null) out.push({ e: o.wall, base: b }); } return out; };
  /* aligne le mur i (ou, s'il porte une ouverture en retrait, la face du mur autour) ; renvoie le nombre de sommets retirés */
  Wm.straighten = (room, i) => {
    const base = Wm.recessBase(room, i); const plan = Wm.chainPlan(room, base != null ? base : i); if (!plan) return 0;
    Wm.applyPlan(room, plan); return plan.removed;
  };
  /* un décrochement n'est redressé d'office que s'il rapproche la surface de celle écrite sur le plan
     (sans surface connue : seulement si la face du mur autour est plus longue que l'ouverture en retrait) */
  Wm.suggest = (room, r) => {
    const plan = Wm.chainPlan(room, r.base); if (!plan || !plan.chainEdges.includes(r.e)) return null;
    if (room.areaLabel) { const L = room.areaLabel * 1e6, a0 = Math.abs(G.area(room.pts)), a1 = Math.abs(G.area(plan.pts)); return Math.abs(a1 - L) < Math.abs(a0 - L) - 1e4 ? plan : null; }
    const B = App.ops.wall(room, r.base), E = App.ops.wall(room, r.e); let base = 0;
    for (const e of plan.chainEdges) { const V = App.ops.wall(room, e); if (G.dot(V.d, B.d) > 0.999 && Math.abs(G.dot(G.sub(V.a, B.a), B.nin)) < 40) base += V.el; }
    return base >= E.el ? plan : null;
  };
  Wm.fixRecesses = (room) => {
    let total = 0; const no = new Set(); const key = (r) => ((room.openings || []).find((o) => o.wall === r.e) || {}).oid || r.e;
    for (let g = 0; g < 16; g++) {
      const r = Wm.recesses(room).find((x) => !no.has(key(x))); if (!r) break;
      const plan = Wm.suggest(room, r); if (!plan) { no.add(key(r)); continue; }
      Wm.applyPlan(room, plan); total++;
    }
    return total;
  };
  Wm.countFixable = (room) => { const c = JSON.parse(JSON.stringify(room)); return Wm.fixRecesses(c); };
  Wm.canStraighten = (room, i) => { const base = Wm.recessBase(room, i); return !!Wm.chainPlan(room, base != null ? base : i); };

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
