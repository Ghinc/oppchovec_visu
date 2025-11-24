let data_indicateursOriginaux = {}
    let indiceFinale = {}
    let scoresParCommune = {}
    let indicateursCommune = {}
    let communeJson = {}
    let clustersLISA5pct = {}  // Clusters LISA 5% chargés depuis JSON
    let clustersLISA1pct = {}  // Clusters LISA 1% chargés depuis JSON
    let seuilsJenksCharges = {}  // Seuils Jenks chargés depuis seuils_jenks.json
    let cahCarteInitialisee = false  // Flag pour l'initialisation lazy de la carte CAH
    let routesGeojson = {
        nationales: null,
        departementales: null,
        communales: null,
        toutes: null
    }  // Données GeoJSON du réseau routier par type
    let routesLayers = {}  // Couches de routes pour chaque carte et type
    let langueFrancais = true  // Langue par défaut : français

// Traductions
const traductions = {
    fr: {
        legendeTitre: "Légende",
        limitesCommunes: "Limites des communes",
        routesPrincipales: "Routes principales",
        onglets: {
            oppchovec: "OppChoLiv",
            opp: "Opp",
            cho: "Cho",
            vec: "Liv"
        }
    },
    en: {
        legendeTitre: "Legend",
        limitesCommunes: "Municipal boundaries",
        routesPrincipales: "Main roads",
        onglets: {
            oppchovec: "OppChoLiv",
            opp: "Opp",
            cho: "Cho",
            vec: "Liv"
        }
    }
};

    // 5 cartes différentes + 2 cartes LISA + 2 cartes CAH
    let cartes = {
        oppchovec: null,
        opp: null,
        cho: null,
        vec: null,
        'lisa-5pct': null,
        'lisa-1pct': null,
        'cah-3': null,
        'cah-5': null
    };
    let geojsonLayers = {
        oppchovec: null,
        opp: null,
        cho: null,
        vec: null,
        'lisa-5pct': null,
        'lisa-1pct': null,
        'cah-3': null,
        'cah-5': null
    };
    let legendControls = {
        oppchovec: null,
        opp: null,
        cho: null,
        vec: null,
        'lisa-5pct': null,
        'lisa-1pct': null,
        'cah-3': null,
        'cah-5': null
    };
    let communeLayers = {};
    let comparaisonEnCours = null;
    let Dejasurligner = [];
    let lisaCartesInitialisees = false;  // Flag pour l'initialisation lazy des cartes LISA
    let cahCartesInitialisees = false;  // Flag pour l'initialisation lazy des cartes CAH


// Seuils de Jenks - seront chargés dynamiquement depuis seuils_jenks.json
let seuilsJenks = {
    oppchovec: [0, 2.29, 3.91, 5.08, 7.26, 10],  // 5 classes - valeurs par défaut basées sur Jenks
    opp: [0, 2.44, 3.75, 4.95, 6.49, 10],
    cho: [0, 2.35, 6.11, 8.20, 9.30, 10],
    vec: [0, 1.78, 3.05, 4.14, 6.14, 10]
};

// Palette de couleurs (5 classes) - Bleu clair vers Violet (inversé pour valeurs croissantes)
const colorsJenks = ["#bbdefb", "#64b5f6", "#9c27b0", "#7b1fa2", "#4a148c"];

// Coordonnées des villes principales de Corse avec positions des labels
const villesPrincipales = [
    { nom: "Ajaccio", lat: 41.9267, lng: 8.7369, labelOffset: { lat: -0.15, lng: -0.25 } },
    { nom: "Bastia", lat: 42.7028, lng: 9.4503, labelOffset: { lat: 0.15, lng: 0.20 } },
    { nom: "Corte", lat: 42.3063, lng: 9.1508, labelOffset: { lat: 0.0, lng: 0.70 } },
    { nom: "Porto-Vecchio", lat: 41.5914, lng: 9.2795, labelOffset: { lat: 0.0, lng: 0.30 } },
    { nom: "Calvi", lat: 42.5677, lng: 8.7575, labelOffset: { lat: 0.15, lng: -0.25 } }
];

// Fonction pour ajouter les marqueurs des villes principales avec lignes de repère
function ajouterVillesPrincipales(carte) {
    // Créer un pane pour les villes avec z-index élevé (au-dessus des routes)
    const villesPaneName = 'villesPane';
    if (!carte.getPane(villesPaneName)) {
        const pane = carte.createPane(villesPaneName);
        pane.style.zIndex = 500; // Au-dessus des routes (450) et sous les markers de sélection (600)
    }

    villesPrincipales.forEach(ville => {
        const posVille = [ville.lat, ville.lng];
        const posLabel = [ville.lat + ville.labelOffset.lat, ville.lng + ville.labelOffset.lng];

        // Créer une ligne de repère (leader line) entre le point et le label
        L.polyline([posVille, posLabel], {
            color: '#000000',
            weight: 1,
            opacity: 0.6,
            dashArray: '3, 3',  // Ligne pointillée
            pane: villesPaneName
        }).addTo(carte);

        // Créer un marqueur personnalisé (point noir)
        L.circleMarker(posVille, {
            radius: 5,
            fillColor: "#000000",
            color: "#ffffff",
            weight: 2,
            opacity: 1,
            fillOpacity: 1,
            pane: villesPaneName
        }).addTo(carte);

        // Ajouter le label du nom de la ville à la position décalée
        L.marker(posLabel, {
            icon: L.divIcon({
                className: 'ville-label',
                html: `<div style="
                    font-weight: bold;
                    font-size: 13px;
                    color: #000;
                    background-color: rgba(255, 255, 255, 0.85);
                    padding: 3px 8px;
                    border: 1px solid #000;
                    border-radius: 3px;
                    white-space: nowrap;
                ">${ville.nom}</div>`,
                iconSize: [100, 20],
                iconAnchor: [50, 10]  // Centrer le label
            }),
            pane: villesPaneName
        }).addTo(carte);
    });
}

// Fonction pour ajouter une rose des vents
function ajouterRoseDesVents(carte) {
    const roseControl = L.control({ position: 'topleft' });

    roseControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'rose-des-vents');
        div.innerHTML = `
            <svg width="80" height="80" viewBox="0 0 80 80" style="background: rgba(255,255,255,0.9); border-radius: 50%; padding: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                <!-- Cercle extérieur -->
                <circle cx="40" cy="40" r="35" fill="none" stroke="#333" stroke-width="1"/>
                <!-- Flèche Nord (rouge) -->
                <polygon points="40,10 45,35 40,30 35,35" fill="#d73027" stroke="#000" stroke-width="0.5"/>
                <!-- Flèche Sud -->
                <polygon points="40,70 35,45 40,50 45,45" fill="#333" stroke="#000" stroke-width="0.5"/>
                <!-- Flèche Est -->
                <polygon points="70,40 45,35 50,40 45,45" fill="#666" stroke="#000" stroke-width="0.5"/>
                <!-- Flèche Ouest -->
                <polygon points="10,40 35,45 30,40 35,35" fill="#666" stroke="#000" stroke-width="0.5"/>
                <!-- Lettres N, S, E, O -->
                <text x="40" y="8" text-anchor="middle" font-size="10" font-weight="bold" fill="#d73027">N</text>
                <text x="40" y="76" text-anchor="middle" font-size="8" font-weight="bold" fill="#333">S</text>
                <text x="73" y="43" text-anchor="middle" font-size="8" font-weight="bold" fill="#333">E</text>
                <text x="7" y="43" text-anchor="middle" font-size="8" font-weight="bold" fill="#333">O</text>
            </svg>
        `;
        return div;
    };

    roseControl.addTo(carte);
}

// Fonction pour ajouter une légende des traits (limites et routes)
function ajouterLegendeTraits(carte) {
    const legendeControl = L.control({ position: 'bottomright' });

    legendeControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'legende-traits');
        const lang = langueFrancais ? 'fr' : 'en';
        div.innerHTML = `
            <div style="
                background: rgba(255,255,255,0.95);
                padding: 10px 12px;
                border: 2px solid #333;
                border-radius: 5px;
                font-family: Arial, sans-serif;
                font-size: 12px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            ">
                <div class="legende-titre" style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">${traductions[lang].legendeTitre}</div>

                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <svg width="30" height="2" style="margin-right: 8px;">
                        <line x1="0" y1="1" x2="30" y2="1" stroke="#333" stroke-width="1.5" />
                    </svg>
                    <span class="legende-limites">${traductions[lang].limitesCommunes}</span>
                </div>

                <div style="display: flex; align-items: center;">
                    <svg width="30" height="3" style="margin-right: 8px;">
                        <line x1="0" y1="1.5" x2="30" y2="1.5" stroke="#ff0000" stroke-width="2" opacity="0.7" />
                    </svg>
                    <span class="legende-routes">${traductions[lang].routesPrincipales}</span>
                </div>
            </div>
        `;
        return div;
    };

    legendeControl.addTo(carte);
}

