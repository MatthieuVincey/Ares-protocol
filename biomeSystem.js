// ============================================================
//  Biome System (Ares Protocol)
// ============================================================

const BIOMES = {
    red_desert: {
        id: 'red_desert',
        name: 'Plaines Rocheuses',
        description: 'Vastes plaines basaltiques sous un ciel azur profond.',
        color: 0x2a2a2a,
        resources: ['Fer', 'Silicium', 'Aluminium', 'Cuivre'],
        decorations: ['rock_small', 'rock_med', 'dust_dune', 'scrap_metal'],
        dangerLevel: 1,
        temp: 0.4,
        humidity: 0.1,
        getElevation: (x, z, fbm) => fbm(x, z, 4, 0.05)
    },
    cracked_ice: {
        id: 'cracked_ice',
        name: 'Glace Fraisurée',
        description: 'Champs de glace cryogénique avec des crevasses profondes et des dépôts d\'hydrogène.',
        color: 0xcceedd,
        resources: ['Glace', 'Hydrogene', 'Azote', 'Silicium'],
        decorations: ['ice_boulder', 'ice_shard', 'cryo_vent'],
        dangerLevel: 2,
        temp: 0.1,
        humidity: 0.3,
        getElevation: (x, z, fbm) => 10 + fbm(x, z, 2, 0.02) + (Math.abs(fbm(x, z, 5, 0.1)) > 3 ? -15 : 0)
    },
    crystal_valley: {
        id: 'crystal_valley',
        name: 'Vallée Cristalline',
        description: 'Formations de silicate pur et cristaux énergétiques émettant une lumière bleutée.',
        color: 0xaa44ff,
        resources: ['Cristal_Energie', 'Cristal_Quantique', 'Cristal_Atmo', 'Platine'],
        decorations: ['crystal_giant', 'crystal_cluster', 'energy_spore'],
        dangerLevel: 1,
        temp: 0.5,
        humidity: 0.6,
        getElevation: (x, z, fbm) => fbm(x, z, 5, 0.08) * 1.5
    },
    volcanic_plain: {
        id: 'volcanic_plain',
        name: 'Plaine Volcanique',
        description: 'Coulées de basalte noir et lacs de magma riches en métaux lourds.',
        color: 0x221100,
        resources: ['Iridium', 'Tungstene', 'Methane', 'Cobalt'],
        decorations: ['magma_rock', 'basalt_column', 'thermal_siphon'],
        dangerLevel: 3,
        temp: 0.95,
        humidity: 0.05,
        getElevation: (x, z, fbm) => {
            let base = fbm(x, z, 6, 0.04);
            return base > 8 ? base + 15 : base;
        }
    },
    future_oasis: {
        id: 'future_oasis',
        name: 'Oasis du Futur',
        description: 'Zone terraformée avec des mousses synthétiques et des gisements organiques.',
        color: 0x2a5a30,
        resources: ['Eau', 'Algue_Alien', 'Biomasse', 'Plante_Alien'],
        decorations: ['alien_tree', 'moss_patch', 'water_pool'],
        dangerLevel: 0,
        temp: 0.7,
        humidity: 0.8,
        getElevation: (x, z, fbm) => fbm(x, z, 5, 0.05) + 5
    },
    // Keep specialized rare biomes
    meteor_crater: {
        id: 'meteor_crater',
        name: 'Cratère d\'Impact',
        description: 'Zone d\'extraction de minerais stellaires rares.',
        color: 0x443333,
        resources: ['Iridium', 'Platine', 'Or'],
        decorations: ['meteor_shard', 'impact_glass'],
        dangerLevel: 1,
        temp: 0.5,
        humidity: 0.2,
        isRare: true,
        getElevation: (x, z, fbm) => {
            const dist = Math.sqrt(x*x + z*z);
            if (dist < 100) return -20 + (dist/10);
            return fbm(x, z, 4, 0.05);
        }
    },
    alien_ruins: {
        id: 'alien_ruins',
        name: 'Ruines Industrielles',
        description: 'Vestiges d\'une civilisation disparue ou de missions passées.',
        color: 0x444444,
        resources: ['Cristal_Quantique', 'Artefact', 'Scrap'],
        decorations: ['ruin_pillar', 'monolith', 'wreckage'],
        dangerLevel: 2,
        temp: 0.5,
        humidity: 0.5,
        isRare: true,
        getElevation: (x, z, fbm) => fbm(x, z, 2, 0.1)
    }
};

