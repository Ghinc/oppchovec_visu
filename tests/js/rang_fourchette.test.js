'use strict';
// Fourchette de rang et comparaison d'une commune aux autres (rang_fourchette.js) :
//   - jeu d'exemple vérifiable à la main (égalités, profil identique, valeur manquante) ;
//   - propriété : quelle que soit la pondération (p_k > 0, β, α), le rang calculé avec la formule de l'indice reste dans la fourchette ;
//   - rang actuel de l'appli (Betti et poids égaux, communes et EPCI) dans la fourchette ; effectifs des catégories = n − 1.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chargerApp, lireJson, prng, WEB } = require('./helpers/outils');
const { rangsObserves, tirageUniforme, indiceFormule } = require('./helpers/rang_aleatoire');
const R = require(path.join(WEB, 'rang_fourchette.js'));

const data = lireJson('data_scores_0_10.json');
const communes = Object.keys(data);
const sc = (o, c, v) => ({ Score_Opp: o, Score_Cho: c, Score_Vec: v });
const scores01 = Object.fromEntries(communes.map((c) => [c, sc(data[c].Score_Opp, data[c].Score_Cho, data[c].Score_Vec)]));
const scores10 = Object.fromEntries(communes.map((c) => [c, sc(data[c].Score_Opp_0_10, data[c].Score_Cho_0_10, data[c].Score_Vec_0_10)]));
const json = (app, expr) => JSON.parse(app.ev(`JSON.stringify(${expr})`));

// A=(3,3,3) B=(3,3,3) identiques ; C=(2,2,2) ; D=(3,1,1) ; E=(1,5,1) ; H=(4,0,0) ; G=(1,1,1) ; X manquante
const JEU = { A: sc(3, 3, 3), B: sc(3, 3, 3), C: sc(2, 2, 2), D: sc(3, 1, 1), E: sc(1, 5, 1), H: sc(4, 0, 0), G: sc(1, 1, 1), X: sc(null, 1, 1) };

test('jeu d\'exemple : dominants, dominés, profils identiques, effectifs et fourchettes calculés à la main', () => {
  const r = R.comparerUnites(JEU);
  assert.equal(r.n, 7);
  assert.deepEqual(r.exclues.map((e) => e.commune), ['X']);
  assert.deepEqual([...r.dominants.G].sort(), ['A', 'B', 'C', 'D', 'E']);     // H=(4,0,0) ne domine pas G (0 < 1 sur Cho)
  assert.deepEqual(r.identiques.A, ['B']);
  // A domine C, D, G ; ne se compare pas (ça dépend) à E et H ; identique à B
  assert.deepEqual(R.effectifsUnite(r, 'A'), { mieux: 0, moins: 3, identiques: 1, depend: 2 });
  assert.deepEqual(R.fourchetteRang(r, 'A'), { meilleur: 1, pire: 4, largeur: 3 });
});

test('jeu d\'exemple : catégories d\'une commune face aux autres', () => {
  const r = R.comparerUnites(JEU);
  assert.deepEqual(R.categoriesUnite(r, 'C'), { A: 'mieux', B: 'mieux', D: 'depend', E: 'depend', H: 'depend', G: 'moins' });
  assert.deepEqual(R.categoriesUnite(r, 'A'), { B: 'identique', C: 'moins', D: 'moins', E: 'depend', H: 'depend', G: 'moins' });
});