// Fonction pour mettre à jour toutes les légendes
function mettreAJourLegendes() {
    const lang = langueFrancais ? 'fr' : 'en';

    // Mettre à jour les légendes de traits
    document.querySelectorAll('.legende-titre').forEach(el => {
        el.textContent = traductions[lang].legendeTitre;
    });
    document.querySelectorAll('.legende-limites').forEach(el => {
        el.textContent = traductions[lang].limitesCommunes;
    });
    document.querySelectorAll('.legende-routes').forEach(el => {
        el.textContent = traductions[lang].routesPrincipales;
    });
}

// Fonction pour ajouter un bouton de téléchargement d'image
function ajouterBoutonTelechargement(carte, mapType) {
    const downloadControl = L.control({ position: 'topright' });

    downloadControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const button = L.DomUtil.create('a', '', div);
        button.innerHTML = '📷';
        button.href = '#';
        button.title = 'Télécharger la carte en PNG';
        button.style.width = '30px';
        button.style.height = '30px';
        button.style.lineHeight = '30px';
        button.style.textAlign = 'center';
        button.style.textDecoration = 'none';
        button.style.fontSize = '18px';
        button.style.backgroundColor = 'white';
        button.style.cursor = 'pointer';

        L.DomEvent.on(button, 'click', function(e) {
            L.DomEvent.preventDefault(e);
            telechargerCarte(carte, mapType);
        });

        return div;
    };

    downloadControl.addTo(carte);
}

// Fonction pour télécharger la carte en PNG
async function telechargerCarte(carte, mapType) {
    try {
        // Masquer temporairement les contrôles de zoom
        const zoomControl = carte.getContainer().querySelector('.leaflet-control-zoom');
        const downloadControl = carte.getContainer().querySelector('.leaflet-bar a[title="Télécharger la carte en PNG"]')?.parentElement;

        if (zoomControl) zoomControl.style.display = 'none';
        if (downloadControl) downloadControl.style.display = 'none';

        // Attendre un peu pour que les changements soient appliqués
        await new Promise(resolve => setTimeout(resolve, 200));

        // Capturer la carte avec dom-to-image
        const mapContainer = carte.getContainer();

        const dataUrl = await domtoimage.toPng(mapContainer, {
            quality: 1,
            bgcolor: '#ffffff',
            width: mapContainer.offsetWidth,
            height: mapContainer.offsetHeight
        });

        // Restaurer les contrôles
        if (zoomControl) zoomControl.style.display = '';
        if (downloadControl) downloadControl.style.display = '';

        // Télécharger l'image
        const link = document.createElement('a');
        link.download = `carte_${mapType}_${new Date().toISOString().slice(0,10)}.png`;
        link.href = dataUrl;
        link.click();

        console.log(`✅ Carte ${mapType} téléchargée`);
    } catch (error) {
        console.error('❌ Erreur lors du téléchargement de la carte:', error);
        alert('Erreur lors de la génération de l\'image. Veuillez réessayer.');

        // Restaurer les contrôles en cas d'erreur
        const zoomControl = carte.getContainer().querySelector('.leaflet-control-zoom');
        const downloadControl = carte.getContainer().querySelector('.leaflet-bar a[title="Télécharger la carte en PNG"]')?.parentElement;
        if (zoomControl) zoomControl.style.display = '';
        if (downloadControl) downloadControl.style.display = '';
    }
}

// Fonction pour charger le réseau routier depuis les fichiers GeoJSON
async function chargerReseauRoutier() {
    // Vérifier si déjà chargé
    if (routesGeojson.nationales && routesGeojson.departementales &&
        routesGeojson.communales && routesGeojson.toutes) {
        console.log('ℹ️ Réseau routier déjà en cache');
        return routesGeojson;
    }

    console.log('📡 Chargement des réseaux routiers...');

    const fichiers = {
        nationales: 'routes_nationales.geojson',
        departementales: 'routes_departementales.geojson',
        communales: 'routes_communales.geojson',
        toutes: 'routes_toutes.geojson'
    };

    try {
        const promises = Object.entries(fichiers).map(async ([type, fichier]) => {
            const response = await fetch(fichier);
            if (!response.ok) {
                throw new Error(`Erreur HTTP pour ${fichier}: ${response.status}`);
            }
            const data = await response.json();
            routesGeojson[type] = data;
            console.log(`✅ Routes ${type} chargées: ${data.features.length} routes`);
        });

        await Promise.all(promises);
        console.log('✅ Tous les réseaux routiers chargés');
        return routesGeojson;
    } catch (error) {
        console.error('❌ Erreur lors du chargement du réseau routier:', error);
        return null;
    }
}

// Fonction pour ajouter le réseau routier sur une carte
function ajouterReseauRoutier(carte, mapType) {
    if (!routesGeojson.nationales || !routesGeojson.departementales ||
        !routesGeojson.communales || !routesGeojson.toutes) {
        console.warn('Réseau routier non chargé');
        return;
    }

    // Initialiser les layers pour cette carte si nécessaire
    if (!routesLayers[mapType]) {
        routesLayers[mapType] = {};
    }

    // Créer un pane personnalisé pour les routes avec un z-index élevé
    const paneName = 'routesPane';
    if (!carte.getPane(paneName)) {
        const pane = carte.createPane(paneName);
        pane.style.zIndex = 450; // Au-dessus de overlayPane (400) mais sous les markers (600)
        pane.style.pointerEvents = 'auto';
    }

    // Fonction helper pour créer une couche de routes
    const creerCoucheRoute = (geojsonData) => {
        if (!geojsonData) return null;

        return L.geoJSON(geojsonData, {
            pane: paneName,
            style: {
                color: '#ff0000',  // Rouge pour les routes
                weight: 2,
                opacity: 0.7
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties) {
                    let popupContent = '<div style="font-family: Arial, sans-serif;">';

                    if (feature.properties.num_route) {
                        popupContent += `<strong>Route:</strong> ${feature.properties.num_route}<br>`;
                    }
                    if (feature.properties.class_adm) {
                        popupContent += `<strong>Classification:</strong> ${feature.properties.class_adm}<br>`;
                    }
                    if (feature.properties.toponyme) {
                        popupContent += `<strong>Nom:</strong> ${feature.properties.toponyme}<br>`;
                    }

                    popupContent += '</div>';
                    layer.bindPopup(popupContent);
                }
            }
        });
    };

    // Créer les couches pour chaque type
    routesLayers[mapType] = {
        nationales: creerCoucheRoute(routesGeojson.nationales),
        departementales: creerCoucheRoute(routesGeojson.departementales),
        communales: creerCoucheRoute(routesGeojson.communales),
        toutes: creerCoucheRoute(routesGeojson.toutes)
    };

    // Ajouter les couches cochées par défaut (nationales et départementales)
    mettreAJourAffichageRoutes(carte, mapType);

    console.log(`✅ Réseau routier ajouté sur la carte ${mapType}`);
}

// Fonction pour mettre à jour l'affichage des routes selon les checkboxes
function mettreAJourAffichageRoutes(carte, mapType) {
    if (!routesLayers[mapType]) return;

    const types = ['nationales', 'departementales', 'communales', 'toutes'];

    types.forEach(type => {
        const checkbox = document.getElementById(`checkbox-${type}`);
        const layer = routesLayers[mapType][type];

        if (!layer) return;

        // Retirer la couche si elle existe
        if (carte.hasLayer(layer)) {
            carte.removeLayer(layer);
        }

        // L'ajouter si la checkbox est cochée
        if (checkbox && checkbox.checked) {
            layer.addTo(carte);
        }
    });
}

// Fonction pour générer dynamiquement les labels depuis les seuils
function genererLabelsJenks(seuils) {
    const nbClasses = seuils.length - 1;

    if (nbClasses < 3) {
        console.warn("Nombre de classes insuffisant:", nbClasses);
        return Array(nbClasses).fill(0).map((_, i) => `Classe ${i + 1}`);
    }

    const labels = [];

    // Première classe: ≤ seuil[1]
    labels.push(`≤ ${seuils[1].toFixed(2)}`);

    // Classes intermédiaires: seuil[i] - seuil[i+1]
    for (let i = 1; i < seuils.length - 2; i++) {
        labels.push(`${seuils[i].toFixed(2)} - ${seuils[i + 1].toFixed(2)}`);
    }

    // Dernière classe: > seuil[n-2]
    labels.push(`> ${seuils[seuils.length - 2].toFixed(2)}`);

    return labels;
}

