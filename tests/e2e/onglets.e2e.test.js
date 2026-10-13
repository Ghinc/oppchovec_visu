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
