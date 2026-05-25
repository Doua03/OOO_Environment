import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ─── Configuration ─────────────────────────────────────────────────────────────
const CONFIG = {
  player: { speed: 8, height: 9 },
  portals: { interactionDistance: 12, transitionDuration: 1.0 },
  shadows: { mapSize: 512, bias: -0.001 },
};

// ─── Game State ────────────────────────────────────────────────────────────────
let isTransitioning = false;
let selectedCharacter = null;

// ─── Renderer ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a2a44, 0.008);

// ─── Camera / Player ──────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.rotation.order = "YXZ";

const player = {
  position: new THREE.Vector3(0, 3, 0),
  velocity: new THREE.Vector3(),
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  speed: CONFIG.player.speed,
};

camera.position.copy(player.position);

// ─── Mouse / WASD ─────────────────────────────────────────────────────────────
let mouseX = Math.PI,
  mouseY = 0;
const sensitivity = 0.003;

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== document.body) return;
  mouseX -= e.movementX * sensitivity;
  mouseY -= e.movementY * sensitivity;
  mouseY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseY));
});

document.addEventListener("click", () => document.body.requestPointerLock());

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === document.body;
  const method = locked ? "addEventListener" : "removeEventListener";
  document[method]("keydown", onKeyDown);
  document[method]("keyup", onKeyUp);
});

function onKeyDown(e) {
  if (e.code === "KeyW") player.moveForward = true;
  if (e.code === "KeyS") player.moveBackward = true;
  if (e.code === "KeyA") player.moveLeft = true;
  if (e.code === "KeyD") player.moveRight = true;
  if (e.code === "KeyE") window.interactPressed = true;
}

