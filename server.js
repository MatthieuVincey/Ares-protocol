const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const { globalScope } = require('./multiplayerSystem.js');
const { BiomeSystem, BIOMES } = require('./biomeSystem.js');
const applyAction = globalScope.applyAction;
const createGameState = globalScope.createGameState;

const biomeSystem = new BiomeSystem(42);

const SAVES_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
}

const WORLD_SAVE_PATH = path.join(SAVES_DIR, 'world.json');

let worldState = null;
let worldChat = [];

function saveWorld() {
    if (!worldState) return;
    try {
        const tempPath = WORLD_SAVE_PATH + '.tmp';
        const saveData = {
            lastUpdated: Date.now(),
            gameState: worldState,
            chat: worldChat
        };
        fs.writeFileSync(tempPath, JSON.stringify(saveData));
        fs.renameSync(tempPath, WORLD_SAVE_PATH);
    } catch (err) {
        console.error(`[SAVE] Error saving world:`, err);
    }
}

function loadWorldSave() {
    try {
        if (!fs.existsSync(WORLD_SAVE_PATH)) return false;
        const fileContent = fs.readFileSync(WORLD_SAVE_PATH, 'utf8');
        const parsed = JSON.parse(fileContent);
        worldState = parsed.gameState;
        worldChat = parsed.chat || [];
        worldState.players = {}; 
        console.log(`[LOAD] Successfully loaded world from disk.`);
        return true;
    } catch (err) {
        console.error(`[LOAD] Error reading world save:`, err);
        return false;
    }
}

function seedWorld() {
    console.log("[WORLD] Seeding authoritative resources...");
    for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 45;
        const rx = Math.cos(angle) * dist;
        const rz = Math.sin(angle) * dist;
        spawnSingleResource(rx, rz);
    }
    const clusterCount = 4000;
    for (let i = 0; i < clusterCount; i++) {
        const bias = Math.pow(Math.random(), 0.85); 
        const dist = bias * 1400;
        const angle = Math.random() * Math.PI * 2;
        const rx = Math.cos(angle) * dist;
        const rz = Math.sin(angle) * dist;
        spawnSingleResource(rx, rz);
    }
}

function spawnSingleResource(rx, rz) {
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
    }, worldState);
}

// Initialize World
if (!loadWorldSave()) {
    console.log("[WORLD] No save found, creating new world...");
    worldState = createGameState();
    seedWorld();
    saveWorld();
}

// Resource Regeneration System
setInterval(() => {
    console.log(`[WORLD] Regenerating resources...`);
    const newCount = 100;
    let resourcesSpawned = false;
    for (let i = 0; i < newCount; i++) {
        const bias = Math.pow(Math.random(), 0.85); 
        const dist = bias * 1400; 
        const angle = Math.random() * Math.PI * 2;
        const rx = Math.cos(angle) * dist;
        const rz = Math.sin(angle) * dist;
        spawnSingleResource(rx, rz);
        resourcesSpawned = true;
    }
    if (resourcesSpawned) saveWorld();
}, 240000); // 4 minutes

// Persistent Background Saver
setInterval(() => {
    saveWorld();
}, 30000); // 30 seconds

const app = express();
app.use(express.static(__dirname));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Map(); 

