'use strict';
// Onglet Évolution : fonctions de calcul sur serie_temporelle.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { lireJson, WEB } = require('./helpers/outils');
const { evolutionCalcul, evolutionDetails, evolutionComposantes, evolutionClasse, evolutionCouleursVariation, evolutionValeur, evolutionVariation, evolutionResume, EVOLUTION_SEUILS_VARIATION, EVOLUTION_NEUTRE } = require(path.join(WEB, 'evolution.js'));

const d = lireJson('serie_temporelle.json');
const noms = Object.keys(d.communes);

test('classes : valeur égale au seuil = classe inférieure ; classes de variation symétriques autour de 0', () => {
  assert.equal(evolutionClasse(1, [1, 2, 3]), 0);
  assert.equal(evolutionClasse(1.0001, [1, 2, 3]), 1);
  assert.equal(evolutionClasse(99, [1, 2, 3]), 3);
  assert.deepEqual(EVOLUTION_SEUILS_VARIATION, [-1.5, -0.5, 0.5, 1.5]);
  assert.equal(evolutionClasse(0, EVOLUTION_SEUILS_VARIATION), 2);          // stable
  assert.equal(evolutionClasse(-2, EVOLUTION_SEUILS_VARIATION), 0);         // recul fort
  assert.equal(evolutionClasse(2, EVOLUTION_SEUILS_VARIATION), 4);          // progression forte
});

test('le fichier couvre 360 communes et 2 années ; scores dans [0, 10] ; variation = 2021 - 2016', () => {
  assert.equal(noms.length, 360);
  assert.deepEqual(d.annees, [2016, 2021]);
  for (const c of noms) {
    for (const a of d.annees) for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) {
      const x = evolutionValeur(d, c, a, v);
      assert.ok(x >= -1e-9 && x <= 10 + 1e-9, `${c} ${a} ${v} = ${x}`);
    }
    assert.ok(Math.abs(evolutionVariation(d, c, 'OppChoVec') - (d.communes[c]['2021'].scores_0_10.OppChoVec - d.communes[c]['2016'].scores_0_10.OppChoVec)) < 1e-12);
  }
});

test('échelle commune : les deux années ensemble couvrent exactement 0 et 10 pour chaque variable', () => {
  for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) {
    const tout = noms.flatMap((c) => d.annees.map((a) => evolutionValeur(d, c, a, v)));
    assert.ok(Math.abs(Math.min(...tout)) < 1e-9, `${v} min`);
    assert.ok(Math.abs(Math.max(...tout) - 10) < 1e-9, `${v} max`);
  }
});

test('résumé : effectifs cohérents et classement des plus fortes variations', () => {
  const r = evolutionResume(d, 'OppChoVec');
  assert.equal(r.progressions + r.stables + r.reculs, 360);
  assert.ok(Math.abs(r.moyenne1 - r.moyenne0 - r.variationMoyenne) < 1e-12);
  const tri = noms.map((c) => ({ c, v: evolutionVariation(d, c, 'OppChoVec') })).sort((a, b) => b.v - a.v);
  assert.deepEqual(r.meilleures.map((e) => e.commune), tri.slice(0, 5).map((e) => e.c));
  assert.deepEqual(r.pires.map((e) => e.commune), tri.slice(-5).reverse().map((e) => e.c));
  assert.ok(r.meilleures[0].variation >= r.meilleures[4].variation);
});

