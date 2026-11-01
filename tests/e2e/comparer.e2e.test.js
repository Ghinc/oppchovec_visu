'use strict';
// Onglet « Comparer ma commune » dans un vrai navigateur : trois teintes autour de la commune choisie, effectifs, bulle de survol,
// carte de la largeur de la fourchette, simulation, échelle EPCI, vocabulaire (ni « dominance » ni « Pareto » dans l'interface).
const assert = require('node:assert/strict');
const path = require('node:path');
const { test, avecAppli, sauter, communes, data, WEB } = require('./helpers/contexte');
const R = require(path.join(WEB, 'rang_fourchette.js'));

const scores10 = Object.fromEntries(communes.map((c) => [c, { Score_Opp: data[c].Score_Opp_0_10, Score_Cho: data[c].Score_Cho_0_10, Score_Vec: data[c].Score_Vec_0_10 }]));
const COULEURS = { mieux: '#2c7bb6', moins: '#e08214', depend: '#d9d9d9', ref: '#f2c744' };
const couleursComparer = (page) => page.evaluate(() => { const o = {}; comparerCouche.eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; });
const choisir = async (page, nom) => { await page.selectOption('#communeSelect', nom); await page.click('#validerCommune'); };
const ouvrirOnglet = async (page) => { await page.click('.tab-button[data-tab="comparertab"]'); await page.waitForSelector('#comparertab.active #comparer-legende .comparer-legende-ligne'); };

test('Comparer ma commune : trois teintes, effectifs, phrase d\'explication, ligne de rang', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await choisir(page, 'Corte');
    await ouvrirOnglet(page);
    const r = R.comparerUnites(scores10), cat = R.categoriesUnite(r, 'Corte'), ef = R.effectifsUnite(r, 'Corte');
    const couleurs = await couleursComparer(page);
    assert.equal(Object.keys(couleurs).length, 360);
    assert.equal(couleurs.Corte, COULEURS.ref);
    for (const c of communes) if (c !== 'Corte') assert.equal(couleurs[c], COULEURS[cat[c]], c);
    assert.equal(await page.$$eval('#map-comparer .leaflet-interactive', (e) => e.length), 360);

    const resume = (await page.$eval('#comparer-resume', (e) => e.innerText)).replace(/\s+/g, ' ');
    assert.ok(resume.includes(`${ef.mieux} communes font mieux partout`) || ef.mieux <= 1, resume);
    assert.ok(resume.includes(`${ef.moins} moins bien partout`), resume);
    assert.ok(resume.includes(`${ef.depend} : ça dépend`), resume);
    assert.equal(ef.mieux + ef.moins + ef.depend + ef.identiques, 359);
    assert.ok(resume.includes('Une commune qui fait mieux sur les trois dimensions passera devant quelle que soit la façon de pondérer. Pour les communes en gris, l\'ordre dépend de l\'importance donnée à chaque dimension.'));
    const rang = R.rangsIndice(await page.evaluate(() => indiceFinale), r.noms).Corte;
    assert.ok(resume.includes(R.texteFourchette(rang, R.fourchetteRang(r, 'Corte'))), resume);

    const legende = (await page.$eval('#comparer-legende', (e) => e.innerText)).replace(/\s+/g, ' ');
    for (const t of ['Fait mieux sur les trois dimensions', 'Fait moins bien sur les trois dimensions', 'Ça dépend de ce qu\'on privilégie']) assert.ok(legende.includes(t), t);

    // vocabulaire : jamais « dominance » ni « Pareto » dans l'onglet (texte visible, infobulles, attributs title)
    const tout = await page.$eval('#comparertab', (e) => e.innerText + ' ' + [...e.querySelectorAll('[title]')].map((x) => x.title).join(' '));
    assert.ok(!/dominan|pareto/i.test(tout), 'vocabulaire interdit dans l\'onglet');
    const panneau = await page.$eval('#resultCommune', (e) => e.innerText);
    assert.ok(!/dominan|pareto/i.test(panneau));
    assert.deepEqual(nouvellesErreurs(), []);
  });
});

