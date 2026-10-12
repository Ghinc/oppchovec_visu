'use strict';
/**
 * Pilote utilisé par tests/python/test_08_js_vs_python.py : charge l'appli (script.js réel) et renvoie sur stdout, en JSON,
 *  - l'état de base dans les deux modes p_k (indice 0-10, scores de dimension, seuils de Jenks, p_k) ;
 *  - le résultat de scénarios de modification : [{mode, commune, curseurs: {id: %}, sous: [{ind, comp, pct}]}].
 * Usage : node dump_app.js <fichier_scenarios.json>
 */
const fs = require('node:fs');
const { chargerApp, afficherCommune } = require('./helpers/outils');

const plat = (x) => JSON.parse(JSON.stringify(x));

async function main() {
  const scenarios = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const app = await chargerApp();
  const basculerVers = (mode) => { if (app.ev('modeCalculPk') !== mode) app.ev('toggleModePk()'); };
  const etat = () => ({
    indice: plat(app.ev('indiceFinale')), scores: plat(app.ev('scoresParCommune')),
    jenks: plat(app.ev('seuilsJenks.oppchovec')), pk: plat(app.ev(`referencePk(modeCalculPk).pk`)),
  });

  const sortie = { base: {}, scenarios: [], alertes: 0 };
  for (const mode of ['egal', 'betti']) { basculerVers(mode); sortie.base[mode] = etat(); }

  for (const sc of scenarios) {
    basculerVers(sc.mode);
    const { inputs } = afficherCommune(app, sc.commune);
    for (const [id, pct] of Object.entries(sc.curseurs || {})) inputs[id].value = String(pct);
    for (const s of sc.sous || []) {
      const el = inputs[`${s.ind}__${s.comp}`];
      if (s.binaire) el.checked = !!s.coche; else el.value = String(s.pct);
      app.ev(`majSousComposante(${JSON.stringify(s.ind)}, ${JSON.stringify(s.comp)})`);
    }
    app.ev(`recalculerIndice(${JSON.stringify(sc.commune)})`);
    sortie.scenarios.push({ indice: plat(app.ev('indiceFinale')), indicateurs: plat(app.ev(`indicateursCommune[${JSON.stringify(sc.commune)}]`)),
                            scores: plat(app.ev('scoresParCommune')) });
    app.ev(`reinitialiserValeurs(${JSON.stringify(sc.commune)})`);
  }
  sortie.alertes = app.appelsAlert.length;
  sortie.erreurs = app.erreursConsole;
  process.stdout.write(JSON.stringify(sortie));
}

main().catch((e) => { console.error(e); process.exit(1); });
