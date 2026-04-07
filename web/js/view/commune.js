/**
 * Vue de la sidebar : détail d'une commune, comparaison, liste déroulante.
 *
 * Toutes les fonctions `render*` retournent du HTML (pas de mutation DOM directe).
 * Les fonctions `afficher*` orchestrent rendu + injection dans le DOM.
 */

/**
 * Remplit la liste déroulante de sélection des communes (triée alphabétiquement).
 *
 * @param {Object} data - {nom_commune: ...} (clés = noms de communes)
 */
function populateCommuneSelect(data) {
    const select = document.getElementById('communeSelect');
    select.innerHTML = '<option value="">-- Sélectionner une commune --</option>';

    const triees = Object.keys(data).sort((a, b) => a.localeCompare(b, 'fr'));
    for (const nom of triees) {
        const opt = document.createElement('option');
        opt.value = nom;
        opt.textContent = nom;
        select.appendChild(opt);
    }
}


/**
 * Génère le HTML de la fiche détaillée d'une commune (indicateurs + sliders).
 *
 * @param {string} communeNom   - Nom de la commune
 * @param {number} valeurIndice - OppChoVec 1-10
 * @param {Object} indicateurs  - {Indicateur_*: valeur}
 * @returns {string} HTML de la fiche
 */
function renderCommuneDetails(communeNom, valeurIndice, indicateurs) {
    let html = `
        <p><strong>Commune :</strong> ${communeNom}</p>
        <p><strong>OppChoVec :</strong> ${valeurIndice.toFixed(2)}/10</p>
        <h4>Indicateurs :</h4>
        <ul>`;

    for (const [nomIndicateur, valeur] of Object.entries(indicateurs)) {
        const meta   = INDICATEURS_META[nomIndicateur] || {};
        const nombre = typeof valeur === 'number' ? valeur.toFixed(2) : valeur;
        const step   = meta.step ?? 1;
        const desc   = meta.description ?? 'Aucune description disponible.';
        const min    = meta.min ?? 0;
        const max    = meta.max ?? 100;

        html += `
            <li class="indicateur-row" data-desc="${desc.replace(/"/g, '&quot;')}">
                <div class="indicateur-row-header">
                    <strong>${nomIndicateur}</strong>
                    <span id="${nomIndicateur}_val">${nombre}</span>
                </div>
                <input type="range"
                       id="${nomIndicateur}"
                       value="${nombre}"
                       step="${step}"
                       min="${min}"
                       max="${max}"
                       oninput="document.getElementById('${nomIndicateur}_val').innerText =
                                parseFloat(this.value).toFixed(2)" />
            </li>`;
    }

    html += `
        </ul>
        <div class="commune-actions">
            <button onclick="recalculerIndice('${communeNom}')">&#8635; Recalculer</button>
            <button onclick="reinitialiserValeurs('${communeNom}')">&#8634; Réinitialiser</button>
            <button onclick="afficherComparaison('${communeNom}')">&#128202; Comparer</button>
        </div>
        <div id="comparaisonCommune" style="display:none;margin-top:1em;">
            <h2>3. Sélection commune à comparer</h2>
            <select id="communeSelectComparaison" style="width:100%;padding:0.5em;">
                <option value="">-- Sélectionner une commune --</option>
            </select>
            <button id="validerComparaison" style="margin-top:0.5em;">Valider la comparaison</button>
        </div>`;

    return html;
}


/**
 * Génère le HTML du tableau de comparaison entre deux communes.
 *
 * @param {string} commune1  - Nom de la première commune
 * @param {string} commune2  - Nom de la deuxième commune
 * @param {Object} data1     - {Indicateur_*: valeur} pour commune1
 * @param {Object} data2     - {Indicateur_*: valeur} pour commune2
 * @param {number} indice1   - OppChoVec 1-10 de commune1
 * @param {number} indice2   - OppChoVec 1-10 de commune2
 * @returns {string} HTML du tableau
 */
