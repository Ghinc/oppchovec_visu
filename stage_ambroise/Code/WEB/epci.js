// Onglet « EPCI » : indice OppChoVec agrégé par intercommunalité (19 EPCI de Corse).
// Données : epci_agregation.json (membres de chaque EPCI et population de chaque commune au millésime de chaque indicateur), epci_corse.geojson (contours) ;
// produits par construire_epci_agregation.py. Chargé avant script.js ; les fonctions de calcul de l'appli (normaliserDonnees, calculerScoresParCommune,
// scoresDimension0a10, calculerIndiceBienEtre, referencePk) et les globales (indicateursCommune, bornesRef, modeCalculPk, seuilsJenks, colorsJenks) ne sont lues qu'à l'appel.
//
// Méthode : 1. chaque indicateur brut est agrégé par EPCI, 2. les indicateurs agrégés passent par la MÊME chaîne que les communes (mêmes bornes min-max figées, mêmes poids p_k,
// même passage à 0-10, mêmes classes de Jenks) : un EPCI est donc directement comparable aux communes.
// Deux méthodes d'agrégation d'un indicateur :
//   * pro rata du nombre d'habitants : moyenne des communes pondérée par leur population AU MILLÉSIME DE CET INDICATEUR ;
//   * moyenne simple : chaque commune compte pour 1.

const EPCI_INDICATEURS = ['Opp1', 'Opp2', 'Opp3', 'Opp4', 'Cho1', 'Cho2', 'Vec1', 'Vec2', 'Vec3', 'Vec4'];
const EPCI_VARIABLES = { oppchovec: 'Indice OppChoVec', opp: 'Opportunités (Opp)', cho: 'Choix (Cho)', vec: 'Vécu (Vec)' };
const EPCI_CHAMP_SCORE = { oppchovec: 'OppChoVec', opp: 'Score_Opp', cho: 'Score_Cho', vec: 'Score_Vec' };

let epciDonnees = null;            // epci_agregation.json
let epciContours = null;           // epci_corse.geojson
let epciCarte = null;
let epciCouche = null;
let epciInitialise = false;
let epciEnCours = false;
let epciVariable = 'oppchovec';
let epciSelection = null;          // siren
let epciCommune = null;            // commune cliquée (nom), dans l'EPCI sélectionné
let epciCoucheCommunes = null;
let epciDe = {};                   // { commune: siren }
let epciChargement = null;         // promesse de chargement en cours (partagée par l'onglet et la case « EPCI »)

// Échelle d'analyse de toute l'appli (case « EPCI » de la barre du haut) : 'commune' | 'epci-pop' (pro rata du nombre d'habitants) | 'epci-commune' (moyenne simple)
let echelleEpci = 'commune';
let epciBase = { indice: {}, scores: {} };     // indice et scores 0-10 des COMMUNES : restent disponibles quand les variables de l'appli (indiceFinale, scoresParCommune) portent les EPCI
let epciGeoVue = null;                         // contours des EPCI au format attendu par les cartes de l'appli (properties.nom = nom de l'EPCI)
let epciResultats = { prorata: {}, simple: {} };

// ---------- Calculs purs ----------

// Indicateurs agrégés par EPCI : { siren: { Indicateur_Opp1: valeur, ... } }
// indicateurs : { commune: { Indicateur_Opp1: valeur, ... } } ; epcis : liste de epci_agregation.json ; prorata : true = pondéré par la population du millésime de l'indicateur, false = moyenne simple
function epciAgreger(indicateurs, epcis, prorata) {
    const sortie = {};
    for (const e of epcis) {
        const agg = {};
        for (const k of EPCI_INDICATEURS) {
            let somme = 0, poids = 0;
            for (const [nom, c] of Object.entries(e.communes)) {
                const v = indicateurs[nom] && Number(indicateurs[nom]['Indicateur_' + k]);
                if (v === undefined || v === null || !isFinite(v)) continue;
                const w = prorata ? c.pop[k] : 1;
                somme += w * v;
                poids += w;
            }
            agg['Indicateur_' + k] = poids > 0 ? somme / poids : NaN;
        }
        sortie[e.siren] = agg;
    }
    return sortie;
}

