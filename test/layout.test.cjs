const PL = require('./load.cjs'); const G = PL.geom, Ly = PL.layout;
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok', m); };
const room = (id, pts, extra = {}) => ({ id, kind: 'piece', name: id, pts, ...extra });
// rectangle 4000 x 3000, fenêtre sur le mur 1 (x=4000)
let r1 = room('ch', G.rect(0, 0, 4000, 3000), { openings: [{ type: 'fenetre', wall: 1, pos: 800, width: 1200 }] });
let res = Ly.computeFloor([r1], { L: 1200, W: 190 });
let R = res.results.ch;
console.log('ang', G.deg(R.ang).toFixed(1), 'rows', R.rows.length, 'first', R.rows[0].ripMax.toFixed(1), 'last', R.rows[R.rows.length - 1].ripMax.toFixed(1));
R.advice.forEach((a) => console.log(' -', a.s));
console.log('totals', res.totals);
assert(Math.abs(Math.sin(R.ang)) < 0.01, 'boards perpendicular to window wall (along x)');
assert(R.rows.every((r) => r.ripMax > 49), 'no thin rows');
// check stagger & min pieces
let bad = 0; R.rows.forEach((r) => r.runs.forEach((ru) => ru.pieces.forEach((p) => { if (p.len < 299 && ru.pieces.length > 1) bad++; })));
assert(bad === 0, 'all pieces >= minPiece');
// L-room with column
let Lr = room('L', [{x:0,y:0},{x:6000,y:0},{x:6000,y:2500},{x:2600,y:2500},{x:2600,y:5000},{x:0,y:5000}]);
let col = { id: 'p1', kind: 'poteau', name: 'Poteau', pts: G.rect(1500, 1200, 200, 200) };
res = Ly.computeFloor([Lr, col], { L: 1200, W: 190 });
R = res.results.L; console.log('L rows', R.rows.length, 'ang', G.deg(R.ang).toFixed(1));
R.advice.forEach((a) => console.log(' -', a.s));
const polys = Ly.boardPolys(R); console.log('boards drawn', polys.length, 'totals', res.totals);
// pont12
res = Ly.computeFloor([r1], { L: 1200, W: 190, pattern: 'pont12' });
R = res.results.ch; const firsts = R.rows.map(r => Math.round(r.runs[0].pieces[0].len)); console.log('pont12 firsts', firsts.join(','));
assert(new Set(firsts).size <= 3, 'regular pattern');
// grouped
let a = room('a', G.rect(0, 0, 3000, 3000), { cal: { group: 'A' } }), b = room('b', G.rect(3200, 500, 2000, 2000), { cal: { group: 'A' } });
res = Ly.computeFloor([a, b], {});
const ra = res.results.a, rb = res.results.b;
const off = (y) => ((y % 190) + 190) % 190;
assert(Math.abs(off(ra.rows[1].ya) - off(rb.rows[1].ya)) < 0.01 && Math.abs(ra.ang - rb.ang) < 1e-9, 'group rows aligned');
