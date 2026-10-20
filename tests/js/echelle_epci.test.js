'use strict';
// Case « EPCI » de la barre du haut : toute l'appli passe à l'échelle des EPCI (population = pro rata, commune = moyenne simple), puis revient aux communes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chargerApp, lireJson } = require('./helpers/outils');

const data = lireJson('data_scores_0_10.json');
const agreg = lireJson('epci_agregation.json');
const contours = lireJson('epci_corse.geojson');
const communes = Object.keys(data);
const noms = agreg.epci.map((e) => e.nom).sort();
const proche = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const json = (app, expr) => JSON.parse(app.ev(`JSON.stringify(${expr})`));

test('échelle EPCI : les unités de l\'appli deviennent les 19 EPCI, avec les valeurs de l\'agrégation (population = pro rata, commune = simple)', async () => {
  const app = await chargerApp();
  for (const [mode, prorata] of [['epci-pop', true], ['epci-commune', false]]) {
    assert.equal(await app.ev(`changerEchelle('${mode}')`), true);
    assert.equal(app.ev('echelleEstEPCI()'), true);
    assert.deepEqual(Object.keys(json(app, 'indiceFinale')).sort(), noms, mode);
    assert.deepEqual(Object.keys(json(app, 'scoresParCommune')).sort(), noms, mode);
    assert.equal(app.ev('geoUnites().features.length'), 19);
    assert.equal(app.ev('document.getElementById("epci-prorata").checked'), prorata, 'la case de l\'onglet EPCI suit le choix');
    const attendu = json(app, `epciCalculer(${prorata})`);
    for (const e of agreg.epci) {
      const r = attendu[e.siren], u = json(app, `indiceFinale[${JSON.stringify(e.nom)}]`), d = json(app, `scoresParCommune[${JSON.stringify(e.nom)}]`);
      assert.ok(proche(u, r.oppchovec), `${mode} ${e.nom} indice`);
      assert.ok(proche(d.Score_Opp, r.opp) && proche(d.Score_Cho, r.cho) && proche(d.Score_Vec, r.vec), `${mode} ${e.nom} dimensions`);
    }
  }
  // les deux méthodes donnent des cartes différentes
  await app.ev("changerEchelle('epci-pop')");
  const pop = json(app, 'indiceFinale');
  await app.ev("changerEchelle('epci-commune')");
  const com = json(app, 'indiceFinale');
  assert.ok(noms.some((n) => Math.abs(pop[n] - com[n]) > 0.1), 'population et commune diffèrent');
});

test('échelle EPCI : retour aux communes = état d\'origine exact ; aller-retour sans fuite', async () => {
  const app = await chargerApp();
  const avant = json(app, 'indiceFinale'), scoresAvant = json(app, 'scoresParCommune');
  assert.equal(Object.keys(avant).length, 360);
  await app.ev("changerEchelle('epci-pop')");
  assert.equal(Object.keys(json(app, 'indiceFinale')).length, 19);
  await app.ev("changerEchelle('commune')");
  assert.equal(app.ev('echelleEstEPCI()'), false);
  assert.deepEqual(json(app, 'indiceFinale'), avant);
  assert.deepEqual(json(app, 'scoresParCommune'), scoresAvant);
  assert.equal(app.ev('geoUnites() === communeJson'), true);
  assert.deepEqual(app.erreursConsole, []);
  assert.deepEqual(app.appelsAlert, []);
});

