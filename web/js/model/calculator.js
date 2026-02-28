/**
 * Fonctions de calcul côté client pour OppChoVec.
 *
 * Toutes les fonctions sont pures (pas d'accès DOM, pas de mutation de AppState).
 * Le recalcul est déclenché par le contrôleur (app.js) lorsque l'utilisateur
 * modifie les sliders d'indicateur.
 *
 * Note : les fonctions calc_opp1..calc_vec4 de l'original ont été supprimées
 * car elles n'étaient jamais appelées (les données arrivent précalculées via JSON).
 */

/**
 * Parse le JSON uploadé et retourne les trois dictionnaires utilisés par l'app.
 *
 * @param {Object} dataIndicateurs - Objet JSON tel que chargé depuis data_indicateurs.json
 * @returns {{ indicateursDict: Object, scoresDict: Object, indiceDict: Object, scores01Dict: Object }}
 */
function parseDataJSON(dataIndicateurs) {
    const indicateursDict = {};
    const scoresDict      = {};
    const indiceDict      = {};
    const scores01Dict    = {};

    // Debug : inspecter la structure du JSON
    const topKeys = Object.keys(dataIndicateurs).slice(0, 3);
    console.log('[parseDataJSON] top-level keys (premiers 3):', topKeys);
    if (topKeys.length > 0) {
        const firstVal = dataIndicateurs[topKeys[0]];
        console.log('[parseDataJSON] type de la 1ère valeur:', typeof firstVal);
        if (typeof firstVal === 'object' && firstVal !== null) {
            console.log('[parseDataJSON] clés de la 1ère entrée:', Object.keys(firstVal).slice(0, 8));
            console.log('[parseDataJSON] Zone =', firstVal['Zone'], '/ OppChoVec_1_10 =', firstVal['OppChoVec_1_10']);
        } else {
            console.log('[parseDataJSON] 1ère valeur brute:', firstVal);
        }
    }

    for (const [, valeurs] of Object.entries(dataIndicateurs)) {
        const commune = valeurs['Zone'];
        if (!commune) continue;

        indicateursDict[commune] = {
            Indicateur_Opp1: valeurs['Opp1'],
            Indicateur_Opp2: valeurs['Opp2'],
            Indicateur_Opp3: valeurs['Opp3'],
            Indicateur_Opp4: valeurs['Opp4'],
            Indicateur_Cho1: valeurs['Cho1'],
            Indicateur_Cho2: valeurs['Cho2'],
            Indicateur_Vec1: valeurs['Vec1'],
            Indicateur_Vec2: valeurs['Vec2'],
            Indicateur_Vec3: valeurs['Vec3'],
            Indicateur_Vec4: valeurs['Vec4'],
        };

        scoresDict[commune] = {
            Score_Opp: valeurs['Score_Opp_1_10'],
            Score_Cho: valeurs['Score_Cho_1_10'],
            Score_Vec: valeurs['Score_Vec_1_10'],
        };

        // Scores 0-1 pour le calcul des poids p_k Betti (CV et corrélation Pearson)
        scores01Dict[commune] = {
            Score_Opp: valeurs['Score_Opp_1_10'] / 10,
            Score_Cho: valeurs['Score_Cho_1_10'] / 10,
            Score_Vec: valeurs['Score_Vec_1_10'] / 10,
        };

        indiceDict[commune] = valeurs['OppChoVec_1_10'];
    }

    return { indicateursDict, scoresDict, indiceDict, scores01Dict };
}


/**
 * Calcule le min et le max de chaque indicateur sur toutes les communes.
 *
 * @param {Object} data - {commune: {Indicateur_*: valeur, ...}}
 * @returns {{ min: Object, max: Object }}
 */
function minmax(data) {
    const min = {};
    const max = {};

    const keys = Object.keys(Object.values(data)[0]);

    for (const key of keys) {
        const valeurs = Object.values(data)
            .map(c => c[key])
            .filter(v => v !== undefined && v !== null);
        min[key] = Math.min(...valeurs);
        max[key] = Math.max(...valeurs);
    }

    return { min, max };
}


/**
 * Normalise les indicateurs de toutes les communes sur [0, 1].
 *
 * @param {Object} data     - {commune: {indicateur: valeur}}
 * @param {Object} minVals  - {indicateur: valeurMin}
 * @param {Object} maxVals  - {indicateur: valeurMax}
 * @returns {Object} - Mêmes clés, valeurs normalisées
 */
