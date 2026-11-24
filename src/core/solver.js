/* Calepin — solveur de cotes : longueurs de murs + angles intérieurs, verrous, fermeture. */
(function () {
  const PL = (globalThis.PL = globalThis.PL || {});
  const G = PL.geom;
  const S3 = 1000; // équilibrage de la contrainte de somme des angles
  const M_L = 1, M_A = 2e-9; // souplesse : longueurs faciles à ajuster, angles raides

  function measure(pts) {
    const n = pts.length, L = [], H = [], A = [];
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; L.push(G.dist(a, b)); H.push(Math.atan2(b.y - a.y, b.x - a.x)); }
    for (let i = 0; i < n; i++) A.push(Math.PI - G.normAng(H[i] - H[(i - 1 + n) % n]));
    return { L, A, H };
  }

  function build(anchor, h0, L, A) {
    const n = L.length, pts = [{ x: anchor.x, y: anchor.y }]; let phi = h0;
    for (let i = 0; i < n - 1; i++) {
      if (i > 0) phi += Math.PI - A[i];
      const p = pts[i]; pts.push({ x: p.x + L[i] * Math.cos(phi), y: p.y + L[i] * Math.sin(phi) });
      if (i === 0) {} // rien
    }
    return pts;
  }

  function headings(h0, A) { const n = A.length, phi = [h0]; for (let i = 1; i < n; i++) phi.push(phi[i - 1] + Math.PI - A[i]); return phi; }

  function residual(h0, L, A) {
    const n = L.length, phi = headings(h0, A); let gx = 0, gy = 0, sa = 0;
    for (let i = 0; i < n; i++) { gx += L[i] * Math.cos(phi[i]); gy += L[i] * Math.sin(phi[i]); sa += A[i]; }
    return { g: [gx, gy, S3 * (sa - (n - 2) * Math.PI)], phi };
  }

  function solve3(Amat, b) {
    // élimination de Gauss avec pivot partiel, renvoie null si singulier
    const n = b.length, M = Amat.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-14) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }

  /*
   * pts : sommets CCW ; locks[i] = {L,A,Lv,Av} (L = longueur du mur i → i+1, A = angle au sommet i)
   * edits : [{t:'L'|'A', i, v}] valeurs imposées (mm / rad)
   * opts.anchor, opts.h0 : ancre facultative
   */
  function solve(pts, locks, edits = [], opts = {}) {
    const n = pts.length; if (n < 3) return { ok: false, msg: 'Il faut au moins 3 points.' };
    const m = measure(pts);
    const L = m.L.slice(), A = m.A.slice();
    const fixL = new Array(n).fill(false), fixA = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      const lk = locks && locks[i];
      if (lk && lk.L && lk.Lv != null) { L[i] = lk.Lv; fixL[i] = true; }
      if (lk && lk.A && lk.Av != null) { A[i] = lk.Av; fixA[i] = true; }
    }
    for (const e of edits) { if (e.t === 'L') { L[e.i] = e.v; fixL[e.i] = true; } else { A[e.i] = e.v; fixA[e.i] = true; } }
    const anchor = opts.anchor || pts[0];
    const h0 = opts.h0 != null ? opts.h0 : m.H[0];
    let ok = false, res;
    for (let it = 0; it < 60; it++) {
      res = residual(h0, L, A);
      const g = res.g, phi = res.phi;
      if (Math.abs(g[0]) < 1e-4 && Math.abs(g[1]) < 1e-4 && Math.abs(g[2]) < 1e-7) { ok = true; break; }
      // jacobienne : colonnes libres
      const cols = []; // {kind,i,j:[3],m}
      const sufC = new Array(n + 1).fill(0), sufS = new Array(n + 1).fill(0);
      for (let i = n - 1; i >= 0; i--) { sufC[i] = sufC[i + 1] + L[i] * Math.cos(phi[i]); sufS[i] = sufS[i + 1] + L[i] * Math.sin(phi[i]); }
      for (let i = 0; i < n; i++) if (!fixL[i]) cols.push({ k: 'L', i, j: [Math.cos(phi[i]), Math.sin(phi[i]), 0], m: M_L });
      for (let i = 0; i < n; i++) if (!fixA[i]) cols.push({ k: 'A', i, j: i === 0 ? [0, 0, S3] : [sufS[i], -sufC[i], S3], m: M_A });
      // lignes actives
      const rows = [0, 1, 2].filter((r) => cols.some((c) => Math.abs(c.j[r]) > 1e-12));
      for (let r = 0; r < 3; r++) if (!rows.includes(r) && Math.abs(g[r]) > (r === 2 ? 1e-4 : 1e-3)) {
        return { ok: false, msg: r === 2 ? 'La somme des angles verrouillés ne ferme pas la pièce : déverrouille un angle.' : 'Trop de cotes verrouillées : déverrouille une cote.' };
      }
      if (!rows.length) break;
      const Am = rows.map((r1) => rows.map((r2) => cols.reduce((s, c) => s + c.m * c.j[r1] * c.j[r2], 0)));
      const tr = Am.reduce((s, r, i) => s + r[i], 0);
      for (let i = 0; i < rows.length; i++) Am[i][i] += tr * 1e-12;
      const y = solve3(Am, rows.map((r) => g[r]));
      if (!y) return { ok: false, msg: 'Contraintes incompatibles : déverrouille une cote ou un angle.' };
      let maxStep = 0;
      for (const c of cols) {
        let d = 0; rows.forEach((r, k) => { d += c.j[r] * y[k]; }); d *= -c.m;
        if (c.k === 'L') { L[c.i] += d; maxStep = Math.max(maxStep, Math.abs(d)); } else { A[c.i] += d; }
      }
    }
    if (!ok) { res = residual(h0, L, A); ok = Math.abs(res.g[0]) < 0.05 && Math.abs(res.g[1]) < 0.05 && Math.abs(res.g[2]) < 1e-4; }
    if (!ok) return { ok: false, msg: 'Impossible de fermer la forme avec ces verrous : déverrouille au moins une cote ou un angle.' };
    if (L.some((l) => l <= 0.5)) return { ok: false, msg: 'Une longueur deviendrait nulle ou négative.' };
    const out = build(anchor, h0, L, A);
    if (G.area(out) <= 0 || G.isSelfIntersecting(out)) return { ok: false, msg: 'La forme se croiserait elle-même.' };
    return { ok: true, pts: out, L, A };
  }

  function syncLocks(pts, locks) {
    const m = measure(pts);
    return pts.map((_, i) => { const lk = Object.assign({ L: false, A: false }, locks && locks[i]); if (lk.L) lk.Lv = m.L[i]; if (lk.A) lk.Av = m.A[i]; return lk; });
  }

  function dragVertex(pts, locks, k, pos) {
    const n = pts.length, np = G.clone(pts); np[k] = { x: pos.x, y: pos.y };
    const anyLock = locks && locks.some((l) => l && (l.L || l.A));
    if (!anyLock) return G.area(np) > 0 && !G.isSelfIntersecting(np) ? { ok: true, pts: np } : { ok: false };
    // ancre : sommet opposé (le plus loin du point déplacé) et son mur sortant
    let a = 0, best = -1; for (let i = 0; i < n; i++) { const d = G.dist(np[i], np[k]); if (i !== k && d > best) { best = d; a = i; } }
    const rot = (arr) => arr.slice(a).concat(arr.slice(0, a));
    const rp = rot(np), rl = rot(locks || []);
    const r = solve(rp, rl, [], {});
    if (!r.ok) return r;
    const back = r.pts.slice(n - a).concat(r.pts.slice(0, n - a));
    return { ok: true, pts: back };
  }

  function squareUp(pts, locks, tolDeg = 12) {
    const m = measure(pts), edits = [];
    m.A.forEach((a, i) => { if (locks && locks[i] && locks[i].A) return; const d = G.deg(a); for (const t of [90, 180, 270]) if (Math.abs(d - t) < tolDeg && Math.abs(d - t) > 1e-6) edits.push({ t: 'A', i, v: G.rad(t) }); });
    if (!edits.length) return { ok: true, pts };
    return solve(pts, locks, edits);
  }

  PL.solver = { measure, build, solve, syncLocks, dragVertex, squareUp };
})();
