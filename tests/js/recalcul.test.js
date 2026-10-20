'use strict';
// Scénarios du panneau commune : recalcul, réinitialisation, bascule p_k. Le DOM des curseurs est reconstruit
// à partir du HTML réellement produit par afficherCommune.
const test = require('node:test');
const assert = require('node:assert/strict');
const { chargerApp, afficherCommune, photo, lireJson } = require('./helpers/outils');

const data = lireJson('data_scores_0_10.json');
const MODES = ['betti', 'egal'];

// Déplace le sous-curseur `ind__comp` (tous les indicateurs sont décomposés) et déclenche la mise à jour du brouillon, comme le ferait la page
function fixer(app, inputs, id, pct) {
  const [ind, comp] = id.split('__');
  inputs[id].value = String(pct);
  app.ev(`majSousComposante(${JSON.stringify(ind)}, ${JSON.stringify(comp)})`);
}

async function appEnMode(mode) {
  const app = await chargerApp();
  if (mode === 'egal') app.ev('toggleModePk()');
  return app;
}
const autresCommunes = (avant, apres, sauf) => Object.keys(avant.indice).filter((c) => !sauf.includes(c)
  && (avant.indice[c] !== apres.indice[c] || JSON.stringify(avant.ind[c]) !== JSON.stringify(apres.ind[c])
      || JSON.stringify(avant.sc[c]) !== JSON.stringify(apres.sc[c])));

for (const mode of MODES) {
  test(`[${mode}] « Recalculer » sans rien toucher ne change aucun résultat (360 communes, indices, scores, indicateurs)`, async () => {
    const app = await appEnMode(mode);
    afficherCommune(app, 'Afa');
    const avant = photo(app);
    app.ev("recalculerIndice('Afa')");
    assert.deepEqual(photo(app), avant);
    assert.equal(app.appelsAlert.at(-1), 'Indice recalculé avec succès');
  });

  test(`[${mode}] un curseur déplacé ne change que la commune concernée`, async () => {
    const app = await appEnMode(mode);
    const { inputs } = afficherCommune(app, 'Bastia');
    const avant = photo(app);
    fixer(app, inputs, 'Indicateur_Vec4__services', 100);        // services accessibles : maximum corse
    assert.match(String(app.elements.get('Indicateur_Vec4_val').innerText).replace(/[  ]/g, ' '), /^100 % · 5 278 services$/);
    app.ev("recalculerIndice('Bastia')");
    const apres = photo(app);
    assert.equal(apres.ind.Bastia.Indicateur_Vec4, app.ev("bornesRef.max['Indicateur_Vec4']"));
    assert.ok(apres.indice.Bastia > avant.indice.Bastia, 'améliorer un indicateur doit améliorer l\'indice');
    assert.ok(apres.sc.Bastia.Score_Vec > avant.sc.Bastia.Score_Vec);
    assert.equal(apres.sc.Bastia.Score_Opp, avant.sc.Bastia.Score_Opp, 'les autres dimensions de la commune ne bougent pas');
    assert.deepEqual(autresCommunes(avant, apres, ['Bastia']), [], 'les 359 autres communes doivent rester identiques');
  });

  test(`[${mode}] dégrader un indicateur dégrade l'indice, et les valeurs d'origine ne sont jamais modifiées`, async () => {
    const app = await appEnMode(mode);
    const { inputs } = afficherCommune(app, 'Ajaccio');
    const avant = photo(app);
    const origine = JSON.stringify(app.ev('indicateursOrigine'));
    fixer(app, inputs, 'Indicateur_Cho2__francais', 0);     // droit de vote minimal
    fixer(app, inputs, 'Indicateur_Vec1__revenu', 0);     // revenu minimal
    app.ev("recalculerIndice('Ajaccio')");
    const apres = photo(app);
    assert.ok(apres.indice.Ajaccio < avant.indice.Ajaccio);
    assert.equal(JSON.stringify(app.ev('indicateursOrigine')), origine, 'indicateursOrigine est une référence : jamais modifiée');
    assert.deepEqual(autresCommunes(avant, apres, ['Ajaccio']), []);
  });

  test(`[${mode}] « Réinitialiser » restaure exactement l'état d'origine`, async () => {
    const app = await appEnMode(mode);
    const depart = photo(app);
    const { inputs } = afficherCommune(app, 'Bastia');
    fixer(app, inputs, 'Indicateur_Vec4__services', 100);
    fixer(app, inputs, 'Indicateur_Cho2__francais', 0);
    app.ev("recalculerIndice('Bastia')");
    assert.notDeepEqual(photo(app).indice.Bastia, depart.indice.Bastia);
    app.ev("reinitialiserValeurs('Bastia')");
    assert.deepEqual(photo(app), depart);
    assert.equal(app.ev('modeCalculPk'), mode, 'la réinitialisation conserve le mode p_k courant');
  });

  test(`[${mode}] répéter le même recalcul est idempotent`, async () => {
    const app = await appEnMode(mode);
    const { inputs } = afficherCommune(app, 'Corte');
    fixer(app, inputs, 'Indicateur_Opp1__n7', 100);
    app.ev("recalculerIndice('Corte')");
    const une = photo(app);
    afficherCommune(app, 'Corte');                         // le panneau est ré-affiché avec les nouvelles valeurs
    app.ev("recalculerIndice('Corte')");
    assert.deepEqual(photo(app), une);
  });
}

