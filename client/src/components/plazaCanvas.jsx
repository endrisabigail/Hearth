import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// how the ai-agent companion trails the player
const AGENT_TARGET_HEIGHT = 0.55; // world units
const AGENT_FOLLOW_DISTANCE = 1.3; // trails behind-right of the avatar
const AGENT_FOLLOW_LERP = 0.07;
const AGENT_HOVER_HEIGHT = 0.5; // above the avatar's base

// Config
const AVATAR_CONFIG = {
  tomato: { scale: 1.2, offsetX: 0 },
  frog: { scale: 1.2, offsetX: 0 },
  fish: { scale: 1.2, offsetX: 0.05 },
  mushroom: { scale: 1.2, offsetX: 0 },
  apple: { scale: 1.2, offsetX: 0 },
  snail: { scale: 1.2, offsetX: 0 },
};

const TRAVEL_SPEED = 0.002;
const ARRIVAL_THRESHOLD = 0.018;

// world layout
const WORLD_MIN = -32; // left/up extent  
const WORLD_MAX = 48; // right/down extent  
const WORLD_SIZE = WORLD_MAX - WORLD_MIN; // 80
const WORLD_CENTER = (WORLD_MIN + WORLD_MAX) / 2; // 8

const TILE_SIZE = 2;
const TILES = WORLD_SIZE / TILE_SIZE;
const TREE_COUNT = 210;
const BUSH_COUNT = 130;
const PX = 64;

// ambient extras
const FLOWER_PATCH_COUNT = 34;
const BUTTERFLY_COUNT = 7;
const FIREFLY_COUNT = 20;
const LILYPAD_COUNT = 9;
const FISH_COUNT = 6;

export function normToWorld(n) {
  return WORLD_MIN + n * WORLD_SIZE;
}
export function worldToNorm(w) {
  return (w - WORLD_MIN) / WORLD_SIZE;
}

// room is kept at the very edge of the grass so the
// character never visually clips off into the fog.
const EDGE_PAD = 1.5 / WORLD_SIZE;
export const MOVEMENT_BOUNDS = {
  minX: EDGE_PAD,
  maxX: 1 - EDGE_PAD,
  minY: EDGE_PAD,
  maxY: 1 - EDGE_PAD,
};

// pond  
export const POND_CENTER_X = WORLD_MAX - 15;
export const POND_CENTER_Z = WORLD_MAX - 11;
export const POND_RADIUS = 7.5;

// character spawn radius
const SPAWN_CLEAR_RADIUS = 6.5;

