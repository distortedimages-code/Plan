/* Calepin — état, persistance, historique. */
(function () {
  const PL = globalThis.PL; const G = PL.geom;
  const App = (globalThis.App = globalThis.App || {});
  const KEY = 'calepin.projet.v1';
  App.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

  App.newProject = () => {
    const f = { id: App.uid(), name: 'RDC', level: 0 };
    return { v: 1, name: 'Ma maison', floors: [f], floorId: f.id, shapes: [], points: [], measures: [], parquet: Object.assign({}, PL.layout.DEFAULTS), updatedAt: Date.now() };
  };

  App.state = {
    p: null, sel: null, tool: 'select', mode: 'plan', tab: 'pieces',
    layers: { fond: true, cotes: true, mobilier: true, elec: true, calepinage: false },
    view: { cx: 0, cy: 0, z: 0.05 }, sheet: 'half', calc: {}, bgs: {}, draft: null, hover: null,
  };
  const S = App.state;

  /* ---------- accès ---------- */
  App.floor = () => S.p.floors.find((f) => f.id === S.p.floorId) || S.p.floors[0];
  App.shapesOn = (fid = S.p.floorId) => S.p.shapes.filter((s) => s.floor === fid);
  App.pointsOn = (fid = S.p.floorId) => S.p.points.filter((s) => s.floor === fid);
  App.measuresOn = (fid = S.p.floorId) => S.p.measures.filter((s) => s.floor === fid);
  App.byId = (id) => S.p.shapes.find((s) => s.id === id) || S.p.points.find((s) => s.id === id) || S.p.measures.find((s) => s.id === id);
  App.selected = () => (S.sel ? App.byId(S.sel.id) : null);
  App.rooms = (fid) => App.shapesOn(fid).filter((s) => s.kind === 'piece').sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name || '').localeCompare(b.name || '', 'fr'));

  /* ---------- historique ---------- */
  const hist = [], fut = [];
  let pending = null;
  App.snapshot = () => JSON.stringify(S.p);
  App.begin = () => { if (!pending) pending = App.snapshot(); };
  App.end = (changed = true) => { if (pending && changed) { hist.push(pending); if (hist.length > 80) hist.shift(); fut.length = 0; App.changed(); } pending = null; };
  App.mutate = (fn) => { const before = App.snapshot(); const r = fn(S.p); hist.push(before); if (hist.length > 80) hist.shift(); fut.length = 0; App.changed(); return r; };
  App.undo = () => { if (S.pending && App.walls) { App.walls.cancel(); App.toast('Déplacement annulé'); return; } if (!hist.length) return; fut.push(App.snapshot()); S.p = JSON.parse(hist.pop()); fixSel(); App.changed(true); App.toast('Annulé'); };
  App.redo = () => { if (S.pending && App.walls) App.walls.cancel(true); if (!fut.length) return; hist.push(App.snapshot()); S.p = JSON.parse(fut.pop()); fixSel(); App.changed(true); };
  App.canUndo = () => hist.length > 0 || !!S.pending; App.canRedo = () => fut.length > 0;
  const fixSel = () => { if (S.sel && !App.byId(S.sel.id)) S.sel = null; if (S.sel && S.sel.oid && !(App.ops && App.ops.find(S.sel.oid))) S.sel = { id: S.sel.id }; if (S.sel && S.sel.wall != null) { const r = App.byId(S.sel.id); if (!r || !r.pts || S.sel.wall >= r.pts.length) S.sel = { id: S.sel.id }; } };

  /* ---------- recalcul + rendu ---------- */
  let saveT = null;
  App.changed = (noSave) => {
    S.p.updatedAt = Date.now(); if (S.p.seeded) delete S.p.seeded;
    S.calc = {};
    if (App.feat && App.feat.normalizeAll) App.feat.normalizeAll();
    if (App.ops) App.ops.relink(S.p, S.p.floorId);
    clearTimeout(saveT); saveT = setTimeout(App.save, 400);
    App.render && App.render();
    App.ui && App.ui.refresh();
  };

  App.calepinage = (fid = S.p.floorId) => {
    if (!S.calc[fid]) {
      try { S.calc[fid] = PL.layout.computeFloor(App.shapesOn(fid).map((s) => s.kind === 'meuble' && s.noParquet ? s : s), S.p.parquet); }
      catch (e) { console.error(e); S.calc[fid] = { results: {}, totals: { boards: 0, area: 0 } }; }
    }
    return S.calc[fid];
  };

  /* ---------- persistance locale ---------- */
  App.save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S.p)); } catch (e) { /* stockage indisponible */ }
    App.cloud && App.cloud.push();
  };
  App.load = () => {
    let p = null;
    try { const t = localStorage.getItem(KEY); if (t) p = JSON.parse(t); } catch (e) { p = null; }
    S.p = migrate(App.seedPolicy(p) || App.newProject());
  };
  /* plan intégré : remplacé s'il n'a pas été touché, sinon mise à jour proposée */
  App.seedPolicy = (p) => {
    const seed = globalThis.CALEPIN_SEED; if (!seed) return p;
    const fresh = () => { try { const q = JSON.parse(JSON.stringify(seed)); q.seeded = true; return q; } catch (e) { return null; } };
    if (!p) return fresh();
    const sv = seed.seedVersion || 1;
    if (p.seeded && (p.seedVersion || 1) < sv) return fresh();
    const ov = seed.offerVersion || sv; // version à partir de laquelle les ouvertures ont changé
    if (!p.seeded && (p.seedVersion || 1) < ov && (p.seedApplied || 1) < ov) {
      const names = new Set(seed.shapes.filter((s) => s.kind === 'piece').map((s) => s.name));
      if ((p.shapes || []).filter((s) => s.kind === 'piece' && names.has(s.name)).length >= 4) p.seedOffer = sv;
    }
    return p;
  };
  function migrate(p) {
    p.floors = p.floors && p.floors.length ? p.floors : [{ id: App.uid(), name: 'RDC', level: 0 }];
    if (!p.floors.find((f) => f.id === p.floorId)) p.floorId = p.floors[0].id;
    p.shapes = p.shapes || []; p.points = p.points || []; p.measures = p.measures || [];
    p.parquet = Object.assign({}, PL.layout.DEFAULTS, p.parquet || {});
    // une porte garde parfois l'allège de la fenêtre qu'elle remplace : elle part du sol
    const DOORISH = ['porte', 'porte2', 'coulissante', 'galandage', 'passage'];
    (p.shapes || []).forEach((s) => (s.openings || []).forEach((o) => { if (DOORISH.includes(o.type) && o.sill) o.sill = 0; }));
    p.shapes.forEach((s) => { s.locks = s.locks || s.pts.map(() => ({ L: false, A: false })); while (s.locks.length < s.pts.length) s.locks.push({ L: false, A: false }); s.locks.length = s.pts.length; s.openings = s.openings || []; s.openings.forEach((o) => { if (!o.oid) o.oid = App.uid(); }); });
    // portes en double laissées par l'ancienne mise à jour du plan intégré : relecture propre depuis le plan
    if (App.ops && p.seedApplied && globalThis.CALEPIN_SEED && App.ops.countDups(p) > 0) {
      try { App.ops.applySeed(p, globalThis.CALEPIN_SEED); setTimeout(() => App.toast && App.toast('Portes en double corrigées : ouvertures relues depuis le plan'), 1500); } catch (e) { console.error(e); }
    }
    if (App.ops) App.ops.relinkAll(p);
    return p;
  }
  App.migrate = migrate;

  /* ---------- fichiers d'arrière-plan (IndexedDB) ---------- */
  let dbp = null;
  const idb = () => {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        const r = indexedDB.open('calepin', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('files');
        r.onsuccess = () => res(r.result); r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return dbp;
  };
  App.filePut = async (key, val) => { const db = await idb(); if (!db) return false; return new Promise((res) => { try { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(val, key); tx.oncomplete = () => res(true); tx.onerror = () => res(false); } catch (e) { res(false); } }); };
  App.fileGet = async (key) => { const db = await idb(); if (!db) return null; return new Promise((res) => { try { const r = db.transaction('files').objectStore('files').get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); } catch (e) { res(null); } }); };
  /* ---------- projet complet : le JSON + les fichiers des fonds de plan (PDF, images, DXF…) ---------- */
  const toDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  App.exportProject = async () => {
    const p = JSON.parse(JSON.stringify(S.p)), files = {};
    for (const f of p.floors || []) {
      const key = f.bg && f.bg.key; if (!key || files[key]) continue; const v = await App.fileGet(key); if (v == null) continue;
      if (typeof v === 'string') files[key] = { t: 'text', d: v };
      else if (v instanceof ArrayBuffer) files[key] = { t: 'ab', d: await toDataURL(new Blob([v], { type: 'application/pdf' })) };
      else if (v instanceof Blob) files[key] = { t: 'blob', d: await toDataURL(v), type: v.type };
    }
    if (Object.keys(files).length) p._files = files;
    return { text: JSON.stringify(p), files: Object.keys(files).length };
  };
  /* charge un projet (texte JSON) : les fonds de plan embarqués sont remis sur l'appareil */
  App.importProject = async (text) => {
    const raw = JSON.parse(text), files = raw._files || {}; delete raw._files; let n = 0;
    for (const [key, f] of Object.entries(files)) {
      try {
        let v; if (f.t === 'text') v = f.d; else { const b = await (await fetch(f.d)).blob(); v = f.t === 'ab' ? await b.arrayBuffer() : (f.type ? new Blob([b], { type: f.type }) : b); }
        await App.filePut(key, v); n++;
      } catch (e) { console.error(e); }
    }
    const p = App.migrate(raw); App.mutate(() => {}); S.p = p; S.sel = null; S.bgs = {}; S.bgMissing = {}; App.changed(); App.fitAll && App.fitAll();
    App.toast(n ? `Projet chargé avec ${n} fond${n > 1 ? 's' : ''} de plan` : (p.floors || []).some((f) => f.bg) ? 'Projet chargé — fonds de plan absents de ce fichier' : 'Projet chargé');
  };
  App.fileDel = async (key) => { const db = await idb(); if (!db) return; try { db.transaction('files', 'readwrite').objectStore('files').delete(key); } catch (e) { /* */ } };

  /* ---------- synchronisation (capacité db de l'artefact, si disponible) ---------- */
  App.cloud = {
    db: null, uid: null, ready: false, busy: false, again: false, last: 0,
    async init() {
      if (!globalThis.claude || typeof globalThis.claude.use !== 'function') return;
      try {
        const [db, user] = await Promise.all([globalThis.claude.use('db'), globalThis.claude.use('user')]);
        if (!db || !user) return; const uid = await user.id(); if (!uid) return;
        this.db = db; this.uid = uid; this.ref = db.collection('data/users/' + uid).doc('projet');
        const snap = await Promise.race([this.ref.get(), new Promise((r) => setTimeout(() => r(null), 10000))]);
        this.ready = true;
        if (snap && snap.exists) {
          const d = snap.data(); const cloudAt = d.updatedAt || 0;
          if (cloudAt > (S.p.updatedAt || 0) + 1000 || S.p.seeded) { try { const cp = App.seedPolicy(JSON.parse(d.json)); if (!(cp.seeded && S.p.seeded)) { S.p = migrate(cp); S.sel = null; App.changed(true); App.fitAll && App.fitAll(); App.toast('Projet synchronisé'); } } catch (e) { /* */ } }
        }
        App.ui && App.ui.refresh();
      } catch (e) { this.db = null; }
    },
    async push() {
      if (!this.ready || !this.ref) return;
      if (this.busy) { this.again = true; return; }
      this.busy = true;
      try { const json = JSON.stringify(S.p); if (json.length < 240000) await this.ref.set({ json, updatedAt: S.p.updatedAt || Date.now() }); this.last = Date.now(); }
      catch (e) { if (e && (e.code === 'revoked' || e.code === 'not_granted' || e.code === 'invalid_argument')) this.ready = false; }
      this.busy = false;
      if (this.again) { this.again = false; setTimeout(() => this.push(), 1500); }
    },
  };

  /* ---------- téléchargements ---------- */
  App.download = async (filename, data, mime) => {
    try {
      if (globalThis.claude && typeof globalThis.claude.use === 'function') {
        const dl = await Promise.race([globalThis.claude.use('downloads'), new Promise((r) => setTimeout(() => r(null), 2500))]);
        if (dl) { await dl.save({ filename, data }); return true; }
      }
    } catch (e) { if (e && e.code === 'declined') return false; }
    try {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return true;
    } catch (e) { return false; }
  };

  /* ---------- formes ---------- */
  App.makeShape = (kind, pts, extra = {}) => {
    pts = G.ensureCCW(pts);
    return Object.assign({ id: App.uid(), floor: S.p.floorId, kind, name: '', pts, locks: pts.map(() => ({ L: false, A: false })), locked: false, openings: [] }, extra);
  };
  App.shapeCenter = (s) => G.centroid(s.pts);
  App.fmtCm = (mm, d = 1) => (mm / 10).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: d });
  App.fmtM2 = (mm2) => (mm2 / 1e6).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  App.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.noParquetName = /bain|sdb|salle d.eau|douche|wc|toilette|buanderie|garage|cave|chaufferie|technique|local|cellier/i;
})();
