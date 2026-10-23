'use strict';
// Onglet EPCI : agrégation de l'indice par intercommunalité (pro rata du nombre d'habitants / moyenne simple).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chargerApp, lireJson, WEB } = require('./helpers/outils');
const { epciAgreger, epciClasse, EPCI_INDICATEURS, epciComparaisonHtml, epciEcartTexte } = require(path.join(WEB, 'epci.js'));

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

test('poids d\'une commune dans l\'agrégation : somme = 1 ; pro rata = part de la population du millésime ; simple = 1 / nombre de communes', () => {
  const { epciPoids } = require(path.join(WEB, 'epci.js'));
  for (const e of agreg.epci) {
    for (const k of EPCI_INDICATEURS) {
      const p = epciPoids(e, k, true), s = epciPoids(e, k, false);
      assert.ok(proche(Object.values(p).reduce((t, x) => t + x, 0), 1) && proche(Object.values(s).reduce((t, x) => t + x, 0), 1), `${e.nom} ${k}`);
      const total = Object.values(e.communes).reduce((t, c) => t + c.pop[k], 0);
      for (const [nom, c] of Object.entries(e.communes)) {
        assert.ok(proche(p[nom], c.pop[k] / total), `${e.nom} ${nom} ${k}`);
        assert.ok(proche(s[nom], 1 / e.nb_communes));
      }
    }
  }
  // la valeur agrégée est bien la somme poids x valeur : cohérence avec epciAgreger
  const e = agreg.epci.find((x) => x.nom.includes('Pays Ajaccien'));
  const indic = Object.fromEntries(Object.keys(e.communes).map((c) => [c, Object.fromEntries(EPCI_INDICATEURS.map((k) => ['Indicateur_' + k, data[c][k]]))]));
  for (const prorata of [true, false]) {
    const agg = epciAgreger(indic, [e], prorata)[e.siren];
    for (const k of EPCI_INDICATEURS) {
      const w = epciPoids(e, k, prorata);
      assert.ok(proche(agg['Indicateur_' + k], Object.keys(e.communes).reduce((t, c) => t + w[c] * data[c][k], 0), 1e-9), k);
    }
  }
  // Ajaccio pèse plus de 80 % de son agglomération en pro rata
  assert.ok(epciPoids(e, 'Cho2', true).Ajaccio > 0.8 && proche(epciPoids(e, 'Cho2', false).Ajaccio, 0.1));
});

// ---------- Comparaison de deux EPCI (mode EPCI du panneau) ----------

test('comparaison de deux EPCI : écart « premier moins second », jamais de « -0,00 », signe + explicite', () => {
  assert.equal(epciEcartTexte(3, 1, 0), '+2');
  assert.equal(epciEcartTexte(1, 3, 0), '-2');
  assert.equal(epciEcartTexte(1.001, 1, 2), '0,00');
  assert.equal(epciEcartTexte(5.5, 2.25, 2), '+3,25');
});

test('comparaison de deux EPCI : tableau avec les 4 scores, les 10 indicateurs, la population et l\'écart de chacun', () => {
  const [a, b] = agreg.epci;
  const res = (decal) => ({
    oppchovec: 5 + decal, opp: 6 + decal, cho: 4 + decal, vec: 3 + decal,
    agregats: Object.fromEntries(EPCI_INDICATEURS.map((k, i) => ['Indicateur_' + k, 10 * (i + 1) + decal])),
  });
  const html = epciComparaisonHtml(a, b, res(0), res(2), 'moyenne simple (1 commune = 1)');
  assert.ok(html.includes(a.nom) && html.includes(b.nom), 'les deux noms');
  for (const k of EPCI_INDICATEURS) assert.ok(html.includes(`<td>${k}`) || html.includes(`>${k} `) || html.includes(`>${k}<`), `ligne ${k}`);
  assert.ok(html.includes('Habitants') && html.includes('Communes'));
  assert.ok(html.includes('class="epci-ecart">-2,00<'), 'écart du score : 5 - 7 = -2');
  assert.ok(html.includes('moyenne simple'), 'la méthode d\'agrégation est indiquée');
  assert.ok(!html.includes('Simulation'), 'pas de mention de simulation par défaut');
  assert.ok(epciComparaisonHtml(a, b, res(0), res(2), 'x', [a.nom]).includes('Simulation'), 'mention quand un EPCI a été modifié à la main');
});
