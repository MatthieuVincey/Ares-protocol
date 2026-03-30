/**
 * botSystem.js
 * Simulates multiple players (AI) for local multiplayer testing.
 */

class BotSystem {
    constructor(scene) {
        this.scene = scene;
        this.bots = []; // List of bot local states { id, targetPos, timer, nextActionDelay }
        this.visuals = {}; // { id: THREE.Group } - Debug visuals for remote players
    }

    spawnBot() {
        // Generate a random ID for the simulated remote player
        const botId = "bot_" + Math.random().toString(36).substr(2, 6);
        
        // Spawn near 0,0
        const spawnX = (Math.random() - 0.5) * 40;
        const spawnZ = (Math.random() - 0.5) * 40;
        
        // Ensure GameState has this player (this usually happens via network, we simulate it here)
        // For testing, we just spawn a PlayerData directly into GameState, or better, send a SPAWN action?
        // Since players just "exist", we can insert it.
        if (!window.PlayerData) {
            console.error("BotSystem: PlayerData class not found globally.");
            return;
        }

        window.GameState.players[botId] = new window.PlayerData(botId);
        const player = window.GameState.players[botId];
        player.pos.set(spawnX, 20, spawnZ); // High up so it falls and clamps to ground later if needed (handled by their own move logic or physics)
        
        // Internal AI state
        this.bots.push({
            id: botId,
            targetPos: new THREE.Vector3(spawnX, 0, spawnZ),
            timer: 0,
            nextActionDelay: Math.random() * 2 + 1,
            speed: 4 + Math.random() * 4, // Random base speed
            moveTimer: 0
        });

        console.log(`[BotSystem] Spawned bot: ${botId}`);
    }

    tick(dt, state) {
        // Run AI logic for all bots
        const activeBots = [];

        for (const bot of this.bots) {
            const playerData = state.players[bot.id];
            if (!playerData) continue; // Player removed?
            
            activeBots.push(bot);
            bot.timer += dt;
            bot.moveTimer += dt;

            // 1. Determine new objective / random action
            if (bot.timer > bot.nextActionDelay) {
                bot.timer = 0;
                bot.nextActionDelay = 2 + Math.random() * 4;
                
                // Pick a random direction to move to
                const angle = Math.random() * Math.PI * 2;
                const dist = 10 + Math.random() * 30;
                bot.targetPos.set(
                    playerData.pos.x + Math.cos(angle) * dist,
                    playerData.pos.y,
                    playerData.pos.z + Math.sin(angle) * dist
                );

                // Randomly perform an action (simulate interaction)
                const randAction = Math.random();
                if (randAction < 0.1) {
                    // Simulate jumping
                    window.sendAction({
                        type: 'PLAYER_MOVE',
                        playerId: bot.id,
                        position: { x: playerData.pos.x, y: playerData.pos.y + 5, z: playerData.pos.z }, // Hacky jump
                        rotation: { y: playerData.rotation.y },
                        velocity: { x: playerData.velocity.x, y: 15, z: playerData.velocity.z },
                        state: 'jetpack',
                        jetpackFuel: playerData.jetpack.fuel
                    });
                } else if (randAction < 0.15) {
                    // Simulate placing a machine
                    window.sendAction({
                        type: 'PLACE_MACHINE',
                        playerId: bot.id,
                        machineId: 'sim_solar_' + Math.random().toString(36).substr(2, 6),
                        machineType: 'solar',
                        position: { x: playerData.pos.x + 2, y: playerData.pos.y, z: playerData.pos.z },
                        rotationY: 0
                    });
                } else if (randAction < 0.25) {
                    // Simulate resource conflict (all bots try to collect the exact same ID)
                    window.sendAction({
                        type: 'COLLECT_RESOURCE',
                        playerId: bot.id,
                        resourceId: 'test_conflict_res_1', // Intentional conflict
                        amount: 1
                    });
                }
            }

            // 2. Move towards target
            const dx = bot.targetPos.x - playerData.pos.x;
            const dz = bot.targetPos.z - playerData.pos.z;
            const distToTarget = Math.sqrt(dx*dx + dz*dz);

            let velX = 0;
            let velZ = 0;
            let playerState = 'idle';
            let yaw = playerData.rotation.y;

            if (distToTarget > 1.0) {
                const dirX = dx / distToTarget;
                const dirZ = dz / distToTarget;
                velX = dirX * bot.speed;
                velZ = dirZ * bot.speed;
                playerState = bot.speed > 5 ? 'running' : 'walking';
                yaw = Math.atan2(dirX, dirZ); // Face movement direction
            }

            // Simple physics: snap to ground (we reuse index.html's getTerrainY indirectly if possible, but here we just approximate for AI or let them walk flat)
            // Ideally, we'd use a server-side equivalent, but since this is local simulation we can just call getTerrainY if it's available.
            let groundY = 0;
            if (typeof getTerrainY === 'function') groundY = getTerrainY(playerData.pos.x, playerData.pos.z);
            let nextY = Math.max(groundY + 2, playerData.pos.y - 9.8 * dt); // Simple gravity + clamp

            if (bot.moveTimer > 0.1) {
                bot.moveTimer = 0;
                // Dispatch movement action via sendAction to stress the action system
                window.sendAction({
                    type: 'PLAYER_MOVE',
                    playerId: bot.id,
                    position: { 
                        x: playerData.pos.x + velX * 0.1, 
                        y: nextY, 
                        z: playerData.pos.z + velZ * 0.1 
                    },
                    rotation: { y: yaw },
                    velocity: { x: velX, y: 0, z: velZ },
                    state: playerState,
                    jetpackFuel: 100
                });
            }
        }
        
        this.bots = activeBots;
    }

