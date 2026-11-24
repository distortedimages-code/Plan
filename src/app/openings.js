/* Calepin — portes et fenêtres : géométrie, jumelage entre pièces, sens, sélection, ajout. */
(function () {
  const PL = globalThis.PL, G = PL.geom, App = globalThis.App, S = App.state;
  const O = (App.ops = {});
  O.DOORS = ['porte', 'porte2', 'coulissante', 'galandage'];
  O.INTERIOR = ['porte', 'porte2', 'coulissante', 'galandage', 'passage'];
  O.name = (t) => (PL.lib.openings.find((x) => x.id === t) || {}).name || t;
  /* nombre de vantaux ouvrants : choisi, sinon deux à partir de 90 cm */
  O.leaves = (o) => { if (o.type === 'porte2' || o.type === 'baie') return 2; if (o.type === 'fenetre' || o.type === 'porte-fenetre') return o.leaves || ((o.width || 0) >= 900 ? 2 : 1); return 1; };

  O.wall = (room, i) => { const n = room.pts.length, a = room.pts[i % n], b = room.pts[(i + 1) % n], el = G.dist(a, b); const d = el ? G.mul(G.sub(b, a), 1 / el) : { x: 1, y: 0 }; return { a, b, el, d, nin: G.perp(d) }; };
  O.geo = (room, o) => {
    if (!room || !o || o.wall >= room.pts.length) return null; const W = O.wall(room, o.wall); if (W.el < 1) return null;
    const pos = Math.max(0, Math.min(o.pos, W.el - 10)), w = Math.max(10, Math.min(o.width, W.el - pos));
    const p0 = G.add(W.a, G.mul(W.d, pos)), p1 = G.add(W.a, G.mul(W.d, pos + w));
    return Object.assign(W, { pos, w, p0, p1, mid: G.lerp(p0, p1, 0.5) });
  };
  O.hingePt = (room, o) => { const g = O.geo(room, o); return o.hinge === 'd' ? g.p1 : g.p0; };
  O.find = (oid) => { if (!oid) return null; for (const r of S.p.shapes) { if (r.kind !== 'piece' || !r.openings) continue; const k = r.openings.findIndex((x) => x.oid === oid); if (k >= 0) return { room: r, o: r.openings[k], k }; } return null; };
  O.twin = (room, o) => { if (!o || !o.link) return null; for (const r of S.p.shapes) { if (r === room || r.kind !== 'piece' || r.floor !== room.floor) continue; const t = (r.openings || []).find((x) => x.link === o.link); if (t) return { room: r, o: t }; } return null; };
  O.primary = (room, o) => { if (o.sw === 0) { const t = O.twin(room, o); if (t) return t; } return { room, o }; };
  O.selected = () => { if (!S.sel || !S.sel.oid) return null; const f = O.find(S.sel.oid); return f ? O.primary(f.room, f.o) : null; };

  /* ---------- jumelage : une porte entre deux pièces = deux ouvertures liées, une seule dessinée ---------- */
  O.relink = (p, fid) => {
    for (const r of p.shapes) if (r.kind === 'piece' && r.floor === fid && r.openings && r.openings.length > 1) O.tidy(r);
    const items = [];
    for (const r of p.shapes) { if (r.kind !== 'piece' || r.floor !== fid) continue; r.openings = r.openings || []; for (const o of r.openings) { if (!o.oid) o.oid = App.uid(); const g = O.geo(r, o); if (g) items.push({ r, o, g }); } }
    const pairs = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const A = items[i], B = items[j]; if (A.r === B.r || G.dot(A.g.d, B.g.d) > -0.995) continue;
      const off = G.dot(G.sub(B.g.p0, A.g.p0), A.g.nin); if (off > 8 || off < -520) continue;
      const a0 = G.dot(A.g.p0, A.g.d), a1 = G.dot(A.g.p1, A.g.d), b0 = G.dot(B.g.p0, A.g.d), b1 = G.dot(B.g.p1, A.g.d);
      const ov = Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1));
      if (ov < 0.5 * Math.min(A.g.w, B.g.w)) continue;
      pairs.push({ A, B, s: -off + (A.o.link && A.o.link === B.o.link ? -1000 : 0) });
    }
    pairs.sort((x, y) => x.s - y.s); const used = new Set();
    for (const { A, B } of pairs) {
      if (used.has(A) || used.has(B)) continue; used.add(A); used.add(B);
      const id = A.o.link && A.o.link === B.o.link ? A.o.link : App.uid(); A.o.link = B.o.link = id; A.o.to = B.r.id; B.o.to = A.r.id;
      const pa = A.o.sw !== 0, pb = B.o.sw !== 0; if (pa && pb) B.o.sw = 0; else if (!pa && !pb) A.o.sw = 1;
      const P = A.o.sw !== 0 ? A : B, Q = P === A ? B : A; Q.o.type = P.o.type;
    }
    for (const it of items) if (!used.has(it)) { delete it.o.link; if (it.o.sw === 0) it.o.sw = 1; }
  };
  O.relinkAll = (p) => p.floors.forEach((f) => O.relink(p, f.id));

  O.syncTwin = (room, o) => {
    const t = O.twin(room, o); if (!t) return; const g = O.geo(room, o), W = O.wall(t.room, t.o.wall);
    const u0 = G.dot(G.sub(g.p0, W.a), W.d), u1 = G.dot(G.sub(g.p1, W.a), W.d); const lo = Math.max(0, Math.min(u0, u1)), hi = Math.min(W.el, Math.max(u0, u1));
    if (hi - lo > 50) { t.o.pos = lo; t.o.width = hi - lo; }
    t.o.type = o.type; t.o.h = o.h; t.o.sill = o.sill;
  };
  /* ---------- pas de chevauchement : place libre sur un mur, des deux côtés de la cloison ---------- */
  O.obstacles = (room, wi, skip = []) => {
    const W = O.wall(room, wi); const out = [];
    for (const r of App.shapesOn(room.floor)) {
      if (r.kind !== 'piece') continue;
      for (const q of r.openings || []) {
        if (skip.includes(q)) continue; const g = O.geo(r, q); if (!g) continue; const dd = G.dot(g.d, W.d);
        const off = G.dot(G.sub(g.p0, W.a), W.nin);
        if (dd > 0.995 ? !(r === room && Math.abs(off) < 8) : !(dd < -0.995 && off < 8 && off > -520)) continue;
        const t0 = G.dot(G.sub(g.p0, W.a), W.d), t1 = G.dot(G.sub(g.p1, W.a), W.d);
        out.push({ lo: Math.min(t0, t1), hi: Math.max(t0, t1), o: q, room: r });
      }
    }
    return out;
  };
  O.limits = (room, wi, t, skip = []) => {
    const W = O.wall(room, wi); let lo = 0, hi = W.el, inside = null;
    for (const b of O.obstacles(room, wi, skip)) {
      if (b.hi <= 0 || b.lo >= W.el) continue;
      if (t > b.lo + 1 && t < b.hi - 1) inside = b;
      if ((b.lo + b.hi) / 2 <= t) lo = Math.max(lo, b.hi); else hi = Math.min(hi, b.lo);
    }
    return { lo, hi, inside };
  };
  const skipOf = (room, o) => { const t = O.twin(room, o); return t ? [o, t.o] : [o]; };
  /* opt.end = 0 | 1 : seule cette extrémité bouge ; opt.jump : la cible peut passer de l'autre côté d'une ouverture */
  O.setSpan = (room, o, pos, width, opt = {}) => {
    const W = O.wall(room, o.wall), MIN = 300;
    const L = O.limits(room, o.wall, opt.jump ? pos + width / 2 : o.pos + o.width / 2, skipOf(room, o));
    const want = [pos, width];
    if (opt.end === 0) { const end = Math.min(o.pos + o.width, L.hi); pos = Math.max(L.lo, Math.min(pos, end - MIN)); width = end - pos; }
    else if (opt.end === 1) { pos = Math.max(L.lo, o.pos); width = Math.max(Math.min(MIN, L.hi - pos), Math.min(width, L.hi - pos)); }
    else { const room2 = L.hi - L.lo; width = Math.max(Math.min(MIN, room2), Math.min(width, room2, W.el)); pos = Math.max(L.lo, Math.min(pos, L.hi - width)); }
    o.pos = pos; o.width = width; O.syncTwin(room, o);
    return Math.abs(want[0] - pos) > 2 || Math.abs(want[1] - width) > 2;
  };

  /* ouvertures superposées dans une même pièce (import, anciennes versions) : doublon retiré, chevauchement partagé au milieu */
  O.overlaps = (room) => {
    const res = []; const ops = room.openings || [];
    for (let i = 0; i < ops.length; i++) for (let j = i + 1; j < ops.length; j++) {
      const a = ops[i], b = ops[j]; if (a.wall !== b.wall) continue;
      const ov = Math.min(a.pos + a.width, b.pos + b.width) - Math.max(a.pos, b.pos); if (ov > 1) res.push({ a, b, ov, dup: ov > 0.5 * Math.min(a.width, b.width) });
    }
    return res;
  };
  O.tidy = (room) => {
    let changed = false;
    for (let guard = 0; guard < 50; guard++) {
      const ov = O.overlaps(room); if (!ov.length) break; const x = ov[0];
      if (x.dup) { const score = (q) => (q.sw !== 0 ? 2 : 0) + (q.link ? 1 : 0); const drop = score(x.b) > score(x.a) ? x.a : x.b; room.openings = room.openings.filter((q) => q !== drop); }
      else { const [l, r] = x.a.pos <= x.b.pos ? [x.a, x.b] : [x.b, x.a]; const cut = (Math.max(l.pos, r.pos) + Math.min(l.pos + l.width, r.pos + r.width)) / 2; l.width = Math.max(100, cut - l.pos); const end = r.pos + r.width; r.pos = cut; r.width = Math.max(100, end - cut); }
      changed = true;
    }
    return changed;
  };

  /* ---------- sens d'ouverture ---------- */
  O.opensInto = (room, o) => { const pr = O.primary(room, o); if (!pr.o.out) return pr.room; const t = O.twin(pr.room, pr.o); return t ? t.room : null; };
  O.flipSwing = (room, o) => {
    const pr = O.primary(room, o); const t = O.twin(pr.room, pr.o);
    if (t && O.DOORS.includes(pr.o.type)) {
      const H = O.hingePt(pr.room, pr.o); const tg = O.geo(t.room, t.o); const u = G.dot(G.sub(H, tg.a), tg.d);
      t.o.hinge = u < tg.pos + tg.w / 2 ? 'g' : 'd'; t.o.out = false; t.o.sw = 1; t.o.type = pr.o.type; pr.o.sw = 0; pr.o.out = false;
      return t;
    }
    pr.o.out = !pr.o.out; return pr;
  };
  O.flipHinge = (room, o) => { const pr = O.primary(room, o); pr.o.hinge = pr.o.hinge === 'd' ? 'g' : 'd'; return pr; };
  /* poussant droit : en poussant la porte, les paumelles sont à droite */
  O.handing = (room, o) => {
    const pr = O.primary(room, o); const g = O.geo(pr.room, pr.o); const f = pr.o.out ? G.mul(g.nin, -1) : g.nin;
    const right = { x: f.y, y: -f.x }; return G.dot(G.sub(O.hingePt(pr.room, pr.o), g.mid), right) > 0 ? 'droit' : 'gauche';
  };
  O.describe = (room, o) => {
    const pr = O.primary(room, o); const into = O.opensInto(pr.room, pr.o);
    if (pr.o.type === 'porte') return `ouvre dans ${into ? into.name || 'la pièce' : 'l\'autre pièce'} · poussant ${O.handing(pr.room, pr.o)}`;
    if (pr.o.type === 'porte2') return `ouvre dans ${into ? into.name || 'la pièce' : 'l\'autre pièce'}`;
    return O.name(pr.o.type).toLowerCase();
  };

  O.remove = (room, o) => { const t = O.twin(room, o); room.openings = room.openings.filter((x) => x !== o); if (t) t.room.openings = t.room.openings.filter((x) => x !== t.o); };

  /* ---------- ajout en touchant un mur ---------- */
  O.addAt = (w, type) => {
    let best = null; const R = 30 / S.view.z;
    for (const r of App.shapesOn().filter((x) => x.kind === 'piece')) for (let i = 0; i < r.pts.length; i++) {
      const W = O.wall(r, i); if (W.el < 350) continue; const pr = G.projSeg(w, W.a, W.b); const d = G.dist(pr.p, w);
      if (d < R && (!best || d < best.d)) best = { d, r, i, t: pr.tc * W.el, W };
    }
    if (!best) return { err: 'Touchez un mur de pièce' };
    if (best.r.locked) return { err: 'Pièce verrouillée' };
    const def = PL.lib.openings.find((x) => x.id === type) || { w: 830 };
    const L = O.limits(best.r, best.i, best.t);
    if (L.inside) { const pr = O.primary(L.inside.room, L.inside.o); return { exist: pr, err: 'Il y a déjà une ouverture ici' }; }
    const width = Math.min(def.w, best.W.el - 60, L.hi - L.lo); if (width < 300) return { err: L.hi - L.lo < best.W.el ? 'Pas assez de place entre les ouvertures voisines' : 'Mur trop court pour cette ouverture' };
    const pos = Math.max(L.lo, Math.min(L.hi - width, best.t - width / 2));
    const o = { oid: App.uid(), type, wall: best.i, pos, width, h: def.h, sill: def.sill, sw: 1, hinge: 'g', out: false };
    App.mutate(() => {
      best.r.openings = best.r.openings || []; best.r.openings.push(o);
      if (O.INTERIOR.includes(type)) {
        const g = O.geo(best.r, o); let tw = null;
        for (const r2 of App.shapesOn().filter((x) => x.kind === 'piece' && x !== best.r)) for (let j = 0; j < r2.pts.length; j++) {
          const W2 = O.wall(r2, j); if (G.dot(W2.d, g.d) > -0.995) continue; const off = G.dot(G.sub(W2.a, g.p0), g.nin); if (off > 8 || off < -520) continue;
          const u0 = G.dot(G.sub(g.p0, W2.a), W2.d), u1 = G.dot(G.sub(g.p1, W2.a), W2.d); const lo = Math.max(0, Math.min(u0, u1)), hi = Math.min(W2.el, Math.max(u0, u1));
          if (hi - lo < 0.5 * g.w) continue; if (!tw || -off < tw.off) tw = { off: -off, r2, j, lo, hi };
        }
        if (tw) { const link = App.uid(); o.link = link; o.to = tw.r2.id; tw.r2.openings = tw.r2.openings || []; tw.r2.openings.push({ oid: App.uid(), type, wall: tw.j, pos: tw.lo, width: tw.hi - tw.lo, h: def.h, sill: def.sill, sw: 0, hinge: 'g', out: false, link, to: best.r.id }); }
      }
    });
    return { room: best.r, o };
  };

  /* ---------- mise à jour depuis une nouvelle version du plan intégré ---------- */
  O.applySeed = (p, seed) => {
    for (const sf of seed.floors) {
      const f = p.floors.find((x) => x.name === sf.name); if (!f) continue;
      const seedRooms = seed.shapes.filter((s) => s.floor === sf.id && s.kind === 'piece');
      const same = (r) => seedRooms.filter((sr) => G.pointInPoly(G.centroid(sr.pts), r.pts) || G.pointInPoly(G.centroid(r.pts), sr.pts)); // la même pièce sur le plan intégré
      for (const r of p.shapes.filter((s) => s.floor === f.id && s.kind === 'piece')) r.openings = App.feat.reattach(r.pts, same(r).length ? same(r) : seedRooms, [], 300).map((o) => Object.assign({}, o, { oid: App.uid(), to: null }));
      for (const r of p.shapes.filter((s) => s.floor === f.id && s.kind === 'piece')) O.tidy(r);
      O.relink(p, f.id);
    }
    p.seedApplied = seed.seedVersion; delete p.seedOffer;
  };
  O.countDups = (p) => p.shapes.filter((r) => r.kind === 'piece').reduce((n, r) => n + O.overlaps(r).filter((x) => x.dup).length, 0);
})();