function onKeyUp(e) {
  if (e.code === "KeyW") player.moveForward = false;
  if (e.code === "KeyS") player.moveBackward = false;
  if (e.code === "KeyA") player.moveLeft = false;
  if (e.code === "KeyD") player.moveRight = false;
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
sun.shadow.mapSize.width = CONFIG.shadows.mapSize;
sun.shadow.mapSize.height = CONFIG.shadows.mapSize;
Object.assign(sun.shadow.camera, {
  near: 0.5,
  far: 200,
  left: -50,
  right: 50,
  top: 50,
  bottom: -50,
});
sun.shadow.bias = CONFIG.shadows.bias;
scene.add(sun);

// ─── Sky ──────────────────────────────────────────────────────────────────────
const skyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    sunsetColor: { value: new THREE.Color(0x442233) },
    zenithColor: { value: new THREE.Color(0x1a2a55) },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 sunsetColor;
    uniform vec3 zenithColor;
    varying vec3 vWorldPosition;

    void main() {
      vec3 ray = normalize(vWorldPosition);
      float height = (ray.y + 1.0) * 0.5;

      vec3 sky = mix(sunsetColor, zenithColor, smoothstep(0.0, 1.0, height));

      float clouds = smoothstep(0.4, 0.6, height) * (0.5 + 0.5 * sin(ray.x * 5.0 + time * 0.3));
      sky *= (1.0 - 0.4 * clouds);

      gl_FragColor = vec4(sky, 1.0);
    }
  `,
  side: THREE.BackSide,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMaterial));

// ─── Ambient Particles ────────────────────────────────────────────────────────
const particleCount = 300;
const particlePositions = new Float32Array(particleCount * 3);
const particleVelocities = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  const i3 = i * 3;
  particlePositions[i3] = (Math.random() - 0.5) * 200;
  particlePositions[i3 + 1] = (Math.random() - 0.5) * 100;
  particlePositions[i3 + 2] = (Math.random() - 0.5) * 200;

  particleVelocities[i3] = (Math.random() - 0.5) * 0.015;
  particleVelocities[i3 + 1] = Math.random() * 0.008;
  particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.015;
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute(
  "position",
  new THREE.BufferAttribute(particlePositions, 3),
);

const particles = new THREE.Points(
  particleGeo,
  new THREE.PointsMaterial({
    color: 0x6688bb,
    size: 0.3,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
  }),
);
scene.add(particles);

// ─── God Rays ─────────────────────────────────────────────────────────────────
const godRayMaterial = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    varying vec2 vUv;

    void main() {
      float dist = distance(vUv, vec2(0.5));
      float rays = sin(dist * 15.0 - time * 1.5) * 0.5 + 0.5;
      rays *= smoothstep(0.0, 0.4, 1.0 - dist);
      gl_FragColor = vec4(0.4, 0.2, 0.8, rays * 0.4);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
});

const godRayQuad = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  godRayMaterial,
);
godRayQuad.frustumCulled = false;
scene.add(godRayQuad);

// ─── Portal Characters ────────────────────────────────────────────────────────
const CHARACTER_PORTALS = [
  {
    name: "Kael",
    subtitle: "The Lonely",
    color: 0x88aacc,
    zone: "Hollow Forest",
    description:
      "A warrior lost to his own obsession, forever seeking perfection in the frozen wastes.",
  },
  {
    name: "Zara",
    subtitle: "The Free Spirit",
    color: 0xffaa44,
    zone: "Sunlit Meadow",
    description:
      "A wanderer who dances between worlds, leaving trails of colour and warmth wherever she roams.",
  },
];

// ─── Portal State ─────────────────────────────────────────────────────────────
const portals = [];
const portalParticlesMeshes = [];
const portalArchLights = [];

// ─── Portal Manager ───────────────────────────────────────────────────────────
class PortalManager {
  constructor() {
    this.entries = [];
    this._createPromptUI();
  }
  _createPromptUI() {
    this.prompt = document.createElement("div");
    this.prompt.style.cssText = `
      position: absolute; bottom: 100px; left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 18px;
      text-align: center;
      pointer-events: none;
      z-index: 1000;
      border: 2px solid rgba(255,255,255,0.3);
      backdrop-filter: blur(5px);
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(this.prompt);
  }
  _showPrompt(name) {
    this.prompt.textContent = `Press [E] to enter ${name}'s portal`;
    this.prompt.style.opacity = "1";
  }
  _hidePrompt() {
    this.prompt.style.opacity = "0";
  }
  add(portal, charData, worldPos, autoTrigger = false) {
    this.entries.push({
      mesh: portal,
      data: charData,
      position: worldPos.clone(),
      autoTrigger,
    });
  }
  update(playerPos) {
    if (isTransitioning) {
      this._hidePrompt();
      return null;
    }
    for (const entry of this.entries) {
      if (playerPos.distanceTo(entry.position) < CONFIG.portals.interactionDistance) {
        if (entry.autoTrigger) {
          this._hidePrompt();
          return entry;
        }
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
  isTransitioning = true;
  selectedCharacter = portalEntry.data;

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    background: black;
    z-index: 2000;
    pointer-events: none;
    opacity: 0;
    transition: opacity ${CONFIG.portals.transitionDuration}s ease;
  `;
  document.body.appendChild(overlay);

  setTimeout(() => (overlay.style.opacity = "1"), 10);

  setTimeout(() => {
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.remove();
      showCharacterIntroduction(selectedCharacter);
    }, 1000);
  }, CONFIG.portals.transitionDuration * 1000);
}

function showCharacterIntroduction(character) {
  const hex = new THREE.Color(character.color).getStyle();
  const introDiv = document.createElement("div");
  introDiv.style.cssText = `
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,40,0.95));
    color: white;
    padding: 30px 50px;
    border-radius: 20px;
    text-align: center;
    z-index: 2001;
    font-family: monospace;
    border: 2px solid ${hex};
    box-shadow: 0 0 50px rgba(0,0,0,0.5);
    backdrop-filter: blur(10px);
    min-width: 400px;
    animation: introSlideIn 0.5s ease;
  `;
  introDiv.innerHTML = `
    <style>
      @keyframes introSlideIn {
        from { opacity:0; transform:translate(-50%,-70%); }
        to { opacity:1; transform:translate(-50%,-50%); }
      }
      @keyframes introSlideOut {
        from { opacity:1; transform:translate(-50%,-50%); }
        to { opacity:0; transform:translate(-50%,-30%); }
      }
    </style>

    <h1 style="color:${hex}; margin-bottom:16px;">✦ ${character.name} ✦</h1>
    <h3 style="color:#aaa; margin-bottom:16px;">${character.subtitle} — ${character.zone}</h3>
    <p style="line-height:1.6; margin-bottom:20px;">${character.description}</p>
    <div style="font-size:13px; color:#888;">Press any key to enter the world…</div>
  `;
  document.body.appendChild(introDiv);

  const dismiss = () => {
    introDiv.style.animation = "introSlideOut 0.3s ease forwards";
    setTimeout(() => {
      introDiv.remove();
      if (character.subtitle === "The Lonely") loadLonelyWorld();
      else if (character.subtitle === "The Free Spirit") loadHippieWorld();
      else isTransitioning = false;
    }, 320);
    document.removeEventListener("keydown", dismiss);
  };

  document.addEventListener("keydown", dismiss);
  setTimeout(dismiss, 8000);
}

// ─── Lonely World ────────────────────────────────────────────────────────────
let lonelyActive = false;
let _proceduralMeshes = [];
let lonelyGLTFLoaded = false;
let lonelyEnvironmentModel = null;

const LONELY_SKY = 0x0a0d14;
const lonelyScene = new THREE.Scene();
lonelyScene.fog = new THREE.FogExp2(LONELY_SKY, 0.022);

const lonelyCamera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
lonelyCamera.rotation.order = "YXZ";

// ── Lighting LONELY  ─────────────────
lonelyScene.add(new THREE.AmbientLight(0x1b2638, 0.72));

const lonelyMoon = new THREE.DirectionalLight(0x7ea6e6, 1.45);
lonelyMoon.position.set(-8, 20, 12);
lonelyMoon.castShadow = true;
lonelyMoon.shadow.mapSize.width = 512;
lonelyMoon.shadow.mapSize.height = 512;
Object.assign(lonelyMoon.shadow.camera, {
  near: 1,
  far: 80,
  left: -25,
  right: 25,
  top: 25,
  bottom: -25,
});
lonelyMoon.shadow.bias = -0.0008;
lonelyScene.add(lonelyMoon);

const lonelyFillLight = new THREE.DirectionalLight(0x1a2a3a, 0.25);
lonelyFillLight.position.set(10, 15, -10);
lonelyScene.add(lonelyFillLight);

const lonelyMainLight = new THREE.PointLight(0xffe0b8, 13.5, 48);
lonelyMainLight.castShadow = false;
lonelyScene.add(lonelyMainLight);

const lonelyBackLight = new THREE.PointLight(0x2b4165, 1.6, 50);
lonelyBackLight.position.set(4, 4, -9);
lonelyScene.add(lonelyBackLight);

const lonelySkyFill = new THREE.HemisphereLight(0x2a426d, 0x0c1118, 0.55);

lonelyScene.add(lonelySkyFill);

let lonelyLightTime = 0;

// ── Star Dome ───────────────
let lonelySkyMaterial = null;

(function _initLonelySkyDome() {
  lonelySkyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      fogColor: { value: new THREE.Color(LONELY_SKY) },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
    uniform float time;
    uniform vec3 fogColor;
    varying vec3 vWorldDir;

    float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    // étoiles parfaitement circulaires
    float starLayer(vec3 dir, float density, float size) {

      vec2 uv = vec2(
        atan(dir.z, dir.x) / (2.0 * 3.14159265) + 0.5,
        asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265 + 0.5
      );

      vec2 grid = uv * density;

      vec2 cell = floor(grid);
      vec2 local = fract(grid) - 0.5;

      float rnd = hash(cell);

      // moins d’étoiles parasites
      float starMask = step(0.9965, rnd);

      // position aléatoire dans chaque cellule
      vec2 offset = vec2(
        hash(cell + 1.3),
        hash(cell + 2.7)
      ) - 0.5;

      local -= offset * 0.55;

      // DISTANCE CIRCULAIRE PURE
      float d = length(local);

      // bord doux
      float star = smoothstep(size, 0.0, d);

      // scintillement lent
      float twinkle =
        0.82 +
        sin(time * 1.4 + rnd * 50.0) * 0.18;

      return star * starMask * twinkle;
    }

    void main() {

      vec3 dir = normalize(vWorldDir);

      float height = clamp(dir.y, 0.0, 1.0);

      // ciel légèrement plus lumineux
      vec3 horizonColor = vec3(0.06, 0.08, 0.14);
      vec3 zenithColor  = vec3(0.015, 0.02, 0.04);

      vec3 sky = mix(
        horizonColor,
        zenithColor,
        smoothstep(0.0, 0.75, height)
      );

      // brouillard horizon
      float mist =
        smoothstep(0.22, 0.0, abs(dir.y)) * 0.55;

      sky = mix(
        sky,
        fogColor * 0.75,
        mist
      );

      // étoiles uniquement dans le ciel
      if (dir.y > 0.02) {

        float fadein =
          smoothstep(0.04, 0.22, dir.y);

        // plusieurs couches
        float s1 = starLayer(dir, 420.0, 0.045);
        float s2 = starLayer(dir, 700.0, 0.032) * 0.7;
        float s3 = starLayer(dir, 180.0, 0.060) * 1.2;

        float stars = (s1 + s2 + s3) * fadein;

        vec3 starTint = mix(
          vec3(0.78, 0.84, 1.0),
          vec3(1.0, 0.92, 0.82),
          hash(floor(dir.xz * 120.0))
        );

        sky += starTint * stars * 1.45;
      }

      // lune
      vec3 moonDir = normalize(vec3(-0.35, 0.82, 0.45));

      float moonDot = dot(dir, moonDir);

      float moonDisc =
        smoothstep(0.9986, 0.9998, moonDot);

      float halo1 =
        smoothstep(0.94, 0.9986, moonDot) * 0.22;

      float halo2 =
        smoothstep(0.78, 0.94, moonDot) * 0.08;

      sky += vec3(0.82, 0.88, 1.0) * moonDisc;
      sky += vec3(0.24, 0.34, 0.58) * halo1;
      sky += vec3(0.05, 0.08, 0.16) * halo2;

      gl_FragColor = vec4(sky, 1.0);
    }
  `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(490, 64, 32),
    lonelySkyMaterial,
  );
  lonelyScene.add(skyDome);
})();

