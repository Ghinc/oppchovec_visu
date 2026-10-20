'use strict';
/**
 * Comparaison A/B de la version « démo » (branche courante) avec la branche de référence (outil de recherche).
 * Aucun fichier du dépôt n'est modifié : la branche de référence est extraite dans un dossier temporaire (git worktree),
 * puis supprimée.
 *
 *   node tests/demo/comparer_branches.js [branche_de_reference]      (défaut : visu_corse_simple)
 *
 * Ce qui est comparé, pour les 4 cartes (OppChoVec, Opp, Cho, Vec) :
 *   1. fichiers modifiés entre les deux branches : aucun fichier de données, aucun téléchargement ;
 *   2. données calculées par l'appli : indicateurs, scores de dimension, indice, seuils de Jenks, p_k ;
 *   3. rendu : couleur et style de chacune des 360 communes, contenu de chaque bulle (popup), légendes ;
 *   4. image de chaque carte (capture, pixel pour pixel) ;
 *   5. fiche commune (texte) pour 5 communes, puis après modification d'un curseur et recalcul ;
 *   6. fichiers téléchargeables : octet pour octet.
 * La référence est ouverte avec « English labels » décoché (français), la démo est en français d'office.
 * Code de sortie : 0 si tout est identique, 1 sinon.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { demarrerServeur, disponibilite, ouvrirAppli, RACINE } = require('../e2e/helpers/navigateur');

const REF = process.argv[2] || 'visu_corse_simple';
const CARTES = [['oppchovectab', 'oppchovec'], ['opptab', 'opp'], ['chotab', 'cho'], ['vectab', 'vec']];
const COMMUNES_FICHE = ['Bastia', 'Ajaccio', 'Afa', 'Érone', 'Propriano'];
// Libellé volontairement modifié dans la démo (« 87 % · 96,4 % » -> « 96,4 % · 87 % entre le plus bas et le plus haut de Corse ») : on le ramène à l'ancien format
// avant de comparer, pour que le reste de la fiche soit vérifié à l'identique.
const ancienLibelle = (t) => t.replace(/(\S+(?: \S+)*?) · (\d+) % entre le plus bas et le plus haut de Corse/g, '$2 % · $1');
const git = (...args) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 28 });
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
const resultats = [];
const verifier = (nom, ok, detail = '') => { resultats.push({ nom, ok, detail }); console.log(`  ${ok ? 'ok    ' : 'ÉCART '} ${nom}${ok ? '' : ' — ' + detail}`); };

// Premier écart entre deux valeurs JSON (chemin + valeurs), pour des messages exploitables
function premierEcart(a, b, chemin = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const e = premierEcart(a[k], b[k], `${chemin}.${k}`);
      if (e) return e;
    }
  }
  return `${chemin} : référence=${JSON.stringify(a)?.slice(0, 120)} démo=${JSON.stringify(b)?.slice(0, 120)}`;
}
function nbEcarts(a, b) {
  let n = 0;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) n++;
  return n;
}


// Décodeur PNG minimal (8 bits, non entrelacé, RVB ou RVBA) : suffit pour les captures de Playwright
function decoderPng(buf) {
  const zlib = require('node:zlib');
  let pos = 8; let larg; let haut; let canaux; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('latin1', pos + 4, pos + 8);
    const corps = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { larg = corps.readUInt32BE(0); haut = corps.readUInt32BE(4); canaux = corps[9] === 6 ? 4 : 3; if (corps[8] !== 8 || corps[12] !== 0 || ![2, 6].includes(corps[9])) throw new Error('PNG non géré'); }
    if (type === 'IDAT') idat.push(corps);
    pos += 12 + len;
  }
  const brut = zlib.inflateSync(Buffer.concat(idat)); const ligne = larg * canaux; const px = Buffer.alloc(haut * ligne);
  for (let y = 0; y < haut; y++) {
    const f = brut[y * (ligne + 1)]; const src = brut.subarray(y * (ligne + 1) + 1, (y + 1) * (ligne + 1));
    for (let x = 0; x < ligne; x++) {
      const a = x >= canaux ? px[y * ligne + x - canaux] : 0; const b = y ? px[(y - 1) * ligne + x] : 0; const c = x >= canaux && y ? px[(y - 1) * ligne + x - canaux] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      px[y * ligne + x] = v & 255;
    }
  }
  return { larg, haut, canaux, px };
}
// Écart entre deux captures : nombre de pixels différents et plus grand écart sur un canal
function comparerImages(a, b) {
  const A = decoderPng(a); const B = decoderPng(b);
  if (A.larg !== B.larg || A.haut !== B.haut) return { tailles: false };
  let n = 0; let max = 0;
  for (let i = 0; i < A.larg * A.haut; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(A.px[i * A.canaux + c] - B.px[i * B.canaux + c]));
    if (d) { n++; max = Math.max(max, d); }
  }
  return { tailles: true, pixels: A.larg * A.haut, differents: n, max };
}

// ---- Lecture de l'état de l'appli (exécuté dans la page) ----
const lireDonnees = () => ({
  indicateurs: JSON.parse(JSON.stringify(indicateursCommune)),
  scores: JSON.parse(JSON.stringify(scoresParCommune)),
  indice: JSON.parse(JSON.stringify(indiceFinale)),
  jenks: JSON.parse(JSON.stringify(seuilsJenks)),
  couleursJenks: JSON.parse(JSON.stringify(colorsJenks)),
  pk: JSON.parse(JSON.stringify(referencePk('betti').pk)),
  mode: modeCalculPk,
});
const lireRendu = (type) => {
  const couches = {}; const popups = {};
  geojsonLayers[type].eachLayer((l) => {
    const nom = l.feature.properties.nom;
    const o = l.options;
    couches[nom] = [o.fillColor, o.color, o.weight, o.fillOpacity, o.opacity, o.fillOpacity];
    popups[nom] = l.getPopup && l.getPopup() ? String(l.getPopup().getContent()) : null;
  });
  const legendes = [...cartes[type].getContainer().querySelectorAll('.info.legend, .legende-traits')].map((e) => e.innerText.replace(/\s+/g, ' ').trim());
  return { couches, popups, legendes, nbCouches: Object.keys(couches).length };
};

async function snapshot(navigateur, url, { francais }) {
  const appli = await ouvrirAppli(navigateur, url);
  const { page } = appli;
  if (francais) {                                    // référence : anglais par défaut -> on décoche « English labels »
    await page.uncheck('#checkbox-english');
    await page.waitForTimeout(300);
  }
  const s = { erreurs: appli.nouvellesErreurs(), requetes: appli.requetesEchouees };
  s.donnees = await page.evaluate(lireDonnees);
  s.rendu = {}; s.images = {}; s.imagesAvecRoutes = {};
  for (const [tab, type] of CARTES) {
    await page.click(`.tab-button[data-tab="${tab}"]`);
    await page.waitForTimeout(1600);
    await page.evaluate((t) => cartes[t].invalidateSize(), type);
    s.rendu[type] = await page.evaluate(lireRendu, type);
    // capture AVEC les routes (informative) puis SANS (comparée) : la référence empile les routes nationales et les étiquettes de villes en double
    s.imagesAvecRoutes[type] = await page.locator(`#map-${type}`).screenshot({ animations: 'disabled' });
    await page.evaluate((t) => {           // retire routes, villes et étiquettes : il ne reste que les polygones des communes, la légende et les contrôles
      const aRetirer = [];
      cartes[t].eachLayer((l) => { if (l instanceof L.Marker || l instanceof L.CircleMarker || (l instanceof L.Polyline && !(l instanceof L.Polygon))) aRetirer.push(l); });
      aRetirer.forEach((l) => cartes[t].removeLayer(l));
    }, type);
    await page.waitForTimeout(500);
    const png = await page.locator(`#map-${type}`).screenshot({ animations: 'disabled' });
    s.images[type] = png;
    if (process.env.IMG_DIR) fs.writeFileSync(path.join(process.env.IMG_DIR, `${francais ? 'ref' : 'demo'}_${type}.png`), png);
  }
  // fiches commune
  s.fiches = {};
  for (const c of COMMUNES_FICHE) {
    await page.selectOption('#communeSelect', c);
    await page.click('#validerCommune');
    await page.waitForSelector('#resultCommune .indicateur-row');
    s.fiches[c] = ancienLibelle((await page.locator('#resultCommune').innerText()).replace(/\s+/g, ' ').trim());
  }
  // modification + recalcul sur Bastia, puis état complet
  await page.selectOption('#communeSelect', 'Bastia');
  await page.click('#validerCommune');
  await page.waitForSelector('#resultCommune .indicateur-row');
  await page.evaluate(() => {
    document.getElementById('Indicateur_Vec4').value = '100';
    document.getElementById('Indicateur_Opp1').value = '5';
    recalculerIndice('Bastia');
  });
  s.apresModif = await page.evaluate(lireDonnees);
  s.fichesApresModif = ancienLibelle((await page.locator('#resultCommune').innerText()).replace(/\s+/g, ' ').trim());
  s.rendu.oppchovecApresModif = await page.evaluate(lireRendu, 'oppchovec');
  s.erreursFin = appli.nouvellesErreurs();
  await page.close();
  return s;
}

async function main() {
  if (hasattr_stdout()) process.stdout.setDefaultEncoding('utf8');
  const dispo = disponibilite();
  if (!dispo.ok) { console.log(`Comparaison impossible : ${dispo.raison}`); process.exit(2); }
  console.log(`Comparaison A/B : référence « ${REF} » contre ${git('rev-parse', '--abbrev-ref', 'HEAD').trim()}\n`);

  // 1. fichiers modifiés entre les deux branches
  console.log('1. Fichiers modifiés par rapport à la référence');
  const modifies = git('diff', '--name-only', '--no-renames', `${REF}...HEAD`).split('\n').filter(Boolean);
  const dossierTravail = git('status', '--porcelain').split('\n').filter(Boolean).map((l) => l.slice(3).replace(/"/g, ''));
  const tous = [...new Set([...modifies, ...dossierTravail])];
  const autorises = [/^index\.html$/, /^stage_ambroise\/Code\/WEB\/(script\.js|dashboard\.css|dominance\.js)$/, /^tests\//, /^\.claude\//];
  const inattendus = tous.filter((f) => !autorises.some((re) => re.test(f)));
  verifier('aucun fichier de données, de téléchargement ou de calcul modifié', inattendus.length === 0, inattendus.join(', '));
  console.log(`      (fichiers modifiés : ${tous.length}, dont ${tous.filter((f) => !f.startsWith('tests/')).join(', ')})`);

  // 6. téléchargements (octet pour octet) — avant les parties lourdes
  console.log('\n2. Fichiers téléchargeables');
  const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const liens = [...html.matchAll(/href="(downloads\/[^"]+)"/g)].map((m) => m[1]);
  verifier('la page propose au moins un téléchargement', liens.length >= 1, 'aucun lien');
  for (const l of liens) {
    let ref; try { ref = execFileSync('git', ['show', `${REF}:${l}`], { cwd: RACINE, maxBuffer: 1 << 28 }); } catch (_) { ref = null; }
    const demo = fs.existsSync(path.join(RACINE, l)) ? fs.readFileSync(path.join(RACINE, l)) : null;
    verifier(`${l} identique à la référence`, ref && demo && sha(ref) === sha(demo), ref ? (demo ? 'contenu différent' : 'absent de la démo') : 'absent de la référence');
  }

  // Extraction de la référence
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'oppchovec_ref_'));
  fs.rmSync(worktree, { recursive: true, force: true });
  git('worktree', 'add', '--detach', worktree, REF);
  const serveurs = []; let navigateur;
  try {
    const sRef = await demarrerServeur(worktree); const sDemo = await demarrerServeur(RACINE); serveurs.push(sRef, sDemo);
    navigateur = await dispo.playwright.chromium.launch({ executablePath: dispo.exe });
    console.log('\n   Ouverture des deux versions (quelques dizaines de secondes)…');
    const ref = await snapshot(navigateur, sRef.url, { francais: true });
    const demo = await snapshot(navigateur, sDemo.url, { francais: false });

    console.log('\n3. Chargement');
    verifier('aucune erreur de console / de page (démo)', demo.erreurs.length === 0 && demo.erreursFin.length === 0, JSON.stringify([...demo.erreurs, ...demo.erreursFin]));
    verifier('aucune requête en échec (démo)', demo.requetes.length === 0, JSON.stringify(demo.requetes));
    verifier('mode p_k de la démo = Betti', demo.donnees.mode === 'betti', demo.donnees.mode);

    console.log('\n4. Données calculées (état au chargement)');
    for (const k of ['indicateurs', 'scores', 'indice', 'jenks', 'couleursJenks', 'pk']) {
      verifier(`${k} identiques`, JSON.stringify(ref.donnees[k]) === JSON.stringify(demo.donnees[k]), premierEcart(ref.donnees[k], demo.donnees[k]));
    }

    console.log('\n5. Rendu des cartes (360 communes par carte)');
    for (const [, type] of CARTES) {
      const r = { ...ref.rendu[type], imageBrute: ref.images[type] }; const d = { ...demo.rendu[type], imageBrute: demo.images[type] };
      verifier(`${type} : 360 communes dessinées`, d.nbCouches === 360 && r.nbCouches === 360, `${r.nbCouches} / ${d.nbCouches}`);
      verifier(`${type} : couleur et style de chaque commune`, nbEcarts(r.couches, d.couches) === 0, `${nbEcarts(r.couches, d.couches)} communes différentes ; ${premierEcart(r.couches, d.couches)}`);
      verifier(`${type} : contenu des bulles (popups)`, nbEcarts(r.popups, d.popups) === 0, `${nbEcarts(r.popups, d.popups)} bulles différentes ; ${premierEcart(r.popups, d.popups)}`);
      verifier(`${type} : légendes`, JSON.stringify(r.legendes) === JSON.stringify(d.legendes), premierEcart(r.legendes, d.legendes));
      const im = comparerImages(r.imageBrute, d.imageBrute);
      // tolérance : crénelage des traits d'étiquettes (quelques pixels, écart de 3 sur un canal) ; au-delà, c'est une vraie différence
      verifier(`${type} : image de la carte, hors routes et étiquettes (tolérance : ≤ 0,01 % des pixels différents, ou écart ≤ 3/255 partout)`, im.tailles && ((im.differents <= im.pixels * 1e-4 && im.max <= 8) || im.max <= 3),
        im.tailles ? `${im.differents} pixels différents sur ${im.pixels}, écart max ${im.max}` : 'tailles différentes');
      if (im.tailles) console.log(`          (${type} : ${im.differents} pixel(s) différent(s) sur ${im.pixels})`);
      const ir = comparerImages(ref.imagesAvecRoutes[type], demo.imagesAvecRoutes[type]);
      console.log(`          (${type} avec routes, à titre informatif : ${ir.differents} pixel(s) différent(s) — la référence superpose deux fois les routes nationales et les étiquettes de villes)`);
    }

    console.log('\n6. Fiche commune');
    for (const c of COMMUNES_FICHE) verifier(`fiche de ${c}`, ref.fiches[c] === demo.fiches[c], premierEcart(ref.fiches[c], demo.fiches[c]) || `${ref.fiches[c].slice(0, 100)} ≠ ${demo.fiches[c].slice(0, 100)}`);
    verifier('après modification de Bastia : état complet identique', JSON.stringify(ref.apresModif) === JSON.stringify(demo.apresModif), premierEcart(ref.apresModif, demo.apresModif));
    verifier('après modification de Bastia : fiche identique', ref.fichesApresModif === demo.fichesApresModif, '');
    verifier('après modification de Bastia : carte OppChoVec identique', JSON.stringify(ref.rendu.oppchovecApresModif.couches) === JSON.stringify(demo.rendu.oppchovecApresModif.couches), premierEcart(ref.rendu.oppchovecApresModif.couches, demo.rendu.oppchovecApresModif.couches));
  } finally {
    if (navigateur) await navigateur.close();
    for (const s of serveurs) await s.fermer();
    try { git('worktree', 'remove', '--force', worktree); } catch (_) { fs.rmSync(worktree, { recursive: true, force: true }); git('worktree', 'prune'); }
  }

  const echecs = resultats.filter((r) => !r.ok);
  console.log(`\nBilan : ${resultats.length - echecs.length}/${resultats.length} vérifications identiques à la référence.`);
  if (echecs.length) { console.log('Écarts :'); echecs.forEach((e) => console.log(`  - ${e.nom} : ${e.detail}`)); }
  process.exit(echecs.length ? 1 : 0);
}
function hasattr_stdout() { return typeof process.stdout.setDefaultEncoding === 'function'; }

main().catch((e) => { console.error(e); try { git('worktree', 'prune'); } catch (_) {} process.exit(2); });