test('échelle EPCI : le mode p_k (Betti / égal) est suivi, les bornes restent celles des communes (un EPCI est comparable à une commune)', async () => {
  const app = await chargerApp();
  await app.ev("changerEchelle('epci-pop')");
  const betti = json(app, 'indiceFinale');
  app.ev('toggleModePk()');
  assert.equal(app.ev('modeCalculPk'), 'egal');
  const egal = json(app, 'indiceFinale');
  assert.equal(Object.keys(egal).length, 19, 'toujours des EPCI après changement de p_k');
  assert.ok(noms.some((n) => Math.abs(betti[n] - egal[n]) > 1e-6), 'p_k change les valeurs');
  // même échelle que les communes : un EPCI d'une seule commune garde les scores de cette commune
  app.ev("modeCalculPk = 'betti'");
  await app.ev("changerEchelle('commune')");
  const indiceAjaccio = app.ev('indiceFinale["Ajaccio"]');
  app.ev(`epciDonnees = { ...epciDonnees, epci: [{ siren: 'X', nom: 'Test', communes: { Ajaccio: { pop: ${JSON.stringify(Object.fromEntries(['Opp1', 'Opp2', 'Opp3', 'Opp4', 'Cho1', 'Cho2', 'Vec1', 'Vec2', 'Vec3', 'Vec4'].map((k) => [k, 1])))} } } }] }`);
  assert.ok(proche(app.ev('epciCalculer(true).X.oppchovec'), indiceAjaccio));
});

test('échelle EPCI : panneau de sélection = fiche de l\'EPCI ; histogramme et top 10 en EPCI ; export Jenks sur les EPCI', async () => {
  const app = await chargerApp();
  await app.ev("changerEchelle('epci-pop')");
  const e = agreg.epci.find((x) => x.nom.includes('Pays Ajaccien'));
  app.ev(`afficherCommune(${JSON.stringify(e.nom)})`);
  const html = app.ev('document.getElementById("resultCommune").innerHTML');
  for (const mot of [e.nom, 'Pro rata', 'Simple', 'Opp1', 'Vec4', 'Ajaccio']) assert.ok(html.includes(mot), mot);
  assert.ok(!html.includes('type="range"'),'pas de curseurs à l\'échelle EPCI');
  // retour aux communes
  await app.ev("changerEchelle('commune')");
  assert.equal(app.ev('echelleEstEPCI()'), false);
});

test('contours des EPCI : 19 polygones nommés comme dans epci_agregation.json', () => {
  assert.deepEqual(contours.features.map((f) => f.properties.nom).sort(), noms);
  assert.equal(communes.length, 360);
});

test('échelle EPCI : la série d\'évolution suit (série EPCI, classes de Jenks des variations des 19 EPCI), puis revient à la série communale', async () => {
  const app = await chargerApp();
  app.ev(`evolutionDonneesParVariante.standard = ${JSON.stringify(lireJson('serie_temporelle.json'))};`);
  app.ev('evolutionMajDonnees()');
  assert.equal(app.ev('evolutionDonnees.unite'), undefined, 'communes au départ');
  assert.equal(app.ev('Object.keys(evolutionDonnees.communes).length'), 360);
  await app.ev("changerEchelle('epci-pop')");
  app.ev('evolutionMajDonnees()');
  assert.equal(app.ev('evolutionDonnees.unite'), 'epci');
  assert.equal(app.ev('Object.keys(evolutionDonnees.communes).length'), 19);
  assert.equal(app.ev('evolutionDonnees.prorata'), true);
  for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) {
    const sv = json(app, `evolutionDonnees.seuils_jenks_variation.${v}`);
    assert.equal(sv.length, 4);
    for (let i = 1; i < 4; i++) assert.ok(sv[i] > sv[i - 1], v);
    const variations = json(app, `Object.values(evolutionDonnees.communes).map(c => c['2021'].scores_0_10.${v} - c['2016'].scores_0_10.${v})`);
    assert.ok(sv[0] > Math.min(...variations) - 1e-9 && sv[3] < Math.max(...variations) + 1e-9, `${v} : classes dans l'étendue des variations des EPCI`);
  }
  await app.ev("changerEchelle('epci-commune')");
  app.ev('evolutionMajDonnees()');
  assert.equal(app.ev('evolutionDonnees.prorata'), false);
  await app.ev("changerEchelle('commune')");
  app.ev('evolutionMajDonnees()');
  assert.equal(app.ev('evolutionDonnees.unite'), undefined);
  assert.equal(app.ev('Object.keys(evolutionDonnees.communes).length'), 360);
});
