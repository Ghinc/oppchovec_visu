'use strict';
// Onglet Dominance : couches de non-dominance sur (Score_Opp, Score_Cho, Score_Vec).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chargerApp, lireJson, WEB } = require('./helpers/outils');
const { calculerDominance } = require(path.join(WEB, 'dominance.js'));

const sc = (o, c, v) => ({ Score_Opp: o, Score_Cho: c, Score_Vec: v });

// Jeu d'exemple vérifiable à la main (avec égalités et valeurs manquantes) :
//   A=(3,3,3) B=(3,3,3)   ex æquo, aucune ne domine l'autre
//   C=(2,2,2) F=(2,2,2)   ex æquo, dominées par A et B
//   D=(3,1,1)             dominée par A et B (égalité sur Opp, strictement moins sur Cho et Vec) ; C et D ne se comparent pas
//   E=(1,5,1)             personne ne la domine (meilleure Cho) ; domine G
//   H=(4,0,0)             personne ne la domine (meilleure Opp) ; ne domine personne
//   G=(1,1,1)             dominée par A, B, C, F, D, E -> couche 3 (C est en couche 2)
//   X=(null,1,1) Y=(1,NaN,1) Z=(1,1,undefined)  valeurs manquantes : exclues, sans couche
const JEU = {
  A: sc(3, 3, 3), B: sc(3, 3, 3), C: sc(2, 2, 2), F: sc(2, 2, 2), D: sc(3, 1, 1), E: sc(1, 5, 1), H: sc(4, 0, 0), G: sc(1, 1, 1),
  X: sc(null, 1, 1), Y: sc(1, NaN, 1), Z: { Score_Opp: 1, Score_Cho: 1 },
};
const trie = (l) => [...l].sort();

