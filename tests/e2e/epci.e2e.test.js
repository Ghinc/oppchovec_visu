'use strict';
// Onglet EPCI dans un vrai navigateur : carte des 19 EPCI, case pro rata / moyenne simple, tableau, fiche, panneau latéral masqué.
const assert = require('node:assert/strict');
const { test, avecAppli, sauter, lireJson, classeDe } = require('./helpers/contexte');

const agreg = lireJson('epci_agregation.json');

test('EPCI : 19 polygones colorés par les classes de Jenks, case pro rata / moyenne simple, tableau et fiche', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    assert.ok(await page.locator('aside').isVisible());
    await page.click('.tab-button[data-tab="epcitab"]');
    await page.waitForFunction(() => typeof epciCouche !== 'undefined' && epciCouche && document.querySelectorAll('#epci-tableau .epci-ligne').length === 19);
    assert.ok(!(await page.locator('aside').isVisible()), 'panneau latéral masqué dans l\'onglet EPCI');
    const couleurs = () => page.evaluate(() => { const o = {}; epciCouche.eachLayer((l) => { o[l._epciSiren] = l.options.fillColor; }); return o; });
    const palette = await page.evaluate(() => colorsJenks);
    const seuils = await page.evaluate(() => seuilsJenks.oppchovec);
    const valeurs = (m) => page.evaluate((m) => Object.fromEntries(Object.entries(epciResultats[m]).map(([k, v]) => [k, v.oppchovec])), m);

    // pro rata (défaut) : couleur = classe de Jenks de la valeur
    assert.ok(await page.locator('#epci-prorata').isChecked(), 'pro rata coché par défaut');
    const c1 = await couleurs(), v1 = await valeurs('prorata');
    assert.equal(Object.keys(c1).length, 19);
    for (const [siren, v] of Object.entries(v1)) assert.equal(c1[siren], palette[classeDe(v, seuils)], siren);
    const tete1 = (await page.locator('#epci-tableau .epci-ligne').first().innerText()).replace(/\s+/g, ' ');
    const meilleur = Object.entries(v1).sort((a, b) => b[1] - a[1])[0][0];
    assert.ok(tete1.includes(agreg.epci.find((e) => e.siren === meilleur).nom), 'tableau trié par valeur décroissante');

    // décoché : moyenne simple, les couleurs et le tableau changent
    await page.uncheck('#epci-prorata');
    const c2 = await couleurs(), v2 = await valeurs('simple');
    for (const [siren, v] of Object.entries(v2)) assert.equal(c2[siren], palette[classeDe(v, seuils)], siren);
    assert.notDeepEqual(c1, c2, 'les deux méthodes ne colorent pas pareil');
    assert.ok((await page.locator('#epci-methode').innerText()).includes('moyenne simple'));
    await page.check('#epci-prorata');
    assert.deepEqual(await couleurs(), c1, 'recocher revient au pro rata');

    // autre variable
    await page.selectOption('#epci-variable', 'cho');
    const seuilsCho = await page.evaluate(() => seuilsJenks.cho);
    const cc = await couleurs(), vc = await page.evaluate(() => Object.fromEntries(Object.entries(epciResultats.prorata).map(([k, v]) => [k, v.cho])));
    for (const [siren, v] of Object.entries(vc)) assert.equal(cc[siren], palette[classeDe(v, seuilsCho)], siren);
    await page.selectOption('#epci-variable', 'oppchovec');

    // fiche au clic sur une ligne du tableau
    await page.click('#epci-tableau .epci-ligne >> nth=0');
    const fiche = (await page.locator('#epci-fiche').textContent()).replace(/\s+/g, ' ');       // textContent : les en-têtes sont en majuscules à l'écran
    const e = agreg.epci.find((x) => x.siren === meilleur);
    assert.ok(fiche.includes(e.nom) && fiche.includes(`${e.nb_communes} communes`), fiche.slice(0, 200));
    for (const mot of ['Pro rata', 'Simple', 'Opp1', 'Vec4', 'pop. 2020']) assert.ok(fiche.includes(mot), mot);

    // le mode p_k de l'appli est suivi
    const avant = await valeurs('prorata');
    await page.evaluate(() => toggleModePk());
    await page.waitForTimeout(400);
    const apres = await valeurs('prorata');
    assert.notDeepEqual(avant, apres, 'changer p_k (Betti / égal) met à jour les EPCI');

    // retour à un autre onglet : le panneau revient
    await page.click('.tab-button[data-tab="opptab"]');
    assert.ok(await page.locator('aside').isVisible());
    assert.deepEqual(nouvellesErreurs().filter((m) => !/404/.test(m)), []);
  });
});

