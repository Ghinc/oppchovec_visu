'use strict';
// Onglet Dominance dans un vrai navigateur : carte colorée par couche, légende, fiche au clic, texte explicatif.
const assert = require('node:assert/strict');
const path = require('node:path');
const { test, avecAppli, sauter, communes, WEB } = require('./helpers/contexte');
const { calculerDominance } = require(path.join(WEB, 'dominance.js'));

const TEXTE = [
  'Une commune en domine une autre lorsqu\'elle fait au moins aussi bien sur les trois dimensions (opportunités, choix, vécu) et mieux sur au moins une. Cette lecture ne dépend d\'aucune pondération : si une commune en domine une autre, elle passera toujours devant elle, quelle que soit l\'importance accordée à chaque dimension.',
  'Deux communes qui ne se dominent pas ne peuvent pas être départagées sans décider laquelle des dimensions compte le plus. Leur ordre dans le score OppChoVec dépend alors de ce choix.',
  'La première couche regroupe les communes qu\'aucune autre ne dépasse sur les trois dimensions à la fois. Elle ne désigne pas les « meilleures » communes : une commune peut y figurer parce qu\'elle est en tête sur une seule dimension.',
];

test('Dominance : texte explicatif intact, carte colorée par couche, légende en « couches », fiche au clic', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    const scores = await page.evaluate(() => JSON.parse(JSON.stringify(scoresParCommune)));
    const res = calculerDominance(scores);
    await page.click('.tab-button[data-tab="dominancetab"]');
    await page.waitForSelector('#dominancetab.active #dominance-legend .dominance-legend-row');

    // texte explicatif : paragraphes identiques au libellé demandé
    const paragraphes = await page.$$eval('#dominancetab .dominance-intro p', (p) => p.map((x) => x.textContent.trim()));
    assert.deepEqual(paragraphes, TEXTE);

    // légende : « couches », jamais « rang » ou « classement »
    const legende = await page.$$eval('#dominance-legend .dominance-legend-row', (r) => r.map((x) => x.textContent.trim()));
    assert.equal(legende.length, res.nbCouches);
    legende.forEach((t, i) => assert.equal(t, `Couche ${i + 1} — ${res.effectifs[i]} commune${res.effectifs[i] > 1 ? 's' : ''}`));
    const visible = await page.$eval('#dominancetab', (e) => e.innerText);
    assert.ok(!/\brang\b|classement/i.test(visible.replace(TEXTE[1], '').replace(/OppChoVec/g, '')), 'ni « rang » ni « classement »');

    // carte : une couleur par couche, 360 communes
    const couleurs = await page.evaluate(() => { const o = {}; dominanceLayerRef.eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; });
    assert.equal(Object.keys(couleurs).length, communes.length);
    const parCouche = {};
    for (const [c, n] of Object.entries(res.couches)) (parCouche[n] ||= new Set()).add(couleurs[c]);
    for (const s of Object.values(parCouche)) assert.equal(s.size, 1);
    assert.equal(new Set(Object.values(parCouche).map((s) => [...s][0])).size, res.nbCouches, 'une couleur par couche');

    // fiche : commune de couche 2 au moins
    const nom = communes.find((c) => res.couches[c] === 2);
    await page.evaluate((n) => dominanceAfficherFiche(n), nom);
    const fiche = await page.$eval('#dominance-fiche', (e) => e.innerText);
    assert.match(fiche, new RegExp(`Couche\\s+${res.couches[nom]}\\s+sur ${res.nbCouches}`));
    assert.match(fiche, new RegExp(`Communes qui la dominent \\(${res.dominants[nom].length}\\)`));
    assert.match(fiche, new RegExp(`Communes qu'elle domine \\(${res.domines[nom].length}\\)`));
    const liens = await page.$$eval('#dominance-fiche .dominance-lien', (b) => b.map((x) => x.dataset.commune));
    assert.deepEqual([...liens].sort(), [...res.dominants[nom], ...res.domines[nom]].sort());
    for (const k of ['Opportunités', 'Choix', 'Vécu']) assert.ok(fiche.includes(k));

    // un clic sur un nom de la liste ouvre la fiche de cette commune
    const premier = liens[0];
    await page.click(`#dominance-fiche .dominance-lien[data-commune="${premier}"]`);
    assert.match(await page.$eval('#dominance-fiche h4', (e) => e.textContent), new RegExp(premier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.deepEqual(nouvellesErreurs(), []);
  });
});