test('carte d\'évolution : la classe de Jenks qui contient 0 est neutre, rouge en dessous, bleu au-dessus', () => {
  const ROUGE = /^#(b2182b|d6604d|ef8a62|f6b79a)$/, BLEU = /^#(9ecae1|a6cee3|6baed6|3182bd|08519c|4393c3|67a9cf|2166ac)$/;
  for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) {
    const s = d.seuils_jenks_variation[v];
    assert.equal(s.length, 4);
    for (let i = 1; i < 4; i++) assert.ok(s[i] > s[i - 1], v);
    const couleurs = evolutionCouleursVariation(s);
    assert.equal(couleurs.length, 5, v);
    const zero = evolutionClasse(0, s);
    assert.equal(couleurs[zero], EVOLUTION_NEUTRE, `${v} : la classe de 0 est neutre`);
    couleurs.forEach((c, i) => { if (i < zero) assert.match(c, ROUGE, `${v} classe ${i}`); if (i > zero) assert.match(c, BLEU, `${v} classe ${i}`); });
    assert.equal(new Set(couleurs).size, 5, `${v} : 5 couleurs distinctes`);
    // une commune qui recule n'est jamais colorée en bleu, une commune qui progresse jamais en rouge
    for (const c of noms) {
      const x = evolutionVariation(d, c, v), col = couleurs[evolutionClasse(x, s)];
      if (x < 0) assert.ok(!BLEU.test(col), `${v} ${c} ${x}`);
      if (x > 0) assert.ok(!ROUGE.test(col), `${v} ${c} ${x}`);
    }
  }
  // cas général : zéro dans la 1re ou la dernière classe, ou dans la classe du milieu
  assert.deepEqual(evolutionCouleursVariation([1, 2, 3, 4]).slice(0, 1), [EVOLUTION_NEUTRE]);
  assert.equal(evolutionCouleursVariation([-4, -3, -2, -1]).at(-1), EVOLUTION_NEUTRE);
});

test('seuils de Jenks : 4 seuils croissants par variable', () => {
  for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) {
    const s = d.seuils_jenks[v];
    assert.equal(s.length, 4);
    for (let i = 1; i < 4; i++) assert.ok(s[i] > s[i - 1], v);
  }
});

test('détail du calcul : retrouve exactement les scores du fichier, et les contributions s\'additionnent à l\'évolution', () => {
  for (const c of noms) {
    const det = evolutionDetails(d, c);
    const s16 = d.communes[c]['2016'].scores_0_10, s21 = d.communes[c]['2021'].scores_0_10;
    assert.ok(Math.abs(det.indice.score0 - s16.OppChoVec) < 1e-9, `${c} indice 2016`);
    assert.ok(Math.abs(det.indice.score1 - s21.OppChoVec) < 1e-9, `${c} indice 2021`);
    let sommeContrib = 0;
    for (const dim of det.dimensions) {
      assert.ok(Math.abs(dim.score0 - s16[dim.nom]) < 1e-9, `${c} ${dim.nom} 2016`);
      assert.ok(Math.abs(dim.score1 - s21[dim.nom]) < 1e-9, `${c} ${dim.nom} 2021`);
      // dimension : somme des contributions des indicateurs = variation du score de la dimension (points sur 10)
      const somme = dim.indicateurs.reduce((t, i) => t + i.contributionPoints, 0);
      assert.ok(Math.abs(somme - (dim.score1 - dim.score0)) < 1e-9, `${c} ${dim.nom} contributions`);
      sommeContrib += dim.contributionSomme;
    }
    // indice : somme des contributions des dimensions = variation de S
    assert.ok(Math.abs(sommeContrib - (det.indice.somme1 - det.indice.somme0)) < 1e-12, `${c} variation de S`);
  }
  const x = evolutionCalcul(d, noms[0], 2016);
  for (const k of d.indicateurs) assert.ok(x.norm[k] >= -1e-12 && x.norm[k] <= 1 + 1e-12, k);
});

