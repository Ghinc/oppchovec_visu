'use strict';
// Chargement de l'appli (script.js réel, DOM factice) : données, modes p_k, seuils, clusters LISA.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chargerApp, lireJson, lireConstJs, INDICATEURS } = require('./helpers/outils');

const data = lireJson('data_scores_0_10.json');
const communes = Object.keys(data);
const proche = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
// objets venus du bac à sable (autre Object.prototype) : on compare leur contenu
const plat = (x) => JSON.parse(JSON.stringify(x));

test('le chargement automatique se déroule sans alerte ni erreur console', async () => {
  const app = await chargerApp();
  assert.deepEqual(app.appelsAlert, []);
  assert.deepEqual(app.erreursConsole, []);
});

test('360 communes chargées, mode Betti par défaut, références figées présentes', async () => {
  const app = await chargerApp();
  assert.equal(app.ev('Object.keys(indiceFinale).length'), 360);
  assert.equal(app.ev('modeCalculPk'), 'betti');
  assert.equal(app.ev('Object.keys(sousComposantesOrigine).length'), 360);
  assert.ok(app.ev('bornesRef !== null && bornesScoresRef !== null'));
});

test('les bornes figées sont le min et le max réels de chaque indicateur', async () => {
  const app = await chargerApp();
  for (const k of INDICATEURS) {
    const vals = communes.map((c) => data[c][k]);
    assert.equal(app.ev(`bornesRef.min['Indicateur_${k}']`), Math.min(...vals), `min ${k}`);
    assert.equal(app.ev(`bornesRef.max['Indicateur_${k}']`), Math.max(...vals), `max ${k}`);
  }
});

test('les indicateurs chargés sont ceux du JSON, valeur pour valeur', async () => {
  const app = await chargerApp();
  for (const c of communes) {
    for (const k of INDICATEURS) {
      assert.equal(app.ev(`indicateursCommune[${JSON.stringify(c)}]['Indicateur_${k}']`), data[c][k], `${c}.${k}`);
    }
  }
});

test('mode égal : indice 0-10 identique à OppChoVec_0_10 du JSON ; scores de dimension identiques aux Score_*_0_10', async () => {
  const app = await chargerApp();
  app.ev('toggleModePk()');
  assert.equal(app.ev('modeCalculPk'), 'egal');
  let pire = 0;
  for (const c of communes) {
    pire = Math.max(pire, Math.abs(app.ev(`indiceFinale[${JSON.stringify(c)}]`) - data[c].OppChoVec_0_10));
    for (const d of ['Opp', 'Cho', 'Vec']) {
      pire = Math.max(pire, Math.abs(app.ev(`scoresParCommune[${JSON.stringify(c)}].Score_${d}`) - data[c][`Score_${d}_0_10`]));
    }
  }
  assert.ok(pire < 1e-9, `écart max ${pire}`);
});

test('mode Betti : indice 0-10 identique à celui stocké dans les fichiers LISA Betti', async () => {
  const app = await chargerApp();
  const lisa = lireConstJs('lisa_data_betti.js', 'LISA_DATA_BETTI').clusters;
  for (const c of communes) {
    assert.ok(proche(app.ev(`indiceFinale[${JSON.stringify(c)}]`), lisa[c].oppchovec), c);
  }
  const pk = app.ev('referencePk("betti").pk');
  const poids = lireConstJs('lisa_data_betti.js', 'LISA_DATA_BETTI').metadata.poids;
  assert.ok(proche(pk[0], poids.Opp, 6e-5) && proche(pk[1], poids.Cho, 6e-5) && proche(pk[2], poids.Vec, 6e-5), `p_k ${pk}`);
  assert.ok(proche(pk.reduce((a, b) => a + b, 0), 1, 1e-12));
});

test('basculer égal puis Betti redonne exactement les mêmes valeurs', async () => {
  const app = await chargerApp();
  const avant = JSON.stringify(app.ev('indiceFinale'));
  app.ev('toggleModePk()');
  assert.notEqual(JSON.stringify(app.ev('indiceFinale')), avant);
  app.ev('toggleModePk()');
  assert.equal(JSON.stringify(app.ev('indiceFinale')), avant);
});

test('les seuils de Jenks calculés par le JS (mode égal) égalent ceux de jenkspy stockés dans le fichier GVF', async () => {
  const app = await chargerApp();
  app.ev('toggleModePk()');
  const attendu = [0, ...lireJson('seuils_jenks_optimal_gvf.json').OppChoVec_0_10.breaks, 10];
  const jenks = app.ev('seuilsJenks.oppchovec');
  assert.equal(jenks.length, 6);
  jenks.forEach((v, i) => assert.ok(proche(v, attendu[i]), `seuil ${i}: ${v} vs ${attendu[i]}`));
});

test('les seuils du mode Betti ont 6 bornes croissantes entre 0 et 10 et sont des valeurs observées', async () => {
  const app = await chargerApp();
  const jenks = app.ev('seuilsJenks.oppchovec');
  assert.equal(jenks.length, 6);
  assert.equal(jenks[0], 0);
  assert.equal(jenks[5], 10);
  const indices = Object.values(app.ev('indiceFinale'));
  for (let i = 1; i <= 4; i++) {
    assert.ok(jenks[i] > jenks[i - 1]);
    assert.ok(indices.some((v) => proche(v, jenks[i], 1e-12)), `le seuil ${jenks[i]} n'est la valeur d'aucune commune`);
  }
});

test('les clusters LISA suivent le mode p_k', async () => {
  const app = await chargerApp();
  const cl = (nom, cst) => Object.fromEntries(Object.entries(lireConstJs(nom, cst).clusters).map(([c, v]) => [c, v.cluster]));
  assert.deepEqual(plat(app.ev('clustersLISA5pct')), cl('lisa_data_betti.js', 'LISA_DATA_BETTI'));
  assert.deepEqual(plat(app.ev('clustersLISA1pct')), cl('lisa_data_betti_1pct.js', 'LISA_DATA_BETTI_1PCT'));
  app.ev('toggleModePk()');
  assert.deepEqual(plat(app.ev('clustersLISA5pct')), cl('lisa_data.js', 'LISA_DATA'));
  assert.deepEqual(plat(app.ev('clustersLISA1pct')), cl('lisa_data_1pct.js', 'LISA_DATA_1PCT'));
});

test('calculerPkBetti est invariant d\'échelle (scores 0-1 ou 0-10)', async () => {
  const app = await chargerApp();
  const s01 = app.ev('scoresParCommuneRaw01');
  const x10 = Object.fromEntries(Object.entries(s01).map(([c, s]) => [c, Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v * 10]))]));
  app.ev('globalThis.__x10 = ' + JSON.stringify(x10));
  const a = app.ev('calculerPkBetti(scoresParCommuneRaw01)');
  const b = app.ev('calculerPkBetti(__x10)');
  a.forEach((v, i) => assert.ok(proche(v, b[i], 1e-12)));
});

test('calculerJenksBreaks : propriétés (4 seuils croissants, valeurs observées, cas dégénérés)', async () => {
  const app = await chargerApp();
  const breaks = app.ev('calculerJenksBreaks([1,2,3,10,11,12,50,51,52,100,101,102,200,201,202], 5)');
  assert.deepEqual([...breaks], [3, 12, 52, 102]);                 // les 5 paquets évidents, borne haute incluse
  assert.deepEqual([...app.ev('calculerJenksBreaks([1,2,3], 5)')], [2, 3]);   // moins de valeurs que de classes : pas de crash
});
