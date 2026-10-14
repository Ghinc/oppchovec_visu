'use strict';
// Onglet Évolution : fonctions de calcul sur serie_temporelle.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { lireJson, WEB } = require('./helpers/outils');
const { evolutionClasse, evolutionValeur, evolutionVariation, evolutionResume, EVOLUTION_SEUILS_VARIATION } = require(path.join(WEB, 'evolution.js'));

const d = lireJson('serie_temporelle.json');
const noms = Object.keys(d.communes);

test('classes : valeur égale au seuil = classe inférieure ; classes de variation symétriques autour de 0', () => {
  assert.equal(evolutionClasse(1, [1, 2, 3]), 0);
  assert.equal(evolutionClasse(1.0001, [1, 2, 3]), 1);
  assert.equal(evolutionClasse(99, [1, 2, 3]), 3);
  assert.deepEqual(EVOLUTION_SEUILS_VARIATION, [-1.5, -0.5, 0.5, 1.5]);
  assert.equal(evolutionClasse(0, EVOLUTION_SEUILS_VARIATION), 2);          // stable
  assert.equal(evolutionClasse(-2, EVOLUTION_SEUILS_VARIATION), 0);         // recul fort
  assert.equal(evolutionClasse(2, EVOLUTION_SEUILS_VARIATION), 4);          // progression forte
});

test('le fichier couvre 360 communes et 2 années ; scores dans [0, 10] ; variation = 2021 - 2016', () => {
  assert.equal(noms.length, 360);
  assert.deepEqual(d.annees, [2016, 2021]);
  for (const c of noms) {
    for (const a of d.annees) for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) {
      const x = evolutionValeur(d, c, a, v);
      assert.ok(x >= -1e-9 && x <= 10 + 1e-9, `${c} ${a} ${v} = ${x}`);
    }
    assert.ok(Math.abs(evolutionVariation(d, c, 'OppChoVec') - (d.communes[c]['2021'].scores_0_10.OppChoVec - d.communes[c]['2016'].scores_0_10.OppChoVec)) < 1e-12);
  }
});

test('échelle commune : les deux années ensemble couvrent exactement 0 et 10 pour chaque variable', () => {
  for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) {
    const tout = noms.flatMap((c) => d.annees.map((a) => evolutionValeur(d, c, a, v)));
    assert.ok(Math.abs(Math.min(...tout)) < 1e-9, `${v} min`);
    assert.ok(Math.abs(Math.max(...tout) - 10) < 1e-9, `${v} max`);
  }
});

test('résumé : effectifs cohérents et classement des plus fortes variations', () => {
  const r = evolutionResume(d, 'OppChoVec');
  assert.equal(r.progressions + r.stables + r.reculs, 360);
  assert.ok(Math.abs(r.moyenne1 - r.moyenne0 - r.variationMoyenne) < 1e-12);
  const tri = noms.map((c) => ({ c, v: evolutionVariation(d, c, 'OppChoVec') })).sort((a, b) => b.v - a.v);
  assert.deepEqual(r.meilleures.map((e) => e.commune), tri.slice(0, 5).map((e) => e.c));
  assert.deepEqual(r.pires.map((e) => e.commune), tri.slice(-5).reverse().map((e) => e.c));
  assert.ok(r.meilleures[0].variation >= r.meilleures[4].variation);
});

test('seuils de Jenks : 4 seuils croissants par variable', () => {
  for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) {
    const s = d.seuils_jenks[v];
    assert.equal(s.length, 4);
    for (let i = 1; i < 4; i++) assert.ok(s[i] > s[i - 1], v);
  }
});