// Poids de chaque commune d'un EPCI dans l'agrégation d'un indicateur : { commune: part entre 0 et 1 } (somme = 1)
// pro rata : population de la commune au millésime de l'indicateur / population de l'EPCI à ce millésime ; simple : 1 / nombre de communes
function epciPoids(e, k, prorata) {
    const total = Object.values(e.communes).reduce((t, c) => t + (prorata ? c.pop[k] : 1), 0);
    const sortie = {};
    for (const [nom, c] of Object.entries(e.communes)) sortie[nom] = (prorata ? c.pop[k] : 1) / total;
    return sortie;
}

// Scores des EPCI (0-10) avec la chaîne de calcul de l'appli : { siren: { agregats, oppchovec, opp, cho, vec } }
function epciCalculer(prorata) {
    const agg = epciAgreger(indicateursCommune, epciDonnees.epci, prorata);
    const ref = referencePk(modeCalculPk);
    const scores01 = calculerScoresParCommune(normaliserDonnees(agg, bornesRef.min, bornesRef.max));
    const dims = scoresDimension0a10(scores01);
    const brut = calculerIndiceBienEtre(scores01, ref.pk);
    const sortie = {};
    for (const siren of Object.keys(agg)) {
        sortie[siren] = {
            agregats: agg[siren],
            oppchovec: ref.max === ref.min ? 5 : (brut[siren] - ref.min) / (ref.max - ref.min) * 10,
            opp: dims[siren].Score_Opp, cho: dims[siren].Score_Cho, vec: dims[siren].Score_Vec,
        };
    }
    return sortie;
}

function epciClasse(valeur, seuils) {
    for (let i = 1; i < seuils.length; i++) if (valeur <= seuils[i]) return i - 1;
    return seuils.length - 2;
}

// ---------- Affichage ----------

const epciFmt = (x, d = 2) => Number(x).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const epciEch = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const epciProrata = () => document.getElementById('epci-prorata').checked;
const epciMethode = () => (epciProrata() ? 'prorata' : 'simple');

function epciCouleur(siren) {
    const seuils = seuilsJenks[epciVariable];
    return colorsJenks[epciClasse(epciResultats[epciMethode()][siren][epciVariable], seuils)];
}

function epciStyle(siren) {
    return { fillColor: epciCouleur(siren), color: siren === epciSelection ? '#d00000' : '#222', weight: siren === epciSelection ? 3 : 1.4, fillOpacity: 0.85 };
}

function epciStyleCommune(nom) {
    const choisie = nom === epciCommune;
    const dansEpci = epciSelection && epciDe[nom] === epciSelection;
    return { fill: true, fillColor: '#ffffff', fillOpacity: 0, color: choisie ? '#0b3d91' : '#666', weight: choisie ? 3 : dansEpci ? 0.9 : 0.4, interactive: true };
}

function epciNom(siren) { return epciDonnees.epci.find(e => e.siren === siren).nom; }

function epciInfobulle(siren) {
    const e = epciDonnees.epci.find(x => x.siren === siren);
    const r = epciResultats[epciMethode()][siren];
    return `<strong>${epciEch(e.nom)}</strong><br>${EPCI_VARIABLES[epciVariable]} : <strong>${epciFmt(r[epciVariable])}</strong><br>${e.nb_communes} communes · ${epciFmt(e.population_2023, 0)} habitants`;
}

function epciInfobulleCommune(nom) {
    const e = epciDonnees.epci.find(x => x.siren === epciDe[nom]);
    const r = epciResultats[epciMethode()][e.siren];
    return `<strong>${epciEch(nom)}</strong> · ${epciFmt(e.communes[nom].pop.Cho2, 0)} hab.<br>${epciEch(e.nom)} : ${EPCI_VARIABLES[epciVariable]} <strong>${epciFmt(r[epciVariable])}</strong>`;
}