test('jeu d\'exemple : couches, dominants et dominés calculés à la main', () => {
  const r = calculerDominance(JEU);
  assert.deepEqual(r.couches, { A: 1, B: 1, E: 1, H: 1, C: 2, F: 2, D: 2, G: 3 });
  assert.deepEqual(r.effectifs, [4, 3, 1]);
  assert.equal(r.nbCouches, 3);
  assert.deepEqual(trie(r.dominants.G), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(r.domines.G, []);
  assert.deepEqual(trie(r.domines.A), ['C', 'D', 'F', 'G']);          // pas B (égale), pas E ni H (meilleures sur une dimension)
  assert.deepEqual(trie(r.domines.B), ['C', 'D', 'F', 'G']);
  assert.deepEqual(r.dominants.A, []);
  assert.deepEqual(r.dominants.E, []);
  assert.deepEqual(r.dominants.H, []);
  assert.deepEqual(trie(r.domines.E), ['G']);
  assert.deepEqual(r.domines.H, []);
  assert.deepEqual(trie(r.dominants.C), ['A', 'B']);                   // F (égale à C) ne domine pas C
  assert.deepEqual(trie(r.dominants.D), ['A', 'B']);
  assert.deepEqual(trie(r.domines.C), ['G']);
  assert.deepEqual(trie(r.domines.D), ['G']);
});

test('valeurs manquantes (null, NaN, absente) : exclues, signalées avec la dimension en cause, sans couche', () => {
  const r = calculerDominance(JEU);
  assert.deepEqual(r.exclues, [
    { commune: 'X', manquantes: ['Score_Opp'] },
    { commune: 'Y', manquantes: ['Score_Cho'] },
    { commune: 'Z', manquantes: ['Score_Vec'] },
  ]);
  for (const x of ['X', 'Y', 'Z']) {
    assert.ok(!(x in r.couches) && !(x in r.dominants) && !(x in r.domines), `${x} sans couche`);
  }
  // elles ne figurent dans aucune liste de dominance
  for (const l of [...Object.values(r.dominants), ...Object.values(r.domines)]) assert.ok(!l.some((n) => 'XYZ'.includes(n)));
});

test('cas limites : jeu vide, une seule commune, toutes ex æquo, chaîne stricte', () => {
  assert.deepEqual(calculerDominance({}).effectifs, []);
  assert.deepEqual(calculerDominance({ a: sc(1, 1, 1) }).couches, { a: 1 });
  const egales = calculerDominance({ a: sc(2, 2, 2), b: sc(2, 2, 2), c: sc(2, 2, 2) });
  assert.deepEqual(egales.effectifs, [3]);
  assert.deepEqual(egales.domines.a, []);
  const chaine = calculerDominance({ a: sc(3, 3, 3), b: sc(2, 2, 2), c: sc(1, 1, 1) });
  assert.deepEqual(chaine.couches, { a: 1, b: 2, c: 3 });
  assert.deepEqual(trie(chaine.dominants.c), ['a', 'b']);               // la dominance est transitive : c est dominée par a ET b
  // 0 est une valeur valide (et non « manquante »)
  assert.deepEqual(calculerDominance({ a: sc(0, 0, 0), b: sc(0, 0, 1) }).couches, { b: 1, a: 2 });
});

// ----- Données réelles -----
const data = lireJson('data_scores_0_10.json');
const noms = Object.keys(data);
const dims = ['Score_Opp_0_10', 'Score_Cho_0_10', 'Score_Vec_0_10'];
const scoresFichier = Object.fromEntries(noms.map((c) => [c, sc(data[c][dims[0]], data[c][dims[1]], data[c][dims[2]])]));

// Référence indépendante : couche = 1 + (longueur de la plus longue chaîne de dominants au-dessus), par récurrence sur un tri lexicographique
function referenceCouches(scores) {
  const liste = Object.keys(scores);
  const v = (c) => [scores[c].Score_Opp, scores[c].Score_Cho, scores[c].Score_Vec];
  const domine = (a, b) => v(a).every((x, i) => x >= v(b)[i]) && v(a).some((x, i) => x > v(b)[i]);
  const ordre = [...liste].sort((a, b) => { const va = v(a), vb = v(b); return (vb[0] + vb[1] + vb[2]) - (va[0] + va[1] + va[2]); });
  const couche = {};
  for (const c of ordre) {        // un dominant a toujours une somme strictement plus grande : il est donc déjà traité
    couche[c] = 1 + Math.max(0, ...ordre.filter((d) => couche[d] && domine(d, c)).map((d) => couche[d]));
  }
  return couche;
}

test('360 communes : mêmes couches qu\'une référence indépendante (plus longue chaîne de dominants)', () => {
  const r = calculerDominance(scoresFichier);
  assert.equal(Object.keys(r.couches).length, 360);
  assert.deepEqual(r.exclues, []);
  assert.deepEqual(r.couches, referenceCouches(scoresFichier));
  assert.equal(r.effectifs.reduce((a, b) => a + b, 0), 360);
});

test('360 communes : aucune commune ne domine une commune d\'une couche inférieure (ou égale) à la sienne', () => {
  const r = calculerDominance(scoresFichier);
  for (const c of noms) {
    for (const d of r.domines[c]) assert.ok(r.couches[c] < r.couches[d], `${c} (couche ${r.couches[c]}) domine ${d} (couche ${r.couches[d]})`);
    for (const d of r.dominants[c]) assert.ok(r.couches[d] < r.couches[c], `${d} domine ${c} mais n'est pas dans une couche supérieure`);
    // listes réciproques
    for (const d of r.domines[c]) assert.ok(r.dominants[d].includes(c));
    // couche 1 : personne ne domine ; couche k > 1 : dominée par au moins une commune de la couche k-1
    if (r.couches[c] === 1) assert.deepEqual(r.dominants[c], []);
    else assert.ok(r.dominants[c].some((d) => r.couches[d] === r.couches[c] - 1), `${c} : aucun dominant en couche ${r.couches[c] - 1}`);
  }
});

test('360 communes : si A domine B, le score OppChoVec de A >= celui de B (fichier de données et appli)', async () => {
  const r = calculerDominance(scoresFichier);
  const app = await chargerApp();
  const indiceApp = app.ev('JSON.parse(JSON.stringify(indiceFinale))');
  const scoresApp = app.ev('JSON.parse(JSON.stringify(scoresParCommune))');
  const rApp = calculerDominance(scoresApp);
  const exceptions = [];
  let paires = 0;
  for (const a of noms) {
    for (const b of r.domines[a]) {
      paires++;
      if (!(data[a].OppChoVec_0_10 >= data[b].OppChoVec_0_10)) exceptions.push(`fichier : ${a} domine ${b} mais ${data[a].OppChoVec_0_10} < ${data[b].OppChoVec_0_10}`);
    }
    for (const b of rApp.domines[a]) {
      if (!(indiceApp[a] >= indiceApp[b])) exceptions.push(`appli : ${a} domine ${b} mais ${indiceApp[a]} < ${indiceApp[b]}`);
    }
  }
  assert.ok(paires > 1000, `nombre de paires de dominance : ${paires}`);
  assert.deepEqual(exceptions, []);
  // l'appli (scores à l'ouverture) et le fichier donnent les mêmes couches
  assert.deepEqual(rApp.couches, r.couches);
});