test('EPCI : clic sur une commune = détail de la commune dans l\'agrégation de son EPCI (valeurs, poids, écart)', { skip: sauter }, async () => {
  await avecAppli(async ({ page, nouvellesErreurs }) => {
    await page.click('.tab-button[data-tab="epcitab"]');
    await page.waitForFunction(() => typeof epciCoucheCommunes !== 'undefined' && epciCoucheCommunes && document.querySelectorAll('#epci-tableau .epci-ligne').length === 19);
    const texte = async () => (await page.locator('#epci-fiche').textContent()).replace(/\s+/g, ' ');
    assert.ok(!(await texte()).includes('Commune : '), 'pas de détail commune au départ');

    // clic réel sur la commune (événement Leaflet)
    await page.evaluate(() => { epciCoucheCommunes.eachLayer((l) => { if (l._epciCommune === 'Ajaccio') l.fire('click'); }); });
    let t = await texte();
    const e = agreg.epci.find((x) => x.nom.includes('Pays Ajaccien'));
    for (const mot of ['Commune : Ajaccio', e.nom, 'EPCI pro rata', 'EPCI simple', 'Poids pro rata', 'Poids simple', 'Opp1', 'Vec4', 'en moyenne simple (1 commune sur 10)']) assert.ok(t.includes(mot), mot);
    const poids = await page.evaluate(() => Math.round(1000 * epciPoids(epciDonnees.epci.find((x) => x.communes.Ajaccio), 'Cho2', true).Ajaccio) / 10);
    assert.ok(t.includes(String(poids).replace('.', ',')) , `poids ${poids} % affiché`);
    assert.ok(poids > 80, 'Ajaccio pèse plus de 80 % de son agglomération');
    assert.equal(await page.evaluate(() => epciSelection), e.siren, 'l\'EPCI de la commune est sélectionné');
    // la ligne du tableau de l'EPCI est surlignée, la commune a un contour épais
    assert.equal(await page.locator('#epci-tableau .epci-ligne.selectionne').count(), 1);
    assert.equal(await page.evaluate(() => { let w = 0; epciCoucheCommunes.eachLayer((l) => { if (l._epciCommune === 'Ajaccio') w = l.options.weight; }); return w; }), 3);

    // la valeur affichée de la commune est celle de l'appli ; la case à cocher ne change pas le détail commune mais l'EPCI
    const v = await page.evaluate(() => indicateursCommune.Ajaccio.Indicateur_Vec1);
    assert.ok(t.replace(/\s/g, '').includes(String(Math.round(v))), 'Vec1 de la commune');        // séparateur de milliers (espace insécable) ignoré

    // une autre commune du même EPCI, depuis la liste de la fiche
    await page.click('#epci-fiche .epci-lien-commune[data-commune="Alata"]');
    t = await texte();
    assert.ok(t.includes('Commune : Alata') && !t.includes('Commune : Ajaccio'));
    // clic sur un EPCI du tableau : le détail commune disparaît
    await page.click('#epci-tableau .epci-ligne >> nth=0');
    assert.ok(!(await texte()).includes('Commune : '));
    assert.deepEqual(nouvellesErreurs().filter((m) => !/404/.test(m)), []);
  });
});