class BiomeSystem {
    constructor() {
        this.biomes = Object.values(BIOMES);
        this.tOffset = Math.random() * 10000;
        this.hOffset = Math.random() * 10000;
        this.wOffset = Math.random() * 10000;
        this.cOffset = Math.random() * 10000; // Continental Scale
    }

    hash(ix, iz) {
        const x = Math.sin(ix + iz * 57) * 43758.5453;
        return x - Math.floor(x);
    }

    noise2d(x, z) {
        const ix = Math.floor(x), iz = Math.floor(z);
        const fx = x - ix, fz = z - iz;
        const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
        const a = this.hash(ix, iz), b = this.hash(ix + 1, iz);
        const c = this.hash(ix, iz + 1), d = this.hash(ix + 1, iz + 1);
        return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
    }

    fbm(x, z, baseAmp = 4, baseFreq = 0.05) {
        let v = 0, amp = baseAmp, freq = baseFreq;
        for (let i = 0; i < 4; i++) { 
            v += amp * this.noise2d(x * freq, z * freq); 
            amp *= 0.5; 
            freq *= 2.1; 
        }
        return v;
    }

    getBiomeIdentifier(x, z) {
        const weirdness = this.fbm(x + this.wOffset, z + this.wOffset, 1, 0.01);
        if (weirdness > 0.85) return 'alien_ruins';
        const distFromCenter = Math.sqrt(x*x + z*z);
        if (Math.abs(distFromCenter - 800) < 50 && weirdness > 0.7) return 'meteor_crater';

        const tempNoise = this.fbm(x + this.tOffset, z + this.tOffset, 1, 0.002);
        const humNoise = this.fbm(x + this.hOffset, z + this.hOffset, 1, 0.002);
        const t = Math.max(0, Math.min(1, tempNoise * 1.5 - 0.2));
        const h = Math.max(0, Math.min(1, humNoise * 1.5 - 0.2));

        if (t > 0.7 && h < 0.3) return 'volcanic_plain';
        if (t > 0.5 && h < 0.4) return 'red_desert';
        if (t < 0.3 && h < 0.5) return 'cracked_ice';
        if (t < 0.5 && h > 0.7) return 'future_oasis';
        if (t > 0.6 && h > 0.6) return 'future_oasis';
        if (t > 0.4 && t < 0.6 && h > 0.4 && h < 0.6) return 'red_desert';
        if (t < 0.4 && h < 0.7) return 'cracked_ice';
        if (t > 0.3 && t < 0.8 && h < 0.2) return 'red_desert';
        if (h > 0.8) return 'crystal_valley';
        return 'red_desert';
    }

    getBiome(id) {
        return BIOMES[id] || BIOMES.red_desert;
    }

    getBlendedTerrain(x, z) {
        // --- CONTINENTAL GEOGRAPHY ---
        // Very low frequency noise for continents vs basins
        const cont = this.fbm(x + this.cOffset, z + this.cOffset, 1, 0.0005);
        // Map [0, 1] to a broad vertical range: Basins (-15m) to Highlands (+10m)
        const continentLevel = (cont - 0.5) * 40; 

        const b0 = this.getBiome(this.getBiomeIdentifier(x, z));
        const b1 = this.getBiome(this.getBiomeIdentifier(x + 20, z));
        const b2 = this.getBiome(this.getBiomeIdentifier(x, z + 20));
        
        let y0 = b0.getElevation(x, z, this.fbm.bind(this)) + continentLevel;
        if (b0.id === b1.id && b0.id === b2.id) return { y: y0, biome: b0 };
        
        let y1 = b1.getElevation(x, z, this.fbm.bind(this)) + continentLevel;
        let y2 = b2.getElevation(x, z, this.fbm.bind(this)) + continentLevel;
        
        return { y: (y0 * 2 + y1 + y2) / 4, biome: b0 };
    }

    getElevation(x, z) {
        return this.getBlendedTerrain(x, z).y;
    }
}

if (typeof window !== 'undefined') {
    window.BiomeSystem = BiomeSystem;
    window.BIOMES = BIOMES;
}
