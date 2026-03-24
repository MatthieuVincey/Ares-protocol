/**
 * ARES PROTOCOL — Progression & Tech Tree System
 * Manages TerraformIndex score, player level, and technology unlocking.
 */

// ============================================================
//  LEVEL THRESHOLDS
// ============================================================
const LEVEL_THRESHOLDS = [
    0,     // Niv 1
    50,    // Niv 2  — poser 2-3 bâtiments
    150,   // Niv 3  — démarrer l'O2
    350,   // Niv 4
    700,   // Niv 5  — premiers foreuses avancées
    1200,  // Niv 6
    2000,  // Niv 7
    3500,  // Niv 8
    6000,  // Niv 9
    10000, // Niv 10 — Planète Vivante
    16000, 25000, 40000, 65000, 100000, 160000, 250000, 400000, 650000, 1000000
];

// ============================================================
//  TECH TREE DATA
// ============================================================
const TECH_TREE = {

    // ── ÉNERGIE ────────────────────────────────────────────
    solar_basic: {
        name: 'Cellules Solaires',
        category: 'energy',
        icon: '☀️',
        requiredLevel: 1,
        requiredTechs: [],
        unlocks: ['solar'],
        description: 'Captez l\'énergie solaire. Base de toutes les installations électriques.'
    },
    battery_basic: {
        name: 'Stockage Batterie',
        category: 'energy',
        icon: '🔋',
        requiredLevel: 1,
        requiredTechs: ['solar_basic'],
        unlocks: ['battery'],
        description: 'Stockez l\'énergie excédentaire pour la nuit ou les pics de consommation.'
    },
    wind_turbine: {
        name: 'Éolienne',
        category: 'energy',
        icon: '💨',
        requiredLevel: 2,
        requiredTechs: ['solar_basic'],
        unlocks: ['wind'],
        description: 'Exploite les vents martiens pour une production continue (+25/s).'
    },
    thermal_gen: {
        name: 'Générateur Thermique',
        category: 'energy',
        icon: '🔥',
        requiredLevel: 3,
        requiredTechs: ['wind_turbine'],
        unlocks: ['thermal'],
        description: 'Exploite la chaleur interne de la planète pour produire de l\'énergie.'
    },
    battery_industrial: {
        name: 'Batterie Industrielle',
        category: 'energy',
        icon: '⚡',
        requiredLevel: 4,
        requiredTechs: ['battery_basic', 'thermal_gen'],
        unlocks: ['battery_xl'],
        description: 'Stockage massif d\'énergie pour les bases de grande envergure (5000 kWh).'
    },
    geothermal: {
        name: 'Réacteur Géothermique',
        category: 'energy',
        icon: '🌋',
        requiredLevel: 5,
        requiredTechs: ['thermal_gen'],
        unlocks: ['geothermal'],
        description: 'Exploite le cœur de la planète pour une énergie stable et puissante (+100/s).'
    },
    nuclear_reactor: {
        name: 'Réacteur Nucléaire',
        category: 'energy',
        icon: '☢️',
        requiredLevel: 6,
        requiredTechs: ['geothermal'],
        unlocks: ['nuclear'],
        description: 'Production massive d\'énergie pour les installations industrielles (+200/s).'
    },
    fusion_reactor: {
        name: 'Réacteur à Fusion',
        category: 'energy',
        icon: '✨',
        requiredLevel: 10,
        requiredTechs: ['nuclear_reactor'],
        unlocks: ['fusion'],
        description: 'Énergie quasi-illimitée pour les méga-structures (+1000/s).'
    },
    planetary_generator: {
        name: 'Générateur Planétaire',
        category: 'energy',
        icon: '🌍',
        requiredLevel: 15,
        requiredTechs: ['fusion_reactor'],
        unlocks: ['planet_gen'],
        description: 'Génère de l\'énergie à l\'échelle planétaire. Technologie de civilisation avancée.'
    },

    // ── EXTRACTION ─────────────────────────────────────────
    drill_basic: {
        name: 'Foreuse Basique',
        category: 'extraction',
        icon: '⛏️',
        requiredLevel: 1,
        requiredTechs: [],
        unlocks: ['drill'],
        description: 'Extrait automatiquement les minerais de surface. Libère du temps de jeu.'
    },
    ice_extractor: {
        name: 'Extracteur de Glace',
        category: 'extraction',
        icon: '🧊',
        requiredLevel: 2,
        requiredTechs: ['drill_basic'],
        unlocks: ['ice_ext'],
        description: 'Récupère la glace souterraine pour produire de l\'eau et de l\'hydrogène.'
    },
    glass_extraction: {
        name: 'Extraction de Verre',
        category: 'extraction',
        icon: '💎',
        requiredLevel: 3,
        requiredTechs: ['drill_basic'],
        unlocks: ['glass_drill'],
        description: 'Extrait et raffine le sable silicaté en structures de verre primitives.'
    },
    gas_extractor: {
        name: 'Extracteur de Gaz',
        category: 'extraction',
        icon: '💨',
        requiredLevel: 3,
        requiredTechs: ['ice_extractor'],
        unlocks: ['gas_ext'],
        description: 'Collecte les gaz atmosphériques pour accélérer la terraformation.'
    },
    drill_advanced: {
        name: 'Foreuse Avancée',
        category: 'extraction',
        icon: '🔩',
        requiredLevel: 4,
        requiredTechs: ['drill_basic', 'gas_extractor'],
        unlocks: ['drill_adv'],
        description: 'Vitesse accrue, accès aux minerais rares (Cobalt profond, Titane pur).'
    },
    ore_refinery: {
        name: 'Raffinerie de Minerais',
        category: 'extraction',
        icon: '🏭',
        requiredLevel: 5,
        requiredTechs: ['drill_advanced'],
        unlocks: ['refinery'],
        description: 'Transforme les minerais bruts en matériaux de haute qualité.'
    },
    industrial_drill: {
        name: 'Foreuse Industrielle',
        category: 'extraction',
        icon: '⚙️',
        requiredLevel: 7,
        requiredTechs: ['ore_refinery'],
        unlocks: ['drill_ind'],
        description: 'Production en grande quantité. Extraction continue 24h/24.'
    },
    automated_mine: {
        name: 'Mine Automatisée',
        category: 'extraction',
        icon: '🤖',
        requiredLevel: 9,
        requiredTechs: ['industrial_drill'],
        unlocks: ['auto_mine'],
        description: 'Extraction entièrement autonome. Zéro intervention requise.'
    },
    crystal_extractor: {
        name: 'Extracteur de Cristaux',
        category: 'extraction',
        icon: '💎',
        requiredLevel: 11,
        requiredTechs: ['automated_mine'],
        unlocks: ['crystal_ext'],
        description: 'Extrait les cristaux rares pour les technologies les plus avancées.'
    },

    // ── TERRAFORMATION ─────────────────────────────────────
    oxygen_generator: {
        name: 'Générateur d\'Oxygène',
        category: 'terra',
        icon: '💨',
        requiredLevel: 1,
        requiredTechs: [],
        unlocks: ['o2gen'],
        description: 'Première étape de terraformation. Libère de l\'O₂ dans l\'atmosphère.'
    },
    heat_gen: {
        name: 'Réchauffe-Planète',
        category: 'terra',
        icon: '🌡️',
        requiredLevel: 2,
        requiredTechs: ['oxygen_generator'],
        unlocks: ['heat_gen'],
        description: 'Augmente la température globale. Déclenche la fonte des glaces.'
    },
    atmo_pump: {
        name: 'Pompe Atmosphérique',
        category: 'terra',
        icon: '🏭',
        requiredLevel: 3,
        requiredTechs: ['heat_gen'],
        unlocks: ['atmo'],
        description: 'Compresse les gaz et augmente la pression atmosphérique.'
    },
    algae_spreader: {
        name: 'Répandeur d\'Algues',
        category: 'terra',
        icon: '🌿',
        requiredLevel: 4,
        requiredTechs: ['atmo_pump'],
        unlocks: ['algae'],
        description: 'Crée de la biomasse primitive. Début de la chaîne alimentaire.'
    },
    greenhouse_auto: {
        name: 'Serre Automatisée',
        category: 'terra',
        icon: '🌱',
        requiredLevel: 3,
        requiredTechs: ['oxygen_generator'],
        unlocks: ['serre'],
        description: 'Produit plantes et O₂ via photosynthèse. Améliore la biomasse.'
    },
    biodome: {
        name: 'Bio-Dôme',
        category: 'terra',
        icon: '🔵',
        requiredLevel: 6,
        requiredTechs: ['algae_spreader', 'greenhouse_auto'],
        unlocks: ['biodome'],
        description: 'Crée un écosystème autonome sous pression contrôlée.'
    },
    climate_station: {
        name: 'Station Climatique',
        category: 'terra',
        icon: '🌤️',
        requiredLevel: 8,
        requiredTechs: ['biodome'],
        unlocks: ['climate'],
        description: 'Stabilise le climat régional. Indispensable pour l\'agriculture avancée.'
    },
    rain_generator: {
        name: 'Générateur de Pluie',
        category: 'terra',
        icon: '🌧️',
        requiredLevel: 10,
        requiredTechs: ['climate_station'],
        unlocks: ['rain_gen'],
        description: 'Produit des précipitations. Crée des rivières et réservoirs naturels.'
    },
    cloud_generator: {
        name: 'Générateur de Nuages',
        category: 'terra',
        icon: '☁️',
        requiredLevel: 12,
        requiredTechs: ['rain_generator'],
        unlocks: ['cloud_gen'],
        description: 'Densifie l\'atmosphère. Protège contre les radiations solaires.'
    },
    planetary_terraformer: {
        name: 'Terraformeur Planétaire',
        category: 'terra',
        icon: '🌍',
        requiredLevel: 16,
        requiredTechs: ['cloud_generator'],
        unlocks: ['planet_terra'],
        description: 'Modifie la planète à grande échelle. Le dernier acte de terraformation.'
    },

    // ── AUTOMATION ─────────────────────────────────────────
    transport_drone: {
        name: 'Drone de Transport',
        category: 'automation',
        icon: '🚁',
        requiredLevel: 5,
        requiredTechs: ['drill_basic'],
        unlocks: ['drone_transport'],
        description: 'Transporte automatiquement les ressources entre installations.'
    },
    mining_drone: {
        name: 'Drone Minier',
        category: 'automation',
        icon: '⛏️',
        requiredLevel: 6,
        requiredTechs: ['transport_drone'],
        unlocks: ['drone_mine'],
        description: 'Extrait des ressources dans des zones inaccessibles aux foreuses.'
    },
    resource_conveyor: {
        name: 'Convoyeur de Ressources',
        category: 'automation',
        icon: '➡️',
        requiredLevel: 5,
        requiredTechs: ['transport_drone'],
        unlocks: ['conveyor'],
        description: 'Déplace les ressources entre installations de manière continue.'
    },
    logistic_hub: {
        name: 'Hub Logistique',
        category: 'automation',
        icon: '📦',
        requiredLevel: 7,
        requiredTechs: ['resource_conveyor'],
        unlocks: ['log_hub'],
        description: 'Gère les flux de ressources et optimise la distribution.'
    },
    drone_station: {
        name: 'Station de Drones',
        category: 'automation',
        icon: '🏛️',
        requiredLevel: 8,
        requiredTechs: ['mining_drone', 'logistic_hub'],
        unlocks: ['drone_st'],
        description: 'Coordonne une flotte de drones. Automatisation complète de la base.'
    },
    automation_center: {
        name: 'Centre d\'Automatisation',
        category: 'automation',
        icon: '🤖',
        requiredLevel: 10,
        requiredTechs: ['drone_station'],
        unlocks: ['auto_center'],
        description: 'Cerveau de la base. Coordonne tous les systèmes automatisés.'
    },
    industrial_ai: {
        name: 'IA Industrielle',
        category: 'automation',
        icon: '🧠',
        requiredLevel: 13,
        requiredTechs: ['automation_center'],
        unlocks: ['ind_ai'],
        description: 'Optimise la production à grande échelle. +20% d\'efficacité globale.'
    },
    automated_factory: {
        name: 'Usine Automatisée',
        category: 'automation',
        icon: '⚙️',
        requiredLevel: 14,
        requiredTechs: ['industrial_ai'],
        unlocks: ['auto_factory'],
        description: 'Fabrique automatiquement tous les composants nécessaires à la base.'
    },

    // ── VÉHICULES ──────────────────────────────────────────
    rover_scout: {
        name: 'Rover Éclaireur',
        category: 'vehicles',
        icon: '🚗',
        requiredLevel: 2,
        requiredTechs: [],
        unlocks: ['garage'],
        description: 'Explore rapidement la planète. Révèle les ressources à distance.'
    },
    rover_cargo: {
        name: 'Rover Cargo',
        category: 'vehicles',
        icon: '🚛',
        requiredLevel: 4,
        requiredTechs: ['rover_scout'],
        unlocks: ['garage_cargo'],
        description: 'Transporte de grandes quantités de ressources sur de longues distances.'
    },
    rover_miner: {
        name: 'Rover Minier',
        category: 'vehicles',
        icon: '⛏️',
        requiredLevel: 5,
        requiredTechs: ['rover_cargo'],
        unlocks: ['garage_miner'],
        description: 'Extrait des ressources en déplacement. Exploration et extraction combinées.'
    },
    autonomous_rover: {
        name: 'Rover Autonome',
        category: 'vehicles',
        icon: '🤖',
        requiredLevel: 9,
        requiredTechs: ['rover_miner', 'transport_drone'],
        unlocks: ['garage_auto'],
        description: 'S\'explore et récolte seul. Ne requiert aucune intervention.'
    },
    orbital_shuttle: {
        name: 'Navette Orbitale',
        category: 'vehicles',
        icon: '🚀',
        requiredLevel: 14,
        requiredTechs: ['autonomous_rover'],
        unlocks: ['shuttle'],
        description: 'Accès à l\'orbite. Déverrouille les méga-structures spatiales.'
    },

    // ── SCIENCE ────────────────────────────────────────────
    resource_scanner: {
        name: 'Scanner de Ressources',
        category: 'science',
        icon: '📡',
        requiredLevel: 2,
        requiredTechs: [],
        unlocks: ['scanner'],
        description: 'Détecte les gisements de minerais sur une large zone. +rayon de détection.'
    },
    atmo_scanner: {
        name: 'Scanner Atmosphérique',
        category: 'science',
        icon: '🌫️',
        requiredLevel: 3,
        requiredTechs: ['resource_scanner'],
        unlocks: ['atmo_scan'],
        description: 'Analyse l\'atmosphère en temps réel. Optimise les machines de terraformation.'
    },
    biology_lab: {
        name: 'Laboratoire de Biologie',
        category: 'science',
        icon: '🔬',
        requiredLevel: 5,
        requiredTechs: ['atmo_scanner'],
        unlocks: ['bio_lab'],
        description: 'Étudie les formes de vie émergentes. Prérequis pour les technologies vivantes.'
    },
    planet_analyzer: {
        name: 'Analyseur Planétaire',
        category: 'science',
        icon: '🌐',
        requiredLevel: 7,
        requiredTechs: ['biology_lab'],
        unlocks: ['planet_scan'],
        description: 'Analyse la progression complète de la terraformation. Vue globale de la planète.'
    },
    advanced_research: {
        name: 'Centre de Recherche Avancé',
        category: 'science',
        icon: '🧪',
        requiredLevel: 9,
        requiredTechs: ['planet_analyzer'],
        unlocks: ['lab'],
        description: 'Débloquer les technologies de pointe. +50% de vitesse de recherche.'
    },
    weather_station: {
        name: 'Station Météo',
        category: 'science',
        icon: '🌡️',
        requiredLevel: 6,
        requiredTechs: ['atmo_scanner'],
        unlocks: ['weather_st'],
        description: 'Surveille et prédit les conditions météorologiques. Prévient les tempêtes.'
    },

    // ── VIVANT ─────────────────────────────────────────────
    bio_detector: {
        name: 'Bio-Détecteur',
        category: 'living',
        icon: '🌱',
        requiredLevel: 6,
        requiredTechs: ['biology_lab'],
        unlocks: ['bio_detect'],
        description: 'Détecte les formes de vie émergentes. Révèle la conscience planétaire.'
    },
    energy_plant: {
        name: 'Plante Énergétique',
        category: 'living',
        icon: '⚡',
        requiredLevel: 8,
        requiredTechs: ['bio_detector'],
        unlocks: ['energy_plant'],
        description: 'Plantes génétiquement modifiées qui produisent de l\'énergie biologique.'
    },
    bio_greenhouse: {
        name: 'Bio-Serre Extraterrestre',
        category: 'living',
        icon: '🌺',
        requiredLevel: 9,
        requiredTechs: ['energy_plant'],
        unlocks: ['bio_gh'],
        description: 'Cultive des plantes extraterrestres à haut rendement énergétique.'
    },
    symbiotic_gen: {
        name: 'Générateur Symbiotique',
        category: 'living',
        icon: '🔄',
        requiredLevel: 11,
        requiredTechs: ['bio_greenhouse'],
        unlocks: ['symbiotic'],
        description: 'S\'alimente de la biomasse planétaire. Plus la planète est vivante, plus il produit.'
    },
    planet_communicator: {
        name: 'Communicateur Planétaire',
        category: 'living',
        icon: '🧿',
        requiredLevel: 13,
        requiredTechs: ['symbiotic_gen'],
        unlocks: ['planet_comm'],
        description: 'Établit un canal de communication avec la conscience de la planète.'
    },

    // ── MÉGA-STRUCTURES ────────────────────────────────────
    satellite_network: {
        name: 'Réseau de Satellites',
        category: 'mega',
        icon: '🛰️',
        requiredLevel: 12,
        requiredTechs: ['orbital_shuttle'],
        unlocks: ['sat_net'],
        description: 'Surveille la planète entière. Révèle toute la carte d\'exploration.'
    },
    space_elevator: {
        name: 'Ascenseur Spatial',
        category: 'mega',
        icon: '🛗',
        requiredLevel: 14,
        requiredTechs: ['satellite_network'],
        unlocks: ['space_elev'],
        description: 'Transporte ressources et véhicules vers l\'orbite à grande échelle.'
    },
    global_climate: {
        name: 'Contrôleur Climatique Global',
        category: 'mega',
        icon: '🌤️',
        requiredLevel: 15,
        requiredTechs: ['space_elevator', 'planetary_terraformer'],
        unlocks: ['global_clim'],
        description: 'Contrôle le climat de la planète entière. Fin de la terraformation manuelle.'
    },
    magnetic_gen: {
        name: 'Générateur Magnétique Planétaire',
        category: 'mega',
        icon: '🧲',
        requiredLevel: 16,
        requiredTechs: ['global_climate'],
        unlocks: ['mag_gen'],
        description: 'Crée un champ magnétique artificiel. Protège la planète des radiations.'
    },
    atmo_stabilizer: {
        name: 'Stabilisateur Atmosphérique',
        category: 'mega',
        icon: '🌐',
        requiredLevel: 17,
        requiredTechs: ['magnetic_gen'],
        unlocks: ['atmo_stab'],
        description: 'L\'atmosphère devient permanente. Plus besoin de la maintenir manuellement.'
    },
    energy_core: {
        name: 'Cœur Énergétique Planétaire',
        category: 'mega',
        icon: '💛',
        requiredLevel: 18,
        requiredTechs: ['atmo_stabilizer', 'fusion_reactor'],
        unlocks: ['energy_core'],
        description: 'Énergie gigantesque tirée du cœur de la planète. +10000/s.'
    },
    megacity: {
        name: 'Mégapole Autonome',
        category: 'mega',
        icon: '🏙️',
        requiredLevel: 19,
        requiredTechs: ['energy_core', 'industrial_ai'],
        unlocks: ['megacity'],
        description: 'Une civilisation autonome se développe. La planète est habitée.'
    },
    orbital_station: {
        name: 'Station Orbitale',
        category: 'mega',
        icon: '🛸',
        requiredLevel: 20,
        requiredTechs: ['megacity', 'satellite_network'],
        unlocks: ['orbital_st'],
        description: 'Mission accomplie. La planète est terraformée et habitée depuis l\'espace.'
    },

    // --- ACCESSOIRES & SURVIE (51-55) ---
    jetpack_ion: {
        name: 'Propulsion Ionique',
        category: 'automation',
        icon: '💨',
        requiredLevel: 12,
        requiredTechs: ['automation_center'],
        unlocks: ['jetpack_ion'],
        description: 'Améliore la poussée du jetpack pour des sauts plus hauts et plus rapides.'
    },
    flight_stability: {
        name: 'Stabilisateurs de Vol',
        category: 'automation',
        icon: '🦅',
        requiredLevel: 13,
        requiredTechs: ['jetpack_ion'],
        unlocks: ['flight_stabili'],
        description: 'Augmente la précision du contrôle aérien et réduit la consommation de carburant.'
    },
    o2_emergency: {
        name: 'O2 d’Urgence',
        category: 'automation',
        icon: '🫁',
        requiredLevel: 11,
        requiredTechs: ['automation_center'],
        unlocks: ['o2_tank_ext'],
        description: 'Module de secours augmentant la réserve d\'oxygène mobile.'
    },
    orbital_jump: {
        name: 'Saut Orbital',
        category: 'mega',
        icon: '🌌',
        requiredLevel: 17,
        requiredTechs: ['space_elevator'],
        unlocks: ['jump_module'],
        description: 'Permet des bonds paraboliques immenses à travers les biomes.'
    },
    atmo_shield: {
        name: 'Bouclier Atmo',
        category: 'mega',
        icon: '🛡️',
        requiredLevel: 18,
        requiredTechs: ['orbital_jump'],
        unlocks: ['shield_atmo'],
        description: 'Protège contre les tempêtes statiques et les débris orbitaux.'
    },

    // --- MACHINES DE SURFACE (56-60) ---
    terrain_mod_station: {
        name: 'Modeleur de Terrain',
        category: 'terra',
        icon: '🏔️',
        requiredLevel: 12,
        requiredTechs: ['cloud_generator'],
        unlocks: ['terrain_mod'],
        description: 'Station lourde permettant de niveler le paysage Martien.'
    },
    seismic_extraction: {
        name: 'Extraction Sismique',
        category: 'extraction',
        icon: '💥',
        requiredLevel: 14,
        requiredTechs: ['industrial_drill'],
        unlocks: ['seismic_drill'],
        description: 'Provoque des micro-séismes pour libérer les veines de minerai profond.'
    },
    meteor_collector: {
        name: 'Collecteur de Météorites',
        category: 'extraction',
        icon: '☄️',
        requiredLevel: 15,
        requiredTechs: ['seismic_extraction'],
        unlocks: ['meteor_coll'],
        description: 'Récupère les débris spatiaux riches en métaux précieux après impact.'
    },
    magma_mining: {
        name: 'Minage de Magma',
        category: 'extraction',
        icon: '🌋',
        requiredLevel: 18,
        requiredTechs: ['meteor_collector'],
        unlocks: ['magma_exca'],
        description: 'Excavatrice ultra-résistante pour puiser les métaux liquides dans le manteau.'
    },
    monument_terra: {
        name: 'Monument de Terraformation',
        category: 'mega',
        icon: '🏛️',
        requiredLevel: 20,
        requiredTechs: ['orbital_station'],
        unlocks: ['terra_monument'],
        description: 'Le symbole ultime de la réussite humaine sur une autre planète.'
    },
};

