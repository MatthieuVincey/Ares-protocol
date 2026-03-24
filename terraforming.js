export class TerraformingSystem {
    constructor(game) {
        this.game = game;

        this.stats = {
            oxygen: 0,
            temperature: -60,
            pressure: 0
        };

        this.rates = {
            oxygen: 0,
            temperature: 0,
            pressure: 0
        };
    }

    update(delta) {
        // Calculate rates based on buildings
        this.rates.oxygen = 0;
        this.game.buildSystem.buildings.forEach(b => {
            if (b.userData.buildingType === 'o2gen') this.rates.oxygen += 0.1;
            if (b.userData.buildingType === 'solar') { /* energy logic later */ }
        });

        this.stats.oxygen += this.rates.oxygen * delta;

        // Visual changes based on O2
        if (this.stats.oxygen > 10) {
            const alpha = Math.min(1, (this.stats.oxygen - 10) / 100);
            const targetColor = new THREE.Color(0x88ccff); // Blue sky
            const baseColor = new THREE.Color(0x3a1005);
            this.game.scene.background.lerpColors(baseColor, targetColor, alpha);
            this.game.scene.fog.color.lerpColors(baseColor, targetColor, alpha);
        }
    }
}