// Fonction pour charger les seuils Jenks depuis le fichier JSON
async function chargerSeuilsJenks() {
    try {
        const response = await fetch('seuils_jenks_optimal_gvf.json');
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();
        seuilsJenksCharges = data;

        // Extraire les breaks (seuils) depuis le format GVF
        // Format: {breaks: [s1, s2, ...], gvf: 0.xx, nb_classes: N}
        // Ajouter 0 au début et max à la fin pour avoir [min, s1, s2, ..., max]

        const addMinMax = (breaks, maxVal = 10) => {
            if (!breaks || !Array.isArray(breaks)) return null;
            return [0, ...breaks, maxVal];
        };

        seuilsJenks = {
            oppchovec: addMinMax(data.OppChoVec_0_10?.breaks, 10),
            opp: addMinMax(data.Score_Opp_0_10?.breaks, 10),
            cho: addMinMax(data.Score_Cho_0_10?.breaks, 10),
            vec: addMinMax(data.Score_Vec_0_10?.breaks, 10)
        };

        console.log("✅ Seuils Jenks optimaux (GVF) chargés");
        console.log(`  OppChoVec: ${seuilsJenks.oppchovec?.length - 1 || 0} classes (GVF=${data.OppChoVec_0_10?.gvf?.toFixed(3)})`);
        console.log(`  Score_Opp: ${seuilsJenks.opp?.length - 1 || 0} classes (GVF=${data.Score_Opp_0_10?.gvf?.toFixed(3)})`);
        console.log(`  Score_Cho: ${seuilsJenks.cho?.length - 1 || 0} classes (GVF=${data.Score_Cho_0_10?.gvf?.toFixed(3)})`);
        console.log(`  Score_Vec: ${seuilsJenks.vec?.length - 1 || 0} classes (GVF=${data.Score_Vec_0_10?.gvf?.toFixed(3)})`);

        return true;
    } catch (error) {
        console.error("Erreur lors du chargement de seuils_jenks_optimal_gvf.json:", error);
        console.warn("⚠ Utilisation des seuils par défaut (7 classes)");
        return false;
    }
}

// Fonction pour créer/mettre à jour une carte spécifique
function afficherCarteUnique(mapId, type, geojsonData, indicateursDict, titre) {
    // Initialiser la carte si elle n'existe pas
    if (!cartes[type]) {
        cartes[type] = L.map(mapId, {
            center: [42.0396, 9.0129],
            zoom: 8,
            zoomControl: true,
            attributionControl: false,
            zoomSnap: 0.1,       // Permet des zooms très fins par dixièmes
            zoomDelta: 0.1       // Incrément de zoom très fin pour les boutons +/-
        });

        // Fond blanc au lieu de la carte OpenStreetMap
        cartes[type].getContainer().style.backgroundColor = '#ffffff';

        // Ajouter le contrôle d'échelle avec style amélioré
        const scaleControl = L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false,
            maxWidth: 200
        }).addTo(cartes[type]);

        // Améliorer le style de l'échelle pour la rendre plus visible
        setTimeout(() => {
            const scaleElement = cartes[type].getContainer().querySelector('.leaflet-control-scale');
            if (scaleElement) {
                scaleElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                scaleElement.style.padding = '4px 8px';
                scaleElement.style.borderRadius = '4px';
                scaleElement.style.border = '2px solid #333';
                scaleElement.style.fontWeight = 'bold';
                scaleElement.style.fontSize = '13px';
                scaleElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            }
        }, 100);
    }

    // Utiliser les seuils de Jenks pour ce type de carte (8 seuils = 7 classes)
    const seuils = seuilsJenks[type] || [0, 1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10];

    const getColor = (value) => {
        if (value === undefined || value === null || isNaN(value)) return "#cccccc";

        // Attribution dynamique de couleur en fonction des seuils
        for (let i = 1; i < seuils.length - 1; i++) {
            if (value <= seuils[i]) {
                return colorsJenks[i - 1];
            }
        }
        // Dernière classe (valeurs > avant-dernier seuil)
        return colorsJenks[seuils.length - 2];
    };

    // Supprimer anciennes couches si existantes
    if (geojsonLayers[type]) {
        cartes[type].removeLayer(geojsonLayers[type]);
    }
    if (legendControls[type]) {
        cartes[type].removeControl(legendControls[type]);
    }

    // Créer la couche GeoJSON
    geojsonLayers[type] = L.geoJSON(geojsonData, {
        style: feature => {
            const name = feature.properties.nom;
            const val = indicateursDict[name];
            return {
                fillColor: val !== undefined ? getColor(val) : "#ccc",
                color: "#000000",  // Contours noirs
                weight: 1,
                fillOpacity: 0.7
            };
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.nom;
            const val = indicateursDict[name];
            // Sauvegarder chaque couche par nom (pour la carte principale seulement)
            if (type === 'oppchovec') {
                communeLayers[name] = layer;
            }
            layer.bindPopup(`<strong>${name}</strong><br>${titre}: ${val !== undefined ? val.toFixed(2) : 'N/A'}/10`);
        }
    }).addTo(cartes[type]);

    // Ajouter une légende avec seuils de Jenks
    legendControls[type] = L.control({ position: 'bottomright' });

    legendControls[type].onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');

        // Générer les labels dynamiquement depuis les seuils
        const labels = genererLabelsJenks(seuils);

        div.innerHTML += `<strong>${titre}</strong><br>`;
        div.innerHTML += `<small style="color: #666;">Échelle 0-10 (Jenks)</small><br><br>`;

        for (let i = 0; i < colorsJenks.length; i++) {
            div.innerHTML +=
                `<i style="background:${colorsJenks[i]}; width:18px; height:18px; display:inline-block; margin-right:5px;"></i> ` +
                `${labels[i]}<br>`;
        }

        return div;
    };

    legendControls[type].addTo(cartes[type]);

    // Ajouter le réseau routier, les villes principales, la rose des vents, la légende et le bouton de téléchargement
    ajouterReseauRoutier(cartes[type], type);
    ajouterVillesPrincipales(cartes[type]);
    ajouterRoseDesVents(cartes[type]);
    ajouterLegendeTraits(cartes[type]);
    ajouterBoutonTelechargement(cartes[type], type);
}

// Fonction principale pour afficher toutes les cartes
function afficherToutesLesCartes(geojsonData, indiceFinal, scores) {
    // Extraire les scores Opp, Cho, Vec (normalisés 0-10)
    const scoresOpp = {};
    const scoresCho = {};
    const scoresVec = {};

    for (const commune in scores) {
        scoresOpp[commune] = scores[commune].Score_Opp;
        scoresCho[commune] = scores[commune].Score_Cho;
        scoresVec[commune] = scores[commune].Score_Vec;
    }

    // Afficher chaque carte (sauf LISA qui sera chargé au clic)
    afficherCarteUnique('map-oppchovec', 'oppchovec', geojsonData, indiceFinal, 'OppChoVec');
    afficherCarteUnique('map-opp', 'opp', geojsonData, scoresOpp, 'Score Opp');
    afficherCarteUnique('map-cho', 'cho', geojsonData, scoresCho, 'Score Cho');
    afficherCarteUnique('map-vec', 'vec', geojsonData, scoresVec, 'Score Vec');

    // Si les cartes LISA ont déjà été initialisées, les mettre à jour
    if (lisaCartesInitialisees) {
        afficherCarteLISA('map-lisa-5pct', 'lisa-5pct', geojsonData, indiceFinal, clustersLISA5pct, '5%');
        afficherCarteLISA('map-lisa-1pct', 'lisa-1pct', geojsonData, indiceFinal, clustersLISA1pct, '1%');
    }
}

// Fonction pour charger les clusters LISA depuis les données intégrées
function chargerClustersLISA() {
    try {
        console.log("Chargement des clusters LISA...");

        // Vérifier si LISA_DATA (5%) est disponible
        if (typeof LISA_DATA === 'undefined') {
            throw new Error("LISA_DATA non disponible - fichier lisa_data.js manquant ?");
        }

        // Vérifier si LISA_DATA_1PCT (1%) est disponible
        if (typeof LISA_DATA_1PCT === 'undefined') {
            throw new Error("LISA_DATA_1PCT non disponible - fichier lisa_data_1pct.js manquant ?");
        }

        // Extraire les clusters depuis LISA_DATA (5%)
        const clusters5pct = {};
        for (const [commune, info] of Object.entries(LISA_DATA.clusters)) {
            clusters5pct[commune] = info.cluster;
        }

        // Extraire les clusters depuis LISA_DATA_1PCT (1%)
        const clusters1pct = {};
        for (const [commune, info] of Object.entries(LISA_DATA_1PCT.clusters)) {
            clusters1pct[commune] = info.cluster;
        }

        console.log(`✓ ${Object.keys(clusters5pct).length} clusters LISA 5% chargés`);
        console.log(`  Moran I global: ${LISA_DATA.metadata.moran_global_I.toFixed(4)}`);
        console.log(`  Communes significatives (5%): ${LISA_DATA.metadata.nb_significatives} (${LISA_DATA.metadata.pourcent_significatives.toFixed(1)}%)`);
        console.log("  Répartition (5%):", LISA_DATA.statistiques);

        console.log(`✓ ${Object.keys(clusters1pct).length} clusters LISA 1% chargés`);
        console.log(`  Communes significatives (1%): ${LISA_DATA_1PCT.metadata.nb_significatives} (${LISA_DATA_1PCT.metadata.pourcent_significatives.toFixed(1)}%)`);
        console.log("  Répartition (1%):", LISA_DATA_1PCT.statistiques);

        return { clusters5pct, clusters1pct };
    } catch (error) {
        console.error("Erreur lors du chargement des clusters LISA:", error);
        console.warn("⚠ Utilisation de clusters par défaut (Non significatif)");
        // Retourner des objets vides en cas d'erreur
        return { clusters5pct: {}, clusters1pct: {} };
    }
}

