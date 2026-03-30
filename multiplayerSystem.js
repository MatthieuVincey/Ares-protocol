/**
 * multiplayerSystem.js
 * Centralized GameState and Action System for Multiplayer Architecture.
 * This file replaces the direct manipulation of the global `state` object.
 */
// THREE is assumed to be loaded globally via index.html
// Replace window with an isomorphic scope variable
const globalScope = typeof window !== 'undefined' ? window : global;

// Mock THREE.js classes for Node.js backend to prevent crashes during state synchronization
if (typeof globalScope.THREE === 'undefined') {
    globalScope.THREE = {
        Vector3: class {
            constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
            set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
            copy(v) { this.x = typeof v.x === 'number' ? v.x : 0; this.y = typeof v.y === 'number' ? v.y : 0; this.z = typeof v.z === 'number' ? v.z : 0; return this; }
        },
        Euler: class {
            constructor(x = 0, y = 0, z = 0, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; }
            set(x, y, z, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; return this; }
            copy(e) { this.x = e.x; this.y = e.y; this.z = e.z; this.order = e.order; return this; }
        }
    };
}

globalScope.GameState = {
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
globalScope.localPlayerId = "player_" + Math.random().toString(36).substr(2, 9);

// Data structure for players
globalScope.PlayerData = class PlayerData {
    constructor(id) {
        this.id = id;
        this.o2 = 100;
        this.hp = 100;
        this.energy = 100;
        this.inventory = {
            // ... (inventory preserved)
        };
        this.pos = new THREE.Vector3(0, 10, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.state = "idle";
        this.jetpack = { fuel: 100, maxFuel: 100, thrust: 0.16 };
        this.inRoverId = null; // ID of the rover if inside
    }
}

// Data structure for machines/buildings
globalScope.MachineData = class MachineData {
    constructor(id, type, x, y, z, rotationY, ownerId) {
        this.id = id;
        this.type = type;
        this.pos = new THREE.Vector3(x, y, z);
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
globalScope.ResourceData = class ResourceData {
    constructor(id, type, x, y, z, quantity) {
        this.id = id;
        this.type = type;
        this.pos = new THREE.Vector3(x, y, z);
        this.quantity = quantity;
    }
}

// Initialize Local Player in GameState
globalScope.GameState.players[globalScope.localPlayerId] = new globalScope.PlayerData(globalScope.localPlayerId);


// ============================================================================
// ACTION SYSTEM (Synchronous Logic Mutators)
// ============================================================================

globalScope.sendAction = function(action) {
    // SIMULATION LOCALE DE RÉSEAU
    
    // Fast shallow clone to avoid GC spikes and reference sharing
    const actionClone = { ...action };
    if (action.position) actionClone.position = { ...action.position };
    if (action.velocity) actionClone.velocity = { ...action.velocity };
    if (action.rotation) actionClone.rotation = { ...action.rotation };

    // Simulate network latency (20-40ms ping)
    setTimeout(() => {
        globalScope.onReceiveAction(actionClone);
    }, 20 + Math.random() * 20);
}

globalScope.onReceiveAction = function(action) {
    // STUB: In a real game, this is triggered when WebSocket receives a message.
    globalScope.applyAction(action);
}

globalScope.applyAction = function(action) {
    // --- ACTION LOGGING ---
    // Ignore spammy updates for cleaner logs
    if (action.type !== 'PLAYER_MOVE' && action.type !== 'UPDATE_TERRAFORMING' && action.type !== 'UPDATE_PLAYER_STATS' && action.type !== 'UPDATE_ENERGY') {
        let color = '#aaa';
        if (action.type.includes('MACHINE')) color = '#ffaa00';
        else if (action.type.includes('RESOURCE')) color = '#00aaff';
        console.log(`%c[ACTION] ${action.type} by ${action.playerId || 'SERVER'}`, `color: ${color}; font-weight: bold;`, action);
    }

    switch (action.type) {
        // --- PLAYER MOVEMENT ---
        case 'PLAYER_MOVE': {
            // CRITICAL FIX: Ignore echoes of our own movement to prevent rubber-banding
            // The local player already updates their position predictively in the game loop.
            if (action.playerId === globalScope.localPlayerId) break;

            const player = globalScope.GameState.players[action.playerId];
            if (player) {
                player.pos.set(action.position.x, action.position.y, action.position.z);
                player.velocity.set(action.velocity.x, action.velocity.y, action.velocity.z);
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
            if (globalScope.GameState.machines[action.machineId]) {
                console.warn(`%c[CONFLIT] Machine ${action.machineId} (ID Collision)`, `color: #ff0000; font-weight: bold;`);
                break;
            }
            const machine = new globalScope.MachineData(
                action.machineId, 
                action.machineType, 
                action.position.x, 
                action.position.y, 
                action.position.z, 
                action.rotationY, 
                action.playerId
            );
            globalScope.GameState.machines[action.machineId] = machine;
            break;
        }

        case 'REMOVE_MACHINE': {
            delete globalScope.GameState.machines[action.machineId];
            break;
        }

        // --- WORLD RESOURCES ---
        case 'COLLECT_RESOURCE': {
            const resource = globalScope.GameState.resources[action.resourceId];
            if (resource) {
                resource.quantity -= action.amount;
                if (resource.quantity <= 0) {
                    delete globalScope.GameState.resources[action.resourceId];
                }
                const player = globalScope.GameState.players[action.playerId];
                if (player) {
                    player.inventory[resource.type] = (player.inventory[resource.type] || 0) + action.amount;
                }
            } else {
                console.warn(`%c[CONFLIT] Ressource ${action.resourceId} introuvable ou déjà collectée par un autre joueur.`, `color: #ff0000; font-weight: bold;`);
            }
            break;
        }

        case 'SPAWN_RESOURCE': {
            globalScope.GameState.resources[action.resourceId] = new globalScope.ResourceData(
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
            const player = globalScope.GameState.players[action.playerId];
            if (player) {
                if (action.hp !== undefined) player.hp = action.hp;
                if (action.o2 !== undefined) player.o2 = action.o2;
                if (action.energy !== undefined) player.energy = action.energy;
            }
            break;
        }

        // --- TERRAFORMING / ENERGY ---
        case 'UPDATE_TERRAFORMING': {
            globalScope.GameState.world.oxygen = action.oxygen;
            globalScope.GameState.world.temp = action.temp;
            globalScope.GameState.world.pressure = action.pressure;
            globalScope.GameState.world.o2Rate = action.o2Rate;
            globalScope.GameState.world.heatRate = action.heatRate;
            globalScope.GameState.world.pressRate = action.pressRate;
            globalScope.GameState.world.stage = action.stage;
            break;
        }

        case 'UPDATE_ENERGY': {
            globalScope.GameState.energy.production = action.production;
            globalScope.GameState.energy.consumption = action.consumption;
            globalScope.GameState.energy.stored = action.stored;
            globalScope.GameState.energy.maxStorage = action.maxStorage;
            globalScope.GameState.energy.ratio = action.ratio;
            globalScope.GameState.energy.status = action.status;
            break;
        }
        
        default:
            console.warn("Unrecognized action type:", action.type);
            break;
    }
}

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        globalScope
    };
}
