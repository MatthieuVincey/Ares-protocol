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
            clone() { return new globalScope.THREE.Vector3(this.x, this.y, this.z); }
            sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
            subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
            add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
            multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
            dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
            lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
            length() { return Math.sqrt(this.lengthSq()); }
            normalize() { const l = this.length(); return l === 0 ? this : this.multiplyScalar(1 / l); }
            distanceTo(v) { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2); }
            distanceToSquared(v) { return (this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2; }
        },
        Euler: class {
            constructor(x = 0, y = 0, z = 0, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; }
            set(x, y, z, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; return this; }
            copy(e) { this.x = e.x; this.y = e.y; this.z = e.z; this.order = e.order; return this; }
        }
    };
}

globalScope.createGameState = function() {
    return {
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
};

globalScope.GameState = globalScope.createGameState();

// Unique ID for the current local player
globalScope.localPlayerId = "player_" + Math.random().toString(36).substr(2, 9);

// Weapons Database
globalScope.Weapons = {
    pistol: {
        type: "pistol",
        damage: 10,
        fireRate: 400, // ms between shots
        maxAmmo: 10,
        reloadTime: 1500,
        range: 150
    },
    smg: {
        type: "smg",
        damage: 6,
        fireRate: 100,
        maxAmmo: 30,
        reloadTime: 2000,
        range: 100
    },
    rocket: {
        type: "rocket",
        damage: 100, // AOE max damage
        fireRate: 2000,
        maxAmmo: 1,
        reloadTime: 3000,
        range: 200,
        aoeRadius: 15
    }
};

// Data structure for players
globalScope.PlayerData = class PlayerData {
    constructor(id) {
        this.id = id;
        this.o2 = 100;
        this.hp = 100;
        this.energy = 100;
        this.inventory = {
            Fer: 20, Aluminium: 20, Silicium: 20, Cuivre: 20, Titane: 20, 
            Eau: 20, Biomasse: 20, Silice: 20, Nickel: 20, Cobalt: 20,
            Platine: 20, Uranium: 20, Iridium: 20, Tungstene: 20
        };
        this.pos = new THREE.Vector3(0, 10, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.pseudo = "Astronaute";
        this.state = "idle";
        this.jetpack = { fuel: 100, maxFuel: 100, thrust: 0.16 };
        this.inRoverId = null; // ID of the rover if inside
        
        // Combat stats
        this.isAlive = true;
        this.weaponsUnlocked = false; // Set to true via cheat code
        this.currentWeapon = 'pistol';
        this.ammo = {
            pistol: globalScope.Weapons.pistol.maxAmmo,
            smg: globalScope.Weapons.smg.maxAmmo,
            rocket: globalScope.Weapons.rocket.maxAmmo
        };
        this.lastShotTime = 0;
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
        // Combat stats
        this.maxHealth = 500;
        this.health = 500;
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

globalScope.applyAction = function(action, targetState = globalScope.GameState) {
    // --- ACTION LOGGING ---
    // Ignore spammy updates for cleaner logs
    if (action.type !== 'PLAYER_MOVE' && action.type !== 'UPDATE_TERRAFORMING' && action.type !== 'UPDATE_PLAYER_STATS' && action.type !== 'UPDATE_ENERGY') {
        let color = '#aaa';
        if (action.type.includes('MACHINE')) color = '#ffaa00';
        else if (action.type.includes('RESOURCE')) color = '#00aaff';
        // Only log action basics to keep console clean, avoid logging full targetState
        console.log(`%c[ACTION] ${action.type} by ${action.playerId || 'SERVER'}`, `color: ${color}; font-weight: bold;`);
    }

    switch (action.type) {
        // --- PLAYER MOVEMENT ---
        case 'PLAYER_MOVE': {
            // CRITICAL FIX: Ignore echoes of our own movement to prevent rubber-banding
            // The local player already updates their position predictively in the game loop.
            if (action.playerId === globalScope.localPlayerId) break;

            const player = targetState.players[action.playerId];
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
            if (targetState.machines[action.machineId]) {
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
            targetState.machines[action.machineId] = machine;
            break;
        }

        case 'REMOVE_MACHINE': {
            delete targetState.machines[action.machineId];
            break;
        }

        // --- WORLD RESOURCES ---
        case 'COLLECT_RESOURCE': {
            const resource = targetState.resources[action.resourceId];
            if (resource) {
                resource.quantity -= action.amount;
                if (resource.quantity <= 0) {
                    delete targetState.resources[action.resourceId];
                }
                const player = targetState.players[action.playerId];
                if (player) {
                    player.inventory[resource.type] = (player.inventory[resource.type] || 0) + action.amount;
                }
            } else {
                console.warn(`%c[CONFLIT] Ressource ${action.resourceId} introuvable ou déjà collectée par un autre joueur.`, `color: #ff0000; font-weight: bold;`);
            }
            break;
        }

        case 'SPAWN_RESOURCE': {
            targetState.resources[action.resourceId] = new globalScope.ResourceData(
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
            const player = targetState.players[action.playerId];
            if (player) {
                if (action.hp !== undefined) player.hp = action.hp;
                if (action.o2 !== undefined) player.o2 = action.o2;
                if (action.energy !== undefined) player.energy = action.energy;
            }
            break;
        }

        // --- CUSTOMIZATION ---
        case 'UPDATE_PSEUDO': {
            const player = targetState.players[action.playerId];
            if (player && action.pseudo) {
                player.pseudo = action.pseudo;
            }
            break;
        }

        // --- TERRAFORMING / ENERGY ---
        case 'UPDATE_TERRAFORMING': {
            targetState.world.oxygen = action.oxygen;
            targetState.world.temp = action.temp;
            targetState.world.pressure = action.pressure;
            targetState.world.o2Rate = action.o2Rate;
            targetState.world.heatRate = action.heatRate;
            targetState.world.pressRate = action.pressRate;
            targetState.world.stage = action.stage;
            break;
        }

        case 'UPDATE_ENERGY': {
            targetState.energy.production = action.production;
            targetState.energy.consumption = action.consumption;
            targetState.energy.stored = action.stored;
            targetState.energy.maxStorage = action.maxStorage;
            targetState.energy.ratio = action.ratio;
            targetState.energy.status = action.status;
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
