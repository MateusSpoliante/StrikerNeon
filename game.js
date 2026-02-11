const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = {
    active: false,
    score: 0,
    level: 1,
    hp: 100,
    special: 0,
    enemiesSpawnRate: 0.012,
    isFiring: false,
    lastFire: 0,
    damageEffect: 0,
    isBossFight: false
};

let shipRotation = 0; 
let pool = { projectiles: [], enemies: [], particles: [], bossProjectiles: [] };
let mouse = { x: 0, y: 0 };

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mousedown', () => gameState.isFiring = true);
window.addEventListener('mouseup', () => gameState.isFiring = false);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameState.special >= 100) {
        triggerSupernova();
    }
});

function triggerSupernova() {
    gameState.special = 0;
    gameState.damageEffect = 25;

    // Explosão visual central
    for (let i = 0; i < 150; i++) {
        pool.particles.push(
            new Particle(canvas.width / 2, canvas.height / 2, "#bc13fe", true)
        );
    }

    // Remove tiros do boss
    pool.bossProjectiles = [];

    // Aplica dano REAL
    pool.enemies.forEach(e => {
        createExplosion(e.x, e.y, e.color);

        if (e.isBoss) {
            e.hp -= 200; // boss leva dano, mas pode sobreviver
        } else {
            e.hp = 0; // inimigos comuns MORREM
            gameState.score += 100;
            gameState.special = Math.min(100, gameState.special + 3);
        }
    });

    // Remove inimigos mortos corretamente
    pool.enemies = pool.enemies.filter(e => {
        if (!e.isBoss) return false;

        if (e.hp <= 0) {
            gameState.isBossFight = false;
            const warn = document.getElementById('bossWarn');
            if (warn) warn.style.display = 'none';
            gameState.score += 5000;
            gameState.special = 100;
            return false;
        }

        return true;
    });

    updateHUD();
}


class Particle {
    constructor(x, y, color, superEffect = false) {
        this.x = x; this.y = y;
        this.color = color;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = superEffect ? Math.random() * 20 + 5 : Math.random() * 4 + 2;
        this.friction = 0.96;
        this.life = 1.0;
    }
    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.speed *= this.friction;
        this.life -= 0.02;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, angle, type = 'normal', isEnemy = false) {
        this.x = x; this.y = y;
        this.angle = angle;
        this.type = type;
        this.isEnemy = isEnemy;
        this.speed = isEnemy ? 5 : ((type === 'fast') ? 28 : (type === 'pierce' ? 22 : 18));
        this.radius = isEnemy ? 10 : ((type === 'heavy') ? 12 : 5);
        this.color = isEnemy ? "#ff0055" : ({ 'heavy': '#ffea00', 'fast': '#00ff88', 'pierce': '#ff00ff' }[type] || '#00f2ff');
        this.isPiercing = (type === 'pierce');
    }
    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = this.color;
        ctx.fillStyle = this.isEnemy ? this.color : "white";
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Enemy {
    constructor(isBoss = false) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.max(canvas.width, canvas.height) * 0.7;
        this.x = canvas.width/2 + Math.cos(angle) * distance;
        this.y = canvas.height/2 + Math.sin(angle) * distance;
        this.isBoss = isBoss;
        this.lastShot = 0;
        
        if (isBoss) {
            this.hp = 100 + (gameState.level * 50); 
            this.radius = 70;
            this.speed = 0.5 + (gameState.level * 0.02);
            this.color = "#ff0055";
        } else {
            const types = ['scout', 'tank', 'kamikaze', 'interceptor'];
            const availableTypes = types.slice(0, Math.min(types.length, 1 + Math.floor(gameState.level / 3)));
            const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            
            // HP escala levemente com o nível
            const hpBoost = Math.floor(gameState.level / 5);
            this.hp = (type === 'tank' ? 4 : 1) + hpBoost;
            this.radius = type === 'tank' ? 25 : (type === 'kamikaze' ? 12 : 16);
            this.speed = (type === 'kamikaze' ? 2.8 : (type === 'tank' ? 0.6 : 1.1)) + (gameState.level * 0.05);
            this.color = { 'tank': '#44ff44', 'kamikaze': '#ff4444', 'interceptor': '#0066ff' }[type] || '#00f2ff';
        }
    }
    update(centerX, centerY, now) {
        const angle = Math.atan2(centerY - this.y, centerX - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
        
        if (this.isBoss && now - this.lastShot > 1200) {
            for(let i=0; i<8; i++) {
                pool.bossProjectiles.push(new Projectile(this.x, this.y, (Math.PI*2/8)*i, 'normal', true));
            }
            this.lastShot = now;
        }
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color; ctx.lineWidth = this.isBoss ? 5 : 2.5;
        ctx.beginPath();
        if (this.isBoss) {
            for(let i=0; i<6; i++) {
                const a = i * (Math.PI*2/6);
                ctx.lineTo(this.x + Math.cos(a)*this.radius, this.y + Math.sin(a)*this.radius);
            }
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        }
        ctx.closePath(); ctx.stroke();
        ctx.restore();
    }
}

