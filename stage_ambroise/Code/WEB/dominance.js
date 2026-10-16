// Analyse de dominance entre communes sur les trois scores de dimension (Opp, Cho, Vec).
// Fonctions pures, sans dépendance : chargées par index.html (globales) et par les tests Node (module.exports).
//
// A domine B  <=>  A >= B sur les trois dimensions ET A > B sur au moins une.
// Couches : la couche 1 regroupe les communes qu'aucune autre ne domine ; on les retire, la couche 2 regroupe celles
// qu'aucune des communes restantes ne domine, etc. Aucune pondération n'intervient.

const DOMINANCE_DIMENSIONS = ['Score_Opp', 'Score_Cho', 'Score_Vec'];

function dominanceValeurValide(v) {
    return typeof v === 'number' && Number.isFinite(v);
}

// true si a domine b (a et b : tableaux de nombres de même longueur)
function dominanceDomine(a, b) {
    let strict = false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] < b[i]) return false;
        if (a[i] > b[i]) strict = true;
    }
    return strict;
}

// scores : { commune: { Score_Opp, Score_Cho, Score_Vec } }
// Renvoie :
//   couches   : { commune: numéro de couche (1, 2, …) }            — communes complètes uniquement
//   dominants : { commune: [communes qui la dominent] }
//   domines   : { commune: [communes qu'elle domine] }
//   exclues   : [{ commune, manquantes: [dimensions sans valeur] }]  — sans couche
//   effectifs : [nombre de communes de la couche 1, de la couche 2, …]
function calculerDominance(scores, dimensions = DOMINANCE_DIMENSIONS) {
    const noms = [];
    const valeurs = [];
    const exclues = [];
    for (const commune of Object.keys(scores)) {
        const s = scores[commune] || {};
        const manquantes = dimensions.filter(d => !dominanceValeurValide(s[d]));
        if (manquantes.length) {
            exclues.push({ commune, manquantes });
        } else {
            noms.push(commune);
            valeurs.push(dimensions.map(d => s[d]));
        }
    }

    // Comparaison de toutes les paires
    const n = noms.length;
    const dominantsIdx = Array.from({ length: n }, () => []);
    const dominesIdx = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (dominanceDomine(valeurs[i], valeurs[j])) {
                dominesIdx[i].push(j);
                dominantsIdx[j].push(i);
            } else if (dominanceDomine(valeurs[j], valeurs[i])) {
                dominesIdx[j].push(i);
                dominantsIdx[i].push(j);
            }
        }
    }

    // Tri par non-dominance : on retire à chaque tour les communes qu'aucune commune restante ne domine
    const couche = new Array(n).fill(0);
    let restantes = n;
    let numero = 0;
    const effectifs = [];
    while (restantes > 0) {
        numero++;
        const courante = [];
        for (let i = 0; i < n; i++) {
            if (couche[i] === 0 && dominantsIdx[i].every(k => couche[k] !== 0)) courante.push(i);
        }
        // Ne peut pas arriver (la dominance est un ordre strict), mais on ne boucle jamais à l'infini
        if (courante.length === 0) throw new Error('Dominance: cycle détecté');
        for (const i of courante) couche[i] = numero;
        effectifs.push(courante.length);
        restantes -= courante.length;
    }

    const couches = {}, dominants = {}, domines = {};
    noms.forEach((nom, i) => {
        couches[nom] = couche[i];
        dominants[nom] = dominantsIdx[i].map(k => noms[k]);
        domines[nom] = dominesIdx[i].map(k => noms[k]);
    });
    return { couches, dominants, domines, exclues, effectifs, nbCouches: effectifs.length };
}

// Dans l'onglet Dominance le panneau latéral ne sert à rien : classe sur <body> (voir dashboard.css), les cartes prennent toute la largeur
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => {
            document.body.classList.toggle('mode-dominance', b.getAttribute('data-tab') === 'dominancetab');
            setTimeout(() => {                       // les cartes se redimensionnent une fois la disposition changée
                window.dispatchEvent(new Event('resize'));
                try {
                    if (typeof _carteDominance !== 'undefined' && _carteDominance) {
                        _carteDominance.invalidateSize();
                        if (b.getAttribute('data-tab') === 'dominancetab' && typeof dominanceLayerRef !== 'undefined' && dominanceLayerRef) _carteDominance.fitBounds(dominanceLayerRef.getBounds(), { padding: [8, 8], animate: false });      // la Corse remplit la carte
                    }
                } catch (e) { /* carte détruite entre-temps */ }
            }, 150);
        }));
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculerDominance, dominanceDomine, DOMINANCE_DIMENSIONS };
}