// Fonction pour initialiser les deux cartes LISA (appelée au premier clic sur l'onglet LISA)
function initialiserCartesLISA() {
    if (!lisaCartesInitialisees) {
        console.log("=== Initialisation des cartes LISA (lazy loading) ===");
        afficherCarteLISA('map-lisa-5pct', 'lisa-5pct', communeJson, indiceFinale, clustersLISA5pct, '5%');
        afficherCarteLISA('map-lisa-1pct', 'lisa-1pct', communeJson, indiceFinale, clustersLISA1pct, '1%');
        lisaCartesInitialisees = true;
        console.log("✅ Cartes LISA initialisées");

        // Invalider la taille de la carte active (LISA 5% par défaut)
        setTimeout(() => {
            if (cartes['lisa-5pct']) {
                cartes['lisa-5pct'].invalidateSize();
            }
        }, 100);
    }
}

// Fonction pour afficher une carte LISA (5% ou 1%)
function afficherCarteLISA(mapId, mapType, geojsonData, indiceFinal, clustersLISA, seuil) {
    console.log(`=== Affichage carte LISA ${seuil} ===`);
    console.log("Nombre de clusters disponibles:", Object.keys(clustersLISA).length);
    console.log("Premiers clusters:", Object.keys(clustersLISA).slice(0, 5));

    // Initialiser la carte si elle n'existe pas
    if (!cartes[mapType]) {
        cartes[mapType] = L.map(mapId, {
            center: [42.0396, 9.0129],
            zoom: 8,
            zoomControl: true,
            attributionControl: false,
            zoomSnap: 0.1,       // Permet des zooms très fins par dixièmes
            zoomDelta: 0.1       // Incrément de zoom très fin pour les boutons +/-
        });

        cartes[mapType].getContainer().style.backgroundColor = '#ffffff';

        // Ajouter le contrôle d'échelle avec style amélioré
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false,
            maxWidth: 200
        }).addTo(cartes[mapType]);

        // Améliorer le style de l'échelle pour la rendre plus visible
        setTimeout(() => {
            const scaleElement = cartes[mapType].getContainer().querySelector('.leaflet-control-scale');
            if (scaleElement) {
                scaleElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                scaleElement.style.padding = '4px 8px';
                scaleElement.style.borderRadius = '4px';
                scaleElement.style.border = '2px solid #333';
                scaleElement.style.fontWeight = 'bold';
                scaleElement.style.fontSize = '13px';
                scaleElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            }
        }, 100);
    }

    // Palette de couleurs LISA
    const colorsLISA = {
        'Non significatif': '#d9d9d9',
        'HH (High-High)': '#d73027',
        'LL (Low-Low)': '#4575b4',
        'LH (Low-High)': '#abd9e9',
        'HL (High-Low)': '#fdae61'
    };

    // Supprimer anciennes couches si existantes
    if (geojsonLayers[mapType]) {
        cartes[mapType].removeLayer(geojsonLayers[mapType]);
    }

    // Statistiques de debug
    let clustersUtilises = {};
    let communesNonTrouvees = [];

    // Créer la couche GeoJSON
    geojsonLayers[mapType] = L.geoJSON(geojsonData, {
        style: feature => {
            const name = feature.properties.nom;
            const cluster = clustersLISA[name] || 'Non significatif';

            // Debug
            if (!clustersLISA[name]) {
                communesNonTrouvees.push(name);
            }
            clustersUtilises[cluster] = (clustersUtilises[cluster] || 0) + 1;

            return {
                fillColor: colorsLISA[cluster],
                color: "#000000",
                weight: 1,
                fillOpacity: 0.7
            };
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.nom;
            const cluster = clustersLISA[name] || 'Non significatif';
            const val = indiceFinal[name];

            // Créer un popup informatif
            let popupHTML = `<strong>${name}</strong><br>`;
            popupHTML += `<strong>Cluster LISA (${seuil}):</strong> ${cluster}<br>`;
            popupHTML += `<strong>OppChoVec:</strong> ${val !== undefined ? val.toFixed(2) : 'N/A'}/10`;

            layer.bindPopup(popupHTML);
        }
    }).addTo(cartes[mapType]);

    // Afficher les statistiques
    console.log(`Clusters utilisés (${seuil}):`, clustersUtilises);
    if (communesNonTrouvees.length > 0) {
        console.warn(`Communes non trouvées dans LISA ${seuil}:`, communesNonTrouvees.slice(0, 10));
    }

    // Ajouter le réseau routier, les villes principales, la rose des vents, la légende et le bouton de téléchargement
    ajouterReseauRoutier(cartes[mapType], mapType);
    ajouterVillesPrincipales(cartes[mapType]);
    ajouterRoseDesVents(cartes[mapType]);
    ajouterLegendeTraits(cartes[mapType]);
    ajouterBoutonTelechargement(cartes[mapType], mapType);
}

// fonction pour surligner les contours d'une commune
function surlignerCommune(nomCommune, couleur = "orange") {
    const layer = communeLayers[nomCommune];
    if (layer) {
        layer.setStyle({
            color: couleur,
            weight: 3,
            fillOpacity: 0.7
        });
        layer.bringToFront();
    }
    Dejasurligner.push(nomCommune)
    console.log(Dejasurligner)
}

// fonction pour réinitialiser le surlignement d'une commune
function reinitialiserStyleCommune(nomCommune, indicateursDict) {
    const layer = communeLayers[nomCommune];
    if (layer) {
        layer.setStyle({
            color: "#ffffff",
            weight: 1,
            fillOpacity: 0.7
        });
        layer.bringToFront();
    }
}

// ============================================
// FONCTIONS CAH (Classification Hiérarchique Ascendante)
// ============================================

// Fonction pour initialiser les cartes CAH (appelée au premier clic sur l'onglet CAH)
function initialiserCartesCAH() {
    if (!cahCartesInitialisees) {
        console.log("=== Initialisation des cartes CAH (lazy loading) ===");
        afficherCarteCAH('map-cah-3', 'cah-3', communeJson, CAH_DATA_3, 3);
        afficherCarteCAH('map-cah-5', 'cah-5', communeJson, CAH_DATA_5, 5);
        cahCartesInitialisees = true;
        console.log("✅ Cartes CAH initialisées");

        // Invalider la taille de la carte active (CAH 3 par défaut)
        setTimeout(() => {
            if (cartes['cah-3']) {
                cartes['cah-3'].invalidateSize();
            }
        }, 100);
    }
}

// Fonction pour afficher une carte CAH (3 ou 5 clusters)
function afficherCarteCAH(mapId, mapType, geojsonData, cahData, nClusters) {
    console.log(`=== Affichage carte CAH ${nClusters} clusters ===`);

    // Vérifier si cahData est disponible
    if (!cahData || !cahData.clusters) {
        console.error(`CAH_DATA_${nClusters} n'est pas défini. Assurez-vous que cah_data.js est chargé.`);
        return;
    }

    console.log("Nombre de communes avec clusters:", Object.keys(cahData.clusters || {}).length);

    // Initialiser la carte si elle n'existe pas
    if (!cartes[mapType]) {
        cartes[mapType] = L.map(mapId, {
            center: [42.0396, 9.0129],
            zoom: 8,
            zoomControl: true,
            attributionControl: false,
            zoomSnap: 0.1,       // Permet des zooms très fins par dixièmes
            zoomDelta: 0.1       // Incrément de zoom très fin pour les boutons +/-
        });

        cartes[mapType].getContainer().style.backgroundColor = '#ffffff';

        // Ajouter le contrôle d'échelle avec style amélioré
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false,
            maxWidth: 200
        }).addTo(cartes[mapType]);

        // Améliorer le style de l'échelle pour la rendre plus visible
        setTimeout(() => {
            const scaleElement = cartes[mapType].getContainer().querySelector('.leaflet-control-scale');
            if (scaleElement) {
                scaleElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                scaleElement.style.padding = '4px 8px';
                scaleElement.style.borderRadius = '4px';
                scaleElement.style.border = '2px solid #333';
                scaleElement.style.fontWeight = 'bold';
                scaleElement.style.fontSize = '13px';
                scaleElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            }
        }, 100);
    }

    // Palette de couleurs CAH (jusqu'à 5 clusters)
    const colorsCAH = {
        1: '#E41A1C',  // Rouge - Cluster 1
        2: '#377EB8',  // Bleu - Cluster 2
        3: '#4DAF4A',  // Vert - Cluster 3
        4: '#984EA3',  // Violet - Cluster 4
        5: '#FF7F00'   // Orange - Cluster 5
    };

    // Supprimer anciennes couches si existantes
    if (geojsonLayers[mapType]) {
        cartes[mapType].removeLayer(geojsonLayers[mapType]);
    }

    // Fonction de style pour chaque commune
    function styleCommune(feature) {
        const nomCommune = feature.properties.nom?.trim();
        const clusterInfo = cahData.clusters?.[nomCommune];

        if (!clusterInfo) {
            console.warn("Commune sans cluster:", nomCommune);
            return {
                fillColor: '#cccccc',
                fillOpacity: 0.6,
                color: '#ffffff',
                weight: 1
            };
        }

        const cluster = clusterInfo.cluster;
        const fillColor = colorsCAH[cluster] || '#cccccc';

        return {
            fillColor: fillColor,
            fillOpacity: 0.7,
            color: '#ffffff',
            weight: 1
        };
    }

    // Ajouter la couche GeoJSON
    geojsonLayers[mapType] = L.geoJSON(geojsonData, {
        style: styleCommune,
        onEachFeature: function(feature, layer) {
            const nomCommune = feature.properties.nom?.trim();
            const clusterInfo = cahData.clusters?.[nomCommune];

            // Enregistrer la couche pour pouvoir la manipuler plus tard
            communeLayers[nomCommune] = layer;

            // Contenu du popup
            let popupContent = `<div style="font-family: Arial, sans-serif;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${nomCommune}</h3>`;

            if (clusterInfo) {
                const cluster = clusterInfo.cluster;
                const colorCluster = colorsCAH[cluster];

                popupContent += `
                    <div style="margin-bottom: 8px;">
                        <span style="display: inline-block; width: 20px; height: 20px; background-color: ${colorCluster}; border: 1px solid #333; margin-right: 8px; vertical-align: middle;"></span>
                        <strong>Cluster ${cluster}</strong> (${nClusters} clusters)
                    </div>
                    <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">
                    <p style="margin: 5px 0;"><strong>Score Opportunités:</strong> ${clusterInfo.Score_Opp.toFixed(2)}</p>
                    <p style="margin: 5px 0;"><strong>Score Choix:</strong> ${clusterInfo.Score_Cho.toFixed(2)}</p>
                    <p style="margin: 5px 0;"><strong>Score Vécu:</strong> ${clusterInfo.Score_Vec.toFixed(2)}</p>
                    <p style="margin: 5px 0;"><strong>OppChoVec:</strong> ${clusterInfo.OppChoVec.toFixed(2)}</p>
                `;
            } else {
                popupContent += `<p style="color: #999;">Données de cluster non disponibles</p>`;
            }

            popupContent += `</div>`;

            layer.bindPopup(popupContent);

            // Événements de survol
            layer.on('mouseover', function() {
                this.setStyle({
                    weight: 3,
                    color: '#333',
                    fillOpacity: 0.9
                });
                this.bringToFront();
            });

            layer.on('mouseout', function() {
                geojsonLayers[mapType].resetStyle(this);
            });
        }
    }).addTo(cartes[mapType]);

    // Ajouter le réseau routier, les villes principales, la rose des vents, la légende et le bouton de téléchargement
    ajouterReseauRoutier(cartes[mapType], mapType);
    ajouterVillesPrincipales(cartes[mapType]);
    ajouterRoseDesVents(cartes[mapType]);
    ajouterLegendeTraits(cartes[mapType]);
    ajouterBoutonTelechargement(cartes[mapType], mapType);

    console.log(`✅ Carte CAH ${nClusters} clusters affichée avec succès`);
}