// build grass texture
function buildGrassTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = PX * 4;
  canvas.height = PX * 4;
  const ctx = canvas.getContext("2d");

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * PX;
      const y = row * PX;

      const hue = 118 + ((row * 4 + col) % 5) * 4;
      ctx.fillStyle = `hsl(${hue}, 52%, 42%)`;
      ctx.fillRect(x, y, PX, PX);

      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, PX - 1, PX - 1);

      ctx.fillStyle = `hsl(${hue + 10}, 55%, 52%)`;
      const rng = (row * 4 + col + 1) * 13;
      for (let i = 0; i < 6; i++) {
        const bx = x + ((rng * (i + 1) * 7) % (PX - 8)) + 4;
        const by = y + ((rng * (i + 1) * 11) % (PX - 10)) + 5;
        ctx.fillRect(bx, by, 2, 5);
        ctx.fillRect(bx + 3, by + 2, 2, 4);
      }

      if ((row + col) % 3 === 0) {
        ctx.fillStyle = "#f9c6d0";
        ctx.beginPath();
        ctx.arc(
          x + 20 + ((col * 7) % 24),
          y + 20 + ((row * 9) % 24),
          3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = "#fff59d";
        ctx.beginPath();
        ctx.arc(
          x + 20 + ((col * 7) % 24),
          y + 20 + ((row * 9) % 24),
          1.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(TILES / 4, TILES / 4);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// cloud texture  
function buildCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const puffs = [
    [128, 150, 78],
    [78, 130, 54],
    [178, 130, 54],
    [100, 100, 46],
    [156, 100, 46],
    [128, 90, 60],
  ];
  puffs.forEach(([cx, cy, r]) => {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.7, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });

  return new THREE.CanvasTexture(canvas);
}

// animated water texture
function buildWaterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, "#4cc3ea");
  grad.addColorStop(1, "#2e9ddb");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const y0 = (i * 23) % 128;
    ctx.beginPath();
    ctx.moveTo(-10, y0);
    for (let x = 0; x <= 140; x += 12) {
      const yy = y0 + Math.sin((x + i * 31) * 0.08) * 11;
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const y0 = (i * 27 + 14) % 128;
    ctx.beginPath();
    ctx.moveTo(-10, y0);
    for (let x = 0; x <= 140; x += 10) {
      const yy = y0 + Math.sin((x + i * 47) * 0.11) * 7;
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 10; i++) {
    ctx.fillRect((i * 37) % 128, (i * 53) % 128, 3, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

// sky gradient (used as scene.background)
function buildSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#8fd0ea");
  grad.addColorStop(0.45, "#bfe8ef");
  grad.addColorStop(0.75, "#eef3d9");
  grad.addColorStop(1, "#fdf1de");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// soft round dirt patch, alpha fades at the edge so path segments blend into grass
function buildDirtTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
  grad.addColorStop(0, "rgba(198,163,116,0.92)");
  grad.addColorStop(0.55, "rgba(198,163,116,0.5)");
  grad.addColorStop(1, "rgba(198,163,116,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(130,100,66,0.25)";
  for (let i = 0; i < 18; i++) {
    const a = (i * 137) % (Math.PI * 2 * 100) / 100;
    const r = (i * 29) % 44;
    ctx.beginPath();
    ctx.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

// small cluster of pastel flowers, tiled onto a flower-patch quad
function buildFlowerPatchTexture(hues, rand) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  for (let i = 0; i < 15; i++) {
    const x = 16 + rand() * 128;
    const y = 16 + rand() * 128;
    const hue = hues[Math.floor(rand() * hues.length)];
    const petalR = 3 + rand() * 2.2;
    ctx.fillStyle = `hsl(${hue}, 72%, ${74 + rand() * 10}%)`;
    for (let p = 0; p < 5; p++) {
      const ang = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(ang) * petalR,
        y + Math.sin(ang) * petalR,
        petalR * 0.85,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#fff6b8";
    ctx.beginPath();
    ctx.arc(x, y, petalR * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

// two-wing butterfly billboard
function buildButterflyTexture(hue) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.translate(32, 32);
  ctx.fillStyle = `hsl(${hue}, 70%, 70%)`;
  ctx.beginPath();
  ctx.ellipse(-12, -6, 11, 15, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12, -6, 11, 15, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue}, 65%, 56%)`;
  ctx.beginPath();
  ctx.ellipse(-9, 11, 7, 9, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(9, 11, 7, 9, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a2b22";
  ctx.fillRect(-1.5, -14, 3, 28);
  return new THREE.CanvasTexture(canvas);
}

// soft radial glow, used for fireflies and water splash droplets
function buildGlowTexture(rgb) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.4, `rgba(${rgb},0.65)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 32, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

// "Z" for the idle sleep indicator
function buildZzzTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 20px 'Comic Sans MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(87, 62, 254, 0.95)";
  ctx.strokeText("Z", 32, 34);
  ctx.fillStyle = "#4539c7";
  ctx.fillText("Z", 32, 34);
  return new THREE.CanvasTexture(canvas);
}

// mottled grey-brown rock, used for the island's sides/underside and boulders
function buildRockTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#8d7f70";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const x = (i * 53) % 256;
    const y = (i * 97) % 256;
    const r = 6 + ((i * 31) % 22);
    const shade = 40 + ((i * 17) % 40);
    ctx.fillStyle = `hsl(28, 12%, ${shade}%)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(35,26,18,0.25)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const x0 = (i * 61) % 256;
    const y0 = (i * 89) % 256;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (((i * 41) % 160) - 80), y0 + (((i * 53) % 160) - 80));
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

// boulder for the underside of the floating island
function buildBoulder(rand) {
  const r = 1.3 + rand() * 1.9;
  const geo = new THREE.IcosahedronGeometry(r, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const n = 0.88 + rand() * 0.28;
    pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n, pos.getZ(i) * n);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(`hsl(30, 10%, ${42 + rand() * 16}%)`),
    flatShading: true,
  });
  return new THREE.Mesh(geo, mat);
}

// pac-man-shaped lily pad  
function buildLilyPad(radius, rand) {
  const shape = new THREE.Shape();
  const notch = 0.3 + rand() * 0.2;
  const start = notch / 2;
  const segs = 20;
  shape.moveTo(0, 0);
  for (let i = 0; i <= segs; i++) {
    const a = start + (i / segs) * (Math.PI * 2 - notch);
    shape.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  shape.lineTo(0, 0);
  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(`hsl(${95 + rand() * 25}, 30%, ${48 + rand() * 10}%)`),
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// shadow under the water
function buildFish(rand) {
  const len = 0.9 + rand() * 0.9;
  const geo = new THREE.SphereGeometry(len * 0.5, 10, 8);
  geo.scale(1, 0.16, 0.42);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x1c3b42,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

// height (world units) that spawned trees are randomised between
const TREE_MIN_HEIGHT = 1.8;
const TREE_MAX_HEIGHT = 3.0;

// Seeded random
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// pond shape and grass circles
function buildBlobShape(radius, irregularity, points, rand) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * Math.PI * 2;
    const r = radius * (1 + (rand() - 0.5) * irregularity);
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

// bushes
function buildBush(rand) {
  const group = new THREE.Group();
  const hue = 96 + rand() * 30;
  const puffCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < puffCount; i++) {
    const r = 0.28 + rand() * 0.22;
    const geo = new THREE.IcosahedronGeometry(r, 0);
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(`hsl(${hue}, 45%, ${34 + rand() * 10}%)`),
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (rand() - 0.5) * 0.35 * puffCount,
      r * 0.75,
      (rand() - 0.5) * 0.35 * puffCount,
    );
    mesh.rotation.y = rand() * Math.PI;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
function buildAvatarPivot(gltf, cfg) {
  const g = gltf.scene;
  g.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  const box = new THREE.Box3().setFromObject(g);
  const sz = box.getSize(new THREE.Vector3());
  const sc = cfg.scale / sz.y;
  g.scale.setScalar(sc);
  const center = box.getCenter(new THREE.Vector3());
  g.position.sub(center.multiplyScalar(sc));
  g.position.y += 0.5;

  const pivot = new THREE.Group();
  pivot.add(g);
  pivot.position.x = cfg.offsetX;
  pivot.userData.baseY = g.position.y;

  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.65, 32),
    new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    }),
  );
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = -g.position.y + 0.05;
  glowRing.userData.isCharGlow = true;
  pivot.add(glowRing);

  return pivot;
}

// builds the ai-agent companion to float behind the player
function buildAgentPivot(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      // fall back to a flat material if the glb has no texture map
      if (!child.material || !child.material.map) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xffe9b0,
          roughness: 0.55,
          metalness: 0.05,
        });
      }
    }
  });

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = AGENT_TARGET_HEIGHT / (size.y || 1);
  object.scale.setScalar(scale);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center.multiplyScalar(scale));

  const pivot = new THREE.Group();
  pivot.add(object);
  pivot.userData.baseY = AGENT_TARGET_HEIGHT / 2;

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.34, 32),
    new THREE.MeshBasicMaterial({
      color: 0xf9d423,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -pivot.userData.baseY + 0.03;
  pivot.add(glow);
  pivot.userData.glow = glow;

  return pivot;
}

function disposePivot(pivot) {
  pivot.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material?.dispose();
      }
    } else if (child.isSprite) {
      child.material?.map?.dispose();
      child.material?.dispose();
    }
  });
}

// chat bubble when player messages
function buildMessageBubbleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");

  const bx = 10,
    by = 10,
    bw = 76,
    bh = 52,
    r = 16;

  ctx.fillStyle = "#fffdf6";
  ctx.strokeStyle = "rgba(45,90,39,0.4)";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // little speech tail
  ctx.beginPath();
  ctx.moveTo(bx + 16, by + bh - 1);
  ctx.lineTo(bx + 8, by + bh + 16);
  ctx.lineTo(bx + 32, by + bh - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // three dots, like a "typing" bubble
  ctx.fillStyle = "#5aaa4a";
  [0, 1, 2].forEach((i) => {
    ctx.beginPath();
    ctx.arc(bx + 20 + i * 19, by + bh / 2, 4.6, 0, Math.PI * 2);
    ctx.fill();
  });

  return new THREE.CanvasTexture(canvas);
}

// Component
function PlazaCanvas({
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
  // userId -> { pivot, floatT, smoothX, smoothY }
  const otherModelsRef = useRef(new Map());
  const floatTRef = useRef(0);
  const idleTimeRef = useRef(0);
  const hasActiveQuestRef = useRef(false);
  const onArrivedRef = useRef(onArrived);

  // ai-agent companion that trails the player and reports its own screen
  // position back up so the dashboard can render a clickable DOM marker
  // right on top of it
  const agentRef = useRef(null);
  const agentFloatTRef = useRef(Math.random() * Math.PI * 2);
  const onAgentScreenPositionChangeRef = useRef(onAgentScreenPositionChange);

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
    const skyTex = buildSkyTexture();
    scene.background = skyTex;
    scene.fog = new THREE.Fog(0xd6ecdf, WORLD_SIZE * 0.48, WORLD_SIZE * 0.88);
    sceneRef.current = scene;

    // Camera 
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(WORLD_CENTER, 14, WORLD_CENTER + 12);
    camera.lookAt(WORLD_CENTER, 0, WORLD_CENTER);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 2.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(WORLD_CENTER + 5, 10, WORLD_CENTER + 6);
    sun.target.position.set(WORLD_CENTER, 0, WORLD_CENTER);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0015;
    sun.shadow.radius = 3;
    scene.add(sun);
    scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-4, 3, -3);
    scene.add(fill);

    // Grass ground  
    // island: grass on top, rock on the sides and underside.
    const grassTex = buildGrassTexture();
    const rockTex = buildRockTexture();
    const ISLAND_DEPTH = 3.4;
    const groundGeo = new THREE.BoxGeometry(WORLD_SIZE, ISLAND_DEPTH, WORLD_SIZE);
    const grassTopMat = new THREE.MeshLambertMaterial({ map: grassTex });
    const rockSideMat = new THREE.MeshLambertMaterial({ map: rockTex });
    const groundMaterials = [
      rockSideMat, // +x
      rockSideMat, // -x
      grassTopMat, // +y (top)
      rockSideMat, // -y (bottom)
      rockSideMat, // +z
      rockSideMat, // -z
    ];
    const ground = new THREE.Mesh(groundGeo, groundMaterials);
    const GROUND_TOP_Y = -0.01;
    ground.position.set(WORLD_CENTER, GROUND_TOP_Y - ISLAND_DEPTH / 2, WORLD_CENTER);
    ground.receiveShadow = true;
    ground.castShadow = true;
    scene.add(ground);

    // chunky boulders hanging off the underside edges, like rock jutting out
    // from beneath a floating island
    const boulderRand = seededRandom(131);
    const boulders = [];
    const BOULDER_COUNT = 20;
    for (let i = 0; i < BOULDER_COUNT; i++) {
      const edge = Math.floor(boulderRand() * 4);
      const t = boulderRand();
      let bx, bz;
      if (edge === 0) {
        bx = WORLD_MIN + t * WORLD_SIZE;
        bz = WORLD_MIN - boulderRand() * 1.6;
      } else if (edge === 1) {
        bx = WORLD_MIN + t * WORLD_SIZE;
        bz = WORLD_MAX + boulderRand() * 1.6;
      } else if (edge === 2) {
        bz = WORLD_MIN + t * WORLD_SIZE;
        bx = WORLD_MIN - boulderRand() * 1.6;
      } else {
        bz = WORLD_MIN + t * WORLD_SIZE;
        bx = WORLD_MAX + boulderRand() * 1.6;
      }
      const boulder = buildBoulder(boulderRand);
      const by = GROUND_TOP_Y - ISLAND_DEPTH * (0.25 + boulderRand() * 0.65);
      boulder.position.set(bx, by, bz);
      boulder.rotation.set(
        boulderRand() * Math.PI,
        boulderRand() * Math.PI,
        boulderRand() * Math.PI,
      );
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      scene.add(boulder);
      boulders.push(boulder);
    }

    collisionBoxesRef.current = [];

    // pond
    const pondSeedA = seededRandom(7);
    const pondSeedB = seededRandom(7);
    const shoreShape = buildBlobShape(POND_RADIUS * 1.18, 0.16, 28, pondSeedA);
    const waterShape = buildBlobShape(POND_RADIUS, 0.18, 28, pondSeedB);

    const shoreMat = new THREE.MeshLambertMaterial({ color: 0xe4d6a7 });
    const shoreMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shoreShape),
      shoreMat,
    );
    shoreMesh.rotation.x = -Math.PI / 2;
    shoreMesh.position.set(POND_CENTER_X, 0.0, POND_CENTER_Z);
    shoreMesh.receiveShadow = true;
    scene.add(shoreMesh);

    const waterTex = buildWaterTexture();
    const waterMat = new THREE.MeshLambertMaterial({
      map: waterTex,
      transparent: true,
      opacity: 0.92,
    });
    const waterMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(waterShape),
      waterMat,
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(POND_CENTER_X, 0.02, POND_CENTER_Z);
    scene.add(waterMesh);

    // block so character can't walk into the pond
    collisionBoxesRef.current.push({
      cx: worldToNorm(POND_CENTER_X),
      cy: worldToNorm(POND_CENTER_Z),
      hw: (POND_RADIUS * 1.05) / WORLD_SIZE,
      hh: (POND_RADIUS * 1.05) / WORLD_SIZE,
    });

    // lily pads bobbing on the surface
    const padRand = seededRandom(53);
    const lilyPads = [];
    for (let i = 0; i < LILYPAD_COUNT; i++) {
      const a = padRand() * Math.PI * 2;
      const r = padRand() * POND_RADIUS * 0.78;
      const pad = buildLilyPad(0.45 + padRand() * 0.45, padRand);
      const px = POND_CENTER_X + Math.cos(a) * r;
      const pz = POND_CENTER_Z + Math.sin(a) * r;
      pad.position.set(px, 0.03, pz);
      pad.userData.baseY = 0.03;
      pad.userData.bobSeed = padRand() * Math.PI * 2;
      scene.add(pad);
      lilyPads.push(pad);
    }

    // small fish shadows swimming slow loops beneath the water
    const fishRand = seededRandom(61);
    const fishList = [];
    for (let i = 0; i < FISH_COUNT; i++) {
      const fish = buildFish(fishRand);
      fish.userData.orbitRadius = POND_RADIUS * (0.25 + fishRand() * 0.55);
      fish.userData.orbitSpeed = 0.15 + fishRand() * 0.2;
      fish.userData.orbitPhase = fishRand() * Math.PI * 2;
      fish.userData.orbitOffsetX = (fishRand() - 0.5) * POND_RADIUS * 0.3;
      fish.userData.orbitOffsetZ = (fishRand() - 0.5) * POND_RADIUS * 0.3;
      fish.position.y = -0.12;
      scene.add(fish);
      fishList.push(fish);
    }

    const rippleGeo = new THREE.RingGeometry(0.3, 0.42, 24);
    const ripples = [];
    let ambientRippleTimer = 0;
    let lastSplashTime = -999;
    function spawnRipple(x, z, life = 1.6) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(rippleGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.035, z);
      scene.add(mesh);
      ripples.push({ mesh, born: performance.now(), life: life * 1000 });
    }

    //clouds
    const cloudTex = buildCloudTexture();
    const cloudGroup = new THREE.Group();
    const cloudRand = seededRandom(19);
    const CLOUD_COUNT = 7;
    const cloudMeshes = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const size = 10 + cloudRand() * 9;
      const mat = new THREE.MeshBasicMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.55 + cloudRand() * 0.25,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        WORLD_MIN + cloudRand() * WORLD_SIZE * 1.4 - WORLD_SIZE * 0.2,
        20 + cloudRand() * 6,
        WORLD_MIN + cloudRand() * WORLD_SIZE * 1.4 - WORLD_SIZE * 0.2,
      );
      mesh.userData.driftSpeed = 0.004 + cloudRand() * 0.006;
      cloudGroup.add(mesh);
      cloudMeshes.push(mesh);
    }
    scene.add(cloudGroup);

    //bushes
    const bushRand = seededRandom(31);
    const bushPositions = [];
    function tooCloseTo(list, x, z, minDist) {
      for (const p of list) {
        const dx = x - p.x;
        const dz = z - p.z;
        if (dx * dx + dz * dz < minDist * minDist) return true;
      }
      return false;
    }
    function insidePond(x, z, pad) {
      const dx = x - POND_CENTER_X;
      const dz = z - POND_CENTER_Z;
      return dx * dx + dz * dz < (POND_RADIUS + pad) * (POND_RADIUS + pad);
    }
    function inClearing(x, z) {
      const dx = x - WORLD_CENTER;
      const dz = z - WORLD_CENTER;
      return dx * dx + dz * dz < SPAWN_CLEAR_RADIUS * SPAWN_CLEAR_RADIUS;
    }

    const margin = 2;
    let bushAttempts = 0;
    let bushesPlaced = 0;
    while (bushesPlaced < BUSH_COUNT && bushAttempts < BUSH_COUNT * 15) {
      bushAttempts++;
      const bx = WORLD_MIN + margin + bushRand() * (WORLD_SIZE - margin * 2);
      const bz = WORLD_MIN + margin + bushRand() * (WORLD_SIZE - margin * 2);
      if (inClearing(bx, bz)) continue;
      if (insidePond(bx, bz, 1.2)) continue;
      if (tooCloseTo(bushPositions, bx, bz, 1.4)) continue;

      const bush = buildBush(bushRand);
      bush.position.set(bx, 0, bz);
      bush.rotation.y = bushRand() * Math.PI * 2;
      scene.add(bush);
      bushPositions.push({ x: bx, z: bz });
      bushesPlaced++;

      collisionBoxesRef.current.push({
        cx: worldToNorm(bx),
        cy: worldToNorm(bz),
        hw: 0.55 / WORLD_SIZE,
        hh: 0.55 / WORLD_SIZE,
      });
    }

    // dirt path 
    const dirtTex = buildDirtTexture();
    const pathMat = new THREE.MeshBasicMaterial({
      map: dirtTex,
      transparent: true,
      depthWrite: false,
    });
    const pathRand = seededRandom(71);
    const PATH_SEGMENTS = 26;
    for (let i = 0; i <= PATH_SEGMENTS; i++) {
      const t = i / PATH_SEGMENTS;
      const wiggle = Math.sin(t * Math.PI * 2.4) * 1.4;
      const px = THREE.MathUtils.lerp(WORLD_CENTER, POND_CENTER_X, t) + wiggle;
      const pz = THREE.MathUtils.lerp(WORLD_CENTER, POND_CENTER_Z, t);
      if (insidePond(px, pz, 1.5)) continue;
      const size = 2.6 + pathRand() * 1.2;
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(size, size), pathMat);
      seg.rotation.x = -Math.PI / 2;
      seg.rotation.z = pathRand() * Math.PI;
      seg.position.set(px, 0.006, pz);
      scene.add(seg);
    }

    // flower patches scattered across the grass
    const flowerRand = seededRandom(83);
    const flowerPalettes = [
      [340, 350, 300],
      [50, 40, 320],
      [200, 260, 0],
    ];
    const flowerTextures = flowerPalettes.map((hues) =>
      buildFlowerPatchTexture(hues, flowerRand),
    );
    const flowerPositions = [];
    let flowerAttempts = 0;
    let flowersPlaced = 0;
    while (flowersPlaced < FLOWER_PATCH_COUNT && flowerAttempts < FLOWER_PATCH_COUNT * 15) {
      flowerAttempts++;
      const fx = WORLD_MIN + margin + flowerRand() * (WORLD_SIZE - margin * 2);
      const fz = WORLD_MIN + margin + flowerRand() * (WORLD_SIZE - margin * 2);
      if (insidePond(fx, fz, 1.6)) continue;
      if (tooCloseTo(flowerPositions, fx, fz, 2.2)) continue;
      const tex = flowerTextures[Math.floor(flowerRand() * flowerTextures.length)];
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      });
      const size = 2.4 + flowerRand() * 1.6;
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = flowerRand() * Math.PI * 2;
      patch.position.set(fx, 0.012, fz);
      scene.add(patch);
      flowerPositions.push({ x: fx, z: fz });
      flowersPlaced++;
    }

    // butterflies drifting in lazy loops above a handful of wander-centers
    const butterflyRand = seededRandom(97);
    const butterflies = [];
    for (let i = 0; i < BUTTERFLY_COUNT; i++) {
      const hue = 20 + butterflyRand() * 320;
      const tex = buildButterflyTexture(hue);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(mat);
      const baseScale = 0.6 + butterflyRand() * 0.3;
      sprite.scale.set(baseScale, baseScale, 1);
      sprite.userData = {
        centerX: WORLD_MIN + margin + butterflyRand() * (WORLD_SIZE - margin * 2),
        centerZ: WORLD_MIN + margin + butterflyRand() * (WORLD_SIZE - margin * 2),
        radiusX: 2 + butterflyRand() * 3,
        radiusZ: 2 + butterflyRand() * 3,
        speed: 0.3 + butterflyRand() * 0.35,
        phase: butterflyRand() * Math.PI * 2,
        bobPhase: butterflyRand() * Math.PI * 2,
        baseScale,
      };
      scene.add(sprite);
      butterflies.push(sprite);
    }

    // fireflies 
    const fireflyRand = seededRandom(113);
    const fireflyTex = buildGlowTexture("255,236,150");
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
      sprite.scale.set(0.35, 0.35, 1);
      sprite.userData = {
        centerX: WORLD_MIN + margin + fireflyRand() * (WORLD_SIZE - margin * 2),
        centerZ: WORLD_MIN + margin + fireflyRand() * (WORLD_SIZE - margin * 2),
        radius: 1 + fireflyRand() * 2.5,
        speed: 0.2 + fireflyRand() * 0.25,
        phase: fireflyRand() * Math.PI * 2,
        twinkleSpeed: 1.5 + fireflyRand() * 2,
        baseHeight: 0.5 + fireflyRand() * 1.2,
      };
      scene.add(sprite);
      fireflies.push(sprite);
    }

    // sleepy "Zzz" sprites that float up above the character while idle
    const zzzTex = buildZzzTexture();
    const ZZZ_COUNT = 3;
    const zzzSprites = [];
    for (let i = 0; i < ZZZ_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: zzzTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.3, 0.3, 1);
      scene.add(sprite);
      zzzSprites.push(sprite);
    }

    // splash droplet sprites, spawned in little bursts near the shore
    const splashTex = buildGlowTexture("255,255,255");
    const droplets = [];
    function spawnSplash(x, z) {
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.SpriteMaterial({
          map: splashTex,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.18, 0.18, 1);
        const ang = Math.random() * Math.PI * 2;
        const spd = 0.4 + Math.random() * 0.5;
        sprite.position.set(x, 0.1, z);
        sprite.userData = {
          vx: Math.cos(ang) * spd,
          vz: Math.sin(ang) * spd,
          vy: 0.9 + Math.random() * 0.4,
        };
        scene.add(sprite);
        droplets.push({ mesh: sprite, born: performance.now(), life: 500 });
      }
    }

    // trees
    const treeRand = seededRandom(42);
    const treeLoader = new GLTFLoader();
    let treesCancelled = false;
    treeLoader.load(
      "/assets/models/tree.glb",
      (gltf) => {
        if (treesCancelled) return;
        const template = gltf.scene;

        // normalise so "scale" below maps to an actual world-unit height
        const baseBox = new THREE.Box3().setFromObject(template);
        const baseSize = baseBox.getSize(new THREE.Vector3());
        const baseHeight = baseSize.y || 1;
        const baseRadius =
          Math.max(baseSize.x, baseSize.z) / 2 / baseHeight || 0.3;
        const baseMinY = baseBox.min.y; // how far the model's origin sits below its own base

        const treePositions = [];
        const MIN_TREE_SPACING = 3.1;

        let attempts = 0;
        let placed = 0;
        while (placed < TREE_COUNT && attempts < TREE_COUNT * 15) {
          attempts++;
          const tx =
            WORLD_MIN + margin + treeRand() * (WORLD_SIZE - margin * 2);
          const tz =
            WORLD_MIN + margin + treeRand() * (WORLD_SIZE - margin * 2);

          if (inClearing(tx, tz)) continue;
          if (insidePond(tx, tz, 1.8)) continue;
          if (tooCloseTo(treePositions, tx, tz, MIN_TREE_SPACING)) continue;
          if (tooCloseTo(bushPositions, tx, tz, 1.1)) continue;

          const targetHeight =
            TREE_MIN_HEIGHT + treeRand() * (TREE_MAX_HEIGHT - TREE_MIN_HEIGHT);
          const scale = targetHeight / baseHeight;

          const tree = template.clone(true);
          tree.scale.setScalar(scale);
          // shift up so the model's true base (not its origin) sits on the grass
          const groundLift = -baseMinY * scale + 0.02;
          tree.position.set(tx, groundLift, tz);
          tree.rotation.y = treeRand() * Math.PI * 2;
          tree.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          scene.add(tree);

          treePositions.push({ x: tx, z: tz });
          placed++;

          // Collision box in normalised 0-1 space
          const pad = 0.35;
          const treeRadius = baseRadius * targetHeight; // world units
          collisionBoxesRef.current.push({
            cx: worldToNorm(tx),
            cy: worldToNorm(tz),
            hw: (treeRadius + pad) / WORLD_SIZE,
            hh: (treeRadius + pad) / WORLD_SIZE,
          });
        }
      },
      undefined,
      (err) => console.error("tree load error:", err),
    );

    posRef.current.bounds = MOVEMENT_BOUNDS;

    // Animate
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const model = modelRef.current;

      // cloud drift and water texture animation
      cloudMeshes.forEach((c) => {
        c.position.x += c.userData.driftSpeed;
        if (c.position.x > WORLD_MAX + WORLD_SIZE * 0.25) {
          c.position.x = WORLD_MIN - WORLD_SIZE * 0.25;
        }
      });
      waterTex.offset.x += 0.0006;
      waterTex.offset.y += 0.0003;

      const now = performance.now();
      const t = now * 0.001;

      // lily pads bob gently on the water
      lilyPads.forEach((pad) => {
        pad.position.y = pad.userData.baseY + Math.sin(t * 0.8 + pad.userData.bobSeed) * 0.015;
      });

      // fish swim slow lissajous loops beneath the surface
      fishList.forEach((fish) => {
        const { orbitRadius, orbitSpeed, orbitPhase, orbitOffsetX, orbitOffsetZ } =
          fish.userData;
        const angle = t * orbitSpeed + orbitPhase;
        const nx = POND_CENTER_X + orbitOffsetX + Math.cos(angle) * orbitRadius;
        const nz = POND_CENTER_Z + orbitOffsetZ + Math.sin(angle * 1.3) * orbitRadius * 0.7;
        const prevX = fish.position.x;
        const prevZ = fish.position.z;
        fish.position.x = nx;
        fish.position.z = nz;
        const heading = Math.atan2(nx - prevX, nz - prevZ);
        if (isFinite(heading)) fish.rotation.y = heading;
      });

      // butterflies flutter in lazy loops with a wing-flap scale wobble
      butterflies.forEach((b) => {
        const u = b.userData;
        const angle = t * u.speed + u.phase;
        b.position.x = u.centerX + Math.cos(angle) * u.radiusX;
        b.position.z = u.centerZ + Math.sin(angle * 1.4) * u.radiusZ;
        b.position.y = 1.1 + Math.sin(t * 1.6 + u.bobPhase) * 0.35;
        const flap = 0.65 + 0.35 * Math.abs(Math.sin(t * 9 + u.phase));
        b.scale.set(u.baseScale * flap, u.baseScale, 1);
      });

      // fireflies drift and twinkle
      fireflies.forEach((f) => {
        const u = f.userData;
        const angle = t * u.speed + u.phase;
        f.position.x = u.centerX + Math.cos(angle) * u.radius;
        f.position.z = u.centerZ + Math.sin(angle * 0.8) * u.radius;
        f.position.y = u.baseHeight + Math.sin(t * 0.7 + u.phase) * 0.3;
        f.material.opacity = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * u.twinkleSpeed));
      });

      // ambient ripples spawn now and then, and fade out as they expand
      ambientRippleTimer -= 1;
      if (ambientRippleTimer <= 0) {
        ambientRippleTimer = 90 + Math.floor(Math.random() * 60);
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * POND_RADIUS * 0.8;
        spawnRipple(POND_CENTER_X + Math.cos(a) * r, POND_CENTER_Z + Math.sin(a) * r, 2.2);
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        const age = now - rp.born;
        const progress = age / rp.life;
        if (progress >= 1) {
          scene.remove(rp.mesh);
          rp.mesh.geometry === rippleGeo ? null : rp.mesh.geometry.dispose();
          rp.mesh.material.dispose();
          ripples.splice(i, 1);
          continue;
        }
        const scale = 0.5 + progress * 4.5;
        rp.mesh.scale.set(scale, scale, scale);
        rp.mesh.material.opacity = 0.55 * (1 - progress);
      }

      for (let i = droplets.length - 1; i >= 0; i--) {
        const d = droplets[i];
        const age = now - d.born;
        const progress = age / d.life;
        if (progress >= 1) {
          scene.remove(d.mesh);
          d.mesh.material.dispose();
          droplets.splice(i, 1);
          continue;
        }
        const dt = 0.016;
        d.mesh.position.x += d.mesh.userData.vx * dt;
        d.mesh.position.z += d.mesh.userData.vz * dt;
        d.mesh.userData.vy -= 2.2 * dt;
        d.mesh.position.y = Math.max(0.06, d.mesh.position.y + d.mesh.userData.vy * dt);
        d.mesh.material.opacity = 0.85 * (1 - progress);
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
        const wx = normToWorld(posRef.current._smoothX ?? posRef.current.x);
        const wz = normToWorld(posRef.current._smoothY ?? posRef.current.y);

        const isMoving = manualInput || !!target;
        floatTRef.current += isMoving ? 0.12 : 0.04;
        const baseY = model.userData.baseY ?? 0;

        model.position.x = wx;
        model.position.y =
          baseY + Math.sin(floatTRef.current) * (isMoving ? 0.1 : 0.05);
        model.position.z = wz;

        // splash when running right along the pond's edge
        if (isMoving) {
          const ddx = wx - POND_CENTER_X;
          const ddz = wz - POND_CENTER_Z;
          const distFromCenter = Math.sqrt(ddx * ddx + ddz * ddz);
          const nearShore =
            distFromCenter > POND_RADIUS * 0.92 && distFromCenter < POND_RADIUS * 1.3;
          if (nearShore && now - lastSplashTime > 180) {
            lastSplashTime = now;
            const edgeX = POND_CENTER_X + (ddx / distFromCenter) * POND_RADIUS * 1.02;
            const edgeZ = POND_CENTER_Z + (ddz / distFromCenter) * POND_RADIUS * 1.02;
            spawnRipple(edgeX, edgeZ, 0.9);
            spawnSplash(edgeX, edgeZ);
          }
        }

        // idle time tracking -> sleepy "Zzz" bubbles float up while she's still
        if (isMoving) {
          idleTimeRef.current = 0;
        } else {
          idleTimeRef.current += 1 / 60;
        }
        const showZzz = idleTimeRef.current > 60;
        zzzSprites.forEach((s, i) => {
          const cycle = 2.2;
          const localT = ((t + i * 0.7) % cycle) / cycle;
          s.position.set(
            wx + 0.4 + Math.sin(t * 1.4 + i) * 0.05,
            baseY + 1.3 + localT * 0.9,
            wz - 0.15,
          );
          const fadeIn = Math.min(localT / 0.15, 1);
          const fadeOut = Math.min((1 - localT) / 0.25, 1);
          const targetOpacity = showZzz ? Math.min(fadeIn, fadeOut) * 0.9 : 0;
          s.material.opacity += (targetOpacity - s.material.opacity) * 0.15;
          const scale = 0.22 + localT * 0.18 + i * 0.02;
          s.scale.set(scale, scale, 1);
        });

        // Smooth camera follow
        camera.position.x += (wx - camera.position.x) * 0.1;
        camera.position.z += (wz + 12 - camera.position.z) * 0.1;
        camera.position.y = 14;
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
      }

      // ai-agent companion: hovers just behind-right of the player wherever
      // they go, then reports its screen-space position so the dashboard can
      // place a clickable DOM marker directly on top of it
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
        agent.rotation.y += 0.008;

        if (agent.userData.glow) {
          agent.userData.glow.material.opacity =
            0.32 + Math.sin(agentFloatTRef.current) * 0.15;
        }

        const reportPos = onAgentScreenPositionChangeRef.current;
        if (reportPos && mountRef.current) {
          const worldPos = new THREE.Vector3();
          agent.getWorldPosition(worldPos);
          worldPos.y += 0.4; // marker floats just above the little creature
          const ndc = worldPos.project(camera);
          const mount = mountRef.current;
          reportPos({
            x: (ndc.x * 0.5 + 0.5) * mount.clientWidth,
            y: (-ndc.y * 0.5 + 0.5) * mount.clientHeight,
            visible: ndc.z < 1,
          });
        }
      }

      // move remote players toward their latest known position
      if (otherPlayersRef) {
        otherModelsRef.current.forEach((entry, id) => {
          const player = otherPlayersRef.current.get(id);
          if (!player) return;

          entry.smoothX += (player.x - entry.smoothX) * 0.15;
          entry.smoothY += (player.y - entry.smoothY) * 0.15;
          const wx = normToWorld(entry.smoothX);
          const wz = normToWorld(entry.smoothY);

          entry.floatT += 0.08;
          const baseY = entry.pivot.userData.baseY ?? 0;

          const dx = wx - entry.pivot.position.x;
          const dz = wz - entry.pivot.position.z;
          if (Math.abs(dx) > 0.0008 || Math.abs(dz) > 0.0008) {
            const targetAngle = Math.atan2(dx, dz);
            let delta = targetAngle - entry.pivot.rotation.y;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            entry.pivot.rotation.y += delta * 0.18;
          }

          entry.pivot.position.x = wx;
          entry.pivot.position.y = baseY + Math.sin(entry.floatT) * 0.08;
          entry.pivot.position.z = wz;

          // "they just messaged you" speech bubble, shown for a few seconds
          if (entry.msgSprite) {
            const ALERT_TTL = 6000; // ms
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
      treesCancelled = true;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      grassTex.dispose();
      groundGeo.dispose();
      grassTopMat.dispose();
      rockSideMat.dispose();
      rockTex.dispose();
      boulders.forEach((b) => {
        scene.remove(b);
        b.geometry.dispose();
        b.material.dispose();
      });
      cloudTex.dispose();
      waterTex.dispose();
      shoreMesh.geometry.dispose();
      shoreMat.dispose();
      waterMesh.geometry.dispose();
      waterMat.dispose();
      cloudMeshes.forEach((c) => {
        c.geometry.dispose();
        c.material.dispose();
      });
      skyTex.dispose();
      dirtTex.dispose();
      pathMat.dispose();
      fireflyTex.dispose();
      splashTex.dispose();
      rippleGeo.dispose();
      flowerTextures.forEach((tx) => tx.dispose());
      lilyPads.forEach((pad) => {
        scene.remove(pad);
        pad.geometry.dispose();
        pad.material.dispose();
      });
      fishList.forEach((fish) => {
        scene.remove(fish);
        fish.geometry.dispose();
        fish.material.dispose();
      });
      butterflies.forEach((b) => {
        scene.remove(b);
        b.material.map?.dispose();
        b.material.dispose();
      });
      fireflies.forEach((f) => {
        scene.remove(f);
        f.material.dispose();
      });
      zzzTex.dispose();
      zzzSprites.forEach((s) => {
        scene.remove(s);
        s.material.dispose();
      });
      ripples.forEach((rp) => {
        scene.remove(rp.mesh);
        rp.mesh.material.dispose();
      });
      droplets.forEach((d) => {
        scene.remove(d.mesh);
        d.mesh.material.dispose();
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

  // ai-agent companion loader loads once and lives for the lifetime of
  // the canvas, independent of which avatar the player is wearing
  useEffect(() => {
    if (!sceneRef.current) return;
    let cancelled = false;
    const agentLoader = new GLTFLoader();

    agentLoader.load(
      "/assets/models/ai-agent.glb",
      (gltf) => {
        if (cancelled || !sceneRef.current) return;
        const pivot = buildAgentPivot(gltf.scene);
        // spawn it right on top of the player instead of at the world origin
        // so it doesn't have to travel across the map on first load
        if (modelRef.current) {
          pivot.position.copy(modelRef.current.position);
        }
        sceneRef.current.add(pivot);
        agentRef.current = pivot;
      },
      undefined,
      (err) => console.error("ai-agent load error:", err),
    );

    return () => {
      cancelled = true;
      if (agentRef.current && sceneRef.current) {
        sceneRef.current.remove(agentRef.current);
        disposePivot(agentRef.current);
      }
      agentRef.current = null;
    };
  }, []);

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

  // Sync remote player 3D models whenever someone joins or leaves the plaza.
  useEffect(() => {
    if (!sceneRef.current || !otherPlayersRef) return;
    const scene = sceneRef.current;
    const players = otherPlayersRef.current;
    const models = otherModelsRef.current;

    // remove models for players who left
    for (const [id, entry] of models) {
      if (!players.has(id)) {
        scene.remove(entry.pivot);
        disposePivot(entry.pivot);
        models.delete(id);
      }
    }

    // add models for newly-joined players
    for (const [id, player] of players) {
      if (models.has(id)) continue;
      const cfg = AVATAR_CONFIG[player.avatarId] || { scale: 1.2, offsetX: 0 };
      loaderRef.current.load(
        `/assets/models/${player.avatarId}.glb`,
        (gltf) => {
          // bail if we unmounted or they already left again before this loaded
          if (!sceneRef.current || !otherPlayersRef.current.has(id)) return;
          const pivot = buildAvatarPivot(gltf, cfg);
          const wx = normToWorld(player.x);
          const wz = normToWorld(player.y);
          pivot.position.set(wx, pivot.userData.baseY ?? 0, wz);
          scene.add(pivot);

          // hidden until a message actually comes in from this person
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
            floatT: Math.random() * Math.PI * 2,
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

export default React.memo(PlazaCanvas);