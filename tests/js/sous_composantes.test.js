'use strict';
// Curseurs par sous-composante : formules identiques aux données, parts d'emploi couplées, logique « brouillon puis Recalculer ».
const test = require('node:test');
const assert = require('node:assert/strict');
const { chargerApp, afficherCommune, photo, lireJson, prng } = require('./helpers/outils');

const data = lireJson('data_scores_0_10.json');
const communes = Object.keys(data);
const DECOMPOSES = { Opp3: 'Indicateur_Opp3', Opp4: 'Indicateur_Opp4', Cho1: 'Indicateur_Cho1', Vec2: 'Indicateur_Vec2', Vec3: 'Indicateur_Vec3' };
const somme = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const proche = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const plat = (x) => JSON.parse(JSON.stringify(x));   // objets du bac à sable -> objets ordinaires
const normaliser = (s) => String(s).replace(/[  ]/g, ' ');

test('chaque indicateur décomposé se recompose exactement depuis ses sous-composantes, pour les 360 communes', async () => {
  const app = await chargerApp();
  for (const [court, nom] of Object.entries(DECOMPOSES)) {
    let pire = 0;
    for (const c of communes) {
      const sc = JSON.stringify(app.ev(`sousComposantesOrigine[${JSON.stringify(c)}].${nom}`));
      pire = Math.max(pire, Math.abs(app.ev(`SOUS_COMPOSANTES.${nom}.calcul(${sc})`) - data[c][court]));
    }
    assert.ok(pire < 1e-9, `${court} : écart max ${pire}`);
  }
});

test('bornes figées des sous-composantes = min et max réels ; seule la composante « chauffage » est constante', async () => {
  const app = await chargerApp();
  const constantes = [];
  for (const [court, nom] of Object.entries(DECOMPOSES)) {
    for (const comp of Object.keys(app.ev(`SOUS_COMPOSANTES.${nom}.composantes`))) {
      const vals = communes.map((c) => app.ev(`sousComposantesOrigine[${JSON.stringify(c)}].${nom}.${comp}`));
      const b = app.ev(`bornesSousComp.${nom}.${comp}`);
      assert.equal(b.min, Math.min(...vals), `${court}.${comp} min`);
      assert.equal(b.max, Math.max(...vals), `${court}.${comp} max`);
      if (b.min === b.max) constantes.push(`${court}.${comp}`);
    }
  }
  assert.deepEqual(constantes, ['Vec2.chauffage']);
});

test('redistribuerParts : le total est conservé, aucune part négative, les autres parts gardent leurs proportions (500 tirages)', async () => {
  const app = await chargerApp();
  const alea = prng(42);
  const cles = ['stable', 'cdd', 'ponctuel', 'chomeur', 'aide'];
  for (let i = 0; i < 500; i++) {
    const brutes = cles.map(() => alea());
    const total = 100;
    const parts = Object.fromEntries(cles.map((k, j) => [k, (brutes[j] / brutes.reduce((a, b) => a + b, 0)) * total]));
    const comp = cles[Math.floor(alea() * 5)];
    const cible = alea() * 130 - 15;                                       // y compris hors de [0, 100] : doit être borné
    app.ev(`globalThis.__p = ${JSON.stringify(parts)}`);
    app.ev(`redistribuerParts(__p, ${JSON.stringify(comp)}, ${cible})`);
    const apres = app.ev('JSON.parse(JSON.stringify(__p))');
    assert.ok(proche(somme(apres), total, 1e-12), `total ${somme(apres)}`);
    assert.ok(Object.values(apres).every((v) => v >= -1e-12), 'part négative');
    assert.ok(proche(apres[comp], Math.min(Math.max(cible, 0), total), 1e-12), 'la part modifiée prend la valeur demandée (bornée)');
    const autres = cles.filter((k) => k !== comp);
    const reste = total - parts[comp];
    if (reste > 1e-9 && apres[comp] < total - 1e-9) {
      for (const k of autres) assert.ok(proche(apres[k] / (total - apres[comp]), parts[k] / reste, 1e-9), `proportion de ${k}`);
    }
  }
});

