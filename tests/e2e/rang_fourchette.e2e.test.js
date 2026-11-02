'use strict';
// Fourchette de rang dans le panneau d'une commune : « Nᵉ avec la pondération retenue ; quelle que soit la pondération, entre la Aᵉ et la Bᵉ place » + infobulle.
const assert = require('node:assert/strict');
const path = require('node:path');
const { test, avecAppli, sauter, communes, data, normaliser, WEB } = require('./helpers/contexte');
const R = require(path.join(WEB, 'rang_fourchette.js'));

const scores10 = Object.fromEntries(communes.map((c) => [c, { Score_Opp: data[c].Score_Opp_0_10, Score_Cho: data[c].Score_Cho_0_10, Score_Vec: data[c].Score_Vec_0_10 }]));

test('panneau commune : fourchette de rang cohérente avec le classement, infobulle, sans « dominance » ni « Pareto »', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await page.selectOption('#communeSelect', 'Corte');
    await page.click('#validerCommune');
    await page.waitForSelector('#resultCommune .rang-fourchette');
    const cmp = R.comparerUnites(scores10), f = R.fourchetteRang(cmp, 'Corte');
    const texte = normaliser(await page.locator('#resultCommune .rang-fourchette').innerText());
    assert.match(texte, /quelle que soit la pondération, entre la /);
    assert.ok(texte.includes(R.ordinalFr(f.meilleur)) && texte.includes(R.ordinalFr(f.pire)), texte);
    const rang = await page.evaluate(() => { const v = Object.values(indiceFinale).filter((x) => x > indiceFinale['Corte']).length + 1; return v; });
    assert.ok(rang >= f.meilleur && rang <= f.pire, `rang ${rang} dans [${f.meilleur}, ${f.pire}]`);
    assert.equal(await page.locator('#resultCommune .rang-info').count(), 1);
    const tout = (await page.locator('#resultCommune').innerText()) + await page.$$eval('#resultCommune [title]', (e) => e.map((x) => x.title).join(' '));
    assert.doesNotMatch(tout, /dominan|pareto/i);
    assert.deepEqual(nouvellesErreurs(), []);
  });
});
