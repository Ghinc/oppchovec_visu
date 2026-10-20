'use strict';
// Case « EPCI » de la barre du haut dans un vrai navigateur : cartes et dominance (et Évolution si le site l'a) passent à l'échelle des EPCI (population / commune), puis reviennent aux communes.
const assert = require('node:assert/strict');
const { test, avecAppli, sauter, sansEvolution, lireJson, classeDe } = require('./helpers/contexte');

const agreg = lireJson('epci_agregation.json');
const noms = agreg.epci.map((e) => e.nom).sort();

test('Échelle EPCI : cartes, top 10, sélection, bandeaux ; deux méthodes ; retour aux communes', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    const polygones = (id) => page.evaluate((t) => geojsonLayers[t].getLayers().length, id.replace('map-', ''));       // unités dessinées sur la carte (les routes ne comptent pas)
    const couleurs = () => page.evaluate(() => { const o = {}; geojsonLayers.oppchovec.eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; });
    const seuils = await page.evaluate(() => seuilsJenks.oppchovec);
    const palette = await page.evaluate(() => colorsJenks);

    // état de départ : communes, case décochée, options cachées
    assert.ok(!(await page.locator('#echelle-epci-pop').isChecked()) && !(await page.locator('#echelle-epci-commune').isChecked()));
    assert.equal(Object.keys(await couleurs()).length, 360);
    const communesAvant = await couleurs();

    // case cochée : 19 EPCI, deux options visibles, « population » par défaut
    await page.check('#echelle-epci-pop');
    await page.waitForFunction(() => Object.keys(epciGeoVue ? (() => { const o = {}; geojsonLayers.oppchovec.eachLayer((l) => { o[l.feature.properties.nom] = 1; }); return o; })() : {}).length === 19);
    assert.ok(await page.locator('#echelle-epci-pop').isChecked());
    assert.equal(await polygones('map-oppchovec'), 19);
    const pop = await couleurs();
    assert.deepEqual(Object.keys(pop).sort(), noms);
    const valeursPop = await page.evaluate(() => JSON.parse(JSON.stringify(indiceFinale)));
    for (const [nom, v] of Object.entries(valeursPop)) assert.equal(pop[nom], palette[classeDe(v, seuils)], `population ${nom}`);
    assert.ok((await page.locator('#echelle-epci-etat').innerText()).includes('pondérées'));

    // les autres cartes (Opp, Cho, Vec) suivent aussi
    for (const t of ['opptab', 'chotab', 'vectab']) {
      await page.click(`.tab-button[data-tab="${t}"]`);
      assert.equal(await polygones(`map-${t.replace('tab', '')}`), 19, t);
    }
    // dominance : recalculée sur les 19 EPCI, carte et fiche à l'échelle des EPCI
    await page.click('.tab-button[data-tab="dominancetab"]');
    await page.waitForFunction(() => dominanceLayerRef && dominanceLayerRef.getLayers().length === 19);
    const couchesEpci = await page.evaluate(() => JSON.parse(JSON.stringify(dominanceResultat.couches)));
    assert.deepEqual(Object.keys(couchesEpci).sort(), noms);
    assert.ok((await page.locator('#dominance-legend').innerText()).includes('EPCI'));
    const attendu = await page.evaluate(() => JSON.parse(JSON.stringify(calculerDominance(scoresParCommune).couches)));
    assert.deepEqual(couchesEpci, attendu, 'couches = dominance des scores EPCI affichés');
    await page.evaluate((n) => dominanceAfficherFiche(n), noms[0]);
    assert.ok((await page.locator('#dominance-fiche').innerText()).includes('qui la dominent'));

    // sélection : la liste contient les 19 EPCI, le panneau montre la fiche de l'EPCI
    await page.click('.tab-button[data-tab="oppchovectab"]');
    const options = await page.$$eval('#communeSelect option', (o) => o.map((x) => x.value).filter(Boolean).sort());
    assert.deepEqual(options, noms);
    const ajaccio = agreg.epci.find((e) => e.nom.includes('Pays Ajaccien')).nom;
    await page.selectOption('#communeSelect', ajaccio);
    await page.click('#validerCommune');
    const fiche = (await page.locator('#resultCommune').textContent()).replace(/\s+/g, ' ');
    for (const mot of [ajaccio, 'Pro rata', 'Simple', 'Ajaccio']) assert.ok(fiche.includes(mot), mot);

    // « EPCI commune » : moyenne simple, les couleurs changent
    await page.check('#echelle-epci-commune');
    assert.ok(!(await page.locator('#echelle-epci-pop').isChecked()), 'les deux cases sont exclusives');
    await page.waitForFunction(() => document.getElementById('echelle-epci-etat').textContent.includes('simples'));
    const simple = await couleurs();
    assert.equal(Object.keys(simple).length, 19);
    assert.notDeepEqual(simple, pop, 'les deux méthodes ne colorent pas pareil');
    const valeursSimple = await page.evaluate(() => JSON.parse(JSON.stringify(indiceFinale)));
    for (const [nom, v] of Object.entries(valeursSimple)) assert.equal(simple[nom], palette[classeDe(v, seuils)], `simple ${nom}`);
    assert.ok(await page.locator('#epci-prorata').evaluate((e) => !e.checked), 'la case de l\'onglet EPCI suit');

    // case décochée : retour exact aux communes
    await page.uncheck('#echelle-epci-commune');
    await page.waitForFunction(() => { let n = 0; geojsonLayers.oppchovec.eachLayer(() => n++); return n === 360; });
    assert.deepEqual(await couleurs(), communesAvant, 'mêmes couleurs qu\'au départ');
    assert.equal((await page.$$eval('#communeSelect option', (o) => o.length)) > 300, true);
    await page.click('.tab-button[data-tab="dominancetab"]');
    await page.waitForFunction(() => dominanceLayerRef && dominanceLayerRef.getLayers().length === 360);
    assert.deepEqual(nouvellesErreurs().filter((m) => !/404/.test(m)), []);
  });
});

