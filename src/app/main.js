/* Calepin — démarrage. */
(function () {
  const App = globalThis.App, S = App.state;
  function boot() {
    App.load();
    if (S.p.seeded) { S.mode = 'calepinage'; S.tab = 'calepinage'; }
    const cv = document.getElementById('cv');
    App.readColors(); App.initView(cv); App.initInput(cv); App.ui.init(); App.ctx.init();
    requestAnimationFrame(() => { App.fitAll(true); App.importer.ensureBg(S.p.floorId); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => App.render());
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => App.render());
    new MutationObserver(() => App.render()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    setTimeout(() => App.cloud.init(), 50);
    window.addEventListener('pagehide', () => App.save());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
