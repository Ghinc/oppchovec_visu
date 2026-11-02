// Onglet « Comparer ma commune » et ligne « rang / fourchette de rang » du panneau latéral.
// Calculs dans rang_fourchette.js ; ce fichier ne fait que l'affichage (carte Leaflet, légende, bulles) et lit les globales de l'appli
// (scoresParCommune, indiceFinale et geoUnites() suivent l'échelle : communes ou EPCI, et les modifications faites avec les curseurs).

let comparerInitialise = false;
let _carteComparer = null;          // carte Leaflet (hors synchronisation des autres cartes)
let comparerCouche = null;
let comparerVue = 'commune';        // 'commune' : ma commune face aux autres ; 'largeur' : largeur de la fourchette de rang
let comparerRef = null;             // commune (ou EPCI) de référence
let comparerPoids = null;           // null : carte d'origine (3 catégories, indépendantes de la pondération) ; sinon [p_Opp, p_Cho, p_Vec] normalisés : devant / derrière / égalité
let comparerEtat = null;            // { cmp, rangs, ref, cat } du dernier dessin, lu par les bulles de survol

const COMPARER_COULEURS = { mieux: '#2c7bb6', moins: '#e08214', depend: '#d9d9d9', identique: '#b2abd2', ref: '#f2c744', manquant: '#ffffff' };
const COMPARER_RAMPE_LARGEUR = ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'];       // Purples (ColorBrewer) : plus foncé = fourchette plus large
const COMPARER_DIMENSIONS = [['Score_Opp', 'Opp', 'Opportunités'], ['Score_Cho', 'Cho', 'Choix'], ['Score_Vec', 'Vec', 'Vécu']];

const comparerEch = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const comparerEstEPCI = () => typeof echelleEstEPCI === 'function' && echelleEstEPCI();
const comparerPluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const comparerUnite = (n = 1) => comparerEstEPCI() ? 'EPCI' : (n > 1 ? 'communes' : 'commune');

const COMPARER_INFOBULLE = 'Ce sont des limites extrêmes : la commune ne peut pas sortir de cette fourchette, quelle que soit la pondération, mais aucune pondération ne la place forcément à ses extrémités.';
const COMPARER_PHRASE = 'Une commune qui fait mieux sur les trois dimensions passera devant quelle que soit la façon de pondérer. Pour les communes en gris, l\'ordre dépend de l\'importance donnée à chaque dimension.';

// Comparaison de toutes les unités entre elles + rangs de l'indice courant (mode de pondération retenu)
function comparerCalcul() {
    const cmp = comparerUnites(scoresParCommune);
    return { cmp, rangs: rangsIndice(indiceFinale, cmp.noms) };
}

function comparerInfoHtml() {
    return `<span class="rang-info" tabindex="0" role="button" aria-label="Que signifie cette fourchette ?">ⓘ<span class="rang-info-bulle" role="tooltip">${COMPARER_INFOBULLE}</span></span>`;
}

// « 47e avec la pondération retenue ; quelle que soit la pondération, entre la 30e et la 110e place » (+ infobulle)
function comparerLigneRang(calcul, nom) {
    const rang = calcul.rangs[nom];
    if (!calcul.cmp.dominants[nom] || rang === undefined) return '';
    return `${texteFourchette(rang, fourchetteRang(calcul.cmp, nom))} ${comparerInfoHtml()}`;
}

// Ligne du panneau latéral (fiche d'une commune ou d'un EPCI)
function htmlFourchetteRang(nom) {
    if (typeof scoresParCommune === 'undefined' || !scoresParCommune || !scoresParCommune[nom]) return '';
    const ligne = comparerLigneRang(comparerCalcul(), nom);
    return ligne ? `<p class="rang-fourchette"><strong>Rang :</strong> ${ligne}</p>` : '';
}

// Valeurs affichées avec assez de décimales pour que deux scores différents ne paraissent pas égaux
function comparerFormats(a, b) {
    let d = 2;
    while (d < 6 && a !== b && a.toFixed(d) === b.toFixed(d)) d++;
    return [a.toFixed(d), b.toFixed(d)];
}

