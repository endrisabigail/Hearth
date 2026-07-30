import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  AVATAR_CONFIG,
  AGENT_TARGET_HEIGHT,
  AGENT_FOLLOW_DISTANCE,
  AGENT_FOLLOW_LERP,
  AGENT_HOVER_HEIGHT,
  agentModelFor,
  buildAvatarPivot,
  buildAgentPivot,
  disposePivot,
  buildMessageBubbleTexture,
  buildGlowTexture,
  seededRandom,
} from "./plazaCanvas.jsx";

// palette 
const PALETTE = {
  deep: 0x14591d,
  moss: 0x99aa38,
  reed: 0xe1e289,
  sky: 0xacd2ed,
};

const TRAVEL_SPEED = 0.002;
const ARRIVAL_THRESHOLD = 0.018;

// world layout
const FROG_WORLD_MIN = -21;
const FROG_WORLD_MAX = 21;
const FROG_WORLD_SIZE = FROG_WORLD_MAX - FROG_WORLD_MIN; // 42
const FROG_WORLD_CENTER = (FROG_WORLD_MIN + FROG_WORLD_MAX) / 2; // 0

const HEX_RADIUS = 19.8; // outer misty edge of the pond
const FIELD_RADIUS = 15.75; // where lily pads / cattails may be scattered
const SPAWN_CLEAR_RADIUS = 3.75; // kept free so the character never spawns on an obstacle

const CATTAIL_RING_MIN = 16.6;
const CATTAIL_RING_MAX = 19.1;
const CATTAIL_RING_COUNT = 28;

// large lily pads ("trees")
const LILY_TREE_COUNT = 50;
const MIN_LILY_SPACING = 2.4;
const LILY_RADIUS_MIN = 0.85;
const LILY_RADIUS_MAX = 1.6;

// cattail clumps ("bushes")
const CATTAIL_BUSH_COUNT = 75;
const MIN_CATTAIL_BUSH_SPACING = 1.2;
const CATTAIL_BUSH_HEIGHT_MIN = 1.0;
const CATTAIL_BUSH_HEIGHT_MAX = 1.8;

const FIREFLY_COUNT = 16;
const DRAGONFLY_COUNT = 6;

function frogNormToWorld(n) {
  return FROG_WORLD_MIN + n * FROG_WORLD_SIZE;
}
function frogWorldToNorm(w) {
  return (w - FROG_WORLD_MIN) / FROG_WORLD_SIZE;
}

const EDGE_PAD = 1.2 / FROG_WORLD_SIZE;
const FROG_MOVEMENT_BOUNDS = {
  minX: EDGE_PAD,
  maxX: 1 - EDGE_PAD,
  minY: EDGE_PAD,
  maxY: 1 - EDGE_PAD,
};

// geometry 
function hexBoundaryRadius(theta, R) {
  const apothem = R * Math.cos(Math.PI / 6);
  let a = theta % (Math.PI / 3);
  if (a < 0) a += Math.PI / 3;
  a -= Math.PI / 6;
  return apothem / Math.cos(a);
}

// hexagon
function buildHexShape(radius, irregularity, rand) {
  const shape = new THREE.Shape();
  const segs = 6;
  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2 - Math.PI / 2;
    const r = radius * (1 + (rand() - 0.5) * irregularity);
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

function tooCloseTo(list, x, z, minDist) {
  for (const p of list) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  return false;
}

function inClearing(x, z) {
  return x * x + z * z < SPAWN_CLEAR_RADIUS * SPAWN_CLEAR_RADIUS;
}

// textures
function buildFrogSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#9fd6e8");
  grad.addColorStop(0.4, "#acd2ed");
  grad.addColorStop(0.72, "#d8dea0");
  grad.addColorStop(1, "#e1e289");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 256);
  return new THREE.CanvasTexture(canvas);
}

