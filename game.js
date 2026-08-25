// ===============================================================
//      GALACTIC SURVIVOR - Complete Edition
// ===============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- GAME STATE --- 
let gameState = 'MENU';
let currentArea = 1;
let currentStage = 1;
let enemiesKilledInStage = 0;
const ENEMIES_PER_STAGE = 15;
let revives = 0;
let score = 0;
let combo = 0;
let comboTimer = 0;
let gameTime = 0;
let totalKills = 0;
let highScore = parseInt(localStorage.getItem('galactic_highscore') || '0');

let starsEnabled = true;
let musicEnabled = true;
let musicVolume = 0.3;
let godMode = false;
let devMode = false;
let screenShake = 0;
let animationFrameId = null;

// --- ASSETS ---
const images = {};
const sounds = {};
const AREA_COUNT = 7;

const imageFiles = [];
for (let a = 1; a <= AREA_COUNT; a++) {
    imageFiles.push('bg-area' + a, 'boss-area' + a, 'player' + a);
    for (let t = 1; t <= 3; t++) imageFiles.push('enemy' + t + '-area' + a);
    // enemy4 uses geometric fallback shapes, no PNG needed
}
imageFiles.forEach(name => {
    const img = new Image();
    img.src = name + '.png';
    images[name] = img;
});


const soundFiles = [];
for (let a = 1; a <= AREA_COUNT; a++) soundFiles.push('music-area' + a);
soundFiles.push('sound-bomb','sound-boss','sound-firechamber','sound-ghost','sound-health','sound-horizontallaser','sound-laserbeam','sound-lightning','sound-portal','sound-powerup','sound-shield','sound-shockwave');
//Missing: sound-freeze, sound-plasma, sound-vortex, sound-drone, sound-missile, sound-levelup, sound-hit
soundFiles.forEach(name => {
    const audio = new Audio(name + '.mp3');
    sounds[name] = audio;
});

let currentMusic = null;

function playMusic(area) {
    stopMusic();
    if (!musicEnabled) return;
    let key = 'music-area' + area;
    if (!sounds[key] || isNaN(sounds[key].duration)) key = 'music-area1';
    if (sounds[key]) {
        currentMusic = sounds[key];
        currentMusic.loop = true;
        currentMusic.volume = musicVolume;
        currentMusic.play().catch(() => {});

    }
}

function stopMusic() {
    if (currentMusic) { currentMusic.pause(); currentMusic.currentTime = 0;   
    currentMusic = null; }
}
function changeVolume(val) {
    musicVolume = parseFloat(val);
    if (currentMusic) currentMusic.volume = musicVolume;
}
function playSFX(name, vol) {
    vol = vol || 0.3;
    if (sounds[name]) {
        const s = sounds[name].cloneNode();
        s.volume = vol;
        s.play().catch(() => {});
    }
}

// -- PLAYER ---
const PLAYER_SPEED = 3.2;
const player = {
    x: 0, y: 0, width: 44, height: 52,
    hp: 5, maxHp: 5,
    activeSkills: {},
    activeAbilities: { Q: null, E: null, R: null },
    invincibleTimer: 0
};

let bullets = [];
let enemyBullets = [];
let enemies = [];
let skillPickups = [];
let particles = [];
let visualEffects = [];
let floatingTexts = [];
let stars = [];
let activePortal = null;
let bossAttacks = [];
let lightningTargeting = false;
let mousePos = { x: 0, y: 0 };
const keys = {};

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Escape') {
        if (lightningTargeting) lightningTargeting = false;
        else if (gameState === 'PLAYING') pauseGame();
        else if (gameState === 'PAUSED') resumeGame();
    }
if (gameState === 'PLAYING') {
    if (e.code === 'KeyQ' && player.activeAbilities.Q) {
        if (player.activeAbilities.Q === 'shockwave') useShockwave();
        else if (player.activeAbilities.Q === 'blackhole') useBlackHole();
    }
    if (e.code === 'KeyE' && player.activeAbilities.E && !lightningTargeting)
    {
        if (player.activeAbilities.E === 'lightning') lightningTargeting =
        true;
        else if (player.activeAbilities.E === 'missile') useMissile();
    }
    if (e.code === 'KeyR' && player.activeAbilities.R) {
        if (player.activeAbilities.R === 'nuke') useNukeAbility();
        else if (player.activeAbilities.R === 'timefreeze') useTimeFreeze();
    }
    if (devMode) {
        if (e.code === 'KeyN') devNextArea();
        if (e.code === 'KeyM') devNextStage();
        if (e.code === 'KeyB') devSpawnBoss();
        if (e.code === 'KeyH') { player.hp = player.maxHp; addFloatingText (
            player.x, player.y, 'DEV: FULL HP', '#00ff88', 16); }
            if (e.code === 'KeyK') { enemies = []; addFloatingText(player.x,
                player.y, 'DEV: KILL ALL', '#ff0055', 16); }
            }
        }
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('mousemove', e => { mousePos.x = e.clientX; mousePos.y = e.clientY; });
    window.addEventListener('mousedown', e => {
        if (lightningTargeting && e.button === 0) {
        useLightningStrike(e.clientX, e.clientY);
        lightningTargeting = false;
        }
    });

    for (let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: Math.random() * 2.5 + 0.5,
            speed: Math.random() * 1.2 + 0.2,
            twinkle: Math.random() * Math.PI * 2
        });
    }