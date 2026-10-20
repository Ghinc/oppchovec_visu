// Variante de Vec1 (revenu) : revenu fiscal moyen par foyer fiscal (DGFiP, IRCOM 2021) à la place de la médiane du niveau de vie (Filosofi 2021).
// Fonctions de calcul (pures) + case à cocher qui bascule toute l'appli d'une source à l'autre + comparaison des deux indices (corrélations, nuage de points).
// Chargé avant script.js : les variables globales de script.js (indicateursOrigine, bornesRef...) ne sont lues qu'à l'appel des fonctions.
// Données : vec1_revenu_fiscal.json (calculer_revenu_fiscal_vec1.py).

let vec1Variante = null;            // { commune: revenu fiscal moyen par foyer }, null tant que non chargé
let vec1Infos = null;               // { commune: { estime_departement, nb_foyers } }
let vec1Filosofi = null;            // valeurs d'origine (médiane du niveau de vie), capturées au chargement
let vec1SeuilsVecFilosofi = null;   // seuils de Jenks d'origine de la carte Vec
let vec1SourceActive = 'filosofi';  // 'filosofi' | 'ircom'
let vec1Scatter = null;

// ---------- Calculs purs ----------

// Indice OppChoVec 0-10 recalculé depuis des indicateurs bruts, avec ses propres bornes min-max (comme le chargement initial) et les p_k du mode demandé
function calculerIndiceComplet(indicateurs, mode) {
    const b = minmax(indicateurs);
    const s01 = calculerScoresParCommune(normaliserDonnees(indicateurs, b.min, b.max));
    const pk = mode === 'betti' ? calculerPkBetti(s01) : [1, 1, 1];
    const brut = calculerIndiceBienEtre(s01, pk);
    const valeurs = Object.values(brut);
    const min = Math.min(...valeurs), max = Math.max(...valeurs);
    const indice = {};
    for (const c in brut) indice[c] = max === min ? 5 : ((brut[c] - min) / (max - min)) * 10;
    const scoreVec = {};
    const sv = Object.values(s01).map(s => s.Score_Vec);
    const vmin = Math.min(...sv), vmax = Math.max(...sv);
    for (const c in s01) scoreVec[c] = vmax === vmin ? 5 : ((s01[c].Score_Vec - vmin) / (vmax - vmin)) * 10;
    return { indice, scoreVec, pk };
}

function correlationPearson(a, b) {
    const n = a.length;
    const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da * db === 0 ? 0 : num / Math.sqrt(da * db);
}

// Rangs moyens (1 = plus petite valeur ; ex æquo = moyenne de leurs rangs)
function rangsMoyens(valeurs) {
    const ordre = valeurs.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const rangs = new Array(valeurs.length);
    for (let i = 0; i < ordre.length;) {
        let j = i;
        while (j + 1 < ordre.length && ordre[j + 1][0] === ordre[i][0]) j++;
        const r = (i + j) / 2 + 1;
        for (let k = i; k <= j; k++) rangs[ordre[k][1]] = r;
        i = j + 1;
    }
    return rangs;
}

function correlationSpearman(a, b) {
    return correlationPearson(rangsMoyens(a), rangsMoyens(b));
}

function classeJenks(valeur, seuilsInternes) {
    for (let i = 0; i < seuilsInternes.length; i++) if (valeur <= seuilsInternes[i]) return i;
    return seuilsInternes.length;
}