test('composantes d\'un indicateur : les contributions s\'additionnent à l\'écart de l\'indicateur et retrouvent sa valeur', () => {
  for (const c of noms) {
    for (const k of d.indicateurs) {
      const x = evolutionComposantes(d, c, k);
      const ecart = d.communes[c]['2021'].indicateurs[k] - d.communes[c]['2016'].indicateurs[k];
      assert.ok(Math.abs(x.total.v0 - d.communes[c]['2016'].indicateurs[k]) < 1e-12 && Math.abs(x.total.v1 - d.communes[c]['2021'].indicateurs[k]) < 1e-12, `${c} ${k} valeurs`);
      if (x.lignes.some(l => l.contribution !== null)) {      // Vec1 : lignes d'information (foyers, revenu total), sans contribution
        const somme = x.lignes.reduce((t, l) => t + (l.contribution ?? 0), 0);
        const tol = Math.max(1e-4, 1e-5 * Math.abs(ecart));      // composantes arrondies à 6 décimales dans le fichier
        assert.ok(Math.abs(somme - ecart) < tol, `${c} ${k} : somme des contributions ${somme} ≠ écart ${ecart}`);
      }
      assert.ok(x.intro.length > 20, k);
    }
  }
});

test('fiabilité : habitants de la série, classements limités aux communes d\'au moins 100 habitants (les très petites communes ne dominent plus les listes)', () => {
  const { evolutionHabitants, EVOLUTION_SEUIL_FIABLE } = require(path.join(WEB, 'evolution.js'));
  assert.equal(EVOLUTION_SEUIL_FIABLE, 100);
  const agreg = lireJson('epci_agregation.json');          // population municipale officielle 2021 (INSEE, séries historiques)
  const pop2021 = Object.fromEntries(agreg.epci.flatMap((e) => Object.entries(e.communes).map(([n, c]) => [n, c.pop_annee['2021']])));
  for (const c of noms) assert.ok(Math.abs(evolutionHabitants(d, c) - pop2021[c]) < 0.51, c);
  const tous = evolutionResume(d, 'OppChoVec');
  const filtre = evolutionResume(d, 'OppChoVec', 100);
  assert.equal(tous.nbExclues, 0);
  assert.equal(filtre.nbExclues, noms.filter((c) => evolutionHabitants(d, c) < 100).length);
  assert.ok(filtre.nbExclues > 100);
  for (const e of [...filtre.meilleures, ...filtre.pires]) assert.ok(evolutionHabitants(d, e.commune) >= 100, e.commune);
  // les moyennes et effectifs portent toujours sur les 360 communes
  assert.equal(filtre.n, 360);
  assert.ok(Math.abs(filtre.moyenne1 - tous.moyenne1) < 1e-12 && filtre.progressions === tous.progressions);
  // sans le filtre, les plus gros écarts sont des communes minuscules
  assert.ok([...tous.meilleures, ...tous.pires].some((e) => evolutionHabitants(d, e.commune) < 100));
});

test('Opp3 : le détail montre le drapeau, son critère (seuil) et l\'effectif brut ; variante robuste = seuil de 5 personnes', () => {
  const rob = lireJson('serie_temporelle_robuste.json');
  const std = evolutionComposantes(d, 'Piazzali', 'Opp3'), r = evolutionComposantes(rob, 'Piazzali', 'Opp3');
  assert.match(std.intro, /au moins une personne/);
  assert.match(r.intro, /au moins 5 personnes/);
  const eff = std.lignes.find((l) => l.libelle.includes('effectif estimé'));
  assert.ok(eff && eff.contribution === null, 'ligne d\'information sans contribution');
  assert.equal(eff.v0, d.communes.Piazzali['2016'].composantes.Opp3.actifs_transports);
  assert.match(std.note, /99 % de la variance/);
  // une commune au drapeau fragile : effectif entre 0 et 5 -> mention de la variante
  const fragile = noms.find((c) => { const o = d.communes[c]['2021'].composantes.Opp3; return o.actifs_transports > 0 && o.actifs_transports < 5; });
  assert.match(evolutionComposantes(d, fragile, 'Opp3').note, /très fragile/);
  assert.doesNotMatch(evolutionComposantes(rob, fragile, 'Opp3').note, /très fragile/);
});

