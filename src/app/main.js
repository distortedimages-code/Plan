/* Calepin — démarrage. */
(function () {
  const App = globalThis.App, S = App.state;
  function boot() {
    App.load();
    if (S.p.seeded) { S.mode = 'calepinage'; S.tab = 'calepinage'; }
    const cv = document.getElementById('cv');
    App.applyTheme(); App.readColors(); App.initView(cv); App.initInput(cv); App.ui.init(); App.ctx.init();
    // pièces simples d'abord : une fois par projet, les décrochements de moins de 30 cm sont redressés (annulable)
    if (!S.p.simpleRooms) {
      const all = S.p.floors.flatMap((f) => App.rooms(f.id)); const todo = all.filter((r) => App.walls.countFixable(r));
      if (todo.length) { App.mutate(() => { todo.forEach((r) => App.walls.simplify(r)); S.p.simpleRooms = 1; }); setTimeout(() => App.toast(`${todo.length} pièce${todo.length > 1 ? 's' : ''} simplifiée${todo.length > 1 ? 's' : ''} : décrochements de moins de 30 cm redressés — Annuler pour revenir`), 900); }
      else S.p.simpleRooms = 1;
    }
    requestAnimationFrame(() => { App.fitAll(true); App.importer.ensureBg(S.p.floorId); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => App.render());
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => App.render());
    new MutationObserver(() => App.render()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    setTimeout(() => App.cloud.init(), 50);
    window.addEventListener('pagehide', () => App.save());
  }
  /* apparence : claire par défaut ; sombre ou selon l'appareil au choix (réglage propre à chaque appareil) */
  App.theme = () => { try { return localStorage.getItem('calepin.theme') || 'light'; } catch (e) { return 'light'; } };
  App.applyTheme = (t = App.theme()) => { document.documentElement.dataset.theme = t; };
  App.setTheme = (t) => { try { localStorage.setItem('calepin.theme', t); } catch (e) { /* stockage indisponible */ } App.applyTheme(t); App.render(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