// ── Lampadaires procéduraux  ─────────────────────────────
let _lonelyLampLights = [];
let lonelyMainLamp = null;

function _buildStreetLamp(x, z, isMain = false) {
  const group = new THREE.Group();

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a22,
    roughness: 0.65,
    metalness: 0.65,
  });

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 5.6, 12),
    metalMat,
  );
  pole.position.y = 2.8;
  pole.castShadow = true;
  group.add(pole);

  const arm1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.85, 10),
    metalMat,
  );
  arm1.rotation.z = Math.PI / 2.3;
  arm1.position.set(0.35, 5.35, 0);
  arm1.castShadow = true;
  group.add(arm1);

  const arm2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.65, 10),
    metalMat,
  );
  arm2.rotation.z = Math.PI / 2;
  arm2.position.set(0.75, 5.25, 0);
  arm2.castShadow = true;
  group.add(arm2);

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.22, 0.42),
    metalMat,
  );
  housing.position.set(1.05, 5.05, 0);
  housing.castShadow = true;
  group.add(housing);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.28, 0.15, 12),
    metalMat,
  );
  cap.position.set(1.05, 5.2, 0);
  cap.castShadow = true;
  group.add(cap);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfff0cc,
    emissive: new THREE.Color(0xffd8a0),
    emissiveIntensity: 2.8,
    roughness: 0.2,
    metalness: 0.0,
  });

  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 14, 14),
    glassMat,
  );
  glass.position.set(1.05, 4.88, 0);
  group.add(glass);

  const lampLight = new THREE.PointLight(0xffd8a0, 13.0, 45);
  lampLight.position.set(1.05, 4.9, 0);
  lampLight.castShadow = false;
  group.add(lampLight);

  _lonelyLampLights.push(lampLight);

  const halo = new THREE.PointLight(0x22334d, 0.9, 25);
  halo.position.set(1.05, 4.0, 0);
  group.add(halo);

  group.position.set(x, 0, z);
  lonelyScene.add(group);
  _proceduralMeshes.push(group);

  if (isMain) lonelyMainLamp = group;

  return group;
}

// ── Sol procédural ────────────────────────────────────────────────────────────
function _buildProceduralSidewalk(size = 32) {
  _clearProceduralMeshes();

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x101722,
    roughness: 0.95,
    metalness: 0.01,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  lonelyScene.add(ground);
  _proceduralMeshes.push(ground);
}

function _clearProceduralMeshes() {
  _lonelyLampLights = [];
  lonelyMainLamp = null;

  _proceduralMeshes.forEach((obj) => {
    lonelyScene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => m?.dispose());
  });

  _proceduralMeshes = [];
}

