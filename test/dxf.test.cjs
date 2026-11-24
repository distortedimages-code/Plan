const PL = require('./load.cjs'); const G = PL.geom;
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok', m); };
// petit DXF : deux pièces à murs doubles (épaisseur 200), porte de 900 entre elles
let L = []; const line = (x1, y1, x2, y2, layer = 'MURS') => L.push(0, 'LINE', 8, layer, 10, x1, 20, y1, 11, x2, 21, y2);
// extérieur 0..8200 x 0..4400, intérieur 200..8000 x 200..4200 ; refend x=4000..4200 avec porte y=1500..2400
const poly = (pts, layer = 'MURS') => { L.push(0, 'LWPOLYLINE', 8, layer, 90, pts.length, 70, 1); pts.forEach(([x, y]) => L.push(10, x, 20, y)); };
poly([[0, 0], [8200, 0], [8200, 4400], [0, 4400]]);
poly([[200, 200], [4000, 200], [4000, 1500], [4200, 1500], [4200, 200], [8000, 200], [8000, 4200], [4200, 4200], [4200, 2400], [4000, 2400], [4000, 4200], [200, 4200]]);
L.push(0, 'TEXT', 8, 'TXT', 10, 1500, 20, 2500, 40, 150, 1, 'Séjour');
L.push(0, 'TEXT', 8, 'TXT', 10, 5500, 20, 2500, 40, 150, 1, 'Chambre');
const dxf = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'].concat(L.map(String)).concat(['0', 'ENDSEC', '0', 'EOF']).join('\n');
const r = PL.dxf.toRaw(dxf);
assert(r.k === 1 && r.raw.segs.length === 16, 'parsed segs ' + r.raw.segs.length + ' k ' + r.k);
const det = PL.vec.detect(r.raw, r.k, {});
console.log(det.rooms.map((x) => x.name + ' ' + (x.area / 1e6).toFixed(2) + ' ' + x.openings.map((o) => o.type + ':' + o.width).join(',')));
assert(det.rooms.length === 2, 'two rooms detected');
assert(det.rooms.every((x) => Math.abs(x.area / 1e6 - 15.2) < 0.05), "room areas 3.8x4.0");
assert(det.rooms.every((x) => x.openings.some((o) => o.type === 'porte' && Math.abs(o.width - 900) < 5)), 'door found on both');