wss.on('connection', (ws) => {
    let playerId = "player_" + uuidv4().substr(0, 8);
    let clientData = { playerId: playerId, lastChatTime: 0, joined: false };
    clients.set(ws, clientData);
    
    console.log(`[CONNECT] Client connected: ${playerId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'JOIN_WORLD') {
                clientData.joined = true;
                const newPlayer = new globalScope.PlayerData(clientData.playerId);
                newPlayer.pos.set(0, 50, 0);
                if (data.pseudo) newPlayer.pseudo = data.pseudo;
                worldState.players[clientData.playerId] = newPlayer;

                ws.send(JSON.stringify({ type: 'WORLD_JOINED' }));
                ws.send(JSON.stringify({ type: 'INIT', playerId: clientData.playerId, state: worldState }));
                ws.send(JSON.stringify({ type: 'CHAT_HISTORY', chat: worldChat }));
                
                saveWorld(); // Inform the file that a player connected
                return;
            }

            if (!clientData.joined) return;
            
            if (data.type === 'CHAT') {
                const now = Date.now();
                if (now - clientData.lastChatTime < 1000) return; 
                
                let text = (data.message || "").trim();
                if (text.length === 0) return;
                if (text.length > 100) text = text.substring(0, 100);
                
                clientData.lastChatTime = now;
                const player = worldState.players[clientData.playerId];
                const pseudo = player && player.pseudo ? player.pseudo : "Astronaute";
                
                if (text === "991-armes" && player) {
                    player.weaponsUnlocked = true;
                    player.currentWeapon = 'rocket'; 
                    player.ammo = { pistol: 999, smg: 999, rocket: 999 };
                    text = "*** A DÉBLOQUÉ L'ARSENAL COMPLET ***";
                }
                
                if (text === "991-ammo" && player) {
                    player.infiniteAmmo = true;
                    text = "*** MUNITIONS INFINIES ACTIVÉES ***";
                }
                
                const chatMsg = { type: 'CHAT', playerId: clientData.playerId, pseudo: pseudo, message: text, timestamp: now };
                worldChat.push(chatMsg);
                if (worldChat.length > 50) worldChat.shift();
                
                const payload = JSON.stringify(chatMsg);
                wss.clients.forEach(client => {
                    const cData = clients.get(client);
                    if (cData && cData.joined && client.readyState === WebSocket.OPEN) {
                        client.send(payload);
                    }
                });
                return;
            }

            if (data.type === 'ACTION') {
                const action = data.action;
                if (action.playerId !== clientData.playerId) return; 
                
                if (action.type === 'PLAYER_MOVE') {
                    const p = worldState.players[action.playerId];
                    if (p) {
                        p.pos = action.position;
                        p.rotation = action.rotation;
                        p.velocity = action.velocity;
                        p.state = action.state;
                        if(p.jetpack) p.jetpack.fuel = action.jetpackFuel;
                    }
                    
                    const movePayload = JSON.stringify({ type: 'PLAYER_MOVED', action: action });
                    wss.clients.forEach(client => {
                        const cData = clients.get(client);
                        if (cData && cData.joined && cData.playerId !== clientData.playerId && client.readyState === WebSocket.OPEN) {
                            client.send(movePayload);
                        }
                    });
                    return; 
                }

                if (action.type === 'SHOOT') {
                    const shooter = worldState.players[action.playerId];
                    const weapon = globalScope.Weapons[action.weaponType];
                    
                    if (shooter && weapon && shooter.isAlive) {
                        const now = Date.now();
                        if (now - (shooter.lastShotTime || 0) < weapon.fireRate - 50) return; 
                        if (!shooter.infiniteAmmo && shooter.ammo[weapon.type] <= 0) return; 
                        
                        shooter.lastShotTime = now;
                        if (!shooter.infiniteAmmo) shooter.ammo[weapon.type]--;
                        
                        const shotPayload = JSON.stringify({ type: 'SHOT_FIRED', action: action });
                        wss.clients.forEach(client => {
                            const cData = clients.get(client);
                            if (cData && cData.joined && client.readyState === WebSocket.OPEN) {
                                client.send(shotPayload);
                            }
                        });

                        const rayOrigin = new globalScope.THREE.Vector3(action.position.x, action.position.y, action.position.z);
                        const rayDir = new globalScope.THREE.Vector3(action.direction.x, action.direction.y, action.direction.z).normalize();
                        
                        let closestHit = null;
                        let minT = weapon.range;

                        for (const pid in worldState.players) {
                            if (pid === action.playerId) continue;
                            const target = worldState.players[pid];
                            if (!target.isAlive) continue;
                            const oc = new globalScope.THREE.Vector3().subVectors(rayOrigin, target.pos);
                            const a = rayDir.x * rayDir.x + rayDir.z * rayDir.z;
                            const b = 2.0 * (oc.x * rayDir.x + oc.z * rayDir.z);
                            const c = oc.x * oc.x + oc.z * oc.z - (0.6 * 0.6); 
                            const discriminant = b * b - 4 * a * c;
                            if (discriminant > 0) {
                                let t = (-b - Math.sqrt(discriminant)) / (2.0 * a);
                                if (t > 0 && t < minT) {
                                    const hitY = rayOrigin.y + t * rayDir.y;
                                    if (hitY >= target.pos.y && hitY <= target.pos.y + 2) {
                                        minT = t;
                                        closestHit = { type: 'player', id: pid, entity: target };
                                    }
                                }
                            }
                        }

                        for (const mid in worldState.machines) {
                            const machine = worldState.machines[mid];
                            const oc = new globalScope.THREE.Vector3().subVectors(rayOrigin, machine.pos);
                            const a = rayDir.dot(rayDir);
                            const b = 2.0 * oc.dot(rayDir);
                            const c = oc.dot(oc) - (3.5 * 3.5);
                            const discriminant = b * b - 4 * a * c;
                            if (discriminant > 0) {
                                let t = (-b - Math.sqrt(discriminant)) / (2.0 * a);
                                if (t > 0 && t < minT) {
                                    minT = t;
                                    closestHit = { type: 'machine', id: mid, entity: machine };
                                }
                            }
                        }

                        const impactPoint = new globalScope.THREE.Vector3().copy(rayOrigin).add(rayDir.clone().multiplyScalar(minT));
                        let damageEvents = [];

                        if (weapon.type === 'rocket') {
                            const radius = weapon.aoeRadius;
                            for (const pid in worldState.players) {
                                const p = worldState.players[pid];
                                if (!p.isAlive) continue;
                                const dist = p.pos.distanceTo(impactPoint);
                                if (dist < radius) {
                                    const dmg = Math.floor(weapon.damage * (1 - dist / radius));
                                    p.hp -= dmg;
                                    if (p.hp <= 0) p.isAlive = false;
                                    damageEvents.push({ type: 'player', id: pid, damage: dmg, hp: p.hp, isAlive: p.isAlive });
                                }
                            }
                            for (const mid in worldState.machines) {
                                const m = worldState.machines[mid];
                                const dist = m.pos.distanceTo(impactPoint);
                                if (dist < radius) {
                                    const dmg = Math.floor(weapon.damage * (1 - dist / radius));
                                    m.health -= dmg;
                                    damageEvents.push({ type: 'machine', id: mid, damage: dmg, health: m.health });
                                }
                            }
                        } else if (closestHit) {
                            if (closestHit.type === 'player') {
                                closestHit.entity.hp -= weapon.damage;
                                if (closestHit.entity.hp <= 0) closestHit.entity.isAlive = false;
                                damageEvents.push({ type: 'player', id: closestHit.id, damage: weapon.damage, hp: closestHit.entity.hp, isAlive: closestHit.entity.isAlive });
                            } else if (closestHit.type === 'machine') {
                                closestHit.entity.health -= weapon.damage;
                                damageEvents.push({ type: 'machine', id: closestHit.id, damage: weapon.damage, health: closestHit.entity.health });
                            }
                        }

                        if (damageEvents.length > 0 || weapon.type === 'rocket') {
                            const hitPayload = JSON.stringify({ type: 'HIT_REGISTERED', weaponType: weapon.type, impactPoint: impactPoint, events: damageEvents });
                            wss.clients.forEach(client => {
                                const cData = clients.get(client);
                                if (cData && cData.joined && client.readyState === WebSocket.OPEN) {
                                    client.send(hitPayload);
                                }
                            });
                        }
                    }
                    return;
                }

                applyAction(action, worldState);
                
                if (action.type === 'PLACE_MACHINE' || action.type === 'REMOVE_MACHINE' || action.type === 'COLLECT_RESOURCE') {
                    saveWorld();
                }
                
                if (action.type === 'COLLECT_RESOURCE') {
                    const removePayload = JSON.stringify({ type: 'RESOURCE_REMOVED', resourceId: action.resourceId });
                    wss.clients.forEach(client => {
                        const cData = clients.get(client);
                        if (cData && cData.joined && client.readyState === WebSocket.OPEN) {
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
        clients.delete(ws);
        
        setTimeout(() => {
            let stillConnected = false;
            clients.forEach(c => { if (c.playerId === currentId) stillConnected = true; });
            
            if (!stillConnected) {
                if (worldState.players[currentId]) {
                    delete worldState.players[currentId];
                }
            }
        }, 5000); 
    });
});

const TICK_RATE = 10; 
setInterval(() => {
    const lightGameState = { ...worldState };
    delete lightGameState.resources; 
    
    const payload = JSON.stringify({ type: 'STATE_UPDATE', state: lightGameState });

    wss.clients.forEach((client) => {
        const cData = clients.get(client);
        if (cData && cData.joined && client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 ARES SINGLE WORLD SERVER ON PORT ${PORT}`);
    console.log(`===============================================`);
});