// ── Chargement du monde Lonely ─────────────────────────────────────────────
function loadLonelyWorld() {
  if (lonelyGLTFLoaded) return;
  lonelyGLTFLoaded = true;

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #0a0d14; z-index: 2000; pointer-events: none;
    opacity: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 18px;
    transition: opacity 0.9s ease;
  `;

  const loadMsg = document.createElement("div");
  loadMsg.style.cssText = `
    color: rgba(100, 140, 200, 0.75);
    font-family: monospace; font-size: 13px;
    letter-spacing: 5px; text-transform: uppercase; text-align: center;
  `;
  loadMsg.textContent = "entering the lonely...";

  const loadDots = document.createElement("div");
  loadDots.style.cssText = `
    color: rgba(70, 100, 150, 0.4);
    font-family: monospace; font-size: 9px;
    letter-spacing: 3px; text-transform: uppercase;
  `;
  loadDots.textContent = "loading world";

  let dotCount = 0;
  const dotInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    loadDots.textContent = "loading world" + ".".repeat(dotCount);
  }, 400);

  overlay.appendChild(loadMsg);
  overlay.appendChild(loadDots);
  document.body.appendChild(overlay);

  // ── Nettoyage scène principale ──────────────────────────────────────────────
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (m) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
  });
  while (scene.children.length > 0) scene.remove(scene.children[0]);

  _buildProceduralSidewalk(32);

  _buildStreetLamp(-2, 1, true);

  player.position.set(0, 1.6, 12);
  player.velocity.set(0, 0, 0);
  mouseX = 0;
  mouseY = -0.1;
  lonelyCamera.position.copy(player.position);

  lonelyActive = true;
  isTransitioning = false;

  const lonelyLoader = new GLTFLoader();
  lonelyLoader.load(
    "models/lonely/scene.gltf",
    (gltf) => {
      clearInterval(dotInterval);

      const env = gltf.scene;
      lonelyEnvironmentModel = env;

      env.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;

        const mats = Array.isArray(node.material)
          ? node.material
          : [node.material];

        mats.forEach((m) => {
          if (m) {
            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
            if (m.emissiveIntensity !== undefined) {
              m.emissiveIntensity = Math.min(m.emissiveIntensity, 0.25);
            }
          }
        });
      });

      env.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(env);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);

      const targetSize = 18;
      if (maxDim > 0) env.scale.setScalar(targetSize / maxDim);

      env.updateMatrixWorld(true);
      const newBox = new THREE.Box3().setFromObject(env);
      const centerX = (newBox.min.x + newBox.max.x) / 2;
      const centerZ = (newBox.min.z + newBox.max.z) / 2;

      env.position.set(-centerX, -newBox.min.y - 0.45, -centerZ);
      lonelyScene.add(env);

      env.updateMatrixWorld(true);
      const finalBox = new THREE.Box3().setFromObject(env);
      const modelSizeX = finalBox.max.x - finalBox.min.x;
      const modelSizeZ = finalBox.max.z - finalBox.min.z;

      const groundSize = Math.max(modelSizeX, modelSizeZ) + 14;
      _buildProceduralSidewalk(groundSize);

      // Lamp placement around
      const cx = (finalBox.min.x + finalBox.max.x) / 2;
      const cz = (finalBox.min.z + finalBox.max.z) / 2;
      const rx = modelSizeX * 0.55;
      const rz = modelSizeZ * 0.55;

      _buildStreetLamp(cx - rx, cz - rz);
      _buildStreetLamp(cx + rx, cz - rz);
      _buildStreetLamp(cx - rx, cz + rz);
      _buildStreetLamp(cx + rx, cz + rz);

      // Main lamp centered close to model
      _buildStreetLamp(cx - 2, cz + 1, true);

      const modelHeight = finalBox.max.y;
      const modelFrontZ = finalBox.max.z;
      const modelCenterX = (finalBox.min.x + finalBox.max.x) / 2;

      player.position.set(
        modelCenterX,
        Math.max(1.6, modelHeight * 0.18),
        modelFrontZ + 7,
      );

      player.velocity.set(0, 0, 0);
      mouseX = 0;
      mouseY = -0.1;
      lonelyCamera.position.copy(player.position);

      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 950);
    },
    undefined,
    (err) => {
      clearInterval(dotInterval);
      console.log("GLTF lonely non trouvé, monde procédural actif", err);

      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 950);
    },
  );
}

// ─── Hippie World ────────────────────────────────────────────────────────────
let hippieActive = false;
let hippieGLTFLoaded = false;
let hippieEnvironmentModel = null;
let hippieCharacterMixers = []; // AnimationMixers for the two dancers
let hippieDanceLights = [];     // coloured lights around the dance floor
let freeSpirit = false;         // true once the player chooses to join the dance
let hippieAudio = null;         // ambient music for the hippie world

const hippieScene = new THREE.Scene();
// no fog — clean open feel

const hippieCamera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
hippieCamera.rotation.order = "YXZ";

// ── Lighting HIPPIE ──────────────────────────────────────────────────────────
hippieScene.add(new THREE.AmbientLight(0xffffff, 1.1));

const hippieSun = new THREE.DirectionalLight(0xffffff, 1.4);
hippieSun.position.set(10, 30, 15);
hippieSun.castShadow = true;
hippieSun.shadow.mapSize.width = 512;
hippieSun.shadow.mapSize.height = 512;
Object.assign(hippieSun.shadow.camera, {
  near: 1, far: 120, left: -40, right: 40, top: 40, bottom: -40,
});
hippieSun.shadow.bias = -0.0008;
hippieScene.add(hippieSun);

const hippieFillLight = new THREE.DirectionalLight(0xffffff, 0.6);
hippieFillLight.position.set(-10, 15, -10);
hippieScene.add(hippieFillLight);

const hippieBackLight = new THREE.DirectionalLight(0xffffff, 0.4);
hippieBackLight.position.set(0, 10, -20);
hippieScene.add(hippieBackLight);

const hippieSkyFill = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.5);
hippieScene.add(hippieSkyFill);

let hippieLightTime = 0;

// ── Hippie Sky — bright psychedelic gradient ─────────────────────────────────
let hippieSkyMaterial = null;

(function _initHippieSkyDome() {
  hippieSkyMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vWorldDir;
      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);

        // vivid rainbow gradient cycling over time
        float t = time * 0.08;
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.00, 0.33, 0.67);
        vec3 zenith = a + b * cos(6.28318 * (c * (h + t) + d));

        // bright horizon
        vec3 horizon = vec3(1.0, 0.85, 0.4);
        vec3 sky = mix(horizon, zenith, smoothstep(0.0, 0.7, h));

        // subtle sun
        vec3 sunDir = normalize(vec3(0.45, 0.72, 0.52));
        float sunDot = dot(dir, sunDir);
        sky += vec3(1.0, 1.0, 0.8) * smoothstep(0.9992, 0.9999, sunDot);
        sky += vec3(1.0, 0.8, 0.3) * smoothstep(0.97, 0.9992, sunDot) * 0.25;

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  hippieScene.add(new THREE.Mesh(new THREE.SphereGeometry(490, 64, 32), hippieSkyMaterial));
})();

// ── Hippie floating orbs (coloured point lights + visible spheres) ────────────
const HIPPIE_ORB_COLORS = [0xff3399, 0x33ffcc, 0xffee00, 0xff6600, 0x9933ff, 0x00ccff];
const hippieOrbs = [];

(function _buildHippieOrbs() {
  HIPPIE_ORB_COLORS.forEach((col, i) => {
    const angle = (i / HIPPIE_ORB_COLORS.length) * Math.PI * 2;
    const radius = 10 + Math.random() * 6;
    const yBase = 3 + Math.random() * 6;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshStandardMaterial({
        color: col,
        emissive: new THREE.Color(col),
        emissiveIntensity: 2.5,
        roughness: 0.1,
        metalness: 0.0,
      }),
    );
    mesh.position.set(Math.cos(angle) * radius, yBase, Math.sin(angle) * radius);
    hippieScene.add(mesh);

    const light = new THREE.PointLight(col, 2.5, 18);
    mesh.add(light);

    hippieOrbs.push({ mesh, angle, radius, yBase, speed: 0.18 + Math.random() * 0.12 });
  });
})();

// ── Hippie ground plane ───────────────────────────────────────────────────────
const _hippieTexLoader = new THREE.TextureLoader();

function _loadTiled(path, repeat = 12) {
  const tex = _hippieTexLoader.load(path);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const hippieGround = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({
    map:          _loadTiled("grass/2K/Poliigon_GrassPatchyGround_4585_BaseColor.jpg"),
    normalMap:    (() => { const t = _hippieTexLoader.load("grass/2K/Poliigon_GrassPatchyGround_4585_Normal.png"); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12); return t; })(),
    roughnessMap: (() => { const t = _hippieTexLoader.load("grass/2K/Poliigon_GrassPatchyGround_4585_Roughness.jpg"); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12); return t; })(),
    aoMap:        (() => { const t = _hippieTexLoader.load("grass/2K/Poliigon_GrassPatchyGround_4585_AmbientOcclusion.jpg"); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12); return t; })(),
    roughness:    1.0,
    metalness:    0.0,
  }),
);
hippieGround.rotation.x = -Math.PI / 2;
hippieGround.position.y = -0.1;
hippieGround.receiveShadow = true;
hippieScene.add(hippieGround);

// ── Load Hippie World ────────────────────────────────────────────────────────
function loadHippieWorld() {
  if (hippieGLTFLoaded) return;
  hippieGLTFLoaded = true;

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #1a0d2e; z-index: 2000; pointer-events: none;
    opacity: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 18px;
    transition: opacity 0.9s ease;
  `;

  const loadMsg = document.createElement("div");
  loadMsg.style.cssText = `
    color: rgba(255, 170, 80, 0.9);
    font-family: monospace; font-size: 13px;
    letter-spacing: 5px; text-transform: uppercase; text-align: center;
  `;
  loadMsg.textContent = "entering the sunlit meadow...";

  const loadDots = document.createElement("div");
  loadDots.style.cssText = `
    color: rgba(200, 120, 60, 0.5);
    font-family: monospace; font-size: 9px;
    letter-spacing: 3px; text-transform: uppercase;
  `;
  loadDots.textContent = "loading world";

  let dotCount = 0;
  const dotInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    loadDots.textContent = "loading world" + ".".repeat(dotCount);
  }, 400);

  overlay.appendChild(loadMsg);
  overlay.appendChild(loadDots);
  document.body.appendChild(overlay);

  // clear main scene
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => { if (m) { if (m.map) m.map.dispose(); m.dispose(); } });
  });
  while (scene.children.length > 0) scene.remove(scene.children[0]);

  player.position.set(0, 1.6, 12);
  player.velocity.set(0, 0, 0);
  mouseX = 0;
  mouseY = -0.1;
  hippieCamera.position.copy(player.position);

  hippieActive = true;
  isTransitioning = false;

  // ── Start ambient music ────────────────────────────────────────────────────
  if (!hippieAudio) {
    hippieAudio = new Audio("sound/hippie.mp3");
    hippieAudio.loop = true;
    hippieAudio.volume = 0.5;
  }
  hippieAudio.currentTime = 0;
  hippieAudio.play().catch(() => {
    // autoplay blocked — retry on next user interaction
    const resume = () => { hippieAudio.play(); document.removeEventListener("click", resume); };
    document.addEventListener("click", resume);
  });

  const hippieLoader = new GLTFLoader();
  hippieLoader.load(
    "models/hippie/scene.gltf",
    (gltf) => {
      clearInterval(dotInterval);

      const env = gltf.scene;
      hippieEnvironmentModel = env;

      env.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          if (m) {
            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
            if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          }
        });
      });

      env.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(env);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);

      // bigger model
      const targetSize = 32;
      if (maxDim > 0) env.scale.setScalar(targetSize / maxDim);

      env.updateMatrixWorld(true);
      const newBox = new THREE.Box3().setFromObject(env);
      env.position.set(
        -((newBox.min.x + newBox.max.x) / 2),
        -newBox.min.y,
        -((newBox.min.z + newBox.max.z) / 2),
      );
      hippieScene.add(env);

      env.updateMatrixWorld(true);
      const finalBox = new THREE.Box3().setFromObject(env);
      const modelHeight = finalBox.max.y;
      const modelFrontZ = finalBox.max.z;
      const modelCenterX = (finalBox.min.x + finalBox.max.x) / 2;

      // position orbs relative to model size
      const orbRadius = Math.max(finalBox.max.x - finalBox.min.x, finalBox.max.z - finalBox.min.z) * 0.55;
      hippieOrbs.forEach((orb) => {
        orb.radius = orbRadius * (0.8 + Math.random() * 0.4);
        orb.cx = modelCenterX;
        orb.cz = (finalBox.min.z + finalBox.max.z) / 2;
      });

      player.position.set(
        modelCenterX,
        Math.max(1.6, modelHeight * 0.18),
        modelFrontZ + 7,
      );
      player.velocity.set(0, 0, 0);
      mouseX = 0;
      mouseY = -0.1;
      hippieCamera.position.copy(player.position);

      // ── Load dancing characters ─────────────────────────────────────────────
      const CHAR_SCALE = 0.032;

      function loadDancer(path, xOffset, zOffset, rotY) {
        const loader = new GLTFLoader();
        loader.load(
          path,
          (gltf) => {
            const character = gltf.scene;
            character.traverse((node) => {
              if (!node.isMesh) return;
              node.castShadow = true;
              node.receiveShadow = true;
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              mats.forEach((m) => {
                if (m?.map) m.map.colorSpace = THREE.SRGBColorSpace;
                if (m?.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
              });
            });

            character.scale.setScalar(CHAR_SCALE);
            character.position.set(
              modelCenterX + xOffset,
              0,
              (finalBox.min.z + finalBox.max.z) / 2 + zOffset,
            );
            character.rotation.y = rotY;
            hippieScene.add(character);

            if (gltf.animations && gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(character);
              const action = mixer.clipAction(gltf.animations[0]);
              action.reset();
              action.setLoop(THREE.LoopRepeat);
              action.play();
              hippieCharacterMixers.push(mixer);
            }
          },
          undefined,
          (err) => console.warn(`Dancer load failed (${path}):`, err),
        );
      }

      // man dancing — on the grass to the right, facing the camera
      loadDancer("models/man dancing/Silly Dancing.gltf",  10.0, 4.0, 0);
      // woman dancing — beside him, also facing the camera
      loadDancer("models/woman dancing/Dancing.gltf",       12.5, 4.0, 0);

      // ── Dance-floor ambiance lights ─────────────────────────────────────────
      // warm golden spotlight from above
      const danceSpot = new THREE.PointLight(0xffcc44, 4.0, 22);
      danceSpot.position.set(modelCenterX + 7.5, 8, (finalBox.min.z + finalBox.max.z) / 2 + 4.0);
      hippieScene.add(danceSpot);

      // pink rim from the left
      const pinkRim = new THREE.PointLight(0xff44aa, 2.5, 18);
      pinkRim.position.set(modelCenterX + 3.5, 4, (finalBox.min.z + finalBox.max.z) / 2 + 4.0);
      hippieScene.add(pinkRim);

      // cyan rim from the right
      const cyanRim = new THREE.PointLight(0x44ffee, 2.5, 18);
      cyanRim.position.set(modelCenterX + 11.5, 4, (finalBox.min.z + finalBox.max.z) / 2 + 4.0);
      hippieScene.add(cyanRim);

      // soft purple fill from behind the dancers
      const purpleFill = new THREE.PointLight(0xaa44ff, 1.8, 20);
      purpleFill.position.set(modelCenterX + 7.5, 3, (finalBox.min.z + finalBox.max.z) / 2 + 1.0);
      hippieScene.add(purpleFill);

      // store for pulsing in animate loop
      hippieDanceLights = [
        { light: danceSpot,  base: 4.0,  freq: 1.8, amp: 0.8 },
        { light: pinkRim,    base: 2.5,  freq: 2.3, amp: 0.6 },
        { light: cyanRim,    base: 2.5,  freq: 1.5, amp: 0.6 },
        { light: purpleFill, base: 1.8,  freq: 2.8, amp: 0.5 },
      ];

      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.remove();
        _showFreeSpritButton();
      }, 950);
    },
    undefined,
    (err) => {
      clearInterval(dotInterval);
      console.log("GLTF hippie not found", err);
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.remove();
        _showFreeSpritButton();
      }, 950);
    },
  );
}