test('Comparer ma commune : bulle de survol = trois scores de la commune survolée à côté de ceux de la commune sélectionnée', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await choisir(page, 'Corte');
    await ouvrirOnglet(page);
    const r = R.comparerUnites(scores10), cat = R.categoriesUnite(r, 'Corte');
    for (const type of ['mieux', 'moins', 'depend']) {
      const autre = communes.find((c) => cat[c] === type);
      if (!autre) continue;
      await page.evaluate((n) => { comparerCouche.eachLayer((l) => { l.closeTooltip(); if (l.feature.properties.nom === n) l.openTooltip(); }); }, autre);
      await page.waitForFunction(() => document.querySelectorAll('.comparer-tooltip').length === 1);       // la bulle précédente a fini de disparaître
      const bulle = (await page.$eval('.comparer-tooltip', (e) => e.textContent)).replace(/\s+/g, ' ');
      assert.ok(bulle.includes(autre) && bulle.includes('Corte'), bulle);
      assert.ok(bulle.includes({ mieux: 'Fait mieux sur les trois dimensions', moins: 'Fait moins bien sur les trois dimensions', depend: 'Ça dépend de ce qu\'on privilégie' }[type]), bulle);
      for (const dim of ['Score_Opp', 'Score_Cho', 'Score_Vec']) {
        assert.ok(bulle.includes(scores10.Corte[dim].toFixed(2)), `${dim} de Corte dans la bulle`);
        assert.ok(bulle.includes(scores10[autre][dim].toFixed(2)), `${dim} de ${autre} dans la bulle`);
      }
      const fleches = await page.$$eval('.comparer-tooltip .comparer-plus, .comparer-tooltip .comparer-moins', (e) => e.map((x) => x.className));
      if (type === 'mieux') assert.ok(fleches.every((c) => c === 'comparer-plus'), 'une commune qui fait mieux : trois ▲ (ou =)');
      if (type === 'moins') assert.ok(fleches.every((c) => c === 'comparer-moins'));
      if (type === 'depend') assert.ok(fleches.includes('comparer-plus') && fleches.includes('comparer-moins'), 'ça dépend : des ▲ et des ▼');
    }
    assert.deepEqual(nouvellesErreurs(), []);
  });
});

test('Comparer ma commune : un clic sur la carte choisit la commune (liste et fiche du panneau suivent) ; sans sélection, carte grise', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await ouvrirOnglet(page);
    const sans = await couleursComparer(page);
    assert.ok(Object.values(sans).every((c) => c === COULEURS.depend), 'aucune commune choisie : tout en gris neutre');
    assert.match(await page.$eval('#comparer-resume', (e) => e.innerText), /Choisissez une commune/);
    await page.evaluate(() => comparerCouche.eachLayer((l) => { if (l.feature.properties.nom === 'Bastia') l.fire('click'); }));
    assert.equal(await page.$eval('#communeSelect', (e) => e.value), 'Bastia');
    assert.match(await page.$eval('#resultCommune', (e) => e.innerText), /Commune : Bastia/);
    const c = await couleursComparer(page);
    assert.equal(c.Bastia, COULEURS.ref);
    assert.deepEqual(nouvellesErreurs(), []);
  });
});

test('Comparer ma commune : carte de la largeur de la fourchette (cinq classes, effectifs = 360)', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await choisir(page, 'Ajaccio');
    await ouvrirOnglet(page);
    await page.check('input[name="comparer-vue"][value="largeur"]');
    const r = R.comparerUnites(scores10);
    const largeurs = Object.fromEntries(communes.map((c) => [c, R.fourchetteRang(r, c).largeur]));
    const lignes = await page.$$eval('#comparer-legende .comparer-legende-ligne', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
    const effectifs = lignes.map((l) => Number(/— (\d+)$/.exec(l)?.[1])).filter(Number.isFinite);
    assert.equal(effectifs.length, 5);
    assert.equal(effectifs.reduce((a, b) => a + b, 0), 360);
    assert.equal(effectifs[0], communes.filter((c) => largeurs[c] < 20).length, 'moins de 20 places');
    assert.match(lignes[0], /moins de 20 places/);
    const couleurs = await couleursComparer(page);
    assert.ok(new Set(Object.values(couleurs)).size <= 5);
    // plus la fourchette est large, plus la teinte est foncée (ordre des classes monotone)
    const ordre = ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'];
    const tri = [...communes].sort((a, b) => largeurs[a] - largeurs[b]);
    let prec = -1;
    for (const c of tri) { const i = ordre.indexOf(couleurs[c]); assert.ok(i >= prec, c); prec = i; }
    const resume = (await page.$eval('#comparer-resume', (e) => e.innerText)).replace(/\s+/g, ' ');
    const L = communes.map((c) => largeurs[c]).sort((a, b) => a - b);
    assert.ok(resume.includes(`Largeur minimale ${L[0]}`) && resume.includes(`maximale ${L[359]}`), resume);
    assert.deepEqual(nouvellesErreurs(), []);
  });
});

