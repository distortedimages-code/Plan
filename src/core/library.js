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
    F('kallax2', 'Rangement', 'Étagère 2 × 2 (type Kallax)', 77, 39), F('kallax4', 'Rangement', 'Étagère 4 × 4 (type Kallax)', 147, 39), F('billy', 'Rangement', 'Bibliothèque (type Billy)', 80, 28),
    F('besta', 'Rangement', 'Meuble TV (type Bestå)', 180, 42),
    F('table4', 'Tables', 'Table 4 pers. 140 × 78', 140, 78), F('table6', 'Tables', 'Table 6 pers. 180 × 90', 180, 90), F('table8', 'Tables', 'Table 8 pers. 235 × 100', 235, 100),
    F('tableronde', 'Tables', 'Table ronde Ø 110', 110, 110, { round: true }), F('basse', 'Tables', 'Table basse 90 × 55', 90, 55), F('chaise', 'Tables', 'Chaise', 45, 52),
    F('bureau140', 'Bureau', 'Bureau 140 × 65', 140, 65), F('bureau160', 'Bureau', 'Bureau 160 × 80', 160, 80), F('caisson', 'Bureau', 'Caisson', 36, 58), F('fauteuilbur', 'Bureau', 'Fauteuil de bureau', 65, 65, { round: true }),
    F('canape2', 'Salon', 'Canapé 2 places', 180, 90), F('canape3', 'Salon', 'Canapé 3 places', 228, 95), F('angle', 'Salon', 'Canapé d\'angle', 250, 160, { shape: 'L', t: 95 }), F('fauteuil', 'Salon', 'Fauteuil', 68, 82),
    F('piano', 'Salon', 'Piano droit', 150, 60), F('pianon', 'Salon', 'Piano numérique', 140, 40),
    F('meublebas', 'Cuisine', 'Meuble bas 60', 60, 60), F('colonne', 'Cuisine', 'Colonne 60', 60, 60), F('frigo', 'Cuisine', 'Réfrigérateur', 60, 65), F('lv', 'Cuisine', 'Lave-vaisselle', 60, 60),
    F('ilot', 'Cuisine', 'Îlot 180 × 90', 180, 90, { noParquet: true }),
    F('baignoire', 'Salle de bain', 'Baignoire 170 × 70', 170, 70, { noParquet: true }), F('douche90', 'Salle de bain', 'Douche 90 × 90', 90, 90, { noParquet: true }), F('douche120', 'Salle de bain', 'Douche 120 × 90', 120, 90, { noParquet: true }),
    F('vasque', 'Salle de bain', 'Meuble vasque 80', 80, 46), F('wc', 'Salle de bain', 'WC suspendu', 37, 55), F('lavelinge', 'Salle de bain', 'Lave-linge', 60, 60),
  ];
  const structure = [
    F('poteau20', 'Structure', 'Poteau 20 × 20', 20, 20, { kind: 'poteau' }), F('poteau30', 'Structure', 'Poteau 30 × 30', 30, 30, { kind: 'poteau' }),
    F('poteaurond', 'Structure', 'Poteau rond Ø 20', 20, 20, { kind: 'poteau', round: true }), F('gaine', 'Structure', 'Gaine technique 40 × 30', 40, 30, { kind: 'exclusion' }),
    F('poele', 'Structure', 'Poêle / foyer 80 × 60', 80, 60, { kind: 'exclusion' }), F('tremie', 'Structure', 'Trémie / zone sans parquet', 100, 100, { kind: 'exclusion' }),
  ];
  const elec = [
    { id: 'prise', name: 'Prise', g: 'prise' }, { id: 'prise2', name: 'Prise double', g: 'prise2' }, { id: 'prise32', name: 'Prise 32 A (cuisson)', g: 'prise32' },
    { id: 'prisecmd', name: 'Prise commandée', g: 'prisecmd' }, { id: 'rj45', name: 'Prise RJ45', g: 'rj45' }, { id: 'tv', name: 'Prise TV', g: 'tv' }, { id: 'usb', name: 'Prise USB', g: 'usb' },
    { id: 'inter', name: 'Interrupteur', g: 'inter' }, { id: 'vv', name: 'Va-et-vient', g: 'vv' }, { id: 'bp', name: 'Bouton poussoir', g: 'bp' }, { id: 'variateur', name: 'Variateur', g: 'variateur' },
    { id: 'dcl', name: 'Point lumineux plafond', g: 'dcl' }, { id: 'applique', name: 'Applique murale', g: 'applique' }, { id: 'spot', name: 'Spot encastré', g: 'spot' },
    { id: 'tableau', name: 'Tableau électrique', g: 'tableau' }, { id: 'thermostat', name: 'Thermostat', g: 'thermostat' }, { id: 'detecteur', name: 'Détecteur de fumée', g: 'detecteur' }, { id: 'vmc', name: 'Bouche VMC', g: 'vmc' },
  ];
  const elecDefaultH = { prise: 30, prise2: 30, prise32: 12, prisecmd: 30, rj45: 30, tv: 30, usb: 110, inter: 110, vv: 110, bp: 110, variateur: 110, applique: 180, thermostat: 150, tableau: 130 };
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
  PL.lib = { furniture, structure, elec, elecDefaultH, openings, parquets };
})();