const COMPARER_LIBELLES = {
    mieux: 'Fait mieux sur les trois dimensions',
    moins: 'Fait moins bien sur les trois dimensions',
    depend: 'Ça dépend de ce qu\'on privilégie',
    identique: 'Profil identique (mêmes trois scores)'
};

const COMPARER_LIBELLES_POIDS = {
    mieux: 'Passe devant avec cette pondération',
    moins: 'Est derrière avec cette pondération',
    identique: 'À égalité avec cette pondération',
    depend: ''
};

// Avec une pondération choisie : l'indice de chaque unité (même formule que l'appli, scores 0-1 retrouvés avec les bornes figées)
// est comparé à celui de `ref`. Renvoie { cat, effectifs, rang } ; 'mieux' = l'unité passe devant ref.
function comparerCategoriesPoids(cmp, ref, p) {
    const raw = {};
    for (const nom of cmp.noms) {
        raw[nom] = {};
        for (const d of ['Score_Opp', 'Score_Cho', 'Score_Vec']) {
            const mn = bornesScoresRef.min[d], mx = bornesScoresRef.max[d];
            raw[nom][d] = mn + scoresParCommune[nom][d] / 10 * (mx - mn);
        }
    }
    const indice = calculerIndiceBienEtre(raw, p);
    const cat = {}, ef = { mieux: 0, moins: 0, identiques: 0, depend: 0 };
    for (const nom of cmp.noms) {
        if (nom === ref) continue;
        const ecart = indice[nom] - indice[ref];
        const c = Math.abs(ecart) <= 1e-12 * Math.max(1, Math.abs(indice[ref])) ? 'identique' : ecart > 0 ? 'mieux' : 'moins';
        cat[nom] = c;
        if (c === 'identique') ef.identiques++; else ef[c]++;
    }
    return { cat, effectifs: ef, rang: rangsIndice(indice, cmp.noms)[ref] };
}

const comparerPct = (x) => Math.round(x * 100) + ' %';

// Bulle au survol de `nom` : ses trois scores à côté de ceux de la commune sélectionnée
function comparerBulle(nom) {
    const e = comparerEtat;
    const titre = `<strong>${comparerEch(nom)}</strong>`;
    const libelles = e && e.poids ? COMPARER_LIBELLES_POIDS : COMPARER_LIBELLES;
    if (!e || !e.cmp.dominants[nom]) return `${titre}<br>Scores incomplets : non comparée`;
    const f = fourchetteRang(e.cmp, nom);
    const rang = e.rangs[nom] !== undefined ? `${ordinalFr(e.rangs[nom])} · ` : '';
    if (comparerVue === 'largeur' || !e.ref) {
        return `${titre}<br>${rang}entre la ${ordinalFr(f.meilleur)} et la ${ordinalFr(f.pire)} place (${comparerPluriel(f.largeur, 'place', 'places')} d'écart)`;
    }
    if (nom === e.ref) return `${titre}<br>Unité sélectionnée · ${rang}entre la ${ordinalFr(f.meilleur)} et la ${ordinalFr(f.pire)} place`;
    const sRef = scoresParCommune[e.ref], sNom = scoresParCommune[nom];
    const lignes = COMPARER_DIMENSIONS.map(([cle, court, long]) => {
        const [x, y] = comparerFormats(sRef[cle], sNom[cle]);
        const marque = sNom[cle] > sRef[cle] ? '<span class="comparer-plus" title="plus haut que la commune sélectionnée">▲</span>'
            : sNom[cle] < sRef[cle] ? '<span class="comparer-moins" title="plus bas que la commune sélectionnée">▼</span>' : '<span title="égal">=</span>';
        return `<tr><td title="${long}">${court}</td><td>${x}</td><td>${y} ${marque}</td></tr>`;
    }).join('');
    return `${titre}<br><em>${libelles[e.cat[nom]]}</em>` +
        `<table class="comparer-bulle-table"><tr><th></th><th>${comparerEch(e.ref)}<br><span>(sélectionnée)</span></th><th>${comparerEch(nom)}</th></tr>${lignes}</table>`;
}

