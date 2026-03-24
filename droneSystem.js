class DroneSystem {
    constructor(scene) {
        this.scene = scene;
        this.drones = [];
        this.droneGeometry = new THREE.BoxGeometry(0.8, 0.4, 0.8);
        this.droneMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, emissive: 0x55aa55, emissiveIntensity: 0.5 });

        // Settings
        this.speed = 15; // units per second
        this.carryCapacity = 10;
        this.hoverHeight = 8;
        this.bobSpeed = 2; // how fast they bob up and down
        this.bobHeight = 0.5;
    }

    createDrone(station) {
        const mesh = new THREE.Mesh(this.droneGeometry, this.droneMaterial);

        // Start drone at station
        mesh.position.copy(station.position);
        mesh.position.y += this.hoverHeight;

        this.scene.add(mesh);

        const drone = {
            mesh: mesh,
            station: station, // the hub it belongs to
            state: 'IDLE', // IDLE, FLYING_OUT, LOADING, FLYING_IN, UNLOADING
            target: null, // target building (extractor)
            inventory: { res: null, amt: 0 },
            timer: 0,
            bobPhase: Math.random() * Math.PI * 2
        };

        this.drones.push(drone);
        return drone;
    }

    tick(dt, stateObj) {
        // Enforce drone limits: 2 drones per station built
        const stations = stateObj.buildings.filter(b => b.userData && BUILD_DATA[b.userData.btype] && BUILD_DATA[b.userData.btype].isStorageHub);
        const targetDroneCount = stations.length * 2;

        if (this.drones.length < targetDroneCount && stations.length > 0) {
            // Assign new drone to a random station
            const st = stations[Math.floor(Math.random() * stations.length)];
            this.createDrone(st);
        }

        // Process each drone
        for (let i = 0; i < this.drones.length; i++) {
            const d = this.drones[i];

            // Visual bobbing
            d.bobPhase += dt * this.bobSpeed;

            switch (d.state) {
                case 'IDLE':
                    this.handleIdle(d, stateObj);
                    break;
                case 'FLYING_OUT':
                    this.flyToTarget(d, d.target, dt, 'LOADING');
                    break;
                case 'LOADING':
                    this.handleLoading(d, dt);
                    break;
                case 'FLYING_IN':
                    this.flyToTarget(d, d.station, dt, 'UNLOADING');
                    break;
                case 'UNLOADING':
                    this.handleUnloading(d, dt, stateObj);
                    break;
            }
        }
    }

    handleIdle(d, stateObj) {
        // Look for an extractor with resources > 0
        let bestTarget = null;
        let maxRes = 0;

        for (const b of stateObj.buildings) {
            if (!b.userData || !b.userData.localInventory) continue;

            const bd = BUILD_DATA[b.userData.btype];
            if (!bd || !bd.produces) continue;

            if (b.userData.localInventory > maxRes) {
                // Check if another drone is already targeting this extractor (to prevent clumping)
                const alreadyTargeted = this.drones.some(other => other.target === b && other !== d);
                if (!alreadyTargeted) {
                    maxRes = b.userData.localInventory;
                    bestTarget = b;
                }
            }
        }

        if (bestTarget) {
            d.target = bestTarget;
            d.state = 'FLYING_OUT';
            d.mesh.material.emissive.setHex(0xaaaa11); // Yellow = outgoing
        } else {
            // Wait at station
            this.hoverAt(d, d.station);
            d.mesh.material.emissive.setHex(0x55aa55); // Green = idle
        }
    }

    flyToTarget(d, destinationBlock, dt, nextState) {
        if (!destinationBlock) {
            d.state = 'FLYING_IN'; // Fallback
            return;
        }

        const targetPos = new THREE.Vector3(
            destinationBlock.position.x,
            destinationBlock.position.y + this.hoverHeight,
            destinationBlock.position.z
        );

        const dist = d.mesh.position.distanceTo(targetPos);

        if (dist < 1.0) {
            // Reached target
            d.state = nextState;
            d.timer = 0;
            return;
        }

        // Move towards target
        const dir = new THREE.Vector3().subVectors(targetPos, d.mesh.position).normalize();

        // Add Bobbing
        const newY = d.mesh.position.y + Math.sin(d.bobPhase) * this.bobHeight * dt;

        d.mesh.position.addScaledVector(dir, this.speed * dt);
        d.mesh.position.y = newY; // Override y so bobbing works without accumulating into space

        // Rotate facing direction smoothly
        const targetRotationY = Math.atan2(dir.x, dir.z);

        // Simple smoothing for rotation
        let angleDiff = targetRotationY - d.mesh.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        d.mesh.rotation.y += angleDiff * Math.min(1, dt * 5);
    }

    hoverAt(d, block) {
        if (!block) return;
        d.mesh.position.x = block.position.x + Math.cos(d.bobPhase) * 2;
        d.mesh.position.z = block.position.z + Math.sin(d.bobPhase) * 2;
        d.mesh.position.y = block.position.y + this.hoverHeight + Math.sin(d.bobPhase * 2) * this.bobHeight;
    }

    handleLoading(d, dt) {
        // Wait 2 seconds to load
        d.timer += dt;
        this.hoverAt(d, d.target);

        if (d.timer > 2) {
            if (d.target && d.target.userData && d.target.userData.localInventory > 0) {
                const bd = BUILD_DATA[d.target.userData.btype];

                // Take up to carryCapacity, or what's available
                const amountToTake = Math.min(d.carryCapacity, d.target.userData.localInventory);

                d.target.userData.localInventory -= amountToTake;
                d.inventory.res = bd.produces;
                d.inventory.amt = amountToTake;

                d.mesh.material.emissive.setHex(0x5555ff); // Blue = returning with cargo
            }
            d.state = 'FLYING_IN';
        }
    }

    handleUnloading(d, dt, stateObj) {
        // Wait 2 seconds to unload
        d.timer += dt;
        this.hoverAt(d, d.station);

        if (d.timer > 2) {
            if (d.inventory.amt > 0 && d.inventory.res) {
                // Deposit to main inventory
                stateObj.player.inventory[d.inventory.res] = (stateObj.player.inventory[d.inventory.res] || 0) + d.inventory.amt;
                d.inventory.amt = 0;
                d.inventory.res = null;

                // Update UI visually if possible
                if (typeof updateInvUI === 'function') updateInvUI();
                if (typeof showMsg === 'function') showMsg(`+ Ressources déposées au Hub`);
            }
            d.state = 'IDLE';
            d.target = null;
        }
    }
}