function createExplosion(x, y, color) {
    for(let i=0; i<12; i++) pool.particles.push(new Particle(x, y, color));
}

function handleShooting(now, centerX, centerY) {
    const fireRate = Math.max(80, 290 - (gameState.level * 15)); 
    if (now - gameState.lastFire > fireRate) {
        const offX = Math.cos(shipRotation + Math.PI/2);
        const offY = Math.sin(shipRotation + Math.PI/2);

        if (gameState.level < 3) {
            pool.projectiles.push(new Projectile(centerX, centerY, shipRotation));
        } else if (gameState.level < 6) {
            pool.projectiles.push(new Projectile(centerX + offX*12, centerY + offY*12, shipRotation, 'fast'));
            pool.projectiles.push(new Projectile(centerX - offX*12, centerY - offY*12, shipRotation, 'fast'));
        } else if (gameState.level < 10) {
            pool.projectiles.push(new Projectile(centerX, centerY, shipRotation, 'heavy'));
            pool.projectiles.push(new Projectile(centerX + offX*18, centerY + offY*18, shipRotation, 'fast'));
            pool.projectiles.push(new Projectile(centerX - offX*18, centerY - offY*18, shipRotation, 'fast'));
        } else {
            pool.projectiles.push(new Projectile(centerX + offX*25, centerY + offY*25, shipRotation, 'fast'));
            pool.projectiles.push(new Projectile(centerX + offX*8, centerY + offY*8, shipRotation, 'pierce'));
            pool.projectiles.push(new Projectile(centerX - offX*8, centerY - offY*8, shipRotation, 'pierce'));
            pool.projectiles.push(new Projectile(centerX - offX*25, centerY - offY*25, shipRotation, 'fast'));
        }
        gameState.lastFire = now;
    }
}

