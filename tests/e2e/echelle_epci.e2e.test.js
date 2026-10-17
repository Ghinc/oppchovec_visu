'use strict';
// Case « EPCI » de la barre du haut dans un vrai navigateur : toutes les analyses passent à l'échelle des EPCI (population / commune), puis reviennent aux communes.
const assert = require('node:assert/strict');
const { test, avecAppli, sauter, lireJson, classeDe } = require('./helpers/contexte');

const agreg = lireJson('epci_agregation.json');
const noms = agreg.epci.map((e) => e.nom).sort();

test('Échelle EPCI : cartes, top 10, sélection, bandeaux ; deux méthodes ; retour aux communes', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    const polygones = (id) => page.evaluate((t) => geojsonLayers[t].getLayers().length, id.replace('map-', ''));       // unités dessinées sur la carte (les routes ne comptent pas)
    const couleurs = () => page.evaluate(() => { const o = {}; geojsonLayers.oppchovec.eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; });
    const seuils = await page.evaluate(() => seuilsJenks.oppchovec);
    const palette = await page.evaluate(() => colorsJenks);

    // état de départ : communes, case décochée, options cachées
    assert.ok(!(await page.locator('#echelle-epci-case').isChecked()));
    assert.ok(!(await page.locator('#echelle-epci-modes').isVisible()));
    assert.equal(Object.keys(await couleurs()).length, 360);
    const communesAvant = await couleurs();

    // case cochée : 19 EPCI, deux options visibles, « population » par défaut
    await page.check('#echelle-epci-case');
    await page.waitForFunction(() => Object.keys(epciGeoVue ? (() => { const o = {}; geojsonLayers.oppchovec.eachLayer((l) => { o[l.feature.properties.nom] = 1; }); return o; })() : {}).length === 19);
    assert.ok(await page.locator('#echelle-epci-modes').isVisible());
    assert.ok(await page.locator('input[name="echelle-epci-mode"][value="epci-pop"]').isChecked());
    assert.equal(await polygones('map-oppchovec'), 19);
    const pop = await couleurs();
    assert.deepEqual(Object.keys(pop).sort(), noms);
    const valeursPop = await page.evaluate(() => JSON.parse(JSON.stringify(indiceFinale)));
    for (const [nom, v] of Object.entries(valeursPop)) assert.equal(pop[nom], palette[classeDe(v, seuils)], `population ${nom}`);
    assert.ok((await page.locator('#echelle-epci-etat').innerText()).includes('pro rata'));

    // les autres cartes (Opp, Cho, Vec) suivent aussi
    for (const t of ['opptab', 'chotab', 'vectab']) {
      await page.click(`.tab-button[data-tab="${t}"]`);
      assert.equal(await polygones(`map-${t.replace('tab', '')}`), 19, t);
    }
    // top 10 et histogramme en EPCI
    await page.click('.tab-button[data-tab="datavistab"]');
    assert.ok((await page.locator('#datavis-top10-titre').innerText()).includes('EPCI'));
    const premiere = (await page.locator('#top10-tbody tr').first().innerText()).replace(/\s+/g, ' ');
    const meilleur = Object.entries(valeursPop).sort((a, b) => b[1] - a[1])[0][0];
    assert.ok(premiere.includes(meilleur), `${premiere} contient ${meilleur}`);
    assert.equal(await page.locator('#top10-tbody tr').count(), 10);

    // bandeau sur les analyses communales, pas de contenu
    for (const t of ['lisatab', 'cahtab', 'entreprisestab', 'correlationtab']) {
      await page.click(`.tab-button[data-tab="${t}"]`);
      assert.ok(await page.locator(`#${t} .epci-indisponible`).isVisible(), `bandeau ${t}`);
    }
    // les parangons restent à l'échelle des communes
    await page.click('.tab-button[data-tab="parangonstab"]');
    await page.waitForFunction(() => parangonsLayerRef && parangonsLayerRef.getLayers().length === 360);
    assert.ok(!(await page.locator('#parangonstab .epci-indisponible').count()), 'pas de bandeau sur les parangons');

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
    await page.check('input[name="echelle-epci-mode"][value="epci-commune"]');
    await page.waitForFunction(() => document.getElementById('echelle-epci-etat').textContent.includes('simple'));
    const simple = await couleurs();
    assert.equal(Object.keys(simple).length, 19);
    assert.notDeepEqual(simple, pop, 'les deux méthodes ne colorent pas pareil');
    const valeursSimple = await page.evaluate(() => JSON.parse(JSON.stringify(indiceFinale)));
    for (const [nom, v] of Object.entries(valeursSimple)) assert.equal(simple[nom], palette[classeDe(v, seuils)], `simple ${nom}`);
    assert.ok(await page.locator('#epci-prorata').evaluate((e) => !e.checked), 'la case de l\'onglet EPCI suit');

    // changer p_k garde les EPCI
    await page.evaluate(() => toggleModePk());
    await page.waitForTimeout(300);
    assert.equal(await polygones('map-oppchovec'), 19);
    await page.evaluate(() => toggleModePk());

    // case décochée : retour exact aux communes
    await page.uncheck('#echelle-epci-case');
    await page.waitForFunction(() => { let n = 0; geojsonLayers.oppchovec.eachLayer(() => n++); return n === 360; });
    assert.ok(!(await page.locator('#echelle-epci-modes').isVisible()));
    assert.deepEqual(await couleurs(), communesAvant, 'mêmes couleurs qu\'au départ');
    assert.equal((await page.$$eval('#communeSelect option', (o) => o.length)) > 300, true);
    await page.click('.tab-button[data-tab="lisatab"]');
    assert.ok(!(await page.locator('#lisatab .epci-indisponible').isVisible()), 'plus de bandeau');
    assert.ok(await page.evaluate(() => lisaCartesInitialisees), 'LISA de nouveau disponible');
    assert.deepEqual(nouvellesErreurs().filter((m) => !/404/.test(m)), []);
  });
});

test('Échelle EPCI : l\'onglet Évolution passe aux EPCI (19 polygones, série EPCI, fiche avec communes membres), puis revient aux communes', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    const unites = (type) => page.evaluate((t) => evolutionCouches[t].getLayers().length, type);
    await page.click('.tab-button[data-tab="evolutiontab"]');
    await page.waitForFunction(() => typeof evolutionCouches !== 'undefined' && evolutionCouches.variation && document.querySelector('#evolution-legende-annees strong'));
    assert.equal(await unites('a0'), 360);
    assert.equal(await page.locator('#evolution-griser').isDisabled(), false);

    await page.check('#echelle-epci-case');
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
    await page.check('input[name="echelle-epci-mode"][value="epci-commune"]');
    await page.waitForFunction(() => evolutionDonnees.prorata === false);
    assert.notEqual(await page.evaluate((n) => evolutionDonnees.communes[n]['2021'].scores_0_10.OppChoVec, nom), avant);

    // case décochée : retour aux 360 communes
    await page.uncheck('#echelle-epci-case');
    await page.waitForFunction(() => evolutionCouches.a1.getLayers().length === 360);
    assert.equal(await page.locator('#evolution-griser').isDisabled(), false);
    assert.ok(!(await page.locator('.evolution-titre-onglet').innerText()).includes('EPCI'));
    assert.deepEqual(nouvellesErreurs().filter((m) => !/404/.test(m)), []);
  });
});
