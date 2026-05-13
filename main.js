import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Configuration ─────────────────────────────────────────────────────────────
const CONFIG = {
    player:  { speed: 4, height: 9 },
    portals: { interactionDistance: 12, transitionDuration: 1.0 },
    shadows: { mapSize: 1024, bias: -0.001 }
};

// ─── Game State ────────────────────────────────────────────────────────────────
let isTransitioning   = false;
let selectedCharacter = null;

// ─── Renderer ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace  = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a2a44, 0.008);

// ─── Camera / Player ──────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
const player = {
    position: new THREE.Vector3(0, 3, 0),
    velocity: new THREE.Vector3(),
    moveForward: false, moveBackward: false, moveLeft: false, moveRight: false,
    speed: CONFIG.player.speed
};
camera.position.copy(player.position);

// ─── Mouse / WASD ─────────────────────────────────────────────────────────────
let mouseX = Math.PI, mouseY = 0;
const sensitivity = 0.002;
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== document.body) return;
    mouseX -= e.movementX * sensitivity;
    mouseY -= e.movementY * sensitivity;
    mouseY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseY));
});
document.addEventListener('click', () => document.body.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
    const locked  = document.pointerLockElement === document.body;
    const method  = locked ? 'addEventListener' : 'removeEventListener';
    document[method]('keydown', onKeyDown);
    document[method]('keyup',   onKeyUp);
});
function onKeyDown(e) {
    if (e.code === 'KeyW') player.moveForward  = true;
    if (e.code === 'KeyS') player.moveBackward = true;
    if (e.code === 'KeyA') player.moveLeft     = true;
    if (e.code === 'KeyD') player.moveRight    = true;
    if (e.code === 'KeyE') window.interactPressed = true;
}
function onKeyUp(e) {
    if (e.code === 'KeyW') player.moveForward  = false;
    if (e.code === 'KeyS') player.moveBackward = false;
    if (e.code === 'KeyA') player.moveLeft     = false;
    if (e.code === 'KeyD') player.moveRight    = false;
}
window.interactPressed = false;

// ─── Lighting ─────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x2a3a55, 0.5);
scene.add(ambientLight);

const rimLight1 = new THREE.DirectionalLight(0x6600cc, 1.2);
rimLight1.position.set(-20, 30, 10);
scene.add(rimLight1);

const rimLight2 = new THREE.DirectionalLight(0x00ccaa, 0.9);
rimLight2.position.set(15, 25, -15);
scene.add(rimLight2);

const centralLight = new THREE.PointLight(0x8844ff, 2.0, 100);
centralLight.position.set(0, 10, 0);
scene.add(centralLight);

const sun = new THREE.DirectionalLight(0xcc6600, 1.2);
sun.position.set(20, 40, 20);
sun.castShadow = true;
sun.shadow.mapSize.width  = CONFIG.shadows.mapSize;
sun.shadow.mapSize.height = CONFIG.shadows.mapSize;
Object.assign(sun.shadow.camera, { near: 0.5, far: 200, left: -50, right: 50, top: 50, bottom: -50 });
sun.shadow.bias = CONFIG.shadows.bias;
scene.add(sun);

// ─── Sky ──────────────────────────────────────────────────────────────────────
const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time:        { value: 0 },
        sunsetColor: { value: new THREE.Color(0x662244) },
        zenithColor: { value: new THREE.Color(0x1a2a44) }
    },
    vertexShader:   `varying vec3 vWorldPosition; void main() { vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; uniform vec3 sunsetColor; uniform vec3 zenithColor; varying vec3 vWorldPosition; void main() { vec3 ray = normalize(vWorldPosition); float height = (ray.y + 1.0) * 0.5; vec3 sky = mix(sunsetColor, zenithColor, smoothstep(0.0, 1.0, height)); float clouds = smoothstep(0.4, 0.6, height) * (0.5 + 0.5 * sin(ray.x * 5.0 + time * 0.3)); sky *= (1.0 - 0.4 * clouds); gl_FragColor = vec4(sky, 1.0); }`,
    side: THREE.BackSide
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 64, 64), skyMaterial));

