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
    const v = indicateursCommune[nom] || {}, sc = scoresParCommune[nom], occ = indiceFinale[nom];
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

function epciFiche() {
    const el = document.getElementById('epci-fiche');
    if (!epciSelection) { el.innerHTML = '<span class="epci-petit">Cliquez sur un EPCI (carte ou tableau) pour voir ses indicateurs et ses communes.</span>'; return; }
    const e = epciDonnees.epci.find(x => x.siren === epciSelection);
    const p = epciResultats.prorata[e.siren], s = epciResultats.simple[e.siren];
    const scores = Object.entries(EPCI_VARIABLES).map(([k, lib]) => `<tr><td>${lib}</td><td>${epciFmt(p[k])}</td><td>${epciFmt(s[k])}</td><td>${(p[k] - s[k] >= 0 ? '+' : '') + epciFmt(p[k] - s[k])}</td></tr>`).join('');
    const brut = EPCI_INDICATEURS.map(k => {
        const a = p.agregats['Indicateur_' + k], b = s.agregats['Indicateur_' + k];
        const dec = (k === 'Opp3' || k === 'Vec1' || k === 'Vec4') ? 0 : 2;
        return `<tr><td>${k}</td><td>${epciFmt(a, dec)}</td><td>${epciFmt(b, dec)}</td><td class="epci-petit">pop. ${epciDonnees.millesimes[k]}${epciDonnees.millesime_approche[k] ? ' *' : ''}</td></tr>`;
    }).join('');
    const communes = Object.entries(e.communes).sort((a, b) => b[1].pop.Cho2 - a[1].pop.Cho2).map(([nom, c]) => `<a href="#" class="epci-lien-commune" data-commune="${epciEch(nom)}">${epciEch(nom)}</a> (${epciFmt(c.pop.Cho2, 0)})`).join(', ');
    el.innerHTML = (epciCommune && e.communes[epciCommune] ? epciCommuneHtml(e, epciCommune) : '') + `<h4>${epciEch(e.nom)}</h4><div class="epci-petit">${e.nature} · fiscalité ${e.fiscalite} · ${e.nb_communes} communes · ${epciFmt(e.population_2023, 0)} habitants (2023)</div>` +
        `<table class="epci-table"><tr><th>Scores (0-10)</th><th>Pro rata</th><th>Simple</th><th>Écart</th></tr>${scores}<tr><th>Indicateurs agrégés</th><th>Pro rata</th><th>Simple</th><th>Pondération</th></tr>${brut}</table>` +
        `<div class="epci-petit">* population la plus récente publiée (2023) : millésime de la source non daté ou plus récent que les populations disponibles.</div>` +
        `<div class="epci-petit"><strong>Communes</strong> (habitants 2022) : ${communes}</div>`;
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

async function initialiserOngletEPCI() {
    if (epciEnCours) return;
    if (epciInitialise) { setTimeout(() => { epciCarte.invalidateSize(); epciCarte.fitBounds(epciCouche.getBounds(), { padding: [8, 8], animate: false }); }, 150); return; }
    if (typeof bornesRef === 'undefined' || !bornesRef || typeof communeJson === 'undefined' || !communeJson || !communeJson.features) {          // indicateurs ou géométries pas encore chargés : on réessaie
        setTimeout(() => { if (document.getElementById('epcitab').classList.contains('active')) initialiserOngletEPCI(); }, 400);
        return;
    }
    epciEnCours = true;
    try {
        const v = '?v=20261016b';
        const [r1, r2] = await Promise.all([fetch(BASE_PATH + 'epci_agregation.json' + v), fetch(BASE_PATH + 'epci_corse.geojson' + v)]);
        if (!r1.ok || !r2.ok) throw new Error(`HTTP ${r1.status} / ${r2.status}`);
        epciDonnees = await r1.json();
        epciContours = await r2.json();
    } catch (e) {
        console.warn('EPCI : données non chargées', e);
        document.getElementById('epci-fiche').textContent = 'Données des EPCI indisponibles.';
        epciEnCours = false;
        return;
    }
    epciInitialise = true;
    epciEnCours = false;
    epciCarte = L.map(document.getElementById('map-epci'), { center: [42.0, 9.0], zoom: 7.4, zoomSnap: 0.1, zoomDelta: 0.1, attributionControl: false });
    epciCarte.getContainer().style.backgroundColor = '#ffffff';
    for (const e of epciDonnees.epci) for (const nom of Object.keys(e.communes)) epciDe[nom] = e.siren;
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

// Ouverture de l'onglet : initialisation ici (après le changement d'onglet fait par script.js) ; panneau latéral masqué dans cet onglet
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => {
            document.body.classList.toggle('mode-epci', b.getAttribute('data-tab') === 'epcitab');
            if (b.getAttribute('data-tab') === 'epcitab') setTimeout(initialiserOngletEPCI, 0);
            setTimeout(() => { window.dispatchEvent(new Event('resize')); if (epciCarte) epciCarte.invalidateSize(); }, 150);
        }));
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { epciAgreger, epciPoids, epciClasse, EPCI_INDICATEURS };
}