function epciLegende() {
    const seuils = seuilsJenks[epciVariable];
    const lib = [];
    for (let i = 0; i < seuils.length - 1; i++) lib.push(i === 0 ? `≤ ${epciFmt(seuils[1])}` : i === seuils.length - 2 ? `> ${epciFmt(seuils[i])}` : `${epciFmt(seuils[i])} – ${epciFmt(seuils[i + 1])}`);
    document.getElementById('epci-legende').innerHTML =
        `<h3>${EPCI_VARIABLES[epciVariable]} (0-10)</h3>` +
        lib.map((l, i) => `<div class="epci-classe"><i style="background:${colorsJenks[i]}"></i>${l}</div>`).join('') +
        `<div class="epci-petit">Mêmes classes de Jenks que la carte des communes. ${epciProrata() ? 'Pro rata du nombre d\'habitants.' : 'Moyenne simple.'}</div>`;
}

function epciTableau() {
    const m = epciMethode(), autre = m === 'prorata' ? 'simple' : 'prorata';
    const lignes = epciDonnees.epci.map(e => ({ e, v: epciResultats[m][e.siren][epciVariable], w: epciResultats[autre][e.siren][epciVariable] })).sort((a, b) => b.v - a.v);
    document.getElementById('epci-tableau').innerHTML =
        `<table class="epci-table"><tr><th>EPCI</th><th>Communes</th><th>Habitants</th><th>${m === 'prorata' ? 'Pro rata' : 'Simple'}</th><th title="Résultat avec l'autre méthode">${m === 'prorata' ? 'Simple' : 'Pro rata'}</th></tr>` +
        lignes.map(({ e, v, w }) => `<tr class="epci-ligne${e.siren === epciSelection ? ' selectionne' : ''}" data-siren="${e.siren}" tabindex="0"><td>${epciEch(e.nom)}</td><td>${e.nb_communes}</td><td>${epciFmt(e.population_2023, 0)}</td><td><strong>${epciFmt(v)}</strong></td><td class="epci-autre">${epciFmt(w)}</td></tr>`).join('') +
        `</table>`;
}

// Détail d'une commune dans l'agrégation de son EPCI : ses valeurs, son poids selon chaque méthode et l'écart avec l'EPCI
function epciCommuneHtml(e, nom) {
    const v = indicateursCommune[nom] || {}, sc = epciBase.scores[nom] || scoresParCommune[nom], occ = epciBase.indice[nom] !== undefined ? epciBase.indice[nom] : indiceFinale[nom];
    const p = epciResultats.prorata[e.siren], s = epciResultats.simple[e.siren];
    const pct = x => epciFmt(100 * x, 1) + ' %';
    const fleche = (a, b) => (a > b ? '<span class="epci-hausse" title="au-dessus de l\'EPCI">▲</span>' : a < b ? '<span class="epci-baisse" title="en dessous de l\'EPCI">▼</span>' : '＝');
    const scores = [['Indice OppChoVec', occ, p.oppchovec, s.oppchovec], ['Opportunités (Opp)', sc.Score_Opp, p.opp, s.opp], ['Choix (Cho)', sc.Score_Cho, p.cho, s.cho], ['Vécu (Vec)', sc.Score_Vec, p.vec, s.vec]]
        .map(([lib, a, b, c]) => `<tr><td>${lib}</td><td><strong>${epciFmt(a)}</strong></td><td>${epciFmt(b)}</td><td>${epciFmt(c)}</td></tr>`).join('');
    const lignes = EPCI_INDICATEURS.map(k => {
        const val = Number(v['Indicateur_' + k]), dec = (k === 'Opp3' || k === 'Vec1' || k === 'Vec4') ? 0 : 2;
        const a = p.agregats['Indicateur_' + k], b = s.agregats['Indicateur_' + k];
        return `<tr><td>${k}</td><td><strong>${epciFmt(val, dec)}</strong></td><td>${epciFmt(a, dec)} ${fleche(val, a)}</td><td>${epciFmt(b, dec)} ${fleche(val, b)}</td><td>${pct(epciPoids(e, k, true)[nom])}</td><td>${pct(epciPoids(e, k, false)[nom])}</td></tr>`;
    }).join('');
    const poidsPop = epciPoids(e, 'Cho2', true)[nom];
    return `<div class="epci-commune"><h4>Commune : ${epciEch(nom)}</h4>` +
        `<div class="epci-petit">${epciFmt(e.communes[nom].pop.Cho2, 0)} habitants (2022), soit <strong>${pct(poidsPop)}</strong> de la population de ${epciEch(e.nom)} : en pro rata elle pèse ce poids dans chaque moyenne, contre ${pct(1 / e.nb_communes)} en moyenne simple (1 commune sur ${e.nb_communes}).</div>` +
        `<table class="epci-table"><tr><th>Scores (0-10)</th><th>Commune</th><th>EPCI pro rata</th><th>EPCI simple</th></tr>${scores}</table>` +
        `<table class="epci-table"><tr><th>Indicateurs</th><th>Commune</th><th>EPCI pro rata</th><th>EPCI simple</th><th>Poids pro rata</th><th>Poids simple</th></tr>${lignes}</table>` +
        `<div class="epci-petit">▲ ▼ : la commune est au-dessus ou en dessous de la valeur de l'EPCI. Le poids pro rata est la part de la population de l'EPCI, au millésime de l'indicateur. Les valeurs de la commune sont celles de l'appli (curseurs compris).</div></div>`;
}

