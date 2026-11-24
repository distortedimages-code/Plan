const fs = require('fs'), path = require('path'), vm = require('vm');
globalThis.PL = undefined;
for (const f of ['geom','ortho','solver','layout','vector','dxf','pdfvec','raster','library']) {
  const p = path.join(__dirname, '../src/core', f + '.js');
  if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
}
module.exports = globalThis.PL;
