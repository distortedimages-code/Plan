/* Calepin — extraction vectorielle d'une page PDF via pdf.js (3.x) : segments, courbes, textes. */
(function () {
  const PL = (globalThis.PL = globalThis.PL || {});
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const ap = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
  const hex = (a) => (typeof a[0] === 'string' ? a[0] : '#' + [a[0], a[1], a[2]].map((v) => (v | 0).toString(16).padStart(2, '0')).join(''));

  async function extractPage(pdfjsLib, page) {
    const O = pdfjsLib.OPS;
    const vp = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();
    let ctm = vp.transform.slice(), lw = 1, stroke = '#000000', fill = '#000000';
    const stack = [], mc = [], styles = [], styleIdx = {}, segs = [], curves = [];
    const formStack = [];
    const styleOf = (kind, sc) => {
      const key = kind + '|' + (kind !== 'F' ? stroke + '|' + (Math.round(lw * sc * 100) / 100) : '') + '|' + (kind !== 'S' ? fill : '') + '|' + (mc[mc.length - 1] || '');
      let i = styleIdx[key];
      if (i == null) { i = styleIdx[key] = styles.length; styles.push({ key, kind, stroke: kind !== 'F' ? stroke : null, fill: kind !== 'S' ? fill : null, lw: kind !== 'F' ? lw * sc : 0, mc: mc[mc.length - 1] || '', n: 0, len: 0 }); }
      return i;
    };
    const fa = ops.fnArray, aa = ops.argsArray;
    for (let i = 0; i < fa.length; i++) {
      const f = fa[i], a = aa[i];
      if (f === O.save) stack.push({ ctm: ctm.slice(), lw, stroke, fill });
      else if (f === O.restore) { const s = stack.pop(); if (s) ({ ctm, lw, stroke, fill } = s); }
      else if (f === O.transform) ctm = mul(ctm, a);
      else if (f === O.paintFormXObjectBegin) { formStack.push(ctm.slice()); if (a && a[0]) ctm = mul(ctm, a[0]); }
      else if (f === O.paintFormXObjectEnd) { const c = formStack.pop(); if (c) ctm = c; }
      else if (f === O.setLineWidth) lw = a[0];
      else if (f === O.setStrokeRGBColor || f === O.setStrokeColor) { if (a && a.length >= 1) stroke = a.length >= 3 || typeof a[0] === 'string' ? hex(a) : '#' + [a[0], a[0], a[0]].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); }
      else if (f === O.setFillRGBColor || f === O.setFillColor) { if (a && a.length >= 1) fill = a.length >= 3 || typeof a[0] === 'string' ? hex(a) : '#' + [a[0], a[0], a[0]].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); }
      else if (f === O.setStrokeGray) stroke = '#' + Array(3).fill(Math.round(a[0] * 255).toString(16).padStart(2, '0')).join('');
      else if (f === O.setFillGray) fill = '#' + Array(3).fill(Math.round(a[0] * 255).toString(16).padStart(2, '0')).join('');
      else if (f === O.beginMarkedContentProps) mc.push((a[1] && (a[1].id || a[1].name)) || a[0] || '');
      else if (f === O.beginMarkedContent) mc.push(a[0] || '');
      else if (f === O.endMarkedContent) mc.pop();
      else if (f === O.constructPath) {
        const nf = fa[i + 1];
        let kind = null;
        if (nf === O.stroke || nf === O.closeStroke) kind = 'S';
        else if (nf === O.fill || nf === O.eoFill) kind = 'F';
        else if (nf === O.fillStroke || nf === O.eoFillStroke || nf === O.closeFillStroke || nf === O.closeEOFillStroke) kind = 'FS';
        if (!kind) continue; // chemins de découpe
        const sc = Math.hypot(ctm[0], ctm[1]);
        const st = styleOf(kind, sc);
        const [pops, co] = a; let k = 0, start = null, cur = null;
        const seg = (p, q) => { const l = Math.hypot(q.x - p.x, q.y - p.y); if (l < 1e-3) return; segs.push({ a: p, b: q, st }); styles[st].n++; styles[st].len += l; };
        for (const op of pops) {
          if (op === O.moveTo) { cur = start = ap(ctm, co[k], co[k + 1]); k += 2; }
          else if (op === O.lineTo) { const p = ap(ctm, co[k], co[k + 1]); k += 2; if (cur) seg(cur, p); cur = p; if (!start) start = p; }
          else if (op === O.curveTo) { const c1 = ap(ctm, co[k], co[k + 1]), c2 = ap(ctm, co[k + 2], co[k + 3]), p = ap(ctm, co[k + 4], co[k + 5]); k += 6; if (cur) curves.push({ p0: cur, c1, c2, p3: p, st }); cur = p; }
          else if (op === O.curveTo2) { const c2 = ap(ctm, co[k], co[k + 1]), p = ap(ctm, co[k + 2], co[k + 3]); k += 4; if (cur) curves.push({ p0: cur, c1: cur, c2, p3: p, st }); cur = p; }
          else if (op === O.curveTo3) { const c1 = ap(ctm, co[k], co[k + 1]), p = ap(ctm, co[k + 2], co[k + 3]); k += 4; if (cur) curves.push({ p0: cur, c1, c2: p, p3: p, st }); cur = p; }
          else if (op === O.closePath) { if (cur && start) seg(cur, start); cur = start; }
          else if (op === O.rectangle) {
            const x = co[k], y = co[k + 1], w = co[k + 2], h = co[k + 3]; k += 4;
            const q = [ap(ctm, x, y), ap(ctm, x + w, y), ap(ctm, x + w, y + h), ap(ctm, x, y + h)];
            for (let j = 0; j < 4; j++) seg(q[j], q[(j + 1) % 4]);
            cur = start = q[0];
          }
        }
        if ((kind === 'F' || kind === 'FS') && cur && start && (cur.x !== start.x || cur.y !== start.y)) seg(cur, start);
      }
    }
    // textes
    const tc = await page.getTextContent();
    const texts = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const m = mul(vp.transform, it.transform);
      const h = Math.hypot(m[2], m[3]); const rot = Math.atan2(m[1], m[0]);
      texts.push({ s: it.str, x: m[4], y: m[5], h, rot, w: it.width || it.str.length * h * 0.55 });
    }
    return { width: vp.width, height: vp.height, styles, segs, curves, texts };
  }

  /* fusion des fragments de texte d'une même ligne */
  function mergeTextLines(texts) {
    const items = texts.map((t) => ({ ...t, dir: { x: Math.cos(t.rot), y: Math.sin(t.rot) } }));
    items.sort((a, b) => a.rot - b.rot || a.y - b.y || a.x - b.x);
    const used = new Array(items.length).fill(false), lines = [];
    // index simple : pour chaque item, chercher le suivant dans la ligne
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue; used[i] = true;
      let line = { ...items[i], parts: [items[i]] };
      let grew = true;
      while (grew) {
        grew = false; const last = line.parts[line.parts.length - 1], d = line.dir;
        const endx = last.x + d.x * last.w, endy = last.y + d.y * last.w;
        let best = -1, bd = Infinity;
        for (let j = 0; j < items.length; j++) {
          if (used[j]) continue; const t = items[j];
          if (Math.abs(t.rot - line.rot) > 0.03) continue;
          const dx = t.x - endx, dy = t.y - endy; const along = dx * d.x + dy * d.y, perp = -dx * d.y + dy * d.x;
          const hh = Math.max(line.h, t.h);
          if (along < -0.3 * hh || along > 1.2 * hh || Math.abs(perp) > 0.7 * hh) continue;
          if (along < bd) { bd = along; best = j; }
        }
        if (best >= 0) { used[best] = true; const t = items[best]; const gap = bd; line.s += (gap > 0.25 * line.h ? ' ' : '') + t.s; line.parts.push(t); line.w = (t.x - line.x) * d.x + (t.y - line.y) * d.y + t.w; grew = true; }
      }
      lines.push(line);
    }
    return lines.map((l) => ({ s: l.s.replace(/\s+/g, ' ').trim(), x: l.x, y: l.y, h: l.h, rot: l.rot, w: l.w }));
  }

  PL.pdfvec = { extractPage, mergeTextLines };
})();