// Compare l'indice avec la médiane Filosofi (A) et avec le revenu fiscal moyen (B), sur les valeurs d'ORIGINE (sans modifications de curseurs)
function comparerSourcesVec1(mode) {
    const communes = Object.keys(indicateursOrigine);
    const avec = (valeurs) => {
        const ind = structuredClone(indicateursOrigine);
        for (const c of communes) ind[c].Indicateur_Vec1 = valeurs[c];
        return calculerIndiceComplet(ind, mode);
    };
    const A = avec(vec1Filosofi), B = avec(vec1Variante);
    const a = communes.map(c => A.indice[c]), b = communes.map(c => B.indice[c]);
    const va = communes.map(c => vec1Filosofi[c]), vb = communes.map(c => vec1Variante[c]);
    const sa = communes.map(c => A.scoreVec[c]), sb = communes.map(c => B.scoreVec[c]);
    const seuilsA = calculerJenksBreaks(a, 5), seuilsB = calculerJenksBreaks(b, 5);
    const rangA = rangsMoyens(a.map(x => -x)), rangB = rangsMoyens(b.map(x => -x));      // 1 = meilleure commune
    const ecarts = communes.map((c, i) => ({ commune: c, rangFilosofi: rangA[i], rangRevenuFiscal: rangB[i], ecart: rangA[i] - rangB[i] }));
    const parEcart = [...ecarts].sort((x, y) => y.ecart - x.ecart);
    return {
        n: communes.length, mode,
        pearsonIndice: correlationPearson(a, b), spearmanIndice: correlationSpearman(a, b),
        pearsonVec1: correlationPearson(va, vb), spearmanVec1: correlationSpearman(va, vb),
        spearmanScoreVec: correlationSpearman(sa, sb),
        changementsClasse: communes.filter((c, i) => classeJenks(a[i], seuilsA) !== classeJenks(b[i], seuilsB)).length,
        ecartRangMedian: [...ecarts.map(e => Math.abs(e.ecart))].sort((x, y) => x - y)[Math.floor(communes.length / 2)],
        gagnantsRevenuFiscal: parEcart.slice(0, 5),                       // beaucoup mieux classées avec le revenu fiscal
        perdantsRevenuFiscal: parEcart.slice(-5).reverse(),
        points: communes.map((c, i) => ({ x: a[i], y: b[i], commune: c })),
    };
}

// ---------- Données et bascule ----------

async function chargerVec1Variante() {
    try {
        const reponse = await fetch(BASE_PATH + 'vec1_revenu_fiscal.json');
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
        const data = await reponse.json();
        vec1Variante = {}; vec1Infos = {};
        for (const [c, v] of Object.entries(data.communes)) { vec1Variante[c] = v.revenu_moyen; vec1Infos[c] = v; }
        vec1Filosofi = {};
        for (const c in indicateursOrigine) vec1Filosofi[c] = indicateursOrigine[c].Indicateur_Vec1;
        vec1SeuilsVecFilosofi = seuilsJenks.vec ? seuilsJenks.vec.slice() : null;
        const manquantes = Object.keys(vec1Filosofi).filter(c => !(c in vec1Variante));
        if (manquantes.length) throw new Error(`communes absentes de vec1_revenu_fiscal.json : ${manquantes.slice(0, 5)}`);
        const case_ = document.getElementById('checkbox-vec1-ircom');
        if (case_) case_.disabled = false;
        rafraichirComparaisonVec1();
        return true;
    } catch (erreur) {
        console.warn('Variante Vec1 (revenu fiscal moyen) indisponible :', erreur);
        const zone = document.getElementById('vec1-comparaison');
        if (zone) zone.textContent = 'Variante indisponible (fichier vec1_revenu_fiscal.json non chargé).';
        return false;
    }
}

function basculerSourceVec1(source) {
    if (!vec1Variante || source === vec1SourceActive) return;
    const valeurs = source === 'ircom' ? vec1Variante : vec1Filosofi;
    for (const c in indicateursOrigine) indicateursOrigine[c].Indicateur_Vec1 = valeurs[c];
    // les références figées (bornes, p_k, Jenks) sont celles des nouvelles données ; les modifications de curseurs sont abandonnées
    indicateursCommune = structuredClone(indicateursOrigine);
    sousComposantesCommune = structuredClone(sousComposantesOrigine);
    bornesRef = minmax(indicateursOrigine);
    bornesScoresRef = minmax(calculerScores01(indicateursOrigine));
    refParModePk = {};
    vec1SourceActive = source;
    if (source === 'ircom') {
        const vals = Object.values(scoresDimension0a10(calculerScores01(indicateursOrigine))).map(s => s.Score_Vec);
        seuilsJenks.vec = [0, ...calculerJenksBreaks(vals, 5), 10];
    } else if (vec1SeuilsVecFilosofi) {
        seuilsJenks.vec = vec1SeuilsVecFilosofi.slice();
    }
    recalculerCarteOppChoVec();
    const select = document.getElementById('communeSelect');
    if (select && select.value) afficherCommune(select.value);
    const avertissement = document.getElementById('vec1-avertissement');
    if (avertissement) avertissement.style.display = source === 'ircom' ? 'block' : 'none';
}

