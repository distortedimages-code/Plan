const PL = require('./load.cjs'); const G = PL.geom, O = PL.ortho;
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok', m); };
// pièce 4 m × 3 m avec un bout de cloison (x 1950..2050) qui part du haut et s'arrête à 1 m du bas
const R = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 2050, y: 3000 }, { x: 2050, y: 1000 }, { x: 1950, y: 1000 }, { x: 1950, y: 3000 }, { x: 0, y: 3000 }];
const strip = { x0: 1950, x1: 2050, y0: -6, y1: 1006 };
const xs = O.coords(R.map((p) => p.x).concat([strip.x0, strip.x1])), ys = O.coords(R.map((p) => p.y).concat([strip.y0, strip.y1]));
const loops = O.trace(xs, ys, (x, y) => G.pointInPoly({ x, y }, R) && !O.inRect(strip, x, y));
assert(loops.length === 2, 'cloison prolongée : deux pièces (' + loops.length + ')');
assert(loops.every((l) => Math.abs(G.area(l) - 1950 * 3000) < 1), 'deux pièces de 1950 × 3000');
assert(loops.every((l) => l.length === 4 && G.area(l) > 0), 'rectangles, sens direct');
// zone au milieu d'une pièce, sans toucher de mur : un trou (refusé par l'outil)
const holes = O.trace(O.coords([0, 4000, 1000, 2000]), O.coords([0, 3000, 1000, 2000]), (x, y) => !(x > 1000 && x < 2000 && y > 1000 && y < 2000));
assert(holes.some((l) => G.area(l) < 0), 'îlot détecté comme un trou');
// remise d'équerre : quelques mm d'écart gommés, un vrai biais refusé
assert(O.square([{ x: 0, y: 0 }, { x: 3000, y: 4 }, { x: 3002, y: 2000 }, { x: 0, y: 2000 }]) !== null, 'écart de 4 mm accepté');
assert(O.square([{ x: 0, y: 0 }, { x: 3000, y: 600 }, { x: 3000, y: 2000 }, { x: 0, y: 2000 }]) === null, 'mur en biais refusé');