// HTML de la fiche d'un EPCI (scores et indicateurs agrégés selon les deux méthodes, communes membres) ; commune : détail d'une commune de l'EPCI, ou null
function epciFicheHtml(e, commune) {
    const p = epciResultats.prorata[e.siren], s = epciResultats.simple[e.siren];
    const scores = Object.entries(EPCI_VARIABLES).map(([k, lib]) => `<tr><td>${lib}</td><td>${epciFmt(p[k])}</td><td>${epciFmt(s[k])}</td><td>${(p[k] - s[k] >= 0 ? '+' : '') + epciFmt(p[k] - s[k])}</td></tr>`).join('');
    const brut = EPCI_INDICATEURS.map(k => {
        const a = p.agregats['Indicateur_' + k], b = s.agregats['Indicateur_' + k];
        const dec = (k === 'Opp3' || k === 'Vec1' || k === 'Vec4') ? 0 : 2;
        return `<tr><td>${k}</td><td>${epciFmt(a, dec)}</td><td>${epciFmt(b, dec)}</td><td class="epci-petit">pop. ${epciDonnees.millesimes[k]}${epciDonnees.millesime_approche[k] ? ' *' : ''}</td></tr>`;
    }).join('');
    const communes = Object.entries(e.communes).sort((a, b) => b[1].pop.Cho2 - a[1].pop.Cho2).map(([nom, c]) => `<a href="#" class="epci-lien-commune" data-commune="${epciEch(nom)}">${epciEch(nom)}</a> (${epciFmt(c.pop.Cho2, 0)})`).join(', ');
    return (commune && e.communes[commune] ? epciCommuneHtml(e, commune) : '') + `<h4>${epciEch(e.nom)}</h4><div class="epci-petit">${e.nature} · fiscalité ${e.fiscalite} · ${e.nb_communes} communes · ${epciFmt(e.population_2023, 0)} habitants (2023)</div>` +
        `<table class="epci-table"><tr><th>Scores (0-10)</th><th>Pro rata</th><th>Simple</th><th>Écart</th></tr>${scores}<tr><th>Indicateurs agrégés</th><th>Pro rata</th><th>Simple</th><th>Pondération</th></tr>${brut}</table>` +
        `<div class="epci-petit">* population la plus récente publiée (2023) : millésime de la source non daté ou plus récent que les populations disponibles.</div>` +
        `<div class="epci-petit"><strong>Communes</strong> (habitants 2022) : ${communes}</div>`;
}

function epciFiche() {
    const el = document.getElementById('epci-fiche');
    if (!epciSelection) { el.innerHTML = '<span class="epci-petit">Cliquez sur un EPCI (carte ou tableau) pour voir ses indicateurs et ses communes.</span>'; return; }
    el.innerHTML = epciFicheHtml(epciDonnees.epci.find(x => x.siren === epciSelection), epciCommune);
}