test('série EPCI : un « EPCI » d\'une seule commune retrouve exactement les scores de la commune (mêmes bornes, mêmes p_k) ; moyenne simple et pro rata à la main', () => {
  const { evolutionSerieEPCI, evolutionEchellesScores } = require(path.join(WEB, 'evolution.js'));
  const agreg = lireJson('epci_agregation.json');
  const un = (nom) => [{ siren: 'X', nom: 'Seul', communes: { [nom]: {} } }];
  for (const prorata of [true, false]) {
    for (const commune of ['Afa', 'Ajaccio', 'Piazzali']) {
      const e = evolutionSerieEPCI(d, un(commune), prorata).communes.Seul;
      for (const a of ['2016', '2021']) {
        for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) assert.ok(Math.abs(e[a].scores_0_10[v] - d.communes[commune][a].scores_0_10[v]) < 1e-9, `${commune} ${a} ${v}`);
        for (const k of d.indicateurs) assert.ok(Math.abs(e[a].indicateurs[k] - d.communes[commune][a].indicateurs[k]) < 1e-9);
      }
    }
  }
  // EPCI réels : 19, scores finis, population de l'année en pondération, bornes des communes conservées
  const pop = evolutionSerieEPCI(d, agreg.epci, true), sim = evolutionSerieEPCI(d, agreg.epci, false);
  assert.equal(Object.keys(pop.communes).length, 19);
  assert.deepEqual(pop.echelles_scores, evolutionEchellesScores(d));
  assert.equal(pop.unite, 'epci');
  const e = agreg.epci.find((x) => x.nom.includes('Pays Ajaccien'));
  for (const a of ['2016', '2021']) {
    const h = Object.keys(e.communes).map((n) => d.communes[n][a].composantes.Cho2.population);
    const tot = h.reduce((t, x) => t + x, 0);
    const attenduPop = Object.keys(e.communes).reduce((t, n, i) => t + h[i] * d.communes[n][a].indicateurs.Vec2, 0) / tot;       // population DE L'ANNÉE
    const attenduSimple = Object.keys(e.communes).reduce((t, n) => t + d.communes[n][a].indicateurs.Vec2, 0) / Object.keys(e.communes).length;
    assert.ok(Math.abs(pop.communes[e.nom][a].indicateurs.Vec2 - attenduPop) < 1e-12, `pro rata ${a}`);
    assert.ok(Math.abs(sim.communes[e.nom][a].indicateurs.Vec2 - attenduSimple) < 1e-12, `simple ${a}`);
    assert.ok(Math.abs(pop.communes[e.nom][a].composantes.Cho2.population - tot) < 1e-9);
  }
  for (const s of [pop, sim]) for (const c of Object.values(s.communes)) for (const a of ['2016', '2021']) for (const v of ['OppChoVec', 'Opp', 'Cho', 'Vec']) assert.ok(Number.isFinite(c[a].scores_0_10[v]), v);
  // le détail du calcul fonctionne sur la série EPCI : les contributions des indicateurs somment l'évolution de la dimension
  for (const nom of Object.keys(pop.communes)) {
    const det = evolutionDetails(pop, nom);
    for (const dim of det.dimensions) assert.ok(Math.abs(dim.indicateurs.reduce((t, i) => t + i.contributionPoints, 0) - (dim.score1 - dim.score0)) < 1e-9, `${nom} ${dim.nom}`);
    assert.ok(Math.abs(det.indice.score1 - pop.communes[nom]['2021'].scores_0_10.OppChoVec) < 1e-9 && Math.abs(det.indice.score0 - pop.communes[nom]['2016'].scores_0_10.OppChoVec) < 1e-9);
  }
  // les évolutions des EPCI sont plus faibles que celles des communes (moyennes) mais gardent le signe de l'ensemble
  const ecart = (s) => Object.values(s.communes).map((c) => c['2021'].scores_0_10.OppChoVec - c['2016'].scores_0_10.OppChoVec);
  assert.ok(Math.max(...ecart(pop).map(Math.abs)) < 2.5);
});

