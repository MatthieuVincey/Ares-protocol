/**
 * networkSystem.js
 * Handles real-time WebSocket connection and Client-Side Prediction / Interpolation.
 */

// ==========================================
// 🌐 CONFIGURATION RÉSEAU (CLOUD / LOCAL)
// ==========================================
// Calcul automatique de l'URL du serveur pour qu'il fonctionne :
// 1. En local (http://localhost:3000 -> ws://localhost:3000)
// 2. En ligne (https://votre-jeu.onrender.com -> wss://votre-jeu.onrender.com)
const SERVER_URL = window.location.origin.replace("http", "ws");
// ==========================================

class NetworkSystem {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.connect();
    }

    connect() {
        const wsUrl = SERVER_URL;
        
        console.log(`[NETWORK] Connecting to ${wsUrl}...`);
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log("[NETWORK] Connected to server successfully.");
            this.connected = true;
            this.overrideActionSystem();

            // We no longer automatically reclaim session on global connect, 
            // since players now need to intentionally join a room.
            // If they are in-game and disconnect, we COULD auto-rejoin the room if we stored it:
            const storedId = localStorage.getItem('ares_player_id');
            const storedRoom = localStorage.getItem('ares_room_id');
            if (storedId && storedRoom && window.state && window.state.started) {
                console.log(`[NETWORK] Attempting to reconnect to room: ${storedRoom}`);
                this.socket.send(JSON.stringify({ 
                    type: 'JOIN_ROOM', 
                    roomId: storedRoom,
                    pseudo: window.localPlayerPseudo 
                }));
            }
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (err) {
                console.error("[NETWORK] Failed to parse message:", err);
            }
        };

        this.socket.onclose = () => {
            console.warn("[NETWORK] Connection lost. Reconnecting in 3s...");
            this.connected = false;
            // Fallback to local
            setTimeout(() => this.connect(), 3000);
        };
        
        this.socket.onerror = (err) => {
            console.error("[NETWORK] WebSocket Error:", err);
        };
    }

    createRoom() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'CREATE_ROOM',
                pseudo: window.localPlayerPseudo
            }));
        }
    }

    joinRoom(roomId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'JOIN_ROOM',
                roomId: roomId,
                pseudo: window.localPlayerPseudo
            }));
        }
    }

    sendChat(text) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'CHAT',
                message: text
            }));
        }
    }

    overrideActionSystem() {
        // Override the local simulated sendAction from multiplayerSystem.js
        window.sendAction = (action) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'ACTION', action }));
                
                // Client-Side Prediction: apply immediately locally for zero-latency feedback
                // Server will independently validate and echo state later
                window.applyAction(action); 
            } else {
                // Fallback if offline
                window.applyAction(action);
            }
        };
        console.log("[NETWORK] Action System hooked into WebSockets.");
    }

    handleMessage(message) {
        if (message.type === 'ROOM_JOINED') {
            window.currentRoomId = message.roomId;
            localStorage.setItem('ares_room_id', message.roomId);
            console.log(`[NETWORK] Joined room successfully: ${message.roomId}`);
            
            // Trigger UI update (hooked into index.html)
            if (typeof window.onRoomJoined === 'function') {
                window.onRoomJoined(message.roomId);
            }
        }

        if (message.type === 'JOIN_ERROR') {
            console.error(`[NETWORK] Failed to join room: ${message.message}`);
            if (typeof window.onJoinError === 'function') {
                window.onJoinError(message.message);
            }
        }

        if (message.type === 'INIT') {
            console.log(`[NETWORK] INIT received. My Server ID is: ${message.playerId}`);
            const oldId = window.localPlayerId;
            
            // Assign true server ID first
            window.localPlayerId = message.playerId;
            localStorage.setItem('ares_player_id', message.playerId);

            // Immediately send the requested pseudonym to the server if one was provided in the UI
            if (window.localPlayerPseudo) {
                window.sendAction({
                    type: 'UPDATE_PSEUDO',
                    playerId: window.localPlayerId,
                    pseudo: window.localPlayerPseudo
                });
            }
            
            // Perform a full hard sync of the initial state (now includes the new playerId)
            this.hardSyncState(message.state);

            // Force cleanup of the old local shadow player if it exists
            if (oldId !== message.playerId && window.GameState.players[oldId]) {
                delete window.GameState.players[oldId];
            }
            
            // CRITICAL RELINK: Ensure the main game state points to the NEW authoritative object
            if (window.state) {
                window.state.player = window.GameState.players[window.localPlayerId];
                
                // Force immediate camera and world update
                if (window.state.player && window.state.player.pos) {
                    console.log("[NETWORK] Snapping camera to spawn:", window.state.player.pos);
                    if (window.state.camera) window.state.camera.position.copy(window.state.player.pos);
                    if (typeof window.updateChunks === 'function') {
                        window.updateChunks(window.state.player.pos.x, window.state.player.pos.z);
                    }
                }
            }
        }
        else if (message.type === 'PLAYER_MOVED') {
            const action = message.action;
            const lp = window.GameState.players[action.playerId];
            if (lp) {
                if (!lp.targetPos) lp.targetPos = new THREE.Vector3();
                lp.targetPos.copy(action.position);
                if (action.rotation !== undefined) lp.rotation.y = action.rotation.y;
                if (action.velocity !== undefined) lp.velocity.copy(action.velocity);
                if (action.state !== undefined) lp.state = action.state;
                if (lp.jetpack && action.jetpackFuel !== undefined) lp.jetpack.fuel = action.jetpackFuel;
                
                // Track timestamp to prevent older STATE_UPDATE packets from causing rollback
                lp.lastMoveTimestamp = action.timestamp || Date.now();

                // Étape 8 - DEBUG LATENCE (Console)
                if (action.timestamp) {
                    if (!lp.debugMoveCount) lp.debugMoveCount = 0;
                    lp.debugMoveCount++;
                    if (lp.debugMoveCount % 40 === 0) { // Log 1 fois toutes les 2 secondes environ
                        const latence = Date.now() - action.timestamp;
                        console.log(`[DEBUG LATENCE] Mouvement reçu de ${action.playerId} - Temps écoulé: ${latence}ms`);
                    }
                }

                // Étape 5 - BUFFER DE POSITIONS
                if (!lp.positionsBuffer) lp.positionsBuffer = [];
                lp.positionsBuffer.push({
                    position: new THREE.Vector3().copy(action.position),
                    timestamp: lp.lastMoveTimestamp
                });
                if (lp.positionsBuffer.length > 5) lp.positionsBuffer.shift();

                // If the remote player teleported or just spawned far away, snap them
                if (lp.pos.distanceTo(lp.targetPos) > 50) {
                    lp.pos.copy(lp.targetPos);
                }
            }
        }
        else if (message.type === 'STATE_UPDATE') {
            this.syncFromServer(message.state);
        }
        else if (message.type === 'RESOURCE_REMOVED') {
            const id = message.resourceId;
            if (window.GameState.resources[id]) {
                delete window.GameState.resources[id];
            }
        }
        else if (message.type === 'CHAT') {
            if (typeof window.appendChatMessage === 'function') {
                window.appendChatMessage(message);
            }
        }
        else if (message.type === 'CHAT_HISTORY') {
            if (typeof window.loadChatHistory === 'function') {
                window.loadChatHistory(message.chat);
            }
        }
    }

    hardSyncState(serverState) {
        // Complete overwrite for initialization
        window.GameState.world = Object.assign({}, serverState.world);
        window.GameState.energy = Object.assign({}, serverState.energy);
        
        window.GameState.machines = {};
        for (const id in serverState.machines) {
            const sm = serverState.machines[id];
            window.GameState.machines[id] = new window.MachineData(id, sm.type, sm.pos.x, sm.pos.y, sm.pos.z, sm.rotationY, sm.ownerId);
            window.GameState.machines[id].state = sm.state;
        }

        window.GameState.resources = {};
        for (const id in serverState.resources) {
            const sr = serverState.resources[id];
            window.GameState.resources[id] = new window.ResourceData(id, sr.type, sr.pos.x, sr.pos.y, sr.pos.z, sr.quantity);
        }

        window.GameState.players = {};
        for (const id in serverState.players) {
            const sp = serverState.players[id];
            const p = new window.PlayerData(id);
            p.pos.copy(sp.pos);
            p.rotation.copy(sp.rotation);
            p.velocity.copy(sp.velocity);
            p.hp = sp.hp; p.o2 = sp.o2; p.energy = sp.energy;
            p.state = sp.state;
            p.inventory = sp.inventory || {};
            if (sp.jetpack) p.jetpack = sp.jetpack;
            window.GameState.players[id] = p;
        }
    }

    syncFromServer(serverState) {
        const localState = window.GameState;
        
        // 1. Sync World Data (fast values)
        Object.assign(localState.world, serverState.world);
        Object.assign(localState.energy, serverState.energy);

        // 2. Sync Players
        for (const id in serverState.players) {
            const sp = serverState.players[id];
            let lp = localState.players[id];
            
            if (!lp) {
                // New player connected
                lp = new window.PlayerData(id);
                lp.pos.copy(sp.pos); // hard snap on spawn
                localState.players[id] = lp;
            }
            
            // Update stats
            lp.hp = sp.hp;
            lp.o2 = sp.o2;
            lp.energy = sp.energy;
            lp.state = sp.state;
            if (sp.jetpack) lp.jetpack.fuel = sp.jetpack.fuel;
            
            if (id === window.localPlayerId) {
                // LOCAL PLAYER: Trust client-side predicted position/rotation. 
                // Only sync server-authoritative logic like inventory IF it was sent.
                // We also check if it's not empty, to avoid accidental overwrites during light sync.
                if (sp.inventory && Object.keys(sp.inventory).length > 0) {
                    lp.inventory = sp.inventory;
                }
            } else {
                // REMOTE PLAYER: Set up LERP target for smooth interpolation
                // Only use STATE_UPDATE position if we haven't received a more recent direct PLAYER_MOVED event
                const updateIsStale = lp.lastMoveTimestamp && (Date.now() - lp.lastMoveTimestamp < 200);
                
                if (!updateIsStale) {
                    if (!lp.targetPos) lp.targetPos = new THREE.Vector3();
                    lp.targetPos.copy(sp.pos);
                    lp.rotation.y = sp.rotation.y;
                    lp.velocity.copy(sp.velocity);
                }
                
                // If the remote player teleported or just spawned far away, snap them
                if (lp.pos.distanceTo(lp.targetPos) > 50) {
                    lp.pos.copy(lp.targetPos);
                }
            }
        }
        
        // Remove disconnected players
        for (const id in localState.players) {
            if (!serverState.players[id]) {
                delete localState.players[id];
            }
        }

        // 3. Sync Machines
        // For simplicity, we hard sync machines. In a production app, we would only sync diffs or check for deep equality
        for (const id in serverState.machines) {
            if (!localState.machines[id]) {
                const sm = serverState.machines[id];
                localState.machines[id] = new window.MachineData(id, sm.type, sm.pos.x, sm.pos.y, sm.pos.z, sm.rotationY, sm.ownerId);
            }
            localState.machines[id].state = serverState.machines[id].state;
        }
        for (const id in localState.machines) {
            if (!serverState.machines[id]) delete localState.machines[id];
        }

        // 4. Sync Resources (ONLY if present in message - Memory Optimization)
        if (serverState.resources) {
            for (const id in serverState.resources) {
                if (!localState.resources[id]) {
                    const sr = serverState.resources[id];
                    localState.resources[id] = new window.ResourceData(id, sr.type, sr.pos.x, sr.pos.y, sr.pos.z, sr.quantity);
                } else {
                    localState.resources[id].quantity = serverState.resources[id].quantity;
                }
            }
            for (const id in localState.resources) {
                if (!serverState.resources[id]) delete localState.resources[id];
            }
        }

        for (const id in localState.resources) {
            if (!serverState.resources[id]) delete localState.resources[id];
        }
    }

    tick(dt, state) {
        // Perform interpolation for remote players
        for (const id in state.players) {
            if (id === window.localPlayerId) continue;
            
            const p = state.players[id];
            
            // Étape 6 - PRÉDICTION LÉGÈRE
            if (p.velocity && p.targetPos && p.lastMoveTimestamp) {
                const timeSinceLastUpdate = Date.now() - p.lastMoveTimestamp;
                // Si aucune donnée reçue depuis plus longtemps que notre tickrate (ex: 100ms), on prédit
                if (timeSinceLastUpdate > 60) {
                    // Continuer dans la dernière direction (velocity estimée)
                    p.targetPos.addScaledVector(p.velocity, dt);
                }
            }

            if (p.targetPos) {
                // Étape 4 - LERP: mouvement fluide
                p.pos.lerp(p.targetPos, 0.15);
            }
        }
        
        // Update UI Diagnostics with Connection Status
        const diagStatus = document.getElementById('diag-status');
        if (diagStatus) {
            const statusStr = this.connected ? 'CONNECTED' : 'OFFLINE';
            const statusColor = this.connected ? '#00ffff' : 'red';
            if (!diagStatus.innerText.includes(statusStr)) {
                // Keep the existing OK/ERROR validation from index.html but prefix with Network state
                diagStatus.innerHTML = `WS: <span style="color:${statusColor}">${statusStr}</span> | Engine: OK`;
            }
        }
    }
}

window.NetworkSystem = NetworkSystem;
