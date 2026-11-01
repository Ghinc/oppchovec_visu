// Comparaison d'une commune aux autres et fourchette de rang, à partir des trois scores de dimension (Opp, Cho, Vec).
// Fonctions pures, sans dépendance : chargées par index.html (globales) et par les tests Node (module.exports).
//
// Même relation que dominance.js (A domine B <=> A >= B partout et A > B quelque part), présentée autour d'UNE commune :
//   « fait mieux sur les trois dimensions »  = les communes qui la dominent ;
//   « fait moins bien sur les trois dimensions » = les communes qu'elle domine ;
//   « ça dépend de ce qu'on privilégie »     = ni l'un ni l'autre ;
//   « profil identique »                     = mêmes trois scores (ne se dominent pas : comptées à part).
// Ne dépend ni des p_k, ni de α, ni de β : l'indice est strictement croissant en chaque dimension (p_k > 0), donc
//   meilleur rang possible = 1 + nombre de communes qui la dominent ;
//   pire rang possible     = n − nombre de communes qu'elle domine.
// Convention d'ex æquo (rangs de compétition) : rang = 1 + nombre d'unités au score STRICTEMENT supérieur.

const RANG_DIMENSIONS = ['Score_Opp', 'Score_Cho', 'Score_Vec'];

function rangValeurValide(v) {
    return typeof v === 'number' && Number.isFinite(v);
}

// scores : { unité: { Score_Opp, Score_Cho, Score_Vec } } (valeurs non arrondies). Les unités à valeur manquante sont exclues.
// Renvoie { noms, n, exclues, dominants, domines, identiques } ; chaque champ par unité est une liste de noms.
function comparerUnites(scores, dimensions = RANG_DIMENSIONS) {
    const noms = [], valeurs = [], exclues = [];
    for (const nom of Object.keys(scores)) {
        const s = scores[nom] || {};
        const manquantes = dimensions.filter(d => !rangValeurValide(s[d]));
        if (manquantes.length) exclues.push({ commune: nom, manquantes });
        else { noms.push(nom); valeurs.push(dimensions.map(d => s[d])); }
    }
    const n = noms.length;
    const dominantsIdx = Array.from({ length: n }, () => []);
    const dominesIdx = Array.from({ length: n }, () => []);
    const identiquesIdx = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const a = valeurs[i], b = valeurs[j];
            let pos = false, neg = false;                    // a > b quelque part ? a < b quelque part ?
            for (let k = 0; k < a.length; k++) {
                if (a[k] > b[k]) pos = true;
                else if (a[k] < b[k]) neg = true;
            }
            if (pos && !neg) { dominesIdx[i].push(j); dominantsIdx[j].push(i); }
            else if (neg && !pos) { dominesIdx[j].push(i); dominantsIdx[i].push(j); }
            else if (!pos && !neg) { identiquesIdx[i].push(j); identiquesIdx[j].push(i); }
        }
    }
    const versNoms = (idx) => idx.map(l => l.map(k => noms[k]));
    const dominants = {}, domines = {}, identiques = {};
    const d1 = versNoms(dominantsIdx), d2 = versNoms(dominesIdx), d3 = versNoms(identiquesIdx);
    noms.forEach((nom, i) => { dominants[nom] = d1[i]; domines[nom] = d2[i]; identiques[nom] = d3[i]; });
    return { noms, n, exclues, dominants, domines, identiques };
}

// Effectifs autour d'une unité : mieux + moins + depend + identiques = n − 1
function effectifsUnite(cmp, nom) {
    const mieux = cmp.dominants[nom].length, moins = cmp.domines[nom].length, identiques = cmp.identiques[nom].length;
    return { mieux, moins, identiques, depend: cmp.n - 1 - mieux - moins - identiques };
}

// Catégorie de chaque autre unité par rapport à `nom` : 'mieux' | 'moins' | 'depend' | 'identique'
function categoriesUnite(cmp, nom) {
    const cat = {};
    for (const autre of cmp.noms) cat[autre] = 'depend';
    cmp.dominants[nom].forEach(a => { cat[a] = 'mieux'; });
    cmp.domines[nom].forEach(a => { cat[a] = 'moins'; });
    cmp.identiques[nom].forEach(a => { cat[a] = 'identique'; });
    delete cat[nom];
    return cat;
}

// Meilleur et pire rang possibles, quelle que soit la pondération (p_k > 0)
function fourchetteRang(cmp, nom) {
    const meilleur = 1 + cmp.dominants[nom].length, pire = cmp.n - cmp.domines[nom].length;
    return { meilleur, pire, largeur: pire - meilleur };
}

// Rangs de compétition d'un indice { unité: valeur } restreint aux unités de `noms` : 1 + nombre d'unités strictement au-dessus
function rangsIndice(indice, noms) {
    const tri = noms.map(nom => ({ nom, v: indice[nom] })).filter(x => rangValeurValide(x.v)).sort((a, b) => b.v - a.v);
    const rangs = {};
    tri.forEach((x, i) => { rangs[x.nom] = (i > 0 && x.v === tri[i - 1].v) ? rangs[tri[i - 1].nom] : i + 1; });
    return rangs;
}

// 1 -> « 1re », 47 -> « 47e »
function ordinalFr(k) { return k === 1 ? '1re' : k + 'e'; }

// « 47e avec la pondération retenue ; quelle que soit la pondération, entre la 30e et la 110e place »
function texteFourchette(rang, f) {
    const fixe = f.meilleur === f.pire;
    const bornes = fixe ? `exactement la ${ordinalFr(f.meilleur)} place` : `entre la ${ordinalFr(f.meilleur)} et la ${ordinalFr(f.pire)} place`;
    return `${ordinalFr(rang)} avec la pondération retenue ; quelle que soit la pondération, ${bornes}`;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { comparerUnites, effectifsUnite, categoriesUnite, fourchetteRang, rangsIndice, ordinalFr, texteFourchette, RANG_DIMENSIONS };
}