// Classes de la carte de largeur : seuils arrondis (en places) selon le nombre d'unités
function comparerSeuilsLargeur(n) {
    return [0.05, 0.25, 0.5, 0.75].map(p => n >= 100 ? Math.round(p * (n - 1) / 10) * 10 : Math.max(1, Math.round(p * (n - 1))));
}
const comparerClasseLargeur = (largeur, seuils) => { let c = 0; while (c < seuils.length && largeur >= seuils[c]) c++; return c; };

function comparerRemplir() {
    const calcul = comparerCalcul();
    const { cmp, rangs } = calcul;
    const ref = comparerRef && cmp.dominants[comparerRef] ? comparerRef : null;
    let cat = ref ? categoriesUnite(cmp, ref) : null;
    const poids = ref && comparerPoids && comparerVue === 'commune' ? comparerCategoriesPoids(cmp, ref, comparerPoids) : null;
    if (poids) cat = poids.cat;
    comparerEtat = { cmp, rangs, ref, cat, poids: !!poids };
    const bloc = document.getElementById('comparer-poids');
    if (bloc) bloc.hidden = comparerVue !== 'commune';
    const retour = document.getElementById('comparer-poids-retour');
    if (retour) retour.hidden = !comparerPoids;
    const largeurs = {};
    cmp.noms.forEach(nom => { largeurs[nom] = fourchetteRang(cmp, nom).largeur; });
    const seuils = comparerSeuilsLargeur(cmp.n);
    const exclues = new Set(cmp.exclues.map(x => x.commune));

    // Couleur de chaque unité
    const couleur = (nom) => {
        if (exclues.has(nom)) return COMPARER_COULEURS.manquant;
        if (comparerVue === 'largeur') return COMPARER_RAMPE_LARGEUR[comparerClasseLargeur(largeurs[nom], seuils)];
        if (!ref) return COMPARER_COULEURS.depend;
        return nom === ref ? COMPARER_COULEURS.ref : COMPARER_COULEURS[cat[nom]];
    };
    if (comparerCouche) { comparerCouche.remove(); comparerCouche = null; }
    comparerCouche = L.geoJSON(geoUnites(), {
        style: feature => {
            const nom = feature.properties.nom;
            return { fillColor: couleur(nom), color: nom === ref ? '#d00000' : '#333', weight: nom === ref ? 3 : 0.8, fillOpacity: 0.9 };
        },
        onEachFeature: (feature, layer) => {
            const nom = feature.properties.nom;
            layer.on('click', () => selectionnerCommuneDepuisCarte(nom));
            layer.bindTooltip(() => comparerBulle(nom), { sticky: true, className: 'comparer-tooltip' });
        }
    }).addTo(_carteComparer);
    if (ref) comparerCouche.eachLayer(l => { if (l.feature.properties.nom === ref) l.bringToFront(); });

    // Résumé et légende
    const resume = document.getElementById('comparer-resume'), legende = document.getElementById('comparer-legende');
    const u = (n) => comparerUnite(n);
    let html = '', leg = '';
    if (comparerVue === 'commune') {
        if (!ref) {
            html = `<p class="comparer-invite">Choisissez ${comparerEstEPCI() ? 'un EPCI' : 'une commune'} dans la liste à gauche, ou cliquez sur la carte.</p>`;
            leg = `<div class="comparer-legende-ligne">Aucune sélection</div>`;
        } else {
            const ef = poids ? poids.effectifs : effectifsUnite(cmp, ref);
            const idTxt = ef.identiques ? ` · ${ef.identiques} ${poids ? 'à égalité' : 'au profil identique'}` : '';
            const lib = poids ? COMPARER_LIBELLES_POIDS : COMPARER_LIBELLES;
            const pastille = (c) => `<span class="comparer-pastille" style="background:${c}"></span>`;
            const ligneRang = `<p class="comparer-ligne-rang"><strong>${comparerEch(ref)}</strong> : ${comparerLigneRang(calcul, ref)}</p>`;
            if (poids) {
                html = ligneRang +
                    `<p class="comparer-ligne-rang">Avec la pondération Opp ${comparerPct(comparerPoids[0])} · Cho ${comparerPct(comparerPoids[1])} · Vec ${comparerPct(comparerPoids[2])} : <strong>${comparerEch(ref)} est ${ordinalFr(poids.rang)}</strong>.</p>` +
                    `<p class="comparer-effectifs">${pastille(COMPARER_COULEURS.mieux)}${ef.mieux} ${u(ef.mieux)} ${ef.mieux > 1 ? 'passent' : 'passe'} devant · ${pastille(COMPARER_COULEURS.moins)}${ef.moins} ${ef.moins > 1 ? 'sont derrière' : 'est derrière'}${idTxt}</p>` +
                    `<p class="comparer-phrase">Plus de gris : avec une pondération donnée, chaque commune est devant, derrière ou à égalité. Celles qui faisaient mieux (ou moins bien) sur les trois dimensions restent du même côté, quelle que soit la pondération.</p>`;
            } else {
                html = ligneRang +
                    `<p class="comparer-effectifs">${pastille(COMPARER_COULEURS.mieux)}${ef.mieux} ${u(ef.mieux)} ${ef.mieux > 1 ? 'font' : 'fait'} mieux partout · ` +
                    `${pastille(COMPARER_COULEURS.moins)}${ef.moins} moins bien partout · ` +
                    `${pastille(COMPARER_COULEURS.depend)}${ef.depend} : ça dépend${idTxt}</p>` +
                    `<p class="comparer-phrase">${COMPARER_PHRASE}</p>`;
            }
            const ligne = (c, txt, n) => `<div class="comparer-legende-ligne"><span class="comparer-pastille" style="background:${c}"></span>${txt} — ${n}</div>`;
            leg = `<div class="comparer-legende-titre">${poids ? 'Avec la pondération choisie, face à' : 'Par rapport à'} ${comparerEch(ref)}</div>` +
                ligne(COMPARER_COULEURS.mieux, lib.mieux, ef.mieux) + ligne(COMPARER_COULEURS.moins, lib.moins, ef.moins) +
                (poids ? '' : ligne(COMPARER_COULEURS.depend, lib.depend, ef.depend)) + (ef.identiques ? ligne(COMPARER_COULEURS.identique, lib.identique, ef.identiques) : '') +
                `<div class="comparer-legende-ligne"><span class="comparer-pastille" style="background:${COMPARER_COULEURS.ref}"></span>${comparerEch(ref)} (sélectionnée)</div>`;
        }
    } else {
        const tri = cmp.noms.map(nom => largeurs[nom]).sort((a, b) => a - b);
        const mediane = tri.length % 2 ? tri[(tri.length - 1) / 2] : (tri[tri.length / 2 - 1] + tri[tri.length / 2]) / 2;
        const effectifs = COMPARER_RAMPE_LARGEUR.map(() => 0);
        cmp.noms.forEach(nom => { effectifs[comparerClasseLargeur(largeurs[nom], seuils)]++; });
        const noms = [`moins de ${seuils[0]} places`, `de ${seuils[0]} à ${seuils[1] - 1} places`, `de ${seuils[1]} à ${seuils[2] - 1} places`, `de ${seuils[2]} à ${seuils[3] - 1} places`, `${seuils[3]} places ou plus`];
        html = `<p class="comparer-ligne-rang">Largeur de la fourchette = pire rang possible − meilleur rang possible. Plus elle est étroite, plus le rang de ${comparerEstEPCI() ? 'l\'EPCI' : 'la commune'} est solide ; plus elle est large, plus il dépend de la façon de pondérer.</p>` +
            `<p class="comparer-effectifs">Largeur minimale ${tri[0]} · médiane ${mediane} · maximale ${tri[tri.length - 1]} (sur ${cmp.n - 1} possibles)</p>` +
            (ref ? `<p class="comparer-ligne-rang"><strong>${comparerEch(ref)}</strong> : ${comparerLigneRang(calcul, ref)}</p>` : '');
        leg = `<div class="comparer-legende-titre">Largeur de la fourchette</div>` +
            effectifs.map((n, i) => `<div class="comparer-legende-ligne"><span class="comparer-pastille" style="background:${COMPARER_RAMPE_LARGEUR[i]}"></span>${noms[i]} — ${n}</div>`).join('');
    }
    if (cmp.exclues.length) leg += `<div class="comparer-legende-ligne comparer-petit">${cmp.exclues.length} ${u(cmp.exclues.length)} sans score complet : non comparée${cmp.exclues.length > 1 ? 's' : ''}</div>`;
    resume.innerHTML = html;
    legende.innerHTML = leg;
}

