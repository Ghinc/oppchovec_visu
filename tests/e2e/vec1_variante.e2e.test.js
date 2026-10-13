'use strict';
// Case « variante de Vec1 » (revenu fiscal moyen) : bascule des cartes, comparaison affichée, retour à l'état d'origine.
const assert = require('node:assert/strict');
const { test, avecAppli, sauter, communes, couleursCarte } = require('./helpers/contexte');

test('variante Vec1 : la case bascule les cartes OppChoVec et Vec (pas Opp ni Cho), affiche la comparaison, et décocher restaure', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs, alertes }) => {
    await page.waitForFunction(() => !document.getElementById('checkbox-vec1-ircom').disabled);
    const etat = () => page.evaluate(() => ({
      occ: (() => { const o = {}; geojsonLayers['oppchovec'].eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; })(),
      vec: (() => { const o = {}; geojsonLayers['vec'].eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; })(),
      opp: (() => { const o = {}; geojsonLayers['opp'].eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; })(),
      cho: (() => { const o = {}; geojsonLayers['cho'].eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; })(),
    }));
    const avant = await etat();
    // la comparaison est visible dès le chargement, avec les corrélations et un nuage de 360 points
    const texte = (await page.locator('#vec1-comparaison').innerText()).replace(/\s+/g, ' ');
    assert.match(texte, /Indice OppChoVec r = 0,\d\d ρ \(rang\) = 0,\d\d/);
    assert.match(texte, /Vec1 seul r = 0,\d\d ρ = 0,\d\d/);
    assert.equal(await page.evaluate(() => vec1Scatter.data.datasets[0].data.length), 360);
    assert.equal(await page.locator('#vec1-avertissement').isVisible(), false);

    await page.check('#checkbox-vec1-ircom');
    await page.waitForFunction(() => vec1SourceActive === 'ircom');
    const apres = await etat();
    assert.notDeepEqual(apres.occ, avant.occ);
    assert.notDeepEqual(apres.vec, avant.vec);
    assert.deepEqual(apres.opp, avant.opp);
    assert.deepEqual(apres.cho, avant.cho);
    assert.equal(await page.locator('#vec1-avertissement').isVisible(), true);
    assert.equal(Object.keys(apres.occ).length, communes.length);
    // la comparaison ne dépend pas de la source affichée (valeurs d'origine des deux sources)
    assert.equal((await page.locator('#vec1-comparaison').innerText()).replace(/\s+/g, ' '), texte);
    // bascule du mode p_k : la comparaison suit
    await page.click('#btn-toggle-pk');
    assert.match(await page.locator('#vec1-comparaison').innerText(), /p_k égaux/);

    await page.uncheck('#checkbox-vec1-ircom');
    await page.waitForFunction(() => vec1SourceActive === 'filosofi');
    await page.click('#btn-toggle-pk');
    assert.deepEqual(await etat(), avant);
    assert.deepEqual(nouvellesErreurs(), []);
    assert.deepEqual(alertes, []);
    await page.screenshot({ path: process.env.CAPTURE || undefined });
  });
});