// 1. Utilitaire qui transforme un FileReader en Promise de texte
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
    reader.onload  = () => resolve(reader.result);
    reader.readAsText(file);
  });
}



    document.getElementById("validateBtn").addEventListener("click", async () => {
      const fileJson    = document.getElementById("file").files[0];
      const fileGeoJson = document.getElementById("file_geojson").files[0];

      if (!fileJson || !fileGeoJson) {
        alert("Veuillez sélectionner à la fois un fichier JSON et un GeoJSON.");
        return;
      }

      try {
        console.log("Chargement des fichiers...");

        // 1. Charger les seuils Jenks et le réseau routier en parallèle
        await Promise.all([
          chargerSeuilsJenks(),
          chargerReseauRoutier()
        ]);

        // 2. Lecture en parallèle des fichiers
        const [textJson, textGeo] = await Promise.all([
          readFileAsText(fileJson),
          readFileAsText(fileGeoJson)
        ]);

        // 3. Parsing du JSON indicateurs
        const dataIndicateurs = JSON.parse(textJson);
        data_indicateursOriginaux = dataIndicateurs;
        console.log("✅ Fichier indicateurs chargé :", dataIndicateurs);

        // 4. Parsing et validation du GeoJSON
        const geojsonData = JSON.parse(textGeo);
        if (geojsonData.type !== "FeatureCollection" || !Array.isArray(geojsonData.features)) {
          throw new Error("Invalid GeoJSON : attendu un FeatureCollection avec un tableau 'features'.");
        }
        communeJson = geojsonData;
        console.log("✅ GeoJSON communes chargé :", geojsonData);

        // 5. Charger les clusters LISA (5% et 1%)
        const { clusters5pct, clusters1pct } = chargerClustersLISA();
        clustersLISA5pct = clusters5pct;
        clustersLISA1pct = clusters1pct;
        console.log("✅ Clusters LISA 5% et 1% chargés");

        // 6. Suite du traitement
        const data_indicateurs_dict = calculerIndicateurs(dataIndicateurs);
        populateCommuneSelect(data_indicateurs_dict);
        alert("Validation réussie ! Veuillez sélectionner une commune.");

      } catch (err) {
        alert("Erreur lors de la lecture ou du traitement : " + err.message);
      }

  });


  document.getElementById("validerCommune").addEventListener("click", () => {
  const selectedCommune = document.getElementById("communeSelect").value;
  if (!selectedCommune) {
    document.getElementById("resultCommune").innerHTML = "<p style='color:red;'>❌ Veuillez sélectionner une commune.</p>";
    return;
  }
  afficherCommune(selectedCommune);
});

// fonction pour afficher le detail d'une commune
function afficherCommune(communeNom) {

  for (const commune of Dejasurligner){
       reinitialiserStyleCommune(commune, indicateursCommune);
       Dejasurligner.pop(commune)
       console.log(Dejasurligner)
  }
  surlignerCommune(communeNom, "red");

  const resultDiv = document.getElementById("resultCommune");

  const valeurIndice = indiceFinale[communeNom];
  const commune = indicateursCommune[communeNom];
  if (valeurIndice === undefined || !commune) {
    resultDiv.innerHTML = "<p style='color:red;'>❌ Données introuvables pour cette commune.</p>";
    return;
  }

  let indicateursHTML = `
    <p><strong>Commune :</strong> ${communeNom}</p>
    <p><strong>OppChoVec :</strong> ${valeurIndice.toFixed(2)}/10</p>
    <h4>Indicateurs :</h4>
    <ul>
  `;

  const stepsParIndicateur = {
    Indicateur_Opp1: 0.1,
    Indicateur_Opp2: 0.01,
    Indicateur_Opp3: 1,
    Indicateur_Opp4: 1,
    Indicateur_Cho1: 0.01,
    Indicateur_Cho2: 1,
    Indicateur_Vec1: 100,
    Indicateur_Vec2: 0.01,
    Indicateur_Vec3: 0.01,
    Indicateur_Vec4: 1
  };

  const descriptionsIndicateurs = {
  Indicateur_Opp1: "Avoir une bonne éducation. Se traduit par le niveau de diplôme de la population sur une échelle de 1 à 7.",
  Indicateur_Opp2: "Représente l'indice de Theil qui mesure les inégalités et les proportions des catégories socioprofessionnelles.",
  Indicateur_Opp3: "Avoir les moyens de mobilité. Score basé sur la proportion de ménages avec voiture et l'accès aux transports.",
  Indicateur_Opp4: "Avoir accès aux TIC. Moyenne de la couverture 4G, Internet haut débit et fibre.",
  Indicateur_Cho1: "Ne pas être discriminé. Calculé avec exp(-pourcentage_population_quartiers_prioritaires).",
  Indicateur_Cho2: "Avoir les moyens d'influencer les décisions politiques. Proportion d'inscrits sur les listes électorales.",
  Indicateur_Vec1: "Avoir un revenu décent. Revenu fiscal médian de la commune.",
  Indicateur_Vec2: "Avoir un logement décent. Score basé sur le confort, la densité d'occupation et le type de logement.",
  Indicateur_Vec3: "Stabilité de l'emploi. Score basé sur la répartition des types de contrats et statuts d'emploi.",
  Indicateur_Vec4: "Être proche des services. Nombre de services de vie courante accessibles."
};

const bornesParIndicateur = {
  Indicateur_Opp1: { min: 1, max: 7 },
  Indicateur_Opp2: { min: 0, max: 1 },
  Indicateur_Opp3: { min: 0, max: 300 },
  Indicateur_Opp4: { min: 0, max: 100 },
  Indicateur_Cho1: { min: 0, max: 1 },
  Indicateur_Cho2: { min: 0, max: 100 },
  Indicateur_Vec1: { min: 15000, max: 30000 },
  Indicateur_Vec2: { min: 0, max: 1 },
  Indicateur_Vec3: { min: 0, max: 1 },
  Indicateur_Vec4: { min: 0, max: 20 }
};



  for (const [nomIndicateur, valeur] of Object.entries(commune)) {
    const nombre = typeof valeur === 'number' ? Number(valeur).toFixed(2) : valeur;

    const step = stepsParIndicateur[nomIndicateur] || 1;
    const description = descriptionsIndicateurs[nomIndicateur] || "Aucune description disponible.";

    indicateursHTML += `
      <li class="indicateur-row">
        <div class="indicateur-row-header">
          <strong>${nomIndicateur}</strong>
          <span class="tooltip-container">
            🛈
            <span class="tooltip-text">${description}</span>
          </span>
          <span id="${nomIndicateur}_val">${nombre}</span>
        </div>
        <input type="range"
               id="${nomIndicateur}"
               value="${nombre}"
               step="${step}"
               min="${bornesParIndicateur[nomIndicateur]?.min ?? 0}"
               max="${bornesParIndicateur[nomIndicateur]?.max ?? 100}"
               oninput="document.getElementById('${nomIndicateur}_val').innerText = parseFloat(this.value).toFixed(2)" />
      </li>`;
  }

  indicateursHTML += `
  </ul>
  <div style="display: flex; justify-content: space-between; margin-top: 10px;">
    <button onclick="recalculerIndice('${communeNom}')">🔁 Recalculer Indice</button>
    <button onclick="reinitialiserValeurs('${communeNom}')">🔄 Réinitialiser</button>
  </div>

   <div style="text-align: center; margin-top: 1em;">
    <button onclick="afficherComparaison('${communeNom}')">📊 Comparer</button>
  </div>

  <div id="comparaisonCommune" style="display: none; margin-top: 1em;">
    <h2>3. Sélection commune à comparer</h2>
    <select id="communeSelectComparaison" style="width:100%; padding:0.5em;">
      <option value="">-- Sélectionner une commune --</option>
    </select>
    <button id="validerComparaison" style="margin-top: 0.5em;">Valider la comparaison</button>
  </div>
`;

  resultDiv.innerHTML = indicateursHTML;
}


