/**
 * ARES PROTOCOL — Energy System
 * Manages electricity production, consumption, storage, and machine states.
 */
class EnergySystem {
    constructor() {
        this.updateInterval = 2.0; // seconds
        this._timer = 0;
    }

    /**
     * Called each frame from the game loop.
     * Throttled to run every `updateInterval` seconds.
     */
    tick(dt, state) {
        this._timer += dt;
        if (this._timer < this.updateInterval) return;
        this._timer = 0;
        this.recalc(state);
    }

    /**
     * Recalculates production, consumption, storage, ratio and status.
     * Exposed publicly so it can also be called immediately after building.
     */
    recalc(state) {
        const e = state.energy;
        const buildings = state.buildings;

        let production = 0;
        let consumption = 0;
        let maxStorage = 0;

        for (const b of buildings) {
            const btype = b.userData && b.userData.btype;
            if (!btype) continue;

            const def = ENERGY_DATA[btype];
            if (!def) continue;

            if (def.energyOutput) production += def.energyOutput;
            if (def.energyUsage) consumption += def.energyUsage;
            if (def.maxStorage) maxStorage += def.maxStorage;
        }

        e.production = production;
        e.consumption = consumption;
        e.maxStorage = maxStorage;

        // Charge / discharge batteries
        const surplus = production - consumption;
        if (surplus > 0 && e.maxStorage > 0) {
            e.stored = Math.min(e.maxStorage, e.stored + surplus * this.updateInterval);
        } else if (surplus < 0) {
            const needed = Math.abs(surplus) * this.updateInterval;
            const drained = Math.min(e.stored, needed);
            e.stored = Math.max(0, e.stored - needed);
            // How much was actually recovered from storage
            const actualSurplus = drained / this.updateInterval;
            production += actualSurplus;
        }

        // Calculate ratio
        if (consumption === 0) {
            e.ratio = 1.0;
        } else {
            e.ratio = Math.min(1.0, production / consumption);
        }

        // Determine status
        if (e.ratio >= 1.0) {
            e.status = 'OK';
        } else if (e.ratio >= 0.3) {
            e.status = 'SLOW';
        } else {
            e.status = 'OFFLINE';
        }
    }
}

/**
 * Energy properties for each building type.
 * energyOutput: energy produced per second (producers)
 * energyUsage: energy consumed per second (consumers)
 * maxStorage: max energy capacity (batteries)
 */
const ENERGY_DATA = {
    // --- PRODUCERS ---
    solar: { energyOutput: 10 },
    solar_adv: { energyOutput: 30 },
    solar_tower: { energyOutput: 150 },
    wind: { energyOutput: 25 },
    wind_adv: { energyOutput: 70 },
    thermal_low: { energyOutput: 80 },
    thermal_adv: { energyOutput: 200 },
    thermal_ind: { energyOutput: 600 },
    geothermal: { energyOutput: 150 },
    nuclear: { energyOutput: 400 },
    nuclear_adv: { energyOutput: 1000 },
    nuke_ind: { energyOutput: 2500 },
    fusion_exp: { energyOutput: 5000 },
    fusion_ind: { energyOutput: 15000 },
    planet_gen: { energyOutput: 50000 },
    mag_gen: { energyOutput: 10000 },
    energy_core: { energyOutput: 100000, maxStorage: 1000000 },

    // --- CONSUMERS: EXTRACTION & REFINING ---
    drill: { energyUsage: 5 },
    drill_adv: { energyUsage: 15 },
    auto_mine: { energyUsage: 80 },
    mineral_ext: { energyUsage: 30 },
    mineral_ext_adv: { energyUsage: 70 },
    seismic_drill: { energyUsage: 150 },
    magma_exca: { energyUsage: 500 },
    meteor_coll: { energyUsage: 120 },
    refinery: { energyUsage: 100 },
    compacteur: { energyUsage: 40 },
    broyeur: { energyUsage: 60 },
    scanner: { energyUsage: 10 },

    // --- CONSUMERS: TERRAFORMING ---
    heat_gen_1: { energyUsage: 25 },
    o2_gen_1: { energyUsage: 20 },
    biodome: { energyUsage: 50 },
    weather_st: { energyUsage: 15 },
    hydro_gen: { energyUsage: 60 },
    irrigation: { energyUsage: 40 },
    terrain_mod: { energyUsage: 200 },
    terra_monument: { energyUsage: 2000 },
    climate: { energyUsage: 100 },
    atmo: { energyUsage: 40 },
    algae: { energyUsage: 15 },
    rain_gen: { energyUsage: 150 },
    cloud_gen: { energyUsage: 250 },
    planet_terra: { energyUsage: 5000 },
    global_clim: { energyUsage: 8000 },

    // --- CONSUMERS: AUTOMATION & DRONES ---
    arm_rob: { energyUsage: 5 },
    conveyor: { energyUsage: 2 },
    storage_auto: { energyUsage: 10 },
    power_dist: { energyUsage: 5 },
    control_int: { energyUsage: 30 },
    collector_bot: { energyUsage: 15 },
    tri_auto: { energyUsage: 20 },
    presse_ind: { energyUsage: 100 },
    maint_bot: { energyUsage: 10 },
    smart_center: { energyUsage: 400 },
    drone_st: { energyUsage: 50 },
    log_hub: { energyUsage: 120 },
    auto_center: { energyUsage: 250 },
    ind_ai: { energyUsage: 1000 },
    auto_factory: { energyUsage: 800 },

    // --- CONSUMERS: MODULES & OTHER ---
    shelter: { energyUsage: 5 },
    serre: { energyUsage: 10 },
    garage: { energyUsage: 20 },
    lab: { energyUsage: 30 },
    bio_lab: { energyUsage: 60 },

    // --- STORAGE ---
    battery: { maxStorage: 1000 },
    battery_xl: { maxStorage: 10000 },
};
