'use strict';
// Panneau « commune » dans le navigateur : curseurs 0-100 %, sous-curseurs, recalcul, réinitialisation.
const assert = require('node:assert/strict');
const { test, avecAppli, sauter, communes, normaliser, proche } = require('./helpers/contexte');

async function ouvrirCommune(page, nom) {
  await page.selectOption('#communeSelect', nom);
  await page.click('#validerCommune');
  await page.waitForSelector('#resultCommune .indicateur-row');
}
const deplacer = (page, id, valeur) => page.$eval(`#${id}`, (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, valeur);
const cliquerBouton = (page, texte) => page.locator('#resultCommune button', { hasText: texte }).click();
const photoPage = (page) => page.evaluate(() => ({
  indice: JSON.parse(JSON.stringify(indiceFinale)),
  couleurs: (() => { const o = {}; geojsonLayers['oppchovec'].eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; })(),
}));

test('panneau commune : 10 indicateurs, curseurs 0-100 %, valeurs brutes, échelle corse, repères d\'origine, sous-curseurs', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    await ouvrirCommune(page, 'Bastia');
    assert.equal(await page.locator('#resultCommune .indicateur-row').count(), 10);
    assert.equal(await page.locator('#resultCommune .indicateur-decompose').count(), 5);
    for (const id of ['Opp1', 'Opp2', 'Cho2', 'Vec1', 'Vec4']) {
      const slider = page.locator(`#Indicateur_${id}`);
      assert.equal(await slider.getAttribute('min'), '0');
      assert.equal(await slider.getAttribute('max'), '100');
      const pct = parseFloat(await slider.inputValue());
      assert.ok(pct >= 0 && pct <= 100, `${id} : ${pct}`);
      assert.match(normaliser(await page.locator(`#Indicateur_${id}_val`).innerText()), /^\d+ % · /);
    }
    assert.match(normaliser(await page.locator('#Indicateur_Vec1_val').innerText()), /^33 % · 27 283 €$/);
    assert.match(normaliser(await page.locator('#resultCommune .indicateur-row', { has: page.locator('#Indicateur_Vec1') }).locator('.slider-echelle').innerText()), /^Corse : 12 746 € → 56 621 €$/);
    assert.ok(await page.locator('#resultCommune .slider-origine').count() >= 10, 'un repère de valeur d\'origine par indicateur');
    // sous-curseurs : Opp3 (1 curseur + 2 cases), Opp4 (3), Cho1 (1), Vec2 (2), Vec3 (3)
    assert.equal(await page.locator('#resultCommune .sous-composantes input[type=range]').count(), 1 + 3 + 1 + 2 + 3);
    assert.equal(await page.locator('#resultCommune .sous-composantes input[type=checkbox]').count(), 2);
    assert.equal(await page.locator('#resultCommune .indicateur-decompose input[id^="Indicateur_"]:not([id*="__"])').count(), 0,
      'pas de curseur direct sur un indicateur décomposé');
  });
});

test('panneau commune : « Recalculer » sans rien toucher ne change aucune valeur ni couleur de carte', { skip: sauter }, async () => {
  await avecAppli(async ({ page, alertes }) => {
    const avant = await photoPage(page);
    // la meilleure commune du mode affiché (Betti par défaut) vaut exactement 10
    const meilleure = await page.evaluate(() => Object.entries(indiceFinale).sort((a, b) => b[1] - a[1])[0][0]);
    await ouvrirCommune(page, meilleure);
    await cliquerBouton(page, 'Recalculer');
    assert.deepEqual(await photoPage(page), avant);
    assert.equal(alertes.at(-1), 'Indice recalculé avec succès');
    // la meilleure commune vaut exactement 10 : le navigateur normalise les <input range> à 15 chiffres, ce qui ne doit pas la faire passer à
    // 10,000000000000002 ni afficher « au-delà de la meilleure commune corse » (défaut corrigé, voir sliders.test.js)
    assert.equal(await page.evaluate((c) => indiceFinale[c], meilleure), 10);
    assert.doesNotMatch(await page.locator('#resultCommune').innerText(), /au-delà/);
  });
});

