'use strict';
// Conversions % <-> valeur brute des curseurs : l'échelle 0-100 % ne doit jamais altérer la valeur réelle.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chargerApp, lireJson, INDICATEURS } = require('./helpers/outils');

const data = lireJson('data_scores_0_10.json');
const communes = Object.keys(data);
const normaliser = (s) => String(s).replace(/[  ]/g, ' ').replace('−', '-');

test('0 % = minimum corse et 100 % = maximum corse, pour chaque indicateur', async () => {
  const app = await chargerApp();
  const proche = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  for (const k of INDICATEURS) {
    const nom = `Indicateur_${k}`;
    const vals = communes.map((c) => data[c][k]);
    assert.ok(proche(app.ev(`pctDepuisValeur('${nom}', ${Math.min(...vals)})`), 0), `${k} min`);
    assert.ok(proche(app.ev(`pctDepuisValeur('${nom}', ${Math.max(...vals)})`), 100), `${k} max`);
    assert.ok(proche(app.ev(`valeurDepuisPct('${nom}', 0)`), Math.min(...vals)), `${k} 0 %`);
    assert.ok(proche(app.ev(`valeurDepuisPct('${nom}', 100)`), Math.max(...vals)), `${k} 100 %`);
  }
});

test('aller-retour valeur -> % -> valeur : aucune perte (≤ 1e-12 relatif) sur les 3600 valeurs réelles', async () => {
  const app = await chargerApp();
  let pire = 0;
  for (const c of communes) {
    for (const k of INDICATEURS) {
      const v = data[c][k];
      const p = app.ev(`pctDepuisValeur('Indicateur_${k}', ${v})`);
      assert.ok(p >= -1e-9 && p <= 100 + 1e-9, `${c}.${k} : ${p} % hors de [0, 100]`);
      const retour = app.ev(`valeurDepuisPct('Indicateur_${k}', ${p})`);
      pire = Math.max(pire, Math.abs(retour - v) / (Math.abs(v) || 1));
    }
  }
  assert.ok(pire < 1e-12, `perte relative max ${pire}`);
});

test('le % est croissant avec la valeur (échelle linéaire, sens conservé)', async () => {
  const app = await chargerApp();
  for (const k of INDICATEURS) {
    const tri = communes.map((c) => data[c][k]).sort((a, b) => a - b);
    let precedent = -Infinity;
    for (const v of [tri[0], tri[90], tri[180], tri[270], tri[359]]) {
      const p = app.ev(`pctDepuisValeur('Indicateur_${k}', ${v})`);
      assert.ok(p >= precedent, k);
      precedent = p;
    }
  }
});

test('un % hors de l\'échelle corse est prolongé linéairement (pas écrêté) : la modification de l\'utilisateur est préservée', async () => {
  const app = await chargerApp();
  const max = app.ev("bornesRef.max['Indicateur_Vec4']");
  const min = app.ev("bornesRef.min['Indicateur_Vec4']");
  assert.ok(Math.abs(app.ev("valeurDepuisPct('Indicateur_Vec4', 110)") - (max + 0.1 * (max - min))) < 1e-9);
  assert.ok(app.ev(`pctDepuisValeur('Indicateur_Vec4', ${max * 2})`) > 100);
});

test('pctDepuisValeur renvoie null pour une valeur non numérique', async () => {
  const app = await chargerApp();
  assert.equal(app.ev("pctDepuisValeur('Indicateur_Vec1', undefined)"), null);
  assert.equal(app.ev("pctDepuisValeur('Indicateur_Vec1', '20530')"), null);
});

test('formats d\'affichage : valeur brute avec son unité', async () => {
  const app = await chargerApp();
  const f = (k, v) => normaliser(app.ev(`formaterBrut('Indicateur_${k}', ${v})`));
  assert.equal(f('Vec1', 20530), '20 530 €');
  assert.equal(f('Vec4', 4498), '4 498 services');
  assert.equal(f('Opp1', 5.21), '5,21 / 7');
  assert.equal(f('Opp4', 91), '91,0 %');
  assert.equal(f('Cho1', -8.8242), '-8,82');
  assert.equal(f('Opp3', 281.4), '281,4 pts');
  assert.match(normaliser(app.ev("libelleSlider('Indicateur_Vec1', 20530)")), /^20 530 € · 18 % entre le plus bas et le plus haut de Corse$/);
  assert.match(normaliser(app.ev("libelleEchelle('Indicateur_Vec1')")), /^Corse : 12 746 € → 56 621 €$/);
});

test('META_INDICATEURS couvre exactement les 10 indicateurs', async () => {
  const app = await chargerApp();
  assert.deepEqual([...app.ev('Object.keys(META_INDICATEURS)')].sort(), INDICATEURS.map((k) => `Indicateur_${k}`).sort());
});

test('valeurBruteDepuisSlider : la normalisation à 15 chiffres des <input range> par le navigateur ne compte pas comme un déplacement', async () => {
  const app = await chargerApp();
  // valeurs réellement observées dans Chromium pour Afa / Opp2 : attribut 11.541487545656556, input.value 11.5414875456566.
  // Avec une comparaison stricte, la valeur serait recalculée : 0.2052279202850794 au lieu de 0.205227920285079 (écart de 4e-16).
  app.ev("globalThis.__i = { value: '11.5414875456566', defaultValue: '11.541487545656556', dataset: { brut: '0.205227920285079' } }");
  assert.equal(app.ev("valeurBruteDepuisSlider('Indicateur_Opp2', __i)"), 0.205227920285079);
  app.ev("__i.value = '11.6'");                                    // un vrai déplacement est pris en compte
  assert.notEqual(app.ev("valeurBruteDepuisSlider('Indicateur_Opp2', __i)"), 0.205227920285079);
});

test('valeurBruteDepuisSlider : tant que le curseur n\'a pas bougé, la valeur exacte est conservée (aucun arrondi)', async () => {
  const app = await chargerApp();
  const intact = { value: '36.1234', defaultValue: '36.1234', dataset: { brut: '20530.123456789' } };
  app.ev('globalThis.__i = ' + JSON.stringify(intact));
  assert.equal(app.ev("valeurBruteDepuisSlider('Indicateur_Vec1', __i)"), 20530.123456789);
  app.ev("__i.value = '50'");
  assert.equal(app.ev("valeurBruteDepuisSlider('Indicateur_Vec1', __i)"), app.ev("bornesRef.min['Indicateur_Vec1']") + 0.5 * (app.ev("bornesRef.max['Indicateur_Vec1']") - app.ev("bornesRef.min['Indicateur_Vec1']")));
});