// ─── Ambient Particles ────────────────────────────────────────────────────────
const particleCount     = 5000;
const particlePositions = new Float32Array(particleCount * 3);
const particleVelocities = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    particlePositions[i3]     = (Math.random() - 0.5) * 200;
    particlePositions[i3 + 1] = (Math.random() - 0.5) * 100;
    particlePositions[i3 + 2] = (Math.random() - 0.5) * 200;
    particleVelocities[i3]     = (Math.random() - 0.5) * 0.015;
    particleVelocities[i3 + 1] = Math.random() * 0.008;
    particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.015;
}
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
    color: 0x66aaff, size: 0.3, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending
}));
scene.add(particles);

// ─── God Rays ─────────────────────────────────────────────────────────────────
const godRayMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader:   `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; varying vec2 vUv; void main() { float dist = distance(vUv, vec2(0.5)); float rays = sin(dist * 15.0 - time * 1.5) * 0.5 + 0.5; rays *= smoothstep(0.0, 0.4, 1.0 - dist); gl_FragColor = vec4(0.5, 0.3, 1.2, rays * 0.6); }`,
    transparent: true, blending: THREE.AdditiveBlending
});
const godRayQuad = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), godRayMaterial);
godRayQuad.frustumCulled = false;
scene.add(godRayQuad);

// ─── Portal Characters ────────────────────────────────────────────────────────
const CHARACTER_PORTALS = [
    { name: 'Kael',  subtitle: 'The Lonely',      color: 0x88ccff, zone: 'Hollow Forest',  description: 'A warrior lost to his own obsession, forever seeking perfection in the frozen wastes.' },
    { name: 'Sura',  subtitle: 'The Controller',   color: 0xffaa99, zone: 'Candy Ruins',    description: 'A puppeteer who pulls strings from the shadows, manipulating fate itself.' },
    { name: 'Lome',  subtitle: 'The Shapeshifter', color: 0xaaff88, zone: 'Shifting Marsh', description: 'Neither man nor beast, but something that wears faces like masks.' },
    { name: 'Vey',   subtitle: 'The Grieving',     color: 0x8800ff, zone: 'Ash Plains',     description: 'A soul consumed by loss, wandering through eternal twilight.' }
];

// ─── Portal State ─────────────────────────────────────────────────────────────
const portals               = [];
const portalParticlesMeshes = [];
const portalArchLights      = [];

// ─── Portal Manager ───────────────────────────────────────────────────────────
class PortalManager {
    constructor() {
        this.entries = [];
        this._createPromptUI();
    }

    _createPromptUI() {
        this.prompt = document.createElement('div');
        this.prompt.style.cssText = `
            position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); color: #fff; padding: 12px 24px;
            border-radius: 8px; font-family: monospace; font-size: 18px;
            text-align: center; pointer-events: none; z-index: 1000;
            border: 2px solid rgba(255,255,255,0.3); backdrop-filter: blur(5px);
            opacity: 0; transition: opacity 0.3s ease;
        `;
        document.body.appendChild(this.prompt);
    }

    _showPrompt(name) {
        this.prompt.textContent = `Press [E] to enter ${name}'s portal`;
        this.prompt.style.opacity = '1';
    }

    _hidePrompt() {
        this.prompt.style.opacity = '0';
    }

    add(portal, charData, worldPos) {
        this.entries.push({ mesh: portal, data: charData, position: worldPos.clone() });
    }

    update(playerPos) {
        if (isTransitioning) { this._hidePrompt(); return null; }
        for (const entry of this.entries) {
            if (playerPos.distanceTo(entry.position) < CONFIG.portals.interactionDistance) {
                this._showPrompt(entry.data.name);
                if (window.interactPressed) {
                    window.interactPressed = false;
                    this._hidePrompt();
                    return entry;
                }
                return null;
            }
        }
        this._hidePrompt();
        return null;
    }
}

const portalManager = new PortalManager();

