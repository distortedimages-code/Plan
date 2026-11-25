/* Calepin — meubles : aimantation sur les murs et les autres meubles, guides de centrage, distances aux murs. */
(function () {
  const PL = globalThis.PL, G = PL.geom, App = globalThis.App, S = App.state;
  const Gd = (App.guides = {});
  const SOFT = ['plafond', 'exclusion'];

  /* côtés d'un polygone ; n = normale du côté où doit se trouver l'objet qu'on approche */
  function sides(pts, outward) {
    const sg = G.area(pts) >= 0 ? 1 : -1; const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], el = G.dist(a, b); if (el < 30) continue;
      const d = G.mul(G.sub(b, a), 1 / el), nin = G.mul(G.perp(d), sg);
      out.push({ a, b, d, el, i, n: outward ? G.mul(nin, -1) : nin });
    }
    return out;
  }
  function targets(s, Q) {
    const fid = s.floor || S.p.floorId; const c = G.centroid(Q); const rooms = App.rooms(fid);
    const home = rooms.find((r) => G.pointInPoly(c, r.pts));
    const T = [];
    for (const r of home ? [home] : rooms) for (const e of sides(r.pts, false)) T.push(Object.assign(e, { kind: 'mur', room: r }));
    for (const o of App.shapesOn(fid)) {
      if (o === s || o.kind === 'piece' || !o.pts || SOFT.includes(o.kind)) continue;
      if (App.stack && (o.on === s.id || (o.on && o.on !== s.on) || (App.stack.canPut(s) && App.stack.isSupport(o)))) continue;
      if (home && !G.pointInPoly(G.centroid(o.pts), home.pts)) continue;
      for (const e of sides(o.pts, true)) T.push(Object.assign(e, { kind: 'meuble', shape: o }));
    }
    return { T, home };
  }
  /* distance de l'objet au côté (mesurée du côté autorisé) et étendue le long du côté */
  function supp(Q, e) {
    let m = Infinity, M = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (const q of Q) { const v = G.sub(q, e.a); const h = G.dot(v, e.n); m = Math.min(m, h); M = Math.max(M, h); const t = G.dot(v, e.d); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
    return { m, M, t0, t1 };
  }
  function ray(p, dir, T) {
    let best = null;
    for (const e of T) {
      const den = G.cross(dir, e.d); if (Math.abs(den) < 1e-9) continue; const w = G.sub(e.a, p);
      const t = G.cross(w, e.d) / den, u = G.cross(w, dir) / den;
      if (u < -1 || u > e.el + 1 || t < -2) continue; if (G.dot(dir, e.n) > 0) continue; // on ne voit que la face tournée vers soi
      if (!best || t < best.t) best = { t, e };
    }
    return best;
  }
  const wallLabel = (e) => {
    if (e.kind !== 'mur') return 'centré sur ' + (e.shape.name ? e.shape.name.replace(/ \(type .*\)/, '').toLowerCase() : 'le meuble');
    const part = App.walls && App.walls.partners(e.room, e.i).length; return `centré sur ${part ? 'la cloison' : 'le mur'} ${App.walls ? App.walls.name(e.room, e.i) : ''}`.trim();
  };

  /* orig : points de départ, d : déplacement voulu. snap=false : analyse seule (objet sélectionné). */
  Gd.solve = (s, orig, d, snap = true) => {
    const z = S.view.z, R = snap ? 16 / z : 3, Rc = 10 / z;
    let Q = orig.map((q) => G.add(q, d));
    const { T } = targets(s, Q);
    const shift = (v) => { d = G.add(d, v); Q = Q.map((q) => G.add(q, v)); };
    const res = { contacts: [], guides: [], dims: [] };
    const pick = (excl) => {
      let best = null;
      for (const e of T) {
        if (excl && Math.abs(G.dot(e.n, excl.n)) > 0.2) continue;
        const sp = supp(Q, e); const ov = Math.min(sp.t1, e.el) - Math.max(sp.t0, 0); if (ov <= 10) continue;
        if (sp.m > R || sp.m < -R) continue;
        if (!best || Math.abs(sp.m) < Math.abs(best.m)) best = { e, m: sp.m };
      }
      return best;
    };
    const c1 = pick(null);
    if (c1) { if (snap) shift(G.mul(c1.e.n, -c1.m)); res.contacts.push(c1.e); const c2 = pick(c1.e); if (c2) { if (snap) shift(G.mul(c2.e.n, -c2.m)); res.contacts.push(c2.e); } }
    // centrage sur le mur (ou le meuble) contre lequel on est posé
    let axisDone = res.contacts.length > 1;
    if (c1) {
      const e = c1.e, sp = supp(Q, e), tc = (sp.t0 + sp.t1) / 2;
      const cands = [{ t: e.el / 2, label: wallLabel(e) }];
      if (e.kind === 'mur') for (const o of e.room.openings || []) if (o.wall === e.i && !['passage'].includes(o.type)) cands.push({ t: o.pos + o.width / 2, label: 'centré sur ' + (/fen|baie|fixe|velux/.test(o.type) ? 'la fenêtre' : 'la porte') });
      let bc = null;
      for (const c of cands) { const dd = c.t - tc; if (Math.abs(dd) < (snap ? Rc : 2) && (!bc || Math.abs(dd) < Math.abs(bc.dd))) bc = Object.assign({ dd }, c); }
      if (bc && !axisDone) {
        if (snap) shift(G.mul(e.d, bc.dd));
        const p0 = G.add(e.a, G.mul(e.d, bc.t)); const depth = supp(Q, e).M;
        res.guides.push({ a: G.add(p0, G.mul(e.n, -80)), b: G.add(p0, G.mul(e.n, depth + 350)), label: bc.label, at: G.add(p0, G.mul(e.n, depth + 350)) });
        axisDone = true;
      }
    }
    // distances libres autour de l'objet (rayons depuis le milieu de chaque côté)
    const mine = sides(Q, true).filter((e) => e.el > 150);
    const hits = mine.map((e) => ({ e, h: ray(G.lerp(e.a, e.b, 0.5), e.n, T) }));
    // centré entre deux murs opposés
    if (!axisDone || res.contacts.length === 1) {
      for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
        const A = hits[i], B = hits[j]; if (!A.h || !B.h || G.dot(A.e.n, B.e.n) > -0.999) continue;
        if (c1 && Math.abs(G.dot(A.e.n, c1.e.n)) > 0.5) continue; // l'axe du mur de contact est déjà réglé
        if (axisDone && c1 && Math.abs(G.dot(A.e.n, c1.e.d)) > 0.5) continue;
        const diff = (A.h.t - B.h.t) / 2; if (A.h.t < 5 || B.h.t < 5 || A.h.t > 6000 || B.h.t > 6000) continue;
        if (Math.abs(diff) < (snap ? Rc : 2)) {
          if (snap) shift(G.mul(A.e.n, diff));
          const c = G.centroid(Q); const half = Math.max(...Q.map((q) => Math.abs(G.dot(G.sub(q, c), G.perp(A.e.n))))) + 300;
          res.guides.push({ a: G.add(c, G.mul(G.perp(A.e.n), -half)), b: G.add(c, G.mul(G.perp(A.e.n), half)), label: 'centré entre les murs', at: G.add(c, G.mul(G.perp(A.e.n), half)), axis: true });
        }
      }
    }
    for (const e of sides(Q, true)) { if (e.el <= 150) continue; const m0 = G.lerp(e.a, e.b, 0.5); const h = ray(m0, e.n, T); if (h && h.t > 8 && h.t < 6000) res.dims.push({ a: m0, b: G.add(m0, G.mul(e.n, h.t)), v: h.t }); }
    res.d = d; res.Q = Q;
    return res;
  };

  /* pivoter pour mettre le dos du meuble contre le mur le plus proche */
  Gd.backToWall = (s) => {
    if (!s.pts || s.pts.length < 4) return false;
    const { T } = targets(s, s.pts); const c = G.centroid(s.pts); let best = null;
    for (const e of T) { if (e.kind !== 'mur') continue; const pr = G.projSeg(c, e.a, e.b); const dd = G.dist(pr.p, c); if (!best || dd < best.dd) best = { e, dd }; }
    if (!best) return false;
    const back = sides(s.pts, true).find((x) => x.i === 2) || sides(s.pts, true)[0];
    const want = G.mul(best.e.n, -1); const ang = Math.atan2(want.y, want.x) - Math.atan2(back.n.y, back.n.x);
    let P = s.pts.map((p) => G.rotAround(p, c, ang));
    const sp = supp(P, best.e); P = P.map((p) => G.add(p, G.mul(best.e.n, -sp.m)));
    // reste dans la longueur du mur
    const sp2 = supp(P, best.e); let slide = 0; if (sp2.t0 < 0) slide = -sp2.t0; else if (sp2.t1 > best.e.el) slide = best.e.el - sp2.t1;
    if (sp2.t1 - sp2.t0 <= best.e.el) P = P.map((p) => G.add(p, G.mul(best.e.d, slide)));
    s.pts = P; return true;
  };
})();
