/**
 * remotePlayerRenderer.js
 * Handles the visual rendering of other human players in the multiplayer session.
 */

class RemotePlayerRenderer {
    constructor(scene) {
        this.scene = scene;
        this.visuals = {}; // { id: THREE.Group } - Visuals for remote players
    }

    renderVisuals(state) {
        // Update or create meshes for all remote players based strictly on GameState
        for (const playerId in state.players) {
            // Don't render ourselves
            if (playerId === window.localPlayerId) continue;

            const pData = state.players[playerId];
            let v = this.visuals[playerId];

            if (!v) {
                console.log(`[RemotePlayer] Creating visual for remote player: ${playerId}`);
                v = new THREE.Group();
                
                // --- Astronaut Model ---
                // Body (Capsule approximation using a cylinder with rounded ends)
                const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.4, 16);
                const suitMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.8, metalness: 0.1 });
                const body = new THREE.Mesh(bodyGeo, suitMat);
                body.position.y = 0.9; 
                body.castShadow = true;
                v.add(body);

                // Head
                const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
                const head = new THREE.Mesh(headGeo, suitMat);
                head.position.y = 1.75;
                v.add(head);

                // Visor
                const visorGeo = new THREE.BoxGeometry(0.5, 0.25, 0.3);
                const visorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 });
                const visor = new THREE.Mesh(visorGeo, visorMat);
                visor.position.set(0, 1.8, 0.25);
                v.add(visor);

                // Backpack
                const packGeo = new THREE.BoxGeometry(0.5, 0.8, 0.3);
                const packMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
                const backpack = new THREE.Mesh(packGeo, packMat);
                backpack.position.set(0, 1.1, -0.3);
                v.add(backpack);

                // Add to scene
                this.scene.add(v);
                this.visuals[playerId] = v;

                // Create HTML label for Name
                const labelDiv = document.createElement('div');
                labelDiv.className = 'player-name-label';
                labelDiv.style.position = 'absolute';
                labelDiv.style.left = '0px';
                labelDiv.style.top = '0px';
                labelDiv.style.color = 'white';
                labelDiv.style.textShadow = '1px 1px 2px black';
                labelDiv.style.fontWeight = 'bold';
                labelDiv.style.pointerEvents = 'none';
                labelDiv.style.transform = 'translate(-50%, -100%)';
                labelDiv.style.willChange = 'transform';
                document.body.appendChild(labelDiv);
                
                v.userData.label = labelDiv;
                
                // Format the ID for display
                const shortId = playerId.replace('player_', 'ARES-');
                labelDiv.innerText = shortId;
            }

            // Smooth Interpolation could go here, for now we snap
            v.position.copy(pData.pos);
            v.rotation.y = pData.rotation.y;

            // Optional: Tilt slightly during movement
            if (pData.state === 'running' || pData.state === 'walking') {
                v.rotation.x = 0.1; // Lean forward
            } else {
                v.rotation.x = 0;
            }

            // Update HTML label position
            if (v.userData.label) {
                // Project 3D pos to 2D screen
                const camera = window.state.camera || (window.gameContext && window.gameContext.camera);
                if (camera) {
                    const vector = new THREE.Vector3(pData.pos.x, pData.pos.y + 2.2, pData.pos.z);
                    vector.project(camera);
                    
                    if (vector.z < 1) { // Only show if in front of camera
                        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                        const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
                        v.userData.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
                        
                        if (v.userData.label.style.display !== 'block') {
                            v.userData.label.style.display = 'block';
                        }
                    } else {
                        if (v.userData.label.style.display !== 'none') {
                            v.userData.label.style.display = 'none';
                        }
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
window.RemotePlayerRenderer = RemotePlayerRenderer;
