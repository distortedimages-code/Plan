/* Calepin — opérations sur des pièces à angles droits, par quadrillage.
   On travaille dans un repère tourné (les murs y sont horizontaux ou verticaux) : toutes les abscisses et
   ordonnées des sommets forment une grille ; chaque case est dedans ou dehors ; on retrace le contour des
   cases gardées. Robuste aux bords communs (le cas normal quand on redécoupe une pièce le long de ses murs). */
(function () {
  const PL = (globalThis.PL = globalThis.PL || {}), G = PL.geom;
  const O = (PL.ortho = {});

  O.frame = (th) => ({ to: (p) => G.rot(p, -th), from: (p) => G.rot(p, th) });
  /* direction dominante d'un contour : celle de son plus long côté, ramenée entre 0 et 90° */
  O.angleOf = (pts) => {
    let best = 0, ang = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], l = G.dist(a, b); if (l > best) { best = l; ang = Math.atan2(b.y - a.y, b.x - a.x); } }
    const q = Math.PI / 2; ang = ((ang % q) + q) % q; return ang > q - 1e-4 ? 0 : ang;
  };
  /* contour remis d'équerre dans le repère (écarts de quelques mm gommés) ; null s'il a un vrai mur en biais */
  O.square = (P) => {
    const n = P.length; const type = [];
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), l = Math.hypot(dx, dy); const lim = Math.max(3, 0.012 * l); type.push(dy <= lim && dx > dy ? 'H' : dx <= lim && dy > dx ? 'V' : l < 3 ? 'Z' : 'D'); }
    if (type.includes('D')) return null;
    const out = P.map((p) => ({ x: p.x, y: p.y }));
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (type[i] === 'H') { const y = (P[i].y + P[j].y) / 2; out[i].y = y; out[j].y = y; } }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (type[i] === 'V') { const x = (P[i].x + P[j].x) / 2; out[i].x = x; out[j].x = x; } }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (type[i] === 'H') out[j].y = out[i].y; } // la dernière passe l'emporte sur les côtés horizontaux
    return out;
  };
  O.coords = (vals, tol = 1.5) => { const s = vals.slice().sort((a, b) => a - b); const out = []; for (const v of s) if (!out.length || v - out[out.length - 1] > tol) out.push(v); return out; };
  /* contours (dans le repère) de l'ensemble des cases gardées : boucles extérieures (aire > 0) et trous (aire < 0) */
  O.trace = (xs, ys, inside) => {
    const nx = xs.length - 1, ny = ys.length - 1; if (nx < 1 || ny < 1) return [];
    const In = []; for (let i = 0; i < nx; i++) { In.push([]); for (let j = 0; j < ny; j++) In[i].push(!!inside((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2, i, j)); }
    const at = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && In[i][j];
    const E = new Map(); const add = (a, b) => { const k = a[0] + ',' + a[1]; if (!E.has(k)) E.set(k, []); E.get(k).push({ a, b, used: false }); };
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      if (!In[i][j]) continue;
      if (!at(i, j - 1)) add([i, j], [i + 1, j]);
      if (!at(i + 1, j)) add([i + 1, j], [i + 1, j + 1]);
      if (!at(i, j + 1)) add([i + 1, j + 1], [i, j + 1]);
      if (!at(i - 1, j)) add([i, j + 1], [i, j]);
    }
    const loops = [];
    for (const list of E.values()) for (const e0 of list) {
      if (e0.used) continue; const loop = []; let cur = e0;
      for (let guard = 0; guard < 100000; guard++) {
        cur.used = true; loop.push(cur.a);
        if (cur.b[0] === e0.a[0] && cur.b[1] === e0.a[1]) break;
        const cand = (E.get(cur.b[0] + ',' + cur.b[1]) || []).filter((x) => !x.used); if (!cand.length) break;
        const dx = cur.b[0] - cur.a[0], dy = cur.b[1] - cur.a[1];
        cand.sort((p, q) => { const t = (x) => { const ex = x.b[0] - x.a[0], ey = x.b[1] - x.a[1]; return dx * ey - dy * ex; }; return t(q) - t(p); }); // le virage le plus à gauche d'abord
        cur = cand[0];
      }
      const pts = loop.map(([i, j]) => ({ x: xs[i], y: ys[j] }));
      const clean = pts.filter((p, k) => { const a = pts[(k - 1 + pts.length) % pts.length], b = pts[(k + 1) % pts.length]; return Math.abs(G.cross(G.sub(p, a), G.sub(b, p))) > 1e-6; });
      if (clean.length >= 4) loops.push(clean);
    }
    return loops;
  };
  O.rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  O.inRect = (r, x, y) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1;
})();
