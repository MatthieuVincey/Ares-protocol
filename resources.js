import * as THREE from 'three';

export class ResourceManager {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;

        this.types = {
            'Fer': { color: 0x555555, size: 0.4 },
            'Silicium': { color: 0x88ccff, size: 0.3 },
            'Titane': { color: 0xbbbbbb, size: 0.5 },
            'Glace': { color: 0xffffff, size: 0.4 },
            'Cobalt': { color: 0x0000ff, size: 0.3 }
        };
    }

    spawnInChunk(cx, cz) {
        const count = 3 + Math.floor(Math.random() * 5);
        const keys = Object.keys(this.types);

        for (let i = 0; i < count; i++) {
            const typeKey = keys[Math.floor(Math.random() * keys.length)];
            const type = this.types[typeKey];

            const rx = (cx + Math.random()) * 32 - 16;
            const rz = (cz + Math.random()) * 32 - 16;
            const ry = this.game.terrain.getHeightAt(rx, rz);

            const geometry = new THREE.IcosahedronGeometry(type.size, 0);
            const material = new THREE.MeshStandardMaterial({ color: type.color });
            const rock = new THREE.Mesh(geometry, material);

            rock.position.set(rx, ry + type.size / 2, rz);
            rock.userData = {
                type: 'resource',
                resourceType: typeKey
            };
            rock.castShadow = true;
            this.scene.add(rock);
        }
    }
}