    renderVisuals(state) {
        // Update or create debug meshes for all remote players based strictly on GameState
        for (const playerId in state.players) {
            // Don't render ourselves (the local player) since we use the main camera/setup
            if (playerId === window.localPlayerId) continue;

            const pData = state.players[playerId];
            let v = this.visuals[playerId];

            if (!v) {
                console.log(`[BotSystem] Creating visual for remote player: ${playerId}`);
                // Create debug visual
                v = new THREE.Group();
                
                // Hitbox cylinder
                const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.5 });
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 8), mat);
                body.position.y = 1; // Center of cylinder is at y=1 if height is 2
                v.add(body);

                // Direction arrow
                const dirMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
                const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1), dirMat);
                arrow.position.set(0, 1.5, 0.5); // Pointing forward (Z axis in ThreeJS local space)
                v.add(arrow);

                // Add to scene
                this.scene.add(v);
                this.visuals[playerId] = v;

                // Create HTML label for ID and State
                const labelDiv = document.createElement('div');
                labelDiv.className = 'player-debug-label';
                labelDiv.style.position = 'absolute';
                labelDiv.style.left = '0px';
                labelDiv.style.top = '0px';
                labelDiv.style.color = 'white';
                labelDiv.style.backgroundColor = 'rgba(0,0,0,0.6)';
                labelDiv.style.padding = '2px 5px';
                labelDiv.style.borderRadius = '3px';
                labelDiv.style.fontFamily = 'monospace';
                labelDiv.style.fontSize = '12px';
                labelDiv.style.pointerEvents = 'none';
                labelDiv.style.transform = 'translate(-50%, -100%)';
                labelDiv.style.willChange = 'transform';
                document.body.appendChild(labelDiv);
                v.userData.label = labelDiv;
                v.userData.lastText = '';
            }

            // Update transform
            v.position.copy(pData.pos);
            v.rotation.y = pData.rotation.y;

            // Update HTML label
            if (v.userData.label) {
                // Throttle textContent updates
                const newText = `[${playerId}]\nState: ${pData.state}\nPos: ${pData.pos.x.toFixed(1)}, ${pData.pos.y.toFixed(1)}, ${pData.pos.z.toFixed(1)}`;
                if (v.userData.lastText !== newText) {
                    v.userData.label.textContent = newText;
                    v.userData.lastText = newText;
                }
                
                // Project 3D pos to 2D screen
                const camera = window.state.camera || (window.gameContext && window.gameContext.camera);
                if (camera) {
                    const vector = new THREE.Vector3(pData.pos.x, pData.pos.y + 2.5, pData.pos.z);
                    vector.project(camera);
                    
                    if (vector.z < 1) { // Only show if in front of camera
                        const x = (vector.x * .5 + .5) * window.innerWidth;
                        const y = (vector.y * -.5 + .5) * window.innerHeight;
                        // Use hardware accelerated transform
                        v.userData.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
                        if (v.userData.label.style.display !== 'block') v.userData.label.style.display = 'block';
                    } else {
                        if (v.userData.label.style.display !== 'none') v.userData.label.style.display = 'none';
                    }
                }
            }
        }

        // Cleanup disconnected players visuals
        for (const vid in this.visuals) {
            if (!state.players[vid]) {
                const v = this.visuals[vid];
                if (v.userData.label) v.userData.label.remove();
                this.scene.remove(v);
                delete this.visuals[vid];
            }
        }
    }
}

// Export for non-module usage
window.BotSystem = BotSystem;