// ---------- Fenêtre « Toute la Corse » : vue d'ensemble, variables discriminantes et explicatives, courbes ----------
const { evolutionVueGlobale, evolutionCourbes, evolutionCourbesSvg, evolutionCorrelation, evolutionEcartType, EVOLUTION_SEUIL_STABLE, EVOLUTION_FORMAT_INDICATEURS } = require(path.join(WEB, 'evolution.js'));

test('vue d\'ensemble : une ligne par indicateur (10), par dimension (3) et pour l\'indice ; effectifs = 360 communes', () => {
  for (const ponderer of [false, true]) {
    const v = evolutionVueGlobale(d, ponderer);
    assert.equal(v.n, 360);
    assert.equal(v.indicateurs.length, 10);
    assert.deepEqual(v.indicateurs.map((r) => r.cle), d.indicateurs);
    assert.deepEqual(v.dimensions.map((r) => r.cle), Object.keys(d.dimensions));
    for (const r of [v.indice, ...v.dimensions, ...v.indicateurs]) assert.equal(r.hausses + r.stables + r.baisses, 360, r.cle);
    for (const k of d.indicateurs) assert.ok(EVOLUTION_FORMAT_INDICATEURS[k], `format de ${k}`);
  }
});

test('vue d\'ensemble : la somme des contributions des indicateurs d\'une dimension est exactement la variation du score de cette dimension', () => {
  for (const ponderer of [false, true]) {
    const v = evolutionVueGlobale(d, ponderer);
    for (const dim of v.dimensions) {
      const somme = v.indicateurs.filter((r) => r.dimension === dim.cle).reduce((s, r) => s + r.contribution, 0);
      assert.ok(Math.abs(somme - dim.variation) < 1e-9, `${dim.cle} (pondéré : ${ponderer}) : ${somme} contre ${dim.variation}`);
    }
  }
});

test('vue d\'ensemble : moyennes, variations et échelles recalculées à la main', () => {
  const v = evolutionVueGlobale(d, false);
  for (const r of v.indicateurs) {
    const m = (a) => noms.reduce((s, c) => s + d.communes[c][String(a)].indicateurs[r.cle], 0) / 360;
    assert.ok(Math.abs(r.moyenne0 - m(2016)) < 1e-9 * Math.max(1, Math.abs(r.moyenne0)), r.cle);
    assert.ok(Math.abs(r.moyenne1 - m(2021)) < 1e-9 * Math.max(1, Math.abs(r.moyenne1)), r.cle);
    assert.ok(Math.abs(r.variation - (r.moyenne1 - r.moyenne0)) < 1e-9 * Math.max(1, Math.abs(r.moyenne0)), r.cle);
    assert.deepEqual(r.echelle, d.echelle[r.cle]);
    const [lo, hi] = r.echelle;
    assert.ok(Math.abs(r.variationEchelle - r.variation / (hi - lo) * 100) < 1e-9, r.cle);
    const stables = noms.filter((c) => Math.abs((d.communes[c]['2021'].indicateurs[r.cle] - d.communes[c]['2016'].indicateurs[r.cle]) / (hi - lo) * 100) <= EVOLUTION_SEUIL_STABLE).length;
    assert.equal(r.stables, stables, r.cle);
  }
  const iv = v.indice;
  assert.ok(Math.abs(iv.moyenne1 - iv.moyenne0 - iv.variation) < 1e-12);
});