test('Échelle EPCI : l\'onglet Évolution passe aux EPCI (19 polygones, série EPCI, fiche avec communes membres), puis revient aux communes', { skip: sansEvolution || sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    const unites = (type) => page.evaluate((t) => evolutionCouches[t].getLayers().length, type);
    await page.click('.tab-button[data-tab="evolutiontab"]');
    await page.waitForFunction(() => typeof evolutionCouches !== 'undefined' && evolutionCouches.variation && document.querySelector('#evolution-legende-annees strong'));
    assert.equal(await unites('a0'), 360);
    assert.equal(await page.locator('#evolution-griser').isDisabled(), false);

    await page.check('#echelle-epci-pop');
    await page.waitForFunction(() => evolutionCouches.a1.getLayers().length === 19);
    for (const t of ['a0', 'a1', 'variation']) assert.equal(await unites(t), 19, t);
    assert.equal(await page.locator('#evolutiontab .epci-indisponible').isVisible(), false, 'pas de bandeau : l\'évolution existe à l\'échelle EPCI');
    assert.ok((await page.locator('.evolution-titre-onglet').innerText()).includes('EPCI (population)'));
    assert.equal(await page.locator('#evolution-griser').isDisabled(), true, 'rien à griser : les EPCI sont grands');
    // couleurs des niveaux = classes de Jenks des communes ; variation = classes de Jenks des EPCI
    const verif = await page.evaluate(() => {
      const d = evolutionDonnees, palette = colorsJenks, ok = { niveaux: true, variation: true };
      evolutionCouches.a1.eachLayer((l) => { const v = d.communes[l._evolutionNom]['2021'].scores_0_10.OppChoVec; if (l.options.fillColor !== palette[evolutionClasse(v, d.seuils_jenks.OppChoVec)]) ok.niveaux = false; });
      evolutionCouches.variation.eachLayer((l) => { const c = d.communes[l._evolutionNom]; const v = c['2021'].scores_0_10.OppChoVec - c['2016'].scores_0_10.OppChoVec; if (l.options.fillColor !== evolutionCouleursVariation(d.seuils_jenks_variation.OppChoVec)[evolutionClasse(v, d.seuils_jenks_variation.OppChoVec)]) ok.variation = false; });
      return ok;
    });
    assert.deepEqual(verif, { niveaux: true, variation: true });

    // fiche d'un EPCI : scores, détail du calcul, indicateurs non cliquables, communes membres
    const nom = agreg.epci.find((e) => e.nom.includes('Pays Ajaccien')).nom;
    await page.evaluate((n) => evolutionFiche(n), nom);
    let t = (await page.locator('#evolution-fiche').textContent()).replace(/\s+/g, ' ');
    for (const mot of [nom, 'Indice OppChoVec', 'Ajaccio (', 'Communes']) assert.ok(t.includes(mot), mot);
    assert.equal(await page.locator('#evolution-fiche .evolution-alerte').count(), 0);
    assert.equal(await page.locator('#evolution-fiche .evolution-ligne-score[data-variable="Opp1"]').count(), 0, 'indicateurs non cliquables à l\'échelle EPCI');
    await page.click('.evolution-ligne-score[data-variable="OppChoVec"]');
    t = (await page.locator('#evolution-fiche').textContent()).replace(/\s+/g, ' ');
    for (const mot of ['Somme S', 'Contribution à ΔS']) assert.ok(t.includes(mot), mot);
    await page.click('#evolution-bouton-resume');
    const resume = (await page.locator('#evolution-resume').innerText()).replace(/\s+/g, ' ');
    assert.ok(resume.includes('EPCI en progression') && resume.includes('Échelle EPCI'), resume);
    await page.mouse.click(400, 500);

    // moyenne simple : les valeurs changent
    const avant = await page.evaluate((n) => evolutionDonnees.communes[n]['2021'].scores_0_10.OppChoVec, nom);
    await page.check('#echelle-epci-commune');
    await page.waitForFunction(() => evolutionDonnees.prorata === false);
    assert.notEqual(await page.evaluate((n) => evolutionDonnees.communes[n]['2021'].scores_0_10.OppChoVec, nom), avant);

    // case décochée : retour aux 360 communes
    await page.uncheck('#echelle-epci-commune');
    await page.waitForFunction(() => evolutionCouches.a1.getLayers().length === 360);
    assert.equal(await page.locator('#evolution-griser').isDisabled(), false);
    assert.ok(!(await page.locator('.evolution-titre-onglet').innerText()).includes('EPCI'));
    assert.deepEqual(nouvellesErreurs().filter((m) => !/404/.test(m)), []);
  });
});

