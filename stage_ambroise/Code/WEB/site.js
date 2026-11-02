// Applique config_site.js : sans l'option, l'onglet Évolution (bouton et contenu) est retiré de la page.
(function () {
  if (window.SITE_EVOLUTION) return;
  document.querySelectorAll('[data-tab="evolutiontab"], #evolutiontab').forEach(function (e) { e.remove(); });
})();

// Onglet « Comparer ma commune » : masqué (jugé trop complexe pour un décideur). Le code reste ; pour le réafficher : window.SITE_COMPARER = true.
// La ligne de fourchette de rang du panneau de la commune et de la fiche EPCI reste, elle, affichée.
(function () {
  if (window.SITE_COMPARER) return;
  document.querySelectorAll('[data-tab="comparertab"], #comparertab').forEach(function (e) { e.remove(); });
})();
