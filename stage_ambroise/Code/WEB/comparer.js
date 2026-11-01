// Onglet « Comparer ma commune » et ligne « rang / fourchette de rang » du panneau latéral.
// Calculs dans rang_fourchette.js ; ce fichier ne fait que l'affichage (carte Leaflet, légende, bulles) et lit les globales de l'appli
// (scoresParCommune, indiceFinale et geoUnites() suivent l'échelle : communes ou EPCI, et les modifications faites avec les curseurs).

let comparerInitialise = false;
let _carteComparer = null;          // carte Leaflet (hors synchronisation des autres cartes)
let comparerCouche = null;
let comparerVue = 'commune';        // 'commune' : ma commune face aux autres ; 'largeur' : largeur de la fourchette de rang
let comparerRef = null;             // commune (ou EPCI) de référence
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

// Bulle au survol de `nom` : ses trois scores à côté de ceux de la commune sélectionnée
function comparerBulle(nom) {
    const e = comparerEtat;
    const titre = `<strong>${comparerEch(nom)}</strong>`;
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
    return `${titre}<br><em>${COMPARER_LIBELLES[e.cat[nom]]}</em>` +
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
    const cat = ref ? categoriesUnite(cmp, ref) : null;
    comparerEtat = { cmp, rangs, ref, cat };
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
            const ef = effectifsUnite(cmp, ref);
            const idTxt = ef.identiques ? ` · ${comparerPluriel(ef.identiques, 'au profil identique', 'au profil identique')}` : '';
            html = `<p class="comparer-ligne-rang"><strong>${comparerEch(ref)}</strong> : ${comparerLigneRang(calcul, ref)}</p>` +
                `<p class="comparer-effectifs"><span class="comparer-pastille" style="background:${COMPARER_COULEURS.mieux}"></span>${ef.mieux} ${u(ef.mieux)} ${ef.mieux > 1 ? 'font' : 'fait'} mieux partout · ` +
                `<span class="comparer-pastille" style="background:${COMPARER_COULEURS.moins}"></span>${ef.moins} moins bien partout · ` +
                `<span class="comparer-pastille" style="background:${COMPARER_COULEURS.depend}"></span>${ef.depend} : ça dépend${idTxt}</p>` +
                `<p class="comparer-phrase">${COMPARER_PHRASE}</p>`;
            const ligne = (c, txt, n) => `<div class="comparer-legende-ligne"><span class="comparer-pastille" style="background:${c}"></span>${txt} — ${n}</div>`;
            leg = `<div class="comparer-legende-titre">Par rapport à ${comparerEch(ref)}</div>` +
                ligne(COMPARER_COULEURS.mieux, COMPARER_LIBELLES.mieux, ef.mieux) + ligne(COMPARER_COULEURS.moins, COMPARER_LIBELLES.moins, ef.moins) +
                ligne(COMPARER_COULEURS.depend, COMPARER_LIBELLES.depend, ef.depend) + (ef.identiques ? ligne(COMPARER_COULEURS.identique, COMPARER_LIBELLES.identique, ef.identiques) : '') +
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
    if (liste) liste.addEventListener('change', () => rafraichirComparer(liste.value));
    comparerRemplir();
    _carteComparer.fitBounds(comparerCouche.getBounds(), { padding: [8, 8], animate: false });
    invaliderTailleApres(_carteComparer);
}
