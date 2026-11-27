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
    if (M && M.decks) return M.decks.map((q, k) => ({ k, z: q.z, name: q.name, arm: q.arm, top: !!q.top, th: q.th, r: q.r, poly: q.pts.map(([u, v]) => at(f, u, v)) }));
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
    for (const o of K.decks(p)) if (o.z > q.z + 1 && ovl(s.pts, o.poly)) limit = Math.min(limit, o.z - (o.th != null ? o.th : 30) - q.z);
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
    if (!pick || opts.fresh) { const cv = (x) => { const f = frame(x.p), qc = G.centroid(x.q.poly); return Math.round(Math.abs(G.dot(G.sub(c, qc), f ? f.V : { x: 0, y: 1 }))); }; pick = cands.slice().sort((a, b) => cv(a) - cv(b) || b.q.top - a.q.top || a.q.z - b.q.z)[0]; }
    s.on = pick.p.id; s.deck = pick.q.k; tune(pick.p, s); K.pin(s);
    return { support: pick.p, deck: pick.q };
  };
  K.pin = (s) => { const f = frame(K.support(s)); if (f) s.onAt = [f.o.x, f.o.y, f.U.x, f.U.y, f.V.x, f.V.y, f.w, f.d]; };

  /* mettre la machine sur un étage précis (inspecteur) : glissée sur cet étage si elle n'y est pas */
  K.setDeck = (s, p, k) => {
    const q = K.decks(p)[k]; if (!q) return;
    const c = G.centroid(s.pts), qc = G.centroid(q.poly); let d = { x: 0, y: 0 };
    if (!G.pointInPoly(c, q.poly)) { const f = frame(p); const off = G.sub(qc, c); d = f && p.id === s.on && q.r == null ? G.mul(f.V, G.dot(off, f.V)) : off; }
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
  /* Kallax couché ou debout : la largeur change autour du centre, le dos reste en place ; les machines gardent le dessus ou leur rangée */
  K.orient = (s, o) => {
    const it = lib(s), f = frame(s); if (!it || it.m !== 'kallax' || !f) return;
    const kids = K.children(s).map((x) => [x, K.deck(x)]);
    s.orient = o; const dw = (PL.kallaxSize(PL.kallaxGrid(it, s)[0]) - f.w) / 2, P = s.pts;
    s.pts = [G.add(P[0], G.mul(f.U, -dw)), G.add(P[1], G.mul(f.U, dw)), G.add(P[2], G.mul(f.U, dw)), G.add(P[3], G.mul(f.U, -dw))];
    K.sync();
    const D = K.decks(s);
    for (const [x, q0] of kids) {
      const c = G.centroid(x.pts), hit = D.filter((q) => !q.top && G.pointInPoly(c, q.poly));
      const q = !q0 || q0.top ? D[0] : hit.find((q) => q.r === q0.r) || hit.sort((a, b) => a.z - b.z)[0] || D[0];
      if (!q.top) { const f2 = frame(s), du = G.dot(G.sub(G.centroid(q.poly), c), f2.U); x.pts = x.pts.map((p) => G.add(p, G.mul(f2.U, du))); } // recentrée dans sa case
      x.deck = q.k; K.pin(x);
    }
  };
  /* miroir debout ou couché : la largeur au sol devient la hauteur, autour du centre, le dos reste au mur */
  K.hang = (s, o) => { // debout ↔ couché : largeur et hauteur s'échangent, autour du centre, le dos reste au mur
    const it = lib(s), f = frame(s); if (!it || it.m !== 'mir' || !f) return; const H = PL.mirrorH(it, s); if ((o === 'v') === (H >= f.w - 1)) return;
    s.hang = o; s.mh = Math.round(f.w) / 10; const dw = (H - f.w) / 2, P = s.pts; s.pts = [G.add(P[0], G.mul(f.U, -dw)), G.add(P[1], G.mul(f.U, dw)), G.add(P[2], G.mul(f.U, dw)), G.add(P[3], G.mul(f.U, -dw))];
  };
  K.under = (s) => !!(lib(s) || {}).under; // tapis : dessous des autres meubles, au dessin comme au clic
  K.resizeTo = (s, W, D) => { const f = frame(s); if (!f) return; const c = G.centroid(s.pts), at2 = (a, b) => G.add(G.add(c, G.mul(f.U, a)), G.mul(f.V, b)); s.pts = [at2(-W / 2, -D / 2), at2(W / 2, -D / 2), at2(W / 2, D / 2), at2(-W / 2, D / 2)]; };
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
    { const it = lib(s); if (it && it.m === 'kallax') { const g = PL.kallaxGrid(it, s), o = (s.orient || it.orient || 'v'), sq = it.grid[0] === it.grid[1], W = PL.kallaxSize(g[0]), H = PL.kallaxSize(g[1]);
      h += `<h3>Kallax ${g[0]} × ${g[1]}</h3>${sq ? '' : `<div class="chips">${[['h', 'Couché', PL.kallaxSize(Math.max(...it.grid)), PL.kallaxSize(Math.min(...it.grid))], ['v', 'Debout', PL.kallaxSize(Math.min(...it.grid)), PL.kallaxSize(Math.max(...it.grid))]].map(([v, l, a, b]) => `<button data-a="kxo" data-v="${v}" aria-pressed="${o === v}">${l} · ${fmt(a)} × ${fmt(b)}</button>`).join('')}</div>`}<p>${fmt(W)} cm de large × ${fmt(H)} cm de haut · dessus à <b>${fmt(H)} cm</b> · ${g[0] * g[1]} cases de 33,5 × 33,5 cm.</p><p class="hint2">Glissez une machine sur le Kallax : elle se pose sur le dessus. Pour la ranger dans une case, choisissez la case dans la fiche de la machine.</p>`; } }
    { const it = lib(s);
      if (it && it.m === 'desk' && it.dk.Hs) { const z = PL.deskHeight(it, s); h += `<h3>Hauteur du plateau</h3><div class="chips">${it.dk.Hs.map((v) => `<button data-a="dhq" data-v="${v}" aria-pressed="${z === v}">${v} cm</button>`).join('')}</div><p class="hint2">Réglable avec les boutons des pieds ; les objets posés dessus suivent.</p>`; }
      if (it && it.m === 'walkin' && !(it.wi && it.wi.glass)) h += `<p class="hint2">Receveur seul, à fleur du carrelage, bonde centrée. La taille se règle dans Dimensions ; ajoutez une « Vitre de douche fixe » à part et posez-la où vous voulez.</p>`;
      if (it && it.m === 'vitre') { const f = frame(s), W = f ? f.w : it.w * 10, side = PL.walkinSide(s), bar = PL.glassBar(s);
        h += `<h3>Vitre de douche</h3><div class="chips sm">${[60, 70, 80, 90, 100, 120, 140].map((v) => `<button data-a="vitlen" data-v="${v}" aria-pressed="${Math.abs(W - v * 10) < 5}">${v}</button>`).join('')}</div><div class="chips">${[['g', 'Profilé mural à gauche'], ['d', 'Profilé mural à droite']].map(([v, l]) => `<button data-a="vside" data-v="${v}" aria-pressed="${side === v}">${l}</button>`).join('')}</div><div class="chips sm">${[[0, 'Sans barre'], [60, 'Barre 60'], [90, 'Barre 90'], [120, 'Barre 120']].map(([v, l]) => `<button data-a="vbar" data-v="${v}" aria-pressed="${Math.abs(bar - v * 10) < 5}">${l}</button>`).join('')}</div><p class="hint2">Vitre de ${fmt(W)} cm, 2 m de haut. La longueur se règle aussi dans Dimensions ; le bout du profilé ne bouge pas. La barre part vers l'arrière (pointillés sur le plan) : « Pivoter » deux fois la fait passer de l'autre côté.</p>`; }
      if (it && it.m === 'walkin' && it.wi && it.wi.glass) { const f = frame(s), W = f ? f.w : it.w * 10, L = PL.walkinGlass(it, s, W), side = PL.walkinSide(s);
        h += `<h3>Vitre de douche</h3><div class="chips">${[['g', 'Vitre à gauche'], ['d', 'Vitre à droite']].map(([v, l]) => `<button data-a="vside" data-v="${v}" aria-pressed="${side === v}">${l}</button>`).join('')}</div><div class="field"><label>Longueur de la vitre</label><div class="unit"><input data-c="vl" inputmode="decimal" value="${fmt(L)}"><span>cm</span></div></div><div class="chips sm">${[60, 70, 80, 90, 100].filter((v) => v * 10 <= W).map((v) => `<button data-a="vlq" data-v="${v}" aria-pressed="${Math.abs(L - v * 10) < 5}">${v}</button>`).join('')}</div><p class="hint2">Accès de ${fmt(W - L)} cm de l'autre côté · vitre fixe de 2 m de haut · receveur encastré à fleur du carrelage, bonde centrée. « Dos au mur » met la vitre côté pièce.</p>`; }
      if (it && it.m === 'mir') { const f = frame(s), Wm = f ? f.w : it.w * 10, Hm = PL.mirrorH(it, s), z0 = PL.mirrorZ(it, s), round = it.mi.shape === 'round', sq = round || Math.abs(Hm - Wm) < 5, o = Hm >= Wm - 1 ? 'v' : 'h', lo = Math.min(Wm, Hm), hi = Math.max(Wm, Hm);
        h += `<h3>Pose du miroir</h3>${sq ? '' : `<div class="chips">${[['v', 'Debout', lo, hi], ['h', 'Couché', hi, lo]].map(([v, l, a, b]) => `<button data-a="hangq" data-v="${v}" aria-pressed="${o === v}">${l} · ${fmt(a)} × ${fmt(b)}</button>`).join('')}</div>`}${round ? `<p class="hint2">Rond Ø ${fmt(Wm)} cm : changez le diamètre avec la largeur, dans Dimensions.</p>` : `<div class="field"><label>Hauteur du miroir</label><div class="unit"><input data-c="mh" inputmode="decimal" value="${fmt(Hm)}"><span>cm</span></div></div><p class="hint2">La largeur se règle dans Dimensions.</p>`}<div class="field"><label>Bas du miroir à</label><div class="unit"><input data-c="mz" inputmode="decimal" value="${fmt(z0)}"><span>cm</span></div></div><div class="chips sm">${[[3, 'au sol'], [30, '30'], [90, '90'], [110, '110'], [Math.round(155 - Hm / 20), 'centré 155']].map(([v, l]) => `<button data-a="mzq" data-v="${v}" aria-pressed="${Math.abs(z0 - v * 10) < 5}">${l}</button>`).join('')}</div><p class="hint2">Haut du miroir à ${fmt(z0 + Hm)} cm. « Dos au mur » le plaque contre le mur le plus proche.</p>`; } }
    if (s.lib === 'please') { const z = PL.chairSeat(s); h += `<h3>Réglages</h3><div class="field"><label>Hauteur d'assise</label><div class="unit"><input data-c="seat" inputmode="decimal" value="${z}"><span>cm</span></div></div><div class="chips sm">${[42, 44, 46, 48, 50, 52].map((v) => `<button data-a="seatq" data-v="${v}" aria-pressed="${z === v}">${v}</button>`).join('')}</div><div class="chips">${[[0, 'Sans têtière'], [1, 'Avec têtière']].map(([v, l]) => `<button data-a="headq" data-v="${v}" aria-pressed="${!!s.head === !!v}">${l}</button>`).join('')}</div><p class="hint2">66 × 64 cm, ${fmt(z * 10 + 650 + (s.head ? 120 : 0))} cm de haut. Tournez-le face au bureau avec Pivoter.</p>`; }
    if (s.lib === 'persan') { const f = frame(s); if (f) { const L = Math.max(f.w, f.d), Sx = Math.min(f.w, f.d); h += `<h3>Taille du tapis</h3><div class="chips sm">${[[60, 90], [80, 150], [120, 180], [140, 200], [160, 230], [170, 240], [200, 300], [250, 350], [300, 400], [80, 300]].map(([a, b]) => `<button data-a="rugsz" data-v="${a}x${b}" aria-pressed="${Math.abs(Sx - a * 10) < 5 && Math.abs(L - b * 10) < 5}">${a} × ${b}${b / a > 3 ? ' galerie' : ''}</button>`).join('')}</div><p class="hint2">Ou toute autre taille dans Largeur et Profondeur ci-dessus. Les autres meubles se posent dessus.</p>`; } }
    if (s.lib === 'pied') { const e = PL.earHeight(s), kid = K.children(s)[0]; h += `<h3>Hauteur d'oreille</h3><div class="field"><label>Oreille de l'auditeur à</label><div class="unit"><input data-c="ear" inputmode="decimal" value="${e}"><span>cm</span></div></div><div class="chips sm">${[[110, 'assis 110'], [115, '115'], [120, 'assis 120'], [125, '125'], [160, 'debout 160']].map(([v, l]) => `<button data-a="earq" data-v="${v}" aria-pressed="${e === v}">${l}</button>`).join('')}</div><p>Plateau du pied à <b>${fmt(PL.standTop(s))} cm</b>${kid ? ` : tweeter de ${esc((kid.name || '').replace(/ \(.*\)$/, ''))} à ${fmt(PL.standTop(s) + K.tweeter(kid))} cm` : ''}.</p><p class="hint2">Le plateau se règle pour mettre le tweeter de l'enceinte posée dessus à hauteur d'oreille. Pivotez le pied (avec l'enceinte) pour l'orienter vers la place d'écoute.</p>`; }
    if (s.lib === 'idasen') { const t = PL.deskTop(s); h += `<h3>Hauteur du plateau</h3><div class="field"><label>Plateau à</label><div class="unit"><input data-c="desktop" inputmode="decimal" value="${t}"><span>cm</span></div></div><div class="chips sm">${[63, 72, 75, 105, 110, 127].map((v) => `<button data-a="desktopq" data-v="${v}" aria-pressed="${t === v}">${v}</button>`).join('')}</div><p class="hint2">De 63 à 127 cm : assis vers 72 cm, debout vers 105 – 110 cm. Les machines posées montent avec le plateau dans la visite 3D.</p>`; }
    const kids = K.children(s); if (kids.length) h += `<h3>Machines posées</h3><div class="list">${kids.map((x) => { const q = K.deck(x); const F = K.fit(x); const bad = F && (F.over || F.tall); return `<button class="item" data-a="stsel" data-v="${x.id}"><span class="nm">${esc((x.name || '').replace(/ \(.*\)$/, ''))}</span><span class="meta">${q ? esc(q.name) : ''}${bad ? ' · <b style="color:var(--red)">à revoir</b>' : ''}</span></button>`; }).join('')}</div>`;
    return h;
  };
})();
