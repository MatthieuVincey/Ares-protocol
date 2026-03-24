/**
 * multiplayerSystem.js
 * Centralized GameState and Action System for Multiplayer Architecture.
 * This file replaces the direct manipulation of the global `state` object.
 */
// THREE is assumed to be loaded globally via index.html

window.GameState = {
    players: {},    // { [playerId]: PlayerData }
    machines: {},   // { [machineId]: MachineData }
    resources: {},  // { [resourceId]: ResourceData }
    world: {        // Global planet state
        oxygen: 0,
        temp: -60,
        pressure: 0,
        o2Rate: 0,
        heatRate: 0,
        pressRate: 0,
        stage: 0,
        flora: []
    },
    upgrades: {
        jetpack_tank: 0,
        jetpack_thrust: 0,
        drill_efficiency: 0,
        solar_efficiency: 0
    },
    energy: { production: 0, consumption: 0, stored: 0, maxStorage: 0, ratio: 1.0, status: 'OK' }
};

// Unique ID for the current local player
window.localPlayerId = "player_" + Math.random().toString(36).substr(2, 9);

// Data structure for players
window.PlayerData = class PlayerData {
    constructor(id) {
        this.id = id;
        this.o2 = 100;
        this.hp = 100;
        this.energy = 100;
        this.inventory = {
            // Base metals
            Fer: 99999, Aluminium: 99999, Cuivre: 99999, Nickel: 99999, Cobalt: 99999, Titane: 99999, Tungstene: 99999, Platine: 99999, Iridium: 99999,
            // Electronics & minerals
            Silicium: 99999,
            // Crystals
            Cristal: 99999, Cristal_Energie: 99999, Cristal_Quantique: 99999, Cristal_Atmo: 99999, Cristal_Bio: 99999,
            // Gases & fluids
            Gaz: 99999, Gaz_Rares: 99999, Methane: 99999, Hydrogene: 99999, Azote: 99999, Eau: 99999,
            // Ice & organics
            Glace: 99999, Algue_Alien: 99999, Biomasse: 99999, Biomasse_Primitive: 99999, Plante_Alien: 99999,
            // Rare & special
            Minerais_Rares: 99999, Artefact: 99999,
        };
        this.position = { x: 0, y: 10, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.state = "idle"; // "idle", "walking", "running", "jetpack", "driving"
        this.jetpack = { fuel: 100, maxFuel: 100, thrust: 0.16 };
        this.inRoverId = null; // ID of the rover if inside
    }
}

// Data structure for machines/buildings
window.MachineData = class MachineData {
    constructor(id, type, x, y, z, rotationY, ownerId) {
        this.id = id;
        this.type = type;
        this.position = { x, y, z };
        this.rotationY = rotationY;
        this.ownerId = ownerId;
        this.state = {
            active: true,
            progress: 0,
            storage: {}
        };
    }
}

// Data structure for world resources
window.ResourceData = class ResourceData {
    constructor(id, type, x, y, z, quantity) {
        this.id = id;
        this.type = type;
        this.position = { x, y, z };
        this.quantity = quantity;
    }
}

// Initialize Local Player in GameState
window.GameState.players[window.localPlayerId] = new window.PlayerData(window.localPlayerId);


// ============================================================================
// ACTION SYSTEM (Synchronous Logic Mutators)
// ============================================================================

window.sendAction = function(action) {
    // STUB: In a real multiplayer game, this sends data via WebSocket.
    // Console log to simulate outgoing network traffic (disabled in prod)
    // console.log("Sending Action:", action.type);
    
    // For now, immediately apply the action locally.
    window.applyAction(action);
}

window.onReceiveAction = function(action) {
    // STUB: In a real game, this is triggered when WebSocket receives a message.
    window.applyAction(action);
}

window.applyAction = function(action) {
    switch (action.type) {
        // --- PLAYER MOVEMENT ---
        case 'PLAYER_MOVE': {
            const player = window.GameState.players[action.playerId];
            if (player) {
                player.position.x = action.position.x;
                player.position.y = action.position.y;
                player.position.z = action.position.z;
                player.velocity.x = action.velocity.x;
                player.velocity.y = action.velocity.y;
                player.velocity.z = action.velocity.z;
                player.rotation.y = action.rotation.y;
                player.state = action.state;
                if (action.jetpackFuel !== undefined) {
                    player.jetpack.fuel = action.jetpackFuel;
                }
            }
            break;
        }

        // --- MACHINES ---
        case 'PLACE_MACHINE': {
            const machine = new window.MachineData(
                action.machineId, 
                action.machineType, 
                action.position.x, 
                action.position.y, 
                action.position.z, 
                action.rotationY, 
                action.playerId
            );
            window.GameState.machines[action.machineId] = machine;
            break;
        }

        case 'REMOVE_MACHINE': {
            delete window.GameState.machines[action.machineId];
            break;
        }

        // --- WORLD RESOURCES ---
        case 'COLLECT_RESOURCE': {
            const resource = window.GameState.resources[action.resourceId];
            if (resource) {
                resource.quantity -= action.amount;
                if (resource.quantity <= 0) {
                    delete window.GameState.resources[action.resourceId];
                }
                const player = window.GameState.players[action.playerId];
                if (player) {
                    player.inventory[resource.type] = (player.inventory[resource.type] || 0) + action.amount;
                }
            }
            break;
        }

        case 'SPAWN_RESOURCE': {
            window.GameState.resources[action.resourceId] = new window.ResourceData(
                action.resourceId,
                action.resourceType,
                action.position.x,
                action.position.y,
                action.position.z,
                action.quantity
            );
            break;
        }

        // --- PLAYER STATS ---
        case 'UPDATE_PLAYER_STATS': {
            const player = window.GameState.players[action.playerId];
            if (player) {
                if (action.hp !== undefined) player.hp = action.hp;
                if (action.o2 !== undefined) player.o2 = action.o2;
                if (action.energy !== undefined) player.energy = action.energy;
            }
            break;
        }

        // --- TERRAFORMING / ENERGY ---
        case 'UPDATE_TERRAFORMING': {
            window.GameState.world.oxygen = action.oxygen;
            window.GameState.world.temp = action.temp;
            window.GameState.world.pressure = action.pressure;
            window.GameState.world.o2Rate = action.o2Rate;
            window.GameState.world.heatRate = action.heatRate;
            window.GameState.world.pressRate = action.pressRate;
            window.GameState.world.stage = action.stage;
            break;
        }

        case 'UPDATE_ENERGY': {
            window.GameState.energy.production = action.production;
            window.GameState.energy.consumption = action.consumption;
            window.GameState.energy.stored = action.stored;
            window.GameState.energy.maxStorage = action.maxStorage;
            window.GameState.energy.ratio = action.ratio;
            window.GameState.energy.status = action.status;
            break;
        }
        
        default:
            console.warn("Unrecognized action type:", action.type);
            break;
    }
}