// fonction pour selectionner une commune de comparaison
  function afficherComparaison(communeNom1) {
  alert("Veuillez sélectionner une commune pour la comparaison.");
  const comparaisonDiv = document.getElementById("comparaisonCommune");
  comparaisonDiv.style.display = "block";

  const select = document.getElementById("communeSelectComparaison");
  select.innerHTML = '<option value="">-- Sélectionner une commune --</option>';

  // Tri par ordre alphabetique
  const communesTriees = Object.keys(indicateursCommune).sort((a, b) => a.localeCompare(b, 'fr'))
  console.log(communesTriees)
  for (const nom of communesTriees) {
    if (nom !== communeNom1) {
      const option = document.createElement("option");
      option.value = nom;
      option.textContent = nom;
      select.appendChild(option);
    }
  }

  document.getElementById("validerComparaison").onclick = () => {
    const communeNom2 = select.value;
    if (!communeNom2) {
      alert("Veuillez sélectionner une commune pour la comparaison.");
      return;
    }
    afficherResultatComparaison(communeNom1, communeNom2);
  };
}

// fonction pour afficher le resultat de comparaison
  function afficherResultatComparaison(commune1, commune2) {

    const descriptionsIndicateurs = {
  Indicateur_Opp1: "Avoir une bonne éducation. Se traduit par le niveau de diplôme de la population sur une échelle de 1 à 7.",
  Indicateur_Opp2: "Représente l'indice de Theil qui mesure les inégalités et les proportions des catégories socioprofessionnelles.",
  Indicateur_Opp3: "Avoir les moyens de mobilité. Score basé sur la proportion de ménages avec voiture et l'accès aux transports.",
  Indicateur_Opp4: "Avoir accès aux TIC. Moyenne de la couverture 4G, Internet haut débit et fibre.",
  Indicateur_Cho1: "Ne pas être discriminé. Calculé avec exp(-pourcentage_population_quartiers_prioritaires).",
  Indicateur_Cho2: "Avoir les moyens d'influencer les décisions politiques. Proportion d'inscrits sur les listes électorales.",
  Indicateur_Vec1: "Avoir un revenu décent. Revenu fiscal médian de la commune.",
  Indicateur_Vec2: "Avoir un logement décent. Score basé sur le confort, la densité d'occupation et le type de logement.",
  Indicateur_Vec3: "Stabilité de l'emploi. Score basé sur la répartition des types de contrats et statuts d'emploi.",
  Indicateur_Vec4: "Être proche des services. Nombre de services de vie courante accessibles."
};

  for (const commune of [...Dejasurligner]){
      console.log(Dejasurligner)
      reinitialiserStyleCommune(commune, indicateursCommune);
      const index = Dejasurligner.indexOf(commune);
      if (index !== -1) {
        Dejasurligner.splice(index, 1); // supprime l'élément à l'index trouvé
        console.log(`${commune} a été supprimée.`);
      } else {
        console.log(`${nomCommune} n'existe pas dans le tableau.`);
      }
       console.log(commune)
       console.log(Dejasurligner)
  }
  console.log(Dejasurligner)
  surlignerCommune(commune1, "red");
  surlignerCommune(commune2, "red");

  comparaisonEnCours = { commune1, commune2 }; // 👈 Sauvegarde
  const data1 = indicateursCommune[commune1];
  const data2 = indicateursCommune[commune2];

  // 🧽 Nettoyer le contenu précédent
  const comparaisonDiv = document.getElementById("comparaisonCommune");
  // Supprime tout sauf le formulaire de sélection
  while (comparaisonDiv.children.length > 3) {
    comparaisonDiv.removeChild(comparaisonDiv.lastChild);
  }

  let html = `
  <h3>Comparaison entre <strong>${commune1}</strong> et <strong>${commune2}</strong></h3>
  <table border="1" style="width:100%; border-collapse: collapse; text-align: center;">
    <thead>
      <tr>
        <th>Indicateur</th>
        <th>${commune1}</th>
        <th>${commune2}</th>
      </tr>
    </thead>
    <tbody>
`;

 const valeurIndice1 = indiceFinale[commune1];
 const valeurIndice2 = indiceFinale[commune2];

for (const indicateur in data1) {
  const description = descriptionsIndicateurs[indicateur] || "Aucune description disponible.";
  if (data2[indicateur] !== undefined) {
    html += `
      <tr>
        <td>
          ${indicateur}
          <span class="tooltip-container" style="float: right; margin-left: 8px;">
            🛈
            <span class="tooltip-text">${description}</span>
          </span>
        </td>
        <td>${data1[indicateur].toFixed(2)}</td>
        <td>${data2[indicateur].toFixed(2)}</td>
      </tr>
    `;
  }
}

html += `
        <td>${"OppChoVec"}</td>
        <td>${valeurIndice1.toFixed(2)}/10</td>
        <td>${valeurIndice2.toFixed(2)}/10</td>
    </tbody>
  </table>
`;

  const resultDiv = document.createElement("div");
  resultDiv.innerHTML = html;
  comparaisonDiv.appendChild(resultDiv);
}




// fonction de réinitialisation
  function reinitialiserValeurs(commune) {
    calculerIndicateurs(data_indicateursOriginaux)
    afficherCommune(commune);
    alert("Valeurs réinitialisées avec succès");
}

// fonction pour recalcules l'indice après modification des valeurs d'indicateur
  function recalculerIndice(selectedCommune) {
  const communeData = indicateursCommune[selectedCommune];
  if (!communeData) return;

  // Étape 1 : mise à jour des valeurs depuis les champs input
  for (const indicateur in communeData) {
    const input = document.getElementById(indicateur);
    if (input) {
      communeData[indicateur] = parseFloat(input.value);
    }
  }

  // Étape 2 : recalculer à partir des valeurs mises à jour
  indicateursCommune[selectedCommune] = communeData
  const min_vals = (minmax(indicateursCommune)).min
  const max_vals = (minmax(indicateursCommune)).max

  const donneesNormalisees = normaliserDonnees(indicateursCommune, min_vals, max_vals);

  const data_dimensions_scores_dict = calculerScoresParCommune(donneesNormalisees)

  const indiceFinalBrut = calculerIndiceBienEtre(data_dimensions_scores_dict);

  // Normaliser l'indice final sur 0-10
  const valeursIndice = Object.values(indiceFinalBrut);
  const minIndice = Math.min(...valeursIndice);
  const maxIndice = Math.max(...valeursIndice);

  const indiceFinal = {};
  for (const commune in indiceFinalBrut) {
    if (maxIndice === minIndice) {
      indiceFinal[commune] = 5; // Valeur par défaut si tous égaux
    } else {
      indiceFinal[commune] = ((indiceFinalBrut[commune] - minIndice) / (maxIndice - minIndice)) * 10;
    }
  }

  // Normaliser les scores par dimension sur 0-10
  const scoresNormalises = {};
  for (const commune in data_dimensions_scores_dict) {
    scoresNormalises[commune] = {
      Score_Opp: data_dimensions_scores_dict[commune].Score_Opp * 10,
      Score_Cho: data_dimensions_scores_dict[commune].Score_Cho * 10,
      Score_Vec: data_dimensions_scores_dict[commune].Score_Vec * 10
    };
  }

  indiceFinale = indiceFinal
  scoresParCommune = scoresNormalises

  afficherToutesLesCartes(communeJson, indiceFinale, scoresNormalises);
  valeurIndice = indiceFinale[selectedCommune]
  if (valeurIndice === undefined) {
    const resultDiv = document.getElementById("resultCommune");
    resultDiv.innerHTML = "<p style='color:red;'>❌ Données introuvables pour cette commune.</p>";
    return;
  }

  // Étape 3 : mettre à jour l'affichage
  const resultDiv = document.getElementById("resultCommune");
  let outputHTML = `
    <p><strong>OppChoVec :</strong> ${valeurIndice.toFixed(2)}/10</p>
  `;
  resultDiv.querySelector("p:nth-child(2)").innerHTML = outputHTML;

  alert("Indice recalculé avec succès");

  // Puis si une comparaison est en cours, on met à jour si nécessaire
  if (
    comparaisonEnCours &&
    (comparaisonEnCours.commune1 === selectedCommune || comparaisonEnCours.commune2 === selectedCommune)
  ) {
    afficherResultatComparaison(comparaisonEnCours.commune1, comparaisonEnCours.commune2);
  }
}