// ── Free Spirit button & popup ────────────────────────────────────────────────
let _freeSpiritBtn = null;

function _showFreeSpritButton() {
  if (_freeSpiritBtn) return;

  _freeSpiritBtn = document.createElement("button");
  _freeSpiritBtn.textContent = "✦ Are you a Free Spirit? ✦";
  _freeSpiritBtn.style.cssText = `
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.65);
    color: #ffdd88;
    border: 2px solid #ffaa44;
    padding: 12px 28px;
    border-radius: 30px;
    font-family: monospace;
    font-size: 15px;
    letter-spacing: 2px;
    cursor: pointer;
    z-index: 500;
    backdrop-filter: blur(6px);
    transition: background 0.2s, transform 0.2s;
    animation: btnPulse 2s ease-in-out infinite;
  `;

  // inject keyframe animation
  if (!document.getElementById("_freeSpiritStyle")) {
    const style = document.createElement("style");
    style.id = "_freeSpiritStyle";
    style.textContent = `
      @keyframes btnPulse {
        0%, 100% { box-shadow: 0 0 10px #ffaa44; }
        50%       { box-shadow: 0 0 28px #ff44aa, 0 0 50px #ffaa44; }
      }
      @keyframes popIn {
        from { opacity:0; transform:translate(-50%,-60%); }
        to   { opacity:1; transform:translate(-50%,-50%); }
      }
      @keyframes popOut {
        from { opacity:1; transform:translate(-50%,-50%); }
        to   { opacity:0; transform:translate(-50%,-40%); }
      }
    `;
    document.head.appendChild(style);
  }

  _freeSpiritBtn.addEventListener("mouseenter", () => {
    _freeSpiritBtn.style.background = "rgba(255,170,68,0.25)";
  });
  _freeSpiritBtn.addEventListener("mouseleave", () => {
    _freeSpiritBtn.style.background = "rgba(0,0,0,0.65)";
  });

  _freeSpiritBtn.addEventListener("click", () => {
    // release pointer lock so the user can click the modal buttons
    document.exitPointerLock();
    _freeSpiritBtn.remove();
    _freeSpiritBtn = null;
    _showFreeSpritPopup();
  });

  document.body.appendChild(_freeSpiritBtn);
}

