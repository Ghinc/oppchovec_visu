'use strict';
// Onglet Évolution : fonctions de calcul sur serie_temporelle.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { lireJson, WEB } = require('./helpers/outils');
const { evolutionClasse, evolutionCouleursVariation, evolutionValeur, evolutionVariation, evolutionResume, EVOLUTION_SEUILS_VARIATION, EVOLUTION_NEUTRE } = require(path.join(WEB, 'evolution.js'));

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

test('carte d\'évolution : la classe de Jenks qui contient 0 est neutre, rouge en dessous, bleu au-dessus', () => {
  const ROUGE = /^#(b2182b|d6604d|ef8a62|f6b79a)$/, BLEU = /^#(9ecae1|a6cee3|6baed6|3182bd|08519c|4393c3|67a9cf|2166ac)$/;
  for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) {
    const s = d.seuils_jenks_variation[v];
    assert.equal(s.length, 4);
    for (let i = 1; i < 4; i++) assert.ok(s[i] > s[i - 1], v);
    const couleurs = evolutionCouleursVariation(s);
    assert.equal(couleurs.length, 5, v);
    const zero = evolutionClasse(0, s);
    assert.equal(couleurs[zero], EVOLUTION_NEUTRE, `${v} : la classe de 0 est neutre`);
    couleurs.forEach((c, i) => { if (i < zero) assert.match(c, ROUGE, `${v} classe ${i}`); if (i > zero) assert.match(c, BLEU, `${v} classe ${i}`); });
    assert.equal(new Set(couleurs).size, 5, `${v} : 5 couleurs distinctes`);
    // une commune qui recule n'est jamais colorée en bleu, une commune qui progresse jamais en rouge
    for (const c of noms) {
      const x = evolutionVariation(d, c, v), col = couleurs[evolutionClasse(x, s)];
      if (x < 0) assert.ok(!BLEU.test(col), `${v} ${c} ${x}`);
      if (x > 0) assert.ok(!ROUGE.test(col), `${v} ${c} ${x}`);
    }
  }
  // cas général : zéro dans la 1re ou la dernière classe, ou dans la classe du milieu
  assert.deepEqual(evolutionCouleursVariation([1, 2, 3, 4]).slice(0, 1), [EVOLUTION_NEUTRE]);
  assert.equal(evolutionCouleursVariation([-4, -3, -2, -1]).at(-1), EVOLUTION_NEUTRE);
});

test('seuils de Jenks : 4 seuils croissants par variable', () => {
  for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) {
    const s = d.seuils_jenks[v];
    assert.equal(s.length, 4);
    for (let i = 1; i < 4; i++) assert.ok(s[i] > s[i - 1], v);
  }
});