test('modifier deux communes successivement : seules ces deux communes changent ; réinitialiser les restaure toutes', async () => {
  const app = await chargerApp();
  const depart = photo(app);
  for (const [commune, indicateur] of [['Bastia', 'Indicateur_Vec4__services'], ['Ajaccio', 'Indicateur_Opp1__n7']]) {
    const { inputs } = afficherCommune(app, commune);
    fixer(app, inputs, indicateur, 100);
    app.ev(`recalculerIndice(${JSON.stringify(commune)})`);
  }
  const apres = photo(app);
  assert.deepEqual(autresCommunes(depart, apres, ['Bastia', 'Ajaccio']), []);
  assert.notEqual(apres.indice.Bastia, depart.indice.Bastia);
  assert.notEqual(apres.indice.Ajaccio, depart.indice.Ajaccio);
  app.ev("reinitialiserValeurs('Bastia')");
  assert.deepEqual(photo(app), depart);
});

test('basculer le mode p_k après une modification conserve la modification dans les deux modes', async () => {
  const app = await chargerApp();                                        // départ : Betti
  const baseBetti = photo(app);
  const { inputs } = afficherCommune(app, 'Bastia');
  fixer(app, inputs, 'Indicateur_Vec4__services', 100);
  app.ev("recalculerIndice('Bastia')");
  const modBetti = photo(app);
  app.ev('toggleModePk()');                                              // -> égal
  const modEgal = photo(app);
  assert.equal(modEgal.ind.Bastia.Indicateur_Vec4, modBetti.ind.Bastia.Indicateur_Vec4, 'la modification doit survivre à la bascule');
  app.ev('toggleModePk()');                                              // -> Betti
  assert.deepEqual(photo(app), modBetti, 'retour au mode Betti : exactement le même état modifié');
  app.ev("reinitialiserValeurs('Bastia')");
  assert.deepEqual(photo(app), baseBetti);
});

test('les seuils de Jenks et les p_k ne dépendent pas des modifications (références figées sur les données d\'origine)', async () => {
  const app = await chargerApp();
  const seuils = JSON.stringify(app.ev('seuilsJenks.oppchovec'));
  const pk = JSON.stringify(app.ev('referencePk("betti").pk'));
  const { inputs } = afficherCommune(app, 'Bastia');
  fixer(app, inputs, 'Indicateur_Vec4__services', 100);
  app.ev("recalculerIndice('Bastia')");
  assert.equal(JSON.stringify(app.ev('seuilsJenks.oppchovec')), seuils);
  assert.equal(JSON.stringify(app.ev('referencePk("betti").pk')), pk);
});

test('une commune améliorée au-delà de la meilleure commune réelle dépasse 10 et le panneau le signale', async () => {
  const app = await chargerApp();
  app.ev('toggleModePk()');
  const meilleure = Object.entries(data).sort((a, b) => b[1].OppChoVec_0_10 - a[1].OppChoVec_0_10)[0][0];
  assert.equal(data[meilleure].OppChoVec_0_10, 10);
  const { inputs } = afficherCommune(app, meilleure);
  assert.equal(app.ev(`indiceFinale[${JSON.stringify(meilleure)}]`), 10);
  // on porte chaque indicateur de la commune à 100 % de l'échelle corse : l'indice ne peut qu'augmenter ou rester égal
  for (const id of ['Indicateur_Vec4__services', 'Indicateur_Cho2__francais', 'Indicateur_Vec1__revenu', 'Indicateur_Opp4__g4', 'Indicateur_Opp4__debit', 'Indicateur_Opp4__fibre']) fixer(app, inputs, id, 100);
  app.ev(`recalculerIndice(${JSON.stringify(meilleure)})`);
  const apres = app.ev(`indiceFinale[${JSON.stringify(meilleure)}]`);
  assert.ok(apres >= 10 - 1e-12);
  afficherCommune(app, meilleure);
  const html = String(app.elements.get('resultCommune').innerHTML);
  if (apres > 10 + 1e-9) assert.match(html, /au-delà de la meilleure commune corse/);
});