// ---------- Affichage de la comparaison ----------

const fmt2 = (x) => x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function rafraichirComparaisonVec1() {
    const zone = document.getElementById('vec1-comparaison');
    if (!zone || !vec1Variante || !vec1Filosofi || typeof indicateursOrigine === 'undefined' || !Object.keys(indicateursOrigine).length) return;
    const mode = typeof modeCalculPk !== 'undefined' ? modeCalculPk : 'betti';
    if (comparaisonVec1Courante && comparaisonVec1Courante.mode === mode) return;     // la comparaison ne dépend que du mode p_k (valeurs d'origine)
    const c = comparerSourcesVec1(mode);
    comparaisonVec1Courante = c;
    const ligne = (e) => `${echapperHtmlVec1(e.commune)} (${Math.round(e.rangFilosofi)} → ${Math.round(e.rangRevenuFiscal)})`;
    zone.innerHTML = `
        <div><strong>Comparaison des deux indices</strong> (p_k ${mode === 'betti' ? 'de Betti' : 'égaux'}, ${c.n} communes)</div>
        <table class="vec1-table">
          <tr><td>Indice OppChoVec</td><td>r = <strong>${fmt2(c.pearsonIndice)}</strong></td><td>ρ (rang) = <strong>${fmt2(c.spearmanIndice)}</strong></td></tr>
          <tr><td>Score Vec</td><td></td><td>ρ = <strong>${fmt2(c.spearmanScoreVec)}</strong></td></tr>
          <tr><td>Vec1 seul</td><td>r = <strong>${fmt2(c.pearsonVec1)}</strong></td><td>ρ = <strong>${fmt2(c.spearmanVec1)}</strong></td></tr>
        </table>
        <div>Communes qui changent de classe de couleur : <strong>${c.changementsClasse}</strong> sur ${c.n}. Écart de rang médian : ${Math.round(c.ecartRangMedian)}.</div>
        <div class="vec1-petit"><em>Rang 1 = meilleure commune.</em><br>Mieux classées avec le revenu fiscal : ${c.gagnantsRevenuFiscal.map(ligne).join(' ; ')}<br>
        Moins bien classées : ${c.perdantsRevenuFiscal.map(ligne).join(' ; ')}</div>`;
    const canvas = document.getElementById('vec1-scatter');
    if (canvas && typeof Chart !== 'undefined') {
        if (vec1Scatter) vec1Scatter.destroy();
        vec1Scatter = new Chart(canvas.getContext('2d'), {
            type: 'scatter',
            data: { datasets: [
                { label: 'Communes', data: c.points, pointRadius: 2.5, backgroundColor: 'rgba(74,20,140,0.55)' },
                { label: 'y = x', type: 'line', data: [{ x: 0, y: 0 }, { x: 10, y: 10 }], borderColor: '#999', borderDash: [4, 4], pointRadius: 0, fill: false },
            ] },
            options: {
                animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => `${i.raw.commune ?? ''} : ${fmt2(i.raw.x)} → ${fmt2(i.raw.y)}` } } },
                scales: { x: { min: 0, max: 10, title: { display: true, text: 'OppChoVec, médiane du niveau de vie' } }, y: { min: 0, max: 10, title: { display: true, text: 'OppChoVec, revenu fiscal moyen' } } },
            },
        });
    }
}
let comparaisonVec1Courante = null;

function echapperHtmlVec1(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const case_ = document.getElementById('checkbox-vec1-ircom');
        if (case_) case_.addEventListener('change', function () { basculerSourceVec1(this.checked ? 'ircom' : 'filosofi'); });
    });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { rangsMoyens, correlationPearson, correlationSpearman, classeJenks };
