const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// 1. Load the Universal Architecture logic
const { globalScope } = require('./multiplayerSystem.js');
const { BiomeSystem, BIOMES } = require('./biomeSystem.js');
const applyAction = globalScope.applyAction;
const createGameState = globalScope.createGameState;

const biomeSystem = new BiomeSystem(42); // Fixed seed for multiplayer

// Set of active rooms
const rooms = new Map(); // roomId -> { id, gameState, createdAt }

// 1.1 Persistance Logic
const SAVES_DIR = path.join(__dirname, 'saves');
if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
}

function saveRoom(roomId, gameState) {
    if (!roomId || !gameState) return;
    try {
        const filePath = path.join(SAVES_DIR, `${roomId.toUpperCase()}.json`);
        const tempPath = filePath + '.tmp';
        
        const saveData = {
            roomId: roomId,
            lastUpdated: Date.now(),
            gameState: gameState
        };
        
        // Write to tmp and rename mapping (Atomic Write avoids corruption)
        fs.writeFileSync(tempPath, JSON.stringify(saveData));
        fs.renameSync(tempPath, filePath);
    } catch (err) {
        console.error(`[SAVE] Finalization error for room ${roomId}:`, err);
    }
}

function loadRoomSave(roomId) {
    try {
        const filePath = path.join(SAVES_DIR, `${roomId.toUpperCase()}.json`);
        if (!fs.existsSync(filePath)) return null;
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(fileContent);
        
        const loadedState = parsed.gameState;
        // Purge currently active players from the saved state to ensure no "ghost" players
        loadedState.players = {}; 
        
        console.log(`[LOAD] Successfully loaded room ${roomId} from disk.`);
        return loadedState;
    } catch (err) {
        console.error(`[LOAD] Error reading save for room ${roomId}:`, err);
        return null;
    }
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for(let i=0; i<6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

// 1.5. Authoritative World Seeding per Room
function seedWorldForRoom(roomState) {
    console.log("[WORLD] Seeding authoritative resources...");
    
    // Spawn 60 resources right near the start (0,0)
    for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 45;
        const rx = Math.cos(angle) * dist;
        const rz = Math.sin(angle) * dist;
        spawnSingleResource(rx, rz, roomState);
    }

    // Spawn 4000 resources globally, biased closer to the center
    const clusterCount = 4000;
    for (let i = 0; i < clusterCount; i++) {
        const bias = Math.pow(Math.random(), 0.85); 
        const dist = bias * 1400; // max distance 1400m
        const angle = Math.random() * Math.PI * 2;
        const rx = Math.cos(angle) * dist;
        const rz = Math.sin(angle) * dist;
        spawnSingleResource(rx, rz, roomState);
    }
}

function spawnSingleResource(rx, rz, roomState) {
    const biomeId = biomeSystem.getBiomeIdentifier(rx, rz);
    const biome = BIOMES[biomeId];
    const resourceType = biome.resources[Math.floor(Math.random() * biome.resources.length)];
    
    const ry = biomeSystem.getElevation(rx, rz);
    const resourceId = "res_srv_" + Math.random().toString(36).substr(2, 8);
    const finalY = ry + 0.2; 

    applyAction({
        type: 'SPAWN_RESOURCE',
        resourceId: resourceId,
        resourceType: resourceType,
        position: { x: rx, y: finalY, z: rz },
        quantity: 1
    }, roomState);
}

// 1.6 Resource Regeneration System (Iterating all rooms)
setInterval(() => {
    rooms.forEach((room, roomId) => {
        console.log(`[WORLD] Regenerating resources for room ${roomId}...`);
        const newCount = 100;
        let resourcesSpawned = false;
        for (let i = 0; i < newCount; i++) {
            const bias = Math.pow(Math.random(), 0.85); 
            const dist = bias * 1400; 
            const angle = Math.random() * Math.PI * 2;
            const rx = Math.cos(angle) * dist;
            const rz = Math.sin(angle) * dist;
            spawnSingleResource(rx, rz, room.gameState);
            resourcesSpawned = true;
        }
        if (resourcesSpawned) saveRoom(roomId, room.gameState); // Ensure this regen is saved
    });
}, 240000); // 4 minutes

// 1.7 Persistent Background Saver
setInterval(() => {
    rooms.forEach((room, roomId) => {
        saveRoom(roomId, room.gameState);
    });
}, 30000); // 30 seconds


// 2. Setup Express & HTTP
const app = express();
app.use(express.static(__dirname)); // Serve the static game files

const server = http.createServer(app);

// 3. Setup WebSockets
const wss = new WebSocket.Server({ server });

// Map socket to connection data { playerId, roomId }
const clients = new Map(); 

wss.on('connection', (ws) => {
    // Generate temporary ID
    let playerId = "player_" + uuidv4().substr(0, 8);
    let clientData = { playerId: playerId, roomId: null, lastChatTime: 0 };
    clients.set(ws, clientData);
    
    console.log(`[CONNECT] Client connected: ${playerId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'CREATE_ROOM') {
                const roomCode = generateRoomCode();
                const newGameState = createGameState();
                seedWorldForRoom(newGameState);
                
                rooms.set(roomCode, { id: roomCode, gameState: newGameState, createdAt: Date.now(), chat: [] });
                saveRoom(roomCode, newGameState); // Immediate initial save
                
                // Add player to room
                clientData.roomId = roomCode;
                const newPlayer = new globalScope.PlayerData(clientData.playerId);
                newPlayer.pos.set(0, 50, 0);
                if (data.pseudo) newPlayer.pseudo = data.pseudo;
                newGameState.players[clientData.playerId] = newPlayer;

                ws.send(JSON.stringify({ type: 'ROOM_JOINED', roomId: roomCode }));
                ws.send(JSON.stringify({ type: 'INIT', playerId: clientData.playerId, state: newGameState }));
                ws.send(JSON.stringify({ type: 'CHAT_HISTORY', chat: [] }));
                return;
            }

            if (data.type === 'JOIN_ROOM') {
                const roomCode = (data.roomId || "").toUpperCase();
                let room = rooms.get(roomCode);
                
                // If room entirely missing from memory, attempt retrieval from JSON Local DB
                if (!room) {
                    const loadedState = loadRoomSave(roomCode);
                    if (loadedState) {
                        room = { id: roomCode, gameState: loadedState, createdAt: Date.now(), chat: [] };
                        rooms.set(roomCode, room);
                    }
                }
                
                if (room) {
                    clientData.roomId = roomCode;
                    const newPlayer = new globalScope.PlayerData(clientData.playerId);
                    newPlayer.pos.set(0, 50, 0);
                    if (data.pseudo) newPlayer.pseudo = data.pseudo;
                    room.gameState.players[clientData.playerId] = newPlayer;

                    ws.send(JSON.stringify({ type: 'ROOM_JOINED', roomId: roomCode }));
                    ws.send(JSON.stringify({ type: 'INIT', playerId: clientData.playerId, state: room.gameState }));
                    ws.send(JSON.stringify({ type: 'CHAT_HISTORY', chat: room.chat }));
                    
                    saveRoom(roomCode, room.gameState); // Inform the file that a player connected
                } else {
                    ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: `Salon ${roomCode} introuvable.` }));
                }
                return;
            }

            // Must be in a room to do other actions
            if (!clientData.roomId) return;
            const room = rooms.get(clientData.roomId);
            if (!room) return;
            
            if (data.type === 'SESSION_RECLAIM') {
                return;
            }

            if (data.type === 'CHAT') {
                const now = Date.now();
                if (now - clientData.lastChatTime < 1000) return; // Anti-spam 1s
                
                let text = (data.message || "").trim();
                if (text.length === 0) return;
                if (text.length > 100) text = text.substring(0, 100);
                
                clientData.lastChatTime = now;
                const player = room.gameState.players[clientData.playerId];
                const pseudo = player && player.pseudo ? player.pseudo : "Astronaute";
                
                const chatMsg = {
                    type: 'CHAT',
                    playerId: clientData.playerId,
                    pseudo: pseudo,
                    message: text,
                    timestamp: now
                };
                
                room.chat.push(chatMsg);
                if (room.chat.length > 50) room.chat.shift();
                
                const payload = JSON.stringify(chatMsg);
                wss.clients.forEach(client => {
                    const cData = clients.get(client);
                    if (cData && cData.roomId === clientData.roomId && client.readyState === WebSocket.OPEN) {
                        client.send(payload);
                    }
                });
                return;
            }

            if (data.type === 'ACTION') {
                const action = data.action;
                if (action.playerId !== clientData.playerId) return; // Anti-spoof
                
                applyAction(action, room.gameState);
                
                // Active Action Save Trigger (Important Events)
                if (action.type === 'PLACE_MACHINE' || action.type === 'REMOVE_MACHINE' || action.type === 'COLLECT_RESOURCE') {
                    saveRoom(clientData.roomId, room.gameState);
                }
                
                // --- SPECIAL BROADCAST FOR MEMORY OPTIMIZATION ---
                if (action.type === 'COLLECT_RESOURCE') {
                    const removePayload = JSON.stringify({
                        type: 'RESOURCE_REMOVED',
                        resourceId: action.resourceId
                    });
                    wss.clients.forEach(client => {
                        const cData = clients.get(client);
                        if (cData && cData.roomId === clientData.roomId && client.readyState === WebSocket.OPEN) {
                            client.send(removePayload);
                        }
                    });
                }
            }
        } catch (err) {
            console.error(`[ERROR] Failed to parse message from ${clientData.playerId}:`, err);
        }
    });

    ws.on('close', () => {
        console.log(`[DISCONNECT] Client disconnected: ${clientData.playerId}`);
        const currentId = clientData.playerId;
        const currentRoomId = clientData.roomId;
        clients.delete(ws);
        
        setTimeout(() => {
            // Check if ANY socket is still bound to this playerId
            let stillConnected = false;
            clients.forEach(c => { if (c.playerId === currentId) stillConnected = true; });
            
            if (!stillConnected && currentRoomId) {
                const room = rooms.get(currentRoomId);
                if (room && room.gameState.players[currentId]) {
                    delete room.gameState.players[currentId];
                    
                    // Cleanup room if empty
                    if (Object.keys(room.gameState.players).length === 0) {
                        console.log(`[CLEANUP] Room ${currentRoomId} is empty. Saving and putting it to sleep.`);
                        saveRoom(currentRoomId, room.gameState); // Deep sleep final backup
                        rooms.delete(currentRoomId);
                    }
                }
            }
        }, 5000); 
    });
});

// 4. TICKRATE ENGINE (Authoritative State Broadcaster)
const TICK_RATE = 10; 

setInterval(() => {
    // Generate packets for each room
    const roomPayloads = new Map();
    
    rooms.forEach((room, roomId) => {
        const lightGameState = { ...room.gameState };
        delete lightGameState.resources; 
        
        roomPayloads.set(roomId, JSON.stringify({
            type: 'STATE_UPDATE',
            state: lightGameState
        }));
    });

    // Send correct packet to each client
    wss.clients.forEach((client) => {
        const cData = clients.get(client);
        if (cData && cData.roomId && client.readyState === WebSocket.OPEN) {
            const payload = roomPayloads.get(cData.roomId);
            if (payload) client.send(payload);
        }
    });

}, 1000 / TICK_RATE);

// 5. AUTO-CLEANUP SYSTEM (Delete rooms inactive for > 2 days)
function performCleanup() {
    console.log("[CLEANUP] Scanning for expired room saves...");
    const now = Date.now();
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    
    try {
        if (!fs.existsSync(SAVES_DIR)) return;
        const files = fs.readdirSync(SAVES_DIR);
        let deletedCount = 0;

        files.forEach(file => {
            if (!file.endsWith('.json')) return;
            const filePath = path.join(SAVES_DIR, file);
            const stats = fs.statSync(filePath);
            
            if (now - stats.mtimeMs > TWO_DAYS_MS) {
                console.log(`[CLEANUP] Deleting expired room: ${file} (Inactive for ${Math.round((now - stats.mtimeMs)/(24*3600000))} days)`);
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        });
        if (deletedCount > 0) console.log(`[CLEANUP] Successfully purged ${deletedCount} expired room(s).`);
    } catch (err) {
        console.error("[CLEANUP] Error during directory scan:", err);
    }
}

// Initialize cleanup logic
performCleanup();
setInterval(performCleanup, 6 * 60 * 60 * 1000); // Check every 6 hours

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 ARES MULTIPLAYER SERVER (ROOMS) ON PORT ${PORT}`);
    console.log(`===============================================`);
});
