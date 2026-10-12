'use strict';
// Tests de bout en bout (Chromium headless) : chargement, cartes, histogramme, top 10, bascule du mode p_k.
const assert = require('node:assert/strict');
const { test, avecAppli, sauter, data, communes, lireJson, lireConstJs, proche, couleursCarte, classeDe, comptes } = require('./helpers/contexte');

test('chargement : aucune erreur nouvelle, aucune requête en échec, données et exemple de la documentation corrects', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs, requetesEchouees, alertes }) => {
    assert.deepEqual(nouvellesErreurs(), []);
    assert.deepEqual(requetesEchouees, []);
    assert.deepEqual(alertes, []);
    // exemple de vérification de WEB/README_FICHIERS.md
    assert.equal(await page.evaluate(() => data_indicateursOriginaux['Afa'].OppChoVec_0_10), 10);
    assert.equal(await page.evaluate(() => seuilsJenks.oppchovec.length), 6);
    assert.equal(await page.evaluate(() => Object.keys(indiceFinale).length), 360);
  });
});

test('mode p_k : Betti par défaut, bouton et valeurs affichées cohérents, bascule aller-retour', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    const bouton = page.locator('#btn-toggle-pk');
    assert.match(await bouton.innerText(), /Betti et al\./);
    const poids = lireConstJs('lisa_data_betti.js', 'LISA_DATA_BETTI').metadata.poids;
    const affiche = await page.locator('#pk-values-display').innerText();
    assert.equal(affiche, `Opp=${poids.Opp.toFixed(3)} | Cho=${poids.Cho.toFixed(3)} | Vec=${poids.Vec.toFixed(3)}`);
    await bouton.click();
    assert.match(await bouton.innerText(), /égal \[1,1,1\]/);
    assert.match(await page.locator('#pk-values-display').innerText(), /égales/);
    await bouton.click();
    assert.match(await bouton.innerText(), /Betti et al\./);
  });
});

test('cartes : 360 communes dessinées par carte, couleurs = classe de Jenks de la valeur affichée (4 cartes)', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    const seuils = await page.evaluate(() => JSON.parse(JSON.stringify(seuilsJenks)));
    const palette = await page.evaluate(() => colorsJenks);
    const indice = await page.evaluate(() => JSON.parse(JSON.stringify(indiceFinale)));
    const scores = await page.evaluate(() => JSON.parse(JSON.stringify(scoresParCommune)));
    const cartes = {
      oppchovec: indice,
      opp: Object.fromEntries(communes.map((c) => [c, scores[c].Score_Opp])),
      cho: Object.fromEntries(communes.map((c) => [c, scores[c].Score_Cho])),
      vec: Object.fromEntries(communes.map((c) => [c, scores[c].Score_Vec])),
    };
    for (const [type, vals] of Object.entries(cartes)) {
      assert.equal(await page.evaluate((t) => { let n = 0; geojsonLayers[t].eachLayer(() => n++); return n; }, type), 360, `${type} : nombre de communes`);
      const rendu = await page.evaluate((t) => { const o = {}; geojsonLayers[t].eachLayer((l) => { o[l.feature.properties.nom] = l._path && l._path.isConnected ? l._path.getAttribute('fill') : null; }); return o; }, type);
      const couleursOptions = await page.evaluate(couleursCarte(type));
      for (const c of communes) assert.equal(String(rendu[c]).toLowerCase(), couleursOptions[c].toLowerCase(), `${type} / ${c} : tracé SVG`);
      const couleurs = await page.evaluate(couleursCarte(type));
      for (const c of communes) assert.equal(couleurs[c], palette[classeDe(vals[c], seuils[type])], `${type} / ${c}`);
      assert.equal(new Set(Object.values(couleurs)).size, 5, `${type} : les 5 classes doivent être représentées`);
    }
  });
});

test('les cartes de dimension affichent les scores 0-10 du fichier de données (mode égal et Betti : identiques)', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    for (const mode of ['betti', 'egal']) {
      if (mode === 'egal') await page.click('#btn-toggle-pk');
      const scores = await page.evaluate(() => JSON.parse(JSON.stringify(scoresParCommune)));
      for (const c of communes) {
        for (const d of ['Opp', 'Cho', 'Vec']) assert.ok(proche(scores[c][`Score_${d}`], data[c][`Score_${d}_0_10`]), `${mode} ${c} ${d}`);
      }
    }
  });
});

test('histogramme et top 10 : cohérents avec les valeurs affichées sur la carte', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    const indice = await page.evaluate(() => JSON.parse(JSON.stringify(indiceFinale)));
    const seuils = await page.evaluate(() => JSON.parse(JSON.stringify(seuilsJenks.oppchovec)));
    const attendu = comptes(communes.map((c) => classeDe(indice[c], seuils)));
    const histo = await page.evaluate(() => window.oppchovec_histogram.data.datasets[0].data);
    assert.deepEqual(histo, [0, 1, 2, 3, 4].map((i) => attendu[i]));
    assert.equal(histo.reduce((a, b) => a + b, 0), 360);
    const lignes = await page.$$eval('#top10-tbody tr', (rows) => rows.map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent.trim())));
    const top = Object.entries(indice).sort((a, b) => b[1] - a[1]).slice(0, 10);
    assert.deepEqual(lignes, top.map(([c, v], i) => [String(i + 1), c, v.toFixed(2)]));
  });
});

test('bascule p_k : cartes, histogramme et top 10 se mettent à jour ensemble ; retour au mode Betti = état initial exact', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    const etat = () => page.evaluate(() => ({
      couleurs: (() => { const o = {}; geojsonLayers['oppchovec'].eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; })(),
      histo: window.oppchovec_histogram.data.datasets[0].data.slice(),
      top: [...document.querySelectorAll('#top10-tbody tr')].map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent.trim())),
      indice: JSON.parse(JSON.stringify(indiceFinale)), seuils: seuilsJenks.oppchovec.slice(),
    }));
    const betti = await etat();
    await page.click('#btn-toggle-pk');
    const egal = await etat();
    // le mode égal doit reproduire exactement les valeurs du fichier de données
    for (const c of communes) assert.ok(proche(egal.indice[c], data[c].OppChoVec_0_10), c);
    const gvf = lireJson('seuils_jenks_optimal_gvf.json').OppChoVec_0_10.breaks;
    [0, ...gvf, 10].forEach((v, i) => assert.ok(proche(egal.seuils[i], v), `seuil ${i}`));
    const palette = await page.evaluate(() => colorsJenks);
    for (const c of communes) assert.equal(egal.couleurs[c], palette[classeDe(egal.indice[c], egal.seuils)], c);
    const parClasse = comptes(communes.map((c) => classeDe(egal.indice[c], egal.seuils)));
    assert.deepEqual(egal.histo, [0, 1, 2, 3, 4].map((i) => parClasse[i]));
    const top = Object.entries(data).sort((a, b) => b[1].OppChoVec_0_10 - a[1].OppChoVec_0_10).slice(0, 10);
    assert.deepEqual(egal.top.map((t) => t[1]), top.map(([c]) => c));
    assert.notDeepEqual(egal.couleurs, betti.couleurs);
    await page.click('#btn-toggle-pk');
    assert.deepEqual(await etat(), betti);
  });
});