// Appelée à chaque (re)sélection ou recalcul : redessine si l'onglet a déjà été ouvert
function rafraichirComparer(nom) {
    if (nom !== undefined) comparerRef = nom || null;
    if (!comparerInitialise) return;
    if (!geoUnites() || !scoresParCommune || Object.keys(scoresParCommune).length === 0) return;
    comparerRemplir();
}

function initialiserOngletComparer() {
    if (comparerInitialise) {
        setTimeout(() => { if (_carteComparer) _carteComparer.invalidateSize(); }, 100);
        rafraichirComparer();
        return;
    }
    if (!geoUnites() || !scoresParCommune || Object.keys(scoresParCommune).length === 0) { console.warn('Comparer: données non prêtes'); return; }
    comparerInitialise = true;
    const liste = document.getElementById('communeSelect');
    if (liste && liste.value) comparerRef = liste.value;
    _carteComparer = L.map(document.getElementById('map-comparer'), { center: [42.0, 9.0], zoom: 8, zoomSnap: 0.1, zoomDelta: 0.1 });
    _carteComparer.getContainer().style.backgroundColor = '#ffffff';
    ajouterCopyright(_carteComparer);
    document.querySelectorAll('input[name="comparer-vue"]').forEach(r => r.addEventListener('change', () => {
        comparerVue = r.value;
        comparerRemplir();
    }));
    comparerInitialiserPoids();
    if (liste) liste.addEventListener('change', () => rafraichirComparer(liste.value));
    comparerRemplir();
    _carteComparer.fitBounds(comparerCouche.getBounds(), { padding: [8, 8], animate: false });
    invaliderTailleApres(_carteComparer);
}