test('redistribuerParts : cas limites (autres parts nulles, part portée au total)', async () => {
  const app = await chargerApp();
  app.ev('globalThis.__p = { stable: 100, cdd: 0, ponctuel: 0, chomeur: 0, aide: 0 }');
  app.ev("redistribuerParts(__p, 'stable', 60)");
  assert.deepEqual(plat(app.ev('__p')), { stable: 60, cdd: 10, ponctuel: 10, chomeur: 10, aide: 10 });
  app.ev('globalThis.__q = { stable: 50, cdd: 30, ponctuel: 10, chomeur: 5, aide: 5 }');
  app.ev("redistribuerParts(__q, 'cdd', 100)");
  const q = plat(app.ev('__q'));
  assert.equal(q.cdd, 100);
  assert.ok(Object.entries(q).filter(([k]) => k !== 'cdd').every(([, v]) => Math.abs(v) < 1e-12));
});

test('déplacer un curseur de sous-composante met à jour la valeur affichée de l\'indicateur sans toucher aux résultats (brouillon)', async () => {
  const app = await chargerApp();
  const { inputs } = afficherCommune(app, 'Bastia');
  const avant = photo(app);
  inputs.Indicateur_Opp4__fibre.value = '0';
  app.ev("majSousComposante('Indicateur_Opp4', 'fibre')");
  // Bastia : 4G 100, débit 93, fibre 80 -> fibre minimale corse (0) => (100 + 93 + 0) / 3 = 64,333
  assert.match(normaliser(app.elements.get('Indicateur_Opp4_val').innerText), /^\d+ % de l'échelle corse · valeur : 64,3 %/);
  assert.match(normaliser(app.elements.get('Indicateur_Opp4__fibre_val').innerText), /^0 % de l'échelle corse · valeur : 0 %$/);
  assert.deepEqual(photo(app), avant, 'rien ne doit changer tant que « Recalculer » n\'est pas cliqué');
  assert.equal(app.ev("sousComposantesCommune.Bastia.Indicateur_Opp4.fibre"), 80);
});

test('« Recalculer » applique le brouillon : l\'indicateur suit sa formule, seule la commune change, « Réinitialiser » annule', async () => {
  const app = await chargerApp();
  const depart = photo(app);
  const { inputs } = afficherCommune(app, 'Bastia');
  inputs.Indicateur_Opp4__fibre.value = '0';
  app.ev("majSousComposante('Indicateur_Opp4', 'fibre')");
  app.ev("recalculerIndice('Bastia')");
  const apres = photo(app);
  assert.ok(proche(apres.ind.Bastia.Indicateur_Opp4, (100 + 93 + 0) / 3));
  assert.equal(app.ev('sousComposantesCommune.Bastia.Indicateur_Opp4.fibre'), 0);
  assert.ok(apres.indice.Bastia < depart.indice.Bastia);
  const autres = Object.keys(depart.indice).filter((c) => c !== 'Bastia' && depart.indice[c] !== apres.indice[c]);
  assert.deepEqual(autres, []);
  app.ev("reinitialiserValeurs('Bastia')");
  assert.deepEqual(photo(app), depart);
  assert.equal(app.ev('sousComposantesCommune.Bastia.Indicateur_Opp4.fibre'), 80);
});

test('un brouillon non validé est abandonné quand on affiche une autre commune', async () => {
  const app = await chargerApp();
  const depart = photo(app);
  let { inputs } = afficherCommune(app, 'Bastia');
  inputs.Indicateur_Opp4__fibre.value = '0';
  app.ev("majSousComposante('Indicateur_Opp4', 'fibre')");
  afficherCommune(app, 'Ajaccio');
  assert.equal(app.ev("brouillonSousComp.commune"), 'Ajaccio');
  inputs = afficherCommune(app, 'Bastia').inputs;
  app.ev("recalculerIndice('Bastia')");                      // Recalculer sans avoir ré-édité : rien ne doit avoir été retenu
  assert.deepEqual(photo(app), depart);
});

test('case à cocher du réseau de bus : -100 points sur Opp3 et seule la commune concernée change', async () => {
  const app = await chargerApp();
  const depart = photo(app);
  const { inputs } = afficherCommune(app, 'Bastia');
  assert.equal(inputs.Indicateur_Opp3__bus.checked, true, 'Bastia a un réseau de bus urbain');
  inputs.Indicateur_Opp3__bus.checked = false;
  app.ev("majSousComposante('Indicateur_Opp3', 'bus')");
  app.ev("recalculerIndice('Bastia')");
  const apres = photo(app);
  assert.ok(proche(apres.ind.Bastia.Indicateur_Opp3, depart.ind.Bastia.Indicateur_Opp3 - 100));
  assert.ok(apres.indice.Bastia < depart.indice.Bastia);
  assert.deepEqual(Object.keys(depart.indice).filter((c) => c !== 'Bastia' && depart.indice[c] !== apres.indice[c]), []);
});

test('parts d\'emploi : toutes les parts restent liées (somme ≈ 100) et le curseur « chauffage » constant est désactivé', async () => {
  const app = await chargerApp();
  const { inputs, html } = afficherCommune(app, 'Bastia');
  inputs.Indicateur_Vec3__stable.value = '100';
  app.ev("majSousComposante('Indicateur_Vec3', 'stable')");
  const brouillon = app.ev('JSON.parse(JSON.stringify(brouillonSousComp.valeurs.Indicateur_Vec3))');
  assert.ok(proche(somme(brouillon), somme(app.ev('JSON.parse(JSON.stringify(sousComposantesOrigine.Bastia.Indicateur_Vec3))')), 1e-12));
  assert.equal(app.ev('bornesSousComp.Indicateur_Vec3.stable.max'), 100, "au moins une commune a 100 % d'emploi stable");
  assert.ok(proche(app.ev('SOUS_COMPOSANTES.Indicateur_Vec3.calcul(brouillonSousComp.valeurs.Indicateur_Vec3)'), 1, 1e-12), "100 % d'emploi stable => Vec3 = 1");
  assert.equal(inputs.Indicateur_Vec2__chauffage.disabled, true);
  assert.match(html, /Identique pour toutes les communes corses/);
});

test("hors échelle : une modification qui dépasse le maximum corse ne déplace aucune autre commune (bornes figées)", async () => {
  const app = await chargerApp();
  const max = app.ev("bornesRef.max['Indicateur_Opp3']");
  const sansBus = (c) => !app.ev(`sousComposantesOrigine[${JSON.stringify(c)}].Indicateur_Opp3.bus`);
  // une commune sans bus dont l'Opp3 dépasserait le maximum corse une fois le bus coché (+100)
  const candidate = communes.find((c) => sansBus(c) && data[c].Opp3 + 100 > max + 1);
  assert.ok(candidate, 'aucune commune ne permet ce scénario : revoir le test');
  const depart = photo(app);
  const { inputs } = afficherCommune(app, candidate);
  inputs.Indicateur_Opp3__bus.checked = true;
  app.ev("majSousComposante('Indicateur_Opp3', 'bus')");
  app.ev(`recalculerIndice(${JSON.stringify(candidate)})`);
  const apres = photo(app);
  assert.ok(apres.ind[candidate].Indicateur_Opp3 > max, 'la valeur dépasse bien le maximum corse');
  assert.ok(app.ev(`pctDepuisValeur('Indicateur_Opp3', ${apres.ind[candidate].Indicateur_Opp3})`) > 100);
  const autres = Object.keys(depart.indice).filter((c) => c !== candidate && (depart.indice[c] !== apres.indice[c]
    || JSON.stringify(depart.sc[c]) !== JSON.stringify(apres.sc[c])));
  assert.deepEqual(autres, [], 'dépasser le maximum ne doit rien changer aux autres communes');
});