function _showFreeSpritPopup() {
  const popup = document.createElement("div");
  popup.style.cssText = `
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, rgba(10,5,20,0.95), rgba(30,15,50,0.97));
    border: 2px solid #ffaa44;
    border-radius: 20px;
    padding: 40px 55px;
    text-align: center;
    z-index: 3000;
    font-family: monospace;
    color: white;
    min-width: 360px;
    box-shadow: 0 0 60px rgba(255,170,68,0.35), 0 0 120px rgba(255,68,170,0.2);
    backdrop-filter: blur(12px);
    animation: popIn 0.4s ease forwards;
  `;

  popup.innerHTML = `
    <div style="font-size:32px; margin-bottom:12px;">🌸</div>
    <h2 style="color:#ffdd88; margin:0 0 10px; font-size:20px; letter-spacing:2px;">
      Do you want to be a Free Spirit?
    </h2>
    <p style="color:#aaa; font-size:13px; margin-bottom:28px; line-height:1.6;">
      Let go of everything and dance under the open sky…
    </p>
    <div style="display:flex; gap:16px; justify-content:center;">
      <button id="_fsYes" style="
        background: linear-gradient(135deg, #ff9933, #ff44aa);
        color: white; border: none; padding: 12px 32px;
        border-radius: 25px; font-family: monospace; font-size: 15px;
        cursor: pointer; letter-spacing: 1px;
        box-shadow: 0 0 20px rgba(255,100,50,0.5);
        transition: transform 0.15s;
      ">Yes ✦</button>
      <button id="_fsNo" style="
        background: rgba(255,255,255,0.08);
        color: #aaa; border: 2px solid #555; padding: 12px 32px;
        border-radius: 25px; font-family: monospace; font-size: 15px;
        cursor: pointer; letter-spacing: 1px;
        transition: transform 0.15s;
      ">No</button>
    </div>
  `;

  document.body.appendChild(popup);

  popup.querySelector("#_fsYes").addEventListener("click", () => {
    popup.style.animation = "popOut 0.3s ease forwards";
    setTimeout(() => {
      popup.remove();
      _onFreeSpritYes();
    }, 320);
  });

  popup.querySelector("#_fsNo").addEventListener("click", () => {
    popup.style.animation = "popOut 0.3s ease forwards";
    setTimeout(() => {
      popup.remove();
      _onFreeSpritNo();
    }, 320);
  });
}

function _onFreeSpritYes() {
  freeSpirit = true;

  // boost music
  if (hippieAudio) hippieAudio.volume = 0.9;

  // disable player movement — camera is now on autopilot
  player.moveForward = player.moveBackward = player.moveLeft = player.moveRight = false;

  // show a brief message
  const msg = document.createElement("div");
  msg.style.cssText = `
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: #ffdd88; font-family: monospace; font-size: 22px;
    letter-spacing: 3px; text-align: center;
    pointer-events: none; z-index: 2500;
    text-shadow: 0 0 20px #ff44aa, 0 0 40px #ffaa44;
    animation: popIn 0.4s ease forwards;
  `;
  msg.textContent = "✦ You are free ✦";
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 2500);
}

function _onFreeSpritNo() {
  // fade to black and return to main hub
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; top:0; left:0; width:100%; height:100%;
    background: black; z-index: 3000; pointer-events: none;
    opacity: 0; transition: opacity 0.8s ease;
  `;
  document.body.appendChild(overlay);

  setTimeout(() => (overlay.style.opacity = "1"), 10);

  setTimeout(() => {
    // stop music
    if (hippieAudio) { hippieAudio.pause(); hippieAudio.currentTime = 0; }

    // reset state — reload the page to return cleanly to the hub
    window.location.reload();
  }, 900);
}

// ─── Mesh Helpers ─────────────────────────────────────────────────────────────
function setupMesh(node) {
  if (!node.isMesh) return;
  node.castShadow = true;
  node.receiveShadow = true;
  const mats = Array.isArray(node.material) ? node.material : [node.material];
  mats.forEach((m) => {
    if (m?.map) m.map.colorSpace = THREE.SRGBColorSpace;
  });
}

function setupPortalMesh(node, color) {
  if (!node.isMesh) return;
  node.castShadow = true;
  node.receiveShadow = true;
  const parentName = node.parent?.name || "";
  const mats = Array.isArray(node.material) ? node.material : [node.material];
  mats.forEach((m) => {
    if (m?.map) m.map.colorSpace = THREE.SRGBColorSpace;
    if (parentName.includes("Icosphere")) {
      m.emissive = new THREE.Color(0x000000);
      m.emissiveIntensity = 0;
    } else if (parentName.includes("Cube")) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = 0.15;
    } else {
      m.emissive = new THREE.Color(0x000000);
      m.emissiveIntensity = 0;
    }
  });
}

// ─── Portal Factory ───────────────────────────────────────────────────────────
async function createPortal(charData, x, z, envFloorY, autoTrigger = false) {
  const gltfLoader = new GLTFLoader();
  const portalGltf = await gltfLoader.loadAsync("models/portal/scene.gltf");
  const portal = portalGltf.scene;

  portal.traverse((node) => setupPortalMesh(node, charData.color));
  portal.scale.setScalar(18);
  portal.updateMatrixWorld(true);

  const portalBox = new THREE.Box3().setFromObject(portal);
  portal.position.set(x, envFloorY - portalBox.min.y + 4.3, z);
  portal.rotation.y = Math.PI;

  scene.add(portal);
  portals.push(portal);
  portalManager.add(portal, charData, portal.position, autoTrigger);

  const light1 = new THREE.PointLight(charData.color, 1.5, 20);
  light1.position.set(0, 0.6, 0.05);
  portal.add(light1);

  const light2 = new THREE.PointLight(0xaaddff, 0.8, 18);
  light2.position.set(0, 0.85, 0);
  portal.add(light2);

  portalArchLights.push([light1, light2]);

  const pParticles = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(
      Array(150)
        .fill(0)
        .map(() => {
          const p = new THREE.Vector3();
          p.setFromSphericalCoords(
            2 + Math.random() * 3,
            Math.random() * Math.PI,
            Math.random() * Math.PI * 2,
          );
          return p;
        }),
    ),
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    }),
  );

  portal.add(pParticles);
  portalParticlesMeshes.push(pParticles);

  const labelWorldPos = portal.position
    .clone()
    .add(new THREE.Vector3(0, 12, 0));
  const label = document.createElement("div");

  label.innerHTML = `<strong>${charData.name}</strong><br><span style="font-size:10px;opacity:0.7;">${charData.subtitle}</span>`;
  label.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: 100;
    color: #${new THREE.Color(charData.color).getHexString()};
    font-family: monospace;
    font-size: 12px;
    text-align: center;
    background: rgba(0,0,0,0.5);
    padding: 3px 8px;
    border-radius: 4px;
    white-space: nowrap;
    transform: translate(-50%, -50%);
    border-left: 2px solid #${new THREE.Color(charData.color).getHexString()};
  `;
  document.body.appendChild(label);

  (function updateLabel() {
    if (!label.parentNode) return;
    if (lonelyActive || hippieActive) {
      label.style.display = "none";
      requestAnimationFrame(updateLabel);
      return;
    }
    const sp = labelWorldPos.clone().project(camera);
    if (sp.z < 1) {
      label.style.display = "block";
      label.style.left = `${(sp.x * 0.5 + 0.5) * window.innerWidth}px`;
      label.style.top = `${(-sp.y * 0.5 + 0.5) * window.innerHeight}px`;
    } else label.style.display = "none";
    requestAnimationFrame(updateLabel);
  })();

  return portal;
}

