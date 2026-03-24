/**
 * ARES PROTOCOL — Rover Vehicle System v2 (Industrial Overhaul)
 * 4/6 Wheels, Specialized Models, Local Protocol Support
 */

class RoverSystem {
    constructor(game) {
        this.game       = game;
        this.rovers     = [];
        this.activeRover = null;
        this._camOffset  = new THREE.Vector3(0, 7, 15);
    }

    /* =========================================================
        PUBLIC API  
    ========================================================= */

    getGhostMesh(type) {
        const specs = this._getSpecs(type);
        if (!specs) return new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 }));
        const group = new THREE.Group();
        this._buildRoverMesh(group, specs, type);
        group.traverse(node => {
            if (node.isMesh) {
                node.material = node.material.clone();
                node.material.transparent = true;
                node.material.opacity = 0.5;
            }
        });
        return group;
    }

    spawnRover(type, position, rotationY = 0) {
        const specs = this._getSpecs(type);
        if (!specs) return null;

        const vehicle = new THREE.Group();
        vehicle.position.copy(position);
        vehicle.position.y += specs.suspensionLength + specs.wheelRadius + 0.5;
        vehicle.rotation.y = rotationY;

        vehicle.userData = {
            isVehicle: true,
            type,
            specs,
            velocity:        new THREE.Vector3(),
            angularVelocity: 0,
            energy:          specs.maxEnergy,
            inventory:       [],
            onGround:        false,
            steerAngle:      0,
            wheels:          this._createWheelStates(specs, type),
            _suspArms:       [],
            _visualWheels:   []
        };

        this._buildRoverMesh(vehicle, specs, type);

        vehicle.name = `rover_${type}_${Date.now()}`;
        this.game.scene.add(vehicle);
        this.rovers.push(vehicle);
        return vehicle;
    }

    tryEnterRover(playerPos, lookDir) {
        if (this.activeRover) return false;
        let best = null, bestDist = 8;
        for (const r of this.rovers) {
            const d = playerPos.distanceTo(r.position);
            if (d < bestDist) { bestDist = d; best = r; }
        }
        if (best) { this.activeRover = best; return true; }
        return false;
    }

    exitRover(playerPos) {
        if (!this.activeRover) return null;
        const off = new THREE.Vector3(-3, 0.5, 0).applyAxisAngle(new THREE.Vector3(0,1,0), this.activeRover.rotation.y);
        const pos = this.activeRover.position.clone().add(off);
        this.activeRover = null;
        return pos;
    }

    tick(dt, state) {
        if (!dt || dt > 0.15) dt = 0.15;
        const T = window.THREE;
        if (!T) return;

        for (const r of this.rovers) {
            if (r.userData?._drillMesh) {
                const spd = 10 * (Math.sqrt(r.userData.velocity.x**2 + r.userData.velocity.z**2) + 0.5);
                r.userData._drillMesh.rotation.y += dt * spd;
            }
            try { this._physics(r, dt, state); } catch(e) { console.warn("Rover physics error", e); }
        }

        if (this.activeRover && state.camera) {
            const r = this.activeRover;
            const worldOff = this._camOffset.clone().applyEuler(new T.Euler(0, r.rotation.y || 0, 0));
            const target = r.position.clone().add(worldOff);
            if (!isNaN(target.x)) {
                state.camera.position.lerp(target, Math.min(1.0, 10 * dt));
                state.camera.lookAt(r.position.x, r.position.y + 1.5, r.position.z);
            }
        }
    }

    /* =========================================================
        3D MODEL BUILDER (Industrial Style)
    ========================================================= */

    _buildRoverMesh(vehicle, specs, type) {
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.3 });
        const panelMat = new THREE.MeshStandardMaterial({ color: specs.color, metalness: 0.6, roughness: 0.4 });
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
        const detailMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.5 });
        const emitMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
        
        // Main Chassis (Industrial Multi-layer)
        const frame = new THREE.Mesh(new THREE.BoxGeometry(specs.w, 0.4, specs.l), frameMat);
        frame.position.y = specs.wheelRadius + specs.suspensionLength * 0.4;
        vehicle.add(frame);

        // Side skirts / Armor plates
        const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, specs.l * 0.8), panelMat);
        skirtL.position.set(-specs.w * 0.5 - 0.05, frame.position.y, 0);
        vehicle.add(skirtL);
        const skirtR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, specs.l * 0.8), panelMat);
        skirtR.position.set(specs.w * 0.5 + 0.05, frame.position.y, 0);
        vehicle.add(skirtR);

        // Industrial GREEBLES (cables/pipes simulation)
        for(let i=0; i<4; i++) {
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, specs.l * 0.6), detailMat);
            pipe.rotation.x = Math.PI/2;
            pipe.position.set((i-1.5)*0.3, frame.position.y - 0.1, 0);
            vehicle.add(pipe);
        }

        const rType = type.toLowerCase();
        if (rType.includes('expl')) this._buildScoutVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat);
        else if (rType.includes('mine')) this._buildMinerVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat);
        else if (rType.includes('cargo')) this._buildCargoVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat);
        else if (rType.includes('adv')) this._buildAdvancedVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat);
        else if (rType.includes('sci')) this._buildScienceVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat);
        else if (rType.includes('fast')) this._buildFastVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat);
        else if (rType.includes('heavy')) this._buildHeavyVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat);
        else if (rType.includes('arms')) this._buildArmsVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat);
        else if (rType.includes('volic')) this._buildVolicVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat);
        else if (rType.includes('planet')) this._buildPlanetVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat);
        else {
            const pod = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.4, 1.2, specs.l*0.6), panelMat);
            pod.position.y = frame.position.y + 0.8;
            vehicle.add(pod);
        }

        this._buildWheels(vehicle, specs, type, frameMat, wheelMat);
    }

    _buildScoutVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat) {
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.4, 1.0, specs.l*0.6), panelMat);
        cabin.position.y = specs.wheelRadius + specs.suspensionLength + 0.5;
        vehicle.add(cabin);

        // Windows
        const win = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.5, 0.4, 0.1), new THREE.MeshStandardMaterial({color: 0x88ccff, metalness: 1, roughness: 0.1, transparent: true, opacity: 0.7}));
        win.position.set(0, 0.2, specs.l*0.3);
        cabin.add(win);

        // Equipment Rack
        const rack = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.3, 0.2, specs.l*0.3), detailMat);
        rack.position.set(0, 0.5, -specs.l*0.1);
        cabin.add(rack);

        // Antennas
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2), detailMat);
        ant.position.set(specs.w*0.3, 0.6, -specs.l*0.2);
        cabin.add(ant);
        const dish = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12, 0, Math.PI*2, 0, Math.PI/2), detailMat);
        dish.position.copy(ant.position).y += 0.6; dish.rotation.x = -Math.PI * 0.7; cabin.add(dish);

        // Headlights
        [ -1, 1 ].forEach(side => {
            const light = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1), frameMat);
            light.rotation.x = Math.PI/2;
            light.position.set(side * specs.w * 0.3, -0.3, specs.l*0.3);
            cabin.add(light);
            const lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), new THREE.MeshBasicMaterial({color: 0xffffff}));
            lens.position.z = 0.06; light.add(lens);
        });
    }

    _buildMinerVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat) {
        const hull = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.2, 1.2, specs.l*0.7), panelMat);
        hull.position.y = specs.wheelRadius + specs.suspensionLength + 0.6;
        vehicle.add(hull);

        // Reinforced Front Guard
        const guard = new THREE.Mesh(new THREE.BoxGeometry(specs.w, 0.6, 0.4), frameMat);
        guard.position.set(0, -0.3, specs.l*0.35 + 0.2);
        hull.add(guard);

        // Drill Arm (Hydraulic)
        const armBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.6), frameMat);
        armBase.position.set(0, 0, specs.l*0.35 + 0.3);
        hull.add(armBase);

        const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0), detailMat);
        piston.rotation.x = Math.PI/2; piston.position.z = 0.5;
        armBase.add(piston);

        const drillHead = new THREE.Group();
        drillHead.position.z = 1.0;
        armBase.add(drillHead);

        const drill = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.5, 1.5, 8), new THREE.MeshStandardMaterial({color:0x777777, metalness:0.9, roughness: 0.2}));
        drill.rotation.x = Math.PI/2;
        drillHead.add(drill);
        vehicle.userData._drillMesh = drillHead;

        // Side Toolboxes
        [ -1, 1 ].forEach(side => {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, specs.l*0.4), detailMat);
            box.position.set(side * (specs.w*0.4), 0, 0);
            hull.add(box);
        });
    }

    _buildCargoVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat) {
        // Forward Cab
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.4, 1.5, 1.6), panelMat);
        cabin.position.set(0, specs.wheelRadius + specs.suspensionLength + 0.75, specs.l*0.5 - 0.8);
        vehicle.add(cabin);

        // Windows (Wrap-around)
        const win = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.3, 0.5, 0.1), new THREE.MeshStandardMaterial({color: 0x88ccff, metalness: 1, roughness: 0.1, transparent: true, opacity: 0.7}));
        win.position.set(0, 0.3, 0.81);
        cabin.add(win);

        // Cargo Bed (Reinforced Industrial)
        const bedBase = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.2, 0.4, specs.l-2.0), frameMat);
        bedBase.position.set(0, specs.wheelRadius + specs.suspensionLength + 0.2, -0.6);
        vehicle.add(bedBase);

        // Handrails
        [ -1, 1 ].forEach(side => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, specs.l-2.0), detailMat);
            rail.position.set(side * (specs.w * 0.45), 0.5, 0);
            bedBase.add(rail);
        });

        // Hydraulic Cylinders (Greebles)
        for(let i=0; i<3; i++) {
            const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, specs.w-0.6), detailMat);
            cyl.rotation.z = Math.PI/2;
            cyl.position.set(0, 0.1, -0.5 + i*0.8);
            bedBase.add(cyl);
        }
    }

    _buildAdvancedVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat) {
        const hull = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.2, 1.2, specs.l), panelMat);
        hull.position.y = specs.wheelRadius + specs.suspensionLength + 0.6;
        vehicle.add(hull);

        // Stealth Slopes
        const slopeF = new THREE.Mesh(new THREE.BoxGeometry(specs.w, 0.8, 1.0), panelMat);
        slopeF.rotation.x = -Math.PI/4;
        slopeF.position.set(0, 0.2, specs.l*0.4);
        hull.add(slopeF);

        // Thermal Shielding Layers
        const plates = new THREE.Mesh(new THREE.BoxGeometry(specs.w+0.2, 0.1, specs.l*0.8), new THREE.MeshStandardMaterial({color:0x333333, metalness:1, roughness:0.2}));
        plates.position.y = 0.65;
        hull.add(plates);

        // Glow strips
        [ -1, 1 ].forEach(side => {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, specs.l*0.6), emitMat);
            strip.position.set(side * (specs.w*0.45), 0.3, 0);
            hull.add(strip);
        });
    }

    _buildScienceVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat) {
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.4, 0.8, specs.l*0.6), panelMat);
        bridge.position.y = specs.wheelRadius + specs.suspensionLength + 0.4;
        vehicle.add(bridge);

        // Lab Module (Raised)
        const lab = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.6, 1.0, specs.l*0.5), new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.2, roughness: 0.1}));
        lab.position.set(0, 0.6, -specs.l*0.1);
        bridge.add(lab);

        // Rotating Scanner Array
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8), detailMat);
        mast.position.set(0, 1.0, 0);
        lab.add(mast);
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.3), frameMat);
        head.position.y = 0.4;
        mast.add(head);

        // Optic Lenses
        [ -1, 1 ].forEach(side => {
            const lens = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), emitMat);
            lens.position.set(side * 0.4, 0, 0.15);
            head.add(lens);
        });
    }

    _buildFastVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat) {
        const hull = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.6, 0.6, specs.l), panelMat);
        hull.position.y = specs.wheelRadius + specs.suspensionLength + 0.3;
        vehicle.add(hull);

        // Aerodynamic Cockpit
        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), new THREE.MeshStandardMaterial({color: 0x222222, metalness: 1, roughness: 0.1}));
        cockpit.scale.set(1.2, 0.8, 2.0);
        cockpit.position.set(0, 0.3, 0.2);
        hull.add(cockpit);

        // Rear Spoiler (Double Deck)
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.2), detailMat);
        strut.position.set(0, 0.3, -specs.l*0.4);
        hull.add(strut);
        
        [ 0.3, 0.5 ].forEach(height => {
            const wing = new THREE.Mesh(new THREE.BoxGeometry(specs.w+0.2, 0.05, 0.6), frameMat);
            wing.position.set(0, height, -specs.l*0.4);
            hull.add(wing);
        });

        // Side Intakes
        [ -1, 1 ].forEach(side => {
            const intake = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.8), detailMat);
            intake.position.set(side * (specs.w*0.4), 0, 0);
            hull.add(intake);
        });
    }

    _buildHeavyVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat) {
        const hull = new THREE.Mesh(new THREE.BoxGeometry(specs.w, 1.8, specs.l), panelMat);
        hull.position.y = specs.wheelRadius + specs.suspensionLength + 0.9;
        vehicle.add(hull);

        // Massive Cab (Elevated)
        const cab = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.8, 1.4, 2.0), frameMat);
        cab.position.set(0, 1.6, specs.l*0.3);
        hull.add(cab);

        // Panoramic Windows
        const win = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.9, 0.6, 0.1), new THREE.MeshStandardMaterial({color: 0x88ccff, metalness: 1, roughness: 0.1, transparent: true, opacity: 0.8}));
        win.position.set(0, 0.2, 1.01);
        cab.add(win);

        // Engine Blocks (Rear)
        const engine = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.4, 1.2, 3.0), detailMat);
        engine.position.set(0, 0, -specs.l*0.2);
        hull.add(engine);

        // Cooling Vents
        for(let i=0; i<6; i++) {
            const vent = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.2, 0.1, 0.2), new THREE.MeshStandardMaterial({color: 0x111111}));
            vent.position.set(0, 0.6, -2.5 + i*0.8);
            hull.add(vent);
        }
    }

    _buildArmsVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat) {
        const hull = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.2, 1.0, specs.l*0.6), panelMat);
        hull.position.y = specs.wheelRadius + specs.suspensionLength + 0.5;
        vehicle.add(hull);

        // Multi-Arm Rig
        const rig = new THREE.Mesh(new THREE.BoxGeometry(specs.w, 0.4, 1.0), frameMat);
        rig.position.set(0, 0.6, 0);
        hull.add(rig);

        [ -1, 1 ].forEach(side => {
            const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), frameMat);
            shoulder.position.set(side * (specs.w*0.4), 0.2, 0);
            rig.add(shoulder);

            const arm = new THREE.Group();
            arm.rotation.z = side * 0.5;
            shoulder.add(arm);

            const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), detailMat);
            s1.position.y = 0.4; arm.add(s1);
            
            const joint = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), detailMat);
            joint.position.y = 0.8; arm.add(joint);

            const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), detailMat);
            s2.position.set(0, 0.3, 0.2);
            s2.rotation.x = 0.5;
            joint.add(s2);

            const claw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.3), frameMat);
            claw.position.y = 0.3; s2.add(claw);
        });
    }

    _buildVolicVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat) {
        const hull = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 16), panelMat);
        hull.scale.set(specs.w/2, 0.5, specs.l/2);
        hull.position.y = specs.wheelRadius + specs.suspensionLength + 0.8;
        vehicle.add(hull);

        // Core Pulse Ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 32), emitMat);
        ring.rotation.x = Math.PI/2;
        ring.scale.set(specs.w/2, specs.l/2, 1);
        ring.position.y = hull.position.y;
        vehicle.add(ring);

        // Hover Thrusters
        for(let x of [-1, 1]) for(let z of [-1, 1]) {
            const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.5, 12), frameMat);
            nacelle.position.set(x * specs.w * 0.4, specs.wheelRadius + specs.suspensionLength + 0.2, z * specs.l * 0.4);
            vehicle.add(nacelle);
            const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.2), detailMat);
            nozzle.position.y = -0.3; nacelle.add(nozzle);
            const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({color: 0x00ffff, transparent: true, opacity: 0.6}));
            bloom.position.y = -0.2; nozzle.add(bloom);
        }
    }

    _buildPlanetVisuals(vehicle, specs, panelMat, frameMat, detailMat, emitMat) {
        const hull = new THREE.Mesh(new THREE.BoxGeometry(specs.w-0.2, 1.8, specs.l*0.8), panelMat);
        hull.position.y = specs.wheelRadius + specs.suspensionLength + 0.9;
        vehicle.add(hull);

        // Observation Bubble
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({color: 0x88ccff, metalness: 1, roughness: 0.1, transparent: true, opacity: 0.6}));
        bubble.position.set(0, 1.8*0.5, specs.l*0.25);
        hull.add(bubble);

        // Satellite Dish (Large Articulated)
        const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6), detailMat);
        mount.position.set(0, 0.9, -specs.l*0.1);
        hull.add(mount);

        const dish = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 12, 0, Math.PI*2, 0, Math.PI/3), frameMat);
        dish.position.y = 0.5;
        dish.rotation.x = -Math.PI * 0.8;
        mount.add(dish);

        // Solar Wings
        [ -1, 1 ].forEach(side => {
            const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, specs.l*0.4), new THREE.MeshStandardMaterial({color: 0x111133, metalness: 0.8, roughness: 0.2}));
            wing.position.set(side * (specs.w*0.5 + 0.8), 0.2, -specs.l*0.1);
            hull.add(wing);
        });
    }

    _buildWheels(vehicle, specs, type, frameMat, wheelMat) {
        const positions = this._wheelLayout(specs, type);
        const suspArms = [];
        const visualWheels = [];

        positions.forEach((wp, i) => {
            const side = wp.x > 0 ? 1 : -1;
            const arm = new THREE.Group();
            arm.position.set(wp.x - side*0.4, specs.wheelRadius + specs.suspensionLength*0.4, wp.z);
            vehicle.add(arm);
            suspArms.push(arm);

            const bone = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), frameMat);
            bone.position.x = side * 0.25; arm.add(bone);

            const wheely = new THREE.Group();
            wheely.position.set(side * 0.5, -specs.suspensionLength*0.4, 0);
            arm.add(wheely);
            visualWheels.push(wheely);

            const tire = new THREE.Mesh(new THREE.CylinderGeometry(specs.wheelRadius, specs.wheelRadius, 0.5, 12), wheelMat);
            tire.rotation.z = Math.PI/2; wheely.add(tire);
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(specs.wheelRadius*0.4, specs.wheelRadius*0.4, 0.52, 6), frameMat);
            hub.rotation.z = Math.PI/2; wheely.add(hub);
        });

        vehicle.userData._suspArms = suspArms;
        vehicle.userData._visualWheels = visualWheels;
    }

    _wheelLayout(specs, type) {
        const hw = specs.w / 2 + 0.4;
        const lowType = type.toLowerCase();
        if (lowType.includes('expl') || lowType.includes('fast') || lowType.includes('sci') || lowType.includes('volic')) {
            return [{x:-hw, z:specs.l*0.35}, {x:hw, z:specs.l*0.35}, {x:-hw, z:-specs.l*0.35}, {x:hw, z:-specs.l*0.35}];
        } else if (lowType.includes('heavy')) {
            return [
                {x:-hw, z:specs.l*0.4},  {x:hw, z:specs.l*0.4},
                {x:-hw, z:specs.l*0.15}, {x:hw, z:specs.l*0.15},
                {x:-hw, z:-specs.l*0.15}, {x:hw, z:-specs.l*0.15},
                {x:-hw, z:-specs.l*0.4}, {x:hw, z:-specs.l*0.4}
            ];
        } else {
            return [{x:-hw, z:specs.l*0.4}, {x:hw, z:specs.l*0.4}, {x:-hw, z:0}, {x:hw, z:0}, {x:-hw, z:-specs.l*0.4}, {x:hw, z:-specs.l*0.4}];
        }
    }

    _createWheelStates(specs, type) {
        return this._wheelLayout(specs, type).map(p => ({
            localPos: p,
            compression: 0,
            touching: false,
            lastY: 0
        }));
    }

    _physics(rover, dt, state) {
        const u = rover.userData, s = u.specs, type = u.type || 'standard';
        u.velocity.y -= s.gravity * dt;

        let grounded = 0;
        u.wheels.forEach((w, i) => {
            const worldPos = new THREE.Vector3(w.localPos.x, 0, w.localPos.z).applyEuler(new THREE.Euler(0, rover.rotation.y, 0)).add(rover.position);
            const groundY = this.game.getTerrainY(worldPos.x, worldPos.z);
            const dist = worldPos.y - groundY;
            const rest = s.suspensionLength;

            if (dist < rest) {
                grounded++;
                w.touching = true;
                w.compression = 1.0 - (dist / rest);
                const springF = (w.compression * s.springStrength) - (u.velocity.y * s.damping);
                u.velocity.y += (springF * dt * 2.0) / u.wheels.length;

                if (u._visualWheels[i]) {
                    const targetLocalY = groundY - rover.position.y + s.wheelRadius;
                    u._visualWheels[i].position.y += (targetLocalY - (u._visualWheels[i].position.y + u._suspArms[i].position.y)) * 10 * dt;
                }
            } else {
                w.touching = false;
                w.compression = 0;
                if (u._visualWheels[i]) {
                    const restY = -s.suspensionLength*0.4;
                    u._visualWheels[i].position.y += (restY - u._visualWheels[i].position.y) * 5 * dt;
                }
            }
        });

        u.onGround = grounded > 0;
        if (u.onGround) {
            u.velocity.x *= (1 - s.friction * dt);
            u.velocity.z *= (1 - s.friction * dt);
        }

        let fwd = 0, steer = 0;
        if (this.activeRover === rover && state.keys && !state.paused) {
            if (state.keys['KeyW'] || state.keys['KeyZ'] || state.keys['ArrowUp']) fwd = 1;
            if (state.keys['KeyS'] || state.keys['ArrowDown']) fwd = -1;
            if (state.keys['KeyA'] || state.keys['KeyQ'] || state.keys['ArrowLeft']) steer = 1;
            if (state.keys['KeyD'] || state.keys['ArrowRight']) steer = -1;
        }

        if (u.onGround && u.energy > 0) {
            if (fwd !== 0) {
                const dir = new THREE.Vector3(-Math.sin(rover.rotation.y), 0, -Math.cos(rover.rotation.y));
                u.velocity.addScaledVector(dir, fwd * s.accel * dt);
                u.energy -= s.energyDrain * dt;
            }
            const hspd = Math.sqrt(u.velocity.x**2 + u.velocity.z**2);
            if (steer !== 0 && hspd > 0.5) {
                rover.rotation.y += steer * s.turnSpeed * dt * Math.min(1.0, hspd / 5.0);
            }
            if (hspd > s.maxSpeed) {
                u.velocity.x *= (s.maxSpeed / hspd);
                u.velocity.z *= (s.maxSpeed / hspd);
            }
        }

        rover.position.addScaledVector(u.velocity, dt);
        
        // Volic hover effect
        if (type.toLowerCase().includes('volic')) {
            const hoverH = 1.5 + Math.sin(Date.now()*0.003)*0.2;
            const targetY = this.game.getTerrainY(rover.position.x, rover.position.z) + hoverH;
            rover.position.y += (targetY - rover.position.y) * dt * 2;
        }

        if (u.onGround) {
             rover.rotation.x *= 0.9; rover.rotation.z *= 0.9;
        }
        if (rover.position.y < -50) rover.position.y = 100;
    }

    _getSpecs(type) {
        const base = {
            suspensionLength: 0.9, springStrength: 22.0, damping: 3.5, wheelRadius: 0.52,
            gravity: 20.0, friction: 1.2, turnSpeed: 1.8, accel: 18.0, energyDrain: 3.0, podH: 1.3
        };
        const t = type.toLowerCase();
        if (t.includes('expl'))   return { ...base, label:'Explorateur', color:0xdddddd, maxSpeed:19.5, accel:26.0, w:2.0, l:3.8, maxEnergy:1000 };
        if (t.includes('mine'))   return { ...base, label:'Mineur Industriel', color:0x665544, maxSpeed:16.7, accel:21.0, w:2.4, l:4.4, maxEnergy:1500, energyDrain:5.0 };
        if (t.includes('cargo'))  return { ...base, label:'Transporteur de Fret', color:0x887755, maxSpeed:13.9, accel:18.0, w:2.8, l:5.2, maxEnergy:2500, energyDrain:6.0 };
        if (t.includes('adv'))    return { ...base, label:'Intercepteur Avancé', color:0x444444, maxSpeed:18.0, accel:22.0, w:2.4, l:4.5, maxEnergy:2000, energyDrain:4.0 };
        if (t.includes('sci'))    return { ...base, label:'Unité Scientifique', color:0x00d4ff, maxSpeed:15.0, accel:18.0, w:2.2, l:4.0, maxEnergy:1200, energyDrain:3.5 };
        if (t.includes('fast'))   return { ...base, label:'Vitesse Fulgurante', color:0xffcc00, maxSpeed:25.0, accel:35.0, w:2.1, l:4.2, maxEnergy:800,  energyDrain:5.0 };
        if (t.includes('heavy'))  return { ...base, label:'Béhémoth Industriel', color:0x333333, maxSpeed:11.1, accel:15.0, w:4.0, l:8.0, maxEnergy:5000, energyDrain:10.0, wheelRadius:0.8, suspensionLength:1.2 };
        if (t.includes('arms'))   return { ...base, label:'Unité de Maintenance', color:0x888888, maxSpeed:13.0, accel:16.0, w:2.6, l:5.0, maxEnergy:1800, energyDrain:4.5 };
        if (t.includes('volic'))  return { ...base, label:'Hovercraft Volique', color:0x55aaff, maxSpeed:22.0, accel:28.0, w:2.5, l:4.5, maxEnergy:1500, energyDrain:7.0, gravity:10.0 };
        if (t.includes('planet')) return { ...base, label:'Explorateur Planétaire', color:0xffffff, maxSpeed:14.0, accel:15.0, w:3.0, l:6.5, maxEnergy:3000, energyDrain:5.0 };
        
        return { ...base, label:'Rover Standard', color:0xaaaaaa, maxSpeed:15, accel:18, w:2.2, l:4.0, maxEnergy:1000 };
    }
}
