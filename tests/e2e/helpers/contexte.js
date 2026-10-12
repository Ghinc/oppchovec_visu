'use strict';
/**
 * Amorçage commun des fichiers e2e : serveur + navigateur (un par fichier de test), données de référence, petits utilitaires.
 * Usage dans un fichier .e2e.test.js :
 *   const { test, avecAppli, sauter, data, communes, ... } = require('./helpers/contexte');
 */
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { demarrerServeur, disponibilite, ouvrirAppli, RACINE } = require('./navigateur');

const WEB = path.join(RACINE, 'stage_ambroise', 'Code', 'WEB');
const lireJson = (n) => JSON.parse(fs.readFileSync(path.join(WEB, n), 'utf8'));
const lireConstJs = (n, c) => JSON.parse(new RegExp(`const ${c} = (\\{[\\s\\S]*?\\n\\});`).exec(fs.readFileSync(path.join(WEB, n), 'utf8'))[1]);
const normaliser = (s) => String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const proche = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

const data = lireJson('data_scores_0_10.json');
const communes = Object.keys(data);
const dispo = disponibilite();
const sauter = dispo.ok ? false : `e2e ignorés : ${dispo.raison}`;

let serveur;
let navigateur;
test.before(async () => {
  if (!dispo.ok) return;
  serveur = await demarrerServeur();
  navigateur = await dispo.playwright.chromium.launch({ executablePath: dispo.exe });
});
test.after(async () => {
  if (navigateur) await navigateur.close();
  if (serveur) await serveur.fermer();
});

/** Ouvre l'appli, exécute `corps(appli)`, ferme la page. */
async function avecAppli(corps) {
  const appli = await ouvrirAppli(navigateur, serveur.url);
  try { await corps(appli); } finally { await appli.page.close(); }
}

// Évalué dans la page : couleur de remplissage de chaque commune d'une carte
const couleursCarte = (type) => `(() => { const o = {}; geojsonLayers[${JSON.stringify(type)}].eachLayer(l => { o[l.feature.properties.nom] = l.options.fillColor; }); return o; })()`;
// Convention de l'appli : valeur <= seuil => classe inférieure
const classeDe = (valeur, seuils) => { for (let i = 1; i < seuils.length - 1; i++) if (valeur <= seuils[i]) return i - 1; return seuils.length - 2; };
const comptes = (liste) => liste.reduce((o, x) => { o[x] = (o[x] || 0) + 1; return o; }, {});

module.exports = { test, avecAppli, sauter, data, communes, lireJson, lireConstJs, normaliser, proche, couleursCarte, classeDe, comptes, WEB, RACINE };
