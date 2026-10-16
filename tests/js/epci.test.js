'use strict';
// Onglet EPCI : agrégation de l'indice par intercommunalité (pro rata du nombre d'habitants / moyenne simple).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chargerApp, lireJson, WEB } = require('./helpers/outils');
const { epciAgreger, epciClasse, EPCI_INDICATEURS } = require(path.join(WEB, 'epci.js'));

const data = lireJson('data_scores_0_10.json');
const agreg = lireJson('epci_agregation.json');
const communes = Object.keys(data);
const proche = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const pop = (n) => Object.fromEntries(EPCI_INDICATEURS.map((k) => [k, n]));
const ind = (v) => Object.fromEntries(EPCI_INDICATEURS.map((k) => ['Indicateur_' + k, v]));

test('agrégation : pro rata = moyenne pondérée par la population du millésime de l\'indicateur ; simple = moyenne arithmétique', () => {
  const epcis = [{ siren: 'X', communes: { A: { pop: { ...pop(100), Opp1: 300 } }, B: { pop: pop(100) } } }];
  const indicateurs = { A: ind(10), B: ind(20) };
  const p = epciAgreger(indicateurs, epcis, true).X, s = epciAgreger(indicateurs, epcis, false).X;
  assert.ok(proche(s.Indicateur_Opp1, 15) && proche(s.Indicateur_Vec4, 15), 'simple : (10 + 20) / 2');
  assert.ok(proche(p.Indicateur_Opp1, (300 * 10 + 100 * 20) / 400), 'pro rata Opp1 : population 300 contre 100');
  assert.ok(proche(p.Indicateur_Vec4, 15), 'pro rata à populations égales = moyenne simple');
});

test('agrégation : valeur manquante ignorée ; EPCI d\'une seule commune = valeurs de cette commune ; aucune donnée = NaN', () => {
  const epcis = [{ siren: 'X', communes: { A: { pop: pop(10) }, B: { pop: pop(30) } } }, { siren: 'Y', communes: { A: { pop: pop(10) } } }, { siren: 'Z', communes: { Q: { pop: pop(5) } } }];
  const indicateurs = { A: ind(8), B: { ...ind(2), Indicateur_Cho1: NaN } };
  for (const prorata of [true, false]) {
    const r = epciAgreger(indicateurs, epcis, prorata);
    assert.equal(r.X.Indicateur_Cho1, 8, 'B n\'a pas de Cho1 : seule A compte');
    assert.ok(proche(r.Y.Indicateur_Opp2, 8));
    assert.ok(Number.isNaN(r.Z.Indicateur_Opp1));
  }
});

test('classe : valeur égale au seuil = classe inférieure (comme les cartes de l\'appli)', () => {
  const s = [0, 2, 4, 6, 8, 10];
  assert.equal(epciClasse(2, s), 0);
  assert.equal(epciClasse(2.0001, s), 1);
  assert.equal(epciClasse(10, s), 4);
  assert.equal(epciClasse(99, s), 4);
});

test('fichier epci_agregation.json : 19 EPCI, 360 communes toutes dans l\'appli, une seule fois, populations > 0', () => {
  assert.equal(agreg.epci.length, 19);
  const noms = agreg.epci.flatMap((e) => Object.keys(e.communes));
  assert.equal(noms.length, 360);
  assert.deepEqual([...noms].sort(), [...communes].sort());
  for (const e of agreg.epci) {
    assert.equal(Object.keys(e.communes).length, e.nb_communes);
    assert.equal(Object.values(e.communes).reduce((s, c) => s + c.pop.Vec4, 0), e.population_2023, e.nom);
    for (const c of Object.values(e.communes)) for (const k of EPCI_INDICATEURS) assert.ok(c.pop[k] > 0, `${e.nom} ${k}`);
  }
  for (const k of EPCI_INDICATEURS) assert.ok(agreg.millesimes[k] >= 2020 && agreg.millesimes[k] <= 2023, k);
});

test('chaîne de calcul : un EPCI d\'une seule commune a exactement les scores de cette commune (mêmes bornes, mêmes p_k, même échelle 0-10)', async () => {
  const app = await chargerApp();
  for (const mode of ['betti', 'egal']) {
    for (const commune of ['Afa', 'Ajaccio', 'Bastia', 'Érone']) {
      if (!communes.includes(commune)) continue;
      app.ev(`modeCalculPk = '${mode}'; recalculerCarteOppChoVec(); epciDonnees = { epci: [{ siren: 'X', communes: { ${JSON.stringify(commune)}: { pop: ${JSON.stringify(pop(1))} } } }] };`);
      const e = JSON.parse(app.ev('JSON.stringify(epciCalculer(true).X)'));
      const indice = app.ev(`indiceFinale[${JSON.stringify(commune)}]`);
      const dims = JSON.parse(app.ev(`JSON.stringify(scoresParCommune[${JSON.stringify(commune)}])`));
      assert.ok(proche(e.oppchovec, indice, 1e-9), `${mode} ${commune} indice ${e.oppchovec} vs ${indice}`);
      assert.ok(proche(e.opp, dims.Score_Opp, 1e-9) && proche(e.cho, dims.Score_Cho, 1e-9) && proche(e.vec, dims.Score_Vec, 1e-9), `${mode} ${commune} dimensions`);
    }
  }
});

test('EPCI réels : scores finis dans l\'échelle des communes, deux méthodes différentes, pro rata plus proche de la grande ville', async () => {
  const app = await chargerApp();
  app.ev(`epciDonnees = ${JSON.stringify(agreg)};`);
  const p = JSON.parse(app.ev('JSON.stringify(epciCalculer(true))')), s = JSON.parse(app.ev('JSON.stringify(epciCalculer(false))'));
  for (const r of [p, s]) {
    assert.equal(Object.keys(r).length, 19);
    for (const v of Object.values(r)) for (const k of ['oppchovec', 'opp', 'cho', 'vec']) assert.ok(Number.isFinite(v[k]) && v[k] > -1 && v[k] < 11, `${k} = ${v[k]}`);
  }
  const ajaccio = agreg.epci.find((e) => e.nom.includes('Pays Ajaccien')).siren;
  assert.ok(Math.abs(p[ajaccio].oppchovec - s[ajaccio].oppchovec) > 0.1, 'les deux méthodes diffèrent pour l\'agglomération d\'Ajaccio');
  // moyenne simple recalculée à la main pour un EPCI
  const e = agreg.epci.find((x) => x.nom.includes('Cap Corse'));
  const moyenne = Object.keys(e.communes).reduce((t, c) => t + data[c].Opp2, 0) / e.nb_communes;
  assert.ok(proche(s[e.siren].agregats.Indicateur_Opp2, moyenne), 'Opp2 simple = moyenne arithmétique des 18 communes');
  const w = Object.entries(e.communes).reduce((t, [c, v]) => t + v.pop.Opp2 * data[c].Opp2, 0) / Object.values(e.communes).reduce((t, v) => t + v.pop.Opp2, 0);
  assert.ok(proche(p[e.siren].agregats.Indicateur_Opp2, w), 'Opp2 pro rata = moyenne pondérée par la population 2021');
});
