import * as THREE from 'three';
import { Player } from './player.js';
import { Terrain } from './terrain.js';
import { ResourceManager } from './resources.js';
import { BuildSystem } from './building.js';
import { TerraformingSystem } from './terraforming.js';
import { UI } from './ui.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        console.log("Renderer initialized");

        this.clock = new THREE.Clock();

        // Modules
        this.terraforming = new TerraformingSystem(this);
        this.resources = new ResourceManager(this); // Init resources before terrain
        this.terrain = new Terrain(this);
        this.player = new Player(this);
        this.buildSystem = new BuildSystem(this);
        this.ui = new UI(this);

        this.init();
        this.animate();

        window.game = this;

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    init() {
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Brighter ambient
        this.scene.add(ambientLight);

        this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
        this.sun.position.set(100, 200, 100);
        this.sun.castShadow = true;
        this.sun.shadow.camera.left = -500;
        this.sun.shadow.camera.right = 500;
        this.sun.shadow.camera.top = 500;
        this.sun.shadow.camera.bottom = -500;
        this.sun.shadow.camera.far = 1000;
        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.scene.add(this.sun);

        // Sky
        this.scene.background = new THREE.Color(0x664433);
        // this.scene.fog = new THREE.FogExp2(0x442211, 0.005);  // Disabling fog for debug


        // Debug Grid
        const grid = new THREE.GridHelper(200, 20, 0xff0000, 0x444444);
        this.scene.add(grid);
        console.log("GridHelper added");

        // Test Box
        const boxGeo = new THREE.BoxGeometry(10, 10, 10);
        const boxMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.set(0, 5, 0);
        this.scene.add(box);
        console.log("Test box added at", box.position);

        // Landing Capsule (Simple representation)
        const capsuleGeo = new THREE.CylinderGeometry(2, 3, 5, 8);
        const capsuleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
        this.capsule = new THREE.Mesh(capsuleGeo, capsuleMat);
        const groundY = this.terrain.getHeightAt(0, 0);
        this.capsule.position.set(0, groundY + 2.5, 0);
        this.scene.add(this.capsule);
        console.log("Capsule added at", this.capsule.position);

        // Test sphere to see if anything renders
        const testGeo = new THREE.SphereGeometry(1, 16, 16);
        const testMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const testSphere = new THREE.Mesh(testGeo, testMat);
        testSphere.position.set(0, groundY + 5, -10);
        this.scene.add(testSphere);
        console.log("Test sphere added at", testSphere.position);

        // Some resources around capsule
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 6 + Math.random() * 4;
            const rx = Math.cos(angle) * dist;
            const rz = Math.sin(angle) * dist;
            const ry = this.terrain.getHeightAt(rx, rz);

            const type = 'Fer';
            const resData = this.resources.types[type];
            const geo = new THREE.IcosahedronGeometry(resData.size, 0);
            const mat = new THREE.MeshStandardMaterial({ color: resData.color });
            const rock = new THREE.Mesh(geo, mat);
            rock.position.set(rx, ry + resData.size / 2, rz);
            rock.userData = { type: 'resource', resourceType: type };
            this.scene.add(rock);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        this.player.update(delta);
        this.terrain.update(this.player.position);
        this.terraforming.update(delta);
        this.ui.update();

        this.renderer.render(this.scene, this.camera);
    }
}

new Game();
