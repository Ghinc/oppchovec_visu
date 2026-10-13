'use strict';
/** Pilote de tests/python/test_11_variante_vec1.py : affiche en JSON la comparaison des deux sources de Vec1 calculée par l'appli (vec1_variante.js). */
const { chargerApp } = require('./helpers/outils');

(async () => {
  const app = await chargerApp();
  const sortie = {};
  for (const mode of ['betti', 'egal']) sortie[mode] = JSON.parse(app.ev(`JSON.stringify(comparerSourcesVec1('${mode}'))`));
  process.stdout.write(JSON.stringify(sortie));
})();
