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

test('les cartes de dimension affichent les scores 0-10 du fichier de données (pondérations de Betti)', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    for (const mode of ['betti']) {
      const scores = await page.evaluate(() => JSON.parse(JSON.stringify(scoresParCommune)));
      for (const c of communes) {
        for (const d of ['Opp', 'Cho', 'Vec']) assert.ok(proche(scores[c][`Score_${d}`], data[c][`Score_${d}_0_10`]), `${mode} ${c} ${d}`);
      }
    }
  });
});

test('carte principale : le millésime « 2024 » est affiché en haut de la carte, et seulement sur celle-là', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    const repere = page.locator('#map-oppchovec .millesime-carte');
    assert.equal(await repere.count(), 1, 'un seul repère sur la carte principale');
    assert.equal((await repere.innerText()).trim(), '2024');
    assert.ok(await repere.isVisible(), 'visible');
    // en haut, au centre de la carte
    const pos = await page.evaluate(() => {
      const c = document.getElementById('map-oppchovec').getBoundingClientRect(), r = document.querySelector('#map-oppchovec .millesime-carte').getBoundingClientRect();
      return { haut: r.top - c.top, centre: (r.left + r.width / 2) - (c.left + c.width / 2) };
    });
    assert.ok(pos.haut >= 0 && pos.haut < 40, `en haut : ${pos.haut}`);
    assert.ok(Math.abs(pos.centre) < 3, `au centre : ${pos.centre}`);
    for (const id of ['map-opp', 'map-cho', 'map-vec']) assert.equal(await page.locator(`#${id} .millesime-carte`).count(), 0, `pas sur ${id}`);
    assert.deepEqual(nouvellesErreurs(), []);
  });
});

test('carte principale : la bulle du millésime s\'affiche au survol et au clavier, sinon elle est cachée', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    const repere = page.locator('#map-oppchovec .millesime-carte'), bulle = page.locator('#map-oppchovec .millesime-info');
    assert.ok(!(await bulle.isVisible()), 'cachée au repos');
    await repere.hover();
    assert.ok(await bulle.isVisible(), 'visible au survol');
    const texte = await bulle.innerText();
    assert.ok(texte.includes('2023 à 2025') && texte.includes('ARCEP'), texte);
    await page.mouse.move(5, 5);
    assert.ok(!(await bulle.isVisible()), 'recachée quand la souris part');
    await repere.focus();
    assert.ok(await bulle.isVisible(), 'visible au clavier (focus)');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#map-oppchovec .millesime-carte')).cursor), 'default', 'pas de point d\'interrogation');
    assert.deepEqual(nouvellesErreurs(), []);
  });
});
