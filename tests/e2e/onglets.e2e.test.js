'use strict';
// Onglets LISA, CAH, Parangons, Corrélation, Entreprises, Chatbot et bascule de langue : rendu cohérent avec les fichiers de données.
const assert = require('node:assert/strict');
const { test, avecAppli, sauter, data, communes, lireJson, lireConstJs, normaliser, proche, classeDe } = require('./helpers/contexte');

const LISA = {
  betti: { '5': ['lisa_data_betti.js', 'LISA_DATA_BETTI'], '1': ['lisa_data_betti_1pct.js', 'LISA_DATA_BETTI_1PCT'] },
  egal: { '5': ['lisa_data.js', 'LISA_DATA'], '1': ['lisa_data_1pct.js', 'LISA_DATA_1PCT'] },
};
const comptes = (liste) => liste.reduce((o, x) => { o[x] = (o[x] || 0) + 1; return o; }, {});
const cliquerOnglet = (page, tab) => page.click(`.tab-button[data-tab="${tab}"]`);
const pearson = (a, b) => {
  const n = a.length; const ma = a.reduce((s, x) => s + x, 0) / n; const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
};

test('tous les onglets s\'ouvrent, affichent leur contenu, sans nouvelle erreur', { skip: sauter }, async () => {
  await avecAppli(async (appli) => {
    const { page } = appli;
    const onglets = await page.$$eval('.tab-button[data-tab]', (b) => b.map((x) => x.dataset.tab));
    assert.equal(onglets.length, 12);
    for (const tab of onglets) {
      await cliquerOnglet(page, tab);
      await page.waitForSelector(`#${tab}.active`, { state: 'visible', timeout: 15000 });
      assert.equal(await page.locator(`.tab-content.active`).count(), 1, `un seul onglet actif (${tab})`);
    }
    assert.deepEqual(appli.nouvellesErreurs(), []);
    assert.deepEqual(appli.requetesEchouees, []);
  });
});

test('LISA : effectifs par type de cluster = statistiques des fichiers, un seul coloris par type, suit le mode p_k', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    await cliquerOnglet(page, 'lisatab');
    await page.waitForFunction(() => geojsonLayers['lisa-5pct'] && geojsonLayers['lisa-1pct']);
    for (const mode of ['betti', 'egal']) {
      if (mode === 'egal') { await page.click('#btn-toggle-pk'); await page.waitForFunction(() => modeCalculPk === 'egal'); }
      for (const seuil of ['5', '1']) {
        const [fichier, constante] = LISA[mode][seuil];
        const lisa = lireConstJs(fichier, constante);
        const groupes = await page.evaluate((s) => { const o = []; geojsonLayers[`lisa-${s}pct`].eachLayer((l) => o.push([l.feature.properties.nom, l.options.fillColor])); return o; }, seuil);
        const affichage = await page.evaluate((s) => JSON.parse(JSON.stringify(s === '5' ? clustersLISA5pct : clustersLISA1pct)), seuil);
        const etiquettes = Object.fromEntries(groupes.map(([nom]) => [nom, affichage[nom]]));
        assert.deepEqual(etiquettes, Object.fromEntries(Object.entries(lisa.clusters).map(([c, v]) => [c, v.cluster])), `${mode} ${seuil} % : clusters affichés`);
        const couleurParType = {};
        for (const [nom, couleur] of groupes) (couleurParType[etiquettes[nom]] ||= new Set()).add(couleur);
        for (const [type, couleurs] of Object.entries(couleurParType)) assert.equal(couleurs.size, 1, `${mode} ${seuil} % : plusieurs couleurs pour ${type}`);
        assert.equal(new Set(Object.values(couleurParType).map((s) => [...s][0])).size, Object.keys(couleurParType).length, 'types de cluster distincts = couleurs distinctes');
        const attendu = comptes(Object.values(lisa.clusters).map((v) => v.cluster));
        assert.deepEqual(comptes(Object.values(etiquettes)), attendu, `${mode} ${seuil} %`);
        for (const [type, n] of Object.entries(lisa.statistiques)) assert.equal(attendu[type] || 0, n, `statistiques du fichier : ${type}`);
      }
    }
  });
});