// ─── Transition & Character Introduction ──────────────────────────────────────
function startTransition(portalEntry) {
    if (isTransitioning) return;
    isTransitioning   = true;
    selectedCharacter = portalEntry.data;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: black; z-index: 2000; pointer-events: none;
        opacity: 0; transition: opacity ${CONFIG.portals.transitionDuration}s ease;
    `;
    document.body.appendChild(overlay);

    setTimeout(() => overlay.style.opacity = '1', 10);
    setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.remove();
            showCharacterIntroduction(selectedCharacter);
        }, 1000);
    }, CONFIG.portals.transitionDuration * 1000);
}

function showCharacterIntroduction(character) {
    const hex = new THREE.Color(character.color).getStyle();
    const introDiv = document.createElement('div');
    introDiv.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,40,0.95));
        color: white; padding: 30px 50px; border-radius: 20px;
        text-align: center; z-index: 2001; font-family: monospace;
        border: 2px solid ${hex};
        box-shadow: 0 0 50px rgba(0,0,0,0.5); backdrop-filter: blur(10px);
        min-width: 400px; animation: introSlideIn 0.5s ease;
    `;
    introDiv.innerHTML = `
        <style>
            @keyframes introSlideIn  { from { opacity:0; transform:translate(-50%,-70%); } to { opacity:1; transform:translate(-50%,-50%); } }
            @keyframes introSlideOut { from { opacity:1; transform:translate(-50%,-50%); } to { opacity:0; transform:translate(-50%,-30%); } }
        </style>
        <h1 style="color:${hex}; margin-bottom:16px;">✦ ${character.name} ✦</h1>
        <h3 style="color:#aaa; margin-bottom:16px;">${character.subtitle} — ${character.zone}</h3>
        <p style="line-height:1.6; margin-bottom:20px;">${character.description}</p>
        <div style="font-size:13px; color:#888;">Press any key to enter the world…</div>
    `;
    document.body.appendChild(introDiv);

    const dismiss = () => {
        introDiv.style.animation = 'introSlideOut 0.3s ease forwards';
        setTimeout(() => {
            introDiv.remove();
            // After dismissing, load the lonely model if this is Kael
            if (character.subtitle === 'The Lonely') {
                loadLonelyWorld();
            } else {
                isTransitioning = false;
            }
        }, 320);
        document.removeEventListener('keydown', dismiss);
    };
    document.addEventListener('keydown', dismiss);
    setTimeout(dismiss, 8000);
}

// ─── Lonely World ─────────────────────────────────────────────────────────────
let lonelyActive = false;

const lonelyScene  = new THREE.Scene();
lonelyScene.fog    = new THREE.FogExp2(0x0a0a14, 0.012);
lonelyScene.background = new THREE.Color(0x0a0a14);

const lonelyCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

// Lighting for the lonely world
lonelyScene.add(new THREE.AmbientLight(0x111122, 0.8));
const lonelyRim = new THREE.DirectionalLight(0x4466aa, 1.2);
lonelyRim.position.set(-10, 20, 10);
lonelyScene.add(lonelyRim);
const lonelyFill = new THREE.DirectionalLight(0x223344, 0.6);
lonelyFill.position.set(10, 10, -10);
lonelyScene.add(lonelyFill);