// Category display metadata
const TECH_CATEGORIES = {
    energy: { label: '⚡ Énergie', color: '#ffcc00' },
    extraction: { label: '⛏️ Extraction', color: '#bb8844' },
    terra: { label: '🌍 Terraformation', color: '#44cc66' },
    automation: { label: '🤖 Automatisation', color: '#00aaff' },
    vehicles: { label: '🚗 Véhicules', color: '#ff8833' },
    science: { label: '🔬 Science', color: '#cc44ff' },
    living: { label: '🌱 Planète Vivante', color: '#88ff44' },
    mega: { label: '🏛️ Méga-Structures', color: '#ff4488' },
};

// ============================================================
//  PROGRESSION SYSTEM CLASS
// ============================================================
class ProgressionSystem {
    constructor(state) {
        this._timer = 0;
        this._updateInterval = 5.0; // seconds
        this._showMsg = null; // set by game at init

        // Initialize tech states if not already in state
        if (!state.progression) {
            state.progression = {
                terraformIndex: 1000000, // Insta-max for testing
                level: 20, // Max level for testing
                techs: {},
            };
        }

        // Initial availability check
        this._refreshAvailability(state);
    }

    /** Called each frame from the game loop. */
    tick(dt, state) {
        this._timer += dt;
        if (this._timer < this._updateInterval) return;
        this._timer = 0;
        this._recalc(state);
    }