test('CAH : classes affichées = fichiers JSON (3 et 5 classes), une couleur par classe, effectifs des statistiques', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    await cliquerOnglet(page, 'cahtab');
    await page.waitForFunction(() => geojsonLayers['cah-3'] && geojsonLayers['cah-5']);
    for (const n of [3, 5]) {
      const cah = lireJson(`cah_${n}_clusters.json`);
      const couleurs = await page.evaluate((k) => { const o = {}; geojsonLayers[`cah-${k}`].eachLayer((l) => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; }, n);
      assert.equal(Object.keys(couleurs).length, 360);
      const parClasse = {};
      for (const [nom, v] of Object.entries(cah.clusters)) (parClasse[v.cluster] ||= new Set()).add(couleurs[nom]);
      assert.equal(Object.keys(parClasse).length, n);
      for (const [classe, set] of Object.entries(parClasse)) assert.equal(set.size, 1, `CAH ${n} classe ${classe}`);
      assert.equal(new Set([...Object.values(parClasse)].map((s) => [...s][0])).size, n, 'une couleur distincte par classe');
      const effectifs = comptes(Object.values(cah.clusters).map((v) => v.cluster));
      for (const s of cah.stats) assert.equal(effectifs[s.cluster], s.n_communes, `CAH ${n} classe ${s.cluster}`);
    }
  });
});

test('Parangons : effectifs des classes = classes de Jenks, communes triées par proximité à la moyenne de leur classe', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    const indice = await page.evaluate(() => JSON.parse(JSON.stringify(indiceFinale)));
    const seuils = await page.evaluate(() => JSON.parse(JSON.stringify(seuilsJenks.oppchovec)));
    const classes = [0, 1, 2, 3, 4].map((i) => communes.filter((c) => classeDe(indice[c], seuils) === i));
    await cliquerOnglet(page, 'parangonstab');
    await page.waitForSelector('#parangons-cluster-btns button');
    const boutons = await page.$$eval('#parangons-cluster-btns button', (b) => b.map((x) => x.textContent.trim()));
    assert.deepEqual(boutons, classes.map((m, i) => `Classe ${i + 1} (${m.length})`));
    for (let i = 0; i < 5; i++) {
      await page.click(`#parangons-cluster-btns button[data-cluster="${i}"]`);
      const noms = await page.$$eval('#parangons-tbody tr[data-nom]', (r) => r.map((x) => x.dataset.nom));
      const moyenne = classes[i].reduce((s, c) => s + indice[c], 0) / classes[i].length;
      const attendu = [...classes[i]].sort((a, b) => Math.abs(indice[a] - moyenne) - Math.abs(indice[b] - moyenne));
      assert.deepEqual([...noms].sort(), [...classes[i]].sort(), `classe ${i + 1} : mêmes communes`);
      assert.deepEqual(noms.map((n) => Math.abs(indice[n] - moyenne).toFixed(9)), attendu.map((n) => Math.abs(indice[n] - moyenne).toFixed(9)), `classe ${i + 1} : ordre par distance à la moyenne`);
    }
  });
});

test('Corrélation : les 4 coefficients r affichés = Pearson recalculé indépendamment ; mis à jour après bascule p_k', { skip: sauter }, async () => {
  const densite = lireJson('densite_entrepreneuriale.json');
  const subjectif = lireJson('bien_etre_subjectif.json');
  const indices = {
    betti: Object.fromEntries(Object.entries(lireConstJs('lisa_data_betti.js', 'LISA_DATA_BETTI').clusters).map(([c, v]) => [c, v.oppchovec])),
    egal: Object.fromEntries(communes.map((c) => [c, data[c].OppChoVec_0_10])),
  };
  const attendus = (occ) => {
    const sub = Object.keys(subjectif);
    return [
      { id: 'correlation-r', r: pearson(communes.map((c) => occ[c]), communes.map((c) => densite[c])), n: 360 },
      { id: 'correlation-r2', r: pearson(communes.map((c) => occ[c]), communes.map((c) => densite[c])), n: 360 },
      { id: 'correlation-r3', r: pearson(sub.map((c) => occ[c]), sub.map((c) => subjectif[c].score)), n: sub.length },
      { id: 'correlation-r4', r: pearson(sub.map((c) => densite[c]), sub.map((c) => subjectif[c].score)), n: sub.length },
    ];
  };
  const lire = async (page, id) => {
    await page.waitForFunction((i) => /r = /.test(document.getElementById(i).textContent), id, { timeout: 20000 });
    const t = normaliser(await page.locator(`#${id}`).innerText());
    return { r: parseFloat(/r = (-?[\d.]+)/.exec(t)[1]), n: parseInt(/n = (\d+)/.exec(t)[1], 10) };
  };
  const ouvrirSousOnglets = async (page) => {
    for (const s of ['corr-entr-occ', 'corr-occ-entr', 'corr-subjectif', 'corr-subjectif-dens']) await page.click(`.corr-subtab-btn[data-corr="${s}"]`);
  };
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await cliquerOnglet(page, 'correlationtab');
    await ouvrirSousOnglets(page);
    for (const a of attendus(indices.betti)) {
      const lu = await lire(page, a.id);
      assert.equal(lu.r.toFixed(3), a.r.toFixed(3), `${a.id} (Betti)`);
      assert.equal(lu.n, a.n, `${a.id} : n`);
    }
    // bascule de mode : les coefficients doivent être recalculés avec les nouveaux indices
    await page.click('#btn-toggle-pk');
    await cliquerOnglet(page, 'correlationtab');
    await ouvrirSousOnglets(page);
    for (const a of attendus(indices.egal)) {
      await page.waitForFunction(([id, r]) => document.getElementById(id).textContent.includes(`r = ${r}`), [a.id, a.r.toFixed(3)], { timeout: 20000 });
    }
    assert.deepEqual(nouvellesErreurs(), []);
  });
});

