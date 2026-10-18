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
    assert.ok((await page.locator('.evolution-info-texte').innerText()).includes('8 indicateurs sur 10'));
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

test('Évolution : détail du calcul au clic sur un score (dimensions puis indicateurs), conservé d\'une commune à l\'autre', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await page.click('.tab-button[data-tab="evolutiontab"]');
    await page.waitForFunction(() => typeof evolutionCouches !== 'undefined' && evolutionCouches.variation && document.querySelector('#evolution-legende-annees strong'));
    await page.evaluate(() => evolutionFiche('Bastia'));
    assert.equal(await page.locator('.evolution-detail').count(), 0, 'aucun détail au départ');
    const texte = async () => (await page.locator('#evolution-fiche').textContent()).replace(/\s+/g, ' ');     // textContent : les en-têtes sont affichés en majuscules par le CSS
    assert.ok((await texte()).includes('proxy'), 'Cho2 annoncé comme proxy du droit de vote');
    // indice : trois dimensions avec poids et contributions
    await page.click('.evolution-ligne-score[data-variable="OppChoVec"]');
    let t = await texte();
    for (const mot of ['Somme S', 'Indice brut', 'Contribution à ΔS', 'Opportunités (Opp)', 'Choix (Cho)', 'Vécu (Vec)', '▲']) assert.ok(t.includes(mot), mot);
    const det = await page.evaluate(() => evolutionDetails(evolutionDonnees, 'Bastia'));
    const cho = det.dimensions.find((x) => x.nom === 'Cho');
    assert.ok(t.includes(cho.poids.toFixed(3).replace('.', ',')), 'poids p_k affiché');
    // dimension Vec : ses trois indicateurs, normalisés, avec leur contribution
    await page.click('.evolution-ligne-score[data-variable="Vec"]');
    t = await texte();
    for (const mot of ['Vec1 · revenu fiscal moyen', 'Vec2 · logement', 'Vec3 · stabilité', 'Contribution (points)', 'Normalisé 2016']) assert.ok(t.includes(mot), mot);
    assert.equal(await page.locator('.evolution-detail').count(), 2);
    // indicateur brut : lignes cliquables avec leurs composantes
    await page.click('.evolution-ligne-score[data-variable="Opp1"]');
    t = await texte();
    for (const mot of ['Niveau 1 · aucun diplôme', 'Niveau 4 · enseignement supérieur', 'somme des contributions']) assert.ok(t.includes(mot), mot);
    await page.click('.evolution-ligne-score[data-variable="Vec3"]');
    t = await texte();
    for (const mot of ['Chômeurs (15-64 ans)', 'CDI et non-salariés']) assert.ok(t.includes(mot), mot);
    await page.click('.evolution-ligne-score[data-variable="Cho2"]');
    assert.ok((await texte()).includes('Population totale'));
    for (const k of ['Opp1', 'Vec3', 'Cho2']) await page.click(`.evolution-ligne-score[data-variable="${k}"]`);
    assert.equal(await page.locator('.evolution-detail').count(), 2, 'seuls les deux scores restent ouverts');
    // le détail reste ouvert quand on change de commune ; un second clic le referme
    await page.evaluate(() => evolutionFiche('Ajaccio'));
    assert.equal(await page.locator('.evolution-detail').count(), 2);
    assert.ok((await texte()).includes('Ajaccio'));
    await page.click('.evolution-ligne-score[data-variable="Vec"]');
    await page.click('.evolution-ligne-score[data-variable="OppChoVec"]');
    assert.equal(await page.locator('.evolution-detail').count(), 0);
    assert.deepEqual(nouvellesErreurs().filter((e) => !/404/.test(e)), []);
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
    // carte d'évolution : classes de Jenks des variations ; la classe qui contient 0 est blanche
    const sv = d.seuils_jenks_variation.OppChoVec;
    const zero = classeDe(0, [0, ...sv, 10]);
    const couleursVar = await page.evaluate((s) => evolutionCouleursVariation(s), sv);
    assert.equal(couleursVar[zero], '#f0f0f0');
    for (const nom of communes) assert.equal(cv[nom], couleursVar[classeDe(variation(nom, 'OppChoVec'), [-99, ...sv, 99])], `variation ${nom}`);
    // la légende donne les 5 classes avec leurs bornes
    const leg = (await page.locator('#evolution-legende-variation').innerText()).replace(/\s+/g, ' ');
    assert.ok(leg.includes('Jenks') && leg.includes('(contient 0)'), leg);
    for (const x of sv) assert.ok(leg.includes(Math.abs(x).toFixed(2).replace('.', ',')), `${x} dans « ${leg} »`);

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

test('Évolution : grisage des communes de moins de 100 habitants, avertissement dans la fiche, variante Opp3 robuste', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await page.click('.tab-button[data-tab="evolutiontab"]');
    await page.waitForFunction(() => typeof evolutionCouches !== 'undefined' && evolutionCouches.variation && document.querySelector('#evolution-legende-annees strong'));
    const remplissage = (nom) => page.evaluate((n) => { let c; evolutionCouches.variation.eachLayer((l) => { if (l._evolutionNom === n) c = l.options.fillColor; }); return c; }, nom);
    const couleurNormale = await remplissage('Piazzali');
    assert.notEqual(couleurNormale, '#d9d9d9');

    // grisage : les communes de moins de 100 habitants sont grises, les autres inchangées
    await page.check('#evolution-griser');
    assert.equal(await remplissage('Piazzali'), '#d9d9d9');
    const bastiaAvant = await remplissage('Bastia');
    assert.notEqual(bastiaAvant, '#d9d9d9');
    const nbGrises = await page.evaluate(() => { let n = 0; evolutionCouches.a1.eachLayer((l) => { if (l.options.fillColor === '#d9d9d9') n++; }); return n; });
    assert.equal(nbGrises, await page.evaluate(() => Object.keys(evolutionDonnees.communes).filter((c) => evolutionHabitants(evolutionDonnees, c) < EVOLUTION_SEUIL_FIABLE).length));
    await page.uncheck('#evolution-griser');
    assert.equal(await remplissage('Piazzali'), couleurNormale);

    // avertissement dans la fiche d'une petite commune, pas dans celle d'une grande
    await page.evaluate(() => evolutionFiche('Piazzali'));
    assert.ok((await page.locator('#evolution-fiche .evolution-alerte').innerText()).includes('très sensibles'));
    await page.evaluate(() => evolutionFiche('Bastia'));
    assert.equal(await page.locator('#evolution-fiche .evolution-alerte').count(), 0);
    // le résumé précise que les classements sont limités aux communes d'au moins 100 habitants
    await page.click('#evolution-bouton-resume');
    assert.ok((await page.locator('#evolution-resume').innerText()).includes('au moins 100 habitants'));
    await page.mouse.click(400, 500);

    // Opp3 : le détail montre le drapeau et l'effectif brut ; la variante robuste change la série
    const fragile = await page.evaluate(() => Object.keys(evolutionDonnees.communes).find((c) => { const o = evolutionDonnees.communes[c]['2021'].composantes.Opp3; return o.actifs_transports > 0 && o.actifs_transports < 5; }));
    await page.evaluate((c) => evolutionFiche(c), fragile);
    await page.click('.evolution-ligne-score[data-variable="Opp3"]');
    const t = (await page.locator('#evolution-fiche').textContent()).replace(/\s+/g, ' ');
    for (const mot of ['effectif estimé', 'au moins une personne', 'très fragile']) assert.ok(t.includes(mot), mot);
    const std = await page.evaluate((c) => ({ seuil: evolutionDonnees.opp3_seuil_transports, opp: evolutionDonnees.communes[c]['2021'].scores_0_10.Opp }), fragile);
    assert.equal(std.seuil, 0);
    await page.check('#evolution-robuste');
    await page.waitForFunction(() => evolutionDonnees.opp3_seuil_transports === 5);
    const rob = await page.evaluate((c) => ({ seuil: evolutionDonnees.opp3_seuil_transports, opp: evolutionDonnees.communes[c]['2021'].scores_0_10.Opp }), fragile);
    assert.equal(rob.seuil, 5);
    assert.notEqual(rob.opp, std.opp, 'le score d\'Opp de la commune change avec la variante');
    assert.ok((await page.locator('#evolution-fiche').textContent()).includes('au moins 5 personnes'), 'fiche mise à jour avec la variante');
    // retour à la série standard
    await page.uncheck('#evolution-robuste');
    await page.waitForFunction(() => evolutionDonnees.opp3_seuil_transports === 0);
    assert.deepEqual(nouvellesErreurs().filter((m) => !/404/.test(m)), []);
  });
});
