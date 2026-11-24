/* Calepin — interface contextuelle : menu porte, menu cloison, barre flottante, aperçu de déplacement. */
(function () {
  const PL = globalThis.PL, G = PL.geom, App = globalThis.App, S = App.state, esc = App.esc;
  const $ = (id) => document.getElementById(id);
  const X = (App.ctx = {});
  const fmt = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('fr-FR', { maximumFractionDigits: d });
  const num = (v) => { const x = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : null; };
  const L = (i) => String.fromCharCode(65 + (i % 26));
  const LOCK = '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>';

  /* ---------- configurations d'une porte, dans un repère stable ---------- */
  X.configs = (room, o) => {
    const pr = App.ops.primary(room, o); const tw = App.ops.twin(pr.room, pr.o);
    const base = tw && tw.o.oid < pr.o.oid ? tw : pr; const other = tw ? (base === pr ? tw : pr) : null;
    const g = App.ops.geo(base.room, base.o); const into = App.ops.opensInto(pr.room, pr.o);
    const H = App.ops.hingePt(pr.room, pr.o);
    return { pr, base, other, g, curInto: into === base.room ? 0 : 1, curH: G.dist(H, g.p0) <= G.dist(H, g.p1) ? 0 : 1, names: [base.room.name || 'Pièce', other ? other.room.name || 'Pièce' : 'Extérieur'] };
  };
  X.handingOf = (c, into, h) => { const f = into === 0 ? c.g.nin : G.mul(c.g.nin, -1); const H = h ? c.g.p1 : c.g.p0; const right = { x: f.y, y: -f.x }; return G.dot(G.sub(H, c.g.mid), right) > 0 ? 'droit' : 'gauche'; };
  X.setConfig = (room, o, into, h) => {
    const c = X.configs(room, o); const H = h ? c.g.p1 : c.g.p0; const type = c.pr.o.type;
    App.mutate(() => {
      const tgt = into === 1 && c.other ? c.other : c.base; const tw = App.ops.twin(tgt.room, tgt.o);
      if (tw) { tw.o.sw = 0; tw.o.out = false; }
      const ng = App.ops.geo(tgt.room, tgt.o);
      tgt.o.sw = 1; tgt.o.type = type; tgt.o.out = into === 1 && !c.other; tgt.o.hinge = G.dist(H, ng.p0) <= G.dist(H, ng.p1) ? 'g' : 'd';
      S.sel = { id: tgt.room.id, oid: tgt.o.oid };
    });
  };

  /* pictogramme orienté comme sur le plan */
  function picto(c, type, into, h) {
    const s0 = App.w2s(c.g.p0), s1 = App.w2s(c.g.p1); const d = G.norm(G.sub(s1, s0)); const ns = G.norm({ x: c.g.nin.x, y: -c.g.nin.y });
    const C = { x: 36, y: 36 }, hw = 14, P0 = G.sub(C, G.mul(d, hw)), P1 = G.add(C, G.mul(d, hw)), side = into === 0 ? ns : G.mul(ns, -1);
    const pt = (p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1);
    const A0 = G.sub(C, G.mul(d, 33)), A1 = G.add(C, G.mul(d, 33));
    let s = `<path class="w" d="M${pt(A0)}L${pt(P0)}M${pt(P1)}L${pt(A1)}"/>`;
    const leafArc = (Hh, E, r) => { const tip = G.add(Hh, G.mul(side, r)); const v1 = G.sub(E, Hh), v2 = G.sub(tip, Hh); const sweep = v1.x * v2.y - v1.y * v2.x > 0 ? 1 : 0; return `<path class="l" d="M${pt(Hh)}L${pt(tip)}"/><path class="a" d="M${pt(E)}A${r} ${r} 0 0 ${sweep} ${pt(tip)}"/>`; };
    if (type === 'porte') s += leafArc(h ? P1 : P0, h ? P0 : P1, 2 * hw);
    else if (type === 'porte2') s += leafArc(P0, C, hw) + leafArc(P1, C, hw);
    else { const off = G.mul(side, 5); const from = h ? P1 : P0, to = h ? P0 : P1; const q0 = G.add(from, off), q1 = G.add(to, off); const ar = G.add(q1, G.mul(G.norm(G.sub(q1, q0)), -6)); s += `<path class="l" d="M${pt(q0)}L${pt(q1)}"/><path class="a" d="M${pt(G.add(ar, G.mul(side, 3)))}L${pt(q1)}L${pt(G.sub(ar, G.mul(side, 3)))}"/>`; }
    return `<svg viewBox="0 0 72 72" aria-hidden="true">${s}</svg>`;
  }

  /* ---------- menu porte / fenêtre ---------- */
  X.inspOpening = () => {
    const f = App.ops.selected(); if (!f) return '';
    const { room, o } = f; const tw = App.ops.twin(room, o); const g = App.ops.geo(room, o); const isDoor = App.ops.DOORS.includes(o.type); const isWin = ['fenetre', 'porte-fenetre', 'baie', 'fixe', 'velux'].includes(o.type);
    const where = tw ? `Entre ${esc(room.name || 'pièce')} et ${esc(tw.room.name || 'pièce')}` : `${esc(room.name || 'Pièce')} · mur ${App.walls.name(room, o.wall)}`;
    let h = `<button class="link" data-x="back">← ${esc(room.name || 'Pièce')}</button>
      <div class="ctxhead"><h2>${esc(App.ops.name(o.type))}</h2><span class="big2">${App.fmtCm(o.width, 0)}<small>cm</small></span></div><p class="lead">${where}${o.type === 'porte' ? ' · poussant ' + App.ops.handing(room, o) : ''}</p>`;
    if (isDoor) {
      const c = X.configs(room, o); const two = o.type === 'porte2';
      const cells = []; for (const into of [0, 1]) for (const hh of two ? [0] : [0, 1]) cells.push({ into, hh });
      h += `<h3>${o.type === 'coulissante' || o.type === 'galandage' ? 'Côté et sens de glissement' : 'Sens d\'ouverture'}</h3><div class="picker ${two ? 'two' : ''}">${cells.map(({ into, hh }) => { const on = c.curInto === into && (two || c.curH === hh); return `<button data-x="cfg" data-into="${into}" data-h="${hh}" aria-pressed="${on}">${picto(c, o.type, into, hh)}<b>${esc(c.names[into])}</b>${o.type === 'porte' ? `<small>poussant ${X.handingOf(c, into, hh)}</small>` : ''}</button>`; }).join('')}</div>`;
      if (o.type === 'porte') h += `<p class="hint2">Poussant droit : les paumelles sont à droite quand on pousse la porte.</p>`;
    }
    h += `<h3>Dimensions</h3>
      <div class="field"><label>Largeur de passage</label><div class="unit"><input data-xc="width" inputmode="decimal" value="${fmt(o.width / 10)}"><span>cm</span></div></div>
      ${isDoor || o.type === 'passage' ? `<div class="chips sm">${[63, 73, 83, 93].map((v) => `<button data-x="w" data-v="${v}" aria-pressed="${Math.abs(o.width / 10 - v) < 0.5}">${v}</button>`).join('')}<span class="chipnote">vantaux standard</span></div>` : ''}
      <div class="field"><label>Hauteur</label><div class="unit"><input data-xc="h" inputmode="decimal" value="${o.h ? fmt(o.h / 10) : ''}"><span>cm</span></div></div>
      ${isDoor ? `<div class="chips sm">${[204, 215, 224].map((v) => `<button data-x="hh" data-v="${v}" aria-pressed="${o.h && Math.abs(o.h / 10 - v) < 0.5}">${v}</button>`).join('')}</div>` : ''}
      ${isWin ? `<div class="field"><label>Allège</label><div class="unit"><input data-xc="sill" inputmode="decimal" value="${o.sill != null ? fmt(o.sill / 10) : ''}"><span>cm</span></div></div>` : ''}
      <div class="field"><label>Distance à l'angle ${L(o.wall)}</label><div class="unit"><input data-xc="pos" inputmode="decimal" value="${fmt(g.pos / 10)}"><span>cm</span></div></div>
      <p class="hint2">Sur le plan : glissez l'ouverture le long du mur, tirez ses extrémités pour l'élargir.</p>
      ${X.recessAt(f) ? `<div class="preview"><b>Mur en décrochement</b> — la pièce entre de ${App.fmtCm(X.recessAt(f).off, 0)} cm dans l'épaisseur du mur autour de cette ouverture (souvent un vantail coulissant ou une embrasure lus comme une cloison sur le PDF).<div class="row" style="margin-top:8px"><button class="btn sm red" data-x="dstraight">Redresser le mur</button></div></div>` : ''}
      <h3>Type</h3><div class="chips">${PL.lib.openings.map((t) => `<button data-x="type" data-v="${t.id}" aria-pressed="${t.id === o.type}">${esc(t.name)}</button>`).join('')}</div>
      <div class="row" style="margin-top:18px"><button class="btn sm" data-x="zoom">Zoomer</button><button class="btn sm red" data-x="del">Supprimer</button></div>`;
    return h;
  };

  X.recessAt = (f) => {
    const tw = App.ops.twin(f.room, f.o);
    for (const x of [f, tw]) { if (!x) continue; const b = App.walls.recessBase(x.room, x.o.wall); if (b != null && App.walls.chainPlan(x.room, x.o.wall)) { const W = App.ops.wall(x.room, x.o.wall), V = App.ops.wall(x.room, b); return { room: x.room, wall: x.o.wall, off: G.dot(G.sub(V.a, W.a), W.nin) }; } }
    return null;
  };

  /* ---------- menu cloison ---------- */
  X.inspWall = () => {
    const room = App.selected(); const i = S.sel.wall; if (!room || i == null || i >= room.pts.length) return '';
    const n = room.pts.length, W = App.ops.wall(room, i), parts = App.walls.partners(room, i), th = App.walls.thickness(room, i), locked = App.walls.isLocked(room, i);
    const others = [...new Set(parts.map((p) => p.room))]; const P = S.pending;
    const end = S.wallEnd || App.walls.defaultEnd(room, i);
    let h = `<button class="link" data-x="back">← ${esc(room.name || 'Pièce')}</button>
      <div class="ctxhead"><h2>${parts.length ? 'Cloison' : 'Mur'} ${App.walls.name(room, i)}</h2><span class="big2">${App.fmtCm(W.el)}<small>cm</small></span></div>
      <p class="lead">${parts.length ? `Entre ${esc(room.name || 'pièce')} et ${others.map((r) => esc(r.name || 'pièce')).join(', ')}${th > 15 ? ` · épaisseur ${App.fmtCm(th, 0)} cm` : ""}` : `${esc(room.name || 'Pièce')} · mur extérieur ou sans voisin`}</p>`;
    if (P) {
      const toward = P.delta < 0 ? (others[0] ? others[0].name : 'l\'extérieur') : room.name;
      h += `<div class="preview"><b>Aperçu</b> — ${P.info ? esc(P.info) + ' · ' : ''}la cloison avance de ${App.fmtCm(Math.abs(P.delta))} cm vers ${esc(toward || 'la pièce')}.
        ${P.affected.length ? `<ul>${P.affected.map((a) => `<li>${esc(a.name || 'Pièce')} · mur ${App.walls.name(App.byId(a.id), a.i)} : ${App.fmtCm(a.L0)} → <b>${App.fmtCm(a.L1)}</b> cm${a.locked ? ' <span class="tag red">cote verrouillée</span>' : ''}</li>`).join('')}</ul>` : ''}
        ${P.valid ? '' : '<p class="warn">Une pièce se retournerait : réduisez le déplacement.</p>'}
        <div class="row"><button class="btn sm ghost" data-x="pcancel">Annuler</button><button class="btn sm red" data-x="pok" ${P.valid ? '' : 'disabled'}>Valider</button></div></div>`;
    }
    h += `<div class="row" style="margin:12px 0 4px"><button class="btn sm ${locked ? 'primary' : ''}" data-x="wlock">${LOCK}${locked ? 'Cloison verrouillée' : 'Verrouiller la cloison'}</button>${parts.length ? '<button class="btn sm ghost" data-x="wmerge">Supprimer la cloison</button>' : ''}${App.walls.canStraighten(room, i) ? '<button class="btn sm" data-x="wstraight">Redresser</button>' : ''}</div>
      ${App.walls.canStraighten(room, i) ? '<p class="hint2">Redresser : supprime les décrochements de moins de 30 cm le long de ce mur (embrasures, châssis…) et l\'aligne d\'un seul trait sur ses deux bouts ; une fenêtre ou une porte en renfoncement prend toute la largeur du trou.</p>' : ''}
      <h3>Longueur</h3>
      <div class="field"><label>Longueur ${App.walls.name(room, i)}</label><div class="unit"><input data-xc="wlen" inputmode="decimal" value="${fmt(W.el / 10)}" ${locked ? '' : ''}><span>cm</span></div></div>
      <div class="seg"><button data-x="wend" data-v="A" aria-pressed="${end === 'A'}">Allonger côté ${L(i)}</button><button data-x="wend" data-v="B" aria-pressed="${end === 'B'}">Allonger côté ${L((i + 1) % n)}</button></div>
      <p class="hint2">Le mur voisin de ce côté se déplace parallèlement ; les autres ne bougent pas.</p>
      <h3>Déplacer la cloison</h3>
      <div class="field"><label>Décaler de</label><div class="unit"><input data-xc="wmove" inputmode="decimal" placeholder="0"><span>cm</span></div></div>
      <div class="seg"><button data-x="wdir" data-v="out" aria-pressed="${S.wallDir !== 'in'}">Agrandir ${esc(room.name || 'la pièce')}</button><button data-x="wdir" data-v="in" aria-pressed="${S.wallDir === 'in'}">${others.length ? 'Agrandir ' + esc(others[0].name || 'la voisine') : 'Réduire la pièce'}</button></div>
      <p class="hint2">Ou glissez la poignée sur le plan. Seuls les murs parallèles bougent ; ceux qui touchent la cloison s'allongent ou raccourcissent. Rien n'est appliqué avant « Valider ».</p>
      <h3>Ouvertures sur ce mur</h3>`;
    const ops = (room.openings || []).filter((o) => o.wall === i);
    h += ops.length ? `<div class="list">${ops.map((o) => { const pr = App.ops.primary(room, o); return `<button class="item" data-x="opsel" data-v="${pr.o.oid}"><span class="nm">${esc(App.ops.name(o.type))}</span><span class="meta">${esc(App.ops.describe(room, o))}</span><span class="v">${App.fmtCm(o.width, 0)}<small style="font-size:12px"> cm</small></span></button>`; }).join('')}</div>` : '<p>Aucune.</p>';
    h += `<div class="row" style="margin-top:10px"><button class="btn sm" data-x="wadd" data-v="porte">+ Porte</button><button class="btn sm" data-x="wadd" data-v="fenetre">+ Fenêtre</button><button class="btn sm" data-x="wadd" data-v="passage">+ Passage</button></div>`;
    return h;
  };

  /* ---------- barre flottante ---------- */
  X.renderOpbar = () => {
    const bar = $('opbar'); if (!bar) return; let h = '';
    const P = S.pending; const f = App.ops.selected();
    if (S.skPlan) h = `<span class="ob-v">${S.skPlan.kind === 'line' ? 'Cloison' : 'Pièce'}</span><span class="ob-n">${App.esc(App.sketch.summary())}</span><button data-ob="skcancel">Annuler</button><button data-ob="skok" class="ok">Valider</button>`;
    else if (P) h = `<span class="ob-v">${P.delta >= 0 ? '' : '−'}${App.fmtCm(Math.abs(P.delta))} cm</span>${P.affected.length ? `<span class="ob-n">${P.affected.length} mur${P.affected.length > 1 ? 's' : ''} étiré${P.affected.length > 1 ? 's' : ''}${P.affected.some((a) => a.locked) ? ' · cote verrouillée' : ''}</span>` : ''}<button data-ob="cancel">Annuler</button><button data-ob="ok" class="ok" ${P.valid ? '' : 'disabled'}>Valider</button>`;
    else if (f) {
      const t = f.o.type;
      if (t === 'porte') h = '<button data-ob="flip">Inverser</button><button data-ob="hinge">Gonds</button>';
      else if (t === 'porte2') h = '<button data-ob="flip">Inverser</button>';
      else if (t === 'coulissante' || t === 'galandage') h = '<button data-ob="flip">Côté</button><button data-ob="hinge">Glisse</button>';
      h += '<button data-ob="del">Supprimer</button><button data-ob="more">Réglages</button>';
    } else if (S.sel && !S.sel.oid && S.sel.wall == null && App.selected() && ['meuble', 'poteau', 'forme'].includes(App.selected().kind) && !App.selected().locked) {
      const m = App.selected();
      h = `<button data-ob="rot90">Pivoter</button>${m.kind === 'meuble' && m.pts.length >= 4 ? '<button data-ob="backwall">Dos au mur</button>' : ''}<button data-ob="sdel">Supprimer</button><button data-ob="more">Réglages</button>`;
    } else if (S.sel && S.sel.wall != null && App.selected()) {
      const r = App.selected(); const lk = App.walls.isLocked(r, S.sel.wall);
      h = `<button data-ob="lock">${lk ? 'Déverrouiller' : 'Verrouiller'}</button>${!lk && App.walls.canStraighten(r, S.sel.wall) ? '<button data-ob="wstraight">Redresser</button>' : ''}<button data-ob="door">+ Porte</button><button data-ob="more">Réglages</button>`;
    }
    bar.innerHTML = h; bar.hidden = !h; X.placeOpbar();
  };
  X.placeOpbar = () => {
    const bar = $('opbar'); if (!bar || bar.hidden) return; let p = null;
    const P = S.pending; const f = App.ops.selected();
    if (S.skPlan) { const pts = (S.skPlan.zone || S.skPlan.strips.flat()).map(App.w2s); const top = Math.min(...pts.map((q) => q.y)); const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length; p = App.s2w({ x: cx, y: top - 10 }); }
    else if (P) { const m = P.moving[0]; const r = App.byId(m.id); if (r) p = G.lerp(r.pts[m.i], r.pts[(m.i + 1) % r.pts.length], 0.5); }
    else if (f) { const g = App.ops.geo(f.room, f.o); if (g) p = g.mid; }
    else if (S.sel && S.sel.wall != null) { const r = App.selected(); if (r) p = G.lerp(r.pts[S.sel.wall], r.pts[(S.sel.wall + 1) % r.pts.length], 0.5); }
    else if (App.selected() && App.selected().pts) { const sp = App.selected().pts.map(App.w2s); const top = Math.min(...sp.map((q) => q.y)); const cx = sp.reduce((a, q) => a + q.x, 0) / sp.length; p = App.s2w({ x: cx, y: top - 8 }); }
    if (!p) { bar.style.visibility = 'hidden'; return; }
    const q = App.w2s(p), st = $('stage').getBoundingClientRect(), bw = bar.offsetWidth, bh = bar.offsetHeight, ob = App.ui.obstruction();
    if (q.y > st.height - ob.bottom + 4 || q.y < ob.top - 10 || q.x < -20 || q.x > st.width + 20) { bar.style.visibility = 'hidden'; return; }
    let x = Math.max(8, Math.min(st.width - bw - 8, q.x - bw / 2)), y = q.y - bh - 34;
    if (y < ob.top + 4) y = q.y + 34;
    y = Math.min(y, st.height - ob.bottom - bh - 6);
    bar.style.left = x + 'px'; bar.style.top = y + 'px'; bar.style.visibility = 'visible';
  };

  X.focus = (p) => {
    const sh = App.ui.obstruction(); let z = S.view.z; if (z < 0.055) z = 0.075;
    App.animateView({ cx: p.x + (sh.right / 2) / z, cy: p.y - ((sh.bottom - sh.top) / 2) / z, z });
  };

  /* ---------- actions ---------- */
  const describeToast = () => { const f = App.ops.selected(); if (f) App.toast(`${App.ops.name(f.o.type)} : ${App.ops.describe(f.room, f.o)}`); };
  X.act = async (a, v, el) => {
    const f = App.ops.selected();
    switch (a) {
      case 'flip': if (!f) return; App.mutate(() => { const r = App.ops.flipSwing(f.room, f.o); S.sel = { id: r.room.id, oid: r.o.oid }; }); describeToast(); break;
      case 'hinge': if (!f) return; App.mutate(() => { App.ops.flipHinge(f.room, f.o); }); describeToast(); break;
      case 'del':
        if (f) { App.mutate(() => App.ops.remove(f.room, f.o)); S.sel = { id: f.room.id }; App.ui.refresh(); App.toast('Ouverture supprimée — Annuler pour revenir'); }
        break;
      case 'more': App.ui.sheet(innerWidth < 900 ? 'half' : App.ui.sheetState()); App.ui.refresh(); break;
      case 'back': S.sel = S.sel ? { id: S.sel.id } : null; App.ui.refresh(); App.render(); break;
      case 'type': if (!f) return; App.mutate(() => { const def = PL.lib.openings.find((x) => x.id === v) || {}; f.o.type = v; if (def.h && (!f.o.h || App.ops.DOORS.includes(v) !== App.ops.DOORS.includes(f.o.type))) f.o.h = def.h; if (def.sill != null) f.o.sill = def.sill; App.ops.syncTwin(f.room, f.o); }); break;
      case 'cfg': if (!f) return; X.setConfig(f.room, f.o, +el.dataset.into, +el.dataset.h); describeToast(); break;
      case 'w': { if (!f) return; let cl = false; App.mutate(() => { const g = App.ops.geo(f.room, f.o); const nw = +v * 10; cl = App.ops.setSpan(f.room, f.o, g.pos + (g.w - nw) / 2, nw); }); if (cl) App.toast('Ajusté : une ouverture voisine ou l\'angle du mur limite la largeur'); break; }
      case 'hh': if (!f) return; App.mutate(() => { f.o.h = +v * 10; App.ops.syncTwin(f.room, f.o); }); break;
      case 'zoom': if (f) { const g = App.ops.geo(f.room, f.o); const pad = 1200; App.fitBox({ x0: g.mid.x - pad, y0: g.mid.y - pad, x1: g.mid.x + pad, y1: g.mid.y + pad, w: 2 * pad, h: 2 * pad }, 20); } break;
      case 'opsel': { const fo = App.ops.find(v); if (!fo) return; S.sel = { id: fo.room.id, oid: v }; App.ui.onSelect(); App.render(); break; }
      case 'optool': App.ui.setTool('opening'); if (innerWidth < 900) App.ui.sheet('min'); break;
      case 'ok': case 'pok': await App.walls.validate(); App.ui.refresh(); break;
      case 'cancel': case 'pcancel': App.walls.cancel(); App.toast('Déplacement annulé'); break;
      case 'lock': case 'wlock': { const r = App.selected(); if (!r) return; const lk = App.walls.toggleLock(r, S.sel.wall); App.toast(lk ? 'Cloison verrouillée (des deux côtés)' : 'Cloison déverrouillée'); break; }
      case 'door': case 'wadd': {
        const r = App.selected(); if (!r) return; const W = App.ops.wall(r, S.sel.wall); const p = G.add(G.lerp(W.a, W.b, 0.5), G.mul(W.nin, 5));
        const res = App.ops.addAt(p, v || 'porte'); if (res.exist) { S.sel = { id: res.exist.room.id, oid: res.exist.o.oid }; App.ui.onSelect(); App.toast('Il y a déjà une ouverture au milieu de ce mur'); break; } if (res.err) { App.toast(res.err); return; }
        S.sel = { id: res.room.id, oid: res.o.oid }; App.ui.onSelect(); App.render(); App.toast(`${App.ops.name(res.o.type)} ajoutée au milieu du mur`); break;
      }
      case 'wsel': { const r = App.selected(); if (!r) return; S.sel = { id: r.id, wall: +v }; S.wallEnd = null; App.ui.onSelect(); break; }
      case 'rot90': { const m = App.selected(); if (!m || m.locked) return; App.mutate(() => { const c = G.centroid(m.pts); m.pts = m.pts.map((q) => G.rotAround(q, c, Math.PI / 2)); }); break; }
      case 'backwall': { const m = App.selected(); if (!m || m.locked) return; let ok = false; App.mutate(() => { ok = App.guides.backToWall(m); }); App.toast(ok ? 'Dos contre le mur le plus proche' : 'Aucun mur à proximité'); break; }
      case 'sdel': App.ui.deleteSelected(); break;
      case 'wstraight': {
        const r = App.selected(); if (!r || S.sel.wall == null) return; if (r.locked || App.walls.isLocked(r, S.sel.wall)) { App.toast('Mur verrouillé'); return; }
        let n = 0; const before = r.pts.length; App.mutate(() => { n = App.walls.straighten(r, S.sel.wall); }); S.sel = { id: r.id }; App.ui.onSelect();
        App.toast(n ? `Mur redressé : ${before - r.pts.length} angle${before - r.pts.length > 1 ? 's' : ''} en moins` : 'Rien à redresser ici'); break;
      }
      case 'dstraight': {
        const rc = f && X.recessAt(f); if (!rc) return; App.mutate(() => { App.walls.straighten(rc.room, rc.wall); }); App.toast(`${rc.room.name || 'Pièce'} : mur redressé, l'ouverture prend toute la largeur du trou`); App.ui.refresh(); break;
      }
      case 'fixall': {
        let n = 0; App.mutate(() => { for (const r of App.rooms()) if (App.walls.simplify(r)) n++; }); App.toast(n ? `${n} pièce${n > 1 ? 's' : ''} simplifiée${n > 1 ? 's' : ''} — Annuler pour revenir` : 'Rien à simplifier'); break;
      }
      case 'skok': App.sketch.validate(); break;
      case 'skcancel': App.sketch.cancel(); App.ui.refreshHint(); break;
      case 'wend': S.wallEnd = v; App.ui.refresh(); break;
      case 'wdir': S.wallDir = v; App.ui.refresh(); break;
      case 'wmerge': {
        const r = App.selected(); const parts = App.walls.partners(r, S.sel.wall); if (!parts.length) return; const o = parts[0].room;
        if (!(await App.ui.confirm('Supprimer la cloison', `${r.name || 'La pièce'} et ${o.name || 'la pièce voisine'} deviendront une seule pièce.`, 'Fusionner'))) return;
        const m = App.feat.merge(r, o); if (m) { S.sel = { id: m.id }; App.ui.refresh(); App.toast('Cloison supprimée : pièces fusionnées'); } break;
      }
    }
    App.render();
  };
  X.change = (c, val) => {
    const f = App.ops.selected(); const v = num(val);
    if (f && ['width', 'h', 'sill', 'pos'].includes(c)) {
      if (v == null && c !== 'sill' && c !== 'h') return;
      let cl = false;
      App.mutate(() => { const g = App.ops.geo(f.room, f.o); if (c === 'width') cl = App.ops.setSpan(f.room, f.o, g.pos + (g.w - v * 10) / 2, v * 10); else if (c === 'pos') cl = App.ops.setSpan(f.room, f.o, v * 10, g.w, { jump: true }); else { f.o[c] = v == null ? null : v * 10; App.ops.syncTwin(f.room, f.o); } });
      if (cl) App.toast('Ajusté : pas de chevauchement avec une autre ouverture');
      return;
    }
    const r = App.selected(); if (!r || S.sel.wall == null) return; const i = S.sel.wall;
    if (c === 'wlen') {
      if (!v) return; const end = S.wallEnd || App.walls.defaultEnd(r, i); const plan = App.walls.lengthPlan(r, i, end, v * 10);
      if (plan.err) { App.toast(plan.err); App.ui.refresh(true); return; }
      const b = App.walls.begin(r, plan.j, `longueur ${App.walls.name(r, i)} → ${fmt(v)} cm`); if (b.err) { App.toast(b.err + (end === 'B' ? ' — essayez l\'autre côté' : '')); App.ui.refresh(true); return; }
      App.walls.apply(plan.delta); App.ui.refresh(true); App.render(); return;
    }
    if (c === 'wmove') {
      if (!v) return; const b = App.walls.begin(r, i); if (b.err) { App.toast(b.err); App.ui.refresh(true); return; }
      App.walls.apply((S.wallDir === 'in' ? 1 : -1) * v * 10); App.ui.refresh(true); App.render();
    }
  };

  X.init = () => {
    $('panel').addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b) X.act(b.dataset.x, b.dataset.v, b); });
    $('panel').addEventListener('change', (e) => { const t = e.target; if (t.dataset.xc) X.change(t.dataset.xc, t.value); });
    $('opbar').addEventListener('click', (e) => { const b = e.target.closest('[data-ob]'); if (b) X.act(b.dataset.ob, null, b); });
  };
})();