function epciRedessiner() {
    if (!epciInitialise) return;
    epciResultats = { prorata: epciCalculer(true), simple: epciCalculer(false) };
    epciCouche.eachLayer(l => { l.setStyle(epciStyle(l._epciSiren)); l.setTooltipContent(epciInfobulle(l._epciSiren)); });
    epciCoucheCommunes.eachLayer(l => { l.setStyle(epciStyleCommune(l._epciCommune)); l.setTooltipContent(epciInfobulleCommune(l._epciCommune)); });
    epciLegende();
    epciTableau();
    epciFiche();
    document.getElementById('epci-methode').textContent = epciProrata() ? 'pro rata du nombre d\'habitants' : 'moyenne simple';
}

function rafraichirEPCI() { epciRedessiner(); }       // appelé par script.js quand p_k ou les indicateurs changent

function epciRestyler() {
    epciCouche.eachLayer(l => { l.setStyle(epciStyle(l._epciSiren)); if (l._epciSiren === epciSelection) l.bringToFront(); });
    epciCoucheCommunes.eachLayer(l => { l.setStyle(epciStyleCommune(l._epciCommune)); if (l._epciCommune === epciCommune) l.bringToFront(); });
    epciTableau();
    epciFiche();
}

function epciSelectionner(siren) {            // clic sur un EPCI (tableau)
    epciSelection = siren;
    epciCommune = null;
    epciRestyler();
}

function epciSelectionnerCommune(nom) {        // clic sur une commune (carte ou liste) : son EPCI est sélectionné et son détail s'affiche
    epciSelection = epciDe[nom];
    epciCommune = nom;
    epciRestyler();
}

// Charge epci_agregation.json et epci_corse.geojson (une seule fois, même si l'onglet et la case « EPCI » le demandent en même temps)
async function epciChargerDonnees() {
    if (epciDonnees && epciContours) return true;
    if (!epciChargement) {
        epciChargement = (async () => {
            try {
                const v = '?v=20261017a';
                const [r1, r2] = await Promise.all([fetch(BASE_PATH + 'epci_agregation.json' + v), fetch(BASE_PATH + 'epci_corse.geojson' + v)]);
                if (!r1.ok || !r2.ok) throw new Error(`HTTP ${r1.status} / ${r2.status}`);
                epciDonnees = await r1.json();
                epciContours = await r2.json();
                for (const e of epciDonnees.epci) for (const nom of Object.keys(e.communes)) epciDe[nom] = e.siren;
                return true;
            } catch (e) {
                console.warn('EPCI : données non chargées', e);
                return false;
            } finally {
                epciChargement = null;
            }
        })();
    }
    return epciChargement;
}

async function initialiserOngletEPCI() {
    if (epciEnCours) return;
    if (epciInitialise) { setTimeout(() => { epciCarte.invalidateSize(); epciCarte.fitBounds(epciCouche.getBounds(), { padding: [8, 8], animate: false }); }, 150); return; }
    if (typeof bornesRef === 'undefined' || !bornesRef || typeof communeJson === 'undefined' || !communeJson || !communeJson.features) {          // indicateurs ou géométries pas encore chargés : on réessaie
        setTimeout(() => { if (document.getElementById('epcitab').classList.contains('active')) initialiserOngletEPCI(); }, 400);
        return;
    }
    epciEnCours = true;
    if (!(await epciChargerDonnees())) {
        document.getElementById('epci-fiche').textContent = 'Données des EPCI indisponibles.';
        epciEnCours = false;
        return;
    }
    epciInitialise = true;
    epciEnCours = false;
    epciCarte = L.map(document.getElementById('map-epci'), { center: [42.0, 9.0], zoom: 7.4, zoomSnap: 0.1, zoomDelta: 0.1, attributionControl: false });
    epciCarte.getContainer().style.backgroundColor = '#ffffff';
    epciResultats = { prorata: epciCalculer(true), simple: epciCalculer(false) };
    epciCouche = L.geoJSON(epciContours, {
        style: f => epciStyle(f.properties.siren),
        onEachFeature: (f, layer) => {
            layer._epciSiren = f.properties.siren;
            layer.bindTooltip(epciInfobulle(f.properties.siren), { sticky: true });
            layer.on('click', () => epciSelectionner(f.properties.siren));
        },
    }).addTo(epciCarte);
    epciCoucheCommunes = L.geoJSON(communeJson, {          // communes au-dessus des EPCI : le clic ouvre le détail de la commune
        style: f => epciStyleCommune(f.properties.nom),
        onEachFeature: (f, layer) => {
            const nom = f.properties.nom;
            layer._epciCommune = nom;
            layer.bindTooltip(epciInfobulleCommune(nom), { sticky: true });
            layer.on('click', () => epciSelectionnerCommune(nom));
        },
    }).addTo(epciCarte);
    document.getElementById('epci-fiche').addEventListener('click', e => { const a = e.target.closest('.epci-lien-commune'); if (a) { e.preventDefault(); epciSelectionnerCommune(a.dataset.commune); } });
    document.getElementById('epci-prorata').addEventListener('change', epciRedessiner);
    document.getElementById('epci-variable').addEventListener('change', function () { epciVariable = this.value; epciRedessiner(); });
    document.getElementById('epci-tableau').addEventListener('click', e => { const l = e.target.closest('.epci-ligne'); if (l) epciSelectionner(l.dataset.siren); });
    document.getElementById('epci-tableau').addEventListener('keydown', e => { const l = e.target.closest('.epci-ligne'); if (l && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); epciSelectionner(l.dataset.siren); } });
    epciRedessiner();
    setTimeout(() => { epciCarte.invalidateSize(); epciCarte.fitBounds(epciCouche.getBounds(), { padding: [8, 8], animate: false }); }, 150);
}