function loadLonelyWorld() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: black; z-index: 2000; pointer-events: none;
        opacity: 0; transition: opacity 0.8s ease;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.style.opacity = '1', 10);

    setTimeout(() => {
        // ── Dispose main scene to free GPU memory ─────────────────────────────
        scene.traverse(node => {
            if (node.isMesh) {
                node.geometry?.dispose();
                const mats = Array.isArray(node.material) ? node.material : [node.material];
                mats.forEach(m => {
                    if (!m) return;
                    Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); });
                    m.dispose();
                });
            }
        });
        renderer.renderLists.dispose();
        renderer.info.reset();

        // ── Build procedural lonely world ─────────────────────────────────────

        // Ground — large dark plane with subtle grid
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x050508,
            roughness: 0.95,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 40, 40), groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        lonelyScene.add(ground);

        // Faint grid lines on the ground
        const gridHelper = new THREE.GridHelper(400, 40, 0x111133, 0x0a0a1a);
        gridHelper.position.y = 0.01;
        lonelyScene.add(gridHelper);

        // Distant street lamp — single warm cone of light
        const lampLight = new THREE.SpotLight(0xffddaa, 8, 60, Math.PI / 6, 0.4, 1.5);
        lampLight.position.set(0, 18, -30);
        lampLight.target.position.set(0, 0, -30);
        lampLight.castShadow = true;
        lonelyScene.add(lampLight);
        lonelyScene.add(lampLight.target);

        // Lamp post geometry
        const postMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.8 });
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 18, 8), postMat);
        post.position.set(0, 9, -30);
        lonelyScene.add(post);

        // Lamp head
        const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 2 }));
        lampHead.position.set(0, 18.3, -30);
        lonelyScene.add(lampHead);

        // Floating fog motes — slow drifting particles
        const moteCount = 1200;
        const motePos   = new Float32Array(moteCount * 3);
        for (let i = 0; i < moteCount; i++) {
            motePos[i*3]     = (Math.random() - 0.5) * 120;
            motePos[i*3 + 1] = Math.random() * 12;
            motePos[i*3 + 2] = (Math.random() - 0.5) * 120;
        }
        const moteGeo = new THREE.BufferGeometry();
        moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
        const moteMesh = new THREE.Points(moteGeo, new THREE.PointsMaterial({
            color: 0x4455aa, size: 0.18, transparent: true,
            opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        lonelyScene.add(moteMesh);

        // A few distant silhouette pillars for depth
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 1 });
        [-20, -8, 8, 20].forEach((xOff, i) => {
            const h = 8 + i * 2;
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), pillarMat);
            pillar.position.set(xOff, h / 2, -60 - i * 5);
            lonelyScene.add(pillar);
        });

        // Spawn player at ground level, facing the lamp
        player.position.set(0, 2, 10);
        player.velocity.set(0, 0, 0);
        mouseX = Math.PI; // face -Z toward the lamp
        mouseY = 0;
        lonelyCamera.position.copy(player.position);

        lonelyActive = true;

        overlay.style.opacity = '0';
        setTimeout(() => { overlay.remove(); isTransitioning = false; }, 900);

    }, 900);
}

// ─── Mesh Helpers ─────────────────────────────────────────────────────────────
function setupMesh(node) {
    if (!node.isMesh) return;
    node.castShadow    = true;
    node.receiveShadow = true;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach(m => { if (m?.map) m.map.colorSpace = THREE.SRGBColorSpace; });
}

function setupPortalMesh(node, color) {
    if (!node.isMesh) return;
    node.castShadow    = true;
    node.receiveShadow = true;
    const parentName = node.parent?.name || '';
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach(m => {
        if (m?.map) m.map.colorSpace = THREE.SRGBColorSpace;
        if (parentName.includes('Icosphere')) {
            m.emissive          = new THREE.Color(0x000000);
            m.emissiveIntensity = 0;
        } else if (parentName.includes('Cube')) {
            m.emissive          = new THREE.Color(color);
            m.emissiveIntensity = 0.25;
        } else {
            m.emissive          = new THREE.Color(0x000000);
            m.emissiveIntensity = 0;
        }
    });
}