test('Échelle EPCI : « commune » devient « EPCI » dans les titres et légendes, et le détail du calcul reste disponible (tableau des communes, indice)', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    const titre = () => page.locator('[data-translate="commune-title"]').innerText();
    assert.ok((await titre()).includes('commune'));
    await page.check('#echelle-epci-pop');
    await page.waitForFunction(() => document.getElementById('echelle-epci-etat').textContent.includes('pondérées') && typeof epciResultats !== 'undefined' && epciResultats.prorata && Object.keys(epciResultats.prorata).length === 19);
    assert.equal(await titre(), '1. Sélection EPCI');
    assert.match(await page.locator('[data-translate="commune-info"]').innerText(), /EPCI/);
    assert.match(await page.locator('#communeSelect option[value=""]').innerText(), /EPCI/);
    assert.match(await page.locator('.legende-limites').first().innerText(), /EPCI/);
    // fiche d'un EPCI, avec le détail du calcul
    const e = agreg.epci.find((x) => x.nom.includes('Pays Ajaccien'));
    await page.selectOption('#communeSelect', e.nom);
    await page.click('#validerCommune');
    assert.equal(await page.locator('#resultCommune details.calcul-detail').count(), 10 + 1, 'un détail par indicateur et un pour l\'indice');
    const bloc = page.locator('#resultCommune .indicateur-row', { has: page.locator('summary') }).first();
    await bloc.locator('summary').click();
    const lignes = await bloc.locator('tbody tr').count();
    assert.equal(lignes, Object.keys(e.communes).length, 'une ligne par commune de l\'EPCI');
    const poids = await bloc.locator('tbody tr td:nth-child(3)').allInnerTexts();
    assert.ok(Math.abs(poids.reduce((t, x) => t + parseFloat(x.replace(/\s/g, '').replace(',', '.')), 0) - 100) < 0.3, 'les poids somment à 100 %');
    // la valeur affichée est celle de l'agrégation, et le 0-10 détaillé celui de la carte
    const agg = await page.evaluate((siren) => epciResultats.prorata[siren].agregats.Indicateur_Opp1, e.siren);
    assert.match((await bloc.innerText()).replace(/\s+/g, ' '), new RegExp("Valeur de l'indicateur pour l'EPCI : " + agg.toFixed(2).replace('.', ',')));
    const indice = page.locator('#resultCommune details.calcul-detail-indice');
    await indice.locator('summary').click();
    const sur10 = await page.evaluate((nom) => indiceFinale[nom], e.nom);
    assert.match((await indice.innerText()).replace(/\s+/g, ' '), new RegExp(sur10.toFixed(2).replace('.', ',') + ' / 10'));
    // moyenne simple : le titre de calcul change
    await page.check('#echelle-epci-commune');
    await page.waitForFunction(() => document.getElementById('echelle-epci-etat').textContent.includes('simples'));
    await page.selectOption('#communeSelect', e.nom);
    await page.click('#validerCommune');
    await page.locator('#resultCommune summary').first().click();
    assert.match(await page.locator('#resultCommune details.calcul-detail').first().innerText(), /Moyenne simple/);
    // retour aux communes : libellés rétablis
    await page.uncheck('#echelle-epci-commune');
    await page.waitForFunction(() => document.querySelector('[data-translate="commune-title"]').textContent.includes('commune'));
    assert.match(await page.locator('#communeSelect option[value=""]').innerText(), /commune/);
    assert.deepEqual(nouvellesErreurs().filter((m) => !/404/.test(m)), []);
  });
});