// ---------- Échelle d'analyse de toute l'appli : case « EPCI » ----------
// Quand elle est cochée, les unités affichées par l'appli deviennent les EPCI : les cartes OppChoVec / Opp / Cho / Vec, le top 10 et l'histogramme, le panneau de sélection et les parangons.
// Les communes restent la base du calcul (indicateurs, bornes figées, p_k). Les analyses qui reposent sur des données communales (LISA, CAH, Entreprises, Corrélation, Évolution) affichent un bandeau.
const echelleEstEPCI = () => echelleEpci !== 'commune';

function epciMemoriserBase(indice, scores) { epciBase = { indice, scores }; }      // appelé par script.js avant de remplacer les unités affichées

function epciConstruireGeoVue() {
    epciGeoVue = { type: 'FeatureCollection', features: epciContours.features.map(f => ({ type: 'Feature', geometry: f.geometry, properties: { nom: f.properties.nom, siren: f.properties.siren } })) };
}

// Unités affichées : communes ou EPCI (contours, indice 0-10 et scores 0-10 par nom d'unité)
function epciVue() {
    epciResultats = { prorata: epciCalculer(true), simple: epciCalculer(false) };         // les deux méthodes : la fiche d'un EPCI les compare
    const r = epciResultats[echelleEpci === 'epci-pop' ? 'prorata' : 'simple'];
    const indice = {}, scores = {};
    for (const e of epciDonnees.epci) {
        indice[e.nom] = r[e.siren].oppchovec;
        scores[e.nom] = { Score_Opp: r[e.siren].opp, Score_Cho: r[e.siren].cho, Score_Vec: r[e.siren].vec };
    }
    return { geo: epciGeoVue, indice, scores };
}

function geoUnites() { return echelleEstEPCI() && epciGeoVue ? epciGeoVue : communeJson; }

function epciAfficherDansPanneau(nom) {         // panneau « sélection » de la barre latérale : fiche de l'EPCI choisi
    for (const c of Dejasurligner.splice(0)) reinitialiserStyleCommune(c, indicateursCommune);
    surlignerCommune(nom, 'red');
    const e = epciDonnees.epci.find(x => x.nom === nom);
    document.getElementById('resultCommune').innerHTML = e ? epciFicheHtml(e, null) : '<p style="color:red;">❌ Données introuvables pour cet EPCI.</p>';
}

const EPCI_ONGLETS_NON_DISPONIBLES = {       // analyses qui reposent sur des données communales (l'Évolution a sa version EPCI : evolution.js)
    lisatab: 'L\'autocorrélation spatiale (LISA) est calculée par commune.',
    cahtab: 'La classification (CAH) est calculée par commune.',
    entreprisestab: 'La densité entrepreneuriale est une donnée communale.',
    correlationtab: 'Les corrélations s\'appuient sur des données communales (densité d\'entreprises, enquête de bien-être).',
};