    /** Full recalculation — also callable externally. */
    _recalc(state) {
        const p = state.progression;
        const t = state.terra;

        // TerraformIndex formula as requested by user
        const oxygen = Math.max(0, t.oxygen) * 1.0;
        const heat = Math.max(0, t.temp + 60) * 1.0;
        const biomass = (t.flora ? t.flora.length : 0) * 1.0;
        const explored = (state.discovered ? state.discovered.size : 0) * 2.0;
        const infra = state.buildings.length * 1.5;

        p.terraformIndex = Math.floor(oxygen + heat + biomass + explored + infra);

        const oldLevel = p.level;
        for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
            if (p.terraformIndex >= LEVEL_THRESHOLDS[i]) {
                p.level = i + 1;
                break;
            }
        }

        if (p.level > oldLevel) {
            this._onLevelUp(p.level, state);
        }
    }

    _onLevelUp(level, state) {
        const msg = `🎉 NIVEAU ${level} ATTEINT ! Nouvelles technologies disponibles — appuyez sur T`;
        if (typeof showMsg === 'function') showMsg(msg);
        // Also mark newly available techs
        this._refreshAvailability(state);
    }

    /** Update all tech availability statuses. */
    _refreshAvailability(state) {
        const p = state.progression;
        for (const [id, tech] of Object.entries(TECH_TREE)) {
            if (p.techs[id] === 'researched') continue;

            const levelOk = p.level >= tech.requiredLevel;
            const prereqsOk = tech.requiredTechs.every(r => p.techs[r] === 'researched');

            p.techs[id] = (levelOk && prereqsOk) ? 'available' : 'locked';
        }
    }

    /** Research a tech by id. Returns true on success. */
    researchTech(id, state) {
        const p = state.progression;
        const tech = TECH_TREE[id];
        if (!tech) return false;
        if (p.techs[id] === 'researched') return false;
        if (p.techs[id] !== 'available') return false;

        p.techs[id] = 'researched';
        this._refreshAvailability(state);

        if (typeof showMsg === 'function') {
            showMsg(`✅ ${tech.name} débloquée ! Construction disponible dans le menu de construction.`);
        }

        return true;
    }

    /** Returns the current tech status for a given id. */
    getTechStatus(id, state) {
        return state.progression.techs[id] || 'locked';
    }

    /** Check if a BUILD_DATA key is buildable given current techs. */
    isBuildable(buildKey, state) {
        // Find which tech unlocks this buildKey
        for (const [techId, tech] of Object.entries(TECH_TREE)) {
            if (tech.unlocks && tech.unlocks.includes(buildKey)) {
                return state.progression.techs[techId] === 'researched';
            }
        }
        // If no tech gates it, it's always available (shelter etc.)
        return true;
    }

    /** Called after game starts to populate initial availability. */
    init(state) {
        this._refreshAvailability(state);
    }

    /** Returns progress to next level as 0..1 */
    getLevelProgress(state) {
        const p = state.progression;
        const lvl = p.level;
        if (lvl >= LEVEL_THRESHOLDS.length) return 1;
        const curr = LEVEL_THRESHOLDS[lvl - 1];
        const next = LEVEL_THRESHOLDS[lvl];
        return Math.min(1, (p.terraformIndex - curr) / (next - curr));
    }

    /** Next level threshold. */
    getNextThreshold(state) {
        const lvl = state.progression.level;
        return lvl < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[lvl] : null;
    }
}