// fonction pour ajuster les valeurs d'indicateur lors de la modification
function ajusterValeur(indicateur, delta) {
  const input = document.getElementById(indicateur);
  const display = document.getElementById(indicateur + "_val");

  if (input && display) {
    let nouvelleValeur = parseFloat(input.value) + delta;

    // Clamp la valeur dans les bornes min/max
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    nouvelleValeur = Math.max(min, Math.min(max, nouvelleValeur));

    input.value = nouvelleValeur.toFixed(2);
    display.innerText = nouvelleValeur.toFixed(2);
  }
}


// fonction de rangement et de tri des communes pour la selection
  function populateCommuneSelect(data) {
    const select = document.getElementById("communeSelect");
    select.innerHTML = '<option value="">-- Sélectionner une commune --</option>'; // reset

    // 🔤 Trier les noms de communes
    const communesTriees = Object.keys(data).sort((a, b) => a.localeCompare(b, 'fr'));

    for (const commune of communesTriees) {
      const option = document.createElement("option");
      option.value = commune;
      option.textContent = commune;
      select.appendChild(option);
    }

    console.log("✅ Communes chargées et triées par ordre alphabétique");
}



// fonctions de calculs des indicateurs

    function calc_opp1(e) {
        return e;
    }

    function calc_opp2(indice) {
        return indice;
    }

    function calc_opp3(voiture, transport) {
        return (voiture + transport) / 2;
    }

    function calc_opp4(internet, debit) {
        return (internet + debit) / 2;
    }

    function calc_cho1(quartier) {
        console.log(Math.exp(-quartier))
        return Math.exp(-quartier);
    }

    function calc_cho2(proportion) {
        return proportion;
    }

    function calc_vec1(revenu) {
        return revenu;
    }

    function calc_vec2(piece, logement, individuel) {
        const vec21 = Math.exp(-piece);
        const vec22 = logement;
        const vec23 = individuel;
        return (vec21 + vec22 + vec23) / 3;
    }

    function calc_vec3(p_vec, valeur) {
        let sum = 0;
        for (let i = 0; i < p_vec.length; i++) {
            sum += p_vec[i] * valeur[i];
        }
        return sum / 100;
    }

    function calc_vec4(n_etablissements) {
        return n_etablissements;
    }


    function calculerIndicateurs(data_indicateurs) {
      // Les données sont déjà calculées dans le JSON avec valeurs normalisées 0-10
      console.log("Chargement des données précalculées (normalisées 0-10)...");

      const data_indicateurs_dict = {};
      const data_dimensions_scores_dict = {};
      const indiceFinal = {};

      // Détecter le format du JSON
      const premiereEntree = Object.entries(data_indicateurs)[0];
      const formatAvecZone = premiereEntree && premiereEntree[1].hasOwnProperty("Zone");

      console.log(`Format JSON détecté: ${formatAvecZone ? 'avec champ Zone' : 'clés directes (communes)'}`);

      for (const [key, valeurs] of Object.entries(data_indicateurs)) {
        // Récupérer le nom de commune selon le format
        let commune;
        if (formatAvecZone) {
          // Format ancien: {"0": {"Zone": "Afa", ...}}
          commune = valeurs["Zone"];
          if (!commune) continue;
        } else {
          // Format nouveau: {"Afa": {...}}
          commune = key;
        }

        // Extraire les indicateurs bruts
        data_indicateurs_dict[commune] = {
          "Indicateur_Opp1": valeurs["Opp1"],
          "Indicateur_Opp2": valeurs["Opp2"],
          "Indicateur_Opp3": valeurs["Opp3"],
          "Indicateur_Opp4": valeurs["Opp4"],
          "Indicateur_Cho1": valeurs["Cho1"],
          "Indicateur_Cho2": valeurs["Cho2"],
          "Indicateur_Vec1": valeurs["Vec1"],
          "Indicateur_Vec2": valeurs["Vec2"],
          "Indicateur_Vec3": valeurs["Vec3"],
          "Indicateur_Vec4": valeurs["Vec4"]
        };

        // Utiliser les scores NORMALISES 0-10
        data_dimensions_scores_dict[commune] = {
          "Score_Opp": valeurs["Score_Opp_0_10"] || valeurs["Score_Opp"],
          "Score_Cho": valeurs["Score_Cho_0_10"] || valeurs["Score_Cho"],
          "Score_Vec": valeurs["Score_Vec_0_10"] || valeurs["Score_Vec"]
        };

        // Utiliser OppChoVec normalisé 0-10
        indiceFinal[commune] = valeurs["OppChoVec_0_10"] || valeurs["OppChoVec"];
      }

      console.log(`✅ ${Object.keys(indiceFinal).length} communes chargées`);
      console.log("Exemples de communes:", Object.keys(indiceFinal).slice(0, 5));

      // Sauvegarde dans les variables globales
      indicateursCommune = data_indicateurs_dict;
      indiceFinale = indiceFinal;
      scoresParCommune = data_dimensions_scores_dict;

      afficherToutesLesCartes(communeJson, indiceFinale, scoresParCommune);
      return indiceFinale;
    }

// fonction de calcul de l'indicateur de vien-être
function calculerIndiceBienEtre(scoresParCommune) {
  const pkValues = [1, 1, 1]; // Pondération pour Opp, Cho, Vec
  const alpha = 2.5;
  const beta = 1.5;

  const bienEtreParCommune = {};

  for (const commune in scoresParCommune) {
    const scores = scoresParCommune[commune];

    // Extraire et élever les scores à la puissance beta
    const dik = [
      scores.Score_Opp,
      scores.Score_Cho,
      scores.Score_Vec
    ].map(score => Math.pow(score, beta));

    // Somme pondérée
    let sommePonderee = 0;
    for (let i = 0; i < pkValues.length; i++) {
      sommePonderee += pkValues[i] * dik[i];
    }

    // Calcul de l'indice final
    const indice = (1 / 3) * Math.pow(sommePonderee, alpha / beta);

    bienEtreParCommune[commune] = indice;
  }

  return bienEtreParCommune;
}


// fonction de calcul des valeurs des dimensions de OppChoVec
function calculerScoresParCommune(dataNormalise) {
  const oppPonderation = {
    "Opp1": 0.25, "Opp2": 0.25, "Opp3": 0.25, "Opp4": 0.25
  };

  const choPonderation = {
    "Cho1": 0.50, "Cho2": 0.50
  };

  const vecPonderation = {
    "Vec1": 0.25, "Vec2": 0.25, "Vec3": 0.25, "Vec4": 0.25
  };
  console.log(dataNormalise)

  function calcDik(indicateurs, ponderations) {
    const valeurs = [];
    const poids = [];

    for (const cle in ponderations) {
      if (cle in indicateurs) {
        valeurs.push(indicateurs[cle]);
        poids.push(ponderations[cle]);
      }
    }

    // Vérifier que nous avons des valeurs
    if (!valeurs || valeurs.length === 0 || !poids || poids.length === 0) {
      console.warn("Aucune valeur trouvée pour les pondérations:", ponderations);
      return 0;
    }

    const sommePoids = poids.reduce((a, b) => a + b, 0);
    if (sommePoids === 0) return 0;

    const produit = valeurs.map((v, i) => v * poids[i]);
    const sommeProduit = produit.reduce((a, b) => a + b, 0);

    return sommeProduit / sommePoids;
  }

  const scores = {};

  for (const commune in dataNormalise) {
    const indicateursBruts = dataNormalise[commune];

    const indicateursSimplifies = {};
    for (const k in indicateursBruts) {
      const nom = k.replace("Indicateur_", "").trim();
      indicateursSimplifies[nom] = parseFloat(indicateursBruts[k]);
    }

    const scoreOpp = calcDik(indicateursSimplifies, oppPonderation);
    const scoreCho = calcDik(indicateursSimplifies, choPonderation);
    const scoreVec = calcDik(indicateursSimplifies, vecPonderation);

    scores[commune] = {
      Score_Opp: scoreOpp,
      Score_Cho: scoreCho,
      Score_Vec: scoreVec
    };
  }
  console.log(scores)
  return scores;
}