// ---------- Pondération jouable (Opp, Cho, Vec) ----------
const COMPARER_CURSEURS = ['comparer-p-opp', 'comparer-p-cho', 'comparer-p-vec'];

function comparerLirePoids() {
    const v = COMPARER_CURSEURS.map(id => Number(document.getElementById(id).value));
    const somme = v.reduce((a, b) => a + b, 0);
    return somme > 0 ? v.map(x => x / somme) : [1 / 3, 1 / 3, 1 / 3];
}

function comparerAfficherPoids() {
    const p = comparerLirePoids();
    COMPARER_CURSEURS.forEach((id, i) => { document.getElementById(id + '-val').textContent = comparerPct(p[i]); });
}

function comparerPositionnerCurseurs(p) {
    COMPARER_CURSEURS.forEach((id, i) => { document.getElementById(id).value = Math.round(p[i] * 1000); });
    comparerAfficherPoids();
}

function comparerInitialiserPoids() {
    if (!document.getElementById(COMPARER_CURSEURS[0])) return;
    const poidsRetenus = () => comparerPositionnerCurseurs(referencePk(modeCalculPk).pk);
    poidsRetenus();
    COMPARER_CURSEURS.forEach(id => document.getElementById(id).addEventListener('input', comparerAfficherPoids));
    document.getElementById('comparer-recalculer').addEventListener('click', () => { comparerPoids = comparerLirePoids(); comparerRemplir(); });
    document.getElementById('comparer-poids-betti').addEventListener('click', () => comparerPositionnerCurseurs(referencePk('betti').pk));
    document.getElementById('comparer-poids-egaux').addEventListener('click', () => comparerPositionnerCurseurs([1 / 3, 1 / 3, 1 / 3]));
    document.getElementById('comparer-poids-retour').addEventListener('click', () => { comparerPoids = null; poidsRetenus(); comparerRemplir(); });
}