function gameLoop(now) {
    if (!gameState.active) return;
    requestAnimationFrame(gameLoop);

    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const grd = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 50, canvas.width/2, canvas.height/2, canvas.width);
    grd.addColorStop(0, gameState.damageEffect > 0 ? "rgba(120,0,0,0.5)" : "rgba(10,15,30,1)");
    grd.addColorStop(1, "#000");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if(gameState.damageEffect > 0) gameState.damageEffect--;

    const cX = canvas.width / 2;
    const cY = canvas.height / 2;

    // Lógica de Nível Infinita (Sobe a cada 1000 pontos)
    let targetLevel = Math.floor(gameState.score / 1000) + 1;
    if (targetLevel > gameState.level) {
        gameState.level = targetLevel;
        updateHUD();
    }

    // Nave
    shipRotation = Math.atan2(mouse.y - cY, mouse.x - cX);
    ctx.save();
    ctx.translate(cX, cY); ctx.rotate(shipRotation);
    const shipColor = gameState.damageEffect > 0 ? "#ff0055" : "#00f2ff";
    ctx.shadowBlur = 20; ctx.shadowColor = shipColor;
    ctx.strokeStyle = shipColor; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, 0); ctx.lineTo(-12, -11); ctx.lineTo(-7, 0); ctx.lineTo(-12, 11); ctx.closePath();
    ctx.stroke();
    ctx.restore();

    if (gameState.isFiring) handleShooting(now, cX, cY);

    // Spawn de Boss (A cada 10 níveis)
    if (gameState.level % 10 === 0 && !gameState.isBossFight) {
        gameState.isBossFight = true;
        pool.enemies.push(new Enemy(true));
        const warn = document.getElementById('bossWarn');
        if(warn) warn.style.display = 'block';
    }
    
    // Spawn de inimigos comum com escalonamento
    let currentSpawnRate = gameState.enemiesSpawnRate + (gameState.level * 0.004);
    if (!gameState.isBossFight && Math.random() < currentSpawnRate) {
        pool.enemies.push(new Enemy());
    }

    // Projéteis do Boss
    for (let bi = pool.bossProjectiles.length - 1; bi >= 0; bi--) {
        const bp = pool.bossProjectiles[bi];
        bp.update(); bp.draw();

        if (Math.hypot(cX - bp.x, cY - bp.y) < bp.radius + 10) {
            gameState.hp -= 6;
            gameState.damageEffect = 6;
            pool.bossProjectiles.splice(bi, 1);
            updateHUD();
            continue;
        }

        if (bp.x < 0 || bp.x > canvas.width || bp.y < 0 || bp.y > canvas.height) {
            pool.bossProjectiles.splice(bi, 1);
        }
    }

    // Inimigos e Colisões
    for (let ei = pool.enemies.length-1; ei>=0; ei--) {
        const e = pool.enemies[ei];
        e.update(cX, cY, now); e.draw();

        if (Math.hypot(cX - e.x, cY - e.y) < e.radius + 15) {
            gameState.hp -= e.isBoss ? 25 : 10;
            gameState.damageEffect = 12;
            createExplosion(e.x, e.y, e.color);
            if(!e.isBoss) pool.enemies.splice(ei, 1);
            updateHUD();
        }

        for (let pi = pool.projectiles.length-1; pi>=0; pi--) {
            const p = pool.projectiles[pi];
            if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
                e.hp--;
                createExplosion(p.x, p.y, e.color);
                if(!p.isPiercing) pool.projectiles.splice(pi, 1);
                
                if(e.hp <= 0) {
                    if(e.isBoss) { 
                        gameState.isBossFight = false; 
                        const warn = document.getElementById('bossWarn');
                        if(warn) warn.style.display = 'none';
                        gameState.special = 100;
                    }
                    gameState.score += e.isBoss ? 5000 : 100;
                    gameState.special = Math.min(100, gameState.special + (e.isBoss ? 0 : 3));
                    pool.enemies.splice(ei, 1);
                    updateHUD();
                }
                break;
            }
        }
    }

    // Limpeza de Projéteis do Jogador
    for (let i = pool.projectiles.length - 1; i >= 0; i--) {
        let p = pool.projectiles[i];
        p.update(); p.draw();
        if (p.x < -50 || p.x > canvas.width + 50 || p.y < -50 || p.y > canvas.height + 50) {
            pool.projectiles.splice(i, 1);
        }
    }

    pool.particles.forEach((p, i) => { 
        p.update(); p.draw(); 
        if(p.life <= 0) pool.particles.splice(i, 1); 
    });

    if (gameState.hp <= 0) gameOver();
}

function updateHUD() {
    const hpBar = document.getElementById('hpBar');
    const sBar = document.getElementById('specialBar');
    if(hpBar) hpBar.style.width = Math.max(0, gameState.hp) + '%';
    if(sBar) {
        sBar.style.width = gameState.special + '%';
        if(gameState.special >= 100) {
            sBar.style.background = "#fff";
            sBar.style.boxShadow = "0 0 20px #fff";
        } else {
            sBar.style.background = "#bc13fe";
            sBar.style.boxShadow = "none";
        }
    }
    const scoreVal = document.getElementById('scoreVal');
    const levelVal = document.getElementById('levelVal');
    if(scoreVal) scoreVal.innerText = gameState.score.toString().padStart(6, '0');
    if(levelVal) levelVal.innerText = gameState.level;
}

function gameOver() {
    gameState.active = false;
    const msg = document.getElementById('statusMsg');
    const overlay = document.getElementById('overlay');
    if(msg) msg.innerText = "CORE DESTRUÍDO";
    if(overlay) overlay.classList.remove('hidden');
}

document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('overlay').classList.add('hidden');
    gameState = { active: true, score: 0, level: 1, hp: 100, special: 0, enemiesSpawnRate: 0.012, isFiring: false, lastFire: 0, damageEffect: 0, isBossFight: false };
    pool = { projectiles: [], enemies: [], particles: [], bossProjectiles: [] };
    updateHUD();
    gameLoop(performance.now());
});