test('vue d\'ensemble : la pondération par la population change les moyennes, pas les effectifs, les dispersions ni les corrélations', () => {
  const a = evolutionVueGlobale(d, false), b = evolutionVueGlobale(d, true);
  const popu = (c, an) => d.communes[c][String(an)].composantes.Cho2.population;
  const attendu = noms.reduce((s, c) => s + popu(c, 2021) * d.communes[c]['2021'].indicateurs.Vec1, 0) / noms.reduce((s, c) => s + popu(c, 2021), 0);
  const vec1 = b.indicateurs.find((r) => r.cle === 'Vec1');
  assert.ok(Math.abs(vec1.moyenne1 - attendu) < 1e-6, 'moyenne pondérée de Vec1 en 2021');
  assert.notEqual(vec1.moyenne1, a.indicateurs.find((r) => r.cle === 'Vec1').moyenne1);
  a.indicateurs.forEach((r, i) => {
    assert.equal(r.hausses, b.indicateurs[i].hausses);
    assert.equal(r.dispersion, b.indicateurs[i].dispersion);
    assert.ok(Object.is(r.lien, b.indicateurs[i].lien) || r.lien === b.indicateurs[i].lien);
  });
});

test('vue d\'ensemble : dispersion positive, corrélations dans [-1, 1] ; Opp4 (connectivité) est l\'indicateur qui monte le plus sur l\'échelle', () => {
  const v = evolutionVueGlobale(d, false);
  for (const r of v.indicateurs) {
    assert.ok(r.dispersion >= 0, r.cle);
    assert.ok(Number.isNaN(r.lien) || (r.lien >= -1 - 1e-12 && r.lien <= 1 + 1e-12), `${r.cle} : ${r.lien}`);
  }
  const plusFort = [...v.indicateurs].sort((x, y) => y.variationEchelle - x.variationEchelle)[0];
  assert.equal(plusFort.cle, 'Opp4');
});

test('corrélation et écart-type : cas simples', () => {
  assert.ok(Math.abs(evolutionCorrelation([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12);
  assert.ok(Math.abs(evolutionCorrelation([1, 2, 3, 4], [8, 6, 4, 2]) + 1) < 1e-12);
  assert.ok(Number.isNaN(evolutionCorrelation([1, 1, 1], [1, 2, 3])));
  assert.ok(Math.abs(evolutionEcartType([2, 4, 4, 4, 5, 5, 7, 9]) - 2) < 1e-12);
});

test('courbes : une valeur par année de la série et par variable, moyenne Corse et commune choisie', () => {
  const c = evolutionCourbes(d, 'Ajaccio', false);
  assert.deepEqual(c.map((x) => x.variable), ['OppChoVec', 'Opp', 'Cho', 'Vec']);
  for (const x of c) {
    assert.deepEqual(x.corse.map((p) => p.annee), d.annees);
    assert.deepEqual(x.unite.map((p) => p.annee), d.annees);
    const moyenne2021 = noms.reduce((s, n) => s + evolutionValeur(d, n, 2021, x.variable), 0) / 360;
    assert.ok(Math.abs(x.corse[1].valeur - moyenne2021) < 1e-12, x.variable);
    assert.equal(x.unite[1].valeur, evolutionValeur(d, 'Ajaccio', 2021, x.variable));
    assert.equal(x.nomUnite, 'Ajaccio');
  }
  assert.equal(evolutionCourbes(d, null, false)[0].unite, null);
  assert.equal(evolutionCourbes(d, 'Commune inexistante', false)[0].unite, null);
});

test('courbes : le dessin s\'adapte à un nombre quelconque d\'années', () => {
  const trois = JSON.parse(JSON.stringify(d));
  trois.annees = [2016, 2021, 2024];
  for (const n of noms) trois.communes[n]['2024'] = JSON.parse(JSON.stringify(trois.communes[n]['2021']));
  const c = evolutionCourbes(trois, null, false);
  for (const x of c) assert.equal(x.corse.length, 3);
  const svg = evolutionCourbesSvg(c);
  assert.match(svg, /^<svg class="evolution-courbes"[^>]*role="img"/);
  assert.equal((svg.match(/<path /g) || []).length, 4, 'une ligne par variable');
  assert.equal((svg.match(/<circle /g) || []).length, 12, 'un point par variable et par année');
  for (const a of [2016, 2021, 2024]) assert.ok(svg.includes(`>${a}</text>`), `année ${a}`);
});
