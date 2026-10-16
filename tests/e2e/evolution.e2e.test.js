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

test('Évolution : résumé repliable (bouton, clic extérieur, Échap) et loupe qui agrandit une carte', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await page.click('.tab-button[data-tab="evolutiontab"]');
    await page.waitForFunction(() => typeof evolutionCouches !== 'undefined' && evolutionCouches.variation && document.querySelector('#evolution-legende-annees strong'));
    const largeurs = () => page.evaluate(() => ['a0', 'a1', 'variation'].map((t) => document.querySelector(`.evolution-carte[data-carte="${t}"]`).getBoundingClientRect().width));
    // résumé : fermé, ouvert, refermé par clic extérieur, rouvert puis fermé par Échap
    assert.ok(!(await page.locator('#evolution-resume').isVisible()));
    await page.click('#evolution-bouton-resume');
    assert.ok(await page.locator('#evolution-resume').isVisible());
    await page.mouse.click(400, 500);
    assert.ok(!(await page.locator('#evolution-resume').isVisible()), 'clic extérieur');
    await page.click('#evolution-bouton-resume');
    await page.keyboard.press('Escape');
    assert.ok(!(await page.locator('#evolution-resume').isVisible()), 'Échap');

    // loupe sur la carte de 2021 : elle devient la plus grande, les deux autres rétrécissent
    const [l0, l1, lv] = await largeurs();
    assert.ok(Math.abs(l0 - l1) < 5 && Math.abs(l1 - lv) < 5, 'trois cartes égales au départ');
    await page.click('.evolution-loupe[data-carte="a1"]');
    await page.waitForTimeout(400);
    const [g0, g1, gv] = await largeurs();
    assert.ok(g1 > 2 * g0 && g1 > 2 * gv, `carte agrandie : ${[g0, g1, gv]}`);
    assert.ok(g0 > 100 && gv > 100, 'les autres cartes restent visibles');
    // chaque carte garde un cadrage de la Corse entière (360 communes visibles dans la vue)
    const visibles = await page.evaluate(() => Object.fromEntries(Object.entries(evolutionCartes).map(([t, c]) => [t, c.getBounds().contains(evolutionCouches[t].getBounds())])));
    assert.deepEqual(visibles, { a0: true, a1: true, variation: true });
    // un clic sur une commune de la grande carte donne la fiche
    await page.evaluate(() => evolutionFiche('Bastia'));
    assert.ok((await page.locator('#evolution-fiche').innerText()).includes('Bastia'));
    // on peut agrandir une autre carte directement, puis revenir aux trois
    await page.click('.evolution-loupe[data-carte="variation"]');
    await page.waitForTimeout(300);
    const [h0, h1, hv] = await largeurs();
    assert.ok(hv > 2 * h0 && hv > 2 * h1, `autre carte agrandie : ${[h0, h1, hv]}`);
    await page.click('.evolution-loupe[data-carte="variation"]');
    await page.waitForTimeout(300);
    const [r0, r1, rv] = await largeurs();
    assert.ok(Math.abs(r0 - r1) < 5 && Math.abs(r1 - rv) < 5, `retour aux trois cartes : ${[r0, r1, rv]}`);
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
    assert.ok(!(await page.locator('#evolution-resume').isVisible()), 'résumé replié au départ');
    await page.click('#evolution-bouton-resume');
    assert.ok(await page.locator('#evolution-resume').isVisible(), 'résumé ouvert par le bouton');
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