test('rangs de compétition : ex æquo au même rang, le suivant saute ; valeurs non finies ignorées', () => {
  const rangs = R.rangsIndice({ a: 5, b: 7, c: 5, d: 1, e: NaN }, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(rangs, { b: 1, a: 2, c: 2, d: 4 });
});

test('texte : « 47e avec la pondération retenue ; quelle que soit la pondération, entre la 30e et la 110e place »', () => {
  assert.equal(R.texteFourchette(47, { meilleur: 30, pire: 110 }), '47e avec la pondération retenue ; quelle que soit la pondération, entre la 30e et la 110e place');
  assert.equal(R.texteFourchette(1, { meilleur: 1, pire: 12 }), '1re avec la pondération retenue ; quelle que soit la pondération, entre la 1re et la 12e place');
  assert.match(R.texteFourchette(5, { meilleur: 5, pire: 5 }), /exactement la 5e place$/);
});

for (const [nom, scores] of [['scores bruts 0-1', scores01], ['scores 0-10', scores10]]) {
  test(`360 communes (${nom}) : mieux + moins + ça dépend + identiques = 359 pour chaque commune ; fourchette bornée par 1 et 360`, () => {
    const r = R.comparerUnites(scores);
    assert.equal(r.n, 360);
    assert.equal(r.exclues.length, 0);
    for (const c of communes) {
      const e = R.effectifsUnite(r, c);
      assert.equal(e.mieux + e.moins + e.depend + e.identiques, 359, c);
      assert.equal(Object.keys(R.categoriesUnite(r, c)).length, 359, c);
      const f = R.fourchetteRang(r, c);
      assert.ok(1 <= f.meilleur && f.meilleur <= f.pire && f.pire <= 360, c);
      assert.equal(f.meilleur, 1 + e.mieux);
      assert.equal(f.pire, 360 - e.moins);
    }
  });
}

test('la dominance est la même sur les scores bruts 0-1 et sur les scores 0-10 (transformation min-max croissante)', () => {
  const a = R.comparerUnites(scores01), b = R.comparerUnites(scores10);
  for (const c of communes) assert.deepEqual([...a.dominants[c]].sort(), [...b.dominants[c]].sort(), c);
});

test('profils identiques comptés à part (jeu à 361 unités avec un doublon)', () => {
  const r = R.comparerUnites({ ...scores10, Doublon: { ...scores10.Afa } });
  const e = R.effectifsUnite(r, 'Afa');
  assert.equal(e.identiques, 1);
  assert.equal(e.mieux + e.moins + e.depend + e.identiques, 360);
  assert.ok(!r.dominants.Afa.includes('Doublon') && !r.domines.Afa.includes('Doublon'));
});

for (const [nom, scores] of [['scores bruts 0-1 (formule de l\'appli)', scores01], ['scores 0-10', scores10]]) {
  test(`propriété : 10 000 pondérations au hasard (p sur le simplexe, β ∈ [0,5 ; 3], α ∈ [0,5 ; 4]) — ${nom} : chaque rang reste dans sa fourchette`, () => {
    const r = R.comparerUnites(scores);
    const obs = rangsObserves(scores, 10000, prng(20261101), tirageUniforme);
    const sortis = [];
    for (const c of communes) {
      const f = R.fourchetteRang(r, c);
      if (obs.min[c] < f.meilleur || obs.max[c] > f.pire) sortis.push(`${c} : observé ${obs.min[c]}–${obs.max[c]}, fourchette ${f.meilleur}–${f.pire}`);
    }
    assert.deepEqual(sortis, [], 'communes dont le rang sort de la fourchette');
  });
}

test('la formule du test = calculerIndiceBienEtre de l\'appli (α = 2,5 ; β = 1,5)', async () => {
  const app = await chargerApp();
  const p = [0.2, 0.5, 0.3];
  const appli = json(app, `calculerIndiceBienEtre(scoresParCommuneRaw01, ${JSON.stringify(p)})`);
  for (const c of communes) {
    const d = [scores01[c].Score_Opp, scores01[c].Score_Cho, scores01[c].Score_Vec];
    assert.ok(Math.abs(appli[c] - indiceFormule(d, p, 1.5, 2.5)) < 1e-12 * Math.max(1, appli[c]), c);
  }
});

for (const mode of ['betti', 'egal']) {
  test(`[${mode}] le rang actuel de l'appli est dans la fourchette pour les 360 communes ; la fourchette ne dépend pas du mode`, async () => {
    const app = await chargerApp();
    if (mode === 'egal') app.ev('toggleModePk()');
    const indice = json(app, 'indiceFinale'), scores = json(app, 'scoresParCommune');
    const r = R.comparerUnites(scores), rangs = R.rangsIndice(indice, r.noms);
    assert.equal(Object.keys(rangs).length, 360);
    const ref = R.comparerUnites(scores10);
    for (const c of communes) {
      const f = R.fourchetteRang(r, c);
      assert.ok(f.meilleur <= rangs[c] && rangs[c] <= f.pire, `${c} : rang ${rangs[c]} hors de ${f.meilleur}–${f.pire}`);
      assert.deepEqual(f, R.fourchetteRang(ref, c), `${c} : même fourchette quel que soit le mode`);
    }
  });

  test(`[${mode}] panneau de la commune : ligne « Rang » avec la fourchette et l'infobulle demandée`, async () => {
    const app = await chargerApp();
    if (mode === 'egal') app.ev('toggleModePk()');
    app.ev('afficherCommune("Ajaccio")');
    const html = String(app.elements.get('resultCommune').innerHTML);
    const indice = json(app, 'indiceFinale'), r = R.comparerUnites(scores10), rangs = R.rangsIndice(indice, r.noms);
    const attendu = R.texteFourchette(rangs.Ajaccio, R.fourchetteRang(r, 'Ajaccio'));
    assert.ok(html.includes(attendu), `texte attendu : ${attendu}`);
    assert.ok(html.includes('Ce sont des limites extrêmes : la commune ne peut pas sortir de cette fourchette, quelle que soit la pondération, mais aucune pondération ne la place forcément à ses extrémités.'));
  });
}

test('simulation : la fourchette suivie dans le panneau est celle de la commune modifiée ; les bornes min-max restent figées', async () => {
  const app = await chargerApp();
  const avant = R.comparerUnites(json(app, 'scoresParCommune'));
  const fAvant = R.fourchetteRang(avant, 'Bastia');
  app.ev('afficherCommune("Bastia")');
  // tous les indicateurs de Bastia à leur meilleure valeur corse (Cho1, un nombre de personnes en quartier prioritaire, à la plus basse)
  app.ev('for (const k of Object.keys(indicateursCommune["Bastia"])) indicateursCommune["Bastia"][k] = (k === "Indicateur_Cho1") ? bornesRef.min[k] : bornesRef.max[k];');
  app.ev('recalculerIndice("Bastia")');
  const apres = R.comparerUnites(json(app, 'scoresParCommune'));
  const fApres = R.fourchetteRang(apres, 'Bastia');
  assert.ok(fApres.meilleur <= fAvant.meilleur && fApres.pire <= fAvant.pire, 'améliorer tous les indicateurs ne peut aggraver aucune borne');
  assert.ok(fApres.meilleur < fAvant.meilleur || fApres.pire < fAvant.pire, 'au moins une borne a bougé');
  const html = String(app.elements.get('resultCommune').innerHTML);
  assert.ok(html.includes(R.texteFourchette(R.rangsIndice(json(app, 'indiceFinale'), apres.noms).Bastia, fApres)), 'le panneau affiche la nouvelle fourchette');
});

test('échelle EPCI : 19 EPCI, bornes 1 et 19, rang actuel dans la fourchette, effectifs = 18', async () => {
  const app = await chargerApp();
  for (const mode of ['epci-pop', 'epci-commune']) {
    await app.ev(`changerEchelle('${mode}')`);
    const indice = json(app, 'indiceFinale'), scores = json(app, 'scoresParCommune');
    const r = R.comparerUnites(scores), rangs = R.rangsIndice(indice, r.noms);
    assert.equal(r.n, 19);
    for (const nom of r.noms) {
      const f = R.fourchetteRang(r, nom), e = R.effectifsUnite(r, nom);
      assert.ok(1 <= f.meilleur && f.meilleur <= rangs[nom] && rangs[nom] <= f.pire && f.pire <= 19, `${mode} ${nom}`);
      assert.equal(e.mieux + e.moins + e.depend + e.identiques, 18, nom);
    }
    app.ev(`afficherCommune(${JSON.stringify(r.noms[0])})`);
    assert.ok(String(app.elements.get('resultCommune').innerHTML).includes('quelle que soit la pondération'), `${mode} : ligne de rang dans la fiche EPCI`);
  }
});