function epciInstallerBandeaux() {
    for (const [id, raison] of Object.entries(EPCI_ONGLETS_NON_DISPONIBLES)) {
        const onglet = document.getElementById(id);
        if (!onglet || onglet.querySelector('.epci-indisponible')) continue;
        const b = document.createElement('div');
        b.className = 'epci-indisponible';
        b.innerHTML = `<strong>Analyse non disponible à l'échelle de l'EPCI.</strong> ${raison} Décochez « EPCI » dans la barre du haut pour revenir aux communes.`;
        onglet.insertBefore(b, onglet.firstChild);
    }
}

// Les deux cases du haut (EPCI pro rata des habitants / EPCI pro rata des communes) ; aucune cochée = communes
function epciMajControle() {
    const pop = document.getElementById('echelle-epci-pop'), com = document.getElementById('echelle-epci-commune');
    if (!pop || !com) return;
    pop.checked = echelleEpci === 'epci-pop';
    com.checked = echelleEpci === 'epci-commune';
    document.body.classList.toggle('mode-echelle-epci', echelleEstEPCI());
    const etat = document.getElementById('echelle-epci-etat');
    if (etat) etat.textContent = echelleEpci === 'epci-pop' ? 'moyennes pondérées par la population' : echelleEpci === 'epci-commune' ? 'moyennes simples (1 commune = 1)' : 'communes';
}

// Change l'échelle d'analyse de toute l'appli ('commune' | 'epci-pop' | 'epci-commune') ; renvoie false si elle n'a pas pu être changée
async function changerEchelle(mode) {
    if (mode !== 'commune') {
        const pret = typeof bornesRef !== 'undefined' && bornesRef;
        if (!pret || !(await epciChargerDonnees())) { epciMajControle(); return false; }
        document.getElementById('epci-prorata').checked = mode === 'epci-pop';
    }
    echelleEpci = mode;
    if (mode !== 'commune') epciConstruireGeoVue();
    epciMajControle();
    const noms = mode === 'commune' ? Object.keys(indicateursCommune) : epciDonnees.epci.map(e => e.nom);
    populateCommuneSelect(Object.fromEntries(noms.map(n => [n, 1])));
    document.getElementById('resultCommune').innerHTML = '';
    for (const c of Dejasurligner.splice(0)) reinitialiserStyleCommune(c, indicateursCommune);
    recalculerCarteOppChoVec();                 // redessine toutes les analyses avec les unités de la nouvelle échelle
    if (typeof evolutionAppliquerEchelle === 'function') evolutionAppliquerEchelle();          // la série d'évolution suit aussi (série EPCI ou communale)
    return true;
}

// Ouverture de l'onglet : initialisation ici (après le changement d'onglet fait par script.js) ; panneau latéral masqué dans cet onglet
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', () => {
        epciInstallerBandeaux();
        const casePop = document.getElementById('echelle-epci-pop'), caseCommune = document.getElementById('echelle-epci-commune');
        if (casePop && caseCommune) {
            casePop.addEventListener('change', () => changerEchelle(casePop.checked ? 'epci-pop' : 'commune'));
            caseCommune.addEventListener('change', () => changerEchelle(caseCommune.checked ? 'epci-commune' : 'commune'));
            document.getElementById('epci-prorata').addEventListener('change', () => {       // même méthode que l'onglet EPCI : la case de l'onglet et les cases du haut restent synchronisées
                if (echelleEstEPCI()) changerEchelle(document.getElementById('epci-prorata').checked ? 'epci-pop' : 'epci-commune'); else epciMajControle();
            });
        }
        document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => {
            document.body.classList.toggle('mode-epci', b.getAttribute('data-tab') === 'epcitab');
            if (b.getAttribute('data-tab') === 'epcitab') setTimeout(initialiserOngletEPCI, 0);
            setTimeout(() => { window.dispatchEvent(new Event('resize')); if (epciCarte) epciCarte.invalidateSize(); }, 150);
        }));
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { epciAgreger, epciPoids, epciClasse, EPCI_INDICATEURS, EPCI_ONGLETS_NON_DISPONIBLES };
}
