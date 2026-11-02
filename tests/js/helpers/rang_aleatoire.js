'use strict';
/**
 * Tirage de pondérations au hasard (simplexe + β) et rang de chaque unité avec la formule de l'indice :
 *   I = (1/3) · (Σ_k p_k · d_k^β)^(α/β)        (même formule que calculerIndiceBienEtre ; la renormalisation 0-10 est croissante, elle ne change pas l'ordre)
 * Partagé par le test de propriété (rang_fourchette.test.js) et par le script du rapport.
 */
const path = require('node:path');
const { WEB } = require('./charger_script');
const { rangsIndice } = require(path.join(WEB, 'rang_fourchette.js'));

/** p tiré uniformément sur le simplexe {p_k > 0, Σ p_k = 1} (Dirichlet(1,1,1) : exponentielles normalisées). */
function ponderationsAleatoires(alea, k = 3) {
  const e = Array.from({ length: k }, () => -Math.log(1 - alea()));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

const indiceFormule = (d, p, beta, alpha) => (1 / 3) * Math.pow(p[0] * Math.pow(d[0], beta) + p[1] * Math.pow(d[1], beta) + p[2] * Math.pow(d[2], beta), alpha / beta);

/**
 * `scores` : { unité: { Score_Opp, Score_Cho, Score_Vec } }. Pour chaque tirage fourni par `tirage(alea)` ({ p, beta, alpha }),
 * calcule le rang de chaque unité. Renvoie { min, max } : plus petit et plus grand rang observés par unité.
 */
function rangsObserves(scores, nTirages, alea, tirage) {
  const noms = Object.keys(scores);
  const d = noms.map((n) => [scores[n].Score_Opp, scores[n].Score_Cho, scores[n].Score_Vec]);
  const min = Object.fromEntries(noms.map((n) => [n, Infinity])), max = Object.fromEntries(noms.map((n) => [n, -Infinity]));
  for (let t = 0; t < nTirages; t++) {
    const { p, beta, alpha } = tirage(alea);
    const indice = {};
    noms.forEach((n, i) => { indice[n] = indiceFormule(d[i], p, beta, alpha); });
    const rangs = rangsIndice(indice, noms);
    for (const n of noms) { if (rangs[n] < min[n]) min[n] = rangs[n]; if (rangs[n] > max[n]) max[n] = rangs[n]; }
  }
  return { min, max };
}

/** Tirage « uniforme » demandé : p sur le simplexe, β ∈ [0,5 ; 3], α ∈ [0,5 ; 4]. */
const tirageUniforme = (alea) => ({ p: ponderationsAleatoires(alea), beta: 0.5 + 2.5 * alea(), alpha: 0.5 + 3.5 * alea() });

module.exports = { ponderationsAleatoires, indiceFormule, rangsObserves, tirageUniforme };