// fonction de normalisation des données dans la méthode OppChoVec
function normaliserDonnees(data, minVals, maxVals) {
  const dataNormalise = {};

  for (const commune in data) {
    const indicateurs = data[commune];
    const communeData = {};

    for (const indicateur in indicateurs) {
      const valeur = indicateurs[indicateur];
      const minX = minVals[indicateur] ?? 0;
      const maxX = maxVals[indicateur] ?? 1;

      let normVal;
      if (maxX === minX) {
        normVal = 0;
      } else {
        normVal = (valeur - minX) / (maxX - minX);
      }

      communeData[indicateur] = normVal;
    }

    dataNormalise[commune] = communeData;
  }

  return dataNormalise;
}

// function min max pour la normalisation des données. Cette fonction nous permet de retenir le min et max parmi les valeurs d'indicateur
function minmax(data) {
  const data_indicateurs_min_dict = {};
  const data_indicateurs_max_dict = {};

  // Récupère toutes les clés des indicateurs depuis la première commune
  const keys = Object.keys(Object.values(data)[0]);

  keys.forEach((key) => {
    let valeurs = [];

    for (const commune in data) {
      if (data[commune][key] !== undefined) {
        valeurs.push(data[commune][key]);
      }
    }

    data_indicateurs_min_dict[key] = Math.min(...valeurs);
    data_indicateurs_max_dict[key] = Math.max(...valeurs);
  });

  return {
    min: data_indicateurs_min_dict,
    max: data_indicateurs_max_dict
  };
}

// Gestion des onglets
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // Retirer la classe active de tous les boutons et contenus
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Ajouter la classe active au bouton cliqué et au contenu correspondant
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            // Si on clique sur l'onglet LISA, initialiser les cartes LISA (lazy loading)
            if (targetTab === 'lisatab') {
                initialiserCartesLISA();
            }

            // Si on clique sur l'onglet CAH, initialiser les cartes CAH (lazy loading)
            if (targetTab === 'cahtab') {
                initialiserCartesCAH();
            }

            // Invalider la taille de la carte pour forcer le redimensionnement
            const mapType = targetTab.replace('tab', '');
            if (cartes[mapType]) {
                setTimeout(() => {
                    cartes[mapType].invalidateSize();
                }, 100);
            }
        });
    });

    // Gestion des sous-onglets LISA
    const lisaSubtabButtons = document.querySelectorAll('.lisa-subtab-button');
    const lisaSubtabContents = document.querySelectorAll('.lisa-subtab-content');

    lisaSubtabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetLisaTab = this.getAttribute('data-lisa-tab');

            // Retirer la classe active de tous les boutons et contenus LISA
            lisaSubtabButtons.forEach(btn => btn.classList.remove('active'));
            lisaSubtabContents.forEach(content => content.classList.remove('active'));

            // Ajouter la classe active au bouton cliqué et au contenu correspondant
            this.classList.add('active');
            document.getElementById(targetLisaTab).classList.add('active');

            // Invalider la taille de la carte LISA pour forcer le redimensionnement
            if (targetLisaTab === 'lisa5pct' && cartes['lisa-5pct']) {
                setTimeout(() => {
                    cartes['lisa-5pct'].invalidateSize();
                }, 100);
            } else if (targetLisaTab === 'lisa1pct' && cartes['lisa-1pct']) {
                setTimeout(() => {
                    cartes['lisa-1pct'].invalidateSize();
                }, 100);
            }
        });
    });

    // Gestion des sous-onglets CAH
    const cahSubtabButtons = document.querySelectorAll('.cah-subtab-button');
    const cahSubtabContents = document.querySelectorAll('.cah-subtab-content');

    cahSubtabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetCAHTab = this.getAttribute('data-cah-tab');

            // Retirer la classe active de tous les boutons et contenus CAH
            cahSubtabButtons.forEach(btn => btn.classList.remove('active'));
            cahSubtabContents.forEach(content => content.classList.remove('active'));

            // Ajouter la classe active au bouton cliqué et au contenu correspondant
            this.classList.add('active');
            document.getElementById(targetCAHTab).classList.add('active');

            // Invalider la taille de la carte CAH pour forcer le redimensionnement
            if (targetCAHTab === 'cah3clusters' && cartes['cah-3']) {
                setTimeout(() => {
                    cartes['cah-3'].invalidateSize();
                }, 100);
            } else if (targetCAHTab === 'cah5clusters' && cartes['cah-5']) {
                setTimeout(() => {
                    cartes['cah-5'].invalidateSize();
                }, 100);
            }
        });
    });

    // Gestion du bouton toggle CAH 3 clusters (carte <-> graphique)
    const toggleCAH3Btn = document.getElementById('toggleCAH3View');
    if (toggleCAH3Btn) {
        toggleCAH3Btn.addEventListener('click', function() {
            const mapView = document.getElementById('cah3-map-view');
            const graphView = document.getElementById('cah3-graph-view');

            if (mapView.style.display === 'none') {
                mapView.style.display = 'block';
                graphView.style.display = 'none';
                this.textContent = '📊 Voir les écarts standardisés';
                setTimeout(() => {
                    if (cartes['cah-3']) {
                        cartes['cah-3'].invalidateSize();
                    }
                }, 100);
            } else {
                mapView.style.display = 'none';
                graphView.style.display = 'block';
                this.textContent = '🗺️ Voir la carte';
            }
        });
    }

    // Gestion du bouton toggle CAH 5 clusters (carte <-> graphique)
    const toggleCAH5Btn = document.getElementById('toggleCAH5View');
    if (toggleCAH5Btn) {
        toggleCAH5Btn.addEventListener('click', function() {
            const mapView = document.getElementById('cah5-map-view');
            const graphView = document.getElementById('cah5-graph-view');

            if (mapView.style.display === 'none') {
                mapView.style.display = 'block';
                graphView.style.display = 'none';
                this.textContent = '📊 Voir les écarts standardisés';
                setTimeout(() => {
                    if (cartes['cah-5']) {
                        cartes['cah-5'].invalidateSize();
                    }
                }, 100);
            } else {
                mapView.style.display = 'none';
                graphView.style.display = 'block';
                this.textContent = '🗺️ Voir la carte';
            }
        });
    }

    // Event listeners pour les checkboxes de contrôle des routes
    const routeCheckboxes = document.querySelectorAll('.route-checkbox');
    routeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Mettre à jour l'affichage des routes sur toutes les cartes
            Object.keys(cartes).forEach(mapType => {
                if (cartes[mapType]) {
                    mettreAJourAffichageRoutes(cartes[mapType], mapType);
                }
            });
        });
    });

    // Event listener pour la checkbox de langue
    const englishCheckbox = document.getElementById('checkbox-english');
    if (englishCheckbox) {
        englishCheckbox.addEventListener('change', function() {
            langueFrancais = !this.checked;
            mettreAJourLegendes();
        });
    }
});

// ============================================
// CHATBOT DUMEGPT
// ============================================

// Fonction pour ajouter un message dans l'interface
function addMessageToChat(text, isUser = false) {
    const messagesContainer = document.getElementById('chatbotMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = isUser ? '👤' : '🤖';

    const content = document.createElement('div');
    content.className = 'message-content';

    // Convertir les retours à la ligne en paragraphes
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    paragraphs.forEach(p => {
        const pElement = document.createElement('p');
        pElement.innerHTML = p;
        content.appendChild(pElement);
    });

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    messagesContainer.appendChild(messageDiv);

    // Scroll vers le bas
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Fonction pour afficher l'indicateur de saisie
function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatbotMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message';
    typingDiv.id = 'typing-indicator-message';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const content = document.createElement('div');
    content.className = 'message-content';

    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';

    content.appendChild(typingIndicator);
    typingDiv.appendChild(avatar);
    typingDiv.appendChild(content);
    messagesContainer.appendChild(typingDiv);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Fonction pour retirer l'indicateur de saisie
function hideTypingIndicator() {
    const typingMessage = document.getElementById('typing-indicator-message');
    if (typingMessage) {
        typingMessage.remove();
    }
}

// Fonction pour envoyer un message (à connecter avec votre backend)
async function sendMessage() {
    const input = document.getElementById('chatbotInput');
    const sendBtn = document.getElementById('chatbotSend');
    const message = input.value.trim();

    if (message === '') return;

    // Afficher le message de l'utilisateur
    addMessageToChat(message, true);

    // Vider l'input et désactiver le bouton
    input.value = '';
    sendBtn.disabled = true;

    // Afficher l'indicateur de saisie
    showTypingIndicator();

    try {
        // TODO: Remplacer par votre appel API backend
        // const response = await fetch('/api/chat', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ message: message, commune: selectedCommune })
        // });
        // const data = await response.json();
        // const botResponse = data.response;

        // Pour l'instant, réponse simulée
        await new Promise(resolve => setTimeout(resolve, 1500));
        const botResponse = "Je suis prêt à vous aider ! Cette fonctionnalité sera bientôt connectée au backend pour répondre à vos questions sur le bien-être dans les communes de Corse.";

        hideTypingIndicator();
        addMessageToChat(botResponse, false);

    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        hideTypingIndicator();
        addMessageToChat("Désolé, une erreur s'est produite. Veuillez réessayer.", false);
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

// Gestion de l'envoi par bouton
document.getElementById('chatbotSend').addEventListener('click', sendMessage);

// Gestion de l'envoi par touche Entrée (Shift+Entrée pour nouvelle ligne)
document.getElementById('chatbotInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
