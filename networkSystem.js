/**
 * networkSystem.js
 * Handles real-time WebSocket connection and Client-Side Prediction / Interpolation.
 */

// ==========================================
// 🌐 CONFIGURATION RÉSEAU (NGROK / LOCAL)
// ==========================================
// Pour jouer avec un ami :
// 1. Lancez ngrok : ngrok http 3000
// 2. Remplacez l'URL ci-dessous par celle fournie par ngrok (ex: "wss://1234abcd.ngrok-free.app")
// 3. Laissez vide ("") pour jouer seul en local (localhost)
const SERVER_URL = ""; 
// ==========================================

class NetworkSystem {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.connect();
    }

    connect() {
        let wsUrl;
        if (SERVER_URL && SERVER_URL !== "") {
            wsUrl = SERVER_URL;
        } else {
            // Auto-detect localhost if no custom URL provided
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${window.location.host}`;
        }
        
        console.log(`[NETWORK] Connecting to ${wsUrl}...`);
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log("[NETWORK] Connected to server successfully.");
            this.connected = true;
            this.overrideActionSystem();
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
        if (message.type === 'INIT') {
            console.log(`[NETWORK] INIT received. My Server ID is: ${message.playerId}`);
            const oldId = window.localPlayerId;
            
            // Assign true server ID first
            window.localPlayerId = message.playerId;
            
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
        else if (message.type === 'STATE_UPDATE') {
            this.syncFromServer(message.state);
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
                // Only sync server-authoritative logic like inventory.
                lp.inventory = sp.inventory || {};
            } else {
                // REMOTE PLAYER: Set up LERP target for smooth interpolation
                if (!lp.targetPos) lp.targetPos = new THREE.Vector3();
                lp.targetPos.copy(sp.pos);
                lp.rotation.y = sp.rotation.y;
                lp.velocity.copy(sp.velocity);
                
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

        // 4. Sync Resources
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

    tick(dt, state) {
        // Perform interpolation for remote players
        for (const id in state.players) {
            if (id === window.localPlayerId) continue;
            
            const p = state.players[id];
            if (p.targetPos) {
                // LERP towards target position for smooth motion (10.0 speed factor relative to dt)
                p.pos.lerp(p.targetPos, Math.min(1.0, 10.0 * dt));
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