// ─── Portal Factory ───────────────────────────────────────────────────────────
async function createPortal(charData, x, z, envFloorY) {
    const gltfLoader = new GLTFLoader();
    const portalGltf = await gltfLoader.loadAsync('models/portal/scene.gltf');
    const portal     = portalGltf.scene;

    portal.traverse(node => setupPortalMesh(node, charData.color));
    portal.scale.setScalar(18);
    portal.updateMatrixWorld(true);

    const portalBox = new THREE.Box3().setFromObject(portal);
    portal.position.set(x, envFloorY - portalBox.min.y + 4.3, z);
    portal.rotation.y = Math.PI;
    scene.add(portal);
    portals.push(portal);

    // Register with portal manager (world-space position)
    portalManager.add(portal, charData, portal.position);

    // ── Arch lights — light bleeding through stone ────────────────────────────
    const c = charData.color;
    const archLightDefs = [
        { pos: [-0.3,  0.1,  0.1 ], intensity: 1.2, distance: 18, color: c        },
        { pos: [ 0.3,  0.1,  0.1 ], intensity: 1.2, distance: 18, color: c        },
        { pos: [ 0.0,  0.5,  0.05], intensity: 1.8, distance: 25, color: c        },
        { pos: [ 0.0,  0.85, 0.0 ], intensity: 1.0, distance: 20, color: 0xaaddff },
        { pos: [ 0.0,  0.4, -0.2 ], intensity: 2.5, distance: 30, color: c        },
        { pos: [-0.45, 0.2,  0.0 ], intensity: 0.8, distance: 14, color: c        },
        { pos: [ 0.45, 0.2,  0.0 ], intensity: 0.8, distance: 14, color: c        },
    ];
    const archLightObjects = [];
    archLightDefs.forEach(({ pos, intensity, distance, color }) => {
        const light = new THREE.PointLight(color, intensity, distance);
        light.position.set(...pos);
        portal.add(light);
        archLightObjects.push(light);
    });
    portalArchLights.push(archLightObjects);

    // ── Swirl particles ───────────────────────────────────────────────────────
    const pParticles = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(
            Array(300).fill(0).map(() => {
                const p = new THREE.Vector3();
                p.setFromSphericalCoords(
                    2 + Math.random() * 4,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI * 2
                );
                return p;
            })
        ),
        new THREE.PointsMaterial({
            color: 0xffffff, size: 0.2, transparent: true,
            opacity: 0.5, blending: THREE.AdditiveBlending
        })
    );
    portal.add(pParticles);
    portalParticlesMeshes.push(pParticles);

    // ── 3-D label that projects to screen space ───────────────────────────────
    const labelWorldPos = portal.position.clone().add(new THREE.Vector3(0, 12, 0));
    const label = document.createElement('div');
    label.innerHTML = `<strong>${charData.name}</strong><br><span style="font-size:11px;opacity:0.7;font-style:italic;">${charData.subtitle}</span>`;
    label.style.cssText = `
        position: absolute; pointer-events: none; z-index: 100;
        color: #${new THREE.Color(charData.color).getHexString()};
        font-family: monospace; font-size: 14px; text-align: center;
        background: rgba(0,0,0,0.6); padding: 5px 10px; border-radius: 5px;
        white-space: nowrap; transform: translate(-50%, -50%);
        border-left: 2px solid #${new THREE.Color(charData.color).getHexString()};
    `;
    document.body.appendChild(label);

    // Update label position every frame
    (function updateLabel() {
        if (!label.parentNode) return;
        const sp = labelWorldPos.clone().project(camera);
        if (sp.z < 1) {
            label.style.display = 'block';
            label.style.left = `${(sp.x * 0.5 + 0.5) * window.innerWidth}px`;
            label.style.top  = `${(-sp.y * 0.5 + 0.5) * window.innerHeight}px`;
        } else {
            label.style.display = 'none';
        }
        requestAnimationFrame(updateLabel);
    })();

    return portal;
}

// ─── Loading ───────────────────────────────────────────────────────────────────
const loadingEl   = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const loadingBar  = document.getElementById('loading-bar');
const loader      = new GLTFLoader();

function hideLoader() {
    loadingEl.style.transition = 'opacity 0.6s ease';
    loadingEl.style.opacity    = '0';
    setTimeout(() => loadingEl.remove(), 650);
}

loader.load('models/environment/scene.gltf', async (gltf) => {
    const env = gltf.scene;
    env.traverse(setupMesh);
    scene.add(env);

    env.updateMatrixWorld(true);
    const envBox    = new THREE.Box3().setFromObject(env);
    const envFloorY = envBox.min.y;
    const envCenter = envBox.getCenter(new THREE.Vector3());

    // Portal layout — evenly spaced across env width at far wall
    const portalZ  = envBox.max.z + 14;
    const envWidth = envBox.max.x - envBox.min.x;
    const spacing  = envWidth / (CHARACTER_PORTALS.length + 1);
    const startX   = envBox.min.x + spacing ;

    player.position.set(envCenter.x - 5, envFloorY + CONFIG.player.height, envCenter.z);
    camera.position.copy(player.position);
    mouseX = Math.PI; // face +Z toward portals

    loadingBar.style.width = '20%';

    for (let i = 0; i < CHARACTER_PORTALS.length; i++) {
        loadingText.textContent = `Conjuring portal ${i + 1} of ${CHARACTER_PORTALS.length}…`;
        await createPortal(CHARACTER_PORTALS[i], startX + i * spacing, portalZ, envFloorY);
        loadingBar.style.width = `${20 + (i + 1) * 20}%`;
    }

    loadingBar.style.width = '100%';
    loadingText.textContent = 'Welcome to the Nexus!';
    setTimeout(hideLoader, 600);
    animate();

}, (xhr) => {
    if (xhr.lengthComputable) loadingBar.style.width = (xhr.loaded / xhr.total * 20) + '%';
}, (err) => {
    console.error('Environment load error:', err);
    hideLoader(); animate();
});