// ─── Loading ───────────────────────────────────────────────────────────────────
const loadingEl = document.getElementById("loading");
const loadingText = document.getElementById("loading-text");
const loadingBar = document.getElementById("loading-bar");
const loader = new GLTFLoader();
let wakeUpLookTime = 0; // >0 = confused look animation active
function hideLoader() {
  if (!loadingEl) return;
  loadingEl.style.transition = "opacity 0.6s ease";
  loadingEl.style.opacity = "0";
  setTimeout(() => loadingEl?.remove(), 650);
}

loader.load(
  "models/environment/scene.gltf",
  async (gltf) => {
    const env = gltf.scene;
    env.traverse(setupMesh);
    scene.add(env);

    env.updateMatrixWorld(true);
    const envBox = new THREE.Box3().setFromObject(env);
    const envFloorY = envBox.min.y;
    const envCenter = envBox.getCenter(new THREE.Vector3());
    const portalZ = envBox.max.z + 14;
    const envWidth = envBox.max.x - envBox.min.x;
    const spacing = envWidth / (CHARACTER_PORTALS.length + 1);
    const startX = envBox.min.x + spacing;

    player.position.set(
      envCenter.x - 5,
      envFloorY + CONFIG.player.height,
      envCenter.z,
    );
    camera.position.copy(player.position);
    mouseX = Math.PI;

    if (loadingBar) loadingBar.style.width = "20%";

    for (let i = 0; i < CHARACTER_PORTALS.length; i++) {
      if (loadingText)
        loadingText.textContent = `Conjuring portal ${i + 1} of ${CHARACTER_PORTALS.length}…`;

      await createPortal(
        CHARACTER_PORTALS[i],
        startX + i * spacing,
        portalZ,
        envFloorY,
        i === 1, // hippie portal auto-triggers on proximity
      );

      if (loadingBar)
        loadingBar.style.width = `${20 + ((i + 1) / CHARACTER_PORTALS.length) * 80}%`;
    }

    if (loadingBar) loadingBar.style.width = "100%";
    if (loadingText) loadingText.textContent = "Welcome to the Nexus!";
    setTimeout(() => {
      hideLoader();
      startWakeUpSequence();
    }, 600);
    animate();
  },
  (xhr) => {
    if (xhr.lengthComputable && loadingBar)
      loadingBar.style.width = (xhr.loaded / xhr.total) * 20 + "%";
  },
  (err) => {
    console.error("Environment load error:", err);
    hideLoader();
    animate();
  },
);
function startWakeUpSequence() {
  // ── breathing sound ──────────────────────────────────────────────────────
 let breathAudio = null;
  let soundStarted = false;
  
  function playBreathingSound() {
    if (soundStarted) return;
    soundStarted = true;
    
    breathAudio = new Audio("sound/breathing.mp3");
    breathAudio.volume = 0.85;
    breathAudio.play().then(() => {
      // Fade out and stop after 4 seconds
      setTimeout(() => {
        const fadeDuration = 1500;
        const steps = 30;
        const stepTime = fadeDuration / steps;
        const startVol = breathAudio.volume;
        let step = 0;
        const fadeInterval = setInterval(() => {
          step++;
          breathAudio.volume = Math.max(0, startVol * (1 - step / steps));
          if (step >= steps) {
            clearInterval(fadeInterval);
            breathAudio.pause();
            breathAudio.currentTime = 0;
          }
        }, stepTime);
      }, 4000);
    }).catch(() => {
      // Retry on next user interaction
      soundStarted = false;
    });
    
    // Clean up listeners after playing
    document.removeEventListener("click", playBreathingSound);
    document.removeEventListener("keydown", playBreathingSound);
  }
  
  // Wait for user interaction before playing
  document.addEventListener("click", playBreathingSound);
  document.addEventListener("keydown", playBreathingSound);
  // ── full-screen vignette overlay ─────────────────────────────────────────
  const vignette = document.createElement("div");
  vignette.id = "_wakeVignette";
  vignette.style.cssText = `
    position: fixed; top:0; left:0; width:100%; height:100%;
    pointer-events: none; z-index: 900;
    background: radial-gradient(ellipse at center,
      rgba(0,0,0,0) 30%,
      rgba(0,0,0,0.92) 100%);
    filter: blur(6px);
    opacity: 1;
    transition: opacity 3.5s ease, filter 3.5s ease;
  `;
  document.body.appendChild(vignette);

  // ── dark tint that fades away ─────────────────────────────────────────────
  const tint = document.createElement("div");
  tint.id = "_wakeTint";
  tint.style.cssText = `
    position: fixed; top:0; left:0; width:100%; height:100%;
    pointer-events: none; z-index: 899;
    background: black;
    opacity: 0.85;
    transition: opacity 4.0s ease;
  `;
  document.body.appendChild(tint);

  // start clearing after a short pause (feels like eyes opening slowly)
  setTimeout(() => {
    tint.style.opacity    = "0";
    vignette.style.opacity = "0";
    vignette.style.filter  = "blur(0px)";
  }, 800);
// ── confused look left/right after fade ──────────────────────────────────
setTimeout(() => {
  wakeUpLookTime = 1.0; // triggers the animation in the animate loop
}, 800);
  // remove DOM elements after transition completes
  setTimeout(() => {
    tint.remove();
    vignette.remove();
  }, 5000);
}
// ─── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  lonelyCamera.aspect = window.innerWidth / window.innerHeight;
  lonelyCamera.updateProjectionMatrix();
  hippieCamera.aspect = window.innerWidth / window.innerHeight;
  hippieCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Animation ────────────────────────────────────────────────────────────────
const _animFront = new THREE.Vector3();
const _animSide = new THREE.Vector3();
const _animDir = new THREE.Vector3();

