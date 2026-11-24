const PL = require('./load.cjs'); const G = PL.geom, S = PL.solver;
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok', m); };
const near = (a, b, t = 0.05) => Math.abs(a - b) < t;
// rectangle 4000x3000
let r = G.rect(0, 0, 4000, 3000);
let m = S.measure(r);
assert(near(G.deg(m.A[0]), 90) && near(G.deg(m.A[2]), 90), 'angles rectangle 90');
let locks = r.map(() => ({ L: false, A: true, Av: Math.PI / 2 }));
let res = S.solve(r, locks, [{ t: 'L', i: 0, v: 4100 }]);
assert(res.ok, 'solve edit length ok ' + (res.msg || ''));
m = S.measure(res.pts);
assert(near(m.L[0], 4100) && near(m.L[2], 4100) && near(m.L[1], 3000, 1), 'opposite wall follows ' + m.L.map(x=>x.toFixed(1)));
// mesures réelles : 4 longueurs verrouillées, angles libres
locks = [4000, 3000, 4020, 2990].map((v) => ({ L: true, Lv: v, A: false }));
res = S.solve(r, locks, []);
assert(res.ok, 'measured quad closes');
m = S.measure(res.pts); assert(near(m.L[2], 4020) && near(m.L[3], 2990), 'lengths kept ' + m.A.map(a=>G.deg(a).toFixed(2)));
// trop de verrous
locks = r.map(() => ({ L: true, A: true }));
locks = S.syncLocks(r, locks);
res = S.solve(r, locks, [{ t: 'L', i: 0, v: 4100 }]);
assert(!res.ok, 'overconstrained refused: ' + res.msg);
// L-shape
let Lp = [{x:0,y:0},{x:5000,y:0},{x:5000,y:2000},{x:2000,y:2000},{x:2000,y:4000},{x:0,y:4000}];
m = S.measure(Lp); assert(near(G.deg(m.A[3]), 270), 'reflex 270');
res = S.solve(Lp, Lp.map(()=>({A:true,Av:0,L:false})).map((l,i)=>({...l,Av:m.A[i]})), [{t:'L',i:1,v:2500}]);
assert(res.ok, 'L edit ok'); m = S.measure(res.pts); assert(near(m.L[1],2500), 'L edit applied '+m.L.map(x=>x.toFixed(0)));
// drag
let d = S.dragVertex(r, null, 2, {x:4200,y:3100}); assert(d.ok && d.pts[2].x===4200, 'free drag');
locks = S.syncLocks(r, r.map(()=>({L:false,A:true})));
d = S.dragVertex(r, locks, 2, {x:4200,y:3100}); m = S.measure(d.pts);
assert(d.ok && near(G.deg(m.A[1]),90) && near(G.deg(m.A[0]),90), 'locked-angle drag keeps square '+m.L.map(x=>x.toFixed(0)));
// squareUp
let sk = [{x:0,y:0},{x:4000,y:30},{x:3990,y:3000},{x:10,y:2980}];
res = S.squareUp(sk, null); m = S.measure(res.pts); assert(res.ok && m.A.every(a=>near(G.deg(a),90,0.01)), 'square up '+m.A.map(a=>G.deg(a).toFixed(3)));