// ─── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    lonelyCamera.aspect = window.innerWidth / window.innerHeight;
    lonelyCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Animate ──────────────────────────────────────────────────────────────────
let time     = 0;
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt  = Math.min((now - lastTime) / 1000, 0.1);
    lastTime  = now;
    time     += dt;

    if (!isTransitioning) {
        // Player movement
        const front = new THREE.Vector3(0, 0, -1).applyQuaternion(
            lonelyActive ? lonelyCamera.quaternion : camera.quaternion
        );
        const side = new THREE.Vector3(-1, 0, 0).applyQuaternion(
            lonelyActive ? lonelyCamera.quaternion : camera.quaternion
        );
        const dir = new THREE.Vector3();
        if (player.moveForward)  dir.add(front);
        if (player.moveBackward) dir.sub(front);
        if (player.moveLeft)     dir.add(side);
        if (player.moveRight)    dir.sub(side);

        if (dir.length() > 0) {
            player.velocity.copy(dir.normalize().multiplyScalar(player.speed * dt));
        } else {
            player.velocity.multiplyScalar(0.9);
        }
        player.position.add(player.velocity);

        if (lonelyActive) {
            // Drive the lonely camera
            lonelyCamera.position.copy(player.position);
            lonelyCamera.rotation.order = 'YXZ';
            lonelyCamera.rotation.y = mouseX;
            lonelyCamera.rotation.x = mouseY;
        } else {
            camera.position.copy(player.position);
            camera.rotation.order = 'YXZ';
            camera.rotation.y = mouseX;
            camera.rotation.x = mouseY;

            // Portal proximity check (only in main scene)
            const activated = portalManager.update(player.position);
            if (activated) startTransition(activated);
        }
    }

    if (lonelyActive) {
        // ── Lonely scene render ───────────────────────────────────────────────
        renderer.render(lonelyScene, lonelyCamera);
    } else {
        // ── Main scene updates ────────────────────────────────────────────────
        skyMaterial.uniforms.time.value    = time * 0.2;
        godRayMaterial.uniforms.time.value = time;
        centralLight.intensity = 2.0 + Math.sin(time * 1.5) * 0.5;
        rimLight1.intensity    = 1.2 + Math.sin(time * 0.8) * 0.3;
        rimLight2.intensity    = 0.9 + Math.cos(time * 1.2) * 0.2;

        portalParticlesMeshes.forEach((pp, i) => {
            pp.rotation.y += dt * (0.8 + i * 0.1);
        });

        portalArchLights.forEach((lights, pi) => {
            lights.forEach((light, li) => {
                const base = light.userData.baseIntensity
                    ?? (light.userData.baseIntensity = light.intensity);
                light.intensity = base * (0.85 + 0.15 * Math.sin(time * 1.1 + pi * 2.3 + li * 0.7));
            });
        });

        const pos = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            pos[i3]     += particleVelocities[i3]     * dt;
            pos[i3 + 1] += particleVelocities[i3 + 1] * dt;
            pos[i3 + 2] += particleVelocities[i3 + 2] * dt;
            if (Math.abs(pos[i3])     > 100) particleVelocities[i3]     *= -1;
            if (Math.abs(pos[i3 + 1]) >  50) particleVelocities[i3 + 1] *= -1;
            if (Math.abs(pos[i3 + 2]) > 100) particleVelocities[i3 + 2] *= -1;
            pos[i3 + 1] += Math.sin(time * 0.5 + i * 0.01) * 0.01;
        }
        particles.geometry.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
    }
}
