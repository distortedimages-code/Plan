/* Calepin — bibliothèque de mobilier (dimensions indicatives, en cm, largeur × profondeur) et symboles électriques. */
(function () {
  const PL = (globalThis.PL = globalThis.PL || {});
  const F = (id, cat, name, w, d, extra = {}) => ({ id, cat, name, w, d, ...extra });
  const SOHO_REF = 'Cedam · 2 tiroirs · dessus à 90 cm · caisson et vasque estimés';
  const furniture = [
    F('lit90', 'Lits', 'Lit 90 × 200', 97, 209), F('lit140', 'Lits', 'Lit 140 × 200 (type Malm)', 156, 209), F('lit160', 'Lits', 'Lit 160 × 200 (type Malm)', 176, 209),
    F('lit180', 'Lits', 'Lit 180 × 200', 196, 209), F('litbebe', 'Lits', 'Lit bébé 60 × 120', 66, 124),
    // chevets IKEA (cotes des fiches produit ikea.com)
    F('chevet', 'Chevets', 'Chevet Malm 2 tiroirs (IKEA)', 40, 48, { short: 'Malm', m: 'cab', cab: { H: 55, leg: 1, socle: true, rows: [['t', 1], ['t', 1]] } }),
    F('brimnes-ch', 'Chevets', 'Chevet Brimnes (IKEA)', 39, 41, { short: 'Brimnes', m: 'cab', cab: { H: 53, leg: 2, socle: true, rows: [['t', 18], ['o', 27]] } }),
    F('hemnes-ch', 'Chevets', 'Chevet Hemnes (IKEA)', 46, 35, { short: 'Hemnes', m: 'cab', cab: { H: 70, leg: 25, rows: [['o', 22], ['t', 17]], shelf: 8 } }),
    F('idanas-ch', 'Chevets', 'Chevet Idanäs (IKEA)', 47, 40, { short: 'Idanäs', m: 'cab', cab: { H: 68, leg: 17, rows: [['o', 22], ['t', 22]] } }),
    F('gursken-ch', 'Chevets', 'Chevet Gursken (IKEA)', 39, 30, { short: 'Gursken', m: 'cab', cab: { H: 67, leg: 14, rows: [['o', 26], ['t', 16]] } }),
    F('olderdalen-ch', 'Chevets', 'Chevet Olderdalen (IKEA)', 47, 43, { short: 'Olderdalen', m: 'cab', cab: { H: 80, leg: 14, rows: [['o', 20], ['p', 30], ['o', 10]] } }),
    F('knarrevik-ch', 'Chevets', 'Chevet Knarrevik (IKEA)', 37, 28, { short: 'Knarrevik', m: 'cab', cab: { H: 45, leg: 0, metal: true, rows: [['o', 1], ['o', 1.3]] } }),
    F('pax50', 'Rangement', 'Armoire 50 (type Pax)', 50, 58), F('pax100', 'Rangement', 'Armoire 100 (type Pax)', 100, 58), F('pax150', 'Rangement', 'Armoire 150 (type Pax)', 150, 58),
    F('pax200', 'Rangement', 'Dressing 200 (type Pax)', 200, 58), F('dressingL', 'Rangement', 'Dressing d\'angle', 150, 150, { shape: 'L', t: 58 }),
    F('commode3', 'Rangement', 'Commode 3 tiroirs (type Malm)', 80, 48, { m: 'cab', cab: { H: 78, leg: 2, socle: true, rows: [['t', 1], ['t', 1], ['t', 1]] } }), F('commode6', 'Rangement', 'Commode 6 tiroirs (type Malm)', 160, 48, { m: 'cab', cab: { H: 78, leg: 2, socle: true, cols: [{ rows: [['t', 1], ['t', 1], ['t', 1]] }, { rows: [['t', 1], ['t', 1], ['t', 1]] }] } }), F('hemnes8', 'Rangement', 'Commode 8 tiroirs (type Hemnes)', 160, 50, { m: 'cab', cab: { H: 131, leg: 10, rows: null, cols: [{ rows: [['t', 1], ['t', 1], ['t', 1], ['t', 0.7]] }, { rows: [['t', 1], ['t', 1], ['t', 1], ['t', 0.7]] }] } }),
    // rangements vendus sur conforama.fr (cotes de la fiche, code article en référence)
    F('cf-colonne', 'Rangement', 'Étagère colonne 4 niches, tiroir et porte (Conforama)', 30, 24, { short: 'Colonne', m: 'cab', cab: { H: 158, leg: 2, socle: true, rows: [['o', 23], ['t', 9], ['o', 30.5], ['p', 29], ['o', 29], ['o', 29]] }, ref: 'conforama.fr · code S78627361' }),
    F('cf-enfant8', 'Rangement', 'Rangement enfant 8 compartiments (Conforama)', 104, 29, { short: 'Rangement 8 cases', m: 'cab', cab: { H: 101.5, blocks: [{ h: 91, cols: [{ f: 28, rows: [['o', 1], ['o', 1], ['o', 1]] }, { f: 43, rows: [['o', 1], ['o', 1]] }, { f: 28, rows: [['o', 1], ['o', 1], ['o', 1]] }] }, { h: 10.5, cols: [{ rows: [['o', 1]] }] }] }, ref: 'conforama.fr · code B75068399' }),
    F('cf-armoire3', 'Rangement', 'Meuble 3 portes 60 × 90 (Conforama)', 60, 29.5, { short: 'Meuble 3 portes', m: 'cab', cab: { H: 90, leg: 2, socle: true, rows: [['p', 1], ['p', 1], ['p', 1]] }, ref: 'conforama.fr · code J45696588' }),
    F('besta', 'Rangement', 'Meuble TV (type Bestå)', 180, 42),
    // miroirs muraux (cotes IKEA ; ronds génériques) : hauteur de pose et sens réglables dans la fiche
    // miroirs muraux génériques : carrés, rectangulaires (debout ou couchés), ronds ; largeur dans Dimensions, hauteur dans la fiche
    F('mircar50', 'Miroirs', 'Miroir carré 50 × 50', 50, 3, { short: 'Miroir carré', m: 'mir', mi: { H: 50, shape: 'rect', fr: 20 } }),
    F('mircar60', 'Miroirs', 'Miroir carré 60 × 60', 60, 3, { short: 'Miroir carré', m: 'mir', mi: { H: 60, shape: 'rect', fr: 20 } }),
    F('mircar70', 'Miroirs', 'Miroir carré 70 × 70', 70, 3, { short: 'Miroir carré', m: 'mir', mi: { H: 70, shape: 'rect', fr: 20 } }),
    F('mirrect4060', 'Miroirs', 'Miroir rectangulaire 40 × 60', 40, 3, { short: 'Miroir', m: 'mir', mi: { H: 60, shape: 'rect', fr: 20 } }),
    F('mirrect5070', 'Miroirs', 'Miroir rectangulaire 50 × 70', 50, 3, { short: 'Miroir', m: 'mir', mi: { H: 70, shape: 'rect', fr: 20 } }),
    F('mirrect6080', 'Miroirs', 'Miroir rectangulaire 60 × 80', 60, 3, { short: 'Miroir', m: 'mir', mi: { H: 80, shape: 'rect', fr: 20 } }),
    F('mirrect6090', 'Miroirs', 'Miroir rectangulaire 60 × 90', 60, 3, { short: 'Miroir', m: 'mir', mi: { H: 90, shape: 'rect', fr: 20 } }),
    F('mirrect50150', 'Miroirs', 'Miroir rectangulaire 50 × 150 (en pied)', 50, 3, { short: 'Miroir en pied', m: 'mir', mi: { H: 150, shape: 'rect', fr: 20 } }),
    F('mirond50', 'Miroirs', 'Miroir rond Ø 50', 50, 3, { short: 'Miroir rond', m: 'mir', mi: { H: 50, shape: 'round', fr: 15 } }),
    F('mirond60', 'Miroirs', 'Miroir rond Ø 60', 60, 3, { short: 'Miroir rond', m: 'mir', mi: { H: 60, shape: 'round', fr: 15 } }),
    F('mirond70', 'Miroirs', 'Miroir rond Ø 70', 70, 3, { short: 'Miroir rond', m: 'mir', mi: { H: 70, shape: 'round', fr: 15 } }),
    F('mirond80', 'Miroirs', 'Miroir rond Ø 80', 80, 3, { short: 'Miroir rond', m: 'mir', mi: { H: 80, shape: 'round', fr: 15 } }),
    F('nissedal40', 'Miroirs', 'Miroir Nissedal 40 × 150 (IKEA)', 40, 3, { short: 'Nissedal', m: 'mir', mi: { H: 150, shape: 'rect', fr: 30 } }),
    F('nissedal65', 'Miroirs', 'Miroir Nissedal 65 × 150 (IKEA)', 65, 3, { short: 'Nissedal', m: 'mir', mi: { H: 150, shape: 'rect', fr: 30 } }),
    F('nissedal65c', 'Miroirs', 'Miroir Nissedal 65 × 65 (IKEA)', 65, 3, { short: 'Nissedal', m: 'mir', mi: { H: 65, shape: 'rect', fr: 30 } }),
    F('lindbyn60', 'Miroirs', 'Miroir Lindbyn 60 × 120, angles arrondis (IKEA)', 60, 3, { short: 'Lindbyn', m: 'mir', mi: { H: 120, shape: 'rrect', r: 90, fr: 10 } }),
    F('lindbyn40', 'Miroirs', 'Miroir Lindbyn 40 × 130, bouts ronds (IKEA)', 40, 3, { short: 'Lindbyn', m: 'mir', mi: { H: 130, shape: 'pill', fr: 10 } }),
    F('larbro', 'Miroirs', 'Miroir Lärbro 48 × 120 (IKEA)', 48, 3, { short: 'Lärbro', m: 'mir', mi: { H: 120, shape: 'rect', fr: 35 } }),
    F('table4', 'Tables', 'Table 4 pers. 140 × 78', 140, 78), F('table6', 'Tables', 'Table 6 pers. 180 × 90', 180, 90), F('table8', 'Tables', 'Table 8 pers. 235 × 100', 235, 100),
    F('tableronde', 'Tables', 'Table ronde Ø 110', 110, 110, { round: true }), F('basse', 'Tables', 'Table basse 90 × 55', 90, 55), F('basseverre', 'Tables', 'Table basse chêne et verre 80 × 80', 80, 80, { short: 'Table basse', m: 'basseverre' }), F('chaise', 'Tables', 'Chaise', 45, 52),
    // bureaux IKEA (cotes des fiches produit)
    F('micke105', 'Bureau', 'Bureau Micke 105 × 50 (IKEA)', 105, 50, { short: 'Micke', m: 'desk', dk: { H: 75, top: 20, L: { t: 'panneau' }, R: { t: 'caisson', w: 37, rows: [['o', 1], ['o', 1]] }, drawer: [[0, 1]], back: 45 } }),
    F('micke73', 'Bureau', 'Bureau Micke 73 × 50 (IKEA)', 73, 50, { short: 'Micke', m: 'desk', dk: { H: 75, top: 20, L: { t: 'panneau' }, R: { t: 'panneau' }, drawer: [[0.07, 0.93]], back: 45 } }),
    F('micke142', 'Bureau', 'Bureau Micke 142 × 50 (IKEA)', 142, 50, { short: 'Micke', m: 'desk', dk: { H: 75, top: 20, L: { t: 'panneau' }, R: { t: 'panneau' }, drawer: [[0.52, 0.97]], back: 45 } }),
    F('malm-bur', 'Bureau', 'Bureau Malm 140 × 65 (IKEA)', 140, 65, { short: 'Malm', m: 'desk', dk: { H: 73, top: 30, L: { t: 'panneau' }, R: { t: 'caisson', w: 42, rows: [['o', 1], ['o', 1], ['t', 0.55]] }, back: 30 } }),
    F('lagk140', 'Bureau', 'Bureau Lagkapten / Alex 140 × 60 (IKEA)', 140, 60, { short: 'Lagkapten / Alex', m: 'desk', dk: { H: 73, top: 30, L: { t: 'caisson', w: 36, d: 58, rows: [['t', 1], ['t', 1], ['t', 1], ['t', 1], ['t', 1]] }, R: { t: 'caisson', w: 36, d: 58, rows: [['p', 1]] } } }),
    F('lagk200', 'Bureau', 'Bureau Lagkapten / Alex 200 × 60 (IKEA)', 200, 60, { short: 'Lagkapten / Alex', m: 'desk', dk: { H: 73, top: 30, L: { t: 'caisson', w: 36, d: 58, rows: [['t', 1], ['t', 1], ['t', 1], ['t', 1], ['t', 1]] }, R: { t: 'caisson', w: 36, d: 58, rows: [['p', 1]] } } }),
    F('pahl', 'Bureau', 'Bureau enfant Påhl 96 × 58, réglable (IKEA)', 96, 58, { short: 'Påhl', m: 'desk', dk: { H: 72, Hs: [59, 66, 72], top: 22, L: { t: 'treteau' }, R: { t: 'treteau' } }, ref: 'hauteur 59, 66 ou 72 cm' }),
    // bureaux vendus sur conforama.fr
    F('cf-noah', 'Bureau', 'Bureau Noah pin massif, 2 tiroirs (Conforama)', 110, 54, { short: 'Noah', m: 'desk', dk: { H: 75, top: 25, L: { t: 'pied' }, R: { t: 'pied' }, drawer: [[0.04, 0.49], [0.51, 0.96]] }, ref: 'conforama.fr · code U19176483' }),
    F('cf-bur110', 'Bureau', 'Bureau 110 × 50, 5 tiroirs (Conforama)', 110, 50, { short: 'Bureau 5 tiroirs', m: 'desk', dk: { H: 76, top: 25, L: { t: 'panneau' }, R: { t: 'caisson', w: 40, rows: [['o', 1.2], ['t', 1], ['t', 1], ['t', 1]] }, drawer: [[0.04, 0.96]], back: 30 }, ref: 'conforama.fr · code A42866278' }),
    F('cf-bur90', 'Bureau', 'Bureau 90 × 50 avec étagère (Conforama)', 90, 50, { short: 'Bureau 90', m: 'desk', dk: { H: 74, top: 25, L: { t: 'panneau' }, R: { t: 'caisson', w: 30, rows: [['o', 1], ['o', 1]] } }, ref: 'conforama.fr · code Z49873847' }),
    F('bureau140', 'Bureau', 'Bureau 140 × 65', 140, 65), F('bureau160', 'Bureau', 'Bureau 160 × 80', 160, 80), F('caisson', 'Bureau', 'Caisson', 36, 58), F('fauteuilbur', 'Bureau', 'Fauteuil de bureau', 65, 65, { round: true }),
    F('canape2', 'Salon', 'Canapé 2 places', 180, 90), F('canape3', 'Salon', 'Canapé 3 places', 228, 95), F('angle', 'Salon', 'Canapé d\'angle', 250, 160, { shape: 'L', t: 95 }), F('fauteuil', 'Salon', 'Fauteuil', 68, 82),
    F('piano', 'Salon', 'Piano droit (piano d\'étude)', 150, 60, { short: 'Piano droit', m: 'pianodroit' }), F('pianon', 'Salon', 'Piano numérique', 140, 40, { m: 'pianonum' }), F('banquette', 'Salon', 'Banquette de piano', 57, 33, { m: 'banquette' }),
    F('lindakra', 'Salon', 'Canapé convertible Lindåkra, méridienne à droite', 206, 87, { short: 'Lindåkra', m: 'lindakra', ref: 'couchage 200 × 80 · assise 43' }),
    F('meublebas', 'Cuisine', 'Meuble bas 60', 60, 60), F('colonne', 'Cuisine', 'Colonne 60', 60, 60), F('frigo', 'Cuisine', 'Réfrigérateur', 60, 65), F('lv', 'Cuisine', 'Lave-vaisselle', 60, 60),
    F('ilot', 'Cuisine', 'Îlot 180 × 90', 180, 90, { noParquet: true }),
    // meubles vasque suspendus (cotes type Godmorgon : caisson 47 cm de profondeur, plan vasque 49 cm, dessus à 86 cm)
    F('vasque60', 'Meubles vasque', 'Meuble vasque 60 (type Godmorgon)', 63, 49, { m: 'vasque' }), F('vasque', 'Meubles vasque', 'Meuble vasque 80 (type Godmorgon)', 83, 49, { m: 'vasque' }),
    F('vasque100', 'Meubles vasque', 'Meuble vasque 100 (type Godmorgon)', 103, 49, { m: 'vasque' }), F('vasque120', 'Meubles vasque', 'Meuble vasque 120 (type Godmorgon)', 123, 49, { m: 'vasque' }),
    F('vasque120d', 'Meubles vasque', 'Meuble double vasque 120 (type Godmorgon)', 123, 49, { m: 'vasque2' }), F('vasque140d', 'Meubles vasque', 'Meuble double vasque 140 (type Godmorgon)', 143, 49, { m: 'vasque2' }),
    F('vasqueG100', 'Meubles vasque', 'Vasque à gauche 100 (type Tolken)', 102, 49, { m: 'vasqueG' }), F('vasqueD100', 'Meubles vasque', 'Vasque à droite 100 (type Tolken)', 102, 49, { m: 'vasqueD' }),
    F('vasqueG120', 'Meubles vasque', 'Vasque à gauche 120', 122, 49, { m: 'vasqueG' }), F('vasqueD120', 'Meubles vasque', 'Vasque à droite 120', 122, 49, { m: 'vasqueD' }),
    // Cedam Soho 120 : L. 120 × P. 46 cm, 2 tiroirs (un petit en haut, un grand en bas), dessus à 90 cm (pose conseillée par Cedam)
    F('soho120c', 'Meubles vasque', 'Cedam Soho 120 · vasque centrée', 120, 46, { short: 'Soho 120', m: 'soho', so: 'c', ref: SOHO_REF }),
    F('soho120g', 'Meubles vasque', 'Cedam Soho 120 · vasque à gauche', 120, 46, { short: 'Soho 120 G', m: 'soho', so: 'g', ref: SOHO_REF }),
    F('soho120d', 'Meubles vasque', 'Cedam Soho 120 · vasque à droite', 120, 46, { short: 'Soho 120 D', m: 'soho', so: 'd', ref: SOHO_REF }),
    F('soho120l', 'Meubles vasque', 'Cedam Soho 120 · vasque large', 120, 46, { short: 'Soho 120 large', m: 'soho', so: 'l', ref: SOHO_REF }),
    F('miroir60', 'Meubles vasque', 'Armoire de toilette 60 (type Godmorgon)', 60, 14, { m: 'miroir' }), F('miroir80', 'Meubles vasque', 'Armoire de toilette 80 (type Godmorgon)', 80, 14, { m: 'miroir' }),
    F('colonnesdb', 'Meubles vasque', 'Colonne 40 (type Godmorgon)', 40, 32, { m: 'colonnesdb' }),
    F('baignoire', 'Salle de bain', 'Baignoire 170 × 70', 170, 70, { noParquet: true }), F('douche90', 'Salle de bain', 'Douche 90 × 90', 90, 90, { noParquet: true }), F('douche120', 'Salle de bain', 'Douche 120 × 90', 120, 90, { noParquet: true }),
    F('douche120it', 'Salle de bain', 'Douche à l\'italienne 120 × 90 · vitre 70', 120, 90, { short: 'Douche 120 × 90', m: 'walkin', wi: { glass: 70 }, noParquet: true, ref: 'receveur encastré à fleur du carrelage · vitre fixe 2 m' }),
    F('lavelinge', 'Salle de bain', 'Lave-linge', 60, 60), F('sechelinge', 'Salle de bain', 'Sèche-linge', 60, 60), F('colonnelavage', 'Salle de bain', 'Lave-linge + sèche-linge superposés', 60, 60, { m: 'colonnelavage' }),
    F('secheserv', 'Salle de bain', 'Sèche-serviettes 50', 50, 10, { m: 'secheserv' }),
    // WC (cotes courantes du commerce)
    F('wc', 'WC', 'WC suspendu (cuvette 36 × 54)', 36, 54, { m: 'wcsusp' }), F('wccoffre', 'WC', 'WC suspendu + coffrage du bâti', 60, 74, { m: 'wccoffre' }),
    F('wcposer', 'WC', 'WC à poser (pack avec réservoir)', 37, 66, { m: 'wcposer' }), F('lavemains', 'WC', 'Lave-mains 40', 40, 25, { m: 'lavemains' }),
    // étagères (cotes IKEA)
    F('kallax14', 'Étagères', 'Étagère 1 × 4 (type Kallax)', 41.5, 39, { m: 'kallax', H: 147, grid: [1, 4] }), F('kallax2', 'Étagères', 'Étagère 2 × 2 (type Kallax)', 76.5, 39, { m: 'kallax', H: 77, grid: [2, 2] }),
    F('kallax24', 'Étagères', 'Étagère 2 × 4 (type Kallax)', 76.5, 39, { m: 'kallax', H: 147, grid: [2, 4] }), F('kallax4', 'Étagères', 'Étagère 4 × 4 (type Kallax)', 146.5, 39, { m: 'kallax', H: 147, grid: [4, 4] }),
    F('billy40', 'Étagères', 'Bibliothèque 40 (type Billy)', 40, 28, { m: 'billy', H: 202 }), F('billy', 'Étagères', 'Bibliothèque 80 (type Billy)', 80, 28, { m: 'billy', H: 202 }),
    F('ivar', 'Étagères', 'Étagère 89 × 30 (type Ivar)', 89, 30, { m: 'ivar', H: 179 }), F('ivar50', 'Étagères', 'Étagère 89 × 50 (type Ivar)', 89, 50, { m: 'ivar', H: 179 }),
    // étagères vendues sur conforama.fr
    F('cf-samo', 'Étagères', 'Bibliothèque Samo 9 cases, 5 portes (Conforama)', 89, 29, { short: 'Samo', m: 'cab', cab: { H: 91, cols: [{ rows: [['p', 1], ['o', 1], ['p', 1]] }, { rows: [['o', 1], ['p', 1], ['o', 1]] }, { rows: [['p', 1], ['o', 1], ['p', 1]] }] }, ref: 'conforama.fr · code Q69934345' }),
    F('cf-new', 'Étagères', 'Bibliothèque New 50 × 160, 5 niveaux (Conforama)', 50, 19, { short: 'New', m: 'cab', cab: { H: 160, leg: 3, socle: true, rows: [['o', 1], ['o', 1], ['o', 1], ['o', 1], ['o', 1]] }, ref: 'conforama.fr · code H36523485' }),
    F('cf-soon', 'Étagères', 'Bibliothèque Soon 60 × 216, 5 étagères (Conforama)', 60, 40, { short: 'Soon', m: 'cab', cab: { H: 216, leg: 5, socle: true, rows: [['o', 1], ['o', 1], ['o', 1], ['o', 1], ['o', 1]] }, ref: 'conforama.fr · code W14626456' }),
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
    // ---- studio : supports (cotes fabricant) ----
    F('jaspers', 'Studio · mobilier', 'Stand Jaspers 4D-120B (4 étages)', 130, 70, { short: 'Jaspers 4D-120B', m: 'jaspers', ref: 'h 140 · entre montants 120 · prof. max 70' }),
    F('kallax24h', 'Studio · mobilier', 'Kallax 2 × 4 (couché ou debout)', 146.5, 39, { short: 'Kallax 2 × 4', m: 'kallax', grid: [2, 4], orient: 'h', ref: '147 × 77 × 39 · cases 33,5 × 33,5' }),
    F('please', 'Studio · mobilier', 'Fauteuil Steelcase Please', 66, 64, { short: 'Please', m: 'please', ref: 'assise 42 – 52 · têtière en option' }),
    F('persan', 'Studio · mobilier', 'Tapis persan', 300, 200, { short: 'Tapis persan', m: 'persan', under: true, ref: 'taille réglable dans la fiche' }),
    F('pied', 'Studio · mobilier', 'Pied d\'enceinte (tweeter à hauteur d\'oreille)', 30, 30, { short: 'Pied', m: 'pied', ref: 'plateau 20 × 23 · réglé sur l\'oreille assis' }),
    F('idasen', 'Studio · mobilier', 'Bureau assis-debout Idåsen 160 × 80', 160, 80, { short: 'Idåsen', m: 'idasen', ref: 'plateau réglable 63 – 127 cm' }),
    // ---- studio : machines, boîtiers simplifiés aux cotes du fabricant (largeur × profondeur × hauteur) ----
    ...[
      ['terra', 'synthés', 'Soma Terra', 40.5, 36.5, { h: 57, k: [6, 2, 0.1, 0.9, 0.62, 0.9], plates: [12, 0.08, 0.92, 0.12, 0.5] }],
      ['grandmother', 'synthés', 'Moog Grandmother', 58, 36.2, { h: 139, keys: { n: 19, d: 0.44, h: 70, l: 0.13, start: 'F' }, k: [9, 3, 0.03, 0.97, 0.12, 0.88] }],
      ['minifreak', 'synthés', 'Arturia MiniFreak', 57.8, 23.1, { h: 55, keys: { n: 22, d: 0.52, h: 40, l: 0.11 }, k: [12, 2, 0.04, 0.96, 0.15, 0.85], scr: [0.45, 0.55, 0.3, 0.75] }],
      ['echon6', 'synthés', 'Morphor Echon 6', 45, 18.5, { h: 53, k: [12, 3, 0.04, 0.96, 0.12, 0.88] }],
      ['perfourmer', 'synthés', 'Vermona PERfourMER MKII', 43.5, 31.5, { h: 105, step: [0.35, 45], k: [8, 4, 0.05, 0.95, 0.42, 0.95] }],
      ['malevolent', 'synthés', 'PWM Malevolent', 49, 25, { h: 80, keys: { n: 19, d: 0.45, h: 45, l: 0.12, start: 'F' }, k: [8, 3, 0.04, 0.96, 0.15, 0.85] }],
      ['medusa', 'synthés', 'Polyend / Dreadbox Medusa', 49, 21.3, { h: 54, k: [6, 4, 0.03, 0.42, 0.1, 0.9], pads: [8, 8, 0.48, 0.97, 0.08, 0.92] }],
      ['monomachine', 'synthés', 'Elektron Monomachine MKII', 34, 17.6, { h: 63, k: [8, 1, 0.3, 0.97, 0.72, 0.92], scr: [0.04, 0.26, 0.55, 0.9], pads: [16, 1, 0.05, 0.95, 0.08, 0.22] }],
      ['sidstation', 'synthés', 'Elektron SidStation', 24, 20, { h: 70, k: [4, 1, 0.1, 0.9, 0.2, 0.4], scr: [0.25, 0.75, 0.6, 0.85] }],
      ['strega', 'synthés', 'Make Noise Strega', 23, 14, { h: 19, kh: 20, k: [5, 3, 0.08, 0.92, 0.12, 0.88] }],
      ['spectravox', 'synthés', 'Moog Spectravox', 32.6, 14.3, { h: 107, step: [0.3, 60], k: [7, 3, 0.04, 0.72, 0.35, 0.95], jacks: [4, 8, 0.76, 0.97, 0.35, 0.95] }],
      ['volcamod', 'synthés', 'Korg Volca Modular', 19.3, 11.5, { h: 39, k: [6, 2, 0.05, 0.95, 0.5, 0.92], pads: [16, 1, 0.05, 0.95, 0.06, 0.22] }],
      ['op1field', 'synthés', 'Teenage Engineering OP-1 Field', 28.8, 10.2, { h: 15, kh: 10, keys: { n: 14, d: 0.5, h: 15, l: 0.02 }, k: [4, 1, 0.45, 0.95, 0.55, 0.9], scr: [0.05, 0.35, 0.55, 0.92] }],
      ['opxy', 'synthés', 'Teenage Engineering OP-XY', 28.8, 10.2, { h: 18, kh: 11, keys: { n: 14, d: 0.42, h: 18, l: 0.02 }, k: [8, 1, 0.3, 0.97, 0.55, 0.9], scr: [0.03, 0.27, 0.5, 0.92] }],
      ['pom400', 'synthés', 'Teenage Engineering POM-400', 45, 25, { h: 80, k: [8, 3, 0.05, 0.95, 0.15, 0.85], est: true }],
      ['pom170', 'synthés', 'Teenage Engineering POM-170', 30, 20, { h: 70, k: [5, 3, 0.05, 0.95, 0.15, 0.85], est: true }],
      ['kastle2', 'synthés', 'Bastl Kastle 2', 9.5, 7, { h: 45, k: [3, 2, 0.12, 0.88, 0.2, 0.8] }],
      ['roat', 'synthés', 'Soma Rumble of Ancient Times', 15, 10, { h: 35, k: [4, 1, 0.1, 0.9, 0.6, 0.85], pads: [4, 1, 0.1, 0.9, 0.12, 0.4], est: true }],
      ['theremin', 'synthés', 'Moog Etherwave (thérémine)', 63, 16, { theremin: true }],
      ['machinedrum', 'rythmiques', 'Elektron Machinedrum SPS-1 UW+', 34, 17.6, { h: 63, k: [8, 1, 0.3, 0.97, 0.72, 0.92], scr: [0.04, 0.26, 0.55, 0.9], pads: [16, 1, 0.05, 0.95, 0.08, 0.22] }],
      ['tonverk', 'rythmiques', 'Elektron Tonverk', 28.6, 17.6, { h: 63, k: [8, 1, 0.32, 0.97, 0.72, 0.92], scr: [0.04, 0.28, 0.55, 0.9], pads: [16, 1, 0.05, 0.95, 0.08, 0.22] }],
      ['pulsar23', 'rythmiques', 'Soma Pulsar-23', 38, 28, { h: 80, k: [8, 5, 0.04, 0.96, 0.1, 0.92] }],
      ['dfam', 'rythmiques', 'Moog DFAM', 31.9, 13.3, { h: 107, step: [0.3, 60], k: [8, 3, 0.04, 0.75, 0.35, 0.95], jacks: [3, 8, 0.78, 0.97, 0.35, 0.95] }],
      ['metalfet', 'rythmiques', 'Body Synths Metal Fetishist', 19, 12.4, { h: 55, k: [4, 3, 0.08, 0.92, 0.3, 0.92], sw: 1 }],
      ['sds3', 'rythmiques', 'Behringer SDS-3', 37.4, 13.6, { h: 93, step: [0.3, 55], k: [10, 4, 0.04, 0.96, 0.33, 0.95] }],
      ['monotribe', 'rythmiques', 'Korg Monotribe', 20.7, 14.5, { h: 70, step: [0.4, 40], k: [6, 2, 0.06, 0.94, 0.5, 0.92], pads: [8, 1, 0.08, 0.92, 0.08, 0.3] }],
      ['ep133', 'rythmiques', 'Teenage Engineering EP-133 K.O. II', 24, 17.6, { h: 16, kh: 10, pads: [4, 3, 0.5, 0.95, 0.08, 0.7], k: [2, 1, 0.08, 0.4, 0.75, 0.92], scr: [0.08, 0.42, 0.35, 0.65] }],
      ['po', 'rythmiques', 'Teenage Engineering Pocket Operator', 15, 7.5, { h: 6, kh: 6, k: [2, 1, 0.55, 0.95, 0.7, 0.92], pads: [4, 4, 0.06, 0.5, 0.06, 0.94], scr: [0.55, 0.95, 0.15, 0.6], est: true }],
      ['oxione', 'séquenceurs', 'OXI One MKII', 37.5, 13, { h: 19, kh: 11, pads: [16, 8, 0.2, 0.97, 0.06, 0.94], k: [4, 1, 0.03, 0.17, 0.65, 0.9], scr: [0.03, 0.17, 0.2, 0.55] }],
      ['zeroctrl', 'séquenceurs', 'Make Noise 0-Ctrl', 23, 14, { h: 19, kh: 20, k: [8, 3, 0.06, 0.94, 0.3, 0.92], pads: [8, 1, 0.06, 0.94, 0.06, 0.24] }],
      ['cosmos', 'effets', 'Soma Cosmos', 34.2, 15.3, { h: 68, k: [8, 2, 0.05, 0.95, 0.2, 0.8] }],
      ['twopole', 'effets', 'Waldorf 2-Pole', 18.5, 18.5, { h: 65, k: [3, 3, 0.15, 0.85, 0.25, 0.9] }],
      ['lossy', 'effets', 'Chase Bliss Lossy', 6.8, 12.4, { h: 60, kh: 0, k: [3, 2, 0.15, 0.85, 0.55, 0.9], sw: 2 }],
      ['lostfound', 'effets', 'Chase Bliss Lost + Found', 12, 12.4, { h: 60, kh: 0, k: [3, 2, 0.12, 0.88, 0.55, 0.9], sw: 2, est: true }],
      ['ether', 'effets', 'Soma Ether V2', 5.8, 10.3, { h: 17, kh: 0, k: [1, 2, 0.4, 0.6, 0.3, 0.7] }],
      ['ij7u', 'eurorack', 'Intellijel Performance Case 7U 104HP', 54.6, 31.2, { case7u: true, h: 83 }],
      ['af16rig', 'audio', 'Arturia AudioFuse 16Rig', 44, 26, { h: 45, k: [3, 1, 0.6, 0.95, 0.08, 0.2], scr: [0.35, 0.55, 0.05, 0.22] }],
      ['apollotwin', 'audio', 'Universal Audio Apollo Twin Duo', 16, 14.9, { h: 66, k: [1, 1, 0.3, 0.7, 0.3, 0.7], kr: 30 }],
      ['mioxl', 'audio', 'iConnectivity mioXL (19" 1U)', 48.3, 11, { h: 44, rack: 1, scr: [0.42, 0.58, 0.03, 0.2], est: true }],
      ['ada8200', 'audio', 'Behringer ADA8200 (19" 1U)', 48.3, 21.7, { h: 44, rack: 1, k: [8, 1, 0.12, 0.88, 0.04, 0.14] }],
      ['tx6', 'audio', 'Teenage Engineering TX-6', 6.2, 9, { h: 23, kh: 8, k: [6, 3, 0.1, 0.9, 0.35, 0.95], scr: [0.25, 0.75, 0.06, 0.25] }],
      ['tp7', 'audio', 'Teenage Engineering TP-7', 6.8, 9.6, { h: 16, kh: 2, reel: true, scr: [0.2, 0.8, 0.75, 0.92] }],
      ['kh120', 'enceintes', 'Neumann KH 120 (enceinte)', 18.2, 22, { spk: { h: 277, drv: [[0.5, 0.36, 0.33], [0.5, 0.78, 0.16]] } }],
      ['kh750', 'enceintes', 'Neumann KH 750 DSP (caisson)', 33, 38.3, { low: true, spk: { h: 383, drv: [[0.5, 0.48, 0.38]] } }],
      ['ob4', 'enceintes', 'Teenage Engineering OB-4', 23.3, 5.8, { spk: { h: 284, drv: [[0.5, 0.3, 0.3], [0.5, 0.66, 0.3]], handle: true } }],
      ['mbp16', 'ordinateurs', 'MacBook Pro 16" M2 Max', 35.6, 24.8, { laptop: 17, screen: 235 }],
      ['mbp15', 'ordinateurs', 'MacBook Pro 15" 2017', 34.9, 24.1, { laptop: 16, screen: 225 }],
      ['macpro13', 'ordinateurs', 'Mac Pro 2013 (cylindre)', 16.7, 16.7, { cyl: 251 }],
      ['boitier', 'synthés', 'Boîtier sur mesure (cotes à saisir)', 30, 20, { h: 60, est: true }],
    ].map(([id, cat, name, w, d, g]) => F(id, 'Studio · ' + cat, name, w, d, { m: 'gear', g, put: true, low: !!g.low, short: name.replace(/^(Soma|Moog|Arturia|Morphor|Vermona|PWM|Polyend \/ Dreadbox|Elektron|Make Noise|Korg|Teenage Engineering|Bastl|Body Synths|Behringer|OXI|Chase Bliss|Waldorf|Intellijel|Universal Audio|iConnectivity|Neumann) /, '').replace(/ \(.*\)$/, ''), ref: g.est ? 'cotes estimées, à vérifier' : '' })),
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
    { id: 'fenetre', name: 'Fenêtre', w: 1200, h: 1250, sill: 950, widths: [60, 80, 100, 120, 140] }, { id: 'sautdeloup', name: 'Fenêtre saut de loup', w: 1000, h: 600, sill: 1650, well: 500, widths: [60, 80, 100, 120] }, { id: 'porte-fenetre', name: 'Porte-fenêtre', w: 1200, h: 2150, sill: 0, widths: [80, 90, 120, 140] },
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
  const rrect = (u0, v0, u1, v1, r) => { r = Math.max(1, Math.min(r, (u1 - u0) / 2, (v1 - v0) / 2)); return [].concat(ell(u1 - r, v0 + r, r, r, 5, -Math.PI / 2, 0), ell(u1 - r, v1 - r, r, r, 5, 0, Math.PI / 2), ell(u0 + r, v1 - r, r, r, 5, Math.PI / 2, Math.PI), ell(u0 + r, v0 + r, r, r, 5, Math.PI, Math.PI * 1.5)); };
  const ccw = (P) => { let a = 0; P.forEach((p, k) => { const q = P[(k + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; }); return a < 0 ? P.slice().reverse() : P; };
  const seg3 = (pts, z, closed) => { const o = []; for (let k = 0; k < pts.length - (closed ? 0 : 1); k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; o.push([[p[0], p[1], z], [q[0], q[1], z]]); } return o; };
  const legs4 = (M, u0, u1, v0, v1, h, sz = 35, ins = 15) => { for (const [u, v] of [[u0 + ins, v0 + ins], [u1 - ins - sz, v0 + ins], [u1 - ins - sz, v1 - ins - sz], [u0 + ins, v1 - ins - sz]]) M.solids.push({ pts: rect(u, v, u + sz, v + sz), z0: 0, z1: h }); };
  // corps de caisson : flancs, dessus, fond, dos, colonnes de rangées (tiroir t, porte p, ouvert o)
  const block = (M, u0, u1, v0, v1, z0, z1, cols, o = {}) => {
    const th = 18, bk = 6;
    if (o.foot) { M.solids.push({ pts: rect(u0 + 15, v0 + 20, u1 - 15, v1 - 10), z0, z1: z0 + o.foot }); z0 += o.foot; }
    M.solids.push({ pts: rect(u0, v0, u0 + th, v1), z0, z1 }, { pts: rect(u1 - th, v0, u1, v1), z0, z1 });
    const zb = o.noBottom ? z0 : z0 + th, ztp = z1 - th;
    M.solids.push({ pts: rect(u0 + th, v0, u1 - th, v1), z0: ztp, z1 }); if (!o.noBottom) M.solids.push({ pts: rect(u0 + th, v0, u1 - th, v1), z0, z1: zb });
    M.solids.push({ pts: rect(u0 + th, v1 - bk, u1 - th, v1), z0: zb, z1: ztp });
    const iw = u1 - u0 - 2 * th, nc = cols.length, sf = cols.reduce((a, c) => a + (c.f || 1), 0), ih = ztp - zb; let cu = u0 + th;
    cols.forEach((col, ci) => {
      const cw = ((iw - (nc - 1) * th) * (col.f || 1)) / sf, rows = col.rows || [], nr = rows.length, sw = rows.reduce((a, r) => a + r[1], 0) || 1; let z = zb;
      rows.forEach(([t, wt], ri) => {
        const rh = ((ih - (nr - 1) * th) * wt) / sw;
        if (ri) M.solids.push({ pts: rect(cu, v0, cu + cw, v1 - bk), z0: z - th, z1: z });
        if (t === 't' || t === 'p') {
          M.solids.push({ pts: rect(cu + 2, v0, cu + cw - 2, v0 + 16), z0: z + 2, z1: z + rh - 2 });
          if (t === 't') { const hz = z + rh - Math.min(45, rh / 3), hw = Math.min(60, cw / 4); M.lines.push([[cu + cw / 2 - hw, v0 - 1, hz], [cu + cw / 2 + hw, v0 - 1, hz]]); }
          else { const hu = ci % 2 ? cu + 40 : cu + cw - 40, hz = z + rh / 2, hl = Math.min(60, rh / 4); M.lines.push([[hu, v0 - 1, hz - hl], [hu, v0 - 1, hz + hl]]); }
        }
        z += rh + th;
      });
      if (ci < nc - 1) M.solids.push({ pts: rect(cu + cw, v0, cu + cw + th, v1 - bk), z0: zb, z1: ztp });
      cu += cw + th;
    });
  };
  const ring3 = (pts, z) => pts.map((p, k) => [[p[0], p[1], z], [pts[(k + 1) % pts.length][0], pts[(k + 1) % pts.length][1], z]]);
  // cuvette : arrière droit, avant arrondi (forme en D)
  const bowl = (u0, u1, v0, v1, back) => { const ru = (u1 - u0) / 2, cu = (u0 + u1) / 2, vb = v1 - back; return [[u0, v1], [u0, vb]].concat(ell(cu, vb, ru, vb - v0, 18, Math.PI, Math.PI * 2).slice(1, -1)).concat([[u1, vb], [u1, v1]]); };
  const tap = (cu, v, zt, M) => { M.solids.push({ pts: rect(cu - 15, v - 15, cu + 15, v + 15), z0: zt, z1: zt + 160 }, { pts: rect(cu - 12, v - 130, cu + 12, v), z0: zt + 130, z1: zt + 160 }); M.plan.push({ pts: ell(cu, v, 22, 22, 12) }); };
  const MODELS = {
    vasque: (w, d, M) => vanity(w, d, M, [w / 2], false),
    vasque2: (w, d, M) => vanity(w, d, M, [w / 4, (3 * w) / 4], false),
    vasqueG: (w, d, M) => vanity(w, d, M, [Math.min(w / 2, 280)], true),
    vasqueD: (w, d, M) => vanity(w, d, M, [Math.max(w / 2, w - 280)], true),
    soho: (w, d, M, it) => soho(w, d, M, it.so || 'c'),
    walkin: (w, d, M, it, sh) => walkin(w, d, M, it, sh),
    miroir: (w, d, M) => { M.dash = true; M.h = 2110; M.solids.push({ pts: rect(0, 0, w, d), z0: 1150, z1: 2110 }); M.lines.push([[w / 2, 0, 1150], [w / 2, 0, 2110]]); M.plan.push({ pts: [[w / 2, 0], [w / 2, d]], open: true, dash: true }); },
    colonnesdb: (w, d, M) => { M.h = 1920; M.solids.push({ pts: rect(0, 0, w, d), z0: 0, z1: 1920 }); for (const z of [640, 1280]) M.lines.push([[0, 0, z], [w, 0, z]]); M.plan.push({ pts: [[0, 0], [w, d]], open: true }); },
    colonnelavage: (w, d, M) => { M.h = 1700; M.solids.push({ pts: rect(0, 0, w, d), z0: 0, z1: 1700 }); M.lines.push([[0, -1, 850], [w, -1, 850]]); for (const zc of [430, 1280]) { const c = ell(w / 2, zc, 160, 160, 20); c.forEach((p, k) => { const q = c[(k + 1) % c.length]; M.lines.push([[p[0], -1, p[1]], [q[0], -1, q[1]]]); }); } M.plan.push({ pts: [[0, 0], [w, d]], open: true }, { pts: [[w, 0], [0, d]], open: true }); },
    secheserv: (w, d, M) => { M.h = 1400; M.dash = false; for (const u of [0, w - 30]) M.solids.push({ pts: rect(u, 0, u + 30, d), z0: 200, z1: 1400 }); for (let z = 260; z < 1400; z += 120) M.solids.push({ pts: rect(30, d * 0.3, w - 30, d * 0.7), z0: z, z1: z + 22 }); },
    lavemains: (w, d, M) => { M.h = 900; M.solids.push({ pts: rect(0, 0, w, d), z0: 760, z1: 860 }); const b = ell(w / 2, d * 0.42, w * 0.34, d * 0.3); M.plan.push({ pts: b }); M.lines.push(...ring3(b, 862)); tap(w / 2, d - 40, 860, M); },
    wcsusp: (w, d, M) => { M.outline = bowl(0, w, 0, d, 200); const ins = bowl(60, w - 60, 70, d - 40, 160); M.plan.push({ pts: ins }); M.solids.push({ pts: M.outline, z0: 180, z1: 400 }, { pts: M.outline, z0: 400, z1: 420 }); M.lines.push(...ring3(ins, 421)); M.solids.push({ pts: rect(w / 2 - 120, d - 10, w / 2 + 120, d), z0: 1000, z1: 1150 }); M.h = 420; },
    wcposer: (w, d, M) => { const tk = 180; const B = bowl(0, w, 0, d - tk, 150); M.outline = B.slice(0, B.length - 2).concat([[w, d - tk], [w - 10, d - tk], [w - 10, d], [10, d], [10, d - tk], [0, d - tk]]); const ins = bowl(60, w - 60, 70, d - tk - 30, 120); M.plan.push({ pts: rect(10, d - tk, w - 10, d) }, { pts: ins }); M.solids.push({ pts: bowl(w * 0.22, w * 0.78, 90, d - tk - 20, 100), z0: 0, z1: 300 }, { pts: B, z0: 300, z1: 400 }, { pts: B, z0: 400, z1: 420 }, { pts: rect(10, d - tk, w - 10, d), z0: 380, z1: 800 }); M.lines.push(...ring3(ins, 421)); M.h = 800; },
    wccoffre: (w, d, M) => { const cf = 200, bw = 360, u0 = (w - bw) / 2; M.outline = [[0, d - cf], [u0, d - cf]].concat(bowl(u0, u0 + bw, 0, d - cf, 200).slice(2, -2), [[u0 + bw, d - cf], [w, d - cf], [w, d], [0, d]]); const ins = bowl(u0 + 60, u0 + bw - 60, 70, d - cf - 40, 160); M.plan.push({ pts: [[0, d - cf], [w, d - cf]], open: true }, { pts: ins }); M.solids.push({ pts: rect(0, d - cf, w, d), z0: 0, z1: 1120 }, { pts: bowl(u0, u0 + bw, 0, d - cf, 200), z0: 180, z1: 420 }, { pts: rect(w / 2 - 120, d - cf - 10, w / 2 + 120, d - cf), z0: 860, z1: 1010 }); M.lines.push(...ring3(ins, 421)); M.h = 1120; },
    // Kallax : flancs, dessus et dessous de 4 cm, cloisons et tablettes de 1,5 cm, cases égales (33,5 cm) ; dos ouvert.
    // Debout ou couché (orient) ; le dessus et chaque case sont des étages où poser une machine
    kallax: (w, d, M, it, sh) => {
      const [nc, nr] = PL.kallaxGrid(it, sh), T = 40, t = 15, H = PL.kallaxSize(nr), cw = (w - 2 * T - (nc - 1) * t) / nc, ch = (H - 2 * T - (nr - 1) * t) / nr; M.h = H;
      const U = (c) => T + c * (cw + t), Z = (r) => T + r * (ch + t);
      M.solids.push({ pts: rect(0, 0, T, d), z0: 0, z1: H }, { pts: rect(w - T, 0, w, d), z0: 0, z1: H }, { pts: rect(T, 0, w - T, d), z0: 0, z1: T }, { pts: rect(T, 0, w - T, d), z0: H - T, z1: H });
      for (let r = 1; r < nr; r++) M.solids.push({ pts: rect(T, 0, w - T, d), z0: Z(r) - t, z1: Z(r) });
      for (let r = 0; r < nr; r++) for (let c = 1; c < nc; c++) M.solids.push({ pts: rect(U(c) - t, 0, U(c), d), z0: Z(r), z1: Z(r) + ch });
      for (let c = 1; c < nc; c++) M.plan.push({ pts: [[U(c) - t / 2, 0], [U(c) - t / 2, d]], open: true, dash: true });
      M.plan.push({ pts: [[T, 0], [w - T, 0]], open: true });
      M.decks = [{ pts: rect(0, 0, w, d), z: H, name: 'dessus', top: true, th: T }];
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) M.decks.push({ pts: rect(U(c), 0, U(c) + cw, d), z: Z(r), name: `case ${r + 1}·${c + 1}`, r, th: r ? t : T });
    },
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
    // table basse carrée : pieds carrés aux angles, ceinture large de 8 cm, plateau de verre encastré dans le cadre, tablette basse pleine entre les pieds
    basseverre: (w, d, M) => {
      const H = 430, lg = 60, fr = 115, zc = H - 80, zs0 = 45, zs1 = 95; M.h = H;
      for (const [u, v] of [[0, 0], [w - lg, 0], [w - lg, d - lg], [0, d - lg]]) M.solids.push({ pts: rect(u, v, u + lg, v + lg), z0: 0, z1: zc });
      M.solids.push({ pts: rect(0, 0, w, fr), z0: zc, z1: H }, { pts: rect(0, d - fr, w, d), z0: zc, z1: H }, { pts: rect(0, fr, fr, d - fr), z0: zc, z1: H }, { pts: rect(w - fr, fr, w, d - fr), z0: zc, z1: H }); // cadre
      M.solids.push({ pts: rect(lg, lg, w - lg, d - lg), z0: zs0, z1: zs1 }); // tablette basse
      const g = rect(fr - 12, fr - 12, w - fr + 12, d - fr + 12), zg = H - 14; M.lines.push(...ring3(g, zg)); // verre posé en feuillure
      const rf = [[0.3, 0.12, 0.12, 0.3], [0.55, 0.12, 0.12, 0.55]].map(([a, b, c, e]) => [[fr + (w - 2 * fr) * a, fr + (d - 2 * fr) * b, zg], [fr + (w - 2 * fr) * c, fr + (d - 2 * fr) * e, zg]]);
      M.lines.push(...rf);
      M.plan.push({ pts: rect(fr, fr, w - fr, d - fr) }); for (const [a, b] of rf) M.plan.push({ pts: [[a[0], a[1]], [b[0], b[1]]], open: true });
      M.plan.push({ pts: rect(lg, lg, w - lg, d - lg), dash: true }); // tablette sous le verre
      M.decks = [{ pts: rect(lg, lg, w - lg, d - lg), z: zs1, name: 'tablette basse' }, { pts: rect(0, 0, w, d), z: H, name: 'plateau' }];
    },
    gear: (w, d, M, it) => gear(w, d, M, it.g),
    // stand Jaspers 4D-120B : deux flancs inclinés (montant + pied), 4 étages réglables (barre transversale + 2 bras),
    // bras de 60 cm en bas, 40 cm au-dessus ; entre montants 120 cm, h 140, profondeur max 70
    jaspers: (w, d, M, it, sh) => {
      const side = Math.max(20, (w - 1200) / 2), H = 1400, T = PL.jaspersTiers(sh).map((v) => v * 10); M.h = H; M.fill = false;
      const vup = (z) => d - 140 + (120 * z) / H;
      for (const u0 of [0, w - side]) {
        M.solids.push({ pts: rect(u0, 0, u0 + side, d), z0: 0, z1: 35 }); M.plan.push({ pts: rect(u0, 0, u0 + side, d) });
        for (let k = 0; k < 7; k++) { const za = 35 + ((H - 35) * k) / 7, zb = 35 + ((H - 35) * (k + 1)) / 7, vc = vup((za + zb) / 2); M.solids.push({ pts: rect(u0 + 8, vc - 17, u0 + side - 8, vc + 17), z0: za, z1: zb }); }
      }
      M.decks = [];
      T.forEach((z, k) => {
        const L = k === 0 ? 600 : 400, vc = vup(z), v1 = Math.min(d, vc + 20), v0 = Math.max(0, vc - L);
        M.solids.push({ pts: rect(side, vc - 15, w - side, vc + 15), z0: z - 30, z1: z - 2 });
        for (const f of [0.2, 0.8]) { const uc = w * f; M.solids.push({ pts: rect(uc - 14, v0, uc + 14, vc), z0: z - 26, z1: z }); M.plan.push({ pts: rect(uc - 14, v0, uc + 14, vc), dash: k > 0 }); }
        M.plan.push({ pts: [[side, vc], [w - side, vc]], open: true, dash: k > 0 }, { pts: [[side, v0], [w - side, v0]], open: true, dash: true });
        M.decks.push({ pts: rect(side, v0, w - side, v1), z, name: 'étage ' + (k + 1), arm: L });
      });
    },
    // fauteuil Steelcase Please : piètement 5 branches sur roulettes Ø 65, vérin, assise 455 × 460, dossier 425 incliné,
    // accoudoirs 3D, têtière en option ; hauteur d'assise 42 – 52 cm
    please: (w, d, M, it, sh) => {
      const zs = PL.chairSeat(sh) * 10, cu = w / 2, cv = d / 2, R = Math.min(w, d) / 2 - 35, top = zs + 650, head = !!(sh && sh.head);
      M.h = head ? top + 120 : top; M.outline = ell(cu, cv, w / 2, d / 2, 40);
      for (let k = 0; k < 5; k++) {
        const a = Math.PI / 2 + (k * 2 * Math.PI) / 5, D = [Math.cos(a), Math.sin(a)], N = [-D[1], D[0]], at = (r, o) => [cu + D[0] * r + N[0] * o, cv + D[1] * r + N[1] * o];
        M.solids.push({ pts: ccw([at(40, 24), at(R + 10, 15), at(R + 10, -15), at(40, -24)]), z0: 60, z1: 95 }, { pts: ell(cu + D[0] * R, cv + D[1] * R, 28, 28, 12), z0: 0, z1: 60, round: true });
        M.plan.push({ pts: [at(45, 0), at(R, 0)], open: true, dash: true });
      }
      M.solids.push({ pts: ell(cu, cv, 42, 42, 14), z0: 60, z1: 140, round: true }, { pts: ell(cu, cv, 26, 26, 12), z0: 140, z1: zs - 95, round: true });
      M.solids.push({ pts: rect(cu - 110, 200, cu + 110, 480), z0: zs - 95, z1: zs - 55 }, { pts: rrect(cu - 227, 40, cu + 227, 500, 70), z0: zs - 55, z1: zs }); // mécanisme, assise
      M.solids.push({ pts: rect(cu - 30, 470, cu + 30, 560), z0: zs - 95, z1: zs + 200 }); // lame du dossier
      // dossier : coque galbée (bords ramenés vers l'avant), en deux parties : lombaire puis épaules un peu en arrière
      const shell = (vb, hw, cur, th) => { const n = 12, F = [], B = []; for (let k = 0; k <= n; k++) { const x = -hw + (2 * hw * k) / n, v = vb - cur * (x / hw) * (x / hw); F.push([cu + x, v]); B.push([cu + x, v + th]); } return ccw(F.concat(B.reverse())); };
      const lo = shell(530, 195, 30, 38), hi = shell(552, 212, 38, 38), zm = zs + 360, vt = 552;
      M.solids.push({ pts: lo, z0: zs + 120, z1: zm, round: true }, { pts: hi, z0: zm, z1: top, round: true }); M.plan.push({ pts: hi });
      for (const sg of [-1, 1]) {
        const ua = cu + sg * 252; M.solids.push({ pts: rect(Math.min(cu + sg * 150, ua), 255, Math.max(cu + sg * 150, ua), 305), z0: zs - 95, z1: zs - 70 }, { pts: rect(ua - 18, 255, ua + 18, 305), z0: zs - 95, z1: zs + 190 });
        const pad = rrect(ua - 42, 150, ua + 42, 400, 30); M.solids.push({ pts: pad, z0: zs + 190, z1: zs + 215 }); M.plan.push({ pts: pad });
      }
      M.plan.push({ pts: rrect(cu - 227, 40, cu + 227, 500, 70) });
      if (head) { const hp = rrect(cu - 130, vt - 10, cu + 130, vt + 40, 40); M.solids.push({ pts: hp, z0: top - 30, z1: top + 120 }, { pts: rect(cu - 18, vt + 5, cu + 18, vt + 40), z0: top - 60, z1: top - 30 }); M.plan.push({ pts: hp }); }
    },
    // tapis persan : franges aux deux extrémités, bordure (filets + rinceau ondulé), champ avec médaillon central en losange, pendentifs et écoinçons
    persan: (w, d, M) => {
      const Hh = 12, longU = w >= d, L = longU ? w : d, Sd = longU ? d : w, P = (a, b) => (longU ? [a, b] : [b, a]), Pl = (A) => A.map(([a, b]) => P(a, b));
      const fr = Math.max(30, Math.min(80, L * 0.03)), a0 = fr, a1 = L - fr; M.h = Hh;
      const box = (g) => Pl(rect(a0 + g, g, a1 - g, Sd - g)); M.outline = ccw(box(0)); M.solids.push({ pts: ccw(box(0)), z0: 0, z1: Hh });
      const add = (pts, closed = true) => { M.plan.push(closed ? { pts } : { pts, open: true }); M.lines.push(...seg3(pts, Hh + 1, closed)); };
      const g1 = Sd * 0.025, g2 = Sd * 0.045, g3 = Sd * 0.12, g4 = Sd * 0.14; for (const g of [g1, g2, g3, g4]) add(box(g));
      // rinceau ondulé dans la grande bordure
      const gm = (g2 + g3) / 2, A = (g3 - g2) * 0.32, lam = Math.max(60, (g3 - g2) * 1.7);
      const wave = (pa, pb, nrm) => { const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), n = Math.max(2, Math.round(len / (lam / 8))), o = []; for (let k = 0; k <= n; k++) { const t = k / n, sv = A * Math.sin((2 * Math.PI * t * len) / lam); o.push([pa[0] + (pb[0] - pa[0]) * t + nrm[0] * sv, pa[1] + (pb[1] - pa[1]) * t + nrm[1] * sv]); } return Pl(o); };
      add(wave([a0 + gm, gm], [a1 - gm, gm], [0, 1]), false); add(wave([a0 + gm, Sd - gm], [a1 - gm, Sd - gm], [0, -1]), false);
      add(wave([a0 + gm, gm], [a0 + gm, Sd - gm], [1, 0]), false); add(wave([a1 - gm, gm], [a1 - gm, Sd - gm], [-1, 0]), false);
      // champ : médaillon, pendentifs, écoinçons
      const fa0 = a0 + g4, fa1 = a1 - g4, fb0 = g4, fb1 = Sd - g4, Lf = fa1 - fa0, Sf = fb1 - fb0, ca = (fa0 + fa1) / 2, cb = Sd / 2;
      const ra = Math.min(Lf * 0.24, Sf * 0.55), rb = Sf * 0.3;
      add(Pl([[ca - ra, cb], [ca, cb - rb], [ca + ra, cb], [ca, cb + rb]])); add(Pl([[ca - ra * 0.72, cb], [ca, cb - rb * 0.72], [ca + ra * 0.72, cb], [ca, cb + rb * 0.72]]));
      add(Pl(ell(ca, cb, ra * 0.32, rb * 0.32, 24))); add(Pl(ell(ca, cb, ra * 0.14, rb * 0.14, 16)));
      for (const sg of [-1, 1]) { const pa = ca + sg * (ra + Lf * 0.035), q = Lf * 0.03; add(Pl([[pa - q, cb], [pa, cb - q * 0.8], [pa + q, cb], [pa, cb + q * 0.8]])); }
      const ea = Math.min(Lf * 0.16, Sf * 0.3), eb = Sf * 0.24;
      for (const [xa, xb, s0] of [[fa0, fb0, 0], [fa1, fb0, Math.PI / 2], [fa1, fb1, Math.PI], [fa0, fb1, -Math.PI / 2]]) { add(Pl(ell(xa, xb, ea, eb, 10, s0, s0 + Math.PI / 2)), false); add(Pl(ell(xa, xb, ea * 0.6, eb * 0.6, 8, s0, s0 + Math.PI / 2)), false); }
      // franges
      for (let b = 20; b <= Sd - 20; b += 30) for (const [x0, x1] of [[a0, 0], [a1, L]]) { const p = [P(x0, b), P(x1, b)]; M.plan.push({ pts: p, open: true }); M.lines.push([[p[0][0], p[0][1], 2], [p[1][0], p[1][1], 2]]); }
    },
    // caisson générique (chevets, commodes, rangements, étagères) : pieds ou socle, blocs empilés de colonnes,
    // rangées tiroir « t », porte « p » ou ouvertes « o » (hauteurs relatives), dessus utilisable comme étage
    cab: (w, d, M, it) => {
      const c = it.cab, H = c.H * 10, lg = (c.leg || 0) * 10; M.h = H;
      if (c.metal) { // piètement métal fin, plateaux
        for (const [u, v] of [[0, 0], [w - 15, 0], [w - 15, d - 15], [0, d - 15]]) M.solids.push({ pts: rect(u, v, u + 15, v + 15), z0: 0, z1: H });
        const rows = c.rows, sw = rows.reduce((a, r) => a + r[1], 0); let z = 60; M.solids.push({ pts: rect(15, 15, w - 15, d - 15), z0: z, z1: z + 12 });
        for (const r of rows) { z += ((H - 72) * r[1]) / sw; M.solids.push({ pts: rect(z >= H - 15 ? 0 : 15, z >= H - 15 ? 0 : 15, z >= H - 15 ? w : w - 15, z >= H - 15 ? d : d - 15), z0: z - 12, z1: z }); }
      } else {
        if (lg) { if (c.socle) M.solids.push({ pts: rect(25, 25, w - 25, d - 15), z0: 0, z1: lg }); else legs4(M, 0, w, 0, d, lg, 36, 18); if (c.shelf) M.solids.push({ pts: rect(30, 30, w - 30, d - 30), z0: c.shelf * 10, z1: c.shelf * 10 + 15 }); }
        const blocks = c.blocks || [{ h: 1, cols: c.cols || [{ rows: c.rows }] }], sh = blocks.reduce((a, b) => a + b.h, 0); let z = lg;
        blocks.forEach((b, k) => { const bh = ((H - lg) * b.h) / sh; block(M, 0, w, 0, d, z, z + bh, b.cols, { noBottom: k > 0 }); z += bh; });
      }
      M.plan.push({ pts: [[0, 18], [w, 18]], open: true });
      M.decks = [{ pts: rect(0, 0, w, d), z: H, name: 'dessus', top: true }];
    },
    // bureau générique : plateau, appuis à gauche et à droite (pieds, panneau, tréteau, caisson), tiroirs sous plateau, voile de fond
    desk: (w, d, M, it, sh) => {
      const k = it.dk, H = PL.deskHeight(it, sh) * 10, tt = k.top || 25, zt = H - tt; M.h = H;
      M.solids.push({ pts: rect(0, 0, w, d), z0: zt, z1: H });
      const side = (sp, left) => {
        if (!sp) return 0;
        if (sp.t === 'pied') { const ls = 45, i = 30, u = left ? i : w - i - ls; for (const v of [i, d - i - ls]) { M.solids.push({ pts: rect(u, v, u + ls, v + ls), z0: 0, z1: zt }); M.plan.push({ pts: rect(u, v, u + ls, v + ls), dash: true }); } return i + ls; }
        if (sp.t === 'panneau') { const u = left ? 0 : w - 18; M.solids.push({ pts: rect(u, 0, u + 18, d), z0: 0, z1: zt }); M.plan.push({ pts: rect(u, 0, u + 18, d), dash: true }); return 18; }
        if (sp.t === 'treteau') { const ft = 32, u = left ? 45 : w - 45 - ft; M.solids.push({ pts: rect(u, 25, u + ft, d - 25), z0: 0, z1: 35 }, { pts: rect(u, 40, u + ft, 80), z0: 35, z1: zt }, { pts: rect(u, d - 80, u + ft, d - 40), z0: 35, z1: zt }, { pts: rect(u, 40, u + ft, d - 40), z0: zt - 45, z1: zt }); M.plan.push({ pts: rect(u, 25, u + ft, d - 25), dash: true }); return 45 + ft; }
        if (sp.t === 'caisson') { const cw = sp.w * 10, cd = sp.d ? Math.min(d, sp.d * 10) : d, u0 = left ? 0 : w - cw; block(M, u0, u0 + cw, (d - cd) / 2, (d + cd) / 2, 0, zt, sp.cols || [{ rows: sp.rows }], { foot: 20 }); M.plan.push({ pts: rect(u0, (d - cd) / 2, u0 + cw, (d + cd) / 2), dash: true }); return cw; }
        return 0;
      };
      const a = side(k.L, true), b = side(k.R, false), span = w - a - b;
      if (k.back) M.solids.push({ pts: rect(a, d - 30, w - b, d - 14), z0: zt - k.back * 10, z1: zt });
      for (const [f0, f1] of k.drawer || []) { const u0 = a + span * f0, u1 = a + span * f1; M.solids.push({ pts: rect(u0 + 3, 0, u1 - 3, 16), z0: zt - 105, z1: zt - 4 }, { pts: rect(u0 + 6, 16, u1 - 6, Math.min(d - 40, 420)), z0: zt - 100, z1: zt - 4 }); M.lines.push([[(u0 + u1) / 2 - 50, -1, zt - 40], [(u0 + u1) / 2 + 50, -1, zt - 40]]); }
      M.decks = [{ pts: rect(0, 0, w, d), z: H, name: 'plateau', top: true }];
    },
    // miroir mural : plaque verticale (rectangle, angles arrondis, bouts ronds ou rond), cadre et reflets ; sens et hauteur de pose réglables
    mir: (w, d, M, it, sh) => {
      const mi = it.mi, Hm = PL.mirrorH(it, sh), z0 = PL.mirrorZ(it, sh), fr = mi.fr || 20, cz = z0 + Hm / 2; M.dash = true; M.h = z0 + Hm;
      const face = (ins) => { const W = w - 2 * ins, Hh = Hm - 2 * ins, u0 = ins, v0 = z0 + ins; if (W < 4 || Hh < 4) return null;
        if (mi.shape === 'round') return ell(w / 2, cz, W / 2, Hh / 2, 40);
        if (mi.shape === 'pill' || mi.shape === 'rrect') return rrect(u0, v0, u0 + W, v0 + Hh, mi.shape === 'pill' ? Math.min(W, Hh) / 2 : Math.max(2, (mi.r || 80) - ins)).map(([a, b]) => [a, b]);
        return rect(u0, v0, u0 + W, v0 + Hh); };
      const out = face(0), inn = face(fr); M.slabs = [{ face: out, v0: 0, v1: d, round: mi.shape !== 'rect' }]; if (inn) M.slabs.push({ face: inn, v0: -3, v1: 0, round: mi.shape !== 'rect', mat: 'mirror' });
      if (inn) { M.lines.push(...inn.map((p, k2) => { const q = inn[(k2 + 1) % inn.length]; return [[p[0], -1, p[1]], [q[0], -1, q[1]]]; }));
        const iw = w - 2 * fr, ih = Hm - 2 * fr; for (const [a0, b0, a1, b1] of [[0.18, 0.55, 0.42, 0.78], [0.3, 0.42, 0.62, 0.72]]) M.lines.push([[fr + iw * a0, -1, z0 + fr + ih * b0], [fr + iw * a1, -1, z0 + fr + ih * b1]]); }
      M.plan.push({ pts: [[0, d / 2], [w, d / 2]], open: true });
    },
    // pied d'enceinte : embase, colonne, plateau 20 × 23 cm ; le plateau monte pour mettre le tweeter à hauteur d'oreille
    pied: (w, d, M, it, sh) => {
      const top = PL.standTop(sh), pw = Math.min(w, 200), pd = Math.min(d, 230), q = rect((w - pw) / 2, (d - pd) / 2, (w + pw) / 2, (d + pd) / 2); M.h = top; M.fill = false;
      M.solids.push({ pts: rect(0, 0, w, d), z0: 0, z1: 15 }, { pts: rect(w / 2 - 30, d / 2 - 30, w / 2 + 30, d / 2 + 30), z0: 15, z1: top - 12 }, { pts: q, z0: top - 12, z1: top });
      M.plan.push({ pts: q, dash: true }, { pts: rect(w / 2 - 30, d / 2 - 30, w / 2 + 30, d / 2 + 30) });
      M.decks = [{ pts: q, z: top, name: 'plateau' }];
    },
    // bureau Idåsen : plateau 160 × 80 (ép. 2,5), deux colonnes télescopiques sur pieds en T, poutre entre les colonnes
    idasen: (w, d, M, it, sh) => {
      const top = PL.deskTop(sh) * 10, t = 25, ui = Math.min(120, w * 0.075); M.h = top;
      M.solids.push({ pts: rect(0, 0, w, d), z0: top - t, z1: top });
      for (const uc of [ui, w - ui]) {
        M.solids.push({ pts: rect(uc - 32, 40, uc + 32, d - 40), z0: 0, z1: 32 }, { pts: rect(uc - 40, d / 2 - 50, uc + 40, d / 2 + 50), z0: 32, z1: top - t - 45 }, { pts: rect(uc - 28, 70, uc + 28, d - 70), z0: top - t - 45, z1: top - t });
        M.plan.push({ pts: rect(uc - 32, 40, uc + 32, d - 40), dash: true });
      }
      M.solids.push({ pts: rect(ui, d / 2 - 35, w - ui, d / 2 + 35), z0: top - t - 95, z1: top - t - 45 });
      M.decks = [{ pts: rect(0, 0, w, d), z: top, name: 'plateau' }];
    },
    // canapé convertible Lindåkra : 206 × 87, assise 43, accoudoir arrondi (7 cm) à gauche, pouf-méridienne à droite sans accoudoir,
    // dossier 67 sur toute la longueur, deux coussins de dossier (87) au-dessus de l'assise, couchage 200 × 80
    lindakra: (w, d, M) => {
      const arm = Math.min(70, w * 0.04), back = 70, seat = 430, top = 670, cush = 870, pu = arm + Math.round(((w - arm) * 1350) / 1990), R = arm; M.h = cush;
      const corner = ell(R, R, R, R, 10, Math.PI, Math.PI * 1.5).slice(1, -1); M.outline = [[0, d], [0, R]].concat(corner, [[R, 0], [w, 0], [w, d]]);
      const armP = [[0, d], [0, R]].concat(corner, [[R, 0], [arm, 0], [arm, d]]); M.solids.push({ pts: armP, z0: 40, z1: top });
      M.solids.push({ pts: rect(arm, d - back, w, d), z0: 40, z1: top }, { pts: rect(arm, 0, pu - 4, d - back), z0: 40, z1: seat }, { pts: rect(pu + 4, 0, w, d - back), z0: 40, z1: seat });
      const mid = (arm + pu) / 2; for (const [a, b] of [[arm + 6, mid - 4], [mid + 4, pu - 6]]) { M.solids.push({ pts: rect(a, d - back - 170, b, d - back), z0: seat, z1: cush }); M.plan.push({ pts: rect(a, d - back - 170, b, d - back) }); }
      M.plan.push({ pts: [[arm, 0], [arm, d - back]], open: true }, { pts: [[arm, d - back], [w, d - back]], open: true }, { pts: [[pu, 0], [pu, d - back]], open: true, dash: true });
    },
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
  // clavier : n touches blanches entre u0 et u1, noires en relief (départ sur do ou sur fa)
  function keys(M, u0, u1, v0, v1, z, n, start) {
    M.solids.push({ pts: rect(u0, v0, u1, v1), z0: z, z1: z + 14 }); M.plan.push({ pts: rect(u0, v0, u1, v1) });
    const kw = (u1 - u0) / n, pat = start === 'F' ? [1, 1, 1, 0, 1, 1, 0] : [1, 1, 0, 1, 1, 1, 0];
    for (let i = 1; i < n; i++) { const u = u0 + i * kw; M.lines.push([[u, v0, z + 15], [u, v1, z + 15]]); M.plan.push({ pts: [[u, v0], [u, v1]], open: true }); }
    for (let i = 0; i < n - 1; i++) if (pat[i % 7]) { const c = u0 + (i + 1) * kw; M.solids.push({ pts: rect(c - kw * 0.3, v0 + (v1 - v0) * 0.4, c + kw * 0.3, v1), z0: z + 14, z1: z + 24 }); }
  }
  // machine : boîtier aux cotes du fabricant, commandes simplifiées (boutons, écran, pads, clavier, enceintes…)
  function gear(w, d, M, g) {
    if (g.spk) return speaker(w, d, M, g.spk);
    if (g.laptop) { const t = g.laptop; M.h = t + g.screen; M.solids.push({ pts: rect(0, 0, w, d), z0: 0, z1: t }, { pts: rect(0, d - 10, w, d), z0: t, z1: t + g.screen }); const kb = rect(w * 0.1, d * 0.42, w * 0.9, d * 0.9), tp = rect(w * 0.32, d * 0.06, w * 0.68, d * 0.36); M.plan.push({ pts: kb }, { pts: tp }, { pts: [[0, d - 10], [w, d - 10]], open: true }); M.lines.push(...ring3(kb, t + 1), ...ring3(tp, t + 1)); return; }
    if (g.cyl) { M.outline = ell(w / 2, d / 2, w / 2, d / 2, 28); M.solids.push({ pts: M.outline, z0: 0, z1: g.cyl, round: true }); const top = ell(w / 2, d / 2, w * 0.36, d * 0.36, 20); M.plan.push({ pts: top }); M.lines.push(...ring3(top, g.cyl + 1)); M.h = g.cyl; return; }
    if (g.theremin) { // coffret 45 × 16 × 8,5 cm, antenne de volume en boucle à gauche, antenne de hauteur verticale à droite
      const cw = Math.min(w, 450), H = 85, u0 = w - cw; M.h = H + 450; M.solids.push({ pts: rect(u0, 0, w, d), z0: 0, z1: H }, { pts: ell(w - 45, d / 2, 6, 6, 8), z0: H, z1: H + 450, round: true });
      const loop = [[u0, d * 0.32], [70, d * 0.32]].concat(ell(70, d / 2, 70, d * 0.18, 9, -Math.PI / 2, -Math.PI * 1.5)).concat([[70, d * 0.68], [u0, d * 0.68]]);
      for (let k = 0; k < loop.length - 1; k++) M.lines.push([[loop[k][0], loop[k][1], H * 0.55], [loop[k + 1][0], loop[k + 1][1], H * 0.55]]);
      M.outline = rect(0, 0, w, d); M.fill = true; M.plan.push({ pts: loop, open: true }, { pts: [[u0, 0], [u0, d]], open: true }, { pts: ell(w - 45, d / 2, 10, 10, 10) }); return;
    }
    const H = g.h, kh = g.kh != null ? g.kh : 14; let zone = [0, 0, w, d], zAt = () => H;
    if (g.case7u) { // coffret eurorack 7U : deux rangées 3U et une rangée 1U, modules en tranches
      M.solids.push({ pts: rect(0, 0, w, d), z0: 0, z1: H }); M.h = H + 25;
      const rows = [[0.04, 0.45], [0.47, 0.88], [0.9, 0.98]];
      for (const [a, b] of rows) { const q = rect(w * 0.03, d * a, w * 0.97, d * b); M.plan.push({ pts: q }); M.lines.push(...ring3(q, H + 1)); let u = w * 0.03; let k = 0; while (u < w * 0.95) { u += w * (0.035 + ((k * 37) % 5) * 0.012); k++; if (u < w * 0.96) { M.lines.push([[u, d * a, H + 1], [u, d * b, H + 1]]); if (b - a > 0.2) for (let j = 0; j < 3; j++) { const cv = d * (a + (b - a) * (j + 0.5) / 3), cu = u - w * 0.015; M.solids.push({ pts: ell(cu, cv, 6, 6, 6), z0: H, z1: H + 18, round: true }); } } } }
      return;
    }
    if (g.keys) {
      const kd = d * g.keys.d, hf = Math.min(H, g.keys.h);
      M.solids.push({ pts: rect(0, 0, w, kd), z0: 0, z1: hf - 14 }, { pts: rect(0, kd, w, d), z0: 0, z1: H }); M.plan.push({ pts: [[0, kd], [w, kd]], open: true });
      const ku0 = w * g.keys.l, ku1 = w - Math.max(12, w * 0.02); keys(M, ku0, ku1, Math.min(10, kd * 0.08), kd - Math.min(8, kd * 0.06), hf - 14, g.keys.n, g.keys.start);
      if (g.keys.l > 0.06) for (const f of [0.33, 0.67]) { const cu = ku0 * f, q = rect(cu - 9, kd * 0.2, cu + 9, kd * 0.85); M.solids.push({ pts: q, z0: hf - 14, z1: hf + 6 }); M.plan.push({ pts: q }); }
      zone = [0, kd, w, d];
    } else if (g.step) {
      const vs = d * g.step[0], hf = g.step[1]; M.solids.push({ pts: rect(0, 0, w, vs), z0: 0, z1: hf }, { pts: rect(0, vs, w, d), z0: 0, z1: H }); M.plan.push({ pts: [[0, vs], [w, vs]], open: true }); zAt = (v) => (v < vs ? hf : H);
    } else M.solids.push({ pts: rect(0, 0, w, d), z0: 0, z1: H });
    if (g.rack) for (const u of [8, w - 8]) M.lines.push([[u, -1, 6], [u, -1, H - 6]]);
    const [zu0, zv0, zu1, zv1] = zone, ZW = zu1 - zu0, ZD = zv1 - zv0;
    const Z = (a, b, c, e) => [zu0 + ZW * a, zv0 + ZD * c, zu0 + ZW * b, zv0 + ZD * e];
    if (g.scr) { const [a, b, c, e] = Z(...g.scr); const q = rect(a, b, c, e); M.plan.push({ pts: q }); M.lines.push(...ring3(q, zAt((b + e) / 2) + 1)); }
    if (g.pads) { const [cols, rows, ...f] = g.pads; const [a, b, c, e] = Z(...f), cw = (c - a) / cols, ch = (e - b) / rows; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const q = rect(a + i * cw + cw * 0.12, b + j * ch + ch * 0.12, a + (i + 1) * cw - cw * 0.12, b + (j + 1) * ch - ch * 0.12); const z = zAt(b + (j + 0.5) * ch); M.solids.push({ pts: q, z0: z, z1: z + 4 }); if (cols * rows <= 64) M.plan.push({ pts: q }); } }
    if (g.plates) { const [n, a, b, c, e] = g.plates; const u0 = zu0 + ZW * a, u1 = zu0 + ZW * b, v0 = zv0 + ZD * c, v1 = zv0 + ZD * e; const pw = (u1 - u0) / n; for (let i = 0; i < n; i++) { const q = rect(u0 + i * pw + pw * 0.15, v0, u0 + (i + 1) * pw - pw * 0.15, v1); M.solids.push({ pts: q, z0: H, z1: H + 3 }); M.plan.push({ pts: q }); } }
    const dots = (spec, r, hk) => { const [cols, rows, ...f] = spec; const [a, b, c, e] = Z(...f); for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const cu = cols > 1 ? a + ((c - a) * i) / (cols - 1) : (a + c) / 2, cv = rows > 1 ? b + ((e - b) * j) / (rows - 1) : (b + e) / 2, z = zAt(cv); const q = ell(cu, cv, r, r, 8); M.solids.push({ pts: q, z0: z, z1: z + hk, round: true }); if (cols * rows <= 40) M.plan.push({ pts: q }); } };
    if (g.k) { const [cols, rows, a, b, c, e] = g.k; const cell = Math.min((ZW * (b - a)) / Math.max(1, cols), (ZD * (e - c)) / Math.max(1, rows)); dots(g.k, g.kr || Math.max(4, Math.min(13, cell * 0.28)), Math.max(kh, 3)); }
    if (g.jacks) dots(g.jacks, 3, 3);
    if (g.sw) for (let i = 0; i < g.sw; i++) { const cu = (w * (i + 0.5)) / g.sw, cv = Math.min(d * 0.2, 30); const q = ell(cu, cv, 9, 9, 8); M.solids.push({ pts: q, z0: zAt(cv), z1: zAt(cv) + 14, round: true }); M.plan.push({ pts: q }); }
    if (g.reel) { const q = ell(w / 2, d * 0.4, w * 0.32, w * 0.32, 18); M.solids.push({ pts: q, z0: H, z1: H + 2, round: true }); M.plan.push({ pts: q }); }
    M.h = H + (g.k ? kh : 0);
  }
  // enceinte : caisson, haut-parleurs dessinés en façade ([u, z, rayon] en fractions de largeur / hauteur)
  function speaker(w, d, M, sp) {
    const H = sp.h; M.h = H + (sp.handle ? 18 : 0); M.solids.push({ pts: rect(0, 0, w, d), z0: 0, z1: H });
    for (const [fu, fz, fr] of sp.drv) { const r = w * fr, c = ell(w * fu, H * fz, r, r, 22); c.forEach((p, k) => { const q = c[(k + 1) % c.length]; M.lines.push([[p[0], -1, p[1]], [q[0], -1, q[1]]]); }); const c2 = ell(w * fu, H * fz, r * 0.45, r * 0.45, 14); c2.forEach((p, k) => { const q = c2[(k + 1) % c2.length]; M.lines.push([[p[0], -1, p[1]], [q[0], -1, q[1]]]); }); }
    if (sp.handle) M.solids.push({ pts: rect(w * 0.15, d * 0.3, w * 0.85, d * 0.7), z0: H, z1: H + 18 });
    M.plan.push({ pts: [[0, Math.min(14, d * 0.2)], [w, Math.min(14, d * 0.2)]], open: true });
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
  // Cedam Soho : caisson suspendu 2 tiroirs (grand en bas, petit en haut), plan vasque céramique 2 cm, dessus à 90 cm
  // vasque intégrée de 50 cm centrée, à gauche ou à droite (à 8 cm du bord), ou vasque large de 100 cm ; mitigeur derrière la vasque
  function soho(w, d, M, pos) {
    const zt = 900, zc = zt - 20, z0 = zc - 520; M.h = zt;
    block(M, 0, w, 8, d, z0, zc, [{ rows: [['t', 2], ['t', 1]] }]);
    M.solids.push({ pts: rect(0, 0, w, d), z0: zc, z1: zt });
    const bw = pos === 'l' ? Math.min(1000, w - 200) : Math.min(500, w - 160), cu = pos === 'g' ? 80 + bw / 2 : pos === 'd' ? w - 80 - bw / 2 : w / 2;
    const v0 = 60, v1 = Math.max(v0 + 150, d - 120), rim = rrect(cu - bw / 2, v0, cu + bw / 2, v1, 70), cuve = rrect(cu - bw / 2 + 25, v0 + 25, cu + bw / 2 - 25, v1 - 25, 50);
    M.plan.push({ pts: rim }, { pts: cuve }, { pts: ell(cu, (v0 + v1) / 2 + 30, 20, 20, 12) });
    M.lines.push(...ring3(rim, zt + 1), ...ring3(cuve, zt + 1));
    tap(cu, d - 55, zt, M);
  }
  // douche à l'italienne : receveur extra-plat encastré à fleur du carrelage (pentes vers la bonde centrée),
  // vitre fixe de 8 mm et 2 m de haut le long de la façade, profilé contre le mur de côté, barre de maintien vers le mur du fond
  function walkin(w, d, M, it, sh) {
    const H = 2000, L = PL.walkinGlass(it, sh, w), side = PL.walkinSide(sh); M.h = H;
    M.solids.push({ pts: rect(0, 0, w, d), z0: 0, z1: 3 });
    const g = 60, cu = w / 2, cv = d / 2, grille = rect(cu - g, cv - g, cu + g, cv + g);
    M.plan.push({ pts: grille });
    for (const [u, v, su, sv] of [[0, 0, -1, -1], [w, 0, 1, -1], [w, d, 1, 1], [0, d, -1, 1]]) { M.plan.push({ pts: [[u, v], [cu + su * g, cv + sv * g]], open: true, dash: true }); M.lines.push([[u, v, 4], [cu + su * g, cv + sv * g, 4]]); }
    M.lines.push(...ring3(grille, 4)); for (let k = 1; k < 6; k++) M.lines.push([[cu - g + 10, cv - g + (2 * g * k) / 6, 4], [cu + g - 10, cv - g + (2 * g * k) / 6, 4]]);
    const v = 30, u0 = side === 'g' ? 0 : w - L, u1 = side === 'g' ? L : w, uw = side === 'g' ? 0 : w - 20, ub = side === 'g' ? u1 - 80 : u0 + 80, ue = side === 'g' ? u1 : u0;
    M.plan.push({ pts: rect(u0, v - 5, u1, v + 5) }, { pts: [[ub, v + 5], [ub, d]], open: true, dash: true });
    for (const t of [v - 4, v + 4]) M.lines.push([[u0, t, 10], [u1, t, 10]], [[ue, t, 10], [ue, t, H]], [[u0, t, H], [u1, t, H]]);
    M.lines.push([[ue, v - 4, 10], [ue, v + 4, 10]], [[ue, v - 4, H], [ue, v + 4, H]]);
    for (const [a, b, z0, z1] of [[0.22, 0.42, 950, 1350], [0.3, 0.44, 950, 1180]]) M.lines.push([[u0 + (u1 - u0) * a, v - 5, z0], [u0 + (u1 - u0) * b, v - 5, z1]]); // reflets
    M.solids.push({ pts: rect(uw, v - 12, uw + 20, v + 12), z0: 0, z1: H }, { pts: rect(ub - 8, v + 5, ub + 8, d), z0: H - 90, z1: H - 74 });
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
  PL.furnModel = (id, w, d, sh) => {
    const it = furniture.find((x) => x.id === id); if (!it || !it.m || !MODELS[it.m]) return null;
    const M = { outline: null, plan: [], solids: [], slabs: [], lines: [], dash: false, fill: true, h: 0, decks: null }; MODELS[it.m](w, d, M, it, sh); return M;
  };
  /* étages du stand Jaspers (cm, du bas vers le haut) et hauteur du bureau : réglages propres à chaque meuble posé */
  PL.jaspersTiers = (sh) => { const t = sh && Array.isArray(sh.tiers) && sh.tiers.length === 4 ? sh.tiers : [66, 88, 110, 132]; return t.map((v) => Math.max(45, Math.min(136, +v || 0))); };
  // pied d'enceinte : hauteur d'oreille de l'auditeur (cm) et hauteur du tweeter de l'enceinte posée (mm, KH 120 par défaut)
  PL.earHeight = (sh) => Math.max(80, Math.min(180, (sh && +sh.ear) || 120));
  PL.standTop = (sh) => Math.max(300, Math.min(1600, PL.earHeight(sh) * 10 - ((sh && +sh.tw) || 216)));
  // Kallax : grille [colonnes, rangées] debout (it.grid), échangée quand il est couché ; 41,5 cm pour une case, + 35 cm par case
  PL.kallaxGrid = (it, sh) => { const g = (it && it.grid) || [2, 2]; return ((sh && sh.orient) || (it && it.orient) || 'v') === 'h' ? [g[1], g[0]] : [g[0], g[1]]; };
  PL.kallaxSize = (n) => 415 + (n - 1) * 350;
  PL.deskHeight = (it, sh) => { const k = it.dk; return k.Hs && sh && k.Hs.includes(+sh.dh) ? +sh.dh : k.H; };
  // miroir : debout (largeur × hauteur du catalogue) ou couché ; bas du miroir à 30 cm pour un grand, sinon centré à 155 cm
  PL.mirrorHang = (it, sh) => (sh && sh.hang) || 'v';
  PL.mirrorH = (it, sh) => {
    if (it.mi.shape === 'round') return sh && sh.pts && sh.pts.length > 1 ? Math.hypot(sh.pts[1].x - sh.pts[0].x, sh.pts[1].y - sh.pts[0].y) : it.w * 10; // rond : toujours aussi haut que large
    if (sh && +sh.mh > 0) return +sh.mh * 10;
    return (PL.mirrorHang(it, sh) === 'h' ? it.w : it.mi.H) * 10;
  };
  PL.mirrorZ = (it, sh) => { const H = PL.mirrorH(it, sh); const z = sh && sh.mz != null && sh.mz !== '' ? +sh.mz * 10 : H >= 1200 ? 300 : 1550 - H / 2; return Math.max(0, Math.min(2600 - H, z)); };
  // douche à l'italienne : longueur de la vitre (mm, du catalogue ou réglée) et côté (g : vitre à gauche, accès à droite)
  PL.walkinGlass = (it, sh, w) => { const L = ((sh && +sh.vl) || (it.wi && it.wi.glass) || 70) * 10; return Math.max(300, Math.min(w || it.w * 10, L)); };
  PL.walkinSide = (sh) => (sh && sh.vside === 'd' ? 'd' : 'g');
  PL.chairSeat = (sh) => Math.max(42, Math.min(52, (sh && +sh.seat) || 46));
  PL.deskTop = (sh) => Math.max(63, Math.min(127, (sh && +sh.top) || 72));

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
