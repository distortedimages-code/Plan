# Calepin — plan de maison et calepinage de parquet

Application web (une seule page, aucun serveur) pour préparer l'aménagement d'une maison depuis un iPhone, une tablette ou un ordinateur :

- **Import intelligent de plans** : PDF d'architecte vectoriel (ArchiCAD, AutoCAD…), exports magicplan (DXF, SVG, PDF, JPG/PNG) ou photo d'un plan.
  - lecture de l'échelle (cartouche « Ech. 1:50 ») vérifiée par les cotes du plan ;
  - choix automatique des calques de murs, guidé par les surfaces écrites sur le plan (SS / SH) ;
  - détection des pièces, de leurs noms et surfaces, des portes et fenêtres, des escaliers (marches numérotées) et des zones sous 1,80 m (lignes « 1 m 80 » des combles) ;
  - un PDF de plusieurs pages devient plusieurs étages (sous-sol, RDC, étage…).
- **Plan simplifié** : pièces, cotes et angles modifiables, verrouillables une par une ; le solveur referme la forme en ajustant ce qui n'est pas verrouillé. Fusion de pièces, ajout de cloisons (avec épaisseur), déplacement d'un mur ou d'une cloison entière, formes libres, poteaux, zones sans parquet, zones de plafond bas, hauteurs sous plafond.
- **Règle virtuelle** : mesures au millimètre avec aimantation (angles, murs, traits du fond de plan) et loupe au doigt.
- **Calepinage du parquet** (pose à l'anglaise, pont de bateau ½ ou ⅓) :
  - sens des lames conseillé (lumière, longueur de la pièce, équilibre des rangs) ;
  - mur et angle de départ, largeur du premier et du dernier rang (délignage équilibré) ;
  - décalage des joints et longueur minimale des coupes respectés, chutes réemployées rang après rang ;
  - pose continue entre pièces (groupes) ou barres de seuil ;
  - optimiseur de variantes, ordre de pose des pièces, **mode pas à pas** sur chantier (rang par rang, longueurs à couper, chutes à garder) ;
  - quantités : paquets, sous-couche, plinthes, barres de seuil.
- **Mobilier** (bibliothèque de meubles courants, dimensions ajustables) et **plan électrique** (prises, interrupteurs, points lumineux…, calés sur les murs).
- Tout objet peut être **verrouillé sur le plan**. Annuler / rétablir, sauvegarde automatique, export / import du projet.

## Utiliser

Ouvrir `index.html` (ou la version GitHub Pages). Onglet **Importer** → choisir le PDF du plan → vérifier les pages proposées → **Importer la sélection**. Ensuite vue **Calepinage** pour voir les lames, les coupes (trait rouge) et les conseils pièce par pièce.

Le scan LiDAR n'est pas accessible depuis une page web : scanner avec magicplan, exporter, puis importer ici.

## Développer

```
node tools/build.mjs            # assemble index.html (CSS + JS en ligne)
node test/solver.test.cjs       # solveur de cotes
node test/layout.test.cjs       # moteur de calepinage
node test/dxf.test.cjs          # lecture DXF + détection des pièces
node test/raster.test.cjs       # baguette magique
```

- `src/core/` : géométrie, solveur, calepinage, analyse vectorielle (PDF / DXF / SVG), baguette magique, bibliothèque.
- `src/app/` : interface (état, rendu canvas, interactions, panneaux, import, outils avancés).
- `.github/workflows/pages.yml` : tests puis publication sur GitHub Pages à chaque push sur `main`.

Seule dépendance externe chargée à la demande : pdf.js 3.11 (cdnjs) pour lire les PDF. La police est Inter Tight (Google Fonts).
