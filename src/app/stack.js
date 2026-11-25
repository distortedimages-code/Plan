/* Calepin — poser une machine sur un support (stand Jaspers, bureau, table) : étage, hauteur, dépassement et hauteur libre.
   La machine garde on (id du support), deck (n° d'étage) et onAt (repère du support au moment de la pose) : quand le support
   bouge, pivote ou change de taille, ses machines suivent ; la hauteur se lit toujours sur le support. */
(function () {
  const PL = globalThis.PL, G = PL.geom, App = globalThis.App, S = App.state;
  const K = (App.stack = {});
  const lib = (s) => s && s.lib && PL.lib.furniture.find((x) => x.id === s.lib);
  const GENERIC = [[/^(table|bureau)/, 750], [/^basse$/, 400]];

  K.canPut = (s) => !!(s && s.kind === 'meuble' && (lib(s) || {}).put);
  const frame = (s) => {
    if (!s || !s.pts || s.pts.length !== 4) return null;
    const P = s.pts, w = G.dist(P[0], P[1]), d = G.dist(P[0], P[3]); if (w < 1 || d < 1) return null;
    return { o: P[0], U: G.mul(G.sub(P[1], P[0]), 1 / w), V: G.mul(G.sub(P[3], P[0]), 1 / d), w, d };
  };
  K.frame = frame;
  const at = (f, u, v) => G.add(G.add(f.o, G.mul(f.U, u)), G.mul(f.V, v));
  const loc = (f, p) => { const q = G.sub(p, f.o); return [G.dot(q, f.U), G.dot(q, f.V)]; };

  /* étages d'un support, en coordonnées du plan */
  K.decks = (s) => {
    if (!s || s.kind !== 'meuble' || K.canPut(s)) return [];
    const f = frame(s); if (!f) return [];
    const M = PL.furnModel && PL.furnModel(s.lib, f.w, f.d, s);
    if (M && M.decks) return M.decks.map((q, k) => ({ k, z: q.z, name: q.name, arm: q.arm, poly: q.pts.map(([u, v]) => at(f, u, v)) }));
    const g = GENERIC.find(([re]) => re.test(s.lib || '')); if (!g) return [];
    return [{ k: 0, z: g[1], name: 'plateau', poly: s.pts.slice() }];
  };
  K.isSupport = (s) => K.decks(s).length > 0;
  K.support = (s) => { if (!s || !s.on) return null; const p = App.byId(s.on); return p && p.kind === 'meuble' && p.floor === s.floor ? p : null; };
  K.deck = (s) => { const p = K.support(s); if (!p) return null; const D = K.decks(p); return D[Math.min(D.length - 1, Math.max(0, s.deck || 0))] || null; };
  K.zOf = (s) => { const q = K.deck(s); return q ? q.z : 0; };
  K.children = (p) => (p ? App.shapesOn(p.floor).filter((x) => x.on === p.id) : []);
  K.tweeter = (s) => { const it = lib(s); const sp = it && it.g && it.g.spk; return sp ? Math.round(Math.max(...sp.drv.map((q) => q[1])) * sp.h) : Math.round(K.height(s) / 2); };
  const tune = (p, s) => { if (p && p.lib === 'pied') p.tw = K.tweeter(s); };
  K.height = (s) => { const f = frame(s); const M = f && PL.furnModel && PL.furnModel(s.lib, f.w, f.d, s); return M ? M.h : 100; };

  /* la machine tient-elle sur son étage ? dépassement hors du plateau, hauteur libre sous l'étage du dessus */
  K.fit = (s) => {
    const p = K.support(s), q = p && K.deck(s); if (!q) return null;
    let over = 0; for (const c of s.pts) if (!G.pointInPoly(c, q.poly)) over = Math.max(over, G.distPointPoly(c, q.poly));
    const h = K.height(s); let limit = Infinity;
    const ovl = (A, B) => A.some((c) => G.pointInPoly(c, B)) || B.some((c) => G.pointInPoly(c, A)) || G.pointInPoly(G.centroid(A), B);
    for (const o of K.decks(p)) if (o.z > q.z + 1 && ovl(s.pts, o.poly)) limit = Math.min(limit, o.z - 30 - q.z);
    return { support: p, deck: q, over: over > 10 ? over : 0, h, limit, tall: Number.isFinite(limit) && h > limit + 2 ? h - limit : 0 };
  };

  /* après un déplacement : posée sur l'étage qui la reçoit, ou au sol */
  K.place = (s, opts = {}) => {
    if (!K.canPut(s)) return null;
    if (!s.on && (s.floorLock || (lib(s) || {}).low)) return null; // caisson de basse, ou machine posée au sol exprès : reste au sol
    const c = G.centroid(s.pts); const cands = [];
    for (const p of App.shapesOn(s.floor)) { if (p === s || p.kind !== 'meuble' || K.canPut(p)) continue; for (const q of K.decks(p)) if (G.pointInPoly(c, q.poly)) cands.push({ p, q }); }
    if (!cands.length) { const was = !!s.on; delete s.on; delete s.deck; delete s.onAt; return was ? { floor: true } : null; }
    let pick = cands.find((x) => x.p.id === s.on && x.q.k === (s.deck || 0));
    if (!pick || opts.fresh) { const cv = (x) => { const f = frame(x.p), qc = G.centroid(x.q.poly); return Math.abs(G.dot(G.sub(c, qc), f ? f.V : { x: 0, y: 1 })); }; pick = cands.slice().sort((a, b) => cv(a) - cv(b) || a.q.z - b.q.z)[0]; }
    s.on = pick.p.id; s.deck = pick.q.k; tune(pick.p, s); K.pin(s);
    return { support: pick.p, deck: pick.q };
  };
  K.pin = (s) => { const f = frame(K.support(s)); if (f) s.onAt = [f.o.x, f.o.y, f.U.x, f.U.y, f.V.x, f.V.y, f.w, f.d]; };

  /* mettre la machine sur un étage précis (inspecteur) : glissée sur cet étage si elle n'y est pas */
  K.setDeck = (s, p, k) => {
    const q = K.decks(p)[k]; if (!q) return;
    const c = G.centroid(s.pts), qc = G.centroid(q.poly); let d = { x: 0, y: 0 };
    if (!G.pointInPoly(c, q.poly)) { const f = frame(p); const off = G.sub(qc, c); d = f && p.id === s.on ? G.mul(f.V, G.dot(off, f.V)) : off; }
    s.pts = s.pts.map((pt) => G.add(pt, d));
    s.on = p.id; s.deck = k; delete s.floorLock; tune(p, s); K.pin(s);
  };
  K.onStand = (s) => {
    const f = frame(s); if (!f) return null; let c = G.centroid(s.pts); const W = 300, D = 300;
    const sq = (o) => [G.add(G.add(o, G.mul(f.U, -W / 2)), G.mul(f.V, -D / 2)), G.add(G.add(o, G.mul(f.U, W / 2)), G.mul(f.V, -D / 2)), G.add(G.add(o, G.mul(f.U, W / 2)), G.mul(f.V, D / 2)), G.add(G.add(o, G.mul(f.U, -W / 2)), G.mul(f.V, D / 2))];
    // posée sur un bureau ou une table : le pied va juste derrière, s'il reste dans une pièce
    const cur = K.support(s);
    if (cur) {
      const hit = (Q) => Q.some((x) => G.pointInPoly(x, cur.pts)) || cur.pts.some((x) => G.pointInPoly(x, Q));
      for (let t = 0; t <= 1500; t += 10) {
        const o = G.add(c, G.mul(f.V, t)); const Q = sq(o); if (hit(Q)) continue;
        const o2 = G.add(o, G.mul(f.V, 20)), Q2 = sq(o2); if (App.rooms(s.floor).some((r) => Q2.every((x) => G.pointInPoly(x, r.pts)))) { const dv = G.mul(f.V, t + 20); s.pts = s.pts.map((x) => G.add(x, dv)); c = o2; }
        break;
      }
    }
    const pts = sq(c);
    const it = PL.lib.furniture.find((x) => x.id === 'pied'); const p = App.makeShape('meuble', pts, { name: it.name, lib: 'pied', floor: s.floor });
    const prev = K.support(s); if (prev && prev.lib === 'pied' && prev.ear) p.ear = prev.ear;
    S.p.shapes.push(p); K.setDeck(s, p, 0); return p;
  };
  K.toFloor = (s) => { delete s.on; delete s.deck; delete s.onAt; };

  /* le support a bougé (glissé, pivoté, miroir, redimensionné) : ses machines suivent */
  K.sync = () => {
    if (!S.p || !S.p.shapes) return;
    for (const s of S.p.shapes) {
      if (!s.on) continue; const p = App.byId(s.on);
      if (!p || p.kind !== 'meuble' || p.floor !== s.floor) { K.toFloor(s); continue; }
      const f = frame(p); if (!f) continue; const a = s.onAt;
      if (!a) { K.pin(s); continue; }
      const f0 = { o: { x: a[0], y: a[1] }, U: { x: a[2], y: a[3] }, V: { x: a[4], y: a[5] }, w: a[6], d: a[7] };
      if (G.dist(f0.o, f.o) < 0.01 && G.dist(f0.U, f.U) < 1e-6 && G.dist(f0.V, f.V) < 1e-6 && Math.abs(f0.w - f.w) < 0.01 && Math.abs(f0.d - f.d) < 0.01) continue;
      const c = G.centroid(s.pts), [cu, cv] = loc(f0, c);
      const nc = at(f, (cu / f0.w) * f.w, (cv / f0.d) * f.d);
      s.pts = s.pts.map((pt) => { const [ou, ov] = loc(f0, pt); return G.add(nc, G.add(G.mul(f.U, ou - cu), G.mul(f.V, ov - cv))); });
      K.pin(s);
    }
  };

  /* panneau de l'inspecteur */
  const fmt = (v) => (Math.round(v) / 10).toLocaleString('fr-FR');
  const esc = (t) => String(t).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  K.fitText = (s) => {
    const F = K.fit(s); if (!F) return '';
    const bad = []; if (F.over) bad.push(`dépasse de ${fmt(F.over)} cm du plateau`); if (F.tall) bad.push(`trop haute de ${fmt(F.tall)} cm sous l'étage du dessus`);
    return bad.length ? `<b style="color:var(--red)">Attention : ${bad.join(', ')}.</b>` : `Tient sur l'étage${Number.isFinite(F.limit) ? ` (${fmt(F.limit - F.h)} cm libres au-dessus)` : ''}.`;
  };
  K.inspHTML = (s) => {
    let h = '';
    if (K.canPut(s)) {
      const p = K.support(s), q = p && K.deck(s); const sups = App.shapesOn(s.floor).filter((x) => x !== s && K.isSupport(x));
      h += `<h3>Posée</h3><p>${q ? `Sur <b>${esc((p.name || 'support').replace(/ \(.*\)$/, ''))}</b>, ${esc(q.name)} à <b>${fmt(q.z)} cm</b> du sol · machine haute de ${fmt(K.height(s))} cm. ${K.fitText(s)}` : `Au sol (haute de ${fmt(K.height(s))} cm).`}</p>`;
      if (p) { const D = K.decks(p); if (D.length > 1) h += `<div class="chips">${D.map((o) => `<button data-a="stdeck" data-v="${o.k}" aria-pressed="${o.k === q.k}">${esc(o.name)} · ${fmt(o.z)}</button>`).join('')}</div>`; }
      if (p && p.lib === 'pied') h += `<div class="row"><button class="btn sm" data-a="stsel" data-v="${p.id}">Régler le pied (oreille à ${PL.earHeight(p)} cm)</button></div>`;
      if ((lib(s) || {}).g && lib(s).g.spk && !lib(s).low && !(p && p.lib === 'pied')) h += `<div class="row"><button class="btn sm primary" data-a="stpied">Mettre sur un pied (tweeter à hauteur d'oreille)</button></div>`;
      h += `<div class="row" style="flex-wrap:wrap">${sups.filter((x) => !p || x.id !== p.id).map((x) => `<button class="btn sm" data-a="ston" data-v="${x.id}">Poser sur ${esc((x.name || 'support').replace(/ \(.*\)$/, ''))}</button>`).join('')}${p ? '<button class="btn sm ghost" data-a="stfloor">Poser au sol</button>' : ''}</div><p class="hint2">Glissez la machine sur le stand ou le bureau : elle se pose sur l'étage le plus proche et suit le support quand il bouge.</p>`;
      return h;
    }
    if (s.lib === 'jaspers') { const T = PL.jaspersTiers(s); h += `<h3>Étages (hauteur du plateau)</h3>${T.map((v, i) => `<div class="field"><label>Étage ${i + 1}${i === 0 ? ' (bras 60 cm)' : ' (bras 40 cm)'}</label><div class="unit"><input data-c="tier" data-i="${i}" inputmode="decimal" value="${v}"><span>cm</span></div></div>`).join('')}<p class="hint2">Réglables et inclinables sur le vrai stand ; 22 cm entre deux étages laissent environ 19 cm libres sous les bras du dessus.</p>`; }
    if (s.lib === 'pied') { const e = PL.earHeight(s), kid = K.children(s)[0]; h += `<h3>Hauteur d'oreille</h3><div class="field"><label>Oreille de l'auditeur à</label><div class="unit"><input data-c="ear" inputmode="decimal" value="${e}"><span>cm</span></div></div><div class="chips sm">${[[110, 'assis 110'], [115, '115'], [120, 'assis 120'], [125, '125'], [160, 'debout 160']].map(([v, l]) => `<button data-a="earq" data-v="${v}" aria-pressed="${e === v}">${l}</button>`).join('')}</div><p>Plateau du pied à <b>${fmt(PL.standTop(s))} cm</b>${kid ? ` : tweeter de ${esc((kid.name || '').replace(/ \(.*\)$/, ''))} à ${fmt(PL.standTop(s) + K.tweeter(kid))} cm` : ''}.</p><p class="hint2">Le plateau se règle pour mettre le tweeter de l'enceinte posée dessus à hauteur d'oreille. Pivotez le pied (avec l'enceinte) pour l'orienter vers la place d'écoute.</p>`; }
    if (s.lib === 'idasen') { const t = PL.deskTop(s); h += `<h3>Hauteur du plateau</h3><div class="field"><label>Plateau à</label><div class="unit"><input data-c="desktop" inputmode="decimal" value="${t}"><span>cm</span></div></div><div class="chips sm">${[63, 72, 75, 105, 110, 127].map((v) => `<button data-a="desktopq" data-v="${v}" aria-pressed="${t === v}">${v}</button>`).join('')}</div><p class="hint2">De 63 à 127 cm : assis vers 72 cm, debout vers 105 – 110 cm. Les machines posées montent avec le plateau dans la visite 3D.</p>`; }
    const kids = K.children(s); if (kids.length) h += `<h3>Machines posées</h3><div class="list">${kids.map((x) => { const q = K.deck(x); const F = K.fit(x); const bad = F && (F.over || F.tall); return `<button class="item" data-a="stsel" data-v="${x.id}"><span class="nm">${esc((x.name || '').replace(/ \(.*\)$/, ''))}</span><span class="meta">${q ? esc(q.name) : ''}${bad ? ' · <b style="color:var(--red)">à revoir</b>' : ''}</span></button>`; }).join('')}</div>`;
    return h;
  };
})();
