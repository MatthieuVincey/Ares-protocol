export class UI {
    constructor(game) {
        this.game = game;
        this.elements = {
            o2: document.getElementById('fill-o2'),
            health: document.getElementById('fill-health'),
            energy: document.getElementById('fill-energy'),
            inv: document.getElementById('inventory'),
            invItems: document.getElementById('inv-items'),
            build: document.getElementById('build-menu'),
            msg: document.getElementById('messages'),
            planetO2: document.getElementById('stat-planet-o2'),
            planetTemp: document.getElementById('stat-planet-temp'),
            planetPress: document.getElementById('stat-planet-press')
        };

        this.init();
    }

    init() {
        const buildBtns = document.querySelectorAll('.build-btn');
        buildBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.build;
                this.game.buildSystem.startPlacement(type);
                this.toggleBuildMenu();
            });
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.game.buildSystem.ghost) {
                this.game.buildSystem.confirmPlacement();
            }
        });
    }

    update() {
        const stats = this.game.player.stats;
        this.elements.o2.style.width = `${stats.oxygen}%`;
        this.elements.health.style.width = `${stats.health}%`;
        this.elements.energy.style.width = `${stats.energy}%`;

        const terra = this.game.terraforming.stats;
        this.elements.planetO2.innerText = terra.oxygen.toFixed(2);
        this.elements.planetTemp.innerText = terra.temperature.toFixed(1);
        this.elements.planetPress.innerText = terra.pressure.toFixed(1);
    }

    showMessage(txt) {
        this.elements.msg.innerText = txt;
        setTimeout(() => { if (this.elements.msg.innerText === txt) this.elements.msg.innerText = ""; }, 3000);
    }

    toggleInventory() {
        const inv = this.elements.inv;
        inv.style.display = inv.style.display === 'none' ? 'block' : 'none';
        if (inv.style.display === 'block') {
            document.exitPointerLock();
            this.updateInventory();
        } else {
            document.body.requestPointerLock();
        }
    }

    updateInventory() {
        this.elements.invItems.innerHTML = "";
        const inv = this.game.player.inventory;
        for (const [name, count] of Object.entries(inv)) {
            if (count > 0) {
                const div = document.createElement('div');
                div.innerText = `${name}: ${count}`;
                this.elements.invItems.appendChild(div);
            }
        }
    }

    toggleBuildMenu() {
        const menu = this.elements.build;
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        if (menu.style.display === 'block') {
            document.exitPointerLock();
        } else {
            document.body.requestPointerLock();
        }
    }
}
