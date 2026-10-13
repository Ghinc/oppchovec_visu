'use strict';
// Variante de Vec1 : revenu fiscal moyen par foyer (IRCOM) au lieu de la médiane du niveau de vie (Filosofi).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chargerApp, lireJson, WEB, photo } = require('./helpers/outils');
const { rangsMoyens, correlationPearson, correlationSpearman, classeJenks } = require(path.join(WEB, 'vec1_variante.js'));

const data = lireJson('data_scores_0_10.json');
const alt = lireJson('vec1_revenu_fiscal.json');
const communes = Object.keys(data);
const proche = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

test('statistiques : rangs moyens (ex æquo), Pearson et Spearman sur des cas calculés à la main', () => {
  assert.deepEqual(rangsMoyens([10, 30, 20, 20]), [1, 4, 2.5, 2.5]);
  assert.ok(proche(correlationPearson([1, 2, 3], [2, 4, 6]), 1));
  assert.ok(proche(correlationPearson([1, 2, 3], [3, 2, 1]), -1));
  assert.ok(proche(correlationSpearman([1, 2, 3], [1, 3, 2]), 0.5));          // rangs (1,2,3) et (1,3,2) : 1 - 6*2/(3*8) = 0,5
  assert.ok(proche(correlationSpearman([1, 2, 3, 4], [1, 100, 1000, 10 ** 6]), 1));   // monotone : 1 même si non linéaire
  assert.equal(correlationPearson([5, 5, 5], [1, 2, 3]), 0);
  assert.equal(classeJenks(2, [2, 4, 6]), 0);                                   // valeur égale au seuil : classe inférieure
  assert.equal(classeJenks(2.0001, [2, 4, 6]), 1);
  assert.equal(classeJenks(9, [2, 4, 6]), 3);
});

test('le fichier de la variante couvre les 360 communes ; les 12 sans donnée DGFiP prennent la valeur de leur département', () => {
  assert.deepEqual(Object.keys(alt.communes).sort(), [...communes].sort());
  const estimees = Object.entries(alt.communes).filter(([, v]) => v.estime_departement);
  assert.equal(estimees.length, 12);
  for (const [, v] of estimees) assert.equal(v.revenu_moyen, alt.moyenne_departement[v.code.slice(0, 2)]);
  for (const v of Object.values(alt.communes)) assert.ok(v.revenu_moyen > 0 && Number.isFinite(v.revenu_moyen));
});

test('calculerIndiceComplet redonne exactement l\'indice de l\'appli (Betti) et celui du fichier de données (p_k égaux)', async () => {
  const app = await chargerApp();
  const ind = JSON.parse(JSON.stringify(app.ev('indicateursOrigine')));
  const betti = app.ev(`JSON.parse(JSON.stringify(calculerIndiceComplet(${JSON.stringify(ind)}, 'betti')))`);
  const egal = app.ev(`JSON.parse(JSON.stringify(calculerIndiceComplet(${JSON.stringify(ind)}, 'egal')))`);
  const indiceApp = JSON.parse(app.ev('JSON.stringify(indiceFinale)'));
  for (const c of communes) {
    assert.ok(proche(betti.indice[c], indiceApp[c], 1e-12), `Betti ${c}`);
    assert.ok(proche(egal.indice[c], data[c].OppChoVec_0_10, 1e-9), `égal ${c}`);
    assert.ok(proche(egal.scoreVec[c], data[c].Score_Vec_0_10, 1e-9), `Score_Vec ${c}`);
  }
});

