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