function normaliserDonnees(data, minVals, maxVals) {
    const result = {};

    for (const [commune, indicateurs] of Object.entries(data)) {
        result[commune] = {};
        for (const [key, valeur] of Object.entries(indicateurs)) {
            const minX = minVals[key] ?? 0;
            const maxX = maxVals[key] ?? 1;
            result[commune][key] = (maxX === minX)
                ? 0
                : (valeur - minX) / (maxX - minX);
        }
    }

    return result;
}


/**
 * Calcule les scores des 3 dimensions (Opp, Cho, Vec) à partir des indicateurs normalisés.
 *
 * @param {Object} dataNormalise - {commune: {Indicateur_*: valeur_normalisée}}
 * @returns {Object} - {commune: {Score_Opp, Score_Cho, Score_Vec}}
 */
function calculerScoresParCommune(dataNormalise) {
    /**
     * Moyenne pondérée d'un sous-ensemble d'indicateurs.
     * @param {Object} indicateurs - {Opp1: v, Opp2: v, ...} (clés sans préfixe "Indicateur_")
     * @param {Object} ponderations - {Opp1: w, ...}
     */
    function calcDik(indicateurs, ponderations) {
        let sommePoids   = 0;
        let sommeProduit = 0;

        for (const [cle, poids] of Object.entries(ponderations)) {
            if (cle in indicateurs) {
                sommeProduit += indicateurs[cle] * poids;
                sommePoids   += poids;
            }
        }

        return sommePoids === 0 ? 0 : sommeProduit / sommePoids;
    }

    const scores = {};

    for (const [commune, indicateursBruts] of Object.entries(dataNormalise)) {
        // Retirer le préfixe "Indicateur_" pour correspondre aux clés de PONDERATIONS
        const ind = {};
        for (const [k, v] of Object.entries(indicateursBruts)) {
            ind[k.replace('Indicateur_', '')] = parseFloat(v);
        }

        scores[commune] = {
            Score_Opp: calcDik(ind, PONDERATIONS.Opp),
            Score_Cho: calcDik(ind, PONDERATIONS.Cho),
            Score_Vec: calcDik(ind, PONDERATIONS.Vec),
        };
    }

    return scores;
}


/**
 * Calcule l'indice OppChoVec final pour toutes les communes.
 *
 * Formule CES : (1/3) × [Σ(pk × dik^β)]^(α/β)
 *
 * @param {Object} scoresParCommune - {commune: {Score_Opp, Score_Cho, Score_Vec}}
 * @param {number[]} [pk=[1,1,1]]   - Poids des 3 dimensions [Opp, Cho, Vec]
 * @returns {Object} - {commune: valeurIndice}
 */
function calculerIndiceBienEtre(scoresParCommune, pk = [1, 1, 1]) {
    const result = {};

    for (const [commune, scores] of Object.entries(scoresParCommune)) {
        const dik = [scores.Score_Opp, scores.Score_Cho, scores.Score_Vec]
            .map(s => Math.pow(s, BETA));

        const sommePonderee = dik.reduce((acc, d, i) => acc + pk[i] * d, 0);
        result[commune] = (1 / 3) * Math.pow(sommePonderee, ALPHA / BETA);
    }

    return result;
}


/**
 * Wrapper : recalcule complètement l'indice à partir des indicateurs courants.
 *
 * Séquence : minmax → normalisation → scores dimensions → indice final
 *
 * @param {Object} indicateursCommune - {commune: {Indicateur_*: valeur}}
 * @returns {{ indiceFinale: Object, scoresParCommune: Object }}
 */
function recalculerDepuisIndicateurs(indicateursCommune) {
    const { min, max }    = minmax(indicateursCommune);
    const dataNorm        = normaliserDonnees(indicateursCommune, min, max);
    const scoresParCommune = calculerScoresParCommune(dataNorm);
    const indiceFinale    = calculerIndiceBienEtre(scoresParCommune);
    return { indiceFinale, scoresParCommune };
}


/**
 * Calcule les poids p_k selon la méthode Betti et al.
 *
 * p_k = CV_k × (1 / avgPearson_k), normalisé pour que Σp_k = 1.
 * CV (coefficient de variation) et corrélation de Pearson sont invariants à l'échelle,
 * donc des scores 0-1 ou 1-10 donnent le même résultat.
 *
 * @param {Object} scores01 - {commune: {Score_Opp, Score_Cho, Score_Vec}} (valeurs 0-1)
 * @returns {number[]} - [p_Opp, p_Cho, p_Vec] avec Σ = 1
 */
