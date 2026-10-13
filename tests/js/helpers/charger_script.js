'use strict';
/**
 * Charge le VRAI script.js (et les fichiers de données .js) dans un contexte `vm` avec un DOM / Leaflet /
 * Chart.js factices, pour tester la logique de l'appli sans navigateur.
 *
 *   const app = await chargerApp();        // équivaut à l'ouverture de la page (chargement automatique inclus)
 *   app.ev('indiceFinale["Bastia"]');      // évalue une expression dans l'espace global de l'appli
 *   app.appelsAlert                         // messages passés à alert() : doivent rester vides
 *
 * Aucun module externe : uniquement node:vm, node:fs, node:path.
 */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.resolve(__dirname, '..', '..', '..');
const WEB = path.join(RACINE, 'stage_ambroise', 'Code', 'WEB');

// Objet « universel » : appelable, constructible, propriétés infinies, itérable vide. Tout appel est un no-op.
function stubUniversel() {
  const cible = function () {};
  const proxy = new Proxy(cible, {
    get(_t, p) {
      if (p === Symbol.toPrimitive) return () => '';
      if (p === Symbol.iterator) return function* () {};
      if (p === 'then') return undefined;           // pas une promesse
      if (p === 'length') return 0;
      return proxy;
    },
    apply() { return proxy; },
    construct() { return proxy; },
    set() { return true; },
    has() { return true; },
  });
  return proxy;
}

// Élément DOM factice : relit ce qu'on y a écrit (value, innerHTML, checked, dataset...), le reste est no-op.
function fabriquerElement() {
  const stockage = { value: '', defaultValue: '', innerHTML: '', innerText: '', textContent: '', checked: false, dataset: {} };
  const universel = stubUniversel();
  const el = new Proxy(function () {}, {
    get(_t, p) {
      if (p in stockage) return stockage[p];
      if (p === 'style') return stockage.style || (stockage.style = {});
      if (p === Symbol.toPrimitive) return () => '';
      if (p === Symbol.iterator) return function* () {};
      if (p === 'then') return undefined;
      return universel[p];
    },
    set(_t, p, v) { stockage[p] = v; return true; },
    apply() { return universel; },
    has() { return true; },
  });
  return el;
}

function creerContexte() {
  const appelsAlert = [];
  const erreursConsole = [];
  const elements = new Map();
  // Comme dans un vrai navigateur, getElementById renvoie null pour un id absent de la page : ids de index.html,
  // plus ceux du HTML généré dynamiquement et déclaré via declarerIds().
  const idsStatiques = new Set([...fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  let idsDynamiques = new Set();
  const document = {
    getElementById(id) {
      if (!idsStatiques.has(id) && !idsDynamiques.has(id)) return null;
      if (!elements.has(id)) elements.set(id, fabriquerElement());
      return elements.get(id);
    },
    querySelector: () => fabriquerElement(),
    querySelectorAll: () => [],
    createElement: () => fabriquerElement(),
    addEventListener() {},
    body: fabriquerElement(),
  };
  const fenetre = {
    location: { hostname: 'localhost', pathname: '/index.html', href: 'http://localhost/index.html' },
    addEventListener() {},
    innerWidth: 1500, innerHeight: 1000,
  };
  const contexteObjet = {
    window: fenetre, document,
    L: stubUniversel(), Chart: stubUniversel(), Plotly: stubUniversel(), html2canvas: stubUniversel(),
    console: {
      log() {}, info() {}, debug() {}, warn() {},
      error: (...a) => erreursConsole.push(a.map(String).join(' ')),
    },
    alert: (m) => { appelsAlert.push(String(m)); },
    confirm: () => true,
    setTimeout: (f) => { try { f(); } catch (_) { /* animations / invalidateSize : sans objet ici */ } return 0; },
    clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0,
    localStorage: { getItem: () => null, setItem() {} },
    structuredClone, URL, Blob: stubUniversel(), Image: stubUniversel(), FileReader: stubUniversel(),
    navigator: {},
    fetch: async (url) => {
      // les URL de l'appli sont relatives à la racine du repo (BASE_PATH = 'stage_ambroise/Code/WEB/')
      const chemin = path.join(RACINE, String(url).split('?')[0]);
      if (!fs.existsSync(chemin)) return { ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' };
      const contenu = fs.readFileSync(chemin, 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(contenu), text: async () => contenu };
    },
  };
  contexteObjet.window.document = document;
  contexteObjet.globalThis = contexteObjet;
  const ctx = vm.createContext(contexteObjet);
  /** Remplace l'ensemble des ids générés dynamiquement (ex. panneau commune) par ceux présents dans `html`. */
  function declarerIds(html) {
    for (const id of idsDynamiques) elements.delete(id);
    idsDynamiques = new Set([...String(html).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  }
  return { ctx, appelsAlert, erreursConsole, elements, declarerIds };
}

/**
 * Exécute un fichier JS de l'appli dans le contexte. `const X = ...` en tête de fichier devient visible
 * des autres scripts (même portée lexicale globale), comme avec des balises <script> successives.
 */
function executer(ctx, fichier) {
  const chemin = path.isAbsolute(fichier) ? fichier : path.join(WEB, fichier);
  vm.runInContext(fs.readFileSync(chemin, 'utf8'), ctx, { filename: chemin });
}

/** Ouvre l'appli : mêmes scripts que index.html, même ordre, puis le chargement automatique. */
async function chargerApp({ chargementAuto = true } = {}) {
  const base = creerContexte();
  const { ctx } = base;
  for (const f of ['cah_data.js', 'lisa_data.js', 'lisa_data_1pct.js', 'lisa_data_betti.js', 'lisa_data_betti_1pct.js', 'vec1_variante.js', 'script.js']) {
    executer(ctx, f);
  }
  const ev = (expr) => vm.runInContext(expr, ctx);
  if (chargementAuto) await ev('chargerFichiersAutomatiquement()');
  return { ...base, ev, executer: (f) => executer(ctx, f), RACINE, WEB };
}

module.exports = { chargerApp, RACINE, WEB };
