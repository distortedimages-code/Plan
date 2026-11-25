/* Calepin — moteur de calepinage parquet (pose droite : à l'anglaise, pont de bateau 1/2, 1/3). */
(function () {
  const PL = (globalThis.PL = globalThis.PL || {});
  const G = PL.geom;

  const DEFAULTS = { L: 1200, W: 190, T: 14, gap: 10, gapMode: 'auto', gapMin: 8, gapPerM: 1.5, minPiece: 300, minStagger: 300, minRow: 50, pattern: 'anglaise', lay: 'flottante', perBox: 8, m2Box: 0, waste: 7, maxAlong: 10000, maxAcross: 8000, name: 'Contrecollé chêne 1200 × 190' };

  const rotAll = (pts, a) => pts.map((p) => G.rot(p, a));
  const swap = (pts) => pts.map((p) => ({ x: p.y, y: p.x }));
  const fmt = (mm) => (Math.round(mm) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' cm';
  const fmtm = (mm) => (mm / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  const wallName = (i, n) => String.fromCharCode(65 + (i % 26)) + String.fromCharCode(65 + ((i + 1) % n % 26));

  function regionIntervals(outer, holes, y) {
    let iv = G.intervalsAtY([outer], y);
    if (holes.length) { const h = G.mergeIntervals(holes.flatMap((H) => G.intervalsAtY([H], y))); iv = G.subtractIntervals(iv, h); }
    return iv;
  }

  /* bords quasi horizontaux dans le repère local */
  function horizEdges(outer, holes) {
    const out = []; const tol = Math.sin(G.rad(2.5));
    const push = (R, isHole) => {
      for (let i = 0; i < R.length; i++) {
        const a = R[i], b = R[(i + 1) % R.length], d = G.sub(b, a), l = G.len(d);
        if (l < 150 || Math.abs(d.y) / l > tol) continue;
        const dirPlus = d.x > 0; const side = dirPlus !== isHole ? 'B' : 'T';
        out.push({ y: (a.y + b.y) / 2, ya: Math.min(a.y, b.y), yb: Math.max(a.y, b.y), len: l, side, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), dev: Math.abs(d.y), isHole });
      }
    };
    push(outer, false); holes.forEach((H) => push(H, true));
    return out;
  }

  function pieceAt(e, p, W, tol = 3) {
    let r = (((e.y - p) % W) + W) % W;
    let piece = e.side === 'B' ? (r < tol ? W : W - r) : (r < tol ? W : r);
    if (piece < tol) piece = W;
    return piece;
  }

  /* bande au plus fin le long d'un bord : un mur un peu hors d'équerre est évalué à ses deux bouts
     (sinon une pointe de quelques mm peut déborder dans le rang voisin sans être vue) */
  function edgePiece(e, p, W) {
    const mid = pieceAt(e, p, W);
    if (!(e.dev > 3 && e.dev <= W / 3)) return mid;
    return Math.min(mid, pieceAt({ side: e.side, y: e.ya }, p, W), pieceAt({ side: e.side, y: e.yb }, p, W));
  }
  function phaseQuality(edges, p, W) {
    let mn = W, sum = 0, sl = 0, at = null;
    for (const e of edges) { const pc = edgePiece(e, p, W); if (e.len >= 200 && pc < mn) { mn = pc; at = e; } sum += pc * e.len; sl += e.len; }
    return { min: mn, avg: sl ? sum / sl : W, at };
  }

  /* décalage des rangs : départ en lame entière si aucune bande ne devient trop fine (< 1/3 de lame),
     sinon on équilibre ; force = 'full' impose la lame entière au départ */
  function bestPhase(edges, W, startY, P, force) {
    const good = Math.max(P.minRow, W / 3);
    const p0 = ((startY % W) + W) % W;
    const q0 = phaseQuality(edges, p0, W);
    if (q0.min >= good - 0.5 || force === 'full') return { p: p0, q: q0, q0, aligned: true, forced: force === 'full' && q0.min < good - 0.5, good };
    let best = null;
    for (let p = 0; p < W; p += 0.5) {
      const q = phaseQuality(edges, p, W);
      if (!best || q.min > best.q.min + 0.25 || (Math.abs(q.min - best.q.min) <= 0.25 && q.avg > best.q.avg)) best = { p, q };
    }
    return { p: best.p, q: best.q, q0, aligned: false, good };
  }

  /* recommandation du sens de pose pour une pièce */
  function recommendDir(room, P, obstacles = []) {
    const pts = room.pts, n = pts.length, W = P.W;
    const cands = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], l = G.dist(a, b); if (l < 600) continue;
      let ang = Math.atan2(b.y - a.y, b.x - a.x); ang = ((ang % Math.PI) + Math.PI) % Math.PI;
      if (!cands.some((c) => Math.abs(G.normAng(2 * (c.ang - ang))) < G.rad(2))) cands.push({ ang, wall: i, l });
    }
    if (!cands.length) cands.push({ ang: 0, wall: 0, l: 0 });
    const wins = (room.openings || []).filter((o) => ['fenetre', 'porte-fenetre', 'baie', 'velux'].includes(o.type));
    const wf = { fenetre: 1, 'porte-fenetre': 1.6, baie: 2, velux: 0.6 };
    let wsum = 0; wins.forEach((o) => { wsum += (o.width || 1000) * wf[o.type]; });
    const res = cands.map((c) => {
      const loc = rotAll(pts, -c.ang), bb = G.bbox(loc);
      const lengthS = bb.w / (bb.w + bb.h);
      let light = 0;
      for (const o of wins) { const a = pts[o.wall], b = pts[(o.wall + 1) % n]; const phi = Math.atan2(b.y - a.y, b.x - a.x); light += (o.width || 1000) * wf[o.type] * Math.abs(Math.sin(c.ang - phi)); }
      light = wsum ? light / wsum : 0;
      const outer = G.offset(loc, P.gap); const holes = obstacles.map((o) => G.offset(rotAll(o.pts, -c.ang), -P.gap));
      const edges = horizEdges(outer, holes); const by = edges.filter((e) => e.side === 'B').sort((a, b) => a.y - b.y)[0];
      const ph = bestPhase(edges, W, by ? by.y : bb.y0, P);
      const rowsQ = Math.min(1, ph.q.min / W);
      const aspect = Math.max(bb.w, bb.h) / Math.max(1, Math.min(bb.w, bb.h));
      let wL = wins.length ? 0.35 : 0.6, wW = wins.length ? 0.5 : 0, wR = 0.15;
      if (aspect >= 2.2) { wL = 0.8; wW = wins.length ? 0.1 : 0; wR = 0.1; }
      const score = wL * lengthS + wW * light + wR * rowsQ;
      return { ...c, score, lengthS, light, rowsQ, aspect };
    });
    res.sort((a, b) => b.score - a.score);
    const best = res[0];
    const why = [];
    if (best.aspect >= 2.2) why.push('dans la longueur du couloir');
    else {
      if (wins.length && best.light > 0.7) why.push('dans le sens de la lumière (lames perpendiculaires aux fenêtres)');
      if (best.lengthS > 0.55) why.push('dans la longueur de la pièce');
    }
    if (best.rowsQ > 0.6) why.push('rangs de bord bien équilibrés');
    if (!why.length) why.push('meilleur compromis longueur / lumière / coupes');
    return { ang: best.ang, wall: best.wall, why, all: res };
  }

  /* ---------- pose d'un rang ---------- */
  function takePool(pool, need) {
    let bi = -1; for (let i = 0; i < pool.length; i++) if (pool[i].v >= need - 0.5 && (bi < 0 || pool[i].v < pool[bi].v)) bi = i;
    if (bi < 0) return null; const o = pool.splice(bi, 1)[0]; return { len: o.v, waste: o.v - need, from: o.row };
  }

  function layRun(u0, u1, prevJ, prev2J, st, P, rowIdx, patt) {
    const L = P.L, S = u1 - u0, pieces = [], warn = [];
    const minP = P.minPiece, minS = P.minStagger;
    const keep = Math.max(minP, 100);
    const addWaste = (w) => { if (w > 0.5) st.wasteLen += w; };
    const newBoard = () => { st.boards++; };
    const row = rowIdx + 1;
    if (S <= L + 0.5) {
      let src = 'new', w, from = null, rest = 0;
      const t = takePool(st.poolS, S) || takePool(st.poolE, S);
      if (t) { src = 'chute'; addWaste(t.waste); st.reused++; from = t.from; }
      else { newBoard(); w = L - S; if (w >= keep) { st.poolS.push({ v: w, row }); rest = w; } else addWaste(w); }
      pieces.push({ a: u0, b: u1, len: S, kind: S >= L - 0.5 ? 'full' : 'cut', src, from, rest });
      return { pieces, joints: [], warn };
    }
    const jointsFor = (s) => { const js = []; let j = u0 + s; while (j < u1 - 0.5) { js.push(j); j += L; } return js; };
    const minDist = (js, ref) => { let m = Infinity; for (const j of js) for (const r of ref) m = Math.min(m, Math.abs(j - r)); return m; };
    let cands = [];
    if (patt === 'anglaise') {
      const seen = new Set();
      const add = (s, pool) => { s = Math.round(s * 2) / 2; if (s < Math.min(minP, L) - 0.5 || s > L + 0.5 || seen.has(s + (pool ? 'p' : ''))) return; seen.add(s + (pool ? 'p' : '')); cands.push({ s, pool }); };
      st.poolS.map((o) => o.v).sort((a, b) => b - a).forEach((v) => add(Math.min(v, L), true));
      add(L, false);
      for (let s = L - 25; s >= minP; s -= 25) add(s, false);
    } else {
      const off = patt === 'pont12' ? L / 2 : L / 3;
      let j0 = st.X0 + ((rowIdx * off) % L); // position d'un joint de référence
      let first = ((j0 - u0) % L + L) % L; if (first < 20) first += L; if (first > L + 0.5) first -= L;
      cands.push({ s: first, pool: false, forced: true });
    }
    const evals = cands.map((c) => {
      const js = jointsFor(c.s), last = u1 - js[js.length - 1];
      const stag = minDist(js, prevJ), stag2 = minDist(js, prev2J);
      return { ...c, js, last, stag, stag2 };
    });
    const okLast = (e) => e.last >= minP - 0.5 || e.forced;
    let valid = evals.filter((e) => okLast(e) && (e.forced || e.stag >= minS - 0.5));
    let choice;
    if (valid.length) {
      const score = (e) => (e.pool ? 1000 : 0) + (e.stag2 >= minS * 0.5 ? 20 : 0) + Math.min(e.stag, 2 * minS) / minS * 5 + (e.s >= L - 0.5 ? 6 : 0) + Math.min(e.last, L) / L * 2;
      valid.sort((a, b) => score(b) - score(a)); choice = valid[0];
    } else {
      const lastOk = evals.filter(okLast);
      const pool = lastOk.length ? lastOk : evals;
      pool.sort((a, b) => (b.stag - a.stag) || (b.last - a.last)); choice = pool[0];
      if (choice.stag < minS - 0.5 && isFinite(choice.stag)) warn.push('décalage de joints ' + fmt(choice.stag));
      if (choice.last < minP - 0.5) warn.push('chute de ' + fmt(choice.last));
    }
    // matérialiser
    const s = choice.s; let src = 'new', from = null, rest = 0;
    if (s >= L - 0.5) { newBoard(); }
    else {
      const t = choice.pool ? takePool(st.poolS, s) : null;
      if (t) { src = 'chute'; addWaste(t.waste); st.reused++; from = t.from; }
      else { newBoard(); const r = L - s; if (r >= keep) { st.poolE.push({ v: r, row }); rest = r; } else addWaste(r); }
    }
    pieces.push({ a: u0, b: u0 + s, len: s, kind: s >= L - 0.5 ? 'full' : 'cut', src, from, rest });
    const js = choice.js;
    for (let k = 0; k < js.length; k++) {
      const a = js[k], b = k + 1 < js.length ? js[k + 1] : u1, len = b - a;
      if (k + 1 < js.length) { newBoard(); pieces.push({ a, b, len, kind: 'full', src: 'new' }); continue; }
      let src2 = 'new', from2 = null, rest2 = 0;
      if (len >= L - 0.5) { newBoard(); pieces.push({ a, b, len, kind: 'full', src: 'new' }); continue; }
      const t = takePool(st.poolE, len);
      if (t) { src2 = 'chute'; addWaste(t.waste); st.reused++; from2 = t.from; }
      else { newBoard(); const r = L - len; if (r >= keep) { st.poolS.push({ v: r, row }); rest2 = r; } else addWaste(r); }
      pieces.push({ a, b, len, kind: 'cut', src: src2, from: from2, rest: rest2 });
    }
    return { pieces, joints: js.slice(), warn, stagger: choice.stag };
  }

  /* ---------- calcul d'un groupe de pièces partageant sens et alignement ---------- */
  function computeGroup(rooms, obstaclesAll, P, opts = {}) {
    const W = P.W, L = P.L;
    const lead = rooms.slice().sort((a, b) => G.area(b.pts) - G.area(a.pts))[0];
    const obsFor = (room) => { const bb = G.bbox(room.pts); return obstaclesAll.filter((o) => { const ob = G.bbox(o.pts); return ob.x1 > bb.x0 && ob.x0 < bb.x1 && ob.y1 > bb.y0 && ob.y0 < bb.y1; }); };
    // sens
    let rec = null, ang;
    const manual = rooms.find((r) => r.cal && r.cal.dir != null && r.cal.dir !== 'auto');
    if (manual) ang = G.rad(+manual.cal.dir);
    else { rec = recommendDir(lead, P, obsFor(lead)); ang = rec.ang; }
    // repère local : lames selon x
    const build = (a) => rooms.map((room) => {
      const loc = rotAll(room.pts, -a), outer = G.offset(loc, P.gap);
      const obs = obsFor(room), holes = obs.map((o) => G.offset(rotAll(o.pts, -a), -P.gap));
      return { room, loc, outer, holes, obs };
    });
    let R = build(ang);
    // mur de départ
    const leadR = R.find((x) => x.room === lead);
    let side = 'B', startEdgeIdx = null;
    const userStart = lead.cal && lead.cal.start != null && lead.cal.start !== 'auto' ? +lead.cal.start : null;
    const n = lead.pts.length;
    const edgeInfo = (i) => { const a = leadR.loc[i], b = leadR.loc[(i + 1) % n], d = G.sub(b, a), l = G.len(d); return { i, a, b, l, horiz: l > 0 && Math.abs(d.y) / l < Math.sin(G.rad(20)), side: d.x > 0 ? 'B' : 'T', y: (a.y + b.y) / 2 }; };
    if (userStart != null && userStart < n && edgeInfo(userStart).horiz) { const e = edgeInfo(userStart); side = e.side; startEdgeIdx = userStart; }
    else {
      const bb = G.bbox(leadR.loc), tolY = Math.max(W, 0.08 * bb.h);
      const es = []; for (let i = 0; i < n; i++) { const e = edgeInfo(i); if (!e.horiz) continue; if (e.side === 'B' && e.y < bb.y0 + tolY) es.push(e); if (e.side === 'T' && e.y > bb.y1 - tolY) es.push(e); }
      const doors = (lead.openings || []).filter((o) => o.type === 'porte' || o.type === 'coulissante' || o.type === 'passage');
      const doorSide = (e) => doors.some((o) => o.wall === e.i);
      es.sort((a, b) => (b.l - a.l) || ((doorSide(a) ? 1 : 0) - (doorSide(b) ? 1 : 0)));
      if (es.length) {
        const top = es[0], alt = es.find((e) => e.side !== top.side);
        let pick = top;
        if (alt && alt.l > 0.85 * top.l && doorSide(top) && !doorSide(alt)) pick = alt;
        side = pick.side; startEdgeIdx = pick.i;
      }
    }
    if (side === 'T') { ang += Math.PI; R = build(ang); }
    const leadR2 = R.find((x) => x.room === lead);
    const startE = startEdgeIdx != null ? (() => { const a = leadR2.loc[startEdgeIdx], b = leadR2.loc[(startEdgeIdx + 1) % n]; return { a, b, y: Math.min(a.y, b.y) + P.gap }; })() : null;
    const startY = startE ? (() => { const oy = G.bbox(leadR2.outer); const near = horizEdges(leadR2.outer, []).filter((e) => e.side === 'B').sort((p, q) => Math.abs(p.y - startE.y) - Math.abs(q.y - startE.y))[0]; return near ? (near.dev > 3 && near.dev <= W / 3 ? near.ya : near.y) : oy.y0; })() : G.bbox(leadR2.outer).y0;
    // phase
    const edges = R.flatMap((x) => horizEdges(x.outer, x.holes));
    const ph = bestPhase(edges, W, startY, P, (lead.cal && lead.cal.first) || P.firstRow);
    const p = ph.p;
    // rangs
    let gy0 = Infinity, gy1 = -Infinity; R.forEach((x) => { const b = G.bbox(x.outer); gy0 = Math.min(gy0, b.y0); gy1 = Math.max(gy1, b.y1); });
    const kmin = Math.floor((gy0 - p) / W), kmax = Math.ceil((gy1 - p) / W);
    // sens de pose dans le rang : depuis l'angle gauche face au mur de départ => u = -x
    const s = opts.fromRight ? 1 : -1;
    const st = { boards: 0, reused: 0, wasteLen: 0, poolS: [], poolE: [], X0: 0 };
    // origine des motifs réguliers
    if (P.pattern !== 'anglaise') {
      const off = P.pattern === 'pont12' ? L / 2 : L / 3; let best = null;
      const runsAll = [];
      for (const x of R) for (let k = kmin; k < kmax; k++) { const ya = p + k * W, yb = ya + W; const iv = G.mergeIntervals([ya + 0.5, yb - 0.5, (ya + yb) / 2].flatMap((y) => regionIntervals(x.outer, x.holes, y))); iv.forEach((v) => runsAll.push({ k, u0: Math.min(s * v[0], s * v[1]), u1: Math.max(s * v[0], s * v[1]) })); }
      for (let X0 = 0; X0 < L; X0 += 10) {
        let mn = Infinity;
        for (const r of runsAll) { if (r.u1 - r.u0 <= L) continue; const j0 = X0 + (((r.k - kmin) * off) % L); let first = ((j0 - r.u0) % L + L) % L; if (first < 20) first += L; let j = r.u0 + first; while (j + L < r.u1 - 0.5) j += L; const last = r.u1 - j; mn = Math.min(mn, first, last); }
        if (!best || mn > best.mn) best = { X0, mn };
      }
      st.X0 = best ? best.X0 : 0;
    }
    const out = R.map((x) => ({ room: x.room, rows: [], warn: [], boards: 0, outer: x.outer, holes: x.holes, obs: x.obs }));
    let prevJ = [], prev2J = [];
    for (let k = kmin; k < kmax; k++) {
      const ya = p + k * W, yb = ya + W, rowIdx = k - kmin; const rowJ = [];
      for (let ri = 0; ri < R.length; ri++) {
        const x = R[ri], ob = G.bbox(x.outer); if (yb <= ob.y0 + 0.01 || ya >= ob.y1 - 0.01) continue;
        const ys = [ya + 0.3, yb - 0.3, (ya + yb) / 2];
        [x.outer, ...x.holes].forEach((Rg) => Rg.forEach((q) => { if (q.y > ya && q.y < yb) ys.push(q.y); }));
        let iv = G.mergeIntervals(ys.flatMap((y) => regionIntervals(x.outer, x.holes, y)));
        iv = iv.filter((v) => v[1] - v[0] > 5);
        if (!iv.length) continue;
        const sw = [swap(x.outer)], swh = x.holes.map(swap);
        const runs = iv.map((v) => ({ u0: Math.min(s * v[0], s * v[1]), u1: Math.max(s * v[0], s * v[1]), x0: v[0], x1: v[1] })).sort((a, b) => a.u0 - b.u0);
        const row = { k, num: rowIdx + 1, ya, yb, runs: [], ripMax: 0, ripMin: Infinity, warn: [] };
        for (const run of runs) {
          // largeur couverte (délignage)
          const xs = []; for (let t = 0; t <= 12; t++) xs.push(run.x0 + ((run.x1 - run.x0) * t) / 12);
          [x.outer, ...x.holes].forEach((Rg) => Rg.forEach((q) => { if (q.x > run.x0 && q.x < run.x1) xs.push(q.x); }));
          for (const xx of xs) {
            const xv = Math.min(Math.max(xx, run.x0 + 0.3), run.x1 - 0.3);
            let ivy = G.intervalsAtY(sw, xv); if (swh.length) ivy = G.subtractIntervals(ivy, G.mergeIntervals(swh.flatMap((H) => G.intervalsAtY([H], xv))));
            let h = 0; ivy.forEach((v) => { const a = Math.max(v[0], ya), b = Math.min(v[1], yb); if (b > a) h += b - a; });
            if (h > 0.5) { row.ripMax = Math.max(row.ripMax, h); row.ripMin = Math.min(row.ripMin, h); }
          }
        }
        if (row.ripMin === Infinity) row.ripMin = row.ripMax;
        if (row.ripMax < 3) continue; // pointe de moins de 3 mm : absorbée par le jeu au mur
        for (const run of runs) {
          const r = layRun(run.u0, run.u1, prevJ, prev2J, st, P, rowIdx, P.pattern);
          r.pieces.forEach((pc) => { pc.x0 = Math.min(s * pc.a, s * pc.b); pc.x1 = Math.max(s * pc.a, s * pc.b); });
          row.runs.push({ u0: run.u0, u1: run.u1, x0: run.x0, x1: run.x1, pieces: r.pieces, stagger: r.stagger });
          r.joints.forEach((j) => rowJ.push(j));
          if (r.warn.length) row.warn.push(...r.warn);
        }
        out[ri].rows.push(row);
      }
      prev2J = prevJ; prevJ = rowJ;
    }
    // numérotation continue des rangs réellement posés
    { const ks = [...new Set(out.flatMap((o) => o.rows.map((r) => r.k)))].sort((a, b) => a - b); const kn = new Map(ks.map((k, i) => [k, i + 1])); out.forEach((o) => o.rows.forEach((r) => { r.num = kn.get(r.k); })); }
    // comptages par pièce (les chutes circulent dans le groupe)
    out.forEach((o) => { let nb = 0, cuts = 0; o.rows.forEach((r) => r.runs.forEach((ru) => ru.pieces.forEach((pc) => { if (pc.src === 'new' && (pc.kind === 'full' || true)) nb++; if (pc.kind === 'cut') cuts++; }))); o.piecesNew = nb; o.cuts = cuts; });
    return { ang, side, rec, p, phase: ph, rooms: out, stats: st, startEdgeIdx, lead, startY, kmin, s };
  }

  /* ---------- conseils pour une pièce ---------- */
  function adviceFor(gr, o, P, ctx) {
    const room = o.room, n = room.pts.length, A = [], W = P.W, L = P.L;
    const rows = o.rows; if (!rows.length) return { lines: ['Pièce trop petite pour être calepinée.'], first: null, last: null };
    const first = rows[0], last = rows[rows.length - 1];
    const angDeg = ((G.deg(gr.ang) % 180) + 180) % 180;
    // mur parallèle de référence
    let refWall = 0, bestd = 9; for (let i = 0; i < n; i++) { const a = room.pts[i], b = room.pts[(i + 1) % n]; const d = Math.abs(G.normAng(2 * (Math.atan2(b.y - a.y, b.x - a.x) - gr.ang))); if (d < bestd && G.dist(a, b) > 500) { bestd = d; refWall = i; } }
    const parallelTxt = bestd < G.rad(3) ? `parallèles au mur ${wallName(refWall, n)}` : `à ${angDeg.toFixed(0)}°`;
    A.push({ t: 'sens', s: `Lames ${parallelTxt}` + (gr.rec && room === gr.lead ? ` — ${gr.rec.why.join(', ')}.` : '.') });
    if (o.room === gr.lead && gr.startEdgeIdx != null) {
      const i = gr.startEdgeIdx, a = room.pts[i], b = room.pts[(i + 1) % n];
      const la = G.rot(a, -gr.ang), lb = G.rot(b, -gr.ang);
      const left = (gr.s === -1) ? (la.x > lb.x ? i : (i + 1) % n) : (la.x < lb.x ? i : (i + 1) % n);
      const dev = Math.abs(la.y - lb.y);
      A.push({ t: 'depart', s: `Départ le long du mur ${wallName(i, n)} (${fmtm(G.dist(a, b))}), en commençant dans l'angle ${String.fromCharCode(65 + left)} — à gauche quand on fait face au mur, sauf sens d'emboîtement contraire indiqué par le fabricant.` });
      if (dev > 2) A.push({ t: 'equerre', s: `Le mur de départ n'est pas rectiligne par rapport aux lames : ${Math.round(dev)} mm d'écart sur sa longueur. Tirer le 1er rang au cordeau et reporter la forme du mur sur les lames (trusquin / compas).`, warn: true });
    } else if (gr.lead !== room) {
      A.push({ t: 'depart', s: `Calepinage commun avec ${gr.lead.name || 'la pièce principale'} : rangs alignés à travers les passages.` });
    }
    const rip = (r) => (r.ripMax >= W - 0.5 ? 'lames entières' : `lames délignées à ${Math.round(r.ripMax)} mm` + (r.ripMax - r.ripMin > 2 ? ` (en biais, de ${Math.round(r.ripMin)} à ${Math.round(r.ripMax)} mm)` : ''));
    A.push({ t: 'rangs', s: `${rows.length} rangs. 1er rang : ${rip(first)}${first.ripMax >= W - 0.5 && P.lay === 'flottante' ? ', languette retirée côté mur' : ''}. Dernier rang : ${rip(last)}.` });
    const thin = rows.filter((r) => r.ripMax < Math.max(P.minRow, 0.5) && r.ripMax > 0.5);
    if (thin.length) A.push({ t: 'fin', s: `${thin.length} rang(s) très étroit(s) (< ${P.minRow} mm) : glisser sous la plinthe ou ajuster le calepinage.`, warn: true });
    const warns = rows.flatMap((r) => r.warn.map((w) => `rang ${r.num} : ${w}`));
    if (warns.length) A.push({ t: 'joints', s: `Contraintes non tenues : ${warns.slice(0, 4).join(' ; ')}${warns.length > 4 ? '…' : ''}`, warn: true });
    else A.push({ t: 'joints', s: `Décalage des joints ≥ ${fmt(P.minStagger)} et coupes ≥ ${fmt(P.minPiece)} partout.` });
    A.push({ t: 'jeu', s: `Jeu périphérique ${P.gap} mm le long des murs${o.obs.length ? ' et autour des obstacles' : ''}${P.gapMode === 'auto' ? ` (${String(P.gapPerM).replace('.', ',')} mm par mètre de la plus grande longueur posée d'un seul tenant, ${P.gapMin} mm au minimum)` : ''}, caché par les plinthes : cales de ${P.gap} mm contre les murs pendant la pose.` });
    // obstacles
    o.obs.forEach((ob) => {
      if (ob.kind === 'poteau') A.push({ t: 'obst', s: `${ob.name || 'Poteau'} : découpe ajustée avec ${P.gap} mm de jeu, finition par rosace ou joint souple.` });
      else if (ob.kind === 'escalier') A.push({ t: 'obst', s: `${ob.name || 'Escalier'} (${ob.stair && ob.stair.dir === 'descend' ? 'trémie, escalier qui descend' : 'escalier qui monte'}) : ${ob.stair && ob.stair.dir === 'descend' ? 'profilé nez de marche en rive de trémie' : 'arrêt au pied de la 1re marche avec joint de dilatation et profilé'}.` });
      else A.push({ t: 'obst', s: `${ob.name || 'Zone exclue'} : arrêt du parquet sur le pourtour avec ${P.gap} mm de jeu.` });
    });
    // jonctions
    const doors = (room.openings || []).filter((x) => ['porte', 'coulissante', 'passage'].includes(x.type));
    doors.forEach((d) => {
      const other = ctx.byId[d.to];
      const sameGroup = other && ctx.groupOf(other) === ctx.groupOf(room) && ctx.groupOf(room);
      const nm = other ? other.name : 'pièce voisine';
      if (sameGroup) A.push({ t: 'jonction', s: `Passage vers ${nm} : pose continue, rangs alignés. Recouper le bas des huisseries à l'épaisseur du parquet + sous-couche pour glisser les lames dessous.` });
      else if (other && other.parquet === false) A.push({ t: 'jonction', s: `Passage vers ${nm} : profilé de transition (changement de revêtement) sous le vantail fermé.` });
      else A.push({ t: 'jonction', s: `Passage vers ${nm} : ${P.lay === 'flottante' ? 'joint de fractionnement + barre de seuil' : 'barre de seuil'} à l'aplomb du vantail fermé. Recouper le bas des huisseries.` });
    });
    // fractionnement
    const bb = G.bbox(o.outer);
    if (P.lay === 'flottante' && (bb.w > P.maxAlong || bb.h > P.maxAcross)) A.push({ t: 'fract', s: `Dimensions ${fmtm(bb.w)} × ${fmtm(bb.h)} : au-delà des limites d'une pose flottante d'un seul tenant (${fmtm(P.maxAlong)} × ${fmtm(P.maxAcross)}), prévoir un joint de fractionnement — vérifier la notice du fabricant.`, warn: true });
    return { lines: A, first, last };
  }

  /* ---------- calcul complet d'un étage ---------- */
  function computeFloor(shapes, P0) {
    const P = Object.assign({}, DEFAULTS, P0 || {});
    const rooms = shapes.filter((s) => s.kind === 'piece' && s.parquet !== false && s.pts && s.pts.length >= 3);
    const obstacles = shapes.filter((s) => (s.kind === 'exclusion' || s.kind === 'escalier' || s.kind === 'poteau' || (s.kind === 'meuble' && s.noParquet)) && s.pts && s.pts.length >= 3).map((s) => ({ ...s, pts: G.ensureCCW(s.pts) }));
    const byId = {}; shapes.forEach((s) => { byId[s.id] = s; });
    const groupOf = (r) => (r.cal && r.cal.group) || '';
    const groups = {}; rooms.forEach((r) => { const g = groupOf(r) || '#' + r.id; (groups[g] = groups[g] || []).push(r); });
    const ctx = { byId, groupOf };
    const results = {}; let totalBoards = 0, totalArea = 0, totalWaste = 0, totalReused = 0;
    for (const g of Object.keys(groups)) {
      let gr, Pg = P, gapInfo = null;
      try {
        if (P.gapMode === 'auto') {
          // jeu périphérique calculé : 1,5 mm par mètre de la plus grande dimension posée d'un seul tenant, avec un minimum
          Pg = Object.assign({}, P, { gap: P.gapMin }); gr = computeGroup(groups[g], obstacles, Pg);
          const ext = (ang) => { const pts = groups[g].flatMap((r) => r.pts.map((p) => G.rot(p, -ang))); const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y); return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; };
          const [dl, dw] = ext(gr.ang), need = Math.max(P.gapMin, Math.ceil((P.gapPerM * Math.max(dl, dw)) / 1000));
          gapInfo = { gap: need, along: dl, across: dw, byLen: Math.ceil((P.gapPerM * dl) / 1000), byWid: Math.ceil((P.gapPerM * dw) / 1000) };
          if (need !== Pg.gap) { Pg = Object.assign({}, P, { gap: need }); gr = computeGroup(groups[g], obstacles, Pg); }
        } else gr = computeGroup(groups[g], obstacles, P);
      } catch (e) { console.error(e); continue; }
      totalBoards += gr.stats.boards; totalWaste += gr.stats.wasteLen; totalReused += gr.stats.reused;
      gr.rooms.forEach((o) => {
        let area = Math.abs(G.area(o.room.pts)); o.obs.forEach((ob) => { const inter = Math.min(Math.abs(G.area(ob.pts)), area); area -= G.pointInPoly(G.centroid(ob.pts), o.room.pts) ? inter : 0; });
        totalArea += area;
        const adv = adviceFor(gr, o, Pg, ctx);
        if (gapInfo && gapInfo.gap > 14) { const half = Math.max(P.gapMin, Math.ceil((P.gapPerM * Math.max(Math.max(gapInfo.along, gapInfo.across) / 2, Math.min(gapInfo.along, gapInfo.across))) / 1000)); adv.lines.push({ t: 'jeu', s: `Jeu de ${gapInfo.gap} mm : plus large que ce que couvre une plinthe courante (10 à 15 mm). Plinthe plus épaisse ou quart-de-rond, ou bien un profil de dilatation au milieu de la plus grande longueur : le jeu redescend alors à ${half} mm.` }); }
        const ph = gr.phase, at = ph && ph.q0 && ph.q0.at ? G.rot({ x: (ph.q0.at.x0 + ph.q0.at.x1) / 2, y: ph.q0.at.y }, gr.ang) : null;
        const phase = ph ? { aligned: ph.aligned, forced: !!ph.forced, fullMin: Math.round(ph.q0.min), chosenMin: Math.round(ph.q.min), good: Math.round(ph.good), at } : null;
        results[o.room.id] = { phase, gap: Pg.gap, gapInfo, group: g, ang: gr.ang, side: gr.side, rows: o.rows, outer: o.outer, holes: o.holes, obs: o.obs, area, advice: adv.lines, piecesNew: o.piecesNew, cuts: o.cuts, lead: gr.lead === o.room, groupStats: gr.stats, groupSize: groups[g].length, rec: gr.rec, startEdgeIdx: gr.lead === o.room ? gr.startEdgeIdx : null };
      });
    }
    const boardArea = (P.L * P.W) / 1e6;
    const perBox = P.perBox || (P.m2Box ? Math.max(1, Math.round(P.m2Box / boardArea)) : 0);
    const byArea = Math.ceil((totalArea / 1e6) * (1 + P.waste / 100) / boardArea);
    return { P, results, totals: { boards: totalBoards, area: totalArea / 1e6, wasteLen: totalWaste, reused: totalReused, boxes: perBox ? Math.ceil(totalBoards / perBox) : null, boxesArea: perBox ? Math.ceil(byArea / perBox) : null, boardsArea: byArea, perBox } };
  }

  /* pièce → polygones monde des lames (pour le rendu) */
  function boardPolys(res) {
    const out = [];
    for (const r of res.rows) for (const run of r.runs) {
      const n = run.pieces.length;
      run.pieces.forEach((pc, k) => {
        const q = [{ x: pc.x0, y: r.ya }, { x: pc.x1, y: r.ya }, { x: pc.x1, y: r.yb }, { x: pc.x0, y: r.yb }].map((p) => G.rot(p, res.ang));
        // extrémité coupée : côté mur (début ou fin de rang) pour une lame recoupée
        let cutA = false, cutB = false;
        if (pc.kind === 'cut') {
          const atStart = k === 0, atEnd = k === n - 1;
          const startIsX0 = Math.abs(pc.x0 - Math.min(run.x0, run.x1)) < 0.6; // l'extrémité x0 touche-t-elle un bout de rang ?
          if (atStart && atEnd) { cutA = cutB = true; }
          else if (atStart || atEnd) { const wallSideIsX0 = Math.abs(pc.x0 - run.x0) < 0.6; if (wallSideIsX0) cutA = true; else cutB = true; void startIsX0; }
        }
        out.push({ poly: q, kind: pc.kind, src: pc.src, len: pc.len, row: r.num, cutA, cutB });
      });
    }
    return out;
  }

  PL.layout = { DEFAULTS, computeFloor, computeGroup, recommendDir, boardPolys, wallName, fmt, fmtm };
})();