let lastTime = performance.now();
let time = 0;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  let dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  if (dt < 0.001) dt = 0.016;

  time += dt;
  lonelyLightTime += dt;
  hippieLightTime += dt;

  // advance dancer animation mixers
  hippieCharacterMixers.forEach((m) => m.update(dt));

  if (!isTransitioning) {
    _animFront
      .set(0, 0, -1)
      .applyQuaternion(
        lonelyActive
          ? lonelyCamera.quaternion
          : hippieActive
            ? hippieCamera.quaternion
            : camera.quaternion,
      );

    _animSide
      .set(-1, 0, 0)
      .applyQuaternion(
        lonelyActive
          ? lonelyCamera.quaternion
          : hippieActive
            ? hippieCamera.quaternion
            : camera.quaternion,
      );

    _animDir.set(0, 0, 0);

    if (player.moveForward) _animDir.add(_animFront);
    if (player.moveBackward) _animDir.sub(_animFront);
    if (player.moveLeft) _animDir.add(_animSide);
    if (player.moveRight) _animDir.sub(_animSide);

    if (_animDir.length() > 0.01)
      player.velocity.copy(
        _animDir.normalize().multiplyScalar(player.speed * dt),
      );
    else player.velocity.multiplyScalar(0.85);

    player.position.add(player.velocity);

    if (lonelyActive) {
      lonelyCamera.position.copy(player.position);
      lonelyCamera.rotation.order = "YXZ";
      lonelyCamera.rotation.y = mouseX;
      lonelyCamera.rotation.x = mouseY;

      if (lonelyMainLamp) {
        const worldPos = new THREE.Vector3();
        lonelyMainLamp.getWorldPosition(worldPos);
        lonelyMainLight.position.set(worldPos.x + 1.05, 4.9, worldPos.z);
      }

      const flicker =
        Math.sin(lonelyLightTime * 1.4) * 0.25 +
        Math.sin(lonelyLightTime * 3.2) * 0.12 +
        Math.sin(lonelyLightTime * 6.7) * 0.06;

      lonelyMainLight.intensity = 11.5 + flicker * 1.8;
      lonelyBackLight.intensity = 1.6 + Math.sin(lonelyLightTime * 0.3) * 0.25;

      _lonelyLampLights.forEach((l, i) => {
        const f =
          Math.sin(lonelyLightTime * (1.2 + i * 0.25) + i * 1.1) * 0.18 +
          Math.sin(lonelyLightTime * (2.8 + i * 0.35)) * 0.09;

        l.intensity = 13.0 + f * 1.5;
      });

      if (lonelySkyMaterial) lonelySkyMaterial.uniforms.time.value = time;

      renderer.toneMappingExposure = 1.42;
      renderer.render(lonelyScene, lonelyCamera);
    } else if (hippieActive) {
      if (freeSpirit) {
        // ── Free Spirit autopilot ──────────────────────────────────────────
        // Target: hover in front of the dancers (man at modelCenterX+6, woman at +8.5)
        const danceTargetX = (hippieOrbs[0]?.cx || 0) + 12.0;
        const danceTargetZ = (hippieOrbs[0]?.cz || 0) + 10.0; // a bit in front
        const danceTargetY = 4.8;

        // smoothly glide toward the dance spot
        player.position.x += (danceTargetX - player.position.x) * dt * 0.8;
        player.position.y += (danceTargetY - player.position.y) * dt * 0.8;
        player.position.z += (danceTargetZ - player.position.z) * dt * 0.8;

        // sway left/right and bob up/down like dancing
        const sway  = Math.sin(time * 1.6) * 1.2;
        const bob   = Math.sin(time * 3.2) * 0.18;
        const tilt  = Math.sin(time * 1.1) * 0.08;

        hippieCamera.position.set(
          player.position.x + sway,
          player.position.y + bob,
          player.position.z,
        );
        hippieCamera.rotation.order = "YXZ";
        // slowly pan left/right and tilt
        hippieCamera.rotation.y = Math.sin(time * 0.55) * 0.45;
        hippieCamera.rotation.x = -0.08 + tilt;
        hippieCamera.rotation.z = Math.sin(time * 0.9) * 0.06;
      } else {
        // normal first-person
        hippieCamera.position.copy(player.position);
        hippieCamera.rotation.order = "YXZ";
        hippieCamera.rotation.y = mouseX;
        hippieCamera.rotation.x = mouseY;
      }

      // animate floating orbs
      hippieOrbs.forEach((orb) => {
        orb.angle += orb.speed * dt;
        const cx = orb.cx || 0;
        const cz = orb.cz || 0;
        orb.mesh.position.set(
          cx + Math.cos(orb.angle) * orb.radius,
          orb.yBase + Math.sin(orb.angle * 1.3) * 1.5,
          cz + Math.sin(orb.angle) * orb.radius,
        );
      });

      // animate rainbow particles removed

      if (hippieSkyMaterial) hippieSkyMaterial.uniforms.time.value = time;

      // pulse dance-floor lights
      hippieDanceLights.forEach((entry) => {
        entry.light.intensity = entry.base + Math.sin(hippieLightTime * entry.freq) * entry.amp;
      });

      // ticked above each frame; nothing additional needed here

      renderer.toneMappingExposure = 1.0;
      renderer.render(hippieScene, hippieCamera);
    } else {
      camera.position.copy(player.position);
camera.rotation.order = "YXZ";
if (wakeUpLookTime > 0) {
  wakeUpLookTime = Math.max(0, wakeUpLookTime - dt * 0.165);

  // use running `time` for oscillation so it starts swinging immediately
  const sway =
    Math.sin(time * 1.8) * 0.38 * wakeUpLookTime +
    Math.sin(time * 0.9 + 1.2) * 0.22 * wakeUpLookTime +
    Math.sin(time * 3.1) * 0.07 * wakeUpLookTime;

  const nod =
    Math.sin(time * 1.3 + 0.5) * 0.07 * wakeUpLookTime;

  camera.rotation.y = mouseX + sway;
  camera.rotation.x = mouseY + nod;
} else {
  camera.rotation.y = mouseX;
  camera.rotation.x = mouseY;
}
camera.rotation.z = 0;

      const activated = portalManager.update(player.position);
      if (activated && !lonelyActive && !hippieActive) startTransition(activated);

      renderer.toneMappingExposure = 1.0;

      if (skyMaterial && skyMaterial.uniforms)
        skyMaterial.uniforms.time.value = time * 0.15;

      if (godRayMaterial && godRayMaterial.uniforms)
        godRayMaterial.uniforms.time.value = time;

      centralLight.intensity = 1.8 + Math.sin(time * 1.2) * 0.3;

      portalParticlesMeshes.forEach((pp) => {
        pp.rotation.y += dt * 0.5;
      });

      portalArchLights.forEach((lights) => {
        lights.forEach((light) => {
          const base = light.userData.baseIntensity || light.intensity;
          light.userData.baseIntensity = base;
          light.intensity = base * (0.85 + 0.1 * Math.sin(time * 1.2));
        });
      });

      const pos = particles.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        pos[i3] += particleVelocities[i3] * dt;
        pos[i3 + 1] += particleVelocities[i3 + 1] * dt;
        pos[i3 + 2] += particleVelocities[i3 + 2] * dt;

        if (Math.abs(pos[i3]) > 100) particleVelocities[i3] *= -0.9;
        if (Math.abs(pos[i3 + 1]) > 50) particleVelocities[i3 + 1] *= -0.9;
        if (Math.abs(pos[i3 + 2]) > 100) particleVelocities[i3 + 2] *= -0.9;
      }

      particles.geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    }
  }
}
