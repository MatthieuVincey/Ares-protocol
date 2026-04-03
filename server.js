const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// 1. Load the Universal Architecture logic
const { globalScope } = require('./multiplayerSystem.js');
const { BiomeSystem, BIOMES } = require('./biomeSystem.js');
const GameState = globalScope.GameState;
const applyAction = globalScope.applyAction;

const biomeSystem = new BiomeSystem(42); // Fixed seed for multiplayer

// 1.5. Authoritative World Seeding
function seedWorld() {
    console.log("[WORLD] Seeding authoritative resources...");
    
    // Spawn 60 resources right near the start (0,0)
    for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 45;
        const rx = Math.cos(angle) * dist;
        const rz = Math.sin(angle) * dist;
        spawnSingleResource(rx, rz);
    }

    // Spawn 4000 resources globally, biased closer to the center
    const clusterCount = 4000;
    for (let i = 0; i < clusterCount; i++) {
        // Linear random distribution (smoother) instead of heavy exponent bias
        const bias = Math.pow(Math.random(), 0.85); 
        const dist = bias * 1400; // max distance 1400m
        const angle = Math.random() * Math.PI * 2;
        const rx = Math.cos(angle) * dist;
        const rz = Math.sin(angle) * dist;
        spawnSingleResource(rx, rz);
    }
    
    console.log(`[WORLD] Seeded ${Object.keys(GameState.resources).length} resources.`);
}

function spawnSingleResource(rx, rz) {
    const biomeId = biomeSystem.getBiomeIdentifier(rx, rz);
    const biome = BIOMES[biomeId];
    const resourceType = biome.resources[Math.floor(Math.random() * biome.resources.length)];
    
    const ry = biomeSystem.getElevation(rx, rz);
    const resourceId = "res_srv_" + Math.random().toString(36).substr(2, 8);
    
    // Initial Y offset for server physics (clamped fully on client anyway)
    const finalY = ry + 0.2; 

    applyAction({
        type: 'SPAWN_RESOURCE',
        resourceId: resourceId,
        resourceType: resourceType,
        position: { x: rx, y: finalY, z: rz },
        quantity: 1
    });
}

seedWorld();

// 1.6 Resource Regeneration System
setInterval(() => {
    console.log("[WORLD] Regenerating resources (4min cycle)...");
    
    // Spawn 100 new resources to replace gathered ones
    const newCount = 100;
    for (let i = 0; i < newCount; i++) {
        // Spreading resource regeneration uniformly over a 1400m radius
        const bias = Math.pow(Math.random(), 0.85); 
        const dist = bias * 1400; // max distance 1400m
        const angle = Math.random() * Math.PI * 2;
        const rx = Math.cos(angle) * dist;
        const rz = Math.sin(angle) * dist;
        spawnSingleResource(rx, rz);
    }
    
    console.log(`[WORLD] ${newCount} new resources added. Total: ${Object.keys(GameState.resources).length}`);
}, 240000); // 4 * 60 * 1000 ms = 4 minutes

// 2. Setup Express & HTTP
const app = express();
app.use(express.static(__dirname)); // Serve the static game files

const server = http.createServer(app);

// 3. Setup WebSockets
const wss = new WebSocket.Server({ server });

const clients = new Map(); // Map socket to playerId

wss.on('connection', (ws) => {
    // Generate temporary ID (will be overwritten if reclaiming)
    let playerId = "player_" + uuidv4().substr(0, 8);
    clients.set(ws, playerId);
    
    console.log(`[CONNECT] Client connected: ${playerId}`);

    // Create the player in the authoritative GameState
    const newPlayer = new globalScope.PlayerData(playerId);
    newPlayer.pos.set(0, 50, 0); // Safe drop-in altitude above ground
    GameState.players[playerId] = newPlayer;
    
    // Send initial sync payload to the newly connected client
    ws.send(JSON.stringify({
        type: 'INIT',
        playerId: playerId,
        state: GameState
    }));

    // Handle incoming messages (Actions)
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Reclaim identity if the client was previously connected
            if (data.type === 'SESSION_RECLAIM') {
                const oldId = data.playerId;
                if (GameState.players[oldId]) {
                    console.log(`[SESSION] Reclaiming session for ${oldId} (removing temp ${playerId})`);
                    
                    // Remove the temporary player created for this socket
                    delete GameState.players[playerId];
                    
                    // Bind this socket to the old ID
                    playerId = oldId;
                    clients.set(ws, playerId);
                    
                    if (data.pseudo) GameState.players[oldId].pseudo = data.pseudo;

                    // Re-send the authoritative state for the reclaimed ID
                    ws.send(JSON.stringify({
                        type: 'INIT',
                        playerId: oldId,
                        state: GameState
                    }));
                }
                return;
            }

            if (data.type === 'ACTION') {
                const action = data.action;
                
                // Allow the player to use their now-authoritative identity
                if (action.playerId !== playerId) {
                    console.warn(`[SECURITY] Spoofing attempt by ${playerId}: tried to force action for ${action.playerId}`);
                    return;
                }
                
                // Execute the action authoritatively on the server
                applyAction(action);
                
                // --- SPECIAL BROADCAST FOR MEMORY OPTIMIZATION ---
                // If a resource was collected, tell everyone to remove it locally
                if (action.type === 'COLLECT_RESOURCE') {
                    const removePayload = JSON.stringify({
                        type: 'RESOURCE_REMOVED',
                        resourceId: action.resourceId
                    });
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) client.send(removePayload);
                    });
                }
            }
        } catch (err) {
            console.error(`[ERROR] Failed to parse message from ${playerId}:`, err);
        }
    });

    // Handle detachment
    ws.on('close', () => {
        console.log(`[DISCONNECT] Client disconnected: ${playerId} (Cleanup pending in 5s)`);
        clients.delete(ws);
        
        // Short delay before deleting player to allow for reconnect (session reclaim)
        const currentId = playerId;
        setTimeout(() => {
            // Check if ANY socket is still bound to this playerId
            let stillConnected = false;
            clients.forEach(pid => { if (pid === currentId) stillConnected = true; });
            
            if (!stillConnected) {
                console.log(`[CLEANUP] Removing inactive player: ${currentId}`);
                delete GameState.players[currentId];
            }
        }, 5000); // 5 seconds grace period
    });
});

// 4. TICKRATE ENGINE (Authoritative State Broadcaster)
const TICK_RATE = 10; // Optimized to 10 Updates Per Second to avoid Render OOM

setInterval(() => {
    // Send light universal state pulse (WITHOUT the massive 4000 resources list)
    // This saves ~95% of server memory and CPU during JSON stringification
    const lightGameState = { ...GameState };
    delete lightGameState.resources; // Important: Do not send resources in the high-frequency loop

    const syncPayload = JSON.stringify({
        type: 'STATE_UPDATE',
        state: lightGameState
    });
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(syncPayload);
        }
    });

    // Periodic server-side debug log
    if (Date.now() % 5000 < 100) {
        console.log(`[STATE] Connected: ${clients.size} | Resources: ${Object.keys(GameState.resources).length} | Machines: ${Object.keys(GameState.machines).length}`);
    }
}, 1000 / TICK_RATE);

// 5. BOOT SERVER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 ARES MULTIPLAYER SERVER LISTENING ON PORT ${PORT}`);
    console.log(`➜ Architecture: Authoritative Node.js + ws`);
    console.log(`➜ Tickrate: ${TICK_RATE} Hz`);
    console.log(`===============================================`);
});
