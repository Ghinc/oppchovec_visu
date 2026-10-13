'use strict';
// Onglets de la version « démo » (OppChoVec, Opp, Cho, Vec, Dominance) : ouverture sans erreur, bulle d'info.
const assert = require('node:assert/strict');
const { test, avecAppli, sauter } = require('./helpers/contexte');

const cliquerOnglet = (page, tab) => page.click(`.tab-button[data-tab="${tab}"]`);
test('tous les onglets s\'ouvrent, affichent leur contenu, sans nouvelle erreur', { skip: sauter }, async () => {
  await avecAppli(async (appli) => {
    const { page } = appli;
    const onglets = await page.$$eval('.tab-button[data-tab]', (b) => b.map((x) => x.dataset.tab));
    assert.deepEqual(onglets, ['oppchovectab', 'opptab', 'chotab', 'vectab', 'dominancetab']);
    for (const tab of onglets) {
      await cliquerOnglet(page, tab);
      await page.waitForSelector(`#${tab}.active`, { state: 'visible', timeout: 15000 });
      assert.equal(await page.locator(`.tab-content.active`).count(), 1, `un seul onglet actif (${tab})`);
    }
    assert.deepEqual(appli.nouvellesErreurs(), []);
    assert.deepEqual(appli.requetesEchouees, []);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Anciennes dettes corrigées, gardées comme tests de non-régression.
test("la croix de la bulle d'info d'un indicateur est visible et la referme", { skip: sauter }, async () => {
  // le CSS « .indicateur-row button { display: none } » masquait aussi ce bouton : seule la bulle info (🛈) la refermait
  await avecAppli(async ({ page }) => {
    await page.selectOption('#communeSelect', 'Bastia');
    await page.click('#validerCommune');
    await page.waitForSelector('#resultCommune .indicateur-row');
    await page.click('.info-button[data-indicator="Indicateur_Cho1"]');
    assert.equal(await page.locator('#info-Indicateur_Cho1').isVisible(), true);
    assert.equal(await page.locator('#info-Indicateur_Cho1 .info-close-button').isVisible(), true);
    await page.click('#info-Indicateur_Cho1 .info-close-button');
    assert.equal(await page.locator('#info-Indicateur_Cho1').isVisible(), false);
  });
});

test('démo : plus de choix de routes (nationales seules), pondérations dans une infobulle, description d\'Opp1 expliquée', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    assert.equal(await page.locator('.route-checkbox').count(), 0, 'aucune case de choix des routes');
    assert.equal(await page.locator('#checkbox-english, #btn-toggle-pk').count(), 0);
    // routes : seule la couche « nationales » est sur la carte
    const etat = await page.evaluate(() => Object.fromEntries(['nationales', 'departementales', 'communales', 'toutes'].map((t) => [t, cartes.oppchovec.hasLayer(routesLayers.oppchovec[t])])));
    assert.deepEqual(etat, { nationales: true, departementales: false, communales: false, toutes: false });
    // infobulle : cachée au repos, visible au survol, trois pourcentages qui somment ~100 %
    const bulle = page.locator('.pk-info-bulle');
    assert.equal(await bulle.isVisible(), false);
    await page.hover('.pk-info');
    assert.equal(await bulle.isVisible(), true);
    const txt = (await bulle.innerText()).replace(/\s+/g, ' ');
    const pct = [...txt.matchAll(/(Opportunités|Choix|Vécu) : ([\d,]+) %/g)].map((m) => parseFloat(m[2].replace(',', '.')));
    assert.equal(pct.length, 3, txt);
    assert.ok(Math.abs(pct.reduce((a, b) => a + b, 0) - 100) < 0.2, `somme ${pct}`);
    assert.doesNotMatch(txt, /Betti/i);
    // description d'Opp1 : méthode, sources et limite
    await page.selectOption('#communeSelect', 'Bastia');
    await page.click('#validerCommune');
    await page.waitForSelector('#resultCommune .indicateur-row');
    await page.click('.info-button[data-indicator="Indicateur_Opp1"]');
    const d = await page.locator('#info-Indicateur_Opp1 p[data-indicator-desc]').innerText();
    for (const mot of ['tranche d\'âge', 'INSEE', 'échelle de la Corse']) assert.ok(d.includes(mot), mot);
    assert.deepEqual(nouvellesErreurs(), []);
    await page.hover('.pk-info');
    await page.screenshot({ path: process.env.CAPTURE || undefined });
  });
});