function renderComparaisonTable(commune1, commune2, data1, data2, indice1, indice2) {
    let html = `
        <h3>Comparaison : <strong>${commune1}</strong> vs <strong>${commune2}</strong></h3>
        <table border="1" style="width:100%;border-collapse:collapse;text-align:center;">
            <thead>
                <tr>
                    <th>Indicateur</th>
                    <th>${commune1}</th>
                    <th>${commune2}</th>
                </tr>
            </thead>
            <tbody>`;

    for (const indicateur of Object.keys(data1)) {
        if (data2[indicateur] === undefined) continue;
        const desc = INDICATEURS_META[indicateur]?.description ?? 'Aucune description disponible.';
        html += `
                <tr data-desc="${desc.replace(/"/g, '&quot;')}" style="cursor:pointer;">
                    <td>${indicateur}</td>
                    <td>${data1[indicateur].toFixed(2)}</td>
                    <td>${data2[indicateur].toFixed(2)}</td>
                </tr>`;
    }

    html += `
                <tr>
                    <td><strong>OppChoVec</strong></td>
                    <td>${indice1.toFixed(2)}/10</td>
                    <td>${indice2.toFixed(2)}/10</td>
                </tr>
            </tbody>
        </table>`;

    return html;
}


/**
 * Affiche la fiche détaillée d'une commune dans la sidebar.
 * Réinitialise les surlignements précédents et met en rouge la commune sélectionnée.
 *
 * @param {string} communeNom - Nom de la commune à afficher
 */
function afficherCommune(communeNom) {
    // Réinitialiser les surlignements précédents
    for (const nom of [...AppState.communesHighlightees]) {
        reinitialiserStyleCommune(nom);
    }
    AppState.communesHighlightees = [];

    surlignerCommune(communeNom, 'red');

    const resultDiv     = document.getElementById('resultCommune');
    const valeurIndice  = AppState.indiceFinale[communeNom];
    const indicateurs   = AppState.indicateursCommune[communeNom];

    if (valeurIndice === undefined || !indicateurs) {
        resultDiv.innerHTML = '<p style="color:red;">Données introuvables pour cette commune.</p>';
        return;
    }

    resultDiv.innerHTML = renderCommuneDetails(communeNom, valeurIndice, indicateurs);
}


/**
 * Affiche le formulaire de comparaison dans la sidebar.
 *
 * @param {string} communeNom1 - Commune de référence
 */
function afficherComparaison(communeNom1) {
    const comparaisonDiv = document.getElementById('comparaisonCommune');
    comparaisonDiv.style.display = 'block';

    const select = document.getElementById('communeSelectComparaison');
    select.innerHTML = '<option value="">-- Sélectionner une commune --</option>';

    const triees = Object.keys(AppState.indicateursCommune).sort((a, b) => a.localeCompare(b, 'fr'));
    for (const nom of triees) {
        if (nom === communeNom1) continue;
        const opt = document.createElement('option');
        opt.value = nom;
        opt.textContent = nom;
        select.appendChild(opt);
    }

    document.getElementById('validerComparaison').onclick = () => {
        const communeNom2 = select.value;
        if (!communeNom2) {
            alert('Veuillez sélectionner une commune pour la comparaison.');
            return;
        }
        afficherResultatComparaison(communeNom1, communeNom2);
    };
}


/**
 * Affiche le tableau de comparaison entre deux communes.
 *
 * @param {string} commune1 - Première commune
 * @param {string} commune2 - Deuxième commune
 */
function afficherResultatComparaison(commune1, commune2) {
    // Réinitialiser les surlignements précédents
    for (const nom of [...AppState.communesHighlightees]) {
        reinitialiserStyleCommune(nom);
    }
    AppState.communesHighlightees = [];

    surlignerCommune(commune1, 'red');
    surlignerCommune(commune2, 'red');

    AppState.comparaisonEnCours = { commune1, commune2 };

    const data1   = AppState.indicateursCommune[commune1];
    const data2   = AppState.indicateursCommune[commune2];
    const indice1 = AppState.indiceFinale[commune1];
    const indice2 = AppState.indiceFinale[commune2];

    const comparaisonDiv = document.getElementById('comparaisonCommune');

    // Supprimer le résultat précédent s'il existe (garder les 3 premiers éléments : h2, select, button)
    while (comparaisonDiv.children.length > 3) {
        comparaisonDiv.removeChild(comparaisonDiv.lastChild);
    }

    const resultDiv = document.createElement('div');
    resultDiv.innerHTML = renderComparaisonTable(commune1, commune2, data1, data2, indice1, indice2);
    comparaisonDiv.appendChild(resultDiv);
}
