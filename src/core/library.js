/* Calepin — bibliothèque de mobilier (dimensions indicatives, en cm, largeur × profondeur) et symboles électriques. */
(function () {
  const PL = (globalThis.PL = globalThis.PL || {});
  const F = (id, cat, name, w, d, extra = {}) => ({ id, cat, name, w, d, ...extra });
  const furniture = [
    F('lit90', 'Lits', 'Lit 90 × 200', 97, 209), F('lit140', 'Lits', 'Lit 140 × 200 (type Malm)', 156, 209), F('lit160', 'Lits', 'Lit 160 × 200 (type Malm)', 176, 209),
    F('lit180', 'Lits', 'Lit 180 × 200', 196, 209), F('litbebe', 'Lits', 'Lit bébé 60 × 120', 66, 124), F('chevet', 'Lits', 'Chevet (type Malm)', 40, 48),
    F('pax50', 'Rangement', 'Armoire 50 (type Pax)', 50, 58), F('pax100', 'Rangement', 'Armoire 100 (type Pax)', 100, 58), F('pax150', 'Rangement', 'Armoire 150 (type Pax)', 150, 58),
    F('pax200', 'Rangement', 'Dressing 200 (type Pax)', 200, 58), F('dressingL', 'Rangement', 'Dressing d\'angle', 150, 150, { shape: 'L', t: 58 }),
    F('commode3', 'Rangement', 'Commode 3 tiroirs (type Malm)', 80, 48), F('commode6', 'Rangement', 'Commode 6 tiroirs (type Malm)', 160, 48), F('hemnes8', 'Rangement', 'Commode 8 tiroirs (type Hemnes)', 160, 50),
    F('besta', 'Rangement', 'Meuble TV (type Bestå)', 180, 42),
    F('table4', 'Tables', 'Table 4 pers. 140 × 78', 140, 78), F('table6', 'Tables', 'Table 6 pers. 180 × 90', 180, 90), F('table8', 'Tables', 'Table 8 pers. 235 × 100', 235, 100),
    F('tableronde', 'Tables', 'Table ronde Ø 110', 110, 110, { round: true }), F('basse', 'Tables', 'Table basse 90 × 55', 90, 55), F('chaise', 'Tables', 'Chaise', 45, 52),
    F('bureau140', 'Bureau', 'Bureau 140 × 65', 140, 65), F('bureau160', 'Bureau', 'Bureau 160 × 80', 160, 80), F('caisson', 'Bureau', 'Caisson', 36, 58), F('fauteuilbur', 'Bureau', 'Fauteuil de bureau', 65, 65, { round: true }),
    F('canape2', 'Salon', 'Canapé 2 places', 180, 90), F('canape3', 'Salon', 'Canapé 3 places', 228, 95), F('angle', 'Salon', 'Canapé d\'angle', 250, 160, { shape: 'L', t: 95 }), F('fauteuil', 'Salon', 'Fauteuil', 68, 82),
    F('piano', 'Salon', 'Piano droit (piano d\'étude)', 150, 60, { short: 'Piano droit', m: 'pianodroit' }), F('pianon', 'Salon', 'Piano numérique', 140, 40, { m: 'pianonum' }), F('banquette', 'Salon', 'Banquette de piano', 57, 33, { m: 'banquette' }),
    F('meublebas', 'Cuisine', 'Meuble bas 60', 60, 60), F('colonne', 'Cuisine', 'Colonne 60', 60, 60), F('frigo', 'Cuisine', 'Réfrigérateur', 60, 65), F('lv', 'Cuisine', 'Lave-vaisselle', 60, 60),
    F('ilot', 'Cuisine', 'Îlot 180 × 90', 180, 90, { noParquet: true }),
    // meubles vasque suspendus (cotes type Godmorgon : caisson 47 cm de profondeur, plan vasque 49 cm, dessus à 86 cm)
    F('vasque60', 'Meubles vasque', 'Meuble vasque 60 (type Godmorgon)', 63, 49, { m: 'vasque' }), F('vasque', 'Meubles vasque', 'Meuble vasque 80 (type Godmorgon)', 83, 49, { m: 'vasque' }),
    F('vasque100', 'Meubles vasque', 'Meuble vasque 100 (type Godmorgon)', 103, 49, { m: 'vasque' }), F('vasque120', 'Meubles vasque', 'Meuble vasque 120 (type Godmorgon)', 123, 49, { m: 'vasque' }),
    F('vasque120d', 'Meubles vasque', 'Meuble double vasque 120 (type Godmorgon)', 123, 49, { m: 'vasque2' }), F('vasque140d', 'Meubles vasque', 'Meuble double vasque 140 (type Godmorgon)', 143, 49, { m: 'vasque2' }),
    F('vasqueG100', 'Meubles vasque', 'Vasque à gauche 100 (type Tolken)', 102, 49, { m: 'vasqueG' }), F('vasqueD100', 'Meubles vasque', 'Vasque à droite 100 (type Tolken)', 102, 49, { m: 'vasqueD' }),
    F('vasqueG120', 'Meubles vasque', 'Vasque à gauche 120', 122, 49, { m: 'vasqueG' }), F('vasqueD120', 'Meubles vasque', 'Vasque à droite 120', 122, 49, { m: 'vasqueD' }),
    F('miroir60', 'Meubles vasque', 'Armoire de toilette 60 (type Godmorgon)', 60, 14, { m: 'miroir' }), F('miroir80', 'Meubles vasque', 'Armoire de toilette 80 (type Godmorgon)', 80, 14, { m: 'miroir' }),
    F('colonnesdb', 'Meubles vasque', 'Colonne 40 (type Godmorgon)', 40, 32, { m: 'colonnesdb' }),
    F('baignoire', 'Salle de bain', 'Baignoire 170 × 70', 170, 70, { noParquet: true }), F('douche90', 'Salle de bain', 'Douche 90 × 90', 90, 90, { noParquet: true }), F('douche120', 'Salle de bain', 'Douche 120 × 90', 120, 90, { noParquet: true }),
    F('lavelinge', 'Salle de bain', 'Lave-linge', 60, 60), F('sechelinge', 'Salle de bain', 'Sèche-linge', 60, 60), F('colonnelavage', 'Salle de bain', 'Lave-linge + sèche-linge superposés', 60, 60, { m: 'colonnelavage' }),
    F('secheserv', 'Salle de bain', 'Sèche-serviettes 50', 50, 10, { m: 'secheserv' }),
    // WC (cotes courantes du commerce)
    F('wc', 'WC', 'WC suspendu (cuvette 36 × 54)', 36, 54, { m: 'wcsusp' }), F('wccoffre', 'WC', 'WC suspendu + coffrage du bâti', 60, 74, { m: 'wccoffre' }),
    F('wcposer', 'WC', 'WC à poser (pack avec réservoir)', 37, 66, { m: 'wcposer' }), F('lavemains', 'WC', 'Lave-mains 40', 40, 25, { m: 'lavemains' }),
    // étagères (cotes IKEA)
    F('kallax14', 'Étagères', 'Étagère 1 × 4 (type Kallax)', 42, 39, { m: 'kallax', H: 147, grid: [1, 4] }), F('kallax2', 'Étagères', 'Étagère 2 × 2 (type Kallax)', 77, 39, { m: 'kallax', H: 77, grid: [2, 2] }),
    F('kallax24', 'Étagères', 'Étagère 2 × 4 (type Kallax)', 77, 39, { m: 'kallax', H: 147, grid: [2, 4] }), F('kallax4', 'Étagères', 'Étagère 4 × 4 (type Kallax)', 147, 39, { m: 'kallax', H: 147, grid: [4, 4] }),
    F('billy40', 'Étagères', 'Bibliothèque 40 (type Billy)', 40, 28, { m: 'billy', H: 202 }), F('billy', 'Étagères', 'Bibliothèque 80 (type Billy)', 80, 28, { m: 'billy', H: 202 }),
    F('ivar', 'Étagères', 'Étagère 89 × 30 (type Ivar)', 89, 30, { m: 'ivar', H: 179 }), F('ivar50', 'Étagères', 'Étagère 89 × 50 (type Ivar)', 89, 50, { m: 'ivar', H: 179 }),
    F('lack110', 'Étagères', 'Étagère murale 110 (type Lack)', 110, 26, { m: 'murale' }), F('lack30', 'Étagères', 'Étagère murale 30 (type Lack)', 30, 26, { m: 'murale' }),
    // cuisine du bon de commande : caissons 56 cm + façade 2 cm, socle 10 cm, caisson bas 78 cm, plan 3,9 cm (dessus à 91,9 cm)
    F('kfrigo60', 'Cuisine commandée', 'Colonne réfrigérateur intégré 60', 60, 58, { short: 'Frigo', m: 'kcol', k: 'frigo', ref: 'GR201178T1 · niche 178' }),
    F('kfour60', 'Cuisine commandée', 'Colonne four + micro-ondes 60', 60, 58, { short: 'Four', m: 'kcol', k: 'four', ref: 'GR201OM · four 60 + niche 38' }),
    F('kbas120', 'Cuisine commandée', 'Meuble bas 1 tiroir + 2 casseroliers 120', 120, 58, { short: 'Bas 120', m: 'kbas', k: 'tiroirs', ref: 'U12078SZ2 · ×2' }),
    F('kbas90', 'Cuisine commandée', 'Meuble bas 1 tiroir + 2 casseroliers 90', 90, 58, { short: 'Bas 90', m: 'kbas', k: 'tiroirs', ref: 'U9078SZ2' }),
    F('kbas80', 'Cuisine commandée', 'Meuble bas 1 tiroir + 2 casseroliers 80', 80, 58, { short: 'Bas 80', m: 'kbas', k: 'tiroirs', ref: 'U8078SZ2' }),
    F('ksevier90', 'Cuisine commandée', 'Meuble sous-évier 90 (2 portes)', 90, 58, { short: 'Sous-évier 90', m: 'kbas', k: 'evier', ref: 'US9078' }),
    F('kepicier30', 'Cuisine commandée', 'Meuble épicier 30', 30, 58, { short: 'Épicier', m: 'kbas', k: 'plein', ref: 'U3078Z-V' }),
    F('klv60', 'Cuisine commandée', 'Lave-vaisselle intégré 60', 60, 58, { short: 'LV', m: 'kbas', k: 'lv', ref: 'UT6078GV86 + Whirlpool' }),
    F('khaut120', 'Cuisine commandée', 'Meuble haut 120 (2 portes)', 120, 35, { short: 'Haut 120', m: 'khaut', ref: 'O12065 · h 65, posé à 146,5' }),
    F('khotte90', 'Cuisine commandée', 'Hotte cheminée 90', 90, 50, { short: 'Hotte', m: 'khotte', ref: 'Ellux EFTF19X' }),
    F('kplaque80', 'Cuisine commandée', 'Table induction 80', 80, 52, { short: 'Induction', m: 'kplaque', ref: 'Rosières RIF84DCS' }),
    F('kevier100', 'Cuisine commandée', 'Évier 100 × 50, bac à gauche', 100, 50, { short: 'Évier', m: 'kevier', ref: 'Luisina Tam Tam + mitigeur' }), F('kevier100d', 'Cuisine commandée', 'Évier 100 × 50, bac à droite', 100, 50, { short: 'Évier', m: 'kevier', k: 'D', ref: 'Luisina Tam Tam + mitigeur' }),
    F('kpdt205', 'Cuisine commandée', 'Plan de travail 205 × 60', 205, 60, { short: '', m: 'kpdt', ref: 'chêne, ép. 3,9' }),
    F('kpdt220', 'Cuisine commandée', 'Plan de travail 220 × 64', 220, 64, { short: '', m: 'kpdt', ref: 'chêne, ép. 3,9' }),
    F('kpdt313', 'Cuisine commandée', 'Plan de travail 312,6 × 94', 312.6, 94, { short: '', m: 'kpdt', ref: 'chêne, ép. 3,9 · avancée' }),
    F('kjoue61', 'Cuisine commandée', 'Joue 61 × 88', 1.6, 61, { short: '', m: 'kpanneau', z: [0, 880], ref: 'panneau 1,6' }),
    F('kjoue82', 'Cuisine commandée', 'Joue 82 × 88', 1.6, 82, { short: '', m: 'kpanneau', z: [0, 880], ref: 'panneau 1,6' }),
    F('khab135', 'Cuisine commandée', 'Habillage arrière 135 × 78', 135, 1.6, { short: '', m: 'kpanneau', z: [100, 880], ref: 'panneau 1,6' }),
    F('khab180', 'Cuisine commandée', 'Habillage arrière 180 × 78', 180, 1.6, { short: '', m: 'kpanneau', z: [100, 880], ref: 'panneau 1,6' }),
  ];
  const structure = [
    F('poteau20', 'Structure', 'Poteau 20 × 20', 20, 20, { kind: 'poteau' }), F('poteau30', 'Structure', 'Poteau 30 × 30', 30, 30, { kind: 'poteau' }),
    F('poteaurond', 'Structure', 'Poteau rond Ø 20', 20, 20, { kind: 'poteau', round: true }), F('muret', 'Structure', 'Muret / cloison basse', 120, 10, { kind: 'poteau', h: 100 }), F('gaine', 'Structure', 'Gaine technique 40 × 30', 40, 30, { kind: 'exclusion' }),
    F('poele', 'Structure', 'Poêle / foyer 80 × 60', 80, 60, { kind: 'exclusion' }), F('tremie', 'Structure', 'Trémie / zone sans parquet', 100, 100, { kind: 'exclusion' }),
  ];
  const elec = [
    { id: 'prise', name: 'Prise', g: 'prise' }, { id: 'prise2', name: 'Prise double', g: 'prise2' }, { id: 'prise32', name: 'Prise 32 A (cuisson)', g: 'prise32' },
    { id: 'prisecmd', name: 'Prise commandée', g: 'prisecmd' }, { id: 'rj45', name: 'Prise RJ45', g: 'rj45' }, { id: 'tv', name: 'Prise TV', g: 'tv' }, { id: 'usb', name: 'Prise USB', g: 'usb' },
    { id: 'inter', name: 'Interrupteur', g: 'inter' }, { id: 'vv', name: 'Va-et-vient', g: 'vv' }, { id: 'bp', name: 'Bouton poussoir', g: 'bp' }, { id: 'variateur', name: 'Variateur', g: 'variateur' },
    { id: 'dcl', name: 'Point lumineux plafond', g: 'dcl' }, { id: 'applique', name: 'Applique murale', g: 'applique' }, { id: 'spot', name: 'Spot encastré', g: 'spot' },
    { id: 'eau', name: 'Arrivée d\'eau', g: 'eau' }, { id: 'evac', name: 'Évacuation', g: 'evac' },
    { id: 'tableau', name: 'Tableau électrique', g: 'tableau' }, { id: 'thermostat', name: 'Thermostat', g: 'thermostat' }, { id: 'detecteur', name: 'Détecteur de fumée', g: 'detecteur' }, { id: 'vmc', name: 'Bouche VMC', g: 'vmc' },
  ];
  const elecDefaultH = { eau: 65, evac: 45, prise: 30, prise2: 30, prise32: 12, prisecmd: 30, rj45: 30, tv: 30, usb: 110, inter: 110, vv: 110, bp: 110, variateur: 110, applique: 180, thermostat: 150, tableau: 130 };
  const openings = [
    { id: 'porte', name: 'Porte', w: 830, h: 2040 }, { id: 'porte2', name: 'Porte double', w: 1400, h: 2040 }, { id: 'coulissante', name: 'Porte coulissante', w: 830, h: 2040 },
    { id: 'galandage', name: 'Porte à galandage', w: 830, h: 2040 }, { id: 'passage', name: 'Passage libre', w: 900, h: 2100 },
    { id: 'fenetre', name: 'Fenêtre', w: 1200, h: 1250, sill: 950, widths: [60, 80, 100, 120, 140] }, { id: 'porte-fenetre', name: 'Porte-fenêtre', w: 1200, h: 2150, sill: 0, widths: [80, 90, 120, 140] },
    { id: 'baie', name: 'Baie vitrée coulissante', w: 2400, h: 2150, sill: 0, leaves: 2 }, { id: 'fixe', name: 'Châssis fixe', w: 800, h: 1200, sill: 900 },
    { id: 'velux', name: 'Velux (fenêtre de toit)', w: 780, h: 980, sill: 0, sizes: [{ code: 'CK02', w: 550, h: 780 }, { code: 'CK04', w: 550, h: 980 }, { code: 'MK04', w: 780, h: 980 }, { code: 'MK06', w: 780, h: 1180 }, { code: 'MK08', w: 780, h: 1400 }, { code: 'SK06', w: 1140, h: 1180 }, { code: 'UK04', w: 1340, h: 980 }] },
  ];
  /* références de parquet : dimensions et conditionnement relevés sur les fiches fabricant */
  const TANGER = 'https://www.alsaflooring.com/stratifie/chene-tanger/';
  const parquets = [
    { id: 'alsa-allure-909', brand: 'Alsafloor', name: 'Alsafloor Allure · Chêne Tanger 909', short: 'Chêne Tanger · Allure 214 mm', L: 1286, W: 214, T: 10, perBox: 7, m2Box: 1.926, lay: 'flottante', note: 'Stratifié 10 mm, AC6, 4 chanfreins, clic 5G', url: TANGER },
    { id: 'alsa-allurechic-909', brand: 'Alsafloor', name: 'Alsafloor Allure Chic · Chêne Tanger 909', short: 'Chêne Tanger · Allure Chic 172 mm', L: 1286, W: 172, T: 10, perBox: 7, m2Box: 1.548, lay: 'flottante', note: 'Stratifié 10 mm, lame étroite, AC6, 4 chanfreins, clic 5G', url: TANGER },
    { id: 'alsa-solidplus-909', brand: 'Alsafloor', name: 'Alsafloor Solid Plus · Chêne Tanger 909', short: 'Chêne Tanger · Solid Plus 12 mm', L: 1286, W: 214, T: 12, perBox: 6, m2Box: 1.65, lay: 'flottante', note: 'Stratifié 12 mm, AC6, 4 chanfreins, clic 5G', url: TANGER },
  ];
  /* ---------- meubles modélisés : symbole en plan et volumes 3D, dans le repère du meuble ----------
     mm ; u le long de la façade (0 → w), v de l'avant (0) vers le mur (d) ; z depuis le sol.
     Renvoie { outline (contour en plan si ce n'est pas le rectangle), plan: [{ pts, dash }], solids: [{ pts, z0, z1, round }], lines: [[[u,v,z],[u,v,z]]], dash (meuble en hauteur : contour en tirets), h } */
  const ell = (cu, cv, ru, rv, n = 28, a0 = 0, a1 = Math.PI * 2) => { const o = []; for (let k = 0; k < n; k++) { const a = a0 + ((a1 - a0) * k) / (a1 === Math.PI * 2 ? n : n - 1); o.push([cu + Math.cos(a) * ru, cv + Math.sin(a) * rv]); } return o; };
  const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const ring3 = (pts, z) => pts.map((p, k) => [[p[0], p[1], z], [pts[(k + 1) % pts.length][0], pts[(k + 1) % pts.length][1], z]]);
  // cuvette : arrière droit, avant arrondi (forme en D)
  const bowl = (u0, u1, v0, v1, back) => { const ru = (u1 - u0) / 2, cu = (u0 + u1) / 2, vb = v1 - back; return [[u0, v1], [u0, vb]].concat(ell(cu, vb, ru, vb - v0, 18, Math.PI, Math.PI * 2).slice(1, -1)).concat([[u1, vb], [u1, v1]]); };
  const tap = (cu, v, zt, M) => { M.solids.push({ pts: rect(cu - 15, v - 15, cu + 15, v + 15), z0: zt, z1: zt + 160 }, { pts: rect(cu - 12, v - 130, cu + 12, v), z0: zt + 130, z1: zt + 160 }); M.plan.push({ pts: ell(cu, v, 22, 22, 12) }); };
  const MODELS = {
    vasque: (w, d, M) => vanity(w, d, M, [w / 2], false),
    vasque2: (w, d, M) => vanity(w, d, M, [w / 4, (3 * w) / 4], false),
    vasqueG: (w, d, M) => vanity(w, d, M, [Math.min(w / 2, 280)], true),
    vasqueD: (w, d, M) => vanity(w, d, M, [Math.max(w / 2, w - 280)], true),
    miroir: (w, d, M) => { M.dash = true; M.h = 2110; M.solids.push({ pts: rect(0, 0, w, d), z0: 1150, z1: 2110 }); M.lines.push([[w / 2, 0, 1150], [w / 2, 0, 2110]]); M.plan.push({ pts: [[w / 2, 0], [w / 2, d]], open: true, dash: true }); },
    colonnesdb: (w, d, M) => { M.h = 1920; M.solids.push({ pts: rect(0, 0, w, d), z0: 0, z1: 1920 }); for (const z of [640, 1280]) M.lines.push([[0, 0, z], [w, 0, z]]); M.plan.push({ pts: [[0, 0], [w, d]], open: true }); },
    colonnelavage: (w, d, M) => { M.h = 1700; M.solids.push({ pts: rect(0, 0, w, d), z0: 0, z1: 1700 }); M.lines.push([[0, -1, 850], [w, -1, 850]]); for (const zc of [430, 1280]) { const c = ell(w / 2, zc, 160, 160, 20); c.forEach((p, k) => { const q = c[(k + 1) % c.length]; M.lines.push([[p[0], -1, p[1]], [q[0], -1, q[1]]]); }); } M.plan.push({ pts: [[0, 0], [w, d]], open: true }, { pts: [[w, 0], [0, d]], open: true }); },
    secheserv: (w, d, M) => { M.h = 1400; M.dash = false; for (const u of [0, w - 30]) M.solids.push({ pts: rect(u, 0, u + 30, d), z0: 200, z1: 1400 }); for (let z = 260; z < 1400; z += 120) M.solids.push({ pts: rect(30, d * 0.3, w - 30, d * 0.7), z0: z, z1: z + 22 }); },
    lavemains: (w, d, M) => { M.h = 900; M.solids.push({ pts: rect(0, 0, w, d), z0: 760, z1: 860 }); const b = ell(w / 2, d * 0.42, w * 0.34, d * 0.3); M.plan.push({ pts: b }); M.lines.push(...ring3(b, 862)); tap(w / 2, d - 40, 860, M); },
    wcsusp: (w, d, M) => { M.outline = bowl(0, w, 0, d, 200); const ins = bowl(60, w - 60, 70, d - 40, 160); M.plan.push({ pts: ins }); M.solids.push({ pts: M.outline, z0: 180, z1: 400 }, { pts: M.outline, z0: 400, z1: 420 }); M.lines.push(...ring3(ins, 421)); M.solids.push({ pts: rect(w / 2 - 120, d - 10, w / 2 + 120, d), z0: 1000, z1: 1150 }); M.h = 420; },
    wcposer: (w, d, M) => { const tk = 180; const B = bowl(0, w, 0, d - tk, 150); M.outline = B.slice(0, B.length - 2).concat([[w, d - tk], [w - 10, d - tk], [w - 10, d], [10, d], [10, d - tk], [0, d - tk]]); const ins = bowl(60, w - 60, 70, d - tk - 30, 120); M.plan.push({ pts: rect(10, d - tk, w - 10, d) }, { pts: ins }); M.solids.push({ pts: bowl(w * 0.22, w * 0.78, 90, d - tk - 20, 100), z0: 0, z1: 300 }, { pts: B, z0: 300, z1: 400 }, { pts: B, z0: 400, z1: 420 }, { pts: rect(10, d - tk, w - 10, d), z0: 380, z1: 800 }); M.lines.push(...ring3(ins, 421)); M.h = 800; },
    wccoffre: (w, d, M) => { const cf = 200, bw = 360, u0 = (w - bw) / 2; M.outline = [[0, d - cf], [u0, d - cf]].concat(bowl(u0, u0 + bw, 0, d - cf, 200).slice(2, -2), [[u0 + bw, d - cf], [w, d - cf], [w, d], [0, d]]); const ins = bowl(u0 + 60, u0 + bw - 60, 70, d - cf - 40, 160); M.plan.push({ pts: [[0, d - cf], [w, d - cf]], open: true }, { pts: ins }); M.solids.push({ pts: rect(0, d - cf, w, d), z0: 0, z1: 1120 }, { pts: bowl(u0, u0 + bw, 0, d - cf, 200), z0: 180, z1: 420 }, { pts: rect(w / 2 - 120, d - cf - 10, w / 2 + 120, d - cf), z0: 860, z1: 1010 }); M.lines.push(...ring3(ins, 421)); M.h = 1120; },
    kallax: (w, d, M, it) => shelf(w, d, M, (it.H || 147) * 10, it.grid || [2, 2], 38, 16, false),
    billy: (w, d, M, it) => shelf(w, d, M, (it.H || 202) * 10, [1, 6], 18, 18, true),
    ivar: (w, d, M, it) => shelf(w, d, M, (it.H || 179) * 10, [1, 5], 0, 20, false, true),
    murale: (w, d, M) => { M.dash = true; M.h = 1450; M.solids.push({ pts: rect(0, 0, w, d), z0: 1400, z1: 1450 }); },
    // piano d'étude : joues jusqu'au sol, clavier 88 touches, caisse haute de 30 cm, pupitre, couvercle à 1,24 m, 3 pédales
    pianodroit: (w, d, M) => {
      const cw = 55, du = 300; M.h = 1240;
      for (const u of [0, w - cw]) M.solids.push({ pts: rect(u, 0, u + cw, d), z0: 0, z1: 760 }, { pts: rect(u, d - du, u + cw, d), z0: 760, z1: 1220 });
      M.solids.push({ pts: rect(cw, d - 320, w - cw, d), z0: 0, z1: 40 }, { pts: rect(cw, d - 330, w - cw, d), z0: 40, z1: 640 }); // socle et panneau bas
      M.solids.push({ pts: rect(cw, 40, w - cw, d - du), z0: 640, z1: 700 }); // sommier du clavier
      keyboard(M, w, 60, 210, 700);
      M.solids.push({ pts: rect(cw, 210, w - cw, d - du), z0: 700, z1: 800 }, { pts: rect(cw, d - du, w - cw, d), z0: 640, z1: 1220 }); // cylindre et caisse haute
      M.solids.push({ pts: rect(w * 0.24, d - du - 45, w * 0.76, d - du), z0: 840, z1: 858 }, { pts: rect(w * 0.22, d - du - 18, w * 0.78, d - du), z0: 858, z1: 1080 }); // pupitre
      M.solids.push({ pts: rect(0, d - du - 12, w, d), z0: 1220, z1: 1240 }); // couvercle
      for (const k of [-1, 0, 1]) M.solids.push({ pts: rect(w / 2 + k * 65 - 13, d - 430, w / 2 + k * 65 + 13, d - 330), z0: 45, z1: 62 });
      M.plan.push({ pts: [[cw, d - du], [w - cw, d - du]], open: true }, { pts: [[cw, 0], [cw, d - du]], open: true }, { pts: [[w - cw, 0], [w - cw, d - du]], open: true });
    },
    pianonum: (w, d, M) => {
      const sw = 40, db = 230; M.h = 880;
      for (const u of [0, w - sw]) M.solids.push({ pts: rect(u, 0, u + sw, d), z0: 0, z1: 880 });
      M.solids.push({ pts: rect(sw, d - 20, w - sw, d), z0: 120, z1: 650 }, { pts: rect(sw, 0, w - sw, d - db), z0: 640, z1: 700 }, { pts: rect(sw, d - db, w - sw, d), z0: 640, z1: 880 });
      keyboard(M, w, 15, 165, 700);
      M.solids.push({ pts: rect(w * 0.2, d - db + 30, w * 0.8, d - db + 48), z0: 880, z1: 1130 });
      M.solids.push({ pts: rect(w / 2 - 140, d - 200, w / 2 + 140, d - 40), z0: 0, z1: 45 }); for (const k of [-1, 0, 1]) M.solids.push({ pts: rect(w / 2 + k * 65 - 13, d - 300, w / 2 + k * 65 + 13, d - 200), z0: 35, z1: 50 });
      M.plan.push({ pts: [[sw, d - db], [w - sw, d - db]], open: true });
    },
    banquette: (w, d, M) => { M.h = 500; M.solids.push({ pts: rect(0, 0, w, d), z0: 440, z1: 500 }); for (const [u, v] of [[20, 20], [w - 60, 20], [w - 60, d - 60], [20, d - 60]]) M.solids.push({ pts: rect(u, v, u + 40, v + 40), z0: 0, z1: 440 }); M.plan.push({ pts: rect(25, 25, w - 25, d - 25) }); },
    // cuisine : meubles bas (socle en retrait de 5 cm), colonnes, haut, hotte, plan, plaque, évier
    kbas: (w, d, M, it) => {
      M.h = 880; M.solids.push({ pts: rect(0, 50, w, d), z0: 0, z1: 100 }, { pts: rect(0, 0, w, d), z0: 100, z1: 880 });
      const fl = (z) => M.lines.push([[0, -1, z], [w, -1, z]]); M.plan.push({ pts: [[0, 20], [w, 20]], open: true });
      if (it.k === 'tiroirs') { fl(730); fl(430); }
      if (it.k === 'evier') { fl(730); M.lines.push([[w / 2, -1, 100], [w / 2, -1, 730]]); }
      if (it.k === 'lv') { M.plan.push({ pts: [[0, 20], [w, d]], open: true }, { pts: [[w, 20], [0, d]], open: true }); fl(830); }
    },
    kcol: (w, d, M, it) => {
      M.h = 2115; M.solids.push({ pts: rect(0, 50, w, d), z0: 0, z1: 100 }, { pts: rect(0, 0, w, d), z0: 100, z1: 2115 });
      M.plan.push({ pts: [[0, 0], [w, d]], open: true }, { pts: [[w, 0], [0, d]], open: true });
      const fl = (z) => M.lines.push([[0, -1, z], [w, -1, z]]), win = (z0, z1) => { const r = rect(70, z0, w - 70, z1); r.forEach((p, k) => { const q = r[(k + 1) % 4]; M.lines.push([[p[0], -1, p[1]], [q[0], -1, q[1]]]); }); };
      if (it.k === 'frigo') { fl(820); fl(1890); }
      else { fl(880); fl(1475); fl(1855); win(960, 1330); win(1540, 1800); }
    },
    khaut: (w, d, M) => { M.dash = true; M.h = 2115; M.solids.push({ pts: rect(0, 0, w, d), z0: 1465, z1: 2115 }); M.lines.push([[w / 2, -1, 1465], [w / 2, -1, 2115]]); M.plan.push({ pts: [[w / 2, 0], [w / 2, d]], open: true, dash: true }); },
    khotte: (w, d, M) => { M.dash = true; M.h = 2374; const c = rect(w / 2 - 130, d - 220, w / 2 + 130, d); M.solids.push({ pts: rect(0, 0, w, d), z0: 1490, z1: 1560 }, { pts: c, z0: 1560, z1: 2374 }); M.plan.push({ pts: c, dash: true }); },
    kpdt: (w, d, M) => { M.fill = false; M.h = 919; M.solids.push({ pts: rect(0, 0, w, d), z0: 880, z1: 919 }); },
    kplaque: (w, d, M) => { M.h = 925; M.solids.push({ pts: rect(0, 0, w, d), z0: 919, z1: 925 }); for (const [cu, cv, r] of [[w * 0.25, d * 0.3, 95], [w * 0.25, d * 0.72, 95], [w * 0.62, d * 0.5, 120], [w * 0.86, d * 0.5, 75]]) { const c = ell(cu, cv, r, r, 20); M.plan.push({ pts: c }); M.lines.push(...ring3(c, 926)); } },
    kevier: (w, d, M, it) => { const mu = it.k === 'D' ? (u) => w - u : (u) => u; M.h = 921; M.solids.push({ pts: rect(0, 0, w, d), z0: 919, z1: 921 }); const bac = rect(mu(50), 70, mu(w * 0.52), d - 70); M.plan.push({ pts: bac }); M.lines.push(...ring3(bac, 922)); for (let k = 1; k <= 5; k++) { const v = 90 + ((d - 180) * k) / 6; M.plan.push({ pts: [[mu(w * 0.58), v], [mu(w - 50), v]], open: true }); M.lines.push([[mu(w * 0.58), v, 922], [mu(w - 50), v, 922]]); } tap(mu(w * 0.29), d - 35, 921, M); },
    kpanneau: (w, d, M, it) => { const [z0, z1] = it.z || [0, 880]; M.h = z1; M.solids.push({ pts: rect(0, 0, w, d), z0, z1 }); },
  };
  // clavier 88 touches (1 220 mm) centré : touches blanches (traits) et 36 noires en relief ; repère des do en plan
  function keyboard(M, w, v0, v1, z) {
    const KW = 1220, ww = KW / 52, u0 = (w - KW) / 2, names = 'ABCDEFG';
    M.solids.push({ pts: rect(u0, v0, u0 + KW, v1), z0: z, z1: z + 20 });
    M.plan.push({ pts: rect(u0, v0, u0 + KW, v1) });
    for (let i = 1; i < 52; i++) { const u = u0 + i * ww; M.lines.push([[u, v0, z + 21], [u, v1, z + 21]]); if (names[i % 7] === 'C') M.plan.push({ pts: [[u, v0], [u, v1]], open: true }); }
    for (let i = 0; i < 51; i++) if ('ACDFG'.includes(names[i % 7])) { const c = u0 + (i + 1) * ww; M.solids.push({ pts: rect(c - 6.5, v1 - 95, c + 6.5, v1), z0: z + 20, z1: z + 32 }); }
  }
  // meuble vasque suspendu : caisson 58 cm accroché à 22 cm, plan 6 cm (vasque intégrée) ou plan 2 cm + vasque à poser
  function vanity(w, d, M, centers, vessel) {
    const z0 = 220, zc = 800, zt = vessel ? 820 : 860; M.h = zt;
    M.solids.push({ pts: rect(15, d - 470, w - 15, d), z0, z1: zc }, { pts: rect(0, 0, w, d), z0: zc, z1: zt });
    M.lines.push([[15, d - 470, (z0 + zc) / 2], [w - 15, d - 470, (z0 + zc) / 2]]);
    const n = centers.length;
    for (const cu of centers) {
      if (vessel) { const r = Math.min(220, d * 0.44); const b = ell(cu, d * 0.48, r, r, 24); M.plan.push({ pts: b }, { pts: ell(cu, d * 0.48, r - 30, r - 30, 24) }); M.solids.push({ pts: b, z0: zt, z1: zt + 140, round: true }); tap(cu, d - 30, zt, M); continue; }
      const ru = Math.min(n > 1 ? w * 0.17 : w * 0.32, 230), rv = Math.min(d * 0.3, 160); const b = ell(cu, d * 0.44, ru, rv); M.plan.push({ pts: b }); M.lines.push(...ring3(b, zt + 1)); tap(cu, d - 45, zt, M);
    }
  }
  // étagère : montants (ou échelles d'angle), tablettes réparties ; grid [colonnes, rangées]
  function shelf(w, d, M, H, grid, t, tin, back, posts) {
    const [cols, rows] = grid; M.h = H; const T = t || tin;
    if (posts) for (const [u, v] of [[0, 0], [w - 34, 0], [0, d - 34], [w - 34, d - 34]]) { M.solids.push({ pts: rect(u, v, u + 34, v + 34), z0: 0, z1: H }); M.plan.push({ pts: rect(u, v, u + 34, v + 34) }); }
    else for (const u of [0, w - T]) M.solids.push({ pts: rect(u, 0, u + T, d), z0: 0, z1: H });
    for (let k = 1; k < cols; k++) { const u = T + ((w - 2 * T) * k) / cols - tin / 2; M.solids.push({ pts: rect(u, 0, u + tin, d), z0: T, z1: H - T }); M.plan.push({ pts: [[u + tin / 2, 0], [u + tin / 2, d]], open: true }); }
    const z0 = posts ? 120 : 0;
    for (let k = 0; k <= rows; k++) { const top = k === rows, bot = k === 0; const th = top || bot ? T : tin; const z = z0 + ((H - z0 - th) * k) / rows; M.solids.push({ pts: rect(posts ? 0 : T, 0, posts ? w : w - T, d), z0: z, z1: z + th }); }
    if (back) M.solids.push({ pts: rect(T, d - 6, w - T, d), z0: 0, z1: H });
    if (!posts) M.plan.push({ pts: [[T, 0], [w - T, 0]], open: true });
  }
  PL.furnModel = (id, w, d) => {
    const it = furniture.find((x) => x.id === id); if (!it || !it.m || !MODELS[it.m]) return null;
    const M = { outline: null, plan: [], solids: [], lines: [], dash: false, fill: true, h: 0 }; MODELS[it.m](w, d, M, it); return M;
  };

  /* cuisine du plan Darty, en mm depuis l'angle intérieur : x le long du mur des colonnes (mur 3), y le long du mur de la fenêtre (mur 4).
     back : côté du dos (S = mur 3, W = mur 4, N = côté bar de la presqu'île). Points : mur, distance à l'angle, hauteur (cm), symbole, note. */
  const kitchen = {
    items: [
      ['kbas80', 700, 1500, 0, 580, 'S'], ['kbas120', 1500, 2700, 0, 580, 'S'], ['kfour60', 2700, 3300, 0, 580, 'S'], ['kfrigo60', 3300, 3900, 0, 580, 'S'],
      ['khaut120', 373, 1573, 0, 350, 'S'], ['khotte90', 1680, 2580, 0, 500, 'S'], ['kpdt205', 640, 2690, 0, 600, 'S'], ['kplaque80', 1720, 2520, 40, 560, 'S'],
      ['kjoue61', 0, 610, 634, 650, 'W'], ['klv60', 0, 580, 650, 1250, 'W'], ['ksevier90', 0, 580, 1250, 2150, 'W'], ['kevier100d', 70, 570, 965, 1965, 'W'], ['kpdt220', 0, 640, 0, 2200, 'W'],
      ['kbas120', 693, 1893, 2226, 2806, 'N'], ['kepicier30', 1893, 2193, 2226, 2806, 'N'], ['kbas90', 2193, 3093, 2226, 2806, 'N'], ['kjoue82', 3093, 3109, 2216, 3036, 'N'],
      ['khab135', 0, 1350, 2806, 2822, 'N'], ['khab180', 1293, 3093, 2806, 2822, 'N'], ['kpdt313', 0, 3126, 2206, 3146, 'N'],
    ],
    points: [
      [3, 2130, 230, 'prise', '16 A · hotte'], [3, 3000, 150, 'prise', '16 A · micro-ondes'], [3, 400, 110, 'prise', 'plan de travail'], [3, 1500, 110, 'prise', 'plan de travail'],
      [3, 2130, 65, 'prise32', '32 A · table induction'], [3, 3000, 30, 'prise', '20 A · four'], [3, 3200, 30, 'prise', '20 A · réfrigérateur'],
      [4, 1390, 30, 'prise', '20 A · lave-vaisselle'], [4, 1500, 65, 'eau', 'eau chaude ou froide, avec vanne (mitigeur)'], [4, 1650, 65, 'eau', 'eau chaude ou froide, avec vanne (mitigeur)'],
      [4, 1570, 45, 'evac', 'évacuation PVC Ø 40 (évier)'], [4, 2700, 45, 'prise', '16 A · sortie de fil pour la prise escamotable du plan (câble 4 m)'], [4, 2700, 110, 'prise', 'plan de travail'],
    ],
    window: { at: 600, w: 1900, sill: 1100, h: 1200 },
  };
  PL.lib = { furniture, structure, elec, elecDefaultH, openings, parquets, kitchen };
})();
