/* Calepin — lecteur DXF ASCII minimal (LINE, LWPOLYLINE, POLYLINE, ARC, CIRCLE, TEXT, MTEXT, INSERT, DIMENSION). */
(function () {
  const PL = (globalThis.PL = globalThis.PL || {});
  const UNITS = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 14: 100, 0: null };
  const ACI = ['#000000', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#000000', '#808080', '#c0c0c0'];

  function pairs(text) {
    const L = text.split(/\r?\n/); const out = [];
    for (let i = 0; i + 1 < L.length; i += 2) out.push([parseInt(L[i].trim(), 10), L[i + 1].replace(/\s+$/, '')]);
    return out;
  }

  function parse(text) {
    const P = pairs(text); let i = 0;
    const header = {}, blocks = {}, layers = {}; const entities = [];
    const readEntity = () => { // P[i] est [0, TYPE]
      const type = P[i][1]; const e = { type, g: [] }; i++;
      while (i < P.length && P[i][0] !== 0) { e.g.push(P[i]); i++; }
      return e;
    };
    while (i < P.length) {
      const [c, v] = P[i];
      if (c === 0 && v === 'SECTION') {
        const name = P[i + 1][1]; i += 2;
        if (name === 'HEADER') { let key = null; while (i < P.length && !(P[i][0] === 0 && P[i][1] === 'ENDSEC')) { if (P[i][0] === 9) key = P[i][1]; else if (key) header[key] = header[key] || P[i][1]; i++; } }
        else if (name === 'TABLES') { while (i < P.length && !(P[i][0] === 0 && P[i][1] === 'ENDSEC')) { if (P[i][0] === 0 && P[i][1] === 'LAYER') { const e = readEntity(); const nm = (e.g.find((p) => p[0] === 2) || [])[1]; const col = +((e.g.find((p) => p[0] === 62) || [])[1] || 7); if (nm) layers[nm] = Math.abs(col); } else i++; } }
        else if (name === 'BLOCKS') {
          let cur = null;
          while (i < P.length && !(P[i][0] === 0 && P[i][1] === 'ENDSEC')) {
            if (P[i][0] === 0 && P[i][1] === 'BLOCK') { const e = readEntity(); const nm = (e.g.find((p) => p[0] === 2) || [])[1]; const bx = +((e.g.find((p) => p[0] === 10) || [0, 0])[1]), by = +((e.g.find((p) => p[0] === 20) || [0, 0])[1]); cur = blocks[nm] = { base: { x: bx, y: by }, ents: [] }; }
            else if (P[i][0] === 0 && P[i][1] === 'ENDBLK') { cur = null; readEntity(); }
            else if (P[i][0] === 0) { const e = readEntity(); if (cur) cur.ents.push(e); }
            else i++;
          }
        } else if (name === 'ENTITIES') {
          while (i < P.length && !(P[i][0] === 0 && P[i][1] === 'ENDSEC')) { if (P[i][0] === 0) entities.push(readEntity()); else i++; }
        } else { while (i < P.length && !(P[i][0] === 0 && P[i][1] === 'ENDSEC')) i++; }
      }
      i++;
    }
    return { header, blocks, layers, entities };
  }

  // regroupe POLYLINE + VERTEX + SEQEND
  function normalize(ents) {
    const out = [];
    for (let k = 0; k < ents.length; k++) {
      const e = ents[k];
      if (e.type === 'POLYLINE') { const vs = []; let j = k + 1; while (j < ents.length && ents[j].type === 'VERTEX') { vs.push(ents[j]); j++; } if (j < ents.length && ents[j].type === 'SEQEND') j++; e.vertices = vs; out.push(e); k = j - 1; }
      else out.push(e);
    }
    return out;
  }

  function toRaw(text) {
    const d = parse(text);
    let k = UNITS[+(d.header.$INSUNITS || 0)] || null;
    const styles = [], sIdx = {}, segs = [], curves = [], texts = [], bez = [];
    const styleOf = (layer, color, kind) => { const key = layer + '|' + color + '|' + kind; let s = sIdx[key]; if (s == null) { s = sIdx[key] = styles.length; styles.push({ key, kind: 'S', stroke: ACI[color % 10] || '#000000', fill: null, lw: 0.3, mc: layer, layer, n: 0, len: 0, dxfKind: kind }); } return s; };
    const T = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
    const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
    const addSeg = (a, b, st) => { const l = Math.hypot(b.x - a.x, b.y - a.y); if (l < 1e-9) return; segs.push({ a: { x: a.x, y: -a.y }, b: { x: b.x, y: -b.y }, st }); styles[st].n++; styles[st].len += l; };
    const val = (e, c, def) => { const p = e.g.find((q) => q[0] === c); return p ? p[1] : def; };
    const num = (e, c, def = 0) => { const p = e.g.find((q) => q[0] === c); return p ? +p[1] : def; };
    const walk = (ents, m, depth, parentLayer) => {
      for (const e of normalize(ents)) {
        let layer = val(e, 8, '0'); if (layer === '0' && parentLayer) layer = parentLayer;
        let color = Math.abs(+val(e, 62, 256)); if (color === 256 || color === 0) color = d.layers[layer] || 7;
        if (e.type === 'LINE') { const st = styleOf(layer, color, 'line'); addSeg(T(m, num(e, 10), num(e, 20)), T(m, num(e, 11), num(e, 21)), st); }
        else if (e.type === 'LWPOLYLINE') {
          const st = styleOf(layer, color, 'line'); const closed = (num(e, 70) & 1) === 1; const pts = []; let cx = null;
          for (const [c, v] of e.g) { if (c === 10) cx = +v; else if (c === 20 && cx != null) { pts.push(T(m, cx, +v)); cx = null; } }
          for (let j = 0; j + 1 < pts.length; j++) addSeg(pts[j], pts[j + 1], st); if (closed && pts.length > 2) addSeg(pts[pts.length - 1], pts[0], st);
        } else if (e.type === 'POLYLINE') {
          const st = styleOf(layer, color, 'line'); const closed = (num(e, 70) & 1) === 1; const pts = (e.vertices || []).map((v) => T(m, num(v, 10), num(v, 20)));
          for (let j = 0; j + 1 < pts.length; j++) addSeg(pts[j], pts[j + 1], st); if (closed && pts.length > 2) addSeg(pts[pts.length - 1], pts[0], st);
        } else if (e.type === 'ARC' || e.type === 'CIRCLE') {
          const st = styleOf(layer, color, 'arc'); const cx = num(e, 10), cy = num(e, 20), r = num(e, 40);
          let a0 = e.type === 'ARC' ? (num(e, 50) * Math.PI) / 180 : 0, a1 = e.type === 'ARC' ? (num(e, 51) * Math.PI) / 180 : 2 * Math.PI; if (a1 <= a0) a1 += 2 * Math.PI;
          const nseg = Math.max(6, Math.ceil(((a1 - a0) / (2 * Math.PI)) * 48)); let prev = null;
          for (let j = 0; j <= nseg; j++) { const a = a0 + ((a1 - a0) * j) / nseg; const p = T(m, cx + r * Math.cos(a), cy + r * Math.sin(a)); if (prev) addSeg(prev, p, st); prev = p; }
          if (e.type === 'ARC') {
            curves.push({ c: T(m, cx, cy), r: r * Math.hypot(m[0], m[1]), a0, a1, st });
            // en Bézier (≤ 90° par morceau), pour la détection des portes comme dans un PDF
            const np = Math.max(1, Math.ceil((a1 - a0) / (Math.PI / 2) - 1e-9)), da = (a1 - a0) / np, kk = (4 / 3) * Math.tan(da / 4);
            const F = (q) => ({ x: q.x, y: -q.y });
            for (let j = 0; j < np; j++) {
              const t0 = a0 + j * da, t1 = t0 + da; const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
              bez.push({ p0: F(T(m, cx + r * c0, cy + r * s0)), c1: F(T(m, cx + r * (c0 - kk * s0), cy + r * (s0 + kk * c0))), c2: F(T(m, cx + r * (c1 + kk * s1), cy + r * (s1 - kk * c1))), p3: F(T(m, cx + r * c1, cy + r * s1)), st });
            }
          }
        } else if (e.type === 'TEXT' || e.type === 'MTEXT') {
          let s = val(e, 1, ''); if (e.type === 'MTEXT') s = (e.g.filter((p) => p[0] === 3).map((p) => p[1]).join('') + s).replace(/\\P/g, ' ').replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, '');
          const p = T(m, num(e, 10), num(e, 20)); const h = num(e, 40, 2.5) * Math.hypot(m[0], m[1]); const rot = (num(e, 50) * Math.PI) / 180 + Math.atan2(m[1], m[0]);
          if (s.trim()) texts.push({ s: s.trim(), x: p.x, y: -p.y, h, rot: -rot, w: s.length * h * 0.6 });
        } else if ((e.type === 'INSERT' || e.type === 'DIMENSION') && depth < 5) {
          const bn = val(e, 2, null); const b = bn && d.blocks[bn]; if (!b) continue;
          if (e.type === 'DIMENSION') { walk(b.ents, m, depth + 1, layer); continue; }
          const sx = num(e, 41, 1), sy = num(e, 42, 1), rot = (num(e, 50) * Math.PI) / 180, ix = num(e, 10), iy = num(e, 20);
          const c = Math.cos(rot), s = Math.sin(rot);
          const local = [c * sx, s * sx, -s * sy, c * sy, ix - (c * sx * b.base.x - s * sy * b.base.y), iy - (s * sx * b.base.x + c * sy * b.base.y)];
          walk(b.ents, mul(m, local), depth + 1, layer);
        }
      }
    };
    walk(d.entities, [1, 0, 0, 1, 0, 0], 0, null);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    segs.forEach((s) => { for (const p of [s.a, s.b]) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); } });
    const ext = Math.max(x1 - x0, y1 - y0);
    let guessed = false;
    if (!k) { guessed = true; k = ext < 300 ? 1000 : ext < 6000 ? 10 : 1; }
    return { raw: { width: x1 - x0, height: 0, styles, segs, curves: bez, texts, dxfArcs: curves, bbox: { x0, y0, x1, y1 } }, k, guessed, units: d.header.$INSUNITS };
  }

  PL.dxf = { parse, toRaw };
})();