function buildDragonflyTexture(hue) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 64, 64);
  ctx.translate(32, 32);

  ctx.strokeStyle = `hsla(${hue}, 60%, 78%, 0.75)`;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(-13, -4, 13, 5, -0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(13, -4, 13, 5, 0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-11, 6, 12, 4.5, 0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(11, 6, 12, 4.5, -0.15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = `hsl(${hue}, 55%, 40%)`;
  ctx.fillRect(-1.6, -18, 3.2, 34);
  ctx.beginPath();
  ctx.arc(0, -19, 3, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// fallback flora 
function buildFallbackLilyPad(rand) {
  const group = new THREE.Group();
  // slight per-pad variation around PALETTE.moss so they're not all identical
  const mossColor = new THREE.Color(PALETTE.moss);
  const padColor = mossColor.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.12 - 0.08);
  const padMat = new THREE.MeshLambertMaterial({ color: padColor });
  const notch = rand() * 0.5 + 0.15;
  const shape = new THREE.Shape();
  const segs = 28;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2 * (1 - 0.06) + notch;
    if (i === 0) shape.moveTo(Math.cos(a), Math.sin(a));
    else shape.lineTo(Math.cos(a), Math.sin(a));
  }
  shape.lineTo(0, 0);
  const pad = new THREE.Mesh(new THREE.ShapeGeometry(shape), padMat);
  pad.rotation.x = -Math.PI / 2;
  group.add(pad);
  // occasional small lotus-style bloom
  if (rand() > 0.6) {
    const bloomMat = new THREE.MeshLambertMaterial({
      color: rand() > 0.5 ? 0xf6c9d8 : PALETTE.reed,
    });
    for (let i = 0; i < 5; i++) {
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 6), bloomMat);
      const a = (i / 5) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.08, 0.15, Math.sin(a) * 0.08);
      petal.rotation.x = Math.PI;
      group.add(petal);
    }
  }
  return group;
}

function buildFallbackCattail(rand) {
  const group = new THREE.Group();
  const stalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.moss });
  const headMat = new THREE.MeshLambertMaterial({ color: PALETTE.deep });
  const bladeCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < bladeCount; i++) {
    const h = 0.85 + rand() * 0.3;
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, h, 5), stalkMat);
    blade.position.set((rand() - 0.5) * 0.12, h / 2, (rand() - 0.5) * 0.12);
    blade.rotation.z = (rand() - 0.5) * 0.25;
    group.add(blade);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8), headMat);
    head.position.set(blade.position.x, h - 0.05, blade.position.z);
    group.add(head);
    const headCap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), headMat);
    headCap.position.set(blade.position.x, h + 0.06, blade.position.z);
    group.add(headCap);
  }
  return group;
}