test('Entreprises et Chatbot : les onglets s\'initialisent (carte, zone de saisie) sans erreur', { skip: sauter }, async () => {
  await avecAppli(async (appli) => {
    const { page } = appli;
    await cliquerOnglet(page, 'entreprisestab');
    await page.waitForSelector('#map-entreprises .leaflet-pane', { state: 'attached', timeout: 20000 });
    await cliquerOnglet(page, 'chatbottab');
    assert.ok(await page.locator('#chatbottab input, #chatbottab textarea').count() >= 1, 'zone de saisie du chatbot');
    assert.deepEqual(appli.nouvellesErreurs(), []);
  });
});

test('langue : les descriptions des indicateurs sont décrites en français et en anglais, Cho1 en −log(nombre de personnes)', { skip: sauter }, async () => {
  await avecAppli(async ({ page }) => {
    await page.selectOption('#communeSelect', 'Bastia');
    await page.click('#validerCommune');
    await page.waitForSelector('#resultCommune .indicateur-row');
    const lireDescription = async () => {
      await page.click('.info-button[data-indicator="Indicateur_Cho1"]');
      return normaliser(await page.locator('#info-Indicateur_Cho1 p[data-indicator-desc]').innerText());
    };
    const anglais = await lireDescription();
    await page.uncheck('#checkbox-english');
    await page.click('#validerCommune');
    await page.waitForSelector('#resultCommune .indicateur-row');
    const francais = await lireDescription();
    assert.notEqual(anglais, francais);
    for (const t of [anglais, francais]) {
      assert.match(t, /log\(/);
      assert.doesNotMatch(t, /exp\(/);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Anciennes dettes corrigées, gardées comme tests de non-régression.
test("basculer le mode p_k tout de suite après l'ouverture d'un sous-onglet de Corrélation ne lève aucune erreur (minuteries invalidateSize)", { skip: sauter }, async () => {
  // les minuteries de 150 ms en fin d'initialisation visaient une carte détruite par la bascule : TypeError « _leaflet_pos »
  for (const [sousOnglet, entete] of [['corr-occ-entr', 'correlation-r2'], ['corr-subjectif', 'correlation-r3'], ['corr-subjectif-dens', 'correlation-r4']]) {
    await avecAppli(async (appli) => {
      const { page } = appli;
      await cliquerOnglet(page, 'correlationtab');
      await page.click(`.corr-subtab-btn[data-corr="${sousOnglet}"]`);
      await page.waitForFunction((id) => /r = /.test(document.getElementById(id).textContent), entete);
      await page.click('#btn-toggle-pk');
      await page.waitForTimeout(600);
      assert.deepEqual(appli.nouvellesErreurs(), [], sousOnglet);
    });
  }
});

test("la croix de la bulle d'info d'un indicateur est visible et la referme", { skip: sauter }, async () => {
  // le CSS « .indicateur-row button { display: none } » masquait aussi ce bouton : seule la bulle info (🛈) la refermait
  await avecAppli(async ({ page }) => {
    await page.selectOption('#communeSelect', 'Bastia');
    await page.click('#validerCommune');
    await page.waitForSelector('#resultCommune .indicateur-row');
    await page.click('.info-button[data-indicator="Indicateur_Cho1"]');
    assert.equal(await page.locator('#info-Indicateur_Cho1').isVisible(), true);
    assert.equal(await page.locator('#info-Indicateur_Cho1 .info-close-button').isVisible(), true);
    await page.click('#info-Indicateur_Cho1 .info-close-button');
    assert.equal(await page.locator('#info-Indicateur_Cho1').isVisible(), false);
  });
});
