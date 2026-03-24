import * as THREE from 'three';

export class Player {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.camera = game.camera;

        this.position = new THREE.Vector3(0, 10, 0);
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.stats = {
            health: 100,
            oxygen: 100,
            energy: 100
        };

        // Ensure starting position is a bit above ground
        this.position.set(0, 15, 5);
        this.mouseState.pitch = -0.5; // Look down a bit

        this.inventory = {};

        this.controls = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        this.mouseState = {
            pitch: 0,
            yaw: 0
        };

        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));

        document.addEventListener('click', () => {
            document.body.requestPointerLock();
        });
    }

    onKeyDown(e) {
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW': this.controls.forward = true; break;
            case 'ArrowDown':
            case 'KeyS': this.controls.backward = true; break;
            case 'ArrowLeft':
            case 'KeyA': this.controls.left = true; break;
            case 'ArrowRight':
            case 'KeyD': this.controls.right = true; break;
            case 'KeyE': this.interact(); break;
            case 'KeyB': this.game.ui.toggleBuildMenu(); break;
            case 'Tab':
                e.preventDefault();
                this.game.ui.toggleInventory();
                break;
        }
    }

    onKeyUp(e) {
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW': this.controls.forward = false; break;
            case 'ArrowDown':
            case 'KeyS': this.controls.backward = false; break;
            case 'ArrowLeft':
            case 'KeyA': this.controls.left = false; break;
            case 'ArrowRight':
            case 'KeyD': this.controls.right = false; break;
        }
    }

    onMouseMove(e) {
        if (document.pointerLockElement === document.body) {
            this.mouseState.yaw -= e.movementX * 0.002;
            this.mouseState.pitch -= e.movementY * 0.002;
            this.mouseState.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.mouseState.pitch));
        }
    }

    interact() {
        // Raycast to find rocks or buildings
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            if (hit.distance < 5) {
                if (hit.object.userData.type === 'resource') {
                    this.collect(hit.object);
                }
            }
        }
    }

    collect(object) {
        const type = object.userData.resourceType;
        this.inventory[type] = (this.inventory[type] || 0) + 1;
        this.game.ui.showMessage(`Récolté : ${type}`);
        this.scene.remove(object);
        // Remove from resource manager's trackers if necessary
    }

    update(delta) {
        // Rotation
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.mouseState.yaw;
        this.camera.rotation.x = this.mouseState.pitch;

        // Movement
        this.direction.z = Number(this.controls.forward) - Number(this.controls.backward);
        this.direction.x = Number(this.controls.left) - Number(this.controls.right);
        this.direction.normalize();

        const speed = 10;
        if (this.controls.forward || this.controls.backward) this.velocity.z -= this.direction.z * speed * delta;
        if (this.controls.left || this.controls.right) this.velocity.x -= this.direction.x * speed * delta;

        const moveX = -this.velocity.x * Math.cos(this.mouseState.yaw) + this.velocity.z * Math.sin(this.mouseState.yaw);
        const moveZ = this.velocity.x * Math.sin(this.mouseState.yaw) + this.velocity.z * Math.cos(this.mouseState.yaw);

        this.position.x += moveX;
        this.position.z += moveZ;

        // Dynamic Height (Terrain follow)
        const groundHeight = this.game.terrain.getHeightAt(this.position.x, this.position.z);
        this.position.y = groundHeight + 1.8; // Camera height

        this.camera.position.copy(this.position);

        // Friction
        this.velocity.multiplyScalar(0.9);

        // Stats drain
        // Drain slower: 0.1% per second
        this.stats.oxygen -= delta * 0.1;
        if (this.stats.oxygen <= 0) this.stats.health -= delta * 2;
        this.stats.oxygen = Math.max(0, this.stats.oxygen);

        if (this.isInsideCapsule()) {
            this.stats.oxygen = Math.min(100, this.stats.oxygen + delta * 20); // Faster recharge in capsule
            this.game.ui.showMessage("Récupération d'oxygène...");
        }
    }

    isInsideCapsule() {
        // Simple radius check around spawn
        return this.position.distanceTo(new THREE.Vector3(0, this.position.y, 0)) < 5;
    }
}
