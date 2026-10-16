'use strict';
// Onglet Évolution (2016 → 2021) : trois cartes, mêmes seuils pour les deux années, fiche commune, changement de variable.
const assert = require('node:assert/strict');
const { test, avecAppli, sauter, lireJson, communes, classeDe } = require('./helpers/contexte');

const d = lireJson('serie_temporelle.json');

test('Évolution : panneau latéral masqué dans l\'onglet, restauré ailleurs ; texte d\'introduction en infobulle', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    assert.ok(await page.locator('aside').isVisible(), 'panneau visible au départ');
    const largeurAvant = await page.evaluate(() => document.querySelector('main').getBoundingClientRect().width);
    await page.click('.tab-button[data-tab="evolutiontab"]');
    await page.waitForFunction(() => typeof evolutionCouches !== 'undefined' && evolutionCouches.variation);
    assert.ok(!(await page.locator('aside').isVisible()), 'panneau masqué dans Évolution');
    await page.waitForTimeout(400);
    const largeurApres = await page.evaluate(() => document.querySelector('main').getBoundingClientRect().width);
    assert.ok(largeurApres > largeurAvant + 100, `cartes plus larges : ${largeurAvant} -> ${largeurApres}`);
    // la carte de gauche remplit bien son conteneur
    const carte = await page.evaluate(() => { const c = document.getElementById('map-evolution-a0'); return [c.getBoundingClientRect().width, c.querySelector('.leaflet-pane') ? c.clientWidth : 0]; });
    assert.ok(carte[0] > 300 && carte[1] > 300, `carte a0 : ${carte}`);
    // texte d'introduction : caché, visible au survol de l'icône
    assert.ok(!(await page.locator('.evolution-info-texte').isVisible()), 'infobulle cachée au repos');
    await page.hover('.evolution-info');
    assert.ok(await page.locator('.evolution-info-texte').isVisible(), 'infobulle visible au survol');
    assert.ok((await page.locator('.evolution-info-texte').innerText()).includes('7 indicateurs sur 10'));
    await page.mouse.move(5, 400);
    // retour à un autre onglet : le panneau revient
    await page.click('.tab-button[data-tab="oppchovectab"]');
    assert.ok(await page.locator('aside').isVisible(), 'panneau restauré hors Évolution');
    assert.deepEqual(nouvellesErreurs(), []);
  });
});

test('Évolution : 3 cartes de 360 communes aux bonnes couleurs, fiche au clic, changement de variable', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await page.click('.tab-button[data-tab="evolutiontab"]');
    await page.waitForFunction(() => typeof evolutionCouches !== 'undefined' && evolutionCouches.variation && document.querySelector('#evolution-legende-annees strong'));
    const palette = await page.evaluate(() => colorsJenks);
    const couleurs = (type) => page.evaluate((t) => { const o = {}; evolutionCouches[t].eachLayer((l) => { o[l._evolutionNom] = l.options.fillColor; }); return o; }, type);
    const c0 = await couleurs('a0'); const c1 = await couleurs('a1'); const cv = await couleurs('variation');
    for (const c of [c0, c1, cv]) assert.equal(Object.keys(c).length, communes.length);
    // couleur = classe de Jenks de la valeur (mêmes seuils pour les deux années)
    for (const nom of communes) {
      const s = d.seuils_jenks.OppChoVec;
      assert.equal(c0[nom], palette[classeDe(d.communes[nom]['2016'].scores_0_10.OppChoVec, [0, ...s, 10])], `2016 ${nom}`);
      assert.equal(c1[nom], palette[classeDe(d.communes[nom]['2021'].scores_0_10.OppChoVec, [0, ...s, 10])], `2021 ${nom}`);
    }
    const variation = (nom, v) => d.communes[nom]['2021'].scores_0_10[v] - d.communes[nom]['2016'].scores_0_10[v];
    const classeVar = (x) => (x <= -1.5 ? 0 : x <= -0.5 ? 1 : x <= 0.5 ? 2 : x <= 1.5 ? 3 : 4);
    const couleursVar = ['#b2182b', '#ef8a62', '#f0f0f0', '#67a9cf', '#2166ac'];
    for (const nom of communes) assert.equal(cv[nom], couleursVar[classeVar(variation(nom, 'OppChoVec'))], `variation ${nom}`);

    // résumé affiché = moyennes du fichier
    const moy = (a, v) => communes.reduce((s, n) => s + d.communes[n][a].scores_0_10[v], 0) / 360;
    const resume = (await page.locator('#evolution-resume').innerText()).replace(/\s+/g, ' ');
    assert.ok(resume.includes(moy('2016', 'OppChoVec').toFixed(2).replace('.', ',')), resume);
    assert.ok(resume.includes(moy('2021', 'OppChoVec').toFixed(2).replace('.', ',')), resume);

    // fiche au clic
    await page.evaluate(() => evolutionFiche('Bastia'));
    const fiche = (await page.locator('#evolution-fiche').innerText()).replace(/\s+/g, ' ');
    assert.ok(fiche.includes('Bastia'));
    assert.ok(fiche.includes(d.communes.Bastia['2016'].scores_0_10.OppChoVec.toFixed(2).replace('.', ',')));
    assert.ok(fiche.includes(d.communes.Bastia['2021'].scores_0_10.OppChoVec.toFixed(2).replace('.', ',')));

    // autre variable : les couleurs des cartes changent et suivent les seuils de cette variable
    await page.selectOption('#evolution-variable', 'Vec');
    const v1 = await couleurs('a1');
    assert.notDeepEqual(v1, c1);
    for (const nom of communes.slice(0, 60)) {
      assert.equal(v1[nom], palette[classeDe(d.communes[nom]['2021'].scores_0_10.Vec, [0, ...d.seuils_jenks.Vec, 10])], nom);
    }
    assert.deepEqual(nouvellesErreurs(), []);
  });
});