//component
function FrogLandCanvas({
  avatarId,
  posRef,
  keysRef,
  collisionBoxesRef,
  onSceneReady,
  hasActiveQuest,
  travelTargetRef,
  onArrived,
  otherPlayersRef,
  playersVersion,
  messageAlertsRef,
  onAgentScreenPositionChange,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const modelRef = useRef(null);
  const loaderRef = useRef(new GLTFLoader());
  const frameRef = useRef(null);
  const otherModelsRef = useRef(new Map());
  const floatTRef = useRef(0);
  const hopTRef = useRef(0);
  const idleTimeRef = useRef(0);
  const hasActiveQuestRef = useRef(false);
  const onArrivedRef = useRef(onArrived);

  const agentRef = useRef(null);
  const agentFloatTRef = useRef(Math.random() * Math.PI * 2);
  const onAgentScreenPositionChangeRef = useRef(onAgentScreenPositionChange);

  // sound
  const bgMusicRef = useRef(null);
  const waterSoundRef = useRef(null);
  const wasMovingRef = useRef(false);

  useEffect(() => {
    hasActiveQuestRef.current = hasActiveQuest;
  }, [hasActiveQuest]);
  useEffect(() => {
    onArrivedRef.current = onArrived;
  }, [onArrived]);
  useEffect(() => {
    onAgentScreenPositionChangeRef.current = onAgentScreenPositionChange;
  }, [onAgentScreenPositionChange]);

  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    const skyTex = buildFrogSkyTexture();
    scene.background = skyTex;
    scene.fog = new THREE.Fog(0x9fc3ce, FROG_WORLD_SIZE * 0.42, FROG_WORLD_SIZE * 0.82);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(FROG_WORLD_CENTER, 12, FROG_WORLD_CENTER + 10);
    camera.lookAt(FROG_WORLD_CENTER, 0, FROG_WORLD_CENTER);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    //lights
    scene.add(new THREE.HemisphereLight(0xbfe3f2, 0x3f6b3a, 0.65));
    scene.add(new THREE.AmbientLight(0xeaf3d0, 0.25));
    const sun = new THREE.DirectionalLight(0xfff0c8, 1.35);
    sun.position.set(FROG_WORLD_CENTER + 5, 10, FROG_WORLD_CENTER + 6);
    sun.target.position.set(FROG_WORLD_CENTER, 0, FROG_WORLD_CENTER);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -23;
    sun.shadow.camera.right = 23;
    sun.shadow.camera.top = 23;
    sun.shadow.camera.bottom = -23;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 46;
    sun.shadow.bias = -0.0015;
    sun.shadow.radius = 3;
    scene.add(sun);
    scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0xcfe8d8, 0.3);
    fill.position.set(-4, 3, -3);
    scene.add(fill);

    collisionBoxesRef.current = [];

    // sound
    let resumeAudioOnGesture = () => { };
    try {
      const bgMusic = new Audio("/assets/sounds/backgroundFrog.mp3");
      bgMusic.loop = true;
      bgMusic.volume = 0.35;
      bgMusicRef.current = bgMusic;

      const waterSound = new Audio("/assets/sounds/waterMovement.mp3");
      waterSound.loop = true;
      waterSound.volume = 0;
      waterSoundRef.current = waterSound;

      // browsers block audio.play() until user interacts
      const tryPlayBgMusic = () => bgMusic.play().catch(() => { });
      tryPlayBgMusic();
      resumeAudioOnGesture = () => {
        tryPlayBgMusic();
        window.removeEventListener("keydown", resumeAudioOnGesture);
        window.removeEventListener("pointerdown", resumeAudioOnGesture);
      };
      window.addEventListener("keydown", resumeAudioOnGesture);
      window.addEventListener("pointerdown", resumeAudioOnGesture);
    } catch (err) {
      console.error("frog plaza audio init failed (continuing without sound):", err);
    }

    // pond/water
    const shapeRand = seededRandom(211);
    const hexShape = buildHexShape(HEX_RADIUS, 0.05, shapeRand);
    const waterMat = new THREE.MeshPhongMaterial({
      color: PALETTE.sky,
      transparent: true,
      opacity: 0.94,
      shininess: 70,
      specular: 0xffffff,
    });
    const waterMesh = new THREE.Mesh(new THREE.ShapeGeometry(hexShape), waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(FROG_WORLD_CENTER, 0, FROG_WORLD_CENTER);
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);


    const deepShapeRand = seededRandom(212);
    const deepRingCount = 3;
    const deepRings = [];
    for (let i = 0; i < deepRingCount; i++) {
      const t = (i + 1) / deepRingCount;
      const ringShape = buildHexShape(HEX_RADIUS * (1.02 + t * 0.24), 0.08, deepShapeRand);
      const ringMat = new THREE.MeshBasicMaterial({
        color: PALETTE.deep,
        transparent: true,
        opacity: 0.22 * t,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(new THREE.ShapeGeometry(ringShape), ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(FROG_WORLD_CENTER, -0.12 - i * 0.03, FROG_WORLD_CENTER);
      scene.add(ringMesh);
      deepRings.push(ringMesh);
    }

    //lilypads scattered
    const lilyRand = seededRandom(53);
    const lilyTrees = []; // { mesh, x, z, baseY, bobSeed }
    const lilyPositions = [];
    const lilyLoader = new GLTFLoader();
    let lilyCancelled = false;

    //scatter logic
    function populateLilyPads(makePad, baseRadius, baseMinY) {
      let attempts = 0;
      let placed = 0;
      while (placed < LILY_TREE_COUNT && attempts < LILY_TREE_COUNT * 20) {
        attempts++;
        const lx = (lilyRand() - 0.5) * 2 * FIELD_RADIUS;
        const lz = (lilyRand() - 0.5) * 2 * FIELD_RADIUS;
        if (Math.hypot(lx, lz) > FIELD_RADIUS) continue;
        if (inClearing(lx, lz)) continue;
        if (tooCloseTo(lilyPositions, lx, lz, MIN_LILY_SPACING)) continue;

        const targetRadius =
          LILY_RADIUS_MIN + lilyRand() * (LILY_RADIUS_MAX - LILY_RADIUS_MIN);
        const scale = targetRadius / baseRadius;
        const pad = makePad();
        pad.scale.setScalar(scale);
        const lift = -baseMinY * scale + 0.03;
        const worldX = FROG_WORLD_CENTER + lx;
        const worldZ = FROG_WORLD_CENTER + lz;
        pad.position.set(worldX, lift, worldZ);
        pad.rotation.y = lilyRand() * Math.PI * 2;
        pad.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(pad);

        lilyPositions.push({ x: lx, z: lz });
        lilyTrees.push({
          mesh: pad,
          baseY: lift,
          bobSeed: placed * 0.71,
        });
        placed++;

        collisionBoxesRef.current.push({
          cx: frogWorldToNorm(worldX),
          cy: frogWorldToNorm(worldZ),
          hw: (targetRadius + 0.25) / FROG_WORLD_SIZE,
          hh: (targetRadius + 0.25) / FROG_WORLD_SIZE,
        });
      }
    }

    lilyLoader.load(
      "/assets/models/largeLilypad.glb",
      (gltf) => {
        if (lilyCancelled) return;
        const template = gltf.scene;
        const baseBox = new THREE.Box3().setFromObject(template);
        const baseSize = baseBox.getSize(new THREE.Vector3());
        const baseRadius = Math.max(baseSize.x, baseSize.z) / 2 || 1;
        const baseMinY = baseBox.min.y;
        populateLilyPads(() => template.clone(true), baseRadius, baseMinY);
      },
      undefined,
      (err) => {
        console.error(
          "largeLilypad load error (falling back to procedural lily pads — check that /assets/models/largeLilypad.glb actually exists on the server):",
          err,
        );
        if (lilyCancelled) return;
        populateLilyPads(() => buildFallbackLilyPad(lilyRand), 1, 0);
      },
    );

    // cattails scattered
    const cattailLoader = new GLTFLoader();
    let cattailsCancelled = false;
    const cattailBushes = []; // { mesh, swaySeed }
    const ringCattails = [];
    const bushRand = seededRandom(313);
    const ringRand = seededRandom(311);

    function populateCattails(makeStalk, baseHeight, baseMinY) {
      const bushPositions = [];
      let attempts = 0;
      let placed = 0;
      while (placed < CATTAIL_BUSH_COUNT && attempts < CATTAIL_BUSH_COUNT * 20) {
        attempts++;
        const bx = (bushRand() - 0.5) * 2 * FIELD_RADIUS;
        const bz = (bushRand() - 0.5) * 2 * FIELD_RADIUS;
        if (Math.hypot(bx, bz) > FIELD_RADIUS) continue;
        if (inClearing(bx, bz)) continue;
        if (tooCloseTo(lilyPositions, bx, bz, 1.3)) continue;
        if (tooCloseTo(bushPositions, bx, bz, MIN_CATTAIL_BUSH_SPACING)) continue;

        const targetHeight =
          CATTAIL_BUSH_HEIGHT_MIN +
          bushRand() * (CATTAIL_BUSH_HEIGHT_MAX - CATTAIL_BUSH_HEIGHT_MIN);
        const scale = targetHeight / baseHeight;
        const stalk = makeStalk();
        stalk.scale.setScalar(scale);
        const worldX = FROG_WORLD_CENTER + bx;
        const worldZ = FROG_WORLD_CENTER + bz;
        stalk.position.set(worldX, -baseMinY * scale, worldZ);
        stalk.rotation.y = bushRand() * Math.PI * 2;
        stalk.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(stalk);

        bushPositions.push({ x: bx, z: bz });
        cattailBushes.push({ mesh: stalk, swaySeed: bushRand() * Math.PI * 2 });
        placed++;

        collisionBoxesRef.current.push({
          cx: frogWorldToNorm(worldX),
          cy: frogWorldToNorm(worldZ),
          hw: 0.35 / FROG_WORLD_SIZE,
          hh: 0.35 / FROG_WORLD_SIZE,
        });
      }
      for (let i = 0; i < CATTAIL_RING_COUNT; i++) {
        const a = (i / CATTAIL_RING_COUNT) * Math.PI * 2 + ringRand() * 0.3;
        const r = CATTAIL_RING_MIN + ringRand() * (CATTAIL_RING_MAX - CATTAIL_RING_MIN);
        const targetHeight = 1.6 + ringRand() * 1.2;
        const scale = targetHeight / baseHeight;
        const stalk = makeStalk();
        stalk.scale.setScalar(scale);
        const x = FROG_WORLD_CENTER + Math.cos(a) * r;
        const z = FROG_WORLD_CENTER + Math.sin(a) * r;
        stalk.position.set(x, -baseMinY * scale, z);
        stalk.rotation.y = ringRand() * Math.PI * 2;
        stalk.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(stalk);
        ringCattails.push({ mesh: stalk, swaySeed: ringRand() * Math.PI * 2 });
      }
    }

    cattailLoader.load(
      "/assets/models/cattail.glb",
      (gltf) => {
        if (cattailsCancelled) return;
        const template = gltf.scene;
        const baseBox = new THREE.Box3().setFromObject(template);
        const baseSize = baseBox.getSize(new THREE.Vector3());
        const baseHeight = baseSize.y || 1;
        const baseMinY = baseBox.min.y;
        populateCattails(() => template.clone(true), baseHeight, baseMinY);
      },
      undefined,
      (err) => {
        console.error(
          "cattail load error (falling back to procedural cattails — check that /assets/models/cattail.glb actually exists on the server):",
          err,
        );
        if (cattailsCancelled) return;
        populateCattails(() => buildFallbackCattail(bushRand), 1, 0);
      },
    );

    //fireflies and dragonflies
    const fireflyRand = seededRandom(131);
    const fireflyTex = buildGlowTexture("225,226,137");
    const fireflies = [];
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: fireflyTex,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.3, 0.3, 1);
      sprite.userData = {
        centerX: FROG_WORLD_CENTER + (fireflyRand() - 0.5) * FIELD_RADIUS * 1.7,
        centerZ: FROG_WORLD_CENTER + (fireflyRand() - 0.5) * FIELD_RADIUS * 1.7,
        radius: 0.8 + fireflyRand() * 2,
        speed: 0.2 + fireflyRand() * 0.25,
        phase: fireflyRand() * Math.PI * 2,
        twinkleSpeed: 1.5 + fireflyRand() * 2,
        baseHeight: 0.6 + fireflyRand() * 1.4,
      };
      scene.add(sprite);
      fireflies.push(sprite);
    }

    const dragonflyRand = seededRandom(151);
    const dragonflies = [];
    for (let i = 0; i < DRAGONFLY_COUNT; i++) {
      const hue = 190 + dragonflyRand() * 30;
      const tex = buildDragonflyTexture(hue);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        alphaTest: 0.05,
      });
      const sprite = new THREE.Sprite(mat);
      const baseScale = 0.24 + dragonflyRand() * 0.14;
      sprite.scale.set(baseScale, baseScale, 1);
      sprite.userData = {
        centerX: FROG_WORLD_CENTER + (dragonflyRand() - 0.5) * FIELD_RADIUS * 1.5,
        centerZ: FROG_WORLD_CENTER + (dragonflyRand() - 0.5) * FIELD_RADIUS * 1.5,
        radiusX: 1.5 + dragonflyRand() * 2.5,
        radiusZ: 1.5 + dragonflyRand() * 2.5,
        speed: 0.5 + dragonflyRand() * 0.4,
        phase: dragonflyRand() * Math.PI * 2,
        bobPhase: dragonflyRand() * Math.PI * 2,
        baseScale,
      };
      scene.add(sprite);
      dragonflies.push(sprite);
    }

    // ---- ambient ripples ----
    const rippleGeo = new THREE.RingGeometry(0.3, 0.4, 24);
    const ripples = [];
    let ambientRippleTimer = 0;
    function spawnRipple(x, z, life = 1.8) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(rippleGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.03, z);
      scene.add(mesh);
      ripples.push({ mesh, born: performance.now(), life: life * 1000 });
    }

    function clampToBounds(nx, ny) {
      const wx = frogNormToWorld(nx) - FROG_WORLD_CENTER;
      const wz = frogNormToWorld(ny) - FROG_WORLD_CENTER;
      const r = Math.hypot(wx, wz);
      if (r === 0) return { x: nx, y: ny };
      const theta = Math.atan2(wx, wz);
      const rMax = hexBoundaryRadius(theta, HEX_RADIUS * 0.98);
      if (r <= rMax) return { x: nx, y: ny };
      const scale = rMax / r;
      const cx = FROG_WORLD_CENTER + wx * scale;
      const cz = FROG_WORLD_CENTER + wz * scale;
      return { x: frogWorldToNorm(cx), y: frogWorldToNorm(cz) };
    }

    posRef.current.bounds = FROG_MOVEMENT_BOUNDS;
    posRef.current.clampToBounds = clampToBounds;

    // Animate
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const model = modelRef.current;
      const now = performance.now();
      const t = now * 0.001;

      lilyTrees.forEach((pad) => {
        pad.mesh.position.y = pad.baseY + Math.sin(t * 0.8 + pad.bobSeed) * 0.02;
      });
      [...ringCattails, ...cattailBushes].forEach((c) => {
        c.mesh.rotation.z = Math.sin(t * 0.6 + c.swaySeed) * 0.04;
      });

      fireflies.forEach((f) => {
        const u = f.userData;
        const angle = t * u.speed + u.phase;
        f.position.set(
          u.centerX + Math.cos(angle) * u.radius,
          u.baseHeight + Math.sin(t * u.twinkleSpeed) * 0.25,
          u.centerZ + Math.sin(angle * 1.3) * u.radius,
        );
        f.material.opacity = 0.45 + Math.sin(t * u.twinkleSpeed + u.phase) * 0.3;
      });

      dragonflies.forEach((d) => {
        const u = d.userData;
        const angle = t * u.speed + u.phase;
        d.position.set(
          u.centerX + Math.cos(angle) * u.radiusX,
          1.1 + Math.sin(t * 1.4 + u.bobPhase) * 0.2,
          u.centerZ + Math.sin(angle * 1.4) * u.radiusZ,
        );
        const wobble = 1 + Math.sin(t * 6 + u.bobPhase) * 0.1;
        d.scale.set(u.baseScale * wobble, u.baseScale, 1);
      });

      ambientRippleTimer -= 1;
      if (ambientRippleTimer <= 0) {
        ambientRippleTimer = 100 + Math.floor(Math.random() * 70);
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * FIELD_RADIUS * 0.9;
        spawnRipple(
          FROG_WORLD_CENTER + Math.cos(a) * r,
          FROG_WORLD_CENTER + Math.sin(a) * r,
          2.4,
        );
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        const age = now - rp.born;
        const progress = age / rp.life;
        if (progress >= 1) {
          scene.remove(rp.mesh);
          rp.mesh.material.dispose();
          ripples.splice(i, 1);
          continue;
        }
        const scale = 0.5 + progress * 4;
        rp.mesh.scale.set(scale, scale, scale);
        rp.mesh.material.opacity = 0.5 * (1 - progress);
      }

      const manualInput =
        keysRef.current.ArrowUp ||
        keysRef.current.ArrowDown ||
        keysRef.current.ArrowLeft ||
        keysRef.current.ArrowRight;

      if (manualInput && travelTargetRef) travelTargetRef.current = null;

      const target = travelTargetRef?.current;

      if (target && !manualInput) {
        const dx = target.x - posRef.current.x;
        const dy = target.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ARRIVAL_THRESHOLD) {
          posRef.current = { ...posRef.current, x: target.x, y: target.y };
          travelTargetRef.current = null;
          onArrivedRef.current?.();
        } else {
          posRef.current = {
            ...posRef.current,
            x: posRef.current.x + (dx / dist) * TRAVEL_SPEED,
            y: posRef.current.y + (dy / dist) * TRAVEL_SPEED,
          };
          if (model) {
            const targetAngle = Math.atan2(dx, dy);
            let delta = targetAngle - model.rotation.y;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            model.rotation.y += delta * 0.18;
          }
        }
      }

      if (model) {
        const wx = frogNormToWorld(posRef.current._smoothX ?? posRef.current.x);
        const wz = frogNormToWorld(posRef.current._smoothY ?? posRef.current.y);
        const isMoving = manualInput || !!target;
        const baseY = model.userData.baseY ?? 0;

        // froggy hop
        if (isMoving) {
          hopTRef.current += 0.22;
        } else {
          hopTRef.current += 0.03; // slow idle breathing
        }
        const hopPhase = isMoving ? Math.abs(Math.sin(hopTRef.current)) : 0;
        const idleBreath = isMoving ? 0 : Math.sin(hopTRef.current) * 0.03;
        const hopHeight = isMoving ? 0.22 : 0;

        model.position.x = wx;
        model.position.y = baseY + hopPhase * hopHeight + idleBreath;
        model.position.z = wz;

        const squashT = isMoving ? Math.cos(hopTRef.current) : 0;
        const scaleY = 1 + squashT * 0.08;
        const scaleXZ = 1 - squashT * 0.05;
        model.scale.set(scaleXZ, scaleY, scaleXZ);

        // little splash ring right as each hop lands
        if (isMoving && hopPhase < 0.06 && now - (model.userData.lastLandTime || 0) > 220) {
          model.userData.lastLandTime = now;
          spawnRipple(wx, wz, 0.7);
        }

        // water-movement sound
        const waterSound = waterSoundRef.current;
        if (waterSound) {
          const targetVolume = isMoving ? 0.5 : 0;
          waterSound.volume += (targetVolume - waterSound.volume) * 0.12;
          if (isMoving && !wasMovingRef.current && waterSound.paused) {
            waterSound.currentTime = 0;
            waterSound.play().catch(() => { });
          } else if (!isMoving && waterSound.volume < 0.02 && !waterSound.paused) {
            waterSound.pause();
          }
          wasMovingRef.current = isMoving;
        }

        if (isMoving) {
          idleTimeRef.current = 0;
        } else {
          idleTimeRef.current += 1 / 60;
        }

        camera.position.x += (wx - camera.position.x) * 0.1;
        camera.position.z += (wz + 10 - camera.position.z) * 0.1;
        camera.position.y = 12;
        camera.lookAt(wx, 0, wz);

        if (manualInput) {
          const k = keysRef.current;
          let dx = 0,
            dz = 0;
          if (k.ArrowLeft) dx -= 1;
          if (k.ArrowRight) dx += 1;
          if (k.ArrowUp) dz -= 1;
          if (k.ArrowDown) dz += 1;
          const targetAngle = Math.atan2(dx, dz);
          let delta = targetAngle - model.rotation.y;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          model.rotation.z = 0;
          model.rotation.y += delta * 0.18;
        }

        model.traverse((child) => {
          if (child.userData.isCharGlow) {
            const active = hasActiveQuestRef.current;
            const glowTarget = active
              ? 0.4 + Math.sin(floatTRef.current * 2) * 0.25
              : 0;
            child.material.opacity +=
              (glowTarget - child.material.opacity) * 0.08;
          }
        });
        floatTRef.current += isMoving ? 0.12 : 0.04;
      }

      const agent = agentRef.current;
      if (agent && model) {
        agentFloatTRef.current += 0.045;
        const trailAngle = model.rotation.y + Math.PI * 0.78;
        const targetX =
          model.position.x + Math.sin(trailAngle) * AGENT_FOLLOW_DISTANCE;
        const targetZ =
          model.position.z + Math.cos(trailAngle) * AGENT_FOLLOW_DISTANCE;

        agent.position.x += (targetX - agent.position.x) * AGENT_FOLLOW_LERP;
        agent.position.z += (targetZ - agent.position.z) * AGENT_FOLLOW_LERP;

        const agentBaseY = agent.userData.baseY ?? 0.3;
        agent.position.y =
          (model.userData.baseY ?? 0) +
          AGENT_HOVER_HEIGHT +
          agentBaseY +
          Math.sin(agentFloatTRef.current * 1.6) * 0.09;
        if (agent.userData.glow) {
          agent.userData.glow.material.opacity =
            0.32 + Math.sin(agentFloatTRef.current) * 0.15;
        }

        const reportPos = onAgentScreenPositionChangeRef.current;
        if (reportPos && mountRef.current) {
          const worldPos = new THREE.Vector3();
          agent.getWorldPosition(worldPos);
          worldPos.y += agentBaseY;
          const ndc = worldPos.project(camera);
          const mountEl = mountRef.current;
          reportPos({
            x: (ndc.x * 0.5 + 0.5) * mountEl.clientWidth,
            y: (-ndc.y * 0.5 + 0.5) * mountEl.clientHeight,
            visible: ndc.z < 1,
          });
        }
      }

      if (otherPlayersRef) {
        otherModelsRef.current.forEach((entry, id) => {
          const player = otherPlayersRef.current.get(id);
          if (!player) return;

          entry.smoothX += (player.x - entry.smoothX) * 0.15;
          entry.smoothY += (player.y - entry.smoothY) * 0.15;
          const wx = frogNormToWorld(entry.smoothX);
          const wz = frogNormToWorld(entry.smoothY);

          entry.hopT += 0.14;
          const baseY = entry.pivot.userData.baseY ?? 0;

          const dx = wx - entry.pivot.position.x;
          const dz = wz - entry.pivot.position.z;
          const moving = Math.abs(dx) > 0.0008 || Math.abs(dz) > 0.0008;
          if (moving) {
            const targetAngle = Math.atan2(dx, dz);
            let delta = targetAngle - entry.pivot.rotation.y;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            entry.pivot.rotation.y += delta * 0.18;
          }

          const hopPhase = moving ? Math.abs(Math.sin(entry.hopT)) : 0;

          entry.pivot.position.x = wx;
          entry.pivot.position.y = baseY + hopPhase * 0.2;
          entry.pivot.position.z = wz;

          if (entry.msgSprite) {
            const ALERT_TTL = 6000;
            const alertAt = messageAlertsRef?.current?.get(id);
            const age = alertAt ? now - alertAt : Infinity;
            const active = age < ALERT_TTL;

            const targetOpacity = active ? 0.95 : 0;
            entry.msgSprite.material.opacity +=
              (targetOpacity - entry.msgSprite.material.opacity) * 0.15;

            if (active) {
              entry.msgBubbleT += 0.12;
              const bob = Math.sin(entry.msgBubbleT) * 0.08;
              const pulse = 1 + Math.sin(entry.msgBubbleT * 1.6) * 0.08;
              entry.msgSprite.position.y = baseY + 1.35 + bob;
              entry.msgSprite.scale.set(0.55 * pulse, 0.55 * pulse, 1);
            }
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();
    onSceneReady(scene, camera, renderer);

    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      lilyCancelled = true;
      cattailsCancelled = true;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", resumeAudioOnGesture);
      window.removeEventListener("pointerdown", resumeAudioOnGesture);

      bgMusicRef.current?.pause();
      if (bgMusicRef.current) bgMusicRef.current.src = "";
      bgMusicRef.current = null;
      waterSoundRef.current?.pause();
      if (waterSoundRef.current) waterSoundRef.current.src = "";
      waterSoundRef.current = null;

      delete posRef.current.clampToBounds;

      skyTex.dispose();
      waterMesh.geometry.dispose();
      waterMat.dispose();
      deepRings.forEach((ringMesh) => {
        scene.remove(ringMesh);
        ringMesh.geometry.dispose();
        ringMesh.material.dispose();
      });

      lilyTrees.forEach((pad) => {
        scene.remove(pad.mesh);
        disposePivot(pad.mesh);
      });
      ringCattails.forEach((c) => {
        scene.remove(c.mesh);
        disposePivot(c.mesh);
      });
      cattailBushes.forEach((c) => {
        scene.remove(c.mesh);
        disposePivot(c.mesh);
      });

      fireflyTex.dispose();
      fireflies.forEach((f) => {
        scene.remove(f);
        f.material.dispose();
      });
      dragonflies.forEach((d) => {
        scene.remove(d);
        d.material.map?.dispose();
        d.material.dispose();
      });

      rippleGeo.dispose();
      ripples.forEach((rp) => {
        scene.remove(rp.mesh);
        rp.mesh.material.dispose();
      });

      otherModelsRef.current.forEach((entry) => {
        scene.remove(entry.pivot);
        disposePivot(entry.pivot);
      });
      otherModelsRef.current.clear();

      renderer.dispose();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
    };
  }, []);

  // ai-agent companion
  useEffect(() => {
    if (!sceneRef.current || !avatarId) return;
    let cancelled = false;
    const agentLoader = new GLTFLoader();

    if (agentRef.current) {
      sceneRef.current.remove(agentRef.current);
      disposePivot(agentRef.current);
      agentRef.current = null;
    }

    agentLoader.load(
      agentModelFor(avatarId),
      (gltf) => {
        if (cancelled || !sceneRef.current) return;
        const pivot = buildAgentPivot(gltf.scene);
        if (modelRef.current) {
          pivot.position.copy(modelRef.current.position);
        }
        sceneRef.current.add(pivot);
        agentRef.current = pivot;
      },
      undefined,
      (err) => console.error(`ai-agent load error for ${avatarId}:`, err),
    );

    return () => {
      cancelled = true;
      if (agentRef.current && sceneRef.current) {
        sceneRef.current.remove(agentRef.current);
        disposePivot(agentRef.current);
      }
      agentRef.current = null;
    };
  }, [avatarId]);

  // Avatar loader
  useEffect(() => {
    if (!sceneRef.current || !avatarId) return;
    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current);
      modelRef.current = null;
    }
    let cancelled = false;
    const cfg = AVATAR_CONFIG[avatarId] || { scale: 1.2, offsetX: 0 };

    loaderRef.current.load(
      `/assets/models/${avatarId}.glb`,
      (gltf) => {
        if (cancelled) return;
        const pivot = buildAvatarPivot(gltf, cfg);
        sceneRef.current.add(pivot);
        modelRef.current = pivot;
      },
      undefined,
      (err) => console.error("avatar load error:", err),
    );

    return () => {
      cancelled = true;
    };
  }, [avatarId]);

  // Sync remote player models
  useEffect(() => {
    if (!sceneRef.current || !otherPlayersRef) return;
    const scene = sceneRef.current;
    const players = otherPlayersRef.current;
    const models = otherModelsRef.current;

    for (const [id, entry] of models) {
      if (!players.has(id)) {
        scene.remove(entry.pivot);
        disposePivot(entry.pivot);
        models.delete(id);
      }
    }

    for (const [id, player] of players) {
      if (models.has(id)) continue;
      const cfg = AVATAR_CONFIG[player.avatarId] || { scale: 1.2, offsetX: 0 };
      loaderRef.current.load(
        `/assets/models/${player.avatarId}.glb`,
        (gltf) => {
          if (!sceneRef.current || !otherPlayersRef.current.has(id)) return;
          const pivot = buildAvatarPivot(gltf, cfg);
          const wx = frogNormToWorld(player.x);
          const wz = frogNormToWorld(player.y);
          pivot.position.set(wx, pivot.userData.baseY ?? 0, wz);
          scene.add(pivot);

          const msgSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: buildMessageBubbleTexture(),
              transparent: true,
              opacity: 0,
              depthWrite: false,
            }),
          );
          msgSprite.scale.set(0.55, 0.55, 1);
          msgSprite.position.set(0, (pivot.userData.baseY ?? 0) + 1.35, 0);
          pivot.add(msgSprite);

          models.set(id, {
            pivot,
            hopT: Math.random() * Math.PI * 2,
            smoothX: player.x,
            smoothY: player.y,
            msgSprite,
            msgBubbleT: 0,
          });
        },
        undefined,
        (err) => console.error("remote avatar load error:", err),
      );
    }
  }, [playersVersion]);

  return <div ref={mountRef} className="plaza-canvas-mount" />;
}

export default React.memo(FrogLandCanvas);