test('cocher la variante : Vec1 = revenu fiscal, seul ce qui dépend de Vec1 change ; décocher restaure tout, au bit près', async () => {
  const app = await chargerApp();
  const avant = photo(app);
  const jenksAvant = JSON.parse(app.ev('JSON.stringify(seuilsJenks)'));
  app.ev("basculerSourceVec1('ircom')");
  const apres = photo(app);
  for (const c of communes) {
    assert.equal(apres.ind[c].Indicateur_Vec1, alt.communes[c].revenu_moyen, `Vec1 ${c}`);
    for (const k of ['Indicateur_Opp1', 'Indicateur_Opp2', 'Indicateur_Opp3', 'Indicateur_Opp4', 'Indicateur_Cho1', 'Indicateur_Cho2', 'Indicateur_Vec2', 'Indicateur_Vec3', 'Indicateur_Vec4']) {
      assert.equal(apres.ind[c][k], avant.ind[c][k], `${c}.${k}`);
    }
    assert.equal(apres.sc[c].Score_Opp, avant.sc[c].Score_Opp);
    assert.equal(apres.sc[c].Score_Cho, avant.sc[c].Score_Cho);
  }
  assert.notDeepEqual(apres.indice, avant.indice);
  assert.notDeepEqual(apres.sc.Bastia.Score_Vec, avant.sc.Bastia.Score_Vec);
  // l'indice affiché = calcul complet indépendant sur les nouvelles données
  const ind = JSON.parse(app.ev('JSON.stringify(indicateursOrigine)'));
  const attendu = app.ev(`JSON.parse(JSON.stringify(calculerIndiceComplet(${JSON.stringify(ind)}, 'betti')))`);
  for (const c of communes) {
    assert.ok(proche(apres.indice[c], attendu.indice[c], 1e-12), `indice ${c}`);
    assert.ok(proche(apres.sc[c].Score_Vec, attendu.scoreVec[c], 1e-12), `Score_Vec ${c}`);
  }
  // bornes et seuils : ceux des nouvelles données ; Opp et Cho gardent leurs seuils
  const vals = communes.map((c) => alt.communes[c].revenu_moyen);
  assert.equal(app.ev('bornesRef.min.Indicateur_Vec1'), Math.min(...vals));
  assert.equal(app.ev('bornesRef.max.Indicateur_Vec1'), Math.max(...vals));
  const jenksApres = JSON.parse(app.ev('JSON.stringify(seuilsJenks)'));
  assert.deepEqual(jenksApres.opp, jenksAvant.opp);
  assert.deepEqual(jenksApres.cho, jenksAvant.cho);
  assert.notDeepEqual(jenksApres.vec, jenksAvant.vec);
  // retour
  app.ev("basculerSourceVec1('filosofi')");
  assert.deepEqual(photo(app), avant);
  assert.deepEqual(JSON.parse(app.ev('JSON.stringify(seuilsJenks)')), jenksAvant);
  assert.deepEqual(app.appelsAlert, []);
});

test('la comparaison est cohérente : indices des deux sources, corrélations et rangs', async () => {
  const app = await chargerApp();
  const c = app.ev("JSON.parse(JSON.stringify(comparerSourcesVec1('betti')))");
  assert.equal(c.n, 360);
  for (const k of ['pearsonIndice', 'spearmanIndice', 'pearsonVec1', 'spearmanVec1', 'spearmanScoreVec']) assert.ok(c[k] > 0 && c[k] < 1, `${k} = ${c[k]}`);
  assert.ok(c.spearmanVec1 < c.spearmanIndice, 'l\'indice (qui moyenne 10 indicateurs dont 9 communs) est plus proche que Vec1 seul');
  assert.equal(c.points.length, 360);
  const somme = (liste) => liste.reduce((s, e) => s + e.ecart, 0);
  assert.ok(c.gagnantsRevenuFiscal.every((e) => e.ecart > 0) && c.perdantsRevenuFiscal.every((e) => e.ecart < 0));
  assert.ok(c.changementsClasse > 0 && c.changementsClasse < 360);
  // point par point : x = indice de l'appli (Filosofi, Betti)
  const indiceApp = JSON.parse(app.ev('JSON.stringify(indiceFinale)'));
  for (const p of c.points) assert.ok(proche(p.x, indiceApp[p.commune], 1e-12), p.commune);
  assert.ok(Number.isFinite(somme(c.gagnantsRevenuFiscal)));
});
