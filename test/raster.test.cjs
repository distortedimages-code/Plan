const PL = require('./load.cjs'); const G = PL.geom;
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok', m); };
// image 400x300 blanche, murs noirs épais 8px, pièce rectangulaire avec porte de 30px
const w = 400, h = 300, data = new Uint8ClampedArray(w * h * 4).fill(255);
const fill = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; } };
fill(20, 20, 380, 28); fill(20, 272, 380, 280); fill(20, 20, 28, 280); fill(372, 20, 380, 280);
fill(200, 20, 208, 120); fill(200, 150, 208, 280); // refend avec porte 120..150
fill(80, 100, 120, 104); // trait fin (meuble)
const img = { data, width: w, height: h };
let r = PL.raster.wand(img, { x: 100, y: 200 }, { closePx: 0 });
let bb = G.bbox(r.poly); console.log('no close', JSON.stringify(bb), r.poly.length);
assert(bb.w > 300, 'leaks through door without closing');
r = PL.raster.wand(img, { x: 100, y: 200 }, { closePx: 18 });
r.poly = PL.raster.orthogonalize(r.poly);
bb = G.bbox(r.poly); console.log('close', JSON.stringify(bb), r.poly.length);
assert(bb.w < 185 && bb.w > 165 && bb.h > 235, 'left room isolated');
