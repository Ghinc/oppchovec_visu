// Applique config_site.js : sans l'option, l'onglet Évolution (bouton et contenu) est retiré de la page.
(function () {
  if (window.SITE_EVOLUTION) return;
  document.querySelectorAll('[data-tab="evolutiontab"], #evolutiontab').forEach(function (e) { e.remove(); });
})();