function calculerPkBetti(scores01) {
    const communes = Object.keys(scores01);
    const dims     = ['Score_Opp', 'Score_Cho', 'Score_Vec'];
    const data     = dims.map(dim => communes.map(c => scores01[c][dim]));

    // p¹_k = CV_k = écart-type / moyenne (coefficient de variation)
    const p1 = data.map(arr => {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
        return mean === 0 ? 0 : Math.sqrt(variance) / mean;
    });

    // Corrélation de Pearson entre deux vecteurs
    function pearson(a, b) {
        const n    = a.length;
        const mA   = a.reduce((s, x) => s + x, 0) / n;
        const mB   = b.reduce((s, x) => s + x, 0) / n;
        const num  = a.reduce((s, x, i) => s + (x - mA) * (b[i] - mB), 0);
        const denA = Math.sqrt(a.reduce((s, x) => s + (x - mA) ** 2, 0));
        const denB = Math.sqrt(b.reduce((s, x) => s + (x - mB) ** 2, 0));
        return (denA * denB === 0) ? 0 : num / (denA * denB);
    }

    // p²_k = 1 / mean(|ρ_{k,k'}|) sur toutes les dimensions (inclus k elle-même, ρ_{k,k}=1)
    const p2 = data.map(a => {
        const avgCorr = data.reduce((s, b) => s + Math.abs(pearson(a, b)), 0) / data.length;
        return avgCorr === 0 ? 0 : 1 / avgCorr;
    });

    // p_k = p¹_k × p²_k, normalisé pour Σp_k = 1
    const pkRaw = p1.map((v, i) => v * p2[i]);
    const sum   = pkRaw.reduce((a, b) => a + b, 0);
    return sum === 0 ? [1 / 3, 1 / 3, 1 / 3] : pkRaw.map(v => v / sum);
}


/**
 * Calcule les seuils de Jenks (Natural Breaks) par programmation dynamique.
 *
 * @param {number[]} values   - Tableau de valeurs numériques
 * @param {number}   nClasses - Nombre de classes souhaité
 * @returns {number[]}        - nClasses-1 seuils internes (valeurs de coupure)
 */
function calculerJenksBreaks(values, nClasses) {
    const sorted = [...values].filter(v => isFinite(v)).sort((a, b) => a - b);
    const n = sorted.length;
    if (n <= nClasses) return sorted.slice(1);

    const prefSum   = new Float64Array(n + 1);
    const prefSumSq = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
        prefSum[i + 1]   = prefSum[i]   + sorted[i];
        prefSumSq[i + 1] = prefSumSq[i] + sorted[i] * sorted[i];
    }

    function ssd(i, j) {
        const cnt   = j - i + 1;
        const s     = prefSum[j + 1]   - prefSum[i];
        const sq    = prefSumSq[j + 1] - prefSumSq[i];
        return sq - (s * s) / cnt;
    }

    const dp   = Array.from({ length: n + 1 }, () => new Float64Array(nClasses + 1).fill(Infinity));
    const prev = Array.from({ length: n + 1 }, () => new Int32Array(nClasses + 1));
    dp[0][0] = 0;
    for (let i = 1; i <= n; i++) { dp[i][1] = ssd(0, i - 1); prev[i][1] = 0; }

    for (let k = 2; k <= nClasses; k++) {
        for (let i = k; i <= n; i++) {
            for (let m = k - 1; m < i; m++) {
                const cost = dp[m][k - 1] + ssd(m, i - 1);
                if (cost < dp[i][k]) { dp[i][k] = cost; prev[i][k] = m; }
            }
        }
    }

    const breaks = [];
    let k = nClasses, i = n;
    while (k > 1) { const m = prev[i][k]; breaks.unshift(sorted[m - 1]); i = m; k--; }
    return breaks;
}


/**
 * Génère les labels de légende à partir d'un tableau de seuils complet [min, s1, ..., sN, max].
 *
 * @param {number[]} seuils - Tableau [s0, s1, ..., sN] (inclut bornes min et max)
 * @returns {string[]}
 */
function genererLabelsJenks(seuils) {
    if (seuils.length < 3) return seuils.slice(1).map((s, i) => `Classe ${i + 1}`);
    const labels = [];
    labels.push(`≤ ${seuils[1].toFixed(2)}`);
    for (let i = 1; i < seuils.length - 2; i++) {
        labels.push(`${seuils[i].toFixed(2)} – ${seuils[i + 1].toFixed(2)}`);
    }
    labels.push(`> ${seuils[seuils.length - 2].toFixed(2)}`);
    return labels;
}
