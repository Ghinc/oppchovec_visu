'use strict';
/** Utilitaires partagés par les tests JS : lecture des données, simulation du DOM des curseurs, générateur pseudo-aléatoire. */
const fs = require('node:fs');
const path = require('node:path');
const { chargerApp, WEB, RACINE } = require('./charger_script');

const lireJson = (nom) => JSON.parse(fs.readFileSync(path.join(WEB, nom), 'utf8'));

/** Lit une constante `const X = {...};` d'un fichier de données JS (LISA, CAH). */
function lireConstJs(nom, constante) {
  const texte = fs.readFileSync(path.join(WEB, nom), 'utf8');
  const m = new RegExp(`const ${constante} = (\\{[\\s\\S]*?\\n\\});`).exec(texte);
  return JSON.parse(m[1]);
}

const INDICATEURS = ['Opp1', 'Opp2', 'Opp3', 'Opp4', 'Cho1', 'Cho2', 'Vec1', 'Vec2', 'Vec3', 'Vec4'];

/** mulberry32 : générateur déterministe (graine entière) -> nombres dans [0, 1[. */
function prng(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Affiche une commune puis recrée dans le DOM factice les <input> présents dans le HTML produit par afficherCommune,
 * avec leurs attributs (value, data-brut, min, max, checked, disabled) : même point de départ que dans le navigateur.
 */
function afficherCommune(app, nom) {
  app.ev(`afficherCommune(${JSON.stringify(nom)})`);
  const html = String(app.elements.get('resultCommune').innerHTML);
  app.declarerIds(html);                       // les ids du panneau n'existent dans la page qu'à partir de maintenant
  const inputs = {};
  for (const m of html.matchAll(/<input\b([^>]*)>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    if (!attrs.id) continue;
    const el = app.ev(`document.getElementById(${JSON.stringify(attrs.id)})`);
    el.value = attrs.value ?? '';
    el.defaultValue = attrs.value ?? '';
    el.dataset = attrs['data-brut'] !== undefined ? { brut: attrs['data-brut'] } : {};
    el.min = attrs.min; el.max = attrs.max;
    el.checked = /\bchecked\b/.test(m[1]);
    el.disabled = /\bdisabled\b/.test(m[1]);
    inputs[attrs.id] = el;
  }
  return { html, inputs };
}

/** Photographie des résultats courants (copie profonde) pour comparer avant / après. */
const photo = (app) => JSON.parse(app.ev('JSON.stringify({ indice: indiceFinale, ind: indicateursCommune, sc: scoresParCommune })'));

module.exports = { chargerApp, lireJson, lireConstJs, INDICATEURS, prng, afficherCommune, photo, WEB, RACINE };
