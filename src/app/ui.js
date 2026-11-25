/* Calepin — interface : barre, outils, panneaux, inspecteur, dialogues. */
(function () {
  const PL = globalThis.PL, G = PL.geom, App = globalThis.App, S = App.state, esc = App.esc;
  const $ = (id) => document.getElementById(id);
  const ui = (App.ui = {});
  const LOCK = '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>';
  const UNLOCK = '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7"/><path d="M5 7V5a3 3 0 0 1 6 0"/></svg>';
  const TABS = [['pieces', 'Plan'], ['calepinage', 'Calepinage'], ['mobilier', 'Mobilier'], ['elec', 'Électricité', 'Élec.'], ['import', 'Importer', 'Import'], ['projet', 'Projet']];
  const KIND = { piece: 'Pièce', meuble: 'Meuble', poteau: 'Poteau', exclusion: 'Zone sans parquet', escalier: 'Escalier', plafond: 'Zone de plafond bas', forme: 'Forme' };
  const wallName = (i, n) => String.fromCharCode(65 + (i % 26)) + String.fromCharCode(65 + ((i + 1) % n) % 26);
  const num = (v) => { const x = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : null; };
  const fmt = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('fr-FR', { maximumFractionDigits: d });

  /* ---------- toast / dialogues ---------- */
  let toastT = null;
  App.toast = (msg, ms = 2400) => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); };
  ui.dialog = (title, html, buttons) => new Promise((res) => {
    const m = $('modal'), box = $('modalBox');
    box.innerHTML = `<h4>${esc(title)}</h4>${html}<div class="row" style="justify-content:flex-end;margin-top:16px">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>`;
    m.hidden = false; const first = box.querySelector('input,textarea,select'); if (first) setTimeout(() => first.focus(), 30);
    const done = (i) => { m.hidden = true; box.onclick = null; m.onclick = null; const vals = {}; box.querySelectorAll('[name]').forEach((el) => { vals[el.name] = el.type === 'checkbox' ? el.checked : el.value; }); res({ i, vals }); };
    box.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) done(+b.dataset.i); };
    m.onclick = (e) => { if (e.target === m) done(-1); };
    box.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); done(buttons.findIndex((b) => b.def) >= 0 ? buttons.findIndex((b) => b.def) : buttons.length - 1); } };
  });
  ui.confirm = async (title, msg, ok = 'Confirmer') => (await ui.dialog(title, `<p>${esc(msg)}</p>`, [{ label: 'Annuler', cls: 'ghost' }, { label: ok, cls: 'red', def: true }])).i === 1;

  /* ---------- obstruction (pour cadrer le plan) ---------- */
  ui.obstruction = () => {
    const sheet = $('sheet'); const wide = innerWidth >= 900;
    const top = innerWidth <= 640 ? 92 : 54;
    if (wide) return { bottom: 0, right: 0, top };
    const hmap = { min: 112, half: innerHeight * 0.48, full: innerHeight * 0.88 }; const h = hmap[sheet.dataset.h] || sheet.getBoundingClientRect().height;
    return { bottom: Math.max(0, h - 4) + 12, right: 0, top };
  };

  /* ---------- enregistrement : état + versions ---------- */
  const hm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const when = (t) => { const d = new Date(t), now = new Date(); const day = d.toDateString() === now.toDateString() ? 'aujourd\'hui' : d.toDateString() === new Date(now - 864e5).toDateString() ? 'hier' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }); return day + ' à ' + hm(t); };
  ui.saveBadge = () => {
    const b = $('savebtn'); if (!b) return; const st = S.saveState || 'ok'; b.dataset.st = st;
    $('savelab').textContent = st === 'err' ? 'Non enregistré' : st === 'dirty' ? 'Enregistrement…' : 'Enregistré';
    b.title = st === 'err' ? 'L\'enregistrement automatique a échoué — toucher pour enregistrer une version' : (S.savedAt ? 'Enregistré automatiquement à ' + hm(S.savedAt) : 'Enregistré automatiquement') + ' — toucher pour enregistrer une version';
  };
  ui.openVersions = () => { ui.setTab('projet'); if (innerWidth < 900) ui.sheet('full'); setTimeout(() => { const el = $('panel').querySelector('#vers'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); };
  ui.saveDialog = async () => {
    if (!$('modal').hidden) return;
    App.save();
    const cloud = App.cloud && App.cloud.ready;
    const def = 'Version du ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ', ' + hm(Date.now());
    const status = S.saveState === 'err'
      ? '<p class="warn">L\'enregistrement automatique ne fonctionne pas dans ce navigateur (stockage plein ou désactivé). Enregistrez une version ou exportez le projet pour ne rien perdre.</p>'
      : `<p>Vos modifications sont déjà enregistrées automatiquement, à chaque changement${S.savedAt ? ` (dernier enregistrement à ${hm(S.savedAt)})` : ''}${cloud ? ', et synchronisées avec votre compte' : ''}.</p>`;
    const r = await ui.dialog('Enregistrer', status + '<p class="hint2">Une version garde une copie de l\'état actuel du projet : avant de gros changements, c\'est un point de retour que vous pourrez restaurer depuis l\'onglet Projet.</p><div class="field"><label>Nom de la version</label><input name="n" maxlength="80" value="' + esc(def) + '"></div>',
      [{ label: 'Annuler', cls: 'ghost' }, { label: 'Voir les versions', cls: 'ghost' }, { label: 'Enregistrer la version', cls: 'primary', def: true }]);
    if (r.i === 1) { ui.openVersions(); return; }
    if (r.i !== 2) return;
    const name = (r.vals.n || '').trim() || def;
    const res = await App.versions.save(name);
    App.toast(res.ok ? `Version « ${name} » enregistrée${res.cloud ? '' : res.local && cloud ? ' sur cet appareil' : ''}` : 'Impossible d\'enregistrer la version : exportez le projet');
    ui.refresh();
  };
  const versionsHTML = () => {
    const V = App.versions; const cloud = App.cloud && App.cloud.ready;
    if (!V.list) { V.load().then(() => { if (S.tab === 'projet') ui.refresh(); }); }
    const list = V.list || [];
    const rows = !V.list ? '<p class="hint2">Chargement…</p>' : !list.length ? '<p class="hint2">Aucune version pour l\'instant.</p>'
      : `<div class="list">${list.map((v) => `<div class="item ver"><span class="vt"><span class="nm">${esc(v.name)}</span><span class="vmeta">${when(v.at)} · ${v.rooms} pièce${v.rooms > 1 ? 's' : ''}${cloud && !v.cloud ? ' · sur cet appareil' : ''}${!v.local ? ' · depuis votre compte' : ''}</span></span><button class="btn sm" data-a="vrest" data-v="${esc(v.id)}">Restaurer</button><button class="btn sm ghost" data-a="vdel" data-v="${esc(v.id)}" aria-label="Supprimer la version">✕</button></div>`).join('')}</div>`;
    return `<h3 id="vers">Versions</h3><p class="hint2">Des copies nommées du projet, à restaurer en cas de besoin. ${cloud ? 'Elles sont gardées dans votre compte.' : 'Elles sont gardées sur cet appareil.'}</p><div class="row" style="margin-bottom:8px"><button class="btn sm" data-a="vsave">+ Enregistrer une version</button></div>${rows}`;
  };

  /* ---------- initialisation ---------- */
  ui.init = () => {
    $('undo').onclick = App.undo; $('redo').onclick = App.redo;
    $('savebtn').onclick = () => ui.saveDialog();
    window.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key || '').toLowerCase() === 's') { e.preventDefault(); if ($('modal').hidden && !(App.fps && App.fps.active && App.fps.active())) ui.saveDialog(); } });
    $('modes').onclick = (e) => { const b = e.target.closest('[data-mode]'); if (b) ui.setMode(b.dataset.mode); };
    $('rail').onclick = (e) => { const b = e.target.closest('[data-tool]'); if (b) ui.setTool(b.dataset.tool === S.tool && b.dataset.tool !== 'select' ? 'select' : b.dataset.tool); };
    $('zIn').onclick = () => zoomBy(1.5); $('zOut').onclick = () => zoomBy(1 / 1.5); $('zFit').onclick = () => { S.sel = null; App.fitAll(); ui.refresh(); };
    $('rnPrev').onclick = () => stepRoom(-1); $('rnNext').onclick = () => stepRoom(1);
    $('rnName').onclick = () => { ui.setTab('pieces'); ui.sheet('half'); };
    $('rnAll').onclick = () => { S.sel = null; App.fitAll(); ui.refresh(); };
    $('rn3d').onclick = () => { const s = App.selected(); const room = s && s.kind === 'piece' ? s : s && App.rooms(s.floor).find((r) => G.pointInPoly(G.centroid(s.pts || r.pts), r.pts)); App.fps.open({ floor: S.p.floorId, room: room && room.id }); };
    $('tabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) { S.sel = null; ui.setTab(b.dataset.tab); if ($('sheet').dataset.h === 'min') ui.sheet('half'); App.render(); } };
    const panel = $('panel');
    panel.addEventListener('click', onPanelClick); panel.addEventListener('change', onPanelChange);
    panel.addEventListener('input', (e) => { const t = e.target; if (t.dataset.live === 'name' && App.selected()) { App.selected().name = t.value; App.render(); } if (t.dataset.live === 'bgop') { const v = +t.value / 100; App.setBgOpacity(v); panel.querySelectorAll('[data-bgop-v]').forEach((x) => { x.textContent = Math.round(v * 100) + ' %'; }); panel.querySelectorAll('input[data-live=bgop]').forEach((x) => { if (x !== t) x.value = t.value; }); } });
    // poignée du panneau
    const grip = $('grip'); let gy = null, gh = 0;
    grip.addEventListener('pointerdown', (e) => { gy = e.clientY; gh = $('sheet').getBoundingClientRect().height; grip.setPointerCapture(e.pointerId); });
    grip.addEventListener('pointermove', (e) => { if (gy == null) return; const h = Math.max(100, Math.min(innerHeight * 0.9, gh - (e.clientY - gy))); $('sheet').style.setProperty('--sheeth', h + 'px'); $('sheet').style.transition = 'none'; });
    grip.addEventListener('pointerup', (e) => { if (gy == null) return; const moved = Math.abs(e.clientY - gy) > 6; const h = gh - (e.clientY - gy); gy = null; $('sheet').style.transition = ''; $('sheet').style.removeProperty('--sheeth'); if (!moved) { ui.sheet($('sheet').dataset.h === 'min' ? 'half' : $('sheet').dataset.h === 'half' ? 'full' : 'min'); return; } ui.sheet(h < innerHeight * 0.3 ? 'min' : h < innerHeight * 0.7 ? 'half' : 'full'); });
    ui.sheet(innerWidth < 900 && S.p.shapes.length ? 'min' : 'half');
    ui.refresh(true); ui.refreshHint();
  };
  ui.sheetState = () => $('sheet').dataset.h || 'half';
  ui.sheet = (h) => { $('sheet').dataset.h = h; updateRail(); setTimeout(() => App.render(), 240); };
  function updateRail() { const wide = innerWidth >= 900; let b = 0; if (!wide) { const hmap = { min: 112, half: innerHeight * 0.48, full: innerHeight * 0.88 }; b = hmap[$('sheet').dataset.h] || 0; } $('stage').style.setProperty('--railb', (wide ? 0 : Math.max(0, b - (innerHeight - $('stage').getBoundingClientRect().bottom))) + 'px'); }
  addEventListener('resize', () => { updateRail(); });
  function zoomBy(k) { S.view.z = Math.max(0.002, Math.min(3, S.view.z * k)); App.render(); }

  function stepRoom(d) {
    const rooms = App.rooms(); if (!rooms.length) return;
    const cur = App.selected(); let i = cur && cur.kind === 'piece' ? rooms.indexOf(cur) : -1;
    i = (i + d + rooms.length) % rooms.length; if (i < 0) i = 0;
    S.sel = { id: rooms[i].id }; App.fitShape(rooms[i]); ui.onSelect(); App.render();
  }

  const dropPending = () => { if (S.pending && App.walls) App.walls.cancel(true); };
  ui.setMode = (m) => {
    dropPending(); if (App.sketch) App.sketch.cancel(true); S.mode = m; const tab = { plan: 'pieces', mobilier: 'mobilier', calepinage: 'calepinage', elec: 'elec' }[m];
    if (S.tool === 'elec' && m !== 'elec') ui.setTool('select');
    S.sel = null; ui.setTab(tab); App.render();
  };
  ui.setTab = (t) => { S.tab = t; ui.refresh(); $('panel').scrollTop = 0; };

  ui.setTool = (t) => {
    if (t !== 'select') dropPending();
    if (t !== 'sketch' && App.sketch) App.sketch.cancel(true);
    if (t === 'wand' && !(S.bgs[S.p.floorId] && S.bgs[S.p.floorId].img)) { App.toast('Importez d\'abord un plan (PDF ou image) sur cet étage'); ui.setTab('import'); return; }
    if (S.tool === 'draw' && t !== 'draw' && S.draft && S.draft.pts.length) S.draft = null;
    S.tool = t; S.measureA = null; S.tempMeasure = null; S.snapMark = null;
    if (t === 'draw' && !S.draft) S.draft = { pts: [], kind: S.drawKind || 'piece' };
    if (t !== 'draw') S.draft = null;
    ui.refreshHint(); ui.refresh(); App.render();
  };

  /* ---------- barre d'aide contextuelle ---------- */
  ui.refreshHint = () => {
    const h = $('hint'); const t = S.tool; let html = '';
    if (t === 'measure') html = `Règle : glissez d'un point à l'autre, ou touchez deux points. <button data-h="ortho">${S.ortho === false ? 'Angles libres' : 'Angles droits'}</button> <button data-h="done">Terminer</button>`;
    else if (t === 'calib') html = `Étalonnage : mesurez une cote connue sur le fond de plan. <button data-h="done">Annuler</button>`;
    else if (t === 'draw') {
      const d = S.draft || { pts: [] }; const kindSel = `<select data-h="kind" style="height:30px;background:var(--paper);color:var(--ink);border:0">${Object.entries(KIND).filter(([k]) => k !== 'escalier').map(([k, v]) => `<option value="${k}" ${(S.drawKind || 'piece') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
      html = d.pts.length ? `${kindSel} <input id="drawLen" inputmode="decimal" placeholder="cm" aria-label="Longueur du segment suivant"> <button data-h="dir" data-d="0">→</button><button data-h="dir" data-d="90">↑</button><button data-h="dir" data-d="180">←</button><button data-h="dir" data-d="270">↓</button> <button data-h="finish">Fermer</button> <button data-h="cancel">Annuler</button>`
        : `${kindSel} Touchez le plan pour poser le premier point. <button data-h="cancel">Annuler</button>`;
    } else if (t === 'wand') html = `Baguette : touchez l'intérieur d'une pièce du fond de plan (pour prolonger une cloison : outil Sélection, touchez la cloison, tirez la flèche). <button data-h="wandopt">Réglages</button> <button data-h="done">Terminer</button>`;
    else if (t === 'cut') html = `Tracez la cloison en travers de la pièce. Épaisseur <input id="cutThick" inputmode="decimal" value="${S.cutThick ?? 7}" aria-label="Épaisseur de la cloison en cm"> cm <button data-h="done">Annuler</button>`;
    else if (t === 'elec') { const e = PL.lib.elec.find((x) => x.id === S.elecType) || {}; html = `${esc(e.name || '')} : touchez un mur ou le plafond pour placer. <button data-h="done">Terminer</button>`; }
    else if (t === 'place') html = `Touchez le plan pour placer l'objet. <button data-h="done">Annuler</button>`;
    else if (t === 'sketch') html = S.skPlan ? `<b>Aperçu</b> ${esc(App.sketch.summary())}` : `<b>Retoucher</b> Trait d'un mur à l'autre : cloison · depuis le bout d'une cloison : la prolonger · Trait en L depuis un mur : décrochement · Zone entourée : pièce <button data-h="done">Terminer</button>`;
    else if (t === 'opening') html = `<select data-h="optype" aria-label="Type d'ouverture">${PL.lib.openings.map((o) => `<option value="${o.id}" ${(S.opType || 'porte') === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select> Touchez un mur pour la poser. <button data-h="done">Terminer</button>`;
    else if (S.p && S.p.seedOffer && globalThis.CALEPIN_SEED) html = `<b>Nouvelle lecture du plan PDF</b> : portes orientées d'après les arcs, fenêtres et passages revus. <button data-h="seed">Appliquer</button> <button data-h="noseed">Ignorer</button>`;
    h.hidden = !html; h.innerHTML = html;
    h.onclick = (e) => {
      const b = e.target.closest('[data-h]'); if (!b) return; const a = b.dataset.h;
      if (a === 'done' || a === 'cancel') { S.draft = null; ui.setTool('select'); }
      else if (a === 'ortho') { S.ortho = S.ortho === false; ui.refreshHint(); }
      else if (a === 'finish') ui.finishDraft();
      else if (a === 'dir') { const L = num($('drawLen').value); if (!L) { App.toast('Saisissez une longueur en cm'); return; } const d = S.draft; const last = d.pts[d.pts.length - 1]; const ang = G.rad(+b.dataset.d); d.pts.push({ x: last.x + Math.cos(ang) * L * 10, y: last.y + Math.sin(ang) * L * 10 }); ui.refreshHint(); App.render(); setTimeout(() => { const i = $('drawLen'); if (i) i.focus(); }, 10); }
      else if (a === 'wandopt') ui.setTab('import');
      else if (a === 'seed') { App.begin(); const n = App.ops.applySeed(S.p, globalThis.CALEPIN_SEED); App.end(true); ui.refreshHint(); App.toast(`Portes et fenêtres mises à jour${n ? ' · ' + n + ' pièces' : ''} — Annuler pour revenir`); }
      else if (a === 'noseed') { S.p.seedApplied = S.p.seedOffer; delete S.p.seedOffer; App.save(); ui.refreshHint(); }
    };
    const ot = h.querySelector('[data-h=optype]'); if (ot) ot.onchange = () => { S.opType = ot.value; };
    const sel = h.querySelector('[data-h=kind]'); if (sel) sel.onchange = () => { S.drawKind = sel.value; if (S.draft) S.draft.kind = sel.value; };
    const ct = h.querySelector('#cutThick'); if (ct) ct.onchange = () => { S.cutThick = num(ct.value) ?? 0; };
    updateRail();
  };
  ui.refreshDraft = () => ui.refreshHint();
  ui.measureLive = () => {};

  ui.finishDraft = () => {
    const d = S.draft; if (!d || d.pts.length < 3) { App.toast('Il faut au moins 3 points'); return; }
    let pts = G.ensureCCW(G.cleanPoly(d.pts, 0.2, 1)); if (pts.length < 3 || G.isSelfIntersecting(pts)) { App.toast('La forme se croise : recommencez'); return; }
    const kind = d.kind || 'piece'; const n = App.shapesOn().filter((s) => s.kind === kind).length + 1;
    const s = App.makeShape(kind, pts, { name: kind === 'piece' ? 'Pièce ' + n : KIND[kind] + ' ' + n });
    App.mutate((P) => P.shapes.push(s)); S.draft = null; S.sel = { id: s.id }; ui.setTool('select'); ui.onSelect(); App.toast('Forme créée — ajustez ses cotes');
  };

  ui.bgSlider = () => { const v = Math.round(App.bgOpacity() * 100); return `<div class="field bgop"><label>Opacité du fond de plan</label><div class="range"><input type="range" min="5" max="100" step="1" value="${v}" data-live="bgop" aria-label="Opacité du fond de plan"><span data-bgop-v>${v} %</span></div></div>`; };
  /* ---------- placement ---------- */
  ui.placeLib = (it) => {
    const c = App.s2w({ x: App.viewSize().W / 2, y: (App.viewSize().H - ui.obstruction().bottom) / 2 });
    const w = it.w * 10, d = it.d * 10; let pts;
    if (it.shape === 'L') { const t = (it.t || 60) * 10; pts = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: t }, { x: t, y: t }, { x: t, y: d }, { x: 0, y: d }].map((p) => ({ x: p.x + c.x - w / 2, y: p.y + c.y - d / 2 })); }
    else pts = G.rect(c.x - w / 2, c.y - d / 2, w, d);
    const kind = it.kind || 'meuble';
    const s = App.makeShape(kind, pts, Object.assign({ name: it.name, lib: it.id, round: !!it.round, noParquet: !!it.noParquet }, it.h ? { h: it.h } : {}));
    if (kind !== 'meuble') s.locks = PL.solver.syncLocks(s.pts, s.pts.map(() => ({ L: true, A: true })));
    App.mutate((P) => P.shapes.push(s)); S.sel = { id: s.id };
    if (kind === 'meuble' && S.mode !== 'mobilier' && !S.layers.mobilier) S.layers.mobilier = true;
    ui.onSelect(); App.toast(kind === 'meuble' ? 'Glissez le meuble : il se colle aux murs et se centre' : 'Glissez l\'objet pour le placer');
  };
  ui.placeElec = (w) => {
    const type = S.elecType || 'prise'; const r = App.placeOnWall(w, type);
    App.mutate((P) => P.points.push({ id: App.uid(), floor: P.floorId, kind: 'elec', type, x: r.x, y: r.y, rot: r.rot, h: PL.lib.elecDefaultH[type] ?? null, note: '' }));
  };

  /* ---------- édition rapide d'une cote sur le plan ---------- */
  ui.quickEdit = (h) => {
    const s = App.byId(h.id); if (!s) return; if (s.locked) { App.toast('Objet verrouillé'); return; }
    const m = PL.solver.measure(s.pts); const isA = h.t === 'angle';
    const cur = isA ? G.deg(m.A[h.i]) : m.L[h.i] / 10; const lk = s.locks[h.i] && (isA ? s.locks[h.i].A : s.locks[h.i].L);
    const pop = $('pop'); const n = s.pts.length;
    pop.innerHTML = `<label>${isA ? 'Angle en ' + String.fromCharCode(65 + h.i) : 'Mur ' + wallName(h.i, n)} — ${isA ? 'degrés' : 'centimètres'}</label>
      <div class="row"><input class="num" id="qv" inputmode="decimal" value="${fmt(cur, isA ? 2 : 1)}"><button class="lock" id="ql" aria-pressed="${lk ? 'true' : 'false'}" title="Verrouiller">${lk ? LOCK : UNLOCK}</button><button class="btn primary sm" id="qok">OK</button></div>`;
    pop.hidden = false; const r = $('stage').getBoundingClientRect();
    const x = Math.min(innerWidth - 260, Math.max(8, r.left + h.x - 110)), y = Math.min(innerHeight - 120, Math.max(60, r.top + h.y + 18));
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
    let lock = !!lk; const inp = $('qv'); setTimeout(() => { inp.focus(); inp.select(); }, 30);
    $('ql').onclick = () => { lock = !lock; $('ql').setAttribute('aria-pressed', lock); $('ql').innerHTML = lock ? LOCK : UNLOCK; };
    const ok = () => {
      const v = num(inp.value); pop.hidden = true; if (v == null) return;
      applyDim(s, h.i, isA ? 'A' : 'L', isA ? G.rad(v) : v * 10, lock);
    };
    $('qok').onclick = ok; inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') pop.hidden = true; };
    setTimeout(() => { const off = (e) => { if (!pop.contains(e.target)) { pop.hidden = true; document.removeEventListener('pointerdown', off, true); } }; document.addEventListener('pointerdown', off, true); }, 50);
  };

  function applyDim(s, i, t, v, lock) {
    const locks = s.locks.map((l) => Object.assign({}, l));
    if (t === 'L') { locks[i].L = false; } else { locks[i].A = false; }
    const r = PL.solver.solve(s.pts, locks, [{ t, i, v }]);
    if (!r.ok) { if (/verrou/i.test(r.msg)) resolveLocks(s, i, t, v, lock, locks); else App.toast(r.msg); return false; }
    App.mutate(() => {
      s.pts = r.pts; if (t === 'L') { s.locks[i].L = lock; } else { s.locks[i].A = lock; }
      s.locks = PL.solver.syncLocks(s.pts, s.locks);
      if (t === 'L' && lock) s.locks[i].Lv = v; if (t === 'A' && lock) s.locks[i].Av = v;
    });
    return true;
  }

  /* cote incompatible avec les verrous : proposer ce qui peut bouger (une autre cote, ou les angles) */
  async function resolveLocks(s, i, t, v, lock, locks) {
    const n = s.pts.length, m = PL.solver.measure(s.pts), nm = (j) => App.walls.name(s, j), opts = [];
    for (let j = 0; j < n; j++) {
      if (j === i || !locks[j].L) continue; const lk = locks.map((l) => Object.assign({}, l)); lk[j].L = false;
      const r = PL.solver.solve(s.pts, lk, [{ t, i, v }]); if (!r.ok) continue; const d = r.L[j] - m.L[j]; if (Math.abs(d) < 0.5) continue;
      opts.push({ k: 'L', j, d, r, label: `Mur ${nm(j)} : ${App.fmtCm(m.L[j])} → ${App.fmtCm(r.L[j])} cm` });
    }
    opts.sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
    // un seul mur hors d'équerre : on libère les angles à ses deux bouts (+ un voisin pour refermer exactement)
    const deg = (a) => a.toLocaleString('fr-FR', { maximumFractionDigits: 1 }), vx = (k) => String.fromCharCode(65 + (k % 26));
    const tilt = [];
    for (let w = 0; w < n; w++) {
      if (t === 'L' && w === i) continue; let best = null;
      for (const third of [(w + 2) % n, (w - 1 + n) % n]) {
        const free = [w, (w + 1) % n, third], lk = locks.map((l) => Object.assign({}, l)); free.forEach((k) => { lk[k].A = false; });
        const r = PL.solver.solve(s.pts, lk, [{ t, i, v }]); if (!r.ok) continue;
        if (r.L.some((x, k) => locks[k].L && k !== i && Math.abs(x - m.L[k]) > 0.5)) continue;
        const ch = r.A.map((a, k) => ({ k, a0: G.deg(m.A[k]), a1: G.deg(a) })).filter((c) => Math.abs(c.a1 - c.a0) > 0.02), mx = Math.max(0, ...ch.map((c) => Math.abs(c.a1 - c.a0)));
        if (ch.length && (!best || mx < best.mx)) best = { r, ch, mx };
      }
      if (best && best.mx < 5) { const main = best.ch.filter((c) => c.k === w || c.k === (w + 1) % n); tilt.push({ k: 'A', r: best.r, ch: best.ch, mx: best.mx, label: `Mur ${nm(w)} un peu hors d'équerre (${(main.length ? main : best.ch).map((c) => `${vx(c.k)} ${deg(c.a0)}° → ${deg(c.a1)}°`).join(', ')})` }); }
    }
    tilt.sort((a, b) => a.mx - b.mx); const seen = new Set();
    opts.push(...tilt.filter((o) => { const sig = o.ch.map((c) => c.k + ':' + c.a1.toFixed(1)).join('|'); if (seen.has(sig)) return false; seen.add(sig); return true; }).slice(0, 3));
    const lkA = locks.map((l) => Object.assign({}, l, { A: false })), rA = PL.solver.solve(s.pts, lkA, [{ t, i, v }]);
    if (rA.ok) { const ch = rA.A.map((a, k) => ({ k, a0: G.deg(m.A[k]), a1: G.deg(a) })).filter((c) => Math.abs(c.a1 - c.a0) > 0.05); if (ch.length) opts.push({ k: 'A', r: rA, ch, label: `Répartir sur tous les angles (${ch.length} coins, ${deg(Math.max(...ch.map((c) => Math.abs(c.a1 - c.a0))))}° au plus)` }); }
    const val = t === 'L' ? `${App.fmtCm(v)} cm` : `${G.deg(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}°`;
    if (!opts.length) { await ui.dialog('Cote incompatible', `<p>Avec toutes les autres cotes et tous les angles verrouillés, ${t === 'L' ? `le mur ${nm(i)}` : 'cet angle'} ne peut pas valoir ${val} : la pièce ne se refermerait pas. Déverrouillez au moins une cote ou un angle.</p>`, [{ label: 'Compris', cls: 'red', def: true }]); return; }
    const gap = opts.find((o) => o.k === 'L'); const shown = opts.filter((o) => o.k === 'A').concat(opts.filter((o) => o.k === 'L').slice(0, 4));
    const pick = await ui.dialog('Cote incompatible avec les verrous', `<p>${t === 'L' ? `Le mur ${nm(i)} à ${val}` : `Cet angle à ${val}`} ne colle pas avec les autres cotes verrouillées${gap ? ` : il y a un écart d'environ ${App.fmtCm(Math.abs(gap.d))} cm pour refermer la pièce` : ''}. Choisissez ce qui s'ajuste pour le garder :</p><p class="hint2">Si vos longueurs sont sûres, c'est souvent un mur un peu hors d'équerre (fréquent, même dans le neuf). Ce qui s'ajuste est déverrouillé, le reste garde vos mesures.</p>`, shown.map((o) => ({ label: o.label, cls: 'ghost wrap' })).concat([{ label: 'Annuler', cls: '' }]));
    const o = shown[pick.i]; if (!o) return;
    App.mutate(() => {
      s.pts = o.r.pts; const L = s.locks;
      if (o.k === 'L') L[o.j].L = false; else o.ch.forEach((c) => { L[c.k].A = false; });
      if (t === 'L') L[i].L = lock; else L[i].A = lock;
      s.locks = PL.solver.syncLocks(s.pts, L); if (t === 'L' && lock) s.locks[i].Lv = v; if (t === 'A' && lock) s.locks[i].Av = v;
    });
    App.toast(o.k === 'L' ? `${nm(i)} = ${val} · ${o.label.replace('Mur ', '')} (déverrouillée)` : `${nm(i)} = ${val} · ${o.label.replace(/ \(.*$/, '').toLowerCase()}`);
  }

  /* ---------- sélection ---------- */
  let lastSel = null;
  ui.onSelect = (again) => {
    const s = App.selected(); const sid = S.sel ? S.sel.id : null; if (sid !== lastSel) { S.editPts = false; if (S.resizeRoom !== sid) S.resizeRoom = null; lastSel = sid; } const ctxSel = S.sel && (S.sel.oid || S.sel.wall != null);
    const onPlan = s && ['meuble', 'poteau', 'forme'].includes(s.kind) && !ctxSel; // la barre flottante suffit : le plan reste dégagé
    if (s && !onPlan && innerWidth < 900 && $('sheet').dataset.h === 'min') ui.sheet('half');
    if (ctxSel) {
      let p = null; const f = App.ops.selected();
      if (S.sel.oid && f) { const g = App.ops.geo(f.room, f.o); p = g && g.mid; }
      else if (s && S.sel.wall != null) p = G.lerp(s.pts[S.sel.wall], s.pts[(S.sel.wall + 1) % s.pts.length], 0.5);
      if (p) { const q = App.w2s(p), ob = ui.obstruction(), vs = App.viewSize(); if (q.x < 30 || q.x > vs.W - 30 || q.y < ob.top + 60 || q.y > vs.H - ob.bottom - 70) setTimeout(() => App.ctx.focus(p), 60); }
    }
    ui.refresh();
  };
  ui.deleteSelected = async () => {
    if (S.sel && S.sel.oid) { App.ctx.act('del'); return; }
    if (S.sel && S.sel.wall != null) { App.toast('Pour supprimer une cloison : menu de la cloison › Supprimer la cloison'); return; }
    const s = App.selected(); if (!s) return; if (s.locked) { App.toast('Déverrouillez d\'abord cet objet'); return; }
    App.mutate((P) => { P.shapes = P.shapes.filter((x) => x.id !== s.id); P.points = P.points.filter((x) => x.id !== s.id); P.measures = P.measures.filter((x) => x.id !== s.id); P.shapes.forEach((r) => (r.openings || []).forEach((o) => { if (o.to === s.id) o.to = null; })); });
    S.sel = null; ui.refresh(); App.toast('Supprimé — Annuler pour revenir');
  };
  ui.cutSelected = (a, b) => {
    const s = App.selected(); if (!s || !s.pts || s.kind !== 'piece') { App.toast('Sélectionnez d\'abord une pièce'); ui.setTool('select'); return; }
    const ct = document.getElementById('cutThick'); if (ct) S.cutThick = num(ct.value) ?? 0;
    const r = App.feat.partition(s, a, b, (S.cutThick ?? 7) * 10);
    if (!r) { App.toast('La ligne doit traverser la pièce de part en part'); return; }
    S.sel = { id: r[0].id }; ui.setTool('select'); App.toast((S.cutThick ?? 7) > 0 ? 'Cloison ajoutée : deux pièces' : 'Pièce coupée en deux');
  };

  /* ---------- calibration d'un fond ---------- */
  ui.calibrate = async (a, b) => {
    const cur = G.dist(a, b) / 10;
    const r = await ui.dialog('Étalonner le fond de plan', `<p>Distance mesurée : ${fmt(cur)} cm. Indiquez la vraie valeur (une cote écrite sur le plan, par exemple).</p><div class="field"><label>Distance réelle</label><div class="unit"><input name="v" inputmode="decimal" value="${fmt(cur)}"><span>cm</span></div></div>`, [{ label: 'Annuler', cls: 'ghost' }, { label: 'Appliquer', cls: 'primary', def: true }]);
    ui.setTool('select'); if (r.i !== 1) return; const v = num(r.vals.v); if (!v) return;
    App.importer.rescale((v * 10) / G.dist(a, b), a);
  };

  /* ---------- rendu des onglets et panneaux ---------- */
  ui.refresh = (force) => {
    if (!S.p) return;
    $('projName').textContent = S.p.name || 'Projet';
    $('floors').innerHTML = S.p.floors.slice().sort((a, b) => a.level - b.level).map((f) => `<button data-f="${f.id}" aria-pressed="${f.id === S.p.floorId}">${esc(f.name)}</button>`).join('');
    $('floors').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) ui.switchFloor(b.dataset.f); };
    $('undo').disabled = !App.canUndo(); $('redo').disabled = !App.canRedo(); ui.saveBadge();
    document.querySelectorAll('#modes [data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === S.mode));
    document.querySelectorAll('#rail [data-tool]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === S.tool || (b.dataset.tool === 'measure' && S.tool === 'calib')));
    const sel = App.selected(); const rooms = App.rooms();
    $('rnName').textContent = sel && sel.kind === 'piece' ? sel.name || 'Pièce' : rooms.length + ' pièce' + (rooms.length > 1 ? 's' : '');
    $('tabs').innerHTML = TABS.map(([k, v, sh]) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}"><span class="${sh ? 'tl hasS' : 'tl'}">${v}</span>${sh ? `<span class="ts">${sh}</span>` : ''}</button>`).join('');
    if (App.ctx) App.ctx.renderOpbar();
    const panel = $('panel'); const ae = document.activeElement;
    if (!force && ae && panel.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && ae.type !== 'checkbox' && ae.type !== 'file') { pendingPanel = true; return; }
    renderPanel();
  };
  let pendingPanel = false;
  document.addEventListener('focusout', () => { if (pendingPanel) setTimeout(() => { const ae = document.activeElement; if (!(ae && $('panel').contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName))) { pendingPanel = false; renderPanel(); } }, 0); });

  ui.switchFloor = (id) => {
    if (id === S.p.floorId) return; dropPending(); if (App.sketch) App.sketch.cancel(true); const prev = App.floorBBox();
    S.p.floorId = id; S.sel = null; S.draft = null; S.step = null; S.optRes = null; App.save();
    const bb = App.floorBBox(); const vw = App.s2w({ x: App.viewSize().W / 2, y: App.viewSize().H / 2 });
    if (!bb || !(vw.x > bb.x0 - 2000 && vw.x < bb.x1 + 2000 && vw.y > bb.y0 - 2000 && vw.y < bb.y1 + 2000)) App.fitAll();
    App.importer && App.importer.ensureBg(id);
    const cv = $('cv'); cv.style.transition = 'none'; cv.style.opacity = 0.35; requestAnimationFrame(() => { cv.style.transition = 'opacity .18s'; cv.style.opacity = 1; });
    ui.refresh(); App.render();
  };

  function renderPanel() {
    const panel = $('panel'); const sel = App.selected();
    let html = '';
    if (sel && S.sel.oid && App.ops.selected()) html = App.ctx.inspOpening();
    else if (sel && S.sel.wall != null && sel.pts && S.sel.wall < sel.pts.length) html = App.ctx.inspWall();
    else if (sel) html = inspector(sel);
    else if (S.tab === 'pieces') html = panelPieces();
    else if (S.tab === 'calepinage') html = panelCal();
    else if (S.tab === 'mobilier') html = panelMob();
    else if (S.tab === 'elec') html = panelElec();
    else if (S.tab === 'import') html = App.importer.panel();
    else if (S.tab === 'projet') html = panelProjet();
    panel.innerHTML = html;
    if (S.tab === 'elec' && !sel) drawElecTiles();
    if (S.tab === 'import' && !sel) App.importer.bind(panel);
  }
  ui.renderPanel = renderPanel;

  /* ----- Plan ----- */
  function panelPieces() {
    const f = App.floor(); const shapes = App.shapesOn(); const rooms = App.rooms();
    const total = rooms.reduce((s, r) => s + Math.abs(G.area(r.pts)), 0);
    const others = shapes.filter((s) => s.kind !== 'piece' && s.kind !== 'meuble');
    const meubles = shapes.filter((s) => s.kind === 'meuble');
    if (!shapes.length) return `<div class="empty"><h2>${esc(f.name)}</h2><p class="lead">Aucune pièce sur cet étage pour l'instant.</p>
      <div class="row" style="margin:14px 0"><button class="btn primary" data-a="tab" data-v="import">Importer un plan</button><button class="btn" data-a="addRect">Pièce rectangulaire</button><button class="btn" data-a="draw">Tracer</button></div>
      <p class="note">PDF d'architecte, export magicplan (DXF, SVG, PDF, image) : les pièces, les cotes et les escaliers sont détectés automatiquement.</p></div>`;
    return `<h2>${esc(f.name)}</h2><p class="lead">${rooms.length} pièce${rooms.length > 1 ? 's' : ''} · ${App.fmtM2(total)} m² au sol</p>
      <div class="row" style="margin:4px 0 14px"><button class="btn sm" data-a="addRect">+ Pièce</button><button class="btn sm" data-a="draw">Tracer</button><button class="btn sm" data-a="addLib" data-v="poteau20">+ Poteau</button><button class="btn sm" data-a="addLib" data-v="tremie">+ Zone sans parquet</button><button class="btn sm" data-a="drawKind" data-v="plafond">+ Plafond bas</button></div>
      ${S.bgs[S.p.floorId] && S.layers.fond ? ui.bgSlider() : ''}
      ${(() => { const sp = App.walls.spots(), ig = App.walls.ignoredCount(); if (!sp.length && !ig) return ''; const cm = (v) => App.fmtCm(v, 0);
        return `<div class="preview simp"><b>${sp.length ? `${sp.length} décrochement${sp.length > 1 ? 's' : ''} à simplifier` : 'Décrochements'}</b>${sp.length ? ' — petits creux dans les murs (embrasures, châssis lus comme des murs). Repérés en rouge sur le plan.' : ''}
          ${sp.slice(0, 12).map((x) => `<div class="simprow${S.simpFocus === x.key ? ' on' : ''}"><button class="link" data-x="simpgo" data-v="${esc(x.key)}"><b>${esc(x.name)}</b> · mur ${x.wall} · creux de ${cm(x.depth)} cm${x.width > 1 ? ` sur ${cm(x.width)} cm` : ''}</button><span><button class="btn sm ghost" data-x="simpign" data-v="${esc(x.key)}">Ignorer</button><button class="btn sm red" data-x="simpok" data-v="${esc(x.key)}">Simplifier</button></span></div>`).join('')}
          <div class="row" style="margin-top:8px">${sp.length > 1 ? '<button class="btn sm" data-x="fixall">Tout simplifier</button>' : ''}${ig ? `<button class="btn sm ghost" data-x="simpreset">Reproposer les ignorés (${ig} pièce${ig > 1 ? 's' : ''})</button>` : ''}</div></div>`; })()}
      <div class="field" style="border-top:1px solid var(--ink)"><label>Hauteur sous plafond de l'étage</label><div class="unit"><input data-c="fceil" inputmode="decimal" value="${f.ceiling || 250}"><span>cm</span></div></div>
      <div class="list" style="margin-top:14px">${rooms.map((r) => `<button class="item" data-a="sel" data-v="${r.id}"><span class="nm">${esc(r.name || 'Pièce')}</span>${r.parquet === false ? '<span class="tag">sans parquet</span>' : ''}${r.locked ? '<span class="tag">verrouillée</span>' : ''}<span class="v">${App.fmtM2(Math.abs(G.area(r.pts)))}<small style="font-size:12px"> m²</small></span></button>`).join('')}</div>
      ${others.length ? `<h3>Escaliers, poteaux et zones</h3><div class="list">${others.map((r) => `<button class="item" data-a="sel" data-v="${r.id}"><span class="nm">${esc(r.name || KIND[r.kind])}</span><span class="meta">${KIND[r.kind]}${r.kind === 'escalier' && r.stair ? ' · ' + (r.stair.dir === 'descend' ? 'descend' : 'monte') : ''}</span></button>`).join('')}</div>` : ''}
      ${meubles.length ? `<h3>Mobilier</h3><p>${meubles.length} élément${meubles.length > 1 ? 's' : ''} — onglet Mobilier.</p>` : ''}
      <h3>Mesures</h3>${App.measuresOn().length ? `<div class="list">${App.measuresOn().map((m, i) => `<button class="item" data-a="sel" data-v="${m.id}"><span class="nm">${esc(m.label || 'Mesure ' + (i + 1))}</span><span class="v">${App.fmtCm(G.dist(m.a, m.b))}<small style="font-size:12px"> cm</small></span></button>`).join('')}</div>` : '<p>Outil Règle : glissez entre deux points du plan pour mesurer au millimètre, avec aimantation sur les angles et les murs.</p>'}`;
  }

  /* ----- Inspecteur ----- */
  function inspector(s) {
    const back = `<button class="link" data-a="back" style="margin-bottom:10px">← ${S.tab === 'pieces' ? 'Toutes les pièces' : 'Retour'}</button>`;
    if (s.kind === 'elec') return back + inspElec(s);
    if (s.a && s.b) return back + inspMeasure(s);
    const n = s.pts.length, m = PL.solver.measure(s.pts), area = Math.abs(G.area(s.pts));
    let h = back + `<div class="field" style="border-top:1px solid var(--ink)"><label>Nom</label><input data-live="name" data-c="name" value="${esc(s.name || '')}"></div>
      <div class="field"><label>Type</label><select data-c="kind">${Object.entries(KIND).map(([k, v]) => `<option value="${k}" ${s.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="kpis"><div><b>${App.fmtM2(area)}</b><span>m² au sol</span></div><div><b>${fmt(G.perimeter(s.pts) / 1000, 2)}</b><span>m de périmètre</span></div><div><b>${n}</b><span>côtés</span></div></div>
      <div class="row"><button class="btn sm ${s.locked ? 'primary' : ''}" data-a="lockpos">${s.locked ? 'Verrouillé sur le plan' : 'Verrouiller sur le plan'}</button><button class="btn sm" data-a="zoom">Zoomer</button>${s.kind === 'piece' && !s.locked ? `<button class="btn sm ${S.resizeRoom === s.id ? 'primary' : ''}" data-x="rsz">Redimensionner</button>` : ''}<button class="btn sm" data-a="dup">Dupliquer</button><button class="btn sm ghost" data-a="del">Supprimer</button></div>`;
    if (s.kind === 'piece') {
      const hab = App.feat.habitable(s); const nb = App.feat.neighbours(s);
      if (hab.low > 0) h += `<p style="margin-top:10px">Surface à plus de 1,80 m : <b style="color:var(--ink)">${App.fmtM2(hab.SH)} m²</b>${s.areaSH ? ' (plan : ' + s.areaSH.toLocaleString('fr-FR') + ' m²)' : ''}</p>`;
      h += `<div class="field" style="margin-top:10px"><label>Parquet dans cette pièce</label><input type="checkbox" data-c="parquet" ${s.parquet !== false ? 'checked' : ''}></div>
        <div class="field"><label>Hauteur sous plafond</label><div class="unit"><input data-c="ceil" inputmode="decimal" placeholder="${App.feat.ceiling(Object.assign({}, s, { ceiling: null }))}" value="${s.ceiling || ''}"><span>cm</span></div></div>
        <h3>Transformer</h3><div class="row"><button class="btn sm" data-a="cut">Ajouter une cloison</button>${nb.length ? `<select id="mergeWith" style="height:36px;border:1px solid var(--rule);background:var(--paper);padding:0 8px">${nb.map((r) => `<option value="${r.id}">${esc(r.name || 'Pièce')}</option>`).join('')}</select><button class="btn sm" data-a="merge">Fusionner</button>` : ''}</div>
        ${(() => { const st = App.stairs.stairsTouching(s).filter(() => Math.abs(G.area(s.pts)) < 8e6); return st.length ? `<div class="preview"><b>Partie d'escalier ?</b> Cette pièce touche ${esc(st[0].name || 'l\'escalier')}. Si c'est son palier ou ses marches tournantes, réunissez-les.<div class="row" style="margin-top:8px"><button class="btn sm red" data-x="stjoin2" data-v="${st[0].id}">Assembler à l'escalier</button></div></div>` : ''; })()}
        <p>Touchez un mur sur le plan (ou son nom ci-dessous) pour passer en mode cloison : verrou, longueur, déplacement avec aperçu avant validation.</p>`;
    }
    if (s.kind === 'plafond') h += `<h3>Hauteur</h3><div class="field"><label>Hauteur basse (pied-droit)</label><div class="unit"><input data-c="hmin" inputmode="decimal" value="${s.hmin ?? ''}"><span>cm</span></div></div><div class="field"><label>Hauteur haute</label><div class="unit"><input data-c="hmax" inputmode="decimal" value="${s.hmax ?? 180}"><span>cm</span></div></div><p>Sous 180 cm, la surface n'est pas comptée comme habitable ; le parquet, lui, se pose dessous.</p>`;
    if (s.kind === 'meuble') h += furnitureDims(s);
    if (s.kind === 'escalier') { const cands = App.stairs.candidates(s); const cur = App.stairs.current(s); const opt = (sh, sd, lbl) => `<button data-x="stshape" data-v="${sh}${sd ? ':' + sd : ''}" aria-pressed="${!!cur && cur.shape === sh && (!sd || cur.side === sd)}">${lbl}</button>`;
      h += `<h3>Forme</h3><p style="color:var(--ink);font-weight:700;margin:0 0 6px">${esc(App.stairs.kindName(s))}</p><div class="chips">${opt('droit', null, 'Droit')}${opt('L', 'g', 'En L à gauche')}${opt('L', 'd', 'En L à droite')}${opt('U', 'g', 'En U à gauche')}${opt('U', 'd', 'En U à droite')}</div>${(() => { const U = cur && cur.shape === 'U' && App.stairs.well(s); return U ? `<div class="field"><label>Jour (vide entre les volées)</label><div class="unit"><input data-xc="stjour" inputmode="decimal" value="${fmt(U.jour / 10)}"><span>cm</span></div></div><div class="field"><label>Longueur du mur central</label><div class="unit"><input data-xc="stwall" inputmode="decimal" value="${fmt(U.wall / 10)}"><span>cm</span></div></div>` : ''; })()}<p class="hint2">Le départ, la largeur et le nombre de marches sont gardés ; ajustez ensuite avec le cadre. Les points rouges pleins règlent le mur central (jour et longueur). « À gauche » : on tourne à gauche en montant.</p><div class="row"><button class="btn sm" data-x="stflip">Inverser départ / arrivée</button></div>${cands.length ? `<div class="preview"><b>Assembler</b> — une partie de l'escalier a été lue comme une pièce à part ? Réunissez-les : la forme (droite, en L ou en U) et les marches tournantes sont recalculées.<div class="row" style="margin-top:8px;flex-wrap:wrap">${cands.map((o) => `<button class="btn sm red" data-x="stjoin" data-v="${o.id}">Avec ${esc(o.name || (o.kind === 'escalier' ? 'l\'escalier' : 'la pièce'))} (${App.fmtM2(Math.abs(G.area(o.pts)))} m²)</button>`).join('')}</div></div>` : ''}<p class="hint2">Le rond marque le départ, la flèche l'arrivée ; les marches sont réparties sur la ligne de foulée et tournent dans les angles.</p>`; }
    if (s.kind === 'poteau') h += `<h3>Hauteur</h3><div class="field"><label>Hauteur</label><div class="unit"><input data-c="sh" inputmode="decimal" placeholder="jusqu'au plafond" value="${s.h || ''}"><span>cm</span></div></div><div class="chips sm">${[90, 100, 110, 120].map((v) => `<button data-a="shq" data-v="${v}" aria-pressed="${s.h === v}">${v}</button>`).join('')}<button data-a="shq" data-v="0" aria-pressed="${!s.h}">Plafond</button></div><p class="hint2">Une hauteur fait un muret ou une cloison basse (le parquet passe autour, la visite 3D l'élève à cette hauteur).</p>`;
    if (s.kind === 'escalier') h += `<h3>Escalier</h3><div class="seg"><button data-a="stairdir" data-v="monte" aria-pressed="${!(s.stair && s.stair.dir === 'descend')}">Monte depuis cet étage</button><button data-a="stairdir" data-v="descend" aria-pressed="${!!(s.stair && s.stair.dir === 'descend')}">Descend (trémie)</button></div><div class="field"><label>Nombre de marches</label><input data-c="steps" inputmode="numeric" value="${(s.stair && s.stair.steps) || ''}"></div>${s.stair && s.stair.dir === 'descend' ? (() => { const gd = App.stairs.guard(s), n = App.stairs.openEdges(s).length; return `<h3>Garde-corps de la trémie</h3><div class="chips">${Object.entries(App.stairs.GUARDS).map(([k, v]) => `<button data-a="guard" data-v="${k}" aria-pressed="${gd.type === k}">${v}</button>`).join('')}</div>${gd.type !== 'aucun' ? `<div class="field"><label>Hauteur</label><div class="unit"><input data-c="guardH" inputmode="decimal" value="${gd.h / 10}"><span>cm</span></div></div>` : ''}${gd.type === 'plein' ? `<div class="field"><label>Épaisseur du muret</label><div class="unit"><input data-c="guardT" inputmode="decimal" value="${gd.th / 10}"><span>cm</span></div></div>` : ''}<p class="hint2">${n ? `Sur ${n} bord${n > 1 ? 's' : ''} de la trémie qui ne longe${n > 1 ? 'nt' : ''} pas un mur.` : 'Tous les bords longent un mur : rien à poser.'} Visible dans la visite 3D.</p>`; })() : ''}`;
    if (s.kind !== 'piece' && s.kind !== 'elec' && s.pts && s.pts.length >= 3) h += `<h3>Taille</h3><div class="row"><button class="btn sm" data-x="fitwalls">Caler aux murs</button></div><div class="field"><label>Aimanter aux murs en redimensionnant</label><input type="checkbox" data-x="snapwalls" ${S.p.snapWalls !== false ? 'checked' : ''}></div><p class="hint2">Avec le cadre, le bord qui bouge se colle à la cloison la plus proche. « Caler aux murs » met d'un coup chaque côté contre la cloison voisine (à moins de 40 cm).</p>`;
    if (s.kind !== 'piece' && s.kind !== 'escalier') h += `<h3>Rotation</h3><div class="row"><button class="btn sm" data-a="rot" data-v="-90">−90°</button><button class="btn sm" data-a="rot" data-v="-15">−15°</button><button class="btn sm" data-a="rot" data-v="15">+15°</button><button class="btn sm" data-a="rot" data-v="90">+90°</button><button class="btn sm" data-a="mirror">Miroir</button>${s.kind === 'meuble' && s.pts.length >= 4 ? '<button class="btn sm" data-x="backwall">Dos au mur</button>' : ''}</div>${s.kind === 'meuble' ? '<p class="hint2">Glissez le meuble : il se colle aux murs et aux autres meubles, et se centre sur la cloison, la fenêtre ou entre deux murs. Les distances libres s\'affichent autour.</p>' : ''}`;
    // cotes
    h += `<h3>Cotes et angles</h3><p>Touchez une valeur pour la modifier. Verrouillez les cotes mesurées : les autres s'ajustent pour fermer la forme.</p>
      <table class="dims"><thead><tr><th>Mur</th><th>Longueur (cm)</th><th></th><th>Angle (°)</th><th></th><th></th></tr></thead><tbody>
      ${s.pts.map((_, i) => { const lk = s.locks[i] || {}; return `<tr><td>${s.kind === 'piece' ? `<button class="wname${lk.P ? ' lk' : ''}" data-x="wsel" data-v="${i}" title="Sélectionner ce mur">${wallName(i, n)}</button>` : wallName(i, n)}</td><td><input data-c="L" data-i="${i}" inputmode="decimal" value="${fmt(m.L[i] / 10)}" ${s.locked ? 'disabled' : ''}></td><td><button class="lock" data-a="lockL" data-i="${i}" aria-pressed="${!!lk.L}" title="Verrouiller la longueur">${lk.L ? LOCK : UNLOCK}</button></td><td><input data-c="A" data-i="${i}" inputmode="decimal" value="${fmt(G.deg(m.A[i]), 2)}" ${s.locked ? 'disabled' : ''}></td><td><button class="lock" data-a="lockA" data-i="${i}" aria-pressed="${!!lk.A}" title="Verrouiller l'angle en ${String.fromCharCode(65 + i)}">${lk.A ? LOCK : UNLOCK}</button></td><td><button class="lock" data-a="split" data-i="${i}" title="Ajouter un point au milieu du mur">+</button></td></tr>`; }).join('')}
      </tbody></table>
      <div class="row" style="margin-top:10px"><button class="btn sm" data-a="lockAll">Tout verrouiller</button><button class="btn sm" data-a="unlockAll">Tout déverrouiller</button><button class="btn sm" data-a="square">Mettre d'équerre</button>${n > 3 ? '<button class="btn sm" data-a="delv">Retirer un point…</button>' : ''}</div>`;
    if (s.kind === 'piece') h += openingsUI(s) + calUI(s);
    return h;
  }

  function furnitureDims(s) {
    if (s.pts.length !== 4) return '';
    const w = G.dist(s.pts[0], s.pts[1]), d = G.dist(s.pts[1], s.pts[2]);
    return `<h3>Dimensions</h3><div class="field"><label>Largeur</label><div class="unit"><input data-c="fw" inputmode="decimal" value="${fmt(w / 10)}"><span>cm</span></div></div><div class="field"><label>Profondeur</label><div class="unit"><input data-c="fd" inputmode="decimal" value="${fmt(d / 10)}"><span>cm</span></div></div>
      <div class="field"><label>Pas de parquet dessous</label><input type="checkbox" data-c="noParquet" ${s.noParquet ? 'checked' : ''}></div>`;
  }

  function openingsUI(s) {
    const ops = (s.openings || []).filter((o) => o.sw !== 0 || !App.ops.twin(s, o) || true);
    const seen = new Set(); const items = [];
    for (const o of ops) { const pr = App.ops.primary(s, o); if (seen.has(pr.o.oid)) continue; seen.add(pr.o.oid); items.push({ o, pr }); }
    return `<h3>Portes et fenêtres</h3>${items.length ? `<div class="list">${items.map(({ o, pr }) => `<button class="item" data-x="opsel" data-v="${pr.o.oid}"><span class="nm">${esc(App.ops.name(o.type))}</span><span class="meta">${esc(App.ops.describe(s, o))}</span><span class="v">${App.fmtCm(o.width, 0)}<small style="font-size:12px"> cm</small></span></button>`).join('')}</div>` : '<p>Aucune ouverture.</p>'}
      <div class="row" style="margin-top:10px"><button class="btn sm" data-x="optool">+ Ajouter sur le plan</button></div>
      <p class="hint2">Touchez une porte sur le plan pour l'inverser, changer ses gonds ou la supprimer.</p>`;
  }

  function calUI(s) {
    const n = s.pts.length; const c = s.cal || {};
    const groups = ['', 'A', 'B', 'C', 'D'];
    const res = (App.calepinage().results || {})[s.id];
    const gi = res && res.gapInfo, gapLine = res ? `<div class="kv"><span>Jeu au mur</span><b>${res.gap} mm</b></div>${gi ? `<p class="hint2">${res.groupSize > 1 ? 'Zone posée d\'un tenant' : 'Pièce'} de ${App.fmtM ? App.fmtM(gi.along) : (gi.along / 1000).toFixed(2).replace('.', ',')} × ${App.fmtM ? App.fmtM(gi.across) : (gi.across / 1000).toFixed(2).replace('.', ',')} m : ${gi.gap > S.p.parquet.gapMin ? `${String(S.p.parquet.gapPerM).replace('.', ',')} mm × ${(Math.max(gi.along, gi.across) / 1000).toFixed(1).replace('.', ',')} m` : 'le minimum suffit'}.</p>` : ''}` : '';
    const ph = res && res.phase, leadRoom = res && !res.lead ? App.rooms(s.floor).find((r) => { const x = App.calepinage().results[r.id]; return x && x.group === res.group && x.lead; }) || s : s, fr = ((leadRoom && leadRoom.cal) || {}).first;
    const where = (w) => { if (!w) return ''; let best = null; for (const r of App.rooms(s.floor)) r.pts.forEach((p, i) => { const d = G.distPointSeg(w, p, r.pts[(i + 1) % r.pts.length]); if (!best || d < best.d) best = { d, r, i }; }); return best ? ` le long du mur ${wallName(best.i, best.r.pts.length)}${best.r.id !== s.id ? ' (' + esc(best.r.name || 'pièce voisine') + ')' : ''}` : ''; };
    const firstRow = res && res.rows && res.rows[0], fw = firstRow ? Math.round(firstRow.ripMax || 0) : 0;
    const phaseLine = ph ? `<div class="field"><label>Premier rang</label><div class="seg sm"><button data-a="firstrow" data-v="auto" aria-pressed="${fr !== 'full'}">Équilibré</button><button data-a="firstrow" data-v="full" aria-pressed="${fr === 'full'}">Lame entière</button></div></div>
      <p class="hint2">${ph.aligned && !ph.forced ? 'Départ en lame entière : aucune bande trop fine ailleurs.' : ph.forced ? `Départ en lame entière imposé : il reste une bande de <b>${ph.fullMin} mm</b>${where(ph.at)}, fragile et difficile à clipser (moins d'un tiers de lame, ${ph.good} mm).` : `Premier rang délignée${fw && fw < S.p.parquet.W - 1 ? ' à ' + fw + ' mm' : ''} : en partant d'une lame entière, il resterait une bande de <b>${ph.fullMin} mm</b>${where(ph.at)}. Les rangs sont décalés pour que la plus fine fasse ${ph.chosenMin} mm.`}${res.groupSize > 1 && !res.lead ? ' Réglage commun à la zone posée d\'un tenant : il se fait sur la pièce de départ.' : ''}</p>` : '';
    return `<h3>Calepinage de cette pièce</h3>${gapLine}${phaseLine}
      <div class="field"><label>Sens des lames</label><select data-c="cal.dir"><option value="auto" ${c.dir == null || c.dir === 'auto' ? 'selected' : ''}>Automatique${res ? ' (' + fmt(((G.deg(res.ang) % 180) + 180) % 180, 0) + '°)' : ''}</option>${s.pts.map((p, i) => { const q = s.pts[(i + 1) % n]; let a = ((G.deg(Math.atan2(q.y - p.y, q.x - p.x)) % 180) + 180) % 180; return `<option value="${a.toFixed(3)}" ${c.dir != null && c.dir !== 'auto' && Math.abs(+c.dir - a) < 0.01 ? 'selected' : ''}>Parallèle au mur ${wallName(i, n)}</option>`; }).join('')}</select></div>
      <div class="field"><label>Mur de départ</label><select data-c="cal.start"><option value="auto">Automatique</option>${s.pts.map((_, i) => `<option value="${i}" ${String(c.start) === String(i) ? 'selected' : ''}>${wallName(i, n)}</option>`).join('')}</select></div>
      <div class="field"><label>Pose continue avec</label><select data-c="cal.group">${groups.map((g) => `<option value="${g}" ${(c.group || '') === g ? 'selected' : ''}>${g ? 'Groupe ' + g : 'Pièce indépendante'}</option>`).join('')}</select></div>
      <p>Les pièces d'un même groupe partagent le sens des lames et l'alignement des rangs, pour une pose continue sous les portes.</p>
      <button class="btn sm" data-a="seeCal">Voir le calepinage</button>`;
  }

  function inspElec(p) {
    const types = PL.lib.elec;
    return `<h2>${esc((types.find((t) => t.id === p.type) || {}).name || 'Point')}</h2>
      <div class="field" style="border-top:1px solid var(--ink)"><label>Type</label><select data-c="p.type">${types.map((t) => `<option value="${t.id}" ${p.type === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>
      <div class="field"><label>Hauteur</label><div class="unit"><input data-c="p.h" inputmode="decimal" value="${p.h != null ? p.h : ''}"><span>cm du sol</span></div></div>
      <div class="field"><label>Note</label><input data-c="p.note" value="${esc(p.note || '')}" placeholder="circuit, usage…"></div>
      <div class="row" style="margin-top:12px"><button class="btn sm" data-a="prot">Pivoter</button><button class="btn sm ${p.locked ? 'primary' : ''}" data-a="lockpos">${p.locked ? 'Verrouillé' : 'Verrouiller'}</button><button class="btn sm" data-a="pdup">Dupliquer</button><button class="btn sm ghost" data-a="del">Supprimer</button></div>
      <p class="note">Faites glisser le symbole sélectionné pour le déplacer : il se cale sur le mur le plus proche.</p>`;
  }
  function inspMeasure(m) {
    const L = G.dist(m.a, m.b); const ang = ((G.deg(Math.atan2(m.b.y - m.a.y, m.b.x - m.a.x)) % 180) + 180) % 180;
    return `<div class="big">${App.fmtCm(L)}<small>cm</small></div><p>${fmt(L, 0)} mm · ${fmt(ang, 1)}°</p>
      <div class="field" style="border-top:1px solid var(--ink)"><label>Libellé</label><input data-c="m.label" value="${esc(m.label || '')}" placeholder="ex. niche, radiateur…"></div>
      <div class="row" style="margin-top:12px"><button class="btn sm" data-a="mtool">Nouvelle mesure</button><button class="btn sm ghost" data-a="del">Supprimer</button></div>
      <p class="note">Faites glisser une extrémité de la cote sélectionnée pour l'ajuster ; elle s'aimante sur les angles et les murs.</p>`;
  }

  /* ----- Calepinage ----- */
  function stepView() {
    const st = S.step, r = App.byId(st.id), cal = App.calepinage(), res = cal.results[st.id], P = S.p.parquet;
    if (!r || !res) { S.step = null; return panelCal(); }
    const row = res.rows[st.row - 1]; const rip = row.ripMax < P.W - 0.5;
    const pcs = row.runs.flatMap((ru, k) => ru.pieces.map((pc, i) => ({ ...pc, run: k, first: i === 0, last: i === ru.pieces.length - 1 })));
    const chip = (pc) => `<div style="flex:none;border:1px solid ${pc.kind === 'cut' ? 'var(--red)' : 'var(--ink)'};padding:8px 10px;min-width:74px;background:${pc.kind === 'cut' ? 'color-mix(in srgb,var(--red) 8%,var(--paper))' : 'var(--paper)'}"><div style="font-size:12px;font-weight:700;margin-bottom:4px">n° ${pc.n}</div><div style="font-weight:200;font-size:26px;line-height:1;letter-spacing:-.02em;color:${pc.kind === 'cut' ? 'var(--red)' : 'var(--ink)'}">${Math.round(pc.len)}</div><div style="font-size:11px;color:var(--ink-2);margin-top:4px">${pc.kind === 'full' ? 'entière' : pc.src === 'chute' ? (pc.fromN ? 'chute de la n° ' + pc.fromN : 'chute du rang ' + (pc.from || '?')) : 'à couper'}</div></div>`;
    const keeps = pcs.filter((pc) => pc.rest > 0).map((pc) => Math.round(pc.rest));
    return `<button class="link" data-a="stepEnd">← Fin du pas à pas</button>
      <h2 style="margin-top:10px">${esc(r.name || 'Pièce')}</h2><p class="lead">Rang ${row.num}${pcs.length ? ` · lames ${Math.min(...pcs.map((x) => x.n))} à ${Math.max(...pcs.map((x) => x.n))}` : ''}${row.num === 1 ? ' — le long du mur de départ' : row.back ? ' — derrière le mur de départ, à poser à rebours' : ''}<br><span style="font-size:13px;color:var(--ink-2)">${st.row} / ${res.rows.length} dans cette pièce</span></p>
      <div class="kpis" style="grid-template-columns:1fr 1fr"><div><b style="${rip ? 'color:var(--red)' : ''}">${rip ? Math.round(row.ripMax) : P.W}</b><span>${rip ? 'mm : lames délignées' + (row.ripMax - row.ripMin > 2 ? ' en biais (' + Math.round(row.ripMin) + '–' + Math.round(row.ripMax) + ')' : '') : 'mm : largeur entière'}</span></div><div><b>${pcs.length}</b><span>lames dans ce rang</span></div></div>
      <p style="margin:4px 0 8px">Dans l'ordre de pose, depuis l'angle de départ (longueurs en mm) :</p>
      <div class="pcs">${pcs.map(chip).join('<i>›</i>')}</div>
      ${keeps.length ? `<p class="note">Gardez ${pcs.filter((pc) => pc.rest > 0).map((pc) => Math.round(pc.rest) + ' mm (de la n° ' + pc.n + ')').join(' et ')} de chute pour un rang suivant.</p>` : ''}
      ${row.warn.length ? `<p class="note">${esc(row.warn.join(' ; '))}</p>` : ''}
      <div class="row" style="margin-top:14px"><button class="btn" data-a="stepGo" data-v="-1" ${st.row <= 1 ? 'disabled' : ''} style="flex:1">‹ Rang précédent</button><button class="btn primary" data-a="stepGo" data-v="1" ${st.row >= res.rows.length ? 'disabled' : ''} style="flex:1">Rang suivant ›</button></div>`;
  }
  function panelCal() {
    if (S.step) return stepView();
    const cal = App.calepinage(); const P = S.p.parquet; const rooms = App.rooms(); const t = cal.totals;
    const pr = (k, label, unit, step = 'any') => `<div class="field"><label>${label}</label><div class="unit"><input data-c="pq.${k}" inputmode="decimal" value="${P[k] ?? ''}"><span>${unit}</span></div></div>`;
    let h = `<h2>Calepinage · ${esc(App.floor().name)}</h2><p class="lead">${esc(P.name || 'Parquet')} — ${P.L} × ${P.W} mm, ${P.pattern === 'anglaise' ? 'pose à l\'anglaise' : P.pattern === 'pont12' ? 'pont de bateau ½' : 'pont de bateau ⅓'}</p>
      <div class="kpis"><div><b>${fmt(t.area, 1)}</b><span>m² de parquet</span></div><div><b>${t.boards}</b><span>lames entamées</span></div><div><b>${t.boxes ?? '—'}</b><span>paquets${t.perBox ? ' de ' + t.perBox : ''}</span></div></div>
      <p>${t.reused} chutes réemployées en début ou fin de rang. Estimation à la surface + ${P.waste} % : ${t.boardsArea} lames${t.boxesArea ? ' (' + t.boxesArea + ' paquets)' : ''}.</p>
      <div class="legend"><span><i style="background:var(--oak)"></i>Lame entière</span><span><i style="background:var(--oak);border-right:3px solid var(--red)"></i>Coupe (trait rouge)</span><span><i style="background:var(--oak-reuse)"></i>Chute réemployée</span><span style="color:var(--red);font-weight:600">↕ 73 mm</span><span>rang déligné</span></div>
      <p class="hint2"><b style="color:var(--ink)">Les numéros sur les lames</b> donnent l'ordre de pose : on part de la lame 1, dans l'angle du drapeau rouge « Départ », puis rang par rang (zoomez pour les voir). Sous le numéro, en rouge, la longueur à couper. Touchez une lame pour le détail, ou suivez le pas à pas rang par rang.</p>
      ${S.mode !== 'calepinage' ? '<button class="btn primary" data-a="mode" data-v="calepinage" style="margin:6px 0">Afficher les lames sur le plan</button>' : ''}
      <details ${S.pqOpen ? 'open' : ''} data-d="pq"><summary>Référence du parquet</summary>
        <div class="field"><label>Référence</label><select data-c="pq.ref"><option value="">Personnalisée</option>${PL.lib.parquets.map((q) => `<option value="${q.id}" ${P.ref === q.id ? 'selected' : ''}>${esc(q.short || q.name)}</option>`).join('')}</select></div>
        ${(() => { const q = PL.lib.parquets.find((x) => x.id === P.ref); return q ? `<p class="note">${esc(q.note)} · ${q.perBox} lames par paquet (${String(q.m2Box).replace('.', ',')} m²) · <a href="${q.url}" target="_blank" rel="noopener">fiche produit</a></p>` : ''; })()}
        <div class="field"><label>Nom</label><input data-c="pq.name" value="${esc(P.name || '')}"></div>
        ${pr('L', 'Longueur de lame', 'mm')}${pr('W', 'Largeur utile', 'mm')}${pr('T', 'Épaisseur', 'mm')}
        <div class="field"><label>Motif</label><select data-c="pq.pattern"><option value="anglaise" ${P.pattern === 'anglaise' ? 'selected' : ''}>À l'anglaise (coupe perdue)</option><option value="pont12" ${P.pattern === 'pont12' ? 'selected' : ''}>Pont de bateau ½</option><option value="pont13" ${P.pattern === 'pont13' ? 'selected' : ''}>Pont de bateau ⅓</option></select></div>
        <div class="field"><label>Pose</label><select data-c="pq.lay"><option value="flottante" ${P.lay === 'flottante' ? 'selected' : ''}>Flottante (clipsée)</option><option value="collee" ${P.lay === 'collee' ? 'selected' : ''}>Collée</option><option value="clouee" ${P.lay === 'clouee' ? 'selected' : ''}>Clouée</option></select></div>
        <div class="field"><label>Jeu de dilatation</label><div class="seg sm"><button data-a="gapmode" data-v="auto" aria-pressed="${P.gapMode !== 'fixe'}">Calculé</button><button data-a="gapmode" data-v="fixe" aria-pressed="${P.gapMode === 'fixe'}">Fixe</button></div></div>
        ${P.gapMode === 'fixe' ? pr('gap', 'Jeu périphérique', 'mm') : `${pr('gapMin', 'Jeu minimum', 'mm')}${pr('gapPerM', 'Par mètre de longueur posée', 'mm')}<p class="hint2">Règle courante des notices de pose flottante : 0,15 % de la plus grande dimension posée d'un seul tenant (1,5 mm par mètre), 8 mm au minimum. Le jeu est calculé pour chaque zone posée d'un tenant. Vérifiez la notice de votre parquet.</p>`}${pr('minStagger', 'Décalage mini des joints', 'mm')}${pr('minPiece', 'Longueur mini d\'une coupe', 'mm')}${pr('minRow', 'Largeur mini d\'un rang', 'mm')}${pr('perBox', 'Lames par paquet', 'lames')}${pr('waste', 'Marge de chute', '%')}
        <p>Valeurs par défaut courantes ; suivez la notice du fabricant si elle diffère.</p>
      </details>`;
    if (!rooms.length) return h + '<p class="note">Aucune pièce sur cet étage : importez un plan ou tracez les pièces.</p>';
    const ord = App.feat.order(S.p.floorId);
    if (ord.length > 1) h += `<h3>Ordre de pose conseillé</h3><p style="color:var(--ink);font-weight:500">${ord.map((r) => esc(r.name || 'Pièce')).join(' → ')}</p><p>Des pièces les plus éloignées vers l'escalier : on ne marche pas sur les lames fraîchement posées (indispensable en pose collée) et les seuils se règlent en reculant.</p>`;
    for (const r of rooms) {
      const res = cal.results[r.id];
      h += `<h3>${esc(r.name || 'Pièce')}</h3>`;
      if (r.parquet === false) { h += `<p>Pas de parquet dans cette pièce. <button class="link" data-a="pqon" data-v="${r.id}">Activer</button></p>`; continue; }
      if (!res) { h += '<p>Calcul impossible pour cette forme.</p>'; continue; }
      h += `<p>${App.fmtM2(res.area)} m² · ${res.rows.length} rangs · ${res.piecesNew} lames posées dont ${res.cuts} coupes${res.groupSize > 1 ? ' · pose continue (groupe ' + esc(r.cal.group) + ')' : ''}</p>
        <ol class="advice">${res.advice.map((a) => `<li class="${a.warn ? 'warn' : ''}">${esc(a.s)}</li>`).join('')}</ol>
        <div class="row"><button class="btn sm primary" data-a="step" data-v="${r.id}">Pas à pas</button><button class="btn sm" data-a="opt" data-v="${r.id}">Optimiser</button><button class="btn sm" data-a="calzoom" data-v="${r.id}">Zoomer</button><button class="btn sm" data-a="sel" data-v="${r.id}">Réglages</button></div>
        ${S.optFor === r.id && S.optRes ? `<table class="cuts" style="margin-top:10px"><thead><tr><th>Variante</th><th>Lames</th><th>Chute</th><th>1er / dernier</th><th></th></tr></thead><tbody>${S.optRes.map((o, i) => { const n = r.pts.length; const wn = (k) => String.fromCharCode(65 + k) + String.fromCharCode(65 + ((k + 1) % n)); return `<tr><td style="text-align:left">∥ ${wn(o.wallDir)} · départ ${o.startIdx != null ? wn(o.startIdx) : 'auto'}${o.warns ? ' <span class="tag red">' + o.warns + '</span>' : ''}</td><td>${o.boards}</td><td>${Math.round(o.waste * 100)} %</td><td>${Math.round(o.first)} / ${Math.round(o.last)}</td><td><button class="link" data-a="optApply" data-v="${i}">Appliquer</button></td></tr>`; }).join('')}</tbody></table><p>Variantes classées : moins d'alertes, puis moins de lames, puis moins de chute.</p>` : ''}
        <details><summary>Fiche de coupe rang par rang</summary>${cutTable(res, P)}</details>`;
    }
    const sh = App.feat.shopping(S.p.floorId);
    const row = (k, v, d) => `<div class="item" style="min-height:44px"><span style="flex:1;font-size:14px">${k}${d ? `<br><small style="color:var(--ink-2);font-size:12px">${d}</small>` : ''}</span><span style="font-weight:600;white-space:nowrap">${v}</span></div>`;
    h += `<h3>Liste de courses · ${esc(App.floor().name)}</h3><div class="list">
      ${row('Parquet', (sh.boxes ?? '—') + ' paquets', sh.boards + ' lames — ' + esc(P.name || ''))}
      ${row('Sous-couche', fmt(sh.underlay, 1) + ' m²', '+5 % pour les recouvrements')}
      ${row('Plinthes', fmt(sh.plinth, 1) + ' m', sh.plinthBars + ' barres de 2,40 m, portes déduites, +10 %')}
      ${row('Barres de seuil', String(sh.seuils.length), sh.seuils.length ? 'largeurs ' + sh.seuils.map((w) => App.fmtCm(w, 0)).join(', ') + ' cm' : '')}
      ${sh.stairDown ? row('Profilé de rive de trémie', String(sh.stairDown), 'ou nez de marche à l\'arrivée de l\'escalier') : ''}
      ${row('Kit de pose', '1', 'cales ' + P.gap + ' mm, cale de frappe, tire-lame, maillet')}</div>`;
    h += `<h3>Exporter</h3><div class="row"><button class="btn sm" data-a="copyFiche">Copier la fiche</button><button class="btn sm" data-a="dlFiche">Fiche .txt</button><button class="btn sm" data-a="dlPng">Image du plan</button></div>`;
    return h;
  }
  function cutTable(res, P) {
    return `<table class="cuts"><thead><tr><th>Rang</th><th>Largeur</th><th>1re lame</th><th>Dernière</th><th>Lames n°</th></tr></thead><tbody>${res.rows.map((r) => r.runs.map((ru, k) => { const f = ru.pieces[0], l = ru.pieces[ru.pieces.length - 1]; const rip = r.ripMax < P.W - 0.5; return `<tr><td>${k ? '' : r.num}</td><td class="${rip ? 'r' : ''}">${k ? '' : rip ? Math.round(r.ripMax) + ' mm' : 'entière'}</td><td class="${f.kind === 'cut' ? 'r' : ''}">${Math.round(f.len)}${f.src === 'chute' ? '*' : ''}</td><td class="${ru.pieces.length > 1 && l.kind === 'cut' ? 'r' : ''}">${ru.pieces.length > 1 ? Math.round(l.len) + (l.src === 'chute' ? '*' : '') : '—'}</td><td>${f.n === l.n ? f.n : f.n + '–' + l.n}</td></tr>`; }).join('')).join('')}</tbody></table><p>Longueurs en mm, rangs numérotés depuis le mur de départ. * chute réemployée.</p>`;
  }
  ui.ficheText = () => {
    const cal = App.calepinage(); const P = S.p.parquet; const lines = [];
    lines.push(`CALEPINAGE — ${S.p.name} — ${App.floor().name}`, `${P.name} : ${P.L} × ${P.W} mm, ${P.pattern}, pose ${P.lay}`, `Total : ${cal.totals.area.toFixed(2)} m², ${cal.totals.boards} lames, ${cal.totals.boxes ?? '?'} paquets`, '');
    for (const r of App.rooms()) {
      const res = cal.results[r.id]; if (!res) continue;
      lines.push(`== ${r.name} — ${(res.area / 1e6).toFixed(2)} m², ${res.rows.length} rangs`); res.advice.forEach((a, i) => lines.push(`${i + 1}. ${a.s}`));
      lines.push('Rang | largeur | lames n° | 1re lame | dernière'); res.rows.forEach((row) => row.runs.forEach((ru, k) => { const f = ru.pieces[0], l = ru.pieces[ru.pieces.length - 1]; lines.push(`${k ? '  ' : row.num} | ${row.ripMax < P.W - 0.5 ? Math.round(row.ripMax) + ' mm' : 'entière'} | ${f.n === l.n ? f.n : f.n + '-' + l.n} | ${Math.round(f.len)} | ${ru.pieces.length > 1 ? Math.round(l.len) : '-'}`); })); lines.push('');
    }
    return lines.join('\n');
  };

  /* ----- Mobilier ----- */
  function svgFor(it) {
    const w = it.w, d = it.d, sc = Math.min(120 / Math.max(w, 1), 38 / Math.max(d, 1)); const W = w * sc, D = d * sc, x = (130 - W) / 2, y = (42 - D) / 2;
    if (it.round) return `<svg viewBox="0 0 130 42"><ellipse cx="65" cy="21" rx="${W / 2}" ry="${D / 2}"/></svg>`;
    if (it.shape === 'L') { const t = (it.t || 60) * sc; return `<svg viewBox="0 0 130 42"><path d="M${x} ${y}h${W}v${t}h${-(W - t)}v${D - t}h${-t}z"/></svg>`; }
    return `<svg viewBox="0 0 130 42"><rect x="${x}" y="${y}" width="${W}" height="${D}"/>${/^lit/.test(it.id) ? `<path d="M${x} ${y + D * 0.12}h${W}"/>` : ''}</svg>`;
  }
  function panelMob() {
    const cats = {}; PL.lib.furniture.concat(PL.lib.structure).forEach((it) => { (cats[it.cat] = cats[it.cat] || []).push(it); });
    const placed = App.shapesOn().filter((s) => s.kind === 'meuble');
    return `<h2>Mobilier</h2><p class="lead">Touchez un élément pour le poser au centre de la vue, puis déplacez-le avec la poignée rouge. Dimensions indicatives, toutes modifiables.</p>
      ${Object.entries(cats).map(([c, items]) => `<h3>${esc(c)}</h3><div class="grid">${items.map((it) => `<button class="tile" data-a="lib" data-v="${it.id}">${svgFor(it)}<b>${esc(it.name)}</b><small>${it.round ? 'Ø ' + it.w : it.w + ' × ' + it.d} cm</small></button>`).join('')}</div>`).join('')}
      ${placed.length ? `<h3>Posés sur cet étage</h3><div class="list">${placed.map((s) => `<button class="item" data-a="sel" data-v="${s.id}"><span class="nm">${esc(s.name)}</span>${s.locked ? '<span class="tag">verrouillé</span>' : ''}<span class="meta">${App.fmtCm(G.dist(s.pts[0], s.pts[1]), 0)} × ${App.fmtCm(G.dist(s.pts[1], s.pts[2]), 0)}</span></button>`).join('')}</div>` : ''}`;
  }

  /* ----- Électricité ----- */
  function panelElec() {
    const pts = App.pointsOn(); const counts = {}; pts.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
    return `<h2>Électricité</h2><p class="lead">Choisissez un symbole puis touchez le plan : prises et interrupteurs se calent sur le mur le plus proche, les points lumineux restent au plafond.</p>
      <div class="grid">${PL.lib.elec.map((e) => `<button class="tile" data-a="etype" data-v="${e.id}" aria-pressed="${S.tool === 'elec' && S.elecType === e.id}"><canvas data-g="${e.g}" width="60" height="60"></canvas><b>${esc(e.name)}</b><small>${counts[e.id] ? counts[e.id] + ' posé' + (counts[e.id] > 1 ? 's' : '') : PL.lib.elecDefaultH[e.id] != null ? 'h ' + PL.lib.elecDefaultH[e.id] + ' cm' : 'plafond'}</small></button>`).join('')}</div>
      <h3>Récapitulatif de l'étage</h3>${pts.length ? `<table class="cuts"><thead><tr><th>Symbole</th><th>Nombre</th></tr></thead><tbody>${Object.entries(counts).map(([k, v]) => `<tr><td>${esc((PL.lib.elec.find((e) => e.id === k) || {}).name || k)}</td><td>${v}</td></tr>`).join('')}</tbody></table>` : '<p>Aucun point posé.</p>'}`;
  }
  function drawElecTiles() {
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
    document.querySelectorAll('#panel canvas[data-g]').forEach((c) => { const x = c.getContext('2d'); const pressed = c.closest('[aria-pressed=true]'); x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, 30, 30); x.translate(15, 16); App.drawElecGlyph(x, c.dataset.g, 20, pressed ? getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() : ink, 0); });
  }

  /* ----- Projet ----- */
  function panelProjet() {
    const fl = S.p.floors.slice().sort((a, b) => a.level - b.level);
    const cloud = App.cloud && App.cloud.ready;
    return `<h2>Projet</h2>
      <div class="field" style="border-top:1px solid var(--ink)"><label>Nom du projet</label><input data-c="pname" value="${esc(S.p.name || '')}"></div>
      <h3>Apparence</h3><div class="seg">${[['light', 'Claire'], ['dark', 'Sombre'], ['auto', 'Comme l\'appareil']].map(([k, v]) => `<button data-x="theme" data-v="${k}" aria-pressed="${App.theme() === k}">${v}</button>`).join('')}</div>
      <h3>Étages</h3><div class="list">${fl.map((f, i) => `<div class="item"><span class="nm">${esc(f.name)}</span><span class="meta">${App.rooms(f.id).length} pièces</span><button class="btn sm ghost" data-a="fup" data-v="${f.id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">↑</button><button class="btn sm ghost" data-a="fren" data-v="${f.id}">Renommer</button><button class="btn sm ghost" data-a="fdel" data-v="${f.id}" ${fl.length < 2 ? 'disabled' : ''}>Supprimer</button></div>`).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn sm" data-a="fadd">+ Étage</button></div>
      <h3>Sauvegarde</h3><p>${cloud ? 'Chaque modification est enregistrée automatiquement et synchronisée avec votre compte : le projet vous suit sur iPhone, tablette et ordinateur.' : 'Chaque modification est enregistrée automatiquement dans ce navigateur. Exportez le projet pour le transférer sur un autre appareil.'}${S.savedAt ? ` Dernier enregistrement à ${hm(S.savedAt)}.` : ''} Les fonds de plan restent sur l'appareil où ils ont été importés.</p>
      <div class="row"><button class="btn sm" data-a="exp">Exporter (.json, avec fonds de plan)</button><button class="btn sm" data-a="copyjson">Copier le projet (sans fonds)</button><label class="btn sm" style="cursor:pointer">Importer un projet<input type="file" accept=".json,application/json" data-c="impjson" hidden></label><button class="btn sm" data-a="pastejson">Coller un projet</button></div>
      ${versionsHTML()}
      <h3>Affichage</h3>
      ${ui.bgSlider()}
      ${[['fond', 'Fond de plan importé'], ['cotes', 'Cotes des murs'], ['mobilier', 'Mobilier (vue Plan)'], ['elec', 'Électricité (vue Plan)'], ['calepinage', 'Lames (vue Plan)']].map(([k, v]) => `<div class="field"><label>${v}</label><input type="checkbox" data-c="layer.${k}" ${S.layers[k] ? 'checked' : ''}></div>`).join('')}
      <h3>Scan LiDAR</h3><p>Une page web n'a pas accès au capteur LiDAR de l'iPhone. Scannez la pièce avec magicplan (qui utilise le LiDAR), exportez en DXF, SVG, PDF ou image, puis importez le fichier ici. Une petite app iOS dédiée (RoomPlan d'Apple) pourrait envoyer directement le scan à Calepin.</p>
      <h3>Nouveau projet</h3><button class="btn sm ghost" data-a="reset">Effacer et recommencer</button>`;
  }

  /* ---------- clics ---------- */
  async function onPanelClick(e) {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, v = b.dataset.v; const s = App.selected();
    switch (a) {
      case 'tab': ui.setTab(v); break;
      case 'mode': ui.setMode(v); break;
      case 'back': S.sel = null; ui.refresh(); App.render(); break;
      case 'sel': { S.sel = { id: v }; const x = App.byId(v); if (x && x.pts) App.fitShape(x); else if (x && x.a) App.fitBox(G.bbox([x.a, x.b])); ui.refresh(); App.render(); break; }
      case 'calzoom': { const x = App.byId(v); if (S.mode !== 'calepinage') ui.setMode('calepinage'); App.fitShape(x); break; }
      case 'addRect': { const r = await ui.dialog('Nouvelle pièce', `<div class="field"><label>Nom</label><input name="n" value="Pièce ${App.rooms().length + 1}"></div><div class="field"><label>Largeur</label><div class="unit"><input name="w" inputmode="decimal" value="400"><span>cm</span></div></div><div class="field"><label>Longueur</label><div class="unit"><input name="l" inputmode="decimal" value="350"><span>cm</span></div></div><div class="field"><label>Angles droits verrouillés</label><input type="checkbox" name="sq" checked></div>`, [{ label: 'Annuler', cls: 'ghost' }, { label: 'Créer', cls: 'primary', def: true }]);
        if (r.i !== 1) break; const w = num(r.vals.w) * 10, l = num(r.vals.l) * 10; if (!w || !l) break;
        const bb = App.floorBBox(); const x0 = bb ? bb.x1 + 600 : 0, y0 = bb ? bb.y0 : 0;
        const sh = App.makeShape('piece', G.rect(x0, y0, w, l), { name: r.vals.n || 'Pièce' }); if (r.vals.sq) sh.locks = PL.solver.syncLocks(sh.pts, sh.pts.map(() => ({ L: false, A: true })));
        App.mutate((P) => P.shapes.push(sh)); S.sel = { id: sh.id }; App.fitShape(sh); ui.refresh(); break; }
      case 'draw': S.drawKind = 'piece'; ui.setTool('draw'); if (innerWidth < 900) ui.sheet('min'); break;
      case 'drawKind': S.drawKind = v; S.draft = null; ui.setTool('draw'); if (innerWidth < 900) ui.sheet('min'); App.toast('Tracez la zone point par point'); break;
      case 'merge': { const o = App.byId(document.getElementById('mergeWith').value); if (!o) break; const m = App.feat.merge(s, o); if (m) { S.sel = { id: m.id }; App.toast('Pièces fusionnées'); ui.refresh(); } break; }
      case 'opt': { const r = App.byId(v); S.optFor = v; S.optRes = App.feat.optimize(r); ui.refresh(); break; }
      case 'optApply': { const r = App.byId(S.optFor); const o = S.optRes[+v]; App.mutate(() => { r.cal = Object.assign({}, r.cal, { dir: o.dir.toFixed(3), start: o.startIdx != null ? String(o.startIdx) : 'auto' }); }); S.optRes = null; S.optFor = null; App.toast('Variante appliquée'); break; }
      case 'step': S.step = { id: v, row: 1 }; if (S.mode !== 'calepinage') S.mode = 'calepinage'; App.fitShape(App.byId(v)); ui.refresh(); App.render(); break;
      case 'stepGo': { const res = App.calepinage().results[S.step.id]; S.step.row = Math.max(1, Math.min(res.rows.length, S.step.row + (+v))); ui.refresh(); App.render(); break; }
      case 'stepEnd': S.step = null; ui.refresh(); App.render(); break;
      case 'addLib': ui.placeLib(PL.lib.structure.find((x) => x.id === v)); break;
      case 'lib': ui.placeLib(PL.lib.furniture.concat(PL.lib.structure).find((x) => x.id === v)); if (innerWidth < 900) ui.sheet('min'); break;
      case 'etype': S.elecType = v; if (S.mode !== 'elec') { S.mode = 'elec'; } ui.setTool('elec'); if (innerWidth < 900) ui.sheet('min'); break;
      case 'lockpos': App.mutate(() => { s.locked = !s.locked; }); break;
      case 'zoom': App.fitShape(s); break;
      case 'dup': { const c = JSON.parse(JSON.stringify(s)); c.id = App.uid(); c.pts = c.pts.map((p) => ({ x: p.x + 400, y: p.y - 400 })); c.locked = false; c.name = (s.name || '') + (s.kind === 'piece' ? ' (copie)' : ''); App.mutate((P) => P.shapes.push(c)); S.sel = { id: c.id }; ui.refresh(); break; }
      case 'pdup': { const c = Object.assign({}, s, { id: App.uid(), x: s.x + 300, locked: false }); App.mutate((P) => P.points.push(c)); S.sel = { id: c.id }; break; }
      case 'del': ui.deleteSelected(); break;
      case 'rot': if (s.locked) break; App.mutate(() => { const c = G.centroid(s.pts); s.pts = s.pts.map((p) => G.rotAround(p, c, G.rad(+v))); }); break;
      case 'mirror': if (s.locked) break; App.mutate(() => { const c = G.centroid(s.pts); s.pts = s.pts.map((p) => ({ x: 2 * c.x - p.x, y: p.y })).reverse(); s.locks = PL.solver.syncLocks(s.pts, s.pts.map(() => ({ L: false, A: false }))); }); break;
      case 'prot': if (s.locked) break; App.mutate(() => { s.rot = (s.rot || 0) + Math.PI / 2; }); break;
      case 'stairdir': App.mutate(() => { s.stair = Object.assign({}, s.stair, { dir: v }); }); break;
      case 'shq': App.mutate(() => { if (+v > 0) s.h = +v; else delete s.h; }); break;
      case 'firstrow': { const res = App.calepinage().results[s.id]; const tgt = res && !res.lead ? App.rooms(s.floor).find((r) => { const x = App.calepinage().results[r.id]; return x && x.group === res.group && x.lead; }) || s : s; App.mutate(() => { tgt.cal = Object.assign({}, tgt.cal, { first: v === 'full' ? 'full' : undefined }); }); break; }
      case 'gapmode': App.mutate((P) => { P.parquet.gapMode = v; }); break;
      case 'guard': App.mutate(() => { s.stair = Object.assign({}, s.stair, { guard: v }); }); break;
      case 'lockL': case 'lockA': { const i = +b.dataset.i, k = a === 'lockL' ? 'L' : 'A'; App.mutate(() => { s.locks[i][k] = !s.locks[i][k]; s.locks = PL.solver.syncLocks(s.pts, s.locks); }); break; }
      case 'lockAll': App.mutate(() => { s.locks = PL.solver.syncLocks(s.pts, s.pts.map(() => ({ L: true, A: true }))); s.locks[s.locks.length - 1].L = false; s.locks[0].A = false; s.locks[s.locks.length - 1].A = false; s.locks = PL.solver.syncLocks(s.pts, s.locks); }); App.toast('Cotes verrouillées (un mur et deux angles restent libres pour fermer la forme)'); break;
      case 'unlockAll': App.mutate(() => { s.locks = s.pts.map(() => ({ L: false, A: false })); }); break;
      case 'square': { const r = PL.solver.squareUp(s.pts, s.locks); if (!r.ok) { App.toast(r.msg); break; } App.mutate(() => { s.pts = r.pts; s.locks = PL.solver.syncLocks(s.pts, s.locks.map((l, i) => { const d = G.deg(PL.solver.measure(r.pts).A[i]); return Object.assign({}, l, { A: l.A || Math.abs(d - 90) < 0.01 || Math.abs(d - 270) < 0.01 }); })); }); App.toast('Angles droits appliqués et verrouillés'); break; }
      case 'split': { const i = +b.dataset.i; App.mutate(() => { const n = s.pts.length; const m = G.lerp(s.pts[i], s.pts[(i + 1) % n], 0.5); s.pts.splice(i + 1, 0, m); s.locks.splice(i + 1, 0, { L: false, A: false }); s.locks[i] = Object.assign({}, s.locks[i], { L: false }); (s.openings || []).forEach((o) => { if (o.wall > i) o.wall++; }); s.locks = PL.solver.syncLocks(s.pts, s.locks); }); break; }
      case 'delv': { const n = s.pts.length; const r = await ui.dialog('Retirer un point', `<div class="field"><label>Point</label><select name="v">${s.pts.map((_, i) => `<option value="${i}">${String.fromCharCode(65 + i)}</option>`).join('')}</select></div>`, [{ label: 'Annuler', cls: 'ghost' }, { label: 'Retirer', cls: 'red', def: true }]); if (r.i !== 1) break; const i = +r.vals.v; const np = s.pts.filter((_, k) => k !== i); if (G.isSelfIntersecting(np)) { App.toast('Impossible : la forme se croiserait'); break; } App.mutate(() => { s.pts = np; s.locks.splice(i, 1); s.locks = s.locks.map((l) => ({ L: false, A: l.A })); s.locks = PL.solver.syncLocks(s.pts, s.locks); s.openings = (s.openings || []).filter((o) => o.wall !== i && o.wall !== (i - 1 + n) % n).map((o) => Object.assign(o, { wall: o.wall > i ? o.wall - 1 : o.wall })); }); break; }
      case 'cut': ui.setTool('cut'); if (innerWidth < 900) ui.sheet('min'); break;
      case 'seeCal': ui.setMode('calepinage'); S.sel = { id: s.id }; App.fitShape(s); ui.refresh(); break;
      case 'o.add': { const t = $('newOpType').value, w = +$('newOpWall').value; const def = PL.lib.openings.find((x) => x.id === t); const n = s.pts.length; const el = G.dist(s.pts[w], s.pts[(w + 1) % n]); const width = Math.min(def.w, el - 100); App.mutate(() => { s.openings.push({ type: t, wall: w, pos: Math.max(0, (el - width) / 2), width, h: def.h, sill: def.sill, sw: 1 }); }); S.openOpen = s.openings.length - 1; ui.refresh(); break; }
      case 'o.del': { const k = +b.dataset.k; App.mutate(() => { s.openings.splice(k, 1); }); break; }
      case 'o.hinge': { const k = +b.dataset.k; App.mutate(() => { s.openings[k].hinge = v; }); S.openOpen = k; break; }
      case 'o.sw': { const k = +b.dataset.k; App.mutate(() => { const o = s.openings[k]; if (v === 'out') { o.out = true; o.sw = 1; } else { o.out = false; o.sw = +v; } }); S.openOpen = k; break; }
      case 'pqon': App.mutate((P) => { const r = P.shapes.find((x) => x.id === v); if (r) r.parquet = true; }); break;
      case 'copyFiche': try { await navigator.clipboard.writeText(ui.ficheText()); App.toast('Fiche copiée'); } catch (err) { App.toast('Copie refusée par le navigateur'); } break;
      case 'dlFiche': App.download(`calepinage-${App.floor().name}.txt`, ui.ficheText(), 'text/plain'); break;
      case 'dlPng': { const blob = await App.exportPNG(); if (blob) App.download(`plan-${App.floor().name}.png`, blob, 'image/png'); break; }
      case 'mtool': S.sel = null; ui.setTool('measure'); break;
      case 'vsave': ui.saveDialog(); break;
      case 'vrest': { const ver = (App.versions.list || []).find((x) => x.id === v); if (!ver) break; const r = await ui.dialog('Restaurer la version', `<p>Le projet revient à « ${esc(ver.name)} » (${esc(when(ver.at))}).</p><p class="hint2">L'état actuel est d'abord gardé comme version « Avant restauration », et vous pouvez aussi annuler avec la flèche ↶.</p>`, [{ label: 'Annuler', cls: 'ghost' }, { label: 'Restaurer', cls: 'primary', def: true }]); if (r.i !== 1) break; const ok = await App.versions.restore(v); App.toast(ok ? `Version « ${ver.name} » restaurée` : 'Version introuvable sur cet appareil'); ui.refresh(); break; }
      case 'vdel': { const ver = (App.versions.list || []).find((x) => x.id === v); if (!ver) break; if (!(await ui.confirm('Supprimer la version', `« ${ver.name} » sera supprimée${ver.cloud ? ' de votre compte et de cet appareil' : ''}. Le projet en cours n'est pas touché.`, 'Supprimer'))) break; await App.versions.remove(v); App.toast('Version supprimée'); ui.refresh(); break; }
      case 'exp': { App.toast('Préparation de l\'export…'); const ex = await App.exportProject(); App.download(`${(S.p.name || 'projet').replace(/[^\w\-]+/g, '_')}.calepin.json`, ex.text, 'application/json'); App.toast(ex.files ? `Exporté avec ${ex.files} fond${ex.files > 1 ? 's' : ''} de plan` : 'Projet exporté'); break; }
      case 'copyjson': try { await navigator.clipboard.writeText(JSON.stringify(S.p)); App.toast('Projet copié'); } catch (err) { App.toast('Copie refusée par le navigateur'); } break;
      case 'pastejson': { const r = await ui.dialog('Coller un projet', '<p>Collez ici le texte d\'un projet exporté.</p><textarea name="t"></textarea>', [{ label: 'Annuler', cls: 'ghost' }, { label: 'Charger', cls: 'primary' }]); if (r.i === 1) loadProjectText(r.vals.t); break; }
      case 'fadd': { const r = await ui.dialog('Nouvel étage', '<div class="field"><label>Nom</label><input name="n" value="Étage"></div>', [{ label: 'Annuler', cls: 'ghost' }, { label: 'Ajouter', cls: 'primary', def: true }]); if (r.i !== 1) break; const f = { id: App.uid(), name: r.vals.n || 'Étage', level: Math.max(...S.p.floors.map((x) => x.level)) + 1 }; App.mutate((P) => { P.floors.push(f); P.floorId = f.id; }); App.fitAll(); break; }
      case 'fren': { const f = S.p.floors.find((x) => x.id === v); const r = await ui.dialog('Renommer l\'étage', `<div class="field"><label>Nom</label><input name="n" value="${esc(f.name)}"></div>`, [{ label: 'Annuler', cls: 'ghost' }, { label: 'Renommer', cls: 'primary', def: true }]); if (r.i === 1 && r.vals.n) App.mutate(() => { f.name = r.vals.n; }); break; }
      case 'fup': { const fl = S.p.floors.slice().sort((x, y) => x.level - y.level); const i = fl.findIndex((x) => x.id === v); if (i > 0) App.mutate(() => { const t = fl[i].level; fl[i].level = fl[i - 1].level; fl[i - 1].level = t; }); break; }
      case 'fdel': { const f = S.p.floors.find((x) => x.id === v); if (!(await ui.confirm('Supprimer l\'étage', `« ${f.name} » et tout son contenu seront supprimés.`, 'Supprimer'))) break; App.mutate((P) => { P.floors = P.floors.filter((x) => x.id !== v); P.shapes = P.shapes.filter((x) => x.floor !== v); P.points = P.points.filter((x) => x.floor !== v); P.measures = P.measures.filter((x) => x.floor !== v); if (P.floorId === v) P.floorId = P.floors[0].id; }); App.fileDel('bg:' + v); delete S.bgs[v]; App.fitAll(); break; }
      case 'reset': if (await ui.confirm('Effacer le projet', 'Toutes les pièces, mesures et réglages de ce projet seront supprimés de cet appareil.', 'Effacer')) { App.mutate(() => {}); S.p = App.newProject(); S.sel = null; S.bgs = {}; App.changed(); App.fitAll(); } break;
    }
  }
  function loadProjectText(t) { App.importProject(t).catch((e) => { console.error(e); App.toast('Fichier de projet illisible'); }); }

  function onPanelChange(e) {
    const t = e.target, c = t.dataset.c; if (!c) return; const s = App.selected();
    const val = t.type === 'checkbox' ? t.checked : t.value;
    if (c === 'name') { App.mutate(() => { s.name = val; }); return; }
    if (c === 'pname') { App.mutate((P) => { P.name = val; }); return; }
    if (c === 'kind') { App.mutate(() => { s.kind = val; if (val === 'escalier') s.stair = s.stair || { dir: 'monte' }; }); return; }
    if (c === 'parquet') { App.mutate(() => { s.parquet = val; }); return; }
    if (c === 'ceil') { App.mutate(() => { s.ceiling = num(val) || null; }); return; }
    if (c === 'fceil') { App.mutate(() => { App.floor().ceiling = num(val) || 250; }); return; }
    if (c === 'hmin' || c === 'hmax') { App.mutate(() => { s[c] = num(val); }); return; }
    if (c === 'noParquet') { App.mutate(() => { s.noParquet = val; }); return; }
    if (c === 'guardH' || c === 'guardT') { const v = num(val); if (v > 0) App.mutate(() => { s.stair = Object.assign({}, s.stair, { [c]: v }); }); return; }
    if (c === 'sh') { const v = num(val); App.mutate(() => { if (v > 0) s.h = v; else delete s.h; }); return; }
    if (c === 'steps') { App.mutate(() => { s.stair = Object.assign({}, s.stair, { steps: parseInt(val, 10) || null }); }); return; }
    if (c === 'L' || c === 'A') { const v = num(val); if (v == null) return; const i = +t.dataset.i; const lk = s.locks[i] && s.locks[i][c]; if (!applyDim(s, i, c, c === 'L' ? v * 10 : G.rad(v), lk)) ui.refresh(true); return; }
    if (c === 'fw' || c === 'fd') {
      const v = num(val); if (!v) return; const a = s.pts[0], b = s.pts[1], d2 = s.pts[2]; const u = G.norm(G.sub(b, a)), w = G.norm(G.sub(d2, b));
      const W = c === 'fw' ? v * 10 : G.dist(a, b), D = c === 'fd' ? v * 10 : G.dist(b, d2);
      App.mutate(() => { s.pts = [a, G.add(a, G.mul(u, W)), G.add(G.add(a, G.mul(u, W)), G.mul(w, D)), G.add(a, G.mul(w, D))]; s.locks = PL.solver.syncLocks(s.pts, s.locks); }); return;
    }
    if (c.startsWith('o.')) {
      const k = +t.dataset.k, f = c.slice(2); S.openOpen = k;
      App.mutate(() => { const o = s.openings[k]; if (f === 'type' || f === 'to') o[f] = val || null; else if (f === 'wall') o.wall = +val; else { const v = num(val); o[f] = v == null ? null : v * 10; } });
      return;
    }
    if (c.startsWith('cal.')) { const f = c.slice(4); App.mutate(() => { s.cal = Object.assign({}, s.cal); s.cal[f] = f === 'group' ? val : val === 'auto' ? 'auto' : val; }); return; }
    if (c === 'pq.ref') { const q = PL.lib.parquets.find((x) => x.id === val); S.pqOpen = true; App.mutate((P) => { if (!q) { P.parquet.ref = null; return; } Object.assign(P.parquet, { ref: q.id, name: q.name, L: q.L, W: q.W, T: q.T, perBox: q.perBox, m2Box: q.m2Box, lay: q.lay }); }); if (q) App.toast(q.name + ' : ' + q.L + ' × ' + q.W + ' mm'); return; }
    if (c.startsWith('pq.')) { const f = c.slice(3); S.pqOpen = true; App.mutate((P) => { P.parquet[f] = ['name', 'pattern', 'lay'].includes(f) ? val : num(val) ?? P.parquet[f]; if (['L', 'W', 'T', 'perBox', 'm2Box'].includes(f) && P.parquet.ref) { const q = PL.lib.parquets.find((x) => x.id === P.parquet.ref); if (q && q[f] !== P.parquet[f]) P.parquet.ref = null; } }); return; }
    if (c.startsWith('p.')) { const f = c.slice(2); App.mutate(() => { s[f] = f === 'h' ? num(val) : val; }); return; }
    if (c === 'm.label') { App.mutate(() => { s.label = val; }); return; }
    if (c.startsWith('layer.')) { S.layers[c.slice(6)] = val; App.render(); return; }
    if (c === 'impjson') { const f = t.files[0]; if (f) f.text().then(loadProjectText); return; }
  }
})();
