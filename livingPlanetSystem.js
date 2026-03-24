class LivingPlanetSystem {
    constructor(game) {
        this.game = game;

        // State variables
        this.consciousnessInfo = {
            level: 0,
            value: 0
        };

        this.hostility = 0;
        this.hostilityThreshold = 100;

        // Timers
        this.reactionTimer = 0;
        this.reactionInterval = 5; // seconds
        this.mysteryTimer = 0;
        this.mysteryInterval = 10; // seconds

        // References to active entities
        this.lifeEntities = [];
        this.stormActive = false;
        this.stormTimer = 0;
        this.originalFogColor = null;
        this.particleSystems = [];
        this.weatherTimer = 0;
        this.weatherType = null; // 'rain', 'snow', or null

        // Fauna System
        this.fauna = [];
        this.faunaTimer = 0;
    }

    update(dt) {
        this.updateConsciousness();

        // Timed updates
        this.reactionTimer += dt;
        if (this.reactionTimer >= this.reactionInterval) {
            this.reactionTimer = 0;
            this.triggerReactions();
        }

        this.mysteryTimer += dt;
        if (this.mysteryTimer >= this.mysteryInterval) {
            this.mysteryTimer = 0;
            this.triggerMysteryEvent();
        }

        // Update active entities (creatures/animations)
        this.updateLifeEntities(dt);
        this.updateStorm(dt);
        this.updateAtmosphere(dt);
        this.updateWeather(dt);
        this.updateFauna(dt);
    }

    updateConsciousness() {
        const t = this.game.state.terra;
        // Biomass approximated by flora count for now
        const biomass = t.flora ? t.flora.length : 0;

        // Calculate raw value
        // Oxygen (0-100) * 0.4 + Temp (-60 to +40, mapped 0-100) * 0.2 + Biomass * 0.4
        const normalizedTemp = Math.max(0, Math.min(100, t.temp + 60));
        this.consciousnessInfo.value = (t.oxygen * 0.4) + (normalizedTemp * 0.2) + (Math.min(100, biomass) * 0.4);

        // Determine Level
        let newLevel = 0;
        if (this.consciousnessInfo.value > 80) newLevel = 3;       // Hostile/Highly Active
        else if (this.consciousnessInfo.value > 40) newLevel = 2;  // Conscious
        else if (this.consciousnessInfo.value > 10) newLevel = 1;  // Waking up

        if (newLevel > this.consciousnessInfo.level) {
            this.consciousnessInfo.level = newLevel;
            this.game.showMsg(`🌍 La conscience de la planète a atteint le NIVEAU ${newLevel}`);

            // spawn life when reaching conscious level
            if (newLevel === 2) this.spawnBenignLife();
            // this.spawnHostileLife(); // [DISABLED] Temporairement désactivé
        }
    }

    triggerReactions() {
        const lvl = this.consciousnessInfo.level;
        if (lvl === 0) return;

        const r = Math.random();

        if (lvl >= 1) {
            if (r < 0.2) {
                // Minor tremor: shake camera slightly
                this.game.showMsg("La terre tremble légèrement sous vos pieds...");
                this.cameraShake(0.5);
            }
        }

        if (lvl >= 2) {
            if (r < 0.1) {
                // Terrain shift
                this.game.showMsg("Le terrain semble se reconfigurer...");
                this.shiftTerrain();
            } else if (r > 0.8 && r < 0.9) {
                // Spontaneous flora growth
                this.spawnFloraBurst();
            }
        }

        if (lvl >= 3) {
            if (r < 0.15 && !this.stormActive) {
                // Severe biological storm
                this.startStorm(15); // 15 seconds storm
            }
            // this.checkHostilityDefenses(); // [DISABLED] Temporairement désactivé
        }
    }

    startStorm(duration) {
        this.stormActive = true;
        this.stormTimer = duration;
        this.game.showMsg("⚠️ TEMPÊTE BIOLOGIQUE DÉTECTÉE ⚠️");
        this.cameraShake(2.0);

        if (this.game.scene.fog && !this.originalFogColor) {
            this.originalFogColor = this.game.scene.fog.color.clone();
            this.game.scene.fog.color.setHex(0x330044); // Toxic purple
            this.game.scene.background.setHex(0x330044);
        }

        // Spawn some storm particles
        this.createStormParticles();
    }

    updateStorm(dt) {
        if (!this.stormActive) return;

        this.stormTimer -= dt;

        // Damage player if outside
        if (this.game.state.player.hp > 10) {
            this.game.state.player.hp -= dt * 2;
        }

        if (this.stormTimer <= 0) {
            this.stopStorm();
        }

        // Move particles
        this.particleSystems.forEach(p => {
            p.position.y -= dt * 10;
            if (p.position.y < 0) p.position.y = 50;
        });
    }

    stopStorm() {
        this.stormActive = false;
        this.game.showMsg("La tempête se dissipe...");
        if (this.originalFogColor) {
            this.originalFogColor = null;
        }
        // Cleanup particles
        this.particleSystems.forEach(p => this.game.scene.remove(p));
        this.particleSystems = [];
    }

    updateAtmosphere(dt) {
        const t = this.game.state.terra;
        if (!this.game.scene.background || !this.game.scene.background.lerp) {
            this.game.scene.background = new THREE.Color(0x000000);
        }
        if (this.game.scene.fog && !this.game.scene.fog.color.lerp) {
            this.game.scene.fog.color = new THREE.Color(0x000000);
        }
        const progress = Math.min(1.0, (t.oxygen / 100) * 0.7 + (Math.max(0, t.temp + 60) / 100) * 0.3);

        // Force a deep space blue for both start and end, avoiding the ugly brown
        const redSky = { r: 0.8, g: 0.85, b: 0.88 }; // Neutral Airy Grey/Blue
        const blueSky = { r: 0.4, g: 0.67, b: 1.0 }; // Earth blue

        const r = redSky.r + (blueSky.r - redSky.r) * progress;
        const g = redSky.g + (blueSky.g - redSky.g) * progress;
        const b = redSky.b + (blueSky.b - redSky.b) * progress;

        const targetColor = new THREE.Color(r, g, b);
        this.game.scene.background.lerp(targetColor, dt * 0.1);
        if (this.game.scene.fog) {
            this.game.scene.fog.color.lerp(targetColor, dt * 0.1);
        }
    }

    updateWeather(dt) {
        if (!this.game.state.terra) return;
        const terra = this.game.state.terra;

        this.weatherTimer -= dt;
        if (this.weatherTimer <= 0) {
            this.weatherTimer = 30 + Math.random() * 60;
            // Determine weather based on terraforming
            if (terra.oxygen > 20 && Math.random() < 0.3) {
                this.weatherType = terra.temp > 0 ? 'rain' : 'snow';
                this.game.showMsg(this.weatherType === 'rain' ? "🌧️ Début d'une averse..." : "❄️ Quelques flocons commencent à tomber...");
            } else {
                this.weatherType = null;
            }
        }

        if (this.weatherType && !this.stormActive) {
            if (this.particleSystems.length < 1) {
                this.createWeatherParticles(this.weatherType);
            }
            this.particleSystems.forEach(p => {
                p.position.y -= dt * (this.weatherType === 'rain' ? 20 : 5);
                if (p.position.y < -10) {
                    p.position.y = 50;
                    p.position.x = this.game.state.player.pos.x + (Math.random()-0.5)*100;
                    p.position.z = this.game.state.player.pos.z + (Math.random()-0.5)*100;
                }
            });
        } else if (this.particleSystems.length > 0 && !this.stormActive) {
             // Cleanup if weather ended
             this.particleSystems.forEach(p => this.game.scene.remove(p));
             this.particleSystems = [];
        }
    }

    createWeatherParticles(type) {
        const count = 1000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for(let i=0; i<count; i++){
            pos[i*3] = (Math.random()-0.5)*100;
            pos[i*3+1] = Math.random()*50;
            pos[i*3+2] = (Math.random()-0.5)*100;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
        const mat = new THREE.PointsMaterial({
            color: type === 'rain' ? 0x88ccff : 0xffffff,
            size: type === 'rain' ? 0.05 : 0.15,
            transparent: true,
            opacity: 0.6
        });
        const points = new THREE.Points(geo, mat);
        this.game.scene.add(points);
        this.particleSystems.push(points);
    }

    createStormParticles() {
        const geo = new THREE.BufferGeometry();
        const count = 500;
        const pos = new Float32Array(count * 3);
        const ppos = this.game.state.player.pos;

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 100;
            pos[i * 3 + 1] = Math.random() * 50;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 100;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0xff00ff, size: 0.2 });
        const points = new THREE.Points(geo, mat);
        points.position.copy(ppos);
        this.game.scene.add(points);
        this.particleSystems.push(points);
    }

    // Called when player extracts resources
    addHostility(amount) {
        this.hostility += amount;
        if (this.hostility > this.hostilityThreshold) {
            this.game.showMsg("⚠️ LA PLANÈTE REJETTE VOS INSTALLATIONS ⚠️");
            // this.triggerAttack(); // [DISABLED] Temporairement désactivé
            this.hostility = 0; // Reset after attack
        }
    }

    checkHostilityDefenses() {
        // Disabled for now
        /*
        if (this.hostility > this.hostilityThreshold * 0.8 && Math.random() < 0.3) {
            this.triggerAttack();
        }
        */
    }

    triggerMysteryEvent() {
        // 1% chance per cycle
        if (Math.random() < 0.01) {
            const events = [
                "Une pulsation grouillante résonne dans le sol...",
                "Vous entendez un murmure alien dans votre casque...",
                "Une immense structure organique vient d'émerger au loin..."
            ];
            const evt = events[Math.floor(Math.random() * events.length)];
            this.game.showMsg(`❓ MYSTÈRE : ${evt}`);
        }
    }

    // --- Actions ---

    cameraShake(intensity) {
        // Simple shake implemented via passing a shake value to the main loop camera
        if (this.game.cameraShakeObj) {
            this.game.cameraShakeObj.intensity = intensity;
            this.game.cameraShakeObj.time = 0.5; // half a second
        }
    }

    shiftTerrain() {
        // Slightly modify heights of terrain chunks near player
        if (!this.game.chunks || !this.game.getTerrainY) return;

        const ppos = this.game.state.player.pos;
        this.game.chunks.forEach((chunk, key) => {
            const cx = parseInt(key.split(',')[0]);
            const cz = parseInt(key.split(',')[1]);
            const pos = chunk.geometry.attributes.position;
            let changed = false;
            for (let i = 0; i < pos.count; i++) {
                const wx = pos.getX(i) + cx * this.game.CHUNK;
                const wz = pos.getZ(i) + cz * this.game.CHUNK;
                // Only shift terrain not under buildings
                if (Math.abs(wx - ppos.x) < 50 && Math.abs(wz - ppos.z) < 50) {
                    const currentY = pos.getY(i);
                    // Add small random noise
                    pos.setY(i, currentY + (Math.random() - 0.5) * 0.5);
                    changed = true;
                }
            }
            if (changed) {
                chunk.geometry.computeVertexNormals();
                pos.needsUpdate = true;
            }
        });
    }

    spawnFloraBurst() {
        if (!this.game.spawnFlora) return;
        this.game.showMsg("🌱 Éruption de biomasse locale !");
        this.game.spawnFlora(10); // Spawn 10 plants immediately
    }

    spawnBenignLife() {
        // Simple ambient floating spores or sluggish creatures
        for (let i = 0; i < 3; i++) {
            this.createCreature(0x00ff88, 1.0, 'benign');
        }
    }

    spawnHostileLife() {
        // Aggressive geometric "immune system" entities
        for (let i = 0; i < 2; i++) {
            this.createCreature(0xff0044, 2.5, 'hostile');
        }
        // Spawn a GIANT GUARDIAN at Level 3
        if (this.consciousnessInfo.level >= 3 && Math.random() < 0.3) {
            this.game.showMsg("⚠️ SIGNATURE BIOMASSIVE DÉTECTÉE — UN GARDIEN S'ÉVEILLE");
            this.createCreature(0xff0000, 12, 'guardian');
        }
    }

    triggerAttack() {
        this.cameraShake(1.5);
        this.spawnHostileLife();
    }

    createCreature(colorHex, size, type) {
        if (!this.game.scene) return;

        const geo = type === 'hostile' ?
            new THREE.TetrahedronGeometry(size) :
            new THREE.SphereGeometry(size, 8, 8);

        const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.2,
            emissive: colorHex,
            emissiveIntensity: 0.2
        });

        const mesh = new THREE.Mesh(geo, mat);

        // Spawn around player
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 10;
        const ppos = this.game.state.player.pos;

        mesh.position.set(
            ppos.x + Math.cos(angle) * dist,
            this.game.getTerrainY ? this.game.getTerrainY(ppos.x, ppos.z) + size : ppos.y,
            ppos.z + Math.sin(angle) * dist
        );

        mesh.castShadow = true;
        this.game.scene.add(mesh);

        this.lifeEntities.push({
            mesh: mesh,
            type: type,
            speed: type === 'guardian' ? 2 : (type === 'hostile' ? 4 : 1),
            target: new THREE.Vector3()
        });
    }

    updateLifeEntities(dt) {
        if (!this.game.state || !this.game.state.player) return;
        const ppos = this.game.state.player.pos;

        this.lifeEntities.forEach(ent => {
            if (ent.type === 'benign') {
                // Wander slowly
                ent.mesh.position.y += Math.sin(Date.now() * 0.002) * 0.02;
                ent.mesh.rotation.y += dt * 0.5;
            } else if (ent.type === 'hostile' || ent.type === 'guardian') {
                // Move towards player
                const dir = new THREE.Vector3().subVectors(ppos, ent.mesh.position);
                dir.y = 0; // stay on ground plane
                const dist = dir.length();
                const stopDist = ent.type === 'guardian' ? 10 : 2;

                if (dist > stopDist) {
                    dir.normalize();
                    ent.mesh.position.addScaledVector(dir, ent.speed * dt);
                    // conform to terrain
                    if (this.game.getTerrainY) {
                        const h = ent.type === 'guardian' ? 6 : 1;
                        ent.mesh.position.y = this.game.getTerrainY(ent.mesh.position.x, ent.mesh.position.z) + h;
                    }
                } else {
                    // Attack radius
                    if (Math.random() < (ent.type === 'guardian' ? 0.2 : 0.05)) {
                        const dmg = ent.type === 'guardian' ? 10 : 2;
                        this.game.state.player.hp -= dmg;
                        const msg = ent.type === 'guardian' ? "💥 ÉCRASEMENT PAR LE GARDIEN !" : "💥 Attaque de la créature hostile !";
                        this.game.showMsg(msg);
                        if (ent.type === 'guardian') this.cameraShake(1.5);
                    }
                }

                ent.mesh.rotation.x += dt * 2;
                ent.mesh.rotation.z += dt * 1.5;
            }
        });
    }

    // --- FAUNA SYSTEM ---
    
    updateFauna(dt) {
        if (!this.game.state || !this.game.state.terra) return;
        const stage = this.game.state.terra.stage;
        
        // Only spawn fauna if stage 6+ (Faune Émergente)
        if (stage < 6) return;

        this.faunaTimer -= dt;
        if (this.faunaTimer <= 0) {
            this.faunaTimer = 10 + Math.random() * 20;
            if (this.fauna.length < 15) {
                const types = ['herbivore', 'mammal', 'bird'];
                this.spawnAnimal(types[Math.floor(Math.random() * types.length)]);
            }
        }

        const ppos = this.game.state.player.pos;

        this.fauna.forEach((an, idx) => {
            const distToPlayer = an.mesh.position.distanceTo(ppos);
            
            if (an.type === 'bird') {
                // Flying behavior
                an.angle += dt * an.speed * 0.5;
                const ox = Math.cos(an.angle) * an.radius;
                const oz = Math.sin(an.angle) * an.radius;
                an.mesh.position.set(an.center.x + ox, an.center.y + Math.sin(Date.now()*0.001)*2, an.center.z + oz);
                an.mesh.lookAt(an.center.x + Math.cos(an.angle + 0.1) * an.radius, an.mesh.position.y, an.center.z + Math.sin(an.angle + 0.1) * an.radius);
                // Wings flap
                an.wings.forEach(w => w.rotation.z = Math.sin(Date.now()*0.01) * 0.5);
            } else {
                // Ground behavior
                if (distToPlayer < 8) {
                    // Flee from player
                    const fleeDir = new THREE.Vector3().subVectors(an.mesh.position, ppos).normalize();
                    an.targetPos.addScaledVector(fleeDir, 10);
                    an.state = 'running';
                }

                const dir = new THREE.Vector3().subVectors(an.targetPos, an.mesh.position);
                dir.y = 0;
                const dist = dir.length();

                if (dist > 1) {
                    dir.normalize();
                    const moveSpeed = an.state === 'running' ? an.speed * 2.5 : an.speed;
                    an.mesh.position.addScaledVector(dir, moveSpeed * dt);
                    an.mesh.lookAt(an.targetPos.x, an.mesh.position.y, an.targetPos.z);
                    
                    // Simple leg animation (bobbing)
                    an.mesh.position.y = (this.game.getTerrainY ? this.game.getTerrainY(an.mesh.position.x, an.mesh.position.z) : 0) + Math.abs(Math.sin(Date.now() * 0.01)) * 0.2;
                } else {
                    // Idle / Pick new target
                    if (Math.random() < 0.01) {
                        an.targetPos.set(
                            an.mesh.position.x + (Math.random()-0.5)*40,
                            0,
                            an.mesh.position.z + (Math.random()-0.5)*40
                        );
                        an.state = 'walking';
                    }
                }
            }

            // Cleanup if too far
            if (distToPlayer > 200) {
                this.game.scene.remove(an.mesh);
                this.fauna.splice(idx, 1);
            }
        });
    }

    spawnAnimal(type) {
        const group = new THREE.Group();
        const ppos = this.game.state.player.pos;
        const spawnDist = 40 + Math.random() * 40;
        const ang = Math.random() * Math.PI * 2;
        const sx = ppos.x + Math.cos(ang) * spawnDist;
        const sz = ppos.z + Math.sin(ang) * spawnDist;
        const sy = this.game.getTerrainY ? this.game.getTerrainY(sx, sz) : 0;

        let animalData = { type: type, mesh: group, speed: 1, state: 'idle', targetPos: new THREE.Vector3(sx, 0, sz) };

        if (type === 'herbivore') {
            // Cervid-like: 1.5m long, 4 legs
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 1.5), new THREE.MeshStandardMaterial({color: 0x8d6e63}));
            body.position.y = 1.2; group.add(body);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.6), new THREE.MeshStandardMaterial({color: 0x8d6e63}));
            head.position.set(0, 1.8, 0.8); group.add(head);
            // Legs
            const legGeo = new THREE.BoxGeometry(0.15, 1.0, 0.15);
            const legMat = new THREE.MeshStandardMaterial({color: 0x5d4037});
            [[-0.2, 0.6], [0.2, 0.6], [-0.2, -0.6], [0.2, -0.6]].forEach(p => {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(p[0], 0.5, p[1]); group.add(leg);
            });
            animalData.speed = 3;
        } else if (type === 'mammal') {
            // Small and round: 40cm
            const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshStandardMaterial({color: 0x757575}));
            body.position.y = 0.3; group.add(body);
            const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3), new THREE.MeshStandardMaterial({color: 0x616161}));
            tail.position.set(0, 0.2, -0.3); tail.rotation.x = Math.PI/2; group.add(tail);
            animalData.speed = 5;
        } else if (type === 'bird') {
            // Bird: 60cm wingspan
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.4), new THREE.MeshStandardMaterial({color: 0xeeeeee}));
            group.add(body);
            const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({color: 0xcccccc, side: THREE.DoubleSide}));
            w1.position.x = 0.35; w1.rotation.y = Math.PI/2; group.add(w1);
            const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({color: 0xcccccc, side: THREE.DoubleSide}));
            w2.position.x = -0.35; w2.rotation.y = Math.PI/2; group.add(w2);
            animalData.wings = [w1, w2];
            animalData.center = new THREE.Vector3(sx, sy + 15 + Math.random()*10, sz);
            animalData.radius = 20 + Math.random()*30;
            animalData.angle = Math.random()*Math.PI*2;
            animalData.speed = 2 + Math.random()*2;
        }

        group.position.set(sx, sy, sz);
        this.game.scene.add(group);
        this.fauna.push(animalData);
    }
}