test('Comparer ma commune : une commune modifiée avec les curseurs change de catégorie et de fourchette ; les autres bornes restent figées', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await choisir(page, 'Bastia');
    await ouvrirOnglet(page);
    const avant = (await page.$eval('#comparer-resume', (e) => e.innerText)).replace(/\s+/g, ' ');
    await page.evaluate(() => {
      for (const k of Object.keys(indicateursCommune.Bastia)) indicateursCommune.Bastia[k] = (k === 'Indicateur_Cho1') ? bornesRef.min[k] : bornesRef.max[k];
      recalculerIndice('Bastia');
    });
    const apres = (await page.$eval('#comparer-resume', (e) => e.innerText)).replace(/\s+/g, ' ');
    assert.notEqual(apres, avant);
    const scores = await page.evaluate(() => JSON.parse(JSON.stringify(scoresParCommune)));
    const r = R.comparerUnites(scores);
    const ef = R.effectifsUnite(r, 'Bastia');
    assert.ok(apres.includes(`${ef.moins} moins bien partout`), apres);
    const couleurs = await couleursComparer(page);
    const cat = R.categoriesUnite(r, 'Bastia');
    for (const c of communes) if (c !== 'Bastia') assert.equal(couleurs[c], COULEURS[cat[c]], c);
    // la ligne du panneau latéral dit la même chose
    const panneau = (await page.$eval('#resultCommune', (e) => e.innerText)).replace(/\s+/g, ' ');
    const rang = R.rangsIndice(await page.evaluate(() => indiceFinale), r.noms).Bastia;
    assert.ok(panneau.includes(R.texteFourchette(rang, R.fourchetteRang(r, 'Bastia'))), panneau);
    assert.deepEqual(nouvellesErreurs(), []);
  });
});

test('Comparer ma commune : à l\'échelle EPCI, 19 EPCI, bornes 1 et 19, effectifs = 18', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await ouvrirOnglet(page);
    await page.check('#echelle-epci-pop');
    await page.waitForFunction(() => echelleEstEPCI() && Object.keys(scoresParCommune).length === 19);
    await page.waitForFunction(() => document.querySelectorAll('#map-comparer .leaflet-interactive').length === 19);
    const nom = await page.evaluate(() => Object.keys(scoresParCommune).sort()[0]);
    await page.evaluate((n) => selectionnerCommuneDepuisCarte(n), nom);
    const scores = await page.evaluate(() => JSON.parse(JSON.stringify(scoresParCommune)));
    const r = R.comparerUnites(scores), ef = R.effectifsUnite(r, nom), f = R.fourchetteRang(r, nom);
    assert.equal(ef.mieux + ef.moins + ef.depend + ef.identiques, 18);
    assert.ok(1 <= f.meilleur && f.pire <= 19);
    const resume = (await page.$eval('#comparer-resume', (e) => e.innerText)).replace(/\s+/g, ' ');
    assert.ok(resume.includes(`${ef.moins} moins bien partout`) && resume.includes(`${ef.depend} : ça dépend`), resume);
    assert.ok((await page.$eval('#comparer-legende', (e) => e.innerText)).includes(`Par rapport à ${nom}`));
    assert.match(resume, /EPCI font mieux partout|EPCI fait mieux partout|0 EPCI|moins bien partout/);
    assert.deepEqual(nouvellesErreurs(), []);
  });
});
