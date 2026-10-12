'use strict';
/**
 * Utilitaires e2e : serveur statique sans dépendance, détection de Chromium, ouverture de la page avec collecte des erreurs.
 * Dépendance : playwright-core (tests/package.json) + un Chromium déjà installé (cache Playwright ou variable CHROME_PATH).
 * Sans l'un des deux, les tests e2e sont ignorés (et le disent), jamais en échec.
 */
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RACINE = path.resolve(__dirname, '..', '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.geojson': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

function demarrerServeur(racine = RACINE) {
  const serveur = http.createServer((req, res) => {
    const chemin = path.join(racine, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!chemin.startsWith(racine) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) {
      res.writeHead(404); res.end('404'); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(chemin)] || 'application/octet-stream' });
    fs.createReadStream(chemin).pipe(res);
  });
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok({
    url: `http://127.0.0.1:${serveur.address().port}`, fermer: () => new Promise((f) => serveur.close(f)),
  })));
}

function trouverChromium() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const caches = [process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright'), path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')].filter(Boolean);
  for (const cache of caches) {
    if (!fs.existsSync(cache)) continue;
    const dossiers = fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
    for (const d of dossiers) {
      for (const sous of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(cache, d, sous);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

function disponibilite() {
  let playwright = null;
  try { playwright = require('playwright-core'); } catch (_) { return { ok: false, raison: 'playwright-core non installé (cd tests && npm install)' }; }
  const exe = trouverChromium();
  if (!exe) return { ok: false, raison: 'aucun Chromium trouvé (installer via playwright, ou définir CHROME_PATH)' };
  return { ok: true, playwright, exe };
}

// Erreurs de page déjà présentes avant les tests (documentées dans tests/README.md) : tout le reste est une régression.
const ERREURS_CONNUES = [
  /Cannot read properties of null \(reading 'addEventListener'\)/,   // reliquat de l'onglet « Numbered » (script.js, fin de fichier)
];
const REQUETES_IGNOREES = [/favicon\.ico/];

/** Ouvre la page de l'appli et attend qu'elle soit entièrement initialisée. Renvoie {page, erreurs, alertes}. */
async function ouvrirAppli(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const etat = { page, erreurs: [], alertes: [], requetesEchouees: [] };
  page.on('pageerror', (e) => etat.erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) etat.erreurs.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !REQUETES_IGNOREES.some((re) => re.test(r.url()))) etat.requetesEchouees.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => { if (!REQUETES_IGNOREES.some((re) => re.test(r.url()))) etat.requetesEchouees.push(`échec ${r.url()}`); });
  page.on('dialog', async (d) => { etat.alertes.push(d.message()); await d.accept(); });
  await page.goto(`${baseUrl}/index.html`);
  // Échec immédiat (et non après 90 s) si une erreur fatale inconnue empêche l'initialisation : ex. erreur de syntaxe dans script.js
  const erreurFatale = new Promise((_, rejeter) => {
    const verifier = () => {
      const inconnues = etat.erreurs.filter((e) => !ERREURS_CONNUES.some((re) => re.test(e)));
      if (inconnues.length) rejeter(new Error(`erreur de page pendant l'initialisation : ${inconnues[0]}`));
    };
    verifier();                         // erreurs survenues pendant le chargement (page.goto) : l'écouteur ci-dessus les a déjà notées
    page.on('pageerror', verifier);
  });
  const initialisee = page.waitForFunction(() => typeof L !== 'undefined' && typeof Chart !== 'undefined' && typeof bornesRef !== 'undefined' && bornesRef
    && Object.keys(indiceFinale).length === 360 && Object.keys(sousComposantesOrigine).length === 360
    && typeof geojsonLayers !== 'undefined' && geojsonLayers['oppchovec'], null, { timeout: 90000 });
  initialisee.catch(() => {});             // si l'erreur fatale gagne la course, l'attente abandonnée ne doit pas devenir une rejection orpheline
  await Promise.race([initialisee, erreurFatale]);
  etat.nouvellesErreurs = () => etat.erreurs.filter((e) => !ERREURS_CONNUES.some((re) => re.test(e)));
  return etat;
}

module.exports = { demarrerServeur, disponibilite, ouvrirAppli, ERREURS_CONNUES, RACINE };