test('panneau commune : déplacer un curseur puis recalculer ne change que cette commune ; Réinitialiser restaure tout', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    const depart = await photoPage(page);
    await ouvrirCommune(page, 'Bastia');
    await deplacer(page, 'Indicateur_Vec4', 100);
    assert.match(normaliser(await page.locator('#Indicateur_Vec4_val').innerText()), /^100 % · 5 278 services$/);
    await cliquerBouton(page, 'Recalculer');
    const apres = await photoPage(page);
    assert.ok(apres.indice.Bastia > depart.indice.Bastia);
    for (const c of communes.filter((x) => x !== 'Bastia')) {
      assert.equal(apres.indice[c], depart.indice[c], c);
      assert.equal(apres.couleurs[c], depart.couleurs[c], `couleur de ${c}`);
    }
    // le panneau ré-affiché reflète la modification
    assert.match(normaliser(await page.locator('#resultCommune').innerText()), new RegExp(`OppChoVec : ${apres.indice.Bastia.toFixed(2)}/10`));
    assert.equal(await page.locator('#Indicateur_Vec4').inputValue(), '100');
    await cliquerBouton(page, 'Réinitialiser');
    assert.deepEqual(await photoPage(page), depart);
  });
});

test('panneau commune : une sous-composante (fibre) met à jour l\'indicateur à l\'écran, puis « Recalculer » l\'applique', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    const depart = await photoPage(page);
    await ouvrirCommune(page, 'Bastia');
    await deplacer(page, 'Indicateur_Opp4__fibre', 0);
    assert.match(normaliser(await page.locator('#Indicateur_Opp4__fibre_val').innerText()), /^0 % · 0 %$/);
    const o4 = await page.evaluate(() => JSON.parse(JSON.stringify(sousComposantesOrigine.Bastia.Indicateur_Opp4)));
    assert.match(normaliser(await page.locator('#Indicateur_Opp4_val').innerText()), new RegExp('^\\d+ % · ' + ((o4.g4 + o4.debit) / 3).toFixed(1).replace('.', ',') + ' %'));
    assert.deepEqual(await photoPage(page), depart, 'aucun effet avant « Recalculer »');
    await cliquerBouton(page, 'Recalculer');
    const apres = await photoPage(page);
    assert.ok(apres.indice.Bastia < depart.indice.Bastia);
    assert.ok(proche(await page.evaluate(() => indicateursCommune.Bastia.Indicateur_Opp4), (o4.g4 + o4.debit + 0) / 3));
    for (const c of communes.filter((x) => x !== 'Bastia')) assert.equal(apres.indice[c], depart.indice[c]);
    await cliquerBouton(page, 'Réinitialiser');
    assert.deepEqual(await photoPage(page), depart);
  });
});

test('panneau commune : décocher le réseau de bus et pousser « emploi stable » à 100 % ; les parts d\'emploi restent liées', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    await ouvrirCommune(page, 'Bastia');
    await page.uncheck('#Indicateur_Opp3__bus');
    assert.match(normaliser(await page.locator('#Indicateur_Opp3_val').innerText()), /180,3 pts/);
    await deplacer(page, 'Indicateur_Vec3__stable', 100);
    const parts = await page.evaluate(() => JSON.parse(JSON.stringify(brouillonSousComp.valeurs.Indicateur_Vec3)));
    assert.ok(proche(Object.values(parts).reduce((a, b) => a + b, 0), 100, 1e-6));
    assert.ok(proche(parts.stable, 100, 1e-9));
    assert.match(normaliser(await page.locator('#Indicateur_Vec3_val').innerText()), /^100 % · 1,000/);
    // les autres curseurs de parts ont suivi à l'écran
    for (const k of ['autres', 'chomeur']) assert.equal(parseFloat(await page.locator(`#Indicateur_Vec3__${k}`).inputValue()) < 1e-6, true, k);
  });
});

test('panneau commune : changer de commune abandonne un brouillon non validé', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    const depart = await photoPage(page);
    await ouvrirCommune(page, 'Bastia');
    const fibreInitiale = await page.locator('#Indicateur_Opp4__fibre').inputValue().then(parseFloat);
    await deplacer(page, 'Indicateur_Opp4__fibre', 0);
    await ouvrirCommune(page, 'Ajaccio');
    await ouvrirCommune(page, 'Bastia');
    assert.ok(proche(await page.locator('#Indicateur_Opp4__fibre').inputValue().then(parseFloat), fibreInitiale, 1e-9), 'la fibre de Bastia est revenue à sa valeur d\'origine');
    await cliquerBouton(page, 'Recalculer');
    assert.deepEqual(await photoPage(page), depart);
  });
});
