import * as THREE from 'three';

export class Terrain {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.chunks = new Map();
        this.chunkSize = 32;
        this.resolution = 32;
        this.renderDistance = 4;

        this.material = new THREE.MeshBasicMaterial({
            color: 0xff4400, // Bright orange
            wireframe: true // Use wireframe to be absolutely sure we see edges
        });

        this.init();
    }

    init() {
        // Initial chunks around 0,0
        this.update(new THREE.Vector3(0, 0, 0));
    }

    update(playerPosition) {
        const currentChunkX = Math.floor(playerPosition.x / this.chunkSize);
        const currentChunkZ = Math.floor(playerPosition.z / this.chunkSize);

        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const cx = currentChunkX + x;
                const cz = currentChunkZ + z;
                const key = `${cx},${cz}`;

                if (!this.chunks.has(key)) {
                    this.createChunk(cx, cz);
                }
            }
        }

        // Cleanup old chunks (optional for prototype)
    }

    createChunk(cx, cz) {
        const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, this.resolution, this.resolution);
        geometry.rotateX(-Math.PI / 2);

        const posAttr = geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i) + cx * this.chunkSize;
            const z = posAttr.getZ(i) + cz * this.chunkSize;
            const y = this.calculateHeight(x, z);
            posAttr.setY(i, y);
        }

        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, this.material);
        mesh.position.set(cx * this.chunkSize, 0, cz * this.chunkSize);
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const key = `${cx},${cz}`;
        console.log(`Terrain: Chunk ${key} created at`, mesh.position);
        this.chunks.set(key, mesh);

        // Spawn resources in new chunk
        if (Math.random() > 0.5) {
            this.game.resources.spawnInChunk(cx, cz);
        }
    }

    calculateHeight(x, z) {
        // Very simple Perlin-ish noise using sine waves for the prototype
        // In a real app we'd use a Noise library
        const scale1 = 0.05;
        const scale2 = 0.1;
        const h1 = Math.sin(x * scale1) * Math.cos(z * scale1) * 5;
        const h2 = Math.sin(x * scale2 + 2) * Math.sin(z * scale2) * 2;
        return h1 + h2;
    }

    getHeightAt(x, z) {
        return this.calculateHeight(x, z);
    }
}
