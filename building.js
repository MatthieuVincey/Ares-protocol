import * as THREE from 'three';

export class BuildSystem {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.buildings = [];
        this.ghost = null;
        this.activeBuildType = null;

        this.buildingData = {
            shelter: { name: 'Abri', color: 0xcccccc, size: [4, 3, 4], cost: { Fer: 10 } },
            solar: { name: 'Panneau Solaire', color: 0x2244ff, size: [2, 0.2, 2], cost: { Silicium: 5 } },
            o2gen: { name: 'Générateur O2', color: 0x00d4ff, size: [1, 2, 1], cost: { Glace: 5, Fer: 2 } }
        };
    }

    startPlacement(type) {
        if (this.ghost) this.scene.remove(this.ghost);
        this.activeBuildType = type;
        const data = this.buildingData[type];

        const geometry = new THREE.BoxGeometry(...data.size);
        const material = new THREE.MeshStandardMaterial({
            color: data.color,
            transparent: true,
            opacity: 0.5
        });
        this.ghost = new THREE.Mesh(geometry, material);
        this.scene.add(this.ghost);

        this.game.ui.showMessage(`Placement de : ${data.name} (Clic pour confirmer)`);
    }

    update() {
        if (this.ghost) {
            // Raycast current placement
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);
            const intersects = raycaster.intersectObjects(this.scene.children, true);

            const terrainHits = intersects.filter(h => h.object.type === 'Mesh' && !h.object.userData.type);

            if (terrainHits.length > 0) {
                const hit = terrainHits[0];
                this.ghost.position.copy(hit.point);
                this.ghost.position.y += this.buildingData[this.activeBuildType].size[1] / 2;
            }
        }
    }

    confirmPlacement() {
        if (!this.ghost) return;

        const type = this.activeBuildType;
        const data = this.buildingData[type];

        // Check cost
        for (const [res, amount] of Object.entries(data.cost)) {
            if ((this.game.player.inventory[res] || 0) < amount) {
                this.game.ui.showMessage(`Pas assez de ${res} !`);
                return;
            }
        }

        // Deduct resources
        for (const [res, amount] of Object.entries(data.cost)) {
            this.game.player.inventory[res] -= amount;
        }

        const mesh = this.ghost.clone();
        mesh.material = new THREE.MeshStandardMaterial({ color: data.color });
        mesh.userData = { type: 'building', buildingType: type };
        this.scene.add(mesh);
        this.buildings.push(mesh);

        this.scene.remove(this.ghost);
        this.ghost = null;
        this.activeBuildType = null;

        this.game.ui.showMessage(`${data.name} construit !`);
        this.game.ui.updateInventory();
    }
}
