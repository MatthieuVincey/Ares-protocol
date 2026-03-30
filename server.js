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
    const clusterCount = 150;
    for (let i = 0; i < clusterCount; i++) {
        const rx = (Math.random() - 0.5) * 1600;
        const rz = (Math.random() - 0.5) * 1600;
        
        const biomeId = biomeSystem.getBiomeIdentifier(rx, rz);
        const biome = BIOMES[biomeId];
        const resourceType = biome.resources[Math.floor(Math.random() * biome.resources.length)];
        
        const ry = biomeSystem.getElevation(rx, rz);
        const resourceId = "res_srv_" + Math.random().toString(36).substr(2, 8);
        
        // Size offset (assuming default 0.4 roughly)
        const finalY = ry + 0.2; 

        applyAction({
            type: 'SPAWN_RESOURCE',
            resourceId: resourceId,
            resourceType: resourceType,
            position: { x: rx, y: finalY, z: rz },
            quantity: 1
        });
    }
    console.log(`[WORLD] Seeded ${Object.keys(GameState.resources).length} resources.`);
}

seedWorld();

// 2. Setup Express & HTTP
const app = express();
app.use(express.static(__dirname)); // Serve the static game files

const server = http.createServer(app);

// 3. Setup WebSockets
const wss = new WebSocket.Server({ server });

const clients = new Map(); // Map socket to playerId

wss.on('connection', (ws) => {
    // Generate authoritative server-side ID for this client
    const playerId = "player_" + uuidv4().substr(0, 8);
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
            
            if (data.type === 'ACTION') {
                const action = data.action;
                
                // --- ANTI-CHEAT: BASIC VALIDATION ---
                // Enforce that a client can only send actions on behalf of themselves
                if (action.playerId !== playerId) {
                    console.warn(`[SECURITY] Spoofing attempt by ${playerId}: tried to force action for ${action.playerId}`);
                    return;
                }
                
                // Execute the action authoritatively on the server
                applyAction(action);
            }
        } catch (err) {
            console.error(`[ERROR] Failed to parse message from ${playerId}:`, err);
        }
    });

    // Handle detachment
    ws.on('close', () => {
        console.log(`[DISCONNECT] Client disconnected: ${playerId}`);
        delete GameState.players[playerId];
        clients.delete(ws);
    });
});

// 4. TICKRATE ENGINE (Authoritative State Broadcaster)
const TICK_RATE = 20; // 20 Updates Per Second (50ms interval)

setInterval(() => {
    // Send universal state pulse to all connected clients
    const syncPayload = JSON.stringify({
        type: 'STATE_UPDATE',
        state: GameState
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
