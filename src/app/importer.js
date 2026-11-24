/* Calepin — import : PDF (vectoriel), DXF, SVG, images ; fonds de plan ; baguette magique. */
(function () {
  const PL = globalThis.PL, G = PL.geom, App = globalThis.App, S = App.state, esc = App.esc;
  const $ = (id) => document.getElementById(id);
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFW = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const I = (App.importer = { st: { phase: 'idle' }, wand: { thr: 170, close: 12, thin: 0 } });
  const st = I.st;

  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Chargement impossible : ' + src)); document.head.appendChild(s); });
  let pdfjsP = null;
  I.pdfjs = () => {
    if (!pdfjsP) pdfjsP = (async () => { if (!globalThis.pdfjsLib) await loadScript(PDFJS); if (!globalThis.pdfjsWorker) { try { await loadScript(PDFW); } catch (e) { /* worker facultatif */ } } globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFW; return globalThis.pdfjsLib; })();
    return pdfjsP;
  };
  const hash = async (buf) => { try { const d = await crypto.subtle.digest('SHA-1', buf); return Array.from(new Uint8Array(d)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join(''); } catch (e) { return String(buf.byteLength) + '_' + Date.now(); } };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const setProg = (msg, frac) => { st.msg = msg; st.frac = frac; const m = $('impMsg'), p = $('impBar'); if (m) m.textContent = msg; if (p) p.style.width = Math.round((frac || 0) * 100) + '%'; };

  /* ---------- panneau ---------- */
  I.panel = () => {
    const f = App.floor(); const bg = S.bgs[f.id] || null; const meta = f.bg;
    let h = `<h2>Importer un plan</h2><p class="lead">PDF d'architecte, exports magicplan (DXF, SVG, PDF, JPG, PNG) ou photo d'un plan. Tout reste sur votre appareil.</p>
      <label class="drop"><b>Choisir un fichier</b><span>PDF · DXF · SVG · JPG · PNG · projet .json</span><input type="file" id="impFile" accept=".pdf,.dxf,.svg,.png,.jpg,.jpeg,.webp,.json,application/pdf,image/*"></label>`;
    if (st.phase === 'busy') h += `<div class="progress"><i id="impBar" style="width:${Math.round((st.frac || 0) * 100)}%"></i></div><p id="impMsg">${esc(st.msg || '')}</p>`;
    if (st.phase === 'pages') {
      h += `<h3>${esc(st.fileName)} — ${st.pages.length} pages</h3><p>Les pages qui ressemblent à des plans d'étage sont présélectionnées. Vérifiez le nom de chaque étage.</p><div class="pages">${st.pages.map((p, i) => `<div class="item"><input type="checkbox" data-pg="${i}" ${p.sel ? 'checked' : ''} aria-label="Importer la page ${i + 1}"><span class="nm">Page ${i + 1}${p.scale ? ' · 1:' + p.scale : ''}</span><span class="meta">${p.labels ? p.labels + ' surfaces' : p.kind}</span><input data-pgn="${i}" value="${esc(p.floor || '')}" placeholder="Étage" style="width:110px;height:38px;border:1px solid var(--rule);padding:0 8px;background:var(--paper);font-size:15px"></div>`).join('')}</div>
        <div class="row" style="margin-top:14px"><button class="btn primary" data-ia="pdfgo">Importer la sélection</button><button class="btn ghost" data-ia="cancel">Annuler</button></div>`;
    }
    if (st.phase === 'done' && st.report) {
      h += `<h3>Résultat</h3>${st.report.map((r) => `<div style="margin:10px 0 16px"><p style="color:var(--ink);font-weight:600;margin:0">${esc(r.floor)}</p><p>${esc(r.scale)}</p><p>${r.rooms} pièces, ${r.stairs} escalier${r.stairs > 1 ? 's' : ''}, ${r.openings} ouvertures${r.zones ? ', ' + r.zones + ' zones sous 1,80 m' : ''}.</p>${r.checks.length ? `<table class="cuts"><thead><tr><th>Pièce</th><th>Détecté</th><th>Plan</th></tr></thead><tbody>${r.checks.map((c) => `<tr><td>${esc(c.name)}</td><td>${c.area}</td><td class="${c.ok ? '' : 'r'}">${c.label ?? '—'}</td></tr>`).join('')}</tbody></table>` : ''}</div>`).join('')}
        <p class="note">Les surfaces écrites sur le plan servent de contrôle. Une pièce fusionnée avec une autre se coupe avec l'outil « Couper » ; deux pièces se fusionnent depuis l'inspecteur.</p>`;
    }
    if (st.phase === 'error') h += `<p class="note">${esc(st.msg)}</p>`;
    h += `<h3>Fond de plan de « ${esc(f.name)} »</h3>`;
    if (meta || bg) {
      h += `<p>${esc(meta ? meta.name || '' : '')}${meta && meta.k ? ' · ' + (meta.ratio ? 'échelle 1:' + meta.ratio : '1 unité = ' + (meta.k).toFixed(2) + ' mm') : ''}</p>
        <div class="field"><label>Afficher le fond</label><input type="checkbox" data-ic="fond" ${S.layers.fond ? 'checked' : ''}></div>
        <div class="row" style="margin:10px 0"><button class="btn sm" data-ia="calib">Étalonner avec une cote</button><button class="btn sm" data-ia="wand">Baguette magique</button><button class="btn sm ghost" data-ia="rmbg">Retirer le fond</button></div>
        <details><summary>Réglages de la baguette</summary>
          <div class="field"><label>Seuil du trait</label><input type="range" min="60" max="240" value="${I.wand.thr}" data-ic="thr"></div>
          <div class="field"><label>Fermer les passages jusqu'à</label><div class="unit"><input data-ic="close" inputmode="decimal" value="${I.wand.close}"><span>cm</span></div></div>
          <div class="field"><label>Ignorer les traits plus fins que</label><div class="unit"><input data-ic="thin" inputmode="decimal" value="${I.wand.thin}"><span>cm</span></div></div>
          <p>Si la baguette déborde par une porte, augmentez « Fermer les passages » ou tracez d'abord une forme qui ferme l'ouverture.</p></details>`;
    } else h += '<p>Aucun fond sur cet étage.</p>';
    h += `<h3>Depuis l'iPhone</h3><p>Le scan LiDAR se fait dans magicplan : exportez ensuite le plan en DXF (le plus précis), SVG, PDF ou image et importez-le ici. Un PDF d'architecte vectoriel donne directement les pièces, les cotes, les portes et les escaliers.</p>`;
    return h;
  };

  I.bind = (panel) => {
    const inp = panel.querySelector('#impFile'); if (inp) inp.onchange = () => { const f = inp.files[0]; if (f) I.handleFile(f); };
    panel.querySelectorAll('[data-pg]').forEach((c) => { c.onchange = () => { st.pages[+c.dataset.pg].sel = c.checked; }; });
    panel.querySelectorAll('[data-pgn]').forEach((c) => { c.oninput = () => { st.pages[+c.dataset.pgn].floor = c.value; }; });
    panel.querySelectorAll('[data-ic]').forEach((c) => { c.onchange = () => { const k = c.dataset.ic; if (k === 'fond') { S.layers.fond = c.checked; App.render(); } else I.wand[k] = parseFloat(String(c.value).replace(',', '.')) || 0; }; });
    panel.onclick = async (e) => {
      const b = e.target.closest('[data-ia]'); if (!b) return; const a = b.dataset.ia;
      if (a === 'pdfgo') I.importPdfPages();
      if (a === 'cancel') { st.phase = 'idle'; App.ui.refresh(); }
      if (a === 'calib') { App.ui.setTool('calib'); if (innerWidth < 900) App.ui.sheet('min'); }
      if (a === 'wand') { App.ui.setTool('wand'); if (innerWidth < 900) App.ui.sheet('min'); }
      if (a === 'rmbg') { const f = App.floor(); if (!(await App.ui.confirm('Retirer le fond', 'Le fond de plan de cet étage sera retiré. Les pièces restent.', 'Retirer'))) return; App.mutate(() => { delete f.bg; }); delete S.bgs[f.id]; App.render(); App.ui.refresh(); }
    };
  };

  /* ---------- fichiers ---------- */
  I.handleFile = async (file) => {
    const name = file.name || 'fichier'; const ext = (name.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'json') { const t = await file.text(); const p = App.migrate(JSON.parse(t)); App.mutate(() => {}); S.p = p; S.sel = null; App.changed(); App.fitAll(); App.toast('Projet chargé'); return; }
      if (ext === 'pdf' || file.type === 'application/pdf') return await I.openPdf(file);
      if (ext === 'dxf') return await I.importDxf(file);
      if (ext === 'svg' || file.type === 'image/svg+xml') return await I.importSvg(file);
      if (/^image\//.test(file.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return await I.importImage(file);
      App.toast('Format non pris en charge');
    } catch (e) { console.error(e); st.phase = 'error'; st.msg = 'Import impossible : ' + (e.message || e); App.ui.refresh(); }
  };

  const floorGuess = (lines) => {
    const big = lines.filter((l) => l.h >= 12).map((l) => l.s.toUpperCase());
    const all = big.join(' | ');
    if (/SOUS[\s-]*SOL/.test(all)) return 'Sous-sol';
    if (/\bR\.?D\.?C\b|REZ[\s-]DE[\s-]CHAUSS/.test(all)) return 'RDC';
    if (/[ÉE]TAGE|R\s*\+\s*1/.test(all)) return 'Étage';
    if (/COMBLES/.test(all)) return 'Combles';
    return '';
  };

  I.openPdf = async (file) => {
    st.phase = 'busy'; setProg('Chargement du lecteur PDF…', 0.02); App.ui.refresh();
    const lib = await I.pdfjs();
    const buf = await file.arrayBuffer(); const key = 'pdf:' + (await hash(buf));
    await App.filePut(key, buf.slice(0));
    const doc = await lib.getDocument({ data: new Uint8Array(buf), disableFontFace: true, isEvalSupported: false }).promise;
    st.doc = doc; st.key = key; st.fileName = file.name; st.pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      setProg(`Lecture de la page ${i} / ${doc.numPages}…`, i / doc.numPages * 0.9); await tick();
      const page = await doc.getPage(i); const tc = await page.getTextContent(); const vp = page.getViewport({ scale: 1 });
      const raw = tc.items.filter((it) => it.str && it.str.trim()).map((it) => { const m = [vp.transform[0] * it.transform[0] + vp.transform[2] * it.transform[1], vp.transform[1] * it.transform[0] + vp.transform[3] * it.transform[1], vp.transform[0] * it.transform[2] + vp.transform[2] * it.transform[3], vp.transform[1] * it.transform[2] + vp.transform[3] * it.transform[3], vp.transform[0] * it.transform[4] + vp.transform[2] * it.transform[5] + vp.transform[4], vp.transform[1] * it.transform[4] + vp.transform[3] * it.transform[5] + vp.transform[5]]; return { s: it.str, x: m[4], y: m[5], h: Math.hypot(m[2], m[3]), rot: Math.atan2(m[1], m[0]), w: it.width }; });
      const lines = PL.pdfvec.mergeTextLines(raw);
      const labels = lines.filter((l) => /^(SS|SH|SU|S\.?H|S\.?S|S)\s*[:=]\s*\d+[.,]\d+/i.test(l.s) || /^\d+[.,]\d+\s*m\s*[²2]$/i.test(l.s)).length;
      const sc = (lines.map((l) => l.s.match(/[ée]ch(?:elle)?\.?\s*:?\s*1\s*[:\/]\s*(\d{1,4})/i)).find(Boolean) || [])[1];
      st.pages.push({ sel: labels >= 2, labels, scale: sc ? +sc : null, floor: floorGuess(lines), kind: labels ? 'plan' : 'autre' });
    }
    // noms d'étages uniques
    const used = {}; st.pages.forEach((p) => { if (!p.sel) return; if (!p.floor) p.floor = 'Niveau'; if (used[p.floor]) p.floor += ' ' + (++used[p.floor]); else used[p.floor] = 1; });
    st.phase = 'pages'; App.ui.refresh();
  };

  I.importPdfPages = async () => {
    const lib = await I.pdfjs(); const doc = st.doc; const sel = st.pages.map((p, i) => ({ ...p, i })).filter((p) => p.sel);
    if (!sel.length) { App.toast('Sélectionnez au moins une page'); return; }
    st.phase = 'busy'; App.ui.refresh(); const report = []; let lastFloor = null;
    const before = App.snapshot();
    const order = ['Sous-sol', 'RDC', 'Étage', 'Combles'];
    for (let n = 0; n < sel.length; n++) {
      const pg = sel[n]; const base = n / sel.length, span = 1 / sel.length;
      setProg(`Page ${pg.i + 1} : extraction du dessin…`, base + span * 0.1); await tick();
      const page = await doc.getPage(pg.i + 1);
      const raw = await PL.pdfvec.extractPage(lib, page);
      const lines = PL.pdfvec.mergeTextLines(raw.texts);
      setProg(`Page ${pg.i + 1} : échelle et cotes…`, base + span * 0.25); await tick();
      const sc = PL.vec.detectScale(raw, lines);
      const k = sc.k || 25.4 / 72 * (pg.scale || 50);
      setProg(`Page ${pg.i + 1} : murs, pièces, escaliers…`, base + span * 0.4); await tick();
      const det = PL.vec.detect(raw, k, { cotes: sc.cotes, onProgress: () => {} });
      setProg(`Page ${pg.i + 1} : fond de plan…`, base + span * 0.8); await tick();
      // étage
      const name = pg.floor || 'Niveau ' + (pg.i + 1);
      let f = S.p.floors.find((x) => x.name.toLowerCase() === name.toLowerCase());
      const isNew = !f;
      if (!f) { const lvl = order.indexOf(name) >= 0 ? order.indexOf(name) - 1 : Math.max(...S.p.floors.map((x) => x.level)) + 1; f = { id: App.uid(), name, level: lvl }; S.p.floors.push(f); }
      // retire l'étage vide par défaut
      S.p.floors = S.p.floors.filter((x) => x === f || App.shapesOn(x.id).length || x.bg || sel.some((p) => p.floor === x.name));
      // anciennes formes importées de cet étage
      S.p.shapes = S.p.shapes.filter((s) => !(s.floor === f.id && s.imported));
      const added = I.addDetected(det, f.id);
      f.bg = { kind: 'pdf', key: st.key, page: pg.i + 1, k, ratio: sc.ratio, hUnits: raw.height, wUnits: raw.width, ox: 0, oy: 0, name: st.fileName + ' · p. ' + (pg.i + 1) };
      f.ceiling = f.ceiling || 250;
      await I.buildBg(f.id, { raw, page });
      report.push({ floor: name, scale: sc.method || 'échelle par défaut 1:50 — à vérifier', rooms: added.rooms.length, stairs: added.stairs, openings: added.openings, zones: added.zones, checks: added.rooms.map((r) => ({ name: r.name || 'Pièce', area: App.fmtM2(Math.abs(G.area(r.pts))), label: r.areaLabel ? r.areaLabel.toLocaleString('fr-FR') + (r.areaKind ? ' (' + r.areaKind + ')' : '') : null, ok: !r.areaLabel || Math.abs(Math.abs(G.area(r.pts)) / 1e6 - r.areaLabel) / r.areaLabel < 0.05 || (r.areaSH && Math.abs(G.area(r.pts)) / 1e6 >= r.areaSH * 0.97) })) });
      lastFloor = f;
    }
    // escaliers : sens selon la position de l'étage
    const fl = S.p.floors.slice().sort((a, b) => a.level - b.level);
    S.p.shapes.forEach((s) => { if (s.kind === 'escalier' && s.imported && s.stair && !s.stair.userSet) { const idx = fl.findIndex((x) => x.id === s.floor); s.stair.dir = idx === fl.length - 1 && fl.length > 1 ? 'descend' : 'monte'; } });
    // historique
    App.begin(); App.end(true);
    st.phase = 'done'; st.report = report;
    const prefer = S.p.floors.find((x) => /étage|etage|combles/i.test(x.name)) || lastFloor;
    S.p.floorId = prefer.id; S.sel = null; App.changed(); App.fitAll(); App.ui.refresh(); App.toast('Plan importé');
    void before;
  };

  /* ajoute au projet les éléments détectés (pièces, ouvertures, escaliers, zones) */
  I.addDetected = (det, fid) => {
    const rooms = det.rooms.map((r) => {
      const nm = r.name || 'Pièce';
      return Object.assign(App.makeShape('piece', r.pts, { name: nm, floor: fid, imported: true, areaLabel: r.areaLabel, areaKind: r.areaKind, areaSH: r.areaSH }), { parquet: !App.noParquetName.test(nm) });
    });
    let openings = 0; const links = {}; const seenOp = new Set();
    det.rooms.forEach((r, i) => {
      rooms[i].openings = (r.openings || []).map((o) => {
        const other = o.toIdx != null ? rooms[o.toIdx] : null; if (!seenOp.has(o.op)) { seenOp.add(o.op); openings++; }
        const def = PL.lib.openings.find((x) => x.id === o.type) || {};
        const op = { oid: App.uid(), type: o.type, wall: o.wall, pos: o.pos, width: o.width, to: other ? other.id : null, sw: other ? (o.prim ? 1 : 0) : 1, hinge: o.hinge || 'g', out: !!o.out, h: def.h, sill: def.sill };
        if (other) op.link = links[o.op] || (links[o.op] = App.uid());
        return op;
      });
    });
    // une porte ne se dessine qu'une fois
    const stairs = (det.stairs || []).map((s, i) => App.makeShape('escalier', s.pts, { name: 'Escalier' + (det.stairs.length > 1 ? ' ' + (i + 1) : ''), floor: fid, imported: true, stair: { dir: s.mark || 'monte', steps: s.steps } }));
    const zones = (det.zones || []).map((z) => App.makeShape('plafond', z.pts, { name: z.name || 'Sous 1,80 m', floor: fid, imported: true, hmin: z.hmin, hmax: z.hmax }));
    rooms.forEach((r) => { r.locks = r.pts.map(() => ({ L: false, A: false })); const m = PL.solver.measure(r.pts); r.locks = r.locks.map((l, i) => ({ L: false, A: Math.abs(G.deg(m.A[i]) - 90) < 0.05 || Math.abs(G.deg(m.A[i]) - 270) < 0.05 })); r.locks = PL.solver.syncLocks(r.pts, r.locks); });
    rooms.forEach((r) => { try { App.walls.fixRecesses(r); } catch (e) { console.error(e); } }); // embrasures de portes : murs redressés
    S.p.shapes.push(...rooms, ...stairs, ...zones);
    return { rooms, stairs: stairs.length, openings, zones: zones.length };
  };

  /* ---------- fonds de plan ---------- */
  I.buildBg = async (fid, opt = {}) => {
    const f = S.p.floors.find((x) => x.id === fid); const meta = f && f.bg; if (!meta) return;
    const bg = { k: meta.k, ox: meta.ox || 0, oy: meta.oy || 0, hUnits: meta.hUnits, pxPerUnit: 1, img: null };
    try {
      if (meta.kind === 'pdf') {
        const lib = await I.pdfjs(); let page = opt.page;
        if (!page) { const buf = await App.fileGet(meta.key); if (!buf) return; const doc = await lib.getDocument({ data: new Uint8Array(buf), disableFontFace: true, isEvalSupported: false }).promise; page = await doc.getPage(meta.page); }
        const vp1 = page.getViewport({ scale: 1 }); const scale = Math.min(4, 3000 / Math.max(vp1.width, vp1.height));
        const vp = page.getViewport({ scale }); const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const cx = c.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: cx, viewport: vp }).promise;
        bg.img = c; bg.pxPerUnit = scale;
        let raw = opt.raw; if (!raw) raw = await PL.pdfvec.extractPage(lib, page);
        setVectors(bg, raw, meta);
      } else if (meta.kind === 'image' || meta.kind === 'svg') {
        const blob = await App.fileGet(meta.key); if (!blob) return; const img = await loadImg(blob);
        const c = document.createElement('canvas'); const sc = Math.min(1, 3200 / Math.max(img.width, img.height)) * (meta.kind === 'svg' ? (meta.svgScale || 1) : 1);
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); const cx = c.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0, c.width, c.height);
        bg.img = c; bg.pxPerUnit = c.width / meta.wUnits;
        if (meta.kind === 'svg' && opt.raw) setVectors(bg, opt.raw, meta);
      } else if (meta.kind === 'dxf') {
        let raw = opt.raw; if (!raw) { const t = await App.fileGet(meta.key); if (!t) return; raw = PL.dxf.toRaw(t).raw; }
        setVectors(bg, raw, meta);
        // rendu raster pour la baguette
        const bb = G.bbox(bg.segs.flatMap((s) => [s.a, s.b])); const mmpp = Math.max(8, Math.max(bb.w, bb.h) / 3000);
        const c = document.createElement('canvas'); c.width = Math.ceil(bb.w / mmpp) + 20; c.height = Math.ceil(bb.h / mmpp) + 20; const cx = c.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.strokeStyle = '#000'; cx.lineWidth = 1.2; cx.beginPath();
        for (const s of bg.segs) { cx.moveTo((s.a.x - bb.x0) / mmpp + 10, (bb.y1 - s.a.y) / mmpp + 10); cx.lineTo((s.b.x - bb.x0) / mmpp + 10, (bb.y1 - s.b.y) / mmpp + 10); } cx.stroke();
        // repère image : monde = (u*mmpp + bb.x0 - 10mmpp, (H - v)... ) → on exprime en unités « image »
        bg.img = c; bg.k = mmpp; bg.pxPerUnit = 1; bg.ox = bb.x0 - 10 * mmpp; bg.hUnits = c.height; bg.oy = bb.y1 + 10 * mmpp - c.height * mmpp; bg.rasterOnly = true;
      }
    } catch (e) { console.error(e); }
    bg.bbox = bg.img ? { x0: bg.ox, y0: bg.oy, x1: bg.ox + (bg.img.width / bg.pxPerUnit) * bg.k, y1: bg.oy + bg.hUnits * bg.k } : bg.bbox;
    S.bgs[fid] = bg; App.render();
  };
  function setVectors(bg, raw, meta) {
    const k = meta.k, H = raw.height, ox = meta.ox || 0, oy = meta.oy || 0;
    const roles = raw.styles.map((s) => (s.kind === 'F' && PL.vec.lum(s.fill) > 0.8 ? 'masque' : 'ok'));
    const segs = []; for (const s of raw.segs) { if (roles[s.st] !== 'ok') continue; const a = { x: s.a.x * k + ox, y: (H - s.a.y) * k + oy }, b = { x: s.b.x * k + ox, y: (H - s.b.y) * k + oy }; if (G.dist(a, b) > 40) segs.push({ a, b }); }
    const pts = [], seen = new Set(); for (const s of segs) for (const p of [s.a, s.b]) { const key = Math.round(p.x / 3) + ',' + Math.round(p.y / 3); if (!seen.has(key)) { seen.add(key); pts.push(p); } }
    const grid = new PL.vec.Grid(500); pts.forEach((p, i) => grid.insertBox(p.x, p.y, p.x, p.y, i));
    const segGrid = new PL.vec.Grid(800); segs.forEach((s, i) => segGrid.insertBox(Math.min(s.a.x, s.b.x), Math.min(s.a.y, s.b.y), Math.max(s.a.x, s.b.x), Math.max(s.a.y, s.b.y), i));
    Object.assign(bg, { segs, pts, grid, segGrid, texts: (PL.pdfvec.mergeTextLines(raw.texts) || []).map((t) => PL.vec.textToWorld(t, raw, k)).map((t) => ({ ...t, x: t.x + ox, y: t.y + oy })) });
    if (!bg.img) bg.bbox = G.bbox(pts);
  }
  const loadImg = (blob) => new Promise((res, rej) => { const u = URL.createObjectURL(blob); const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Image illisible')); im.src = u; });
  const loading = {};
  I.ensureBg = (fid) => { const f = S.p.floors.find((x) => x.id === fid); if (!f || !f.bg || S.bgs[fid] || loading[fid]) return; loading[fid] = true; I.buildBg(fid).finally(() => { loading[fid] = false; }); };

  /* ---------- DXF ---------- */
  I.importDxf = async (file) => {
    st.phase = 'busy'; setProg('Lecture du DXF…', 0.2); App.ui.refresh(); await tick();
    const text = await file.text(); const r = PL.dxf.toRaw(text);
    setProg('Détection des pièces…', 0.5); await tick();
    const det = PL.vec.detect(r.raw, r.k, {});
    const f = App.floor(); const key = 'dxf:' + App.uid(); await App.filePut(key, text);
    S.p.shapes = S.p.shapes.filter((s) => !(s.floor === f.id && s.imported));
    const added = I.addDetected(det, f.id);
    f.bg = { kind: 'dxf', key, k: r.k, hUnits: 0, ox: 0, oy: 0, name: file.name };
    await I.buildBg(f.id, { raw: r.raw });
    App.begin(); App.end(true);
    st.phase = 'done'; st.report = [{ floor: f.name, scale: r.guessed ? 'Unités devinées (à vérifier avec une cote)' : 'Unités du fichier', rooms: added.rooms.length, stairs: added.stairs, openings: added.openings, zones: 0, checks: added.rooms.map((x) => ({ name: x.name, area: App.fmtM2(Math.abs(G.area(x.pts))), label: null, ok: true })) }];
    App.changed(); App.fitAll(); App.ui.refresh();
  };

  /* ---------- SVG ---------- */
  I.importSvg = async (file) => {
    st.phase = 'busy'; setProg('Lecture du SVG…', 0.2); App.ui.refresh(); await tick();
    const text = await file.text(); const raw = svgToRaw(text);
    const lines = PL.pdfvec.mergeTextLines(raw.texts); const sc = PL.vec.detectScale(raw, lines);
    let k = sc.k; const guessed = !k; if (!k) k = 12000 / Math.max(raw.width, raw.height);
    const det = PL.vec.detect(raw, k, { cotes: sc.cotes });
    const f = App.floor(); const key = 'svg:' + App.uid(); await App.filePut(key, new Blob([text], { type: 'image/svg+xml' }));
    S.p.shapes = S.p.shapes.filter((s) => !(s.floor === f.id && s.imported));
    const added = I.addDetected(det, f.id);
    f.bg = { kind: 'svg', key, k, hUnits: raw.height, wUnits: raw.width, ox: 0, oy: 0, name: file.name };
    await I.buildBg(f.id, { raw });
    App.begin(); App.end(true);
    st.phase = 'done'; st.report = [{ floor: f.name, scale: guessed ? 'Échelle inconnue : étalonnez avec une cote' : sc.method, rooms: added.rooms.length, stairs: added.stairs, openings: added.openings, zones: 0, checks: [] }];
    App.changed(); App.fitAll(); App.ui.refresh();
  };
  function svgToRaw(text) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml'); const svg = doc.documentElement;
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden'; host.appendChild(document.importNode(svg, true)); document.body.appendChild(host);
    const root = host.firstChild; const styles = [], sIdx = {}, segs = [], texts = [];
    const vb = root.viewBox && root.viewBox.baseVal && root.viewBox.baseVal.width ? root.viewBox.baseVal : null;
    const rootM = root.getScreenCTM(); const inv = rootM ? rootM.inverse() : null;
    const T = (el, x, y) => { const m = el.getScreenCTM(); if (!m || !inv) return { x, y }; const p = new DOMPoint(x, y).matrixTransform(m).matrixTransform(inv); return { x: p.x, y: p.y }; };
    const styleOf = (el) => { const cs = getComputedStyle(el); const key = cs.stroke + '|' + cs.strokeWidth + '|' + cs.fill; let i = sIdx[key]; if (i == null) { i = sIdx[key] = styles.length; styles.push({ key, kind: cs.stroke && cs.stroke !== 'none' ? 'S' : 'F', stroke: cs.stroke, fill: cs.fill, lw: parseFloat(cs.strokeWidth) || 1, mc: '', n: 0, len: 0 }); } return i; };
    const add = (a, b, st) => { const l = Math.hypot(b.x - a.x, b.y - a.y); if (l < 1e-6) return; segs.push({ a, b, st }); styles[st].n++; styles[st].len += l; };
    root.querySelectorAll('line,polyline,polygon,rect,path').forEach((el) => {
      const st = styleOf(el); const tag = el.tagName.toLowerCase();
      if (tag === 'line') add(T(el, +el.getAttribute('x1') || 0, +el.getAttribute('y1') || 0), T(el, +el.getAttribute('x2') || 0, +el.getAttribute('y2') || 0), st);
      else if (tag === 'rect') { const x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0, w = +el.getAttribute('width') || 0, h = +el.getAttribute('height') || 0; const q = [T(el, x, y), T(el, x + w, y), T(el, x + w, y + h), T(el, x, y + h)]; for (let i = 0; i < 4; i++) add(q[i], q[(i + 1) % 4], st); }
      else if (tag === 'polyline' || tag === 'polygon') { const nums = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number); const q = []; for (let i = 0; i + 1 < nums.length; i += 2) q.push(T(el, nums[i], nums[i + 1])); for (let i = 0; i + 1 < q.length; i++) add(q[i], q[i + 1], st); if (tag === 'polygon' && q.length > 2) add(q[q.length - 1], q[0], st); }
      else if (tag === 'path') {
        let L = 0; try { L = el.getTotalLength(); } catch (e) { return; } if (!L) return;
        const d = el.getAttribute('d') || ''; const curvy = /[CcSsQqTtAa]/.test(d);
        if (!curvy) { // segments exacts via la liste des points de sommet
          const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || []; let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = ''; const pts = [];
          const flush = () => { for (let j = 0; j + 1 < pts.length; j++) add(T(el, pts[j][0], pts[j][1]), T(el, pts[j + 1][0], pts[j + 1][1]), st); pts.length = 0; };
          while (i < tokens.length) { const t = tokens[i]; if (/[a-zA-Z]/.test(t)) { cmd = t; i++; if (cmd === 'Z' || cmd === 'z') { pts.push([sx, sy]); flush(); cx = sx; cy = sy; } continue; }
            const n = () => parseFloat(tokens[i++]);
            if (cmd === 'M' || cmd === 'm') { flush(); const x = n(), y = n(); cx = cmd === 'm' ? cx + x : x; cy = cmd === 'm' ? cy + y : y; sx = cx; sy = cy; pts.push([cx, cy]); cmd = cmd === 'm' ? 'l' : 'L'; }
            else if (cmd === 'L' || cmd === 'l') { const x = n(), y = n(); cx = cmd === 'l' ? cx + x : x; cy = cmd === 'l' ? cy + y : y; pts.push([cx, cy]); }
            else if (cmd === 'H' || cmd === 'h') { const x = n(); cx = cmd === 'h' ? cx + x : x; pts.push([cx, cy]); }
            else if (cmd === 'V' || cmd === 'v') { const y = n(); cy = cmd === 'v' ? cy + y : y; pts.push([cx, cy]); }
            else i++;
          }
          flush();
        } else { const nseg = Math.min(64, Math.max(4, Math.round(L / 5))); let prev = el.getPointAtLength(0); for (let j = 1; j <= nseg; j++) { const p = el.getPointAtLength((L * j) / nseg); add(T(el, prev.x, prev.y), T(el, p.x, p.y), st); prev = p; } }
      }
    });
    root.querySelectorAll('text').forEach((el) => { const s = (el.textContent || '').trim(); if (!s) return; let bb; try { bb = el.getBBox(); } catch (e) { return; } const m = el.getScreenCTM(); const rot = m && inv ? Math.atan2(m.b, m.a) : 0; const p = T(el, bb.x, bb.y + bb.height); texts.push({ s, x: p.x, y: p.y, h: bb.height * (m && inv ? Math.hypot(m.c, m.d) / Math.hypot(rootM.c, rootM.d) : 1), rot, w: bb.width }); });
    const bb = G.bbox(segs.flatMap((s) => [s.a, s.b]));
    host.remove();
    return { width: vb ? vb.width : bb.x1, height: vb ? vb.height : bb.y1, styles, segs, curves: [], texts };
  }

  /* ---------- image ---------- */
  I.importImage = async (file) => {
    const img = await loadImg(file); const f = App.floor(); const key = 'img:' + App.uid(); await App.filePut(key, file);
    const k = 14000 / Math.max(img.width, img.height);
    App.mutate(() => { f.bg = { kind: 'image', key, k, hUnits: img.height, wUnits: img.width, ox: 0, oy: 0, name: file.name }; });
    await I.buildBg(f.id); st.phase = 'idle'; App.fitAll(); App.ui.refresh();
    const r = await App.ui.dialog('Image importée', '<p>Étalonnez maintenant l\'échelle : mesurez sur l\'image une cote connue (un mur coté, par exemple). Ensuite, la baguette magique détecte les pièces d\'un simple toucher.</p>', [{ label: 'Plus tard', cls: 'ghost' }, { label: 'Étalonner', cls: 'primary', def: true }]);
    if (r.i === 1) { App.ui.setTool('calib'); if (innerWidth < 900) App.ui.sheet('min'); }
  };

  /* ---------- étalonnage ---------- */
  I.rescale = async (factor, anchor) => {
    const f = App.floor(); if (!f.bg) return;
    const shapes = App.shapesOn(f.id); let scaleShapes = false;
    if (shapes.length) scaleShapes = (await App.ui.dialog('Mettre aussi les pièces à l\'échelle ?', `<p>${shapes.length} éléments existent sur cet étage. S'ils viennent de ce fond, mettez-les à l'échelle avec lui.</p>`, [{ label: 'Fond seulement', cls: 'ghost' }, { label: 'Fond et pièces', cls: 'primary', def: true }])).i === 1;
    App.mutate((P) => {
      const b = f.bg; b.k *= factor; b.ox = (b.ox - anchor.x) * factor + anchor.x; b.oy = (b.oy - anchor.y) * factor + anchor.y; b.ratio = null;
      if (scaleShapes) { shapes.forEach((s) => { s.pts = s.pts.map((p) => ({ x: anchor.x + (p.x - anchor.x) * factor, y: anchor.y + (p.y - anchor.y) * factor })); s.openings && s.openings.forEach((o) => { o.pos *= factor; o.width *= factor; }); s.locks = PL.solver.syncLocks(s.pts, s.locks); }); App.pointsOn(f.id).forEach((p) => { p.x = anchor.x + (p.x - anchor.x) * factor; p.y = anchor.y + (p.y - anchor.y) * factor; }); }
    });
    delete S.bgs[f.id]; await I.buildBg(f.id); App.toast('Échelle appliquée'); App.ui.refresh();
  };

  /* ---------- baguette magique ---------- */
  I.wandAt = (w) => {
    const bg = S.bgs[S.p.floorId]; if (!bg || !bg.img) { App.toast('Pas de fond de plan sur cet étage'); return; }
    const s = bg.pxPerUnit / bg.k; // px par mm
    const toPx = (p) => ({ x: (p.x - bg.ox) * s, y: (bg.hUnits * bg.k - (p.y - bg.oy)) * s });
    const toW = (q) => ({ x: q.x / s + bg.ox, y: bg.hUnits * bg.k - q.y / s + bg.oy });
    const px = toPx(w); const iw = bg.img.width, ih = bg.img.height;
    // fenêtre locale autour du point pour aller vite
    const R = Math.round(Math.min(Math.max(iw, ih), 12000 * s)); const x0 = Math.max(0, Math.round(px.x - R)), y0 = Math.max(0, Math.round(px.y - R)), x1 = Math.min(iw, Math.round(px.x + R)), y1 = Math.min(ih, Math.round(px.y + R));
    if (px.x < 0 || px.y < 0 || px.x >= iw || px.y >= ih) { App.toast('Touchez à l\'intérieur du fond de plan'); return; }
    const data = bg.img.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, x1 - x0, y1 - y0);
    const r = PL.raster.wand(data, { x: px.x - x0, y: px.y - y0 }, { thr: I.wand.thr, closePx: (I.wand.close * 10 * s) / 2, thinPx: (I.wand.thin * 10 * s) / 2, simplify: Math.max(1.2, 15 * s) });
    if (!r.poly.length || r.poly.length < 3) { App.toast('Aucune pièce trouvée ici'); return; }
    if (r.leak) { App.toast('La zone déborde du plan : augmentez « Fermer les passages »'); return; }
    let pts = r.poly.map((q) => toW({ x: q.x + x0, y: q.y + y0 }));
    pts = G.ensureCCW(PL.raster.orthogonalize(pts)); pts = PL.vec.removeBumps(pts, I.wand.close * 10 + 150);
    const area = Math.abs(G.area(pts)); if (area < 0.3e6) { App.toast('Zone trop petite'); return; }
    let name = 'Pièce ' + (App.rooms().length + 1);
    if (bg.texts) { const t = bg.texts.filter((t) => G.pointInPoly(t, pts) && /[A-Za-zÀ-ÿ]{2,}/.test(t.s) && !/\d{3}/.test(t.s) && t.s.length < 28).sort((a, b) => b.h - a.h)[0]; if (t) name = t.s; }
    const sh = App.makeShape('piece', pts, { name, parquet: !App.noParquetName.test(name) });
    App.mutate((P) => P.shapes.push(sh)); S.sel = { id: sh.id }; App.ui.refresh(); App.toast(`${name} : ${App.fmtM2(area)} m²`);
  };
})();
