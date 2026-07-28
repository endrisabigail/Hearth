import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  normToWorld,
  worldToNorm,
  MOVEMENT_BOUNDS,
  AVATAR_CONFIG,
  AGENT_TARGET_HEIGHT,
  AGENT_FOLLOW_DISTANCE,
  AGENT_FOLLOW_LERP,
  AGENT_HOVER_HEIGHT,
  agentModelFor,
  seededRandom,
  buildGlowTexture,
  buildSkyTexture,
  buildLilyPad,
  buildAvatarPivot,
  buildAgentPivot,
  buildMessageBubbleTexture,
  disposePivot,
} from "./plazaCanvas.jsx";

export { normToWorld, worldToNorm, MOVEMENT_BOUNDS as FROG_MOVEMENT_BOUNDS };

//floating island
const WORLD_MIN = -32;
const WORLD_MAX = 48;
const WORLD_SIZE = WORLD_MAX - WORLD_MIN;
const WORLD_CENTER = (WORLD_MIN + WORLD_MAX) / 2;

//hexagon shape
const HEX_RADIUS = 70;
const HEX_APOTHEM = HEX_RADIUS * Math.cos(Math.PI / 6);

//cam view
const CAMERA_FOV = 55;
const CAMERA_HEIGHT = 95;
const CAMERA_BACK_OFFSET = 80;
const CAMERA_FOLLOW_FACTOR = 0.35;
const CAMERA_LERP = 0.06;
const CAMERA_FAR = 350;

const TRAVEL_SPEED = 0.002;
const ARRIVAL_THRESHOLD = 0.018;

const MUSHROOM_COUNT = 62;
const CATTAIL_COUNT = 110;
const DRAGONFLY_COUNT = 18;
const FIREFLY_COUNT = 34;
const MOSS_PATCH_COUNT = 40;
const LILYPAD_COUNT = 24;
const FISH_COUNT = 8;
const FLOWER_TUFT_COUNT = 55;
const ROCK_CLUSTER_COUNT = 24;
const FROG_COUNT = 9;
const MUSHROOM_MIN_SPACING = 4.6; // spread the mushroom groves out more than before

export const POND_CENTER_X = WORLD_MAX - 16;
export const POND_CENTER_Z = WORLD_MAX - 12;
export const POND_RADIUS = 11.5; // noticeably bigger than the grass plaza's pond

const SPAWN_CLEAR_RADIUS = 6.5;
const EDGE_PAD = 1.5 / WORLD_SIZE;

//textures

function buildSkyTextureSwamp() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#5ec6e8");
  grad.addColorStop(0.45, "#b7e8d8");
  grad.addColorStop(0.75, "#eef4c4");
  grad.addColorStop(1, "#fff3d2");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 256);
  return new THREE.CanvasTexture(canvas);
}

function buildMossPatchTexture(rand) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(48, 48, 4, 48, 48, 44);
  grad.addColorStop(0, "rgba(100,170,55,0.85)");
  grad.addColorStop(0.6, "rgba(100,170,55,0.5)");
  grad.addColorStop(1, "rgba(100,170,55,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(48, 48, 44, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(70,${140 + rand() * 40},50,0.3)`;
    ctx.beginPath();
    ctx.arc(20 + rand() * 56, 20 + rand() * 56, 5 + rand() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function buildDragonflyTexture(hue) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.translate(32, 32);
  // two long thin iridescent wings
  ctx.fillStyle = `hsla(${hue}, 70%, 78%, 0.55)`;
  ctx.beginPath();
  ctx.ellipse(-14, 0, 16, 5, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(14, 0, 16, 5, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // slender body
  ctx.fillStyle = `hsl(${hue}, 55%, 34%)`;
  ctx.fillRect(-2, -18, 4, 36);
  ctx.beginPath();
  ctx.arc(0, -18, 3.2, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

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
  ctx.strokeStyle = "rgba(30, 70, 40, 0.95)";
  ctx.strokeText("Z", 32, 34);
  ctx.fillStyle = "#294f2c";
  ctx.fillText("Z", 32, 34);
  return new THREE.CanvasTexture(canvas);
}

function buildDirtTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
  grad.addColorStop(0, "rgba(224,178,120,0.9)");
  grad.addColorStop(0.55, "rgba(224,178,120,0.5)");
  grad.addColorStop(1, "rgba(224,178,120,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

// meshes
const MUSHROOM_PALETTE = [
  { h: 6, s: 77.2, l: 71.2 }, // bright red
  { h: 30, s: 100, l: 71.2 }, // bright orange
  { h: 234, s: 52.6, l: 71.2 }, // purple
  { h: 326, s: 52.6, l: 71.2 }, //pinkish red?
];

// little sprigs of grass tucked around a mushroom's base
function buildGrassBlades(rand, baseR) {
  const group = new THREE.Group();
  const bladeCount = 6 + Math.floor(rand() * 5);
  for (let i = 0; i < bladeCount; i++) {
    const a = rand() * Math.PI * 2;
    const dist = baseR * (0.7 + rand() * 0.7);
    const bh = 0.16 + rand() * 0.16;
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, bh, 4),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(`hsl(${100 + rand() * 22}, 55%, ${34 + rand() * 14}%)`),
      }),
    );
    blade.position.set(Math.cos(a) * dist, bh / 2, Math.sin(a) * dist);
    blade.rotation.z = (rand() - 0.5) * 0.5;
    blade.rotation.x = (rand() - 0.5) * 0.5;
    group.add(blade);
  }
  return group;
}

function buildMushroomCluster(rand) {
  const group = new THREE.Group();
  const count = 2 + Math.floor(rand() * 3);
  const palette = MUSHROOM_PALETTE[Math.floor(rand() * MUSHROOM_PALETTE.length)];
  for (let i = 0; i < count; i++) {
    const h = 1.4 + rand() * 2.2;
    const capR = 0.5 + rand() * 0.55 + h * 0.12;
    const stemR = capR * 0.28;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(stemR * 0.85, stemR, h, 8),
      new THREE.MeshLambertMaterial({ color: "#fdeeb3" }),
    );
    stem.position.set((rand() - 0.5) * 1.2 * count, h / 2, (rand() - 0.5) * 1.2 * count);
    stem.castShadow = true;
    stem.receiveShadow = true;
    group.add(stem);

    // little sticks of grass around the base of the stem
    const blades = buildGrassBlades(rand, stemR);
    blades.position.set(stem.position.x, 0, stem.position.z);
    group.add(blades);

    // little collar band for character
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(stemR * 1.05, stemR * 0.16, 6, 10),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(`hsl(${palette.h}, ${palette.s - 10}%, ${Math.max(palette.l - 18, 30)}%)`),
      }),
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(stem.position.x, h * 0.82, stem.position.z);
    group.add(collar);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(capR, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(
          `hsl(${palette.h + (rand() - 0.5) * 10}, ${palette.s}%, ${palette.l + (rand() - 0.5) * 6}%)`,
        ),
      }),
    );
    cap.position.set(stem.position.x, h + capR * 0.25, stem.position.z);
    cap.castShadow = true;
    group.add(cap);

    // glossy toon highlight
    const highlight = new THREE.Mesh(
      new THREE.SphereGeometry(capR * 0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
    );
    highlight.position.set(
      stem.position.x - capR * 0.35,
      h + capR * 0.6,
      stem.position.z - capR * 0.3,
    );
    group.add(highlight);

    // pale spots on the cap
    const spotMat = new THREE.MeshBasicMaterial({ color: 0xfffdf3 });
    const spotCount = 4 + Math.floor(rand() * 3);
    for (let s = 0; s < spotCount; s++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * capR * 0.75;
      const spot = new THREE.Mesh(new THREE.CircleGeometry(capR * 0.1, 6), spotMat);
      spot.position.set(
        stem.position.x + Math.cos(a) * r,
        h + capR * 0.25 + Math.sin(a * 1.7) * capR * 0.3 + capR * 0.35,
        stem.position.z + Math.sin(a) * r,
      );
      spot.rotation.x = -Math.PI / 2.3;
      group.add(spot);
    }
  }
  return group;
}

function buildCattailClump(rand) {
  const group = new THREE.Group();
  const count = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    const h = 1.6 + rand() * 1.3;
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, h, 6),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(`hsl(${100 + rand() * 20}, 55%, ${38 + rand() * 10}%)`),
      }),
    );
    stalk.position.set((rand() - 0.5) * 0.5, h / 2, (rand() - 0.5) * 0.5);
    stalk.rotation.z = (rand() - 0.5) * 0.15;
    group.add(stalk);

    const head = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.32, 4, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a3a24 }),
    );
    head.position.set(stalk.position.x, h * 0.92, stalk.position.z);
    head.rotation.z = stalk.rotation.z;
    group.add(head);
  }
  return group;
}

function buildFish(rand) {
  const len = 0.9 + rand() * 0.9;
  const geo = new THREE.SphereGeometry(len * 0.5, 10, 8);
  geo.scale(1, 0.16, 0.42);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x123326,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

const FLOWER_HUES = [340, 50, 200, 280, 20];

function buildFlowerTuft(rand) {
  const group = new THREE.Group();
  const count = 3 + Math.floor(rand() * 4);
  const hue = FLOWER_HUES[Math.floor(rand() * FLOWER_HUES.length)];
  for (let i = 0; i < count; i++) {
    const stemH = 0.22 + rand() * 0.18;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.014, stemH, 5),
      new THREE.MeshLambertMaterial({ color: 0x4a7a34 }),
    );
    const px = (rand() - 0.5) * 0.4;
    const pz = (rand() - 0.5) * 0.4;
    stem.position.set(px, stemH / 2, pz);
    group.add(stem);

    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(0.07 + rand() * 0.03, 8, 6),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(`hsl(${hue + rand() * 20}, 75%, ${62 + rand() * 12}%)`),
      }),
    );
    bloom.position.set(px, stemH + 0.04, pz);
    bloom.scale.set(1, 0.7, 1);
    group.add(bloom);

    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe680 }),
    );
    center.position.set(px, stemH + 0.06, pz);
    group.add(center);
  }
  return group;
}

function buildRockCluster(rand) {
  const group = new THREE.Group();
  const count = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const r = 0.2 + rand() * 0.4;
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 0),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(`hsl(30, 22%, ${50 + rand() * 16}%)`),
        flatShading: true,
      }),
    );
    rock.position.set((rand() - 0.5) * 0.6, r * 0.6, (rand() - 0.5) * 0.6);
    rock.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
    // little moss cap on some rocks
    if (rand() < 0.6) {
      const moss = new THREE.Mesh(
        new THREE.SphereGeometry(r * 0.55, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.5),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(`hsl(105, 55%, ${40 + rand() * 12}%)`) }),
      );
      moss.position.set(rock.position.x, rock.position.y + r * 0.5, rock.position.z);
      group.add(moss);
    }
  }
  return group;
}

// a tiny cottage built out of a single giant mushroom — round door, glowing
// window, spotted cap roof
function buildMushroomHouse(rand) {
  const group = new THREE.Group();
  const wallR = 1.35;
  const wallH = 2.5;
  const roofR = 2.2;

  const wallMat = new THREE.MeshLambertMaterial({ color: "#f2e0b3" });
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(wallR, wallR * 1.1, wallH, 14),
    wallMat,
  );
  wall.position.y = wallH / 2;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // collar band where the wall meets the cap, matching the regular mushrooms
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(wallR * 1.06, wallR * 0.14, 8, 16),
    new THREE.MeshLambertMaterial({ color: "#c98a4a" }),
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = wallH * 0.94;
  group.add(collar);

  // round door with an arched top, wrapped onto the curved wall
  const doorMat = new THREE.MeshLambertMaterial({ color: "#6b4327" });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), doorMat);
  door.position.set(0, 0.62, wallR * 1.001);
  group.add(door);
  const doorArch = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 14, 0, Math.PI),
    doorMat,
  );
  doorArch.position.set(0, 1.22, wallR * 1.001);
  group.add(doorArch);
  // little doorknob
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 6, 6),
    new THREE.MeshBasicMaterial({ color: "#ffe9a8" }),
  );
  knob.position.set(0.25, 0.62, wallR * 1.02);
  group.add(knob);

  // glowing round windows set into the curved wall
  const windowAngles = [1.05, -1.05];
  windowAngles.forEach((a) => {
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 16),
      new THREE.MeshBasicMaterial({ color: "#ffe9a8" }),
    );
    glow.position.set(Math.sin(a) * wallR * 1.001, 1.55, Math.cos(a) * wallR * 1.001);
    glow.rotation.y = a;
    group.add(glow);
    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.05, 6, 16),
      new THREE.MeshLambertMaterial({ color: "#c98a4a" }),
    );
    frame.position.copy(glow.position);
    frame.rotation.y = a;
    group.add(frame);
  });

  // spotted mushroom-cap roof
  const roof = new THREE.Mesh(
    new THREE.SphereGeometry(roofR, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshLambertMaterial({ color: "#d1483c" }),
  );
  roof.position.y = wallH;
  roof.castShadow = true;
  group.add(roof);
  const spotMat = new THREE.MeshBasicMaterial({ color: 0xfffdf3 });
  const spotCount = 8 + Math.floor(rand() * 4);
  for (let s = 0; s < spotCount; s++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * roofR * 0.78;
    const spot = new THREE.Mesh(new THREE.CircleGeometry(roofR * 0.09, 8), spotMat);
    spot.position.set(
      Math.cos(a) * r,
      wallH + Math.sin(a * 1.6) * roofR * 0.25 + roofR * 0.32,
      Math.sin(a) * r,
    );
    spot.rotation.x = -Math.PI / 2.3;
    group.add(spot);
  }

  // tiny chimney poking out of the cap
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 0.55, 8),
    new THREE.MeshLambertMaterial({ color: "#8a8a8a" }),
  );
  chimney.position.set(roofR * 0.35, wallH + roofR * 0.62, -roofR * 0.15);
  chimney.rotation.z = -0.15;
  group.add(chimney);

  // grass tucked around the base
  const blades = buildGrassBlades(rand, wallR);
  group.add(blades);

  return group;
}

// small sitting frog — flattened body, bump eyes, hint of front feet
function buildFrog(rand) {
  const group = new THREE.Group();
  const scale = 0.55 + rand() * 0.3;
  const hue = 96 + rand() * 26;
  const bodyMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(`hsl(${hue}, 45%, ${36 + rand() * 10}%)`),
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), bodyMat);
  body.scale.set(1.15 * scale, 0.72 * scale, 1.3 * scale);
  body.position.y = scale * 0.55;
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(`hsl(${hue + 25}, 35%, 80%)`) }),
  );
  belly.scale.copy(body.scale);
  belly.position.copy(body.position);
  group.add(belly);

  [-1, 1].forEach((side) => {
    const bump = new THREE.Mesh(new THREE.SphereGeometry(scale * 0.32, 8, 8), bodyMat);
    bump.position.set(side * scale * 0.4, scale * 1.0, scale * 0.55);
    group.add(bump);
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(scale * 0.15, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x14210f }),
    );
    pupil.position.set(side * scale * 0.4, scale * 1.05, scale * 0.78);
    group.add(pupil);
  });

  [-1, 1].forEach((side) => {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(scale * 0.2, 6, 6), bodyMat);
    foot.scale.set(1.3, 0.5, 1);
    foot.position.set(side * scale * 0.7, scale * 0.16, scale * 0.85);
    group.add(foot);
  });

  group.userData.hopPhase = rand() * Math.PI * 2;
  group.userData.hopSpeed = 0.7 + rand() * 0.7;
  return group;
}

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

function disposeGroup(scene, obj) {
  scene.remove(obj);
  obj.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material?.dispose();
    }
  });
}

// clamps a world-space (x,z) point to inside the regular hexagon centered
// at (WORLD_CENTER, WORLD_CENTER) — a few passes over the 6 edge
// half-planes is plenty for a convex hexagon
function clampPointToHex(wx, wz) {
  let px = wx - WORLD_CENTER;
  let pz = wz - WORLD_CENTER;
  for (let pass = 0; pass < 3; pass++) {
    for (let k = 0; k < 6; k++) {
      const angle = Math.PI / 6 + k * (Math.PI / 3);
      const nx = Math.cos(angle);
      const nz = Math.sin(angle);
      const dist = px * nx + pz * nz;
      if (dist > HEX_APOTHEM) {
        const excess = dist - HEX_APOTHEM;
        px -= nx * excess;
        pz -= nz * excess;
      }
    }
  }
  return { x: px + WORLD_CENTER, z: pz + WORLD_CENTER };
}

// exported so dashboard's movement tick can clamp the character into the
// hex plane (see posRef.current.clampToBounds)
export function clampToHexBounds(nx, ny) {
  const clamped = clampPointToHex(normToWorld(nx), normToWorld(ny));
  return { x: worldToNorm(clamped.x), y: worldToNorm(clamped.z) };
}

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
  const idleTimeRef = useRef(0);
  const hasActiveQuestRef = useRef(false);
  const onArrivedRef = useRef(onArrived);

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

    const scene = new THREE.Scene();
    const skyTex = buildSkyTextureSwamp();
    scene.background = skyTex;
    scene.fog = new THREE.Fog(0xcdeadd, 220, 340);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, 0.1, CAMERA_FAR);
    camera.position.set(WORLD_CENTER, CAMERA_HEIGHT, WORLD_CENTER + CAMERA_BACK_OFFSET);
    camera.lookAt(WORLD_CENTER, 0, WORLD_CENTER);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const sun = new THREE.DirectionalLight(0xfff6dd, 1.15);
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
    const fill = new THREE.DirectionalLight(0xd7ffe0, 0.45);
    fill.position.set(-4, 3, -3);
    scene.add(fill);

    // floating island — now hexagonal instead of square. Sized so the
    // hexagon's apothem comfortably covers the whole square movement
    // area (including its corners), so the character never walks past
    // the visible ground edge.
    const ISLAND_DEPTH = 3.4;
    const GROUND_TOP_Y = -0.01;

    const rockMat = new THREE.MeshLambertMaterial({ color: 0xa8815a });
    const groundGeo = new THREE.CylinderGeometry(HEX_RADIUS, HEX_RADIUS, ISLAND_DEPTH, 6);
    const ground = new THREE.Mesh(groundGeo, rockMat);
    ground.position.set(WORLD_CENTER, GROUND_TOP_Y - ISLAND_DEPTH / 2, WORLD_CENTER);
    ground.receiveShadow = true;
    ground.castShadow = true;
    scene.add(ground);

    // flat hex cap on top, textured with properly tiled (not radial) grass UVs
    const hexTopShape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * HEX_RADIUS;
      const py = Math.sin(a) * HEX_RADIUS;
      if (i === 0) hexTopShape.moveTo(px, py);
      else hexTopShape.lineTo(px, py);
    }
    hexTopShape.closePath();
    const hexTopGeo = new THREE.ShapeGeometry(hexTopShape, 3);
    const grassTopMat = new THREE.MeshLambertMaterial({ color: "#8bc76a" });
    const grassTop = new THREE.Mesh(hexTopGeo, grassTopMat);
    grassTop.rotation.x = -Math.PI / 2;
    grassTop.position.set(WORLD_CENTER, GROUND_TOP_Y + 0.002, WORLD_CENTER);
    grassTop.receiveShadow = true;
    scene.add(grassTop);

    collisionBoxesRef.current = [];

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
    function tooCloseTo(list, x, z, minDist) {
      for (const p of list) {
        const dx = x - p.x;
        const dz = z - p.z;
        if (dx * dx + dz * dz < minDist * minDist) return true;
      }
      return false;
    }
    // true if (x, z) sits inside the hex island, at least edgePad units
    // in from the actual grass edge (so props don't clip off the side)
    function insideHexArea(x, z, edgePad = 0) {
      const px = x - WORLD_CENTER;
      const pz = z - WORLD_CENTER;
      for (let k = 0; k < 6; k++) {
        const angle = Math.PI / 6 + k * (Math.PI / 3);
        const nx = Math.cos(angle);
        const nz = Math.sin(angle);
        if (px * nx + pz * nz > HEX_APOTHEM - edgePad) return false;
      }
      return true;
    }

    // the pond — big and swampy, generously covered in giant lily pads
    const pondSeedA = seededRandom(7);
    const pondSeedB = seededRandom(7);
    const shoreShape = buildBlobShape(POND_RADIUS * 1.18, 0.16, 28, pondSeedA);
    const waterShape = buildBlobShape(POND_RADIUS, 0.18, 28, pondSeedB);

    const shoreMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shoreShape),
      new THREE.MeshLambertMaterial({ color: 0xe0c98a }),
    );
    shoreMesh.rotation.x = -Math.PI / 2;
    shoreMesh.position.set(POND_CENTER_X, 0.0, POND_CENTER_Z);
    shoreMesh.receiveShadow = true;
    scene.add(shoreMesh);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x49d8c2,
      transparent: true,
      opacity: 0.5,
      roughness: 0.08,
      metalness: 0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15,
    });
    const waterMesh = new THREE.Mesh(new THREE.ShapeGeometry(waterShape), waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(POND_CENTER_X, 0.02, POND_CENTER_Z);
    scene.add(waterMesh);

    collisionBoxesRef.current.push({
      cx: worldToNorm(POND_CENTER_X),
      cy: worldToNorm(POND_CENTER_Z),
      hw: (POND_RADIUS * 1.05) / WORLD_SIZE,
      hh: (POND_RADIUS * 1.05) / WORLD_SIZE,
    });

    const padRand = seededRandom(53);
    const lilyPads = [];
    for (let i = 0; i < LILYPAD_COUNT; i++) {
      const a = padRand() * Math.PI * 2;
      const r = padRand() * POND_RADIUS * 0.82;
      const pad = buildLilyPad(0.8 + padRand() * 1.4, padRand);
      pad.material = pad.material.clone();
      pad.material.color = new THREE.Color(
        `hsl(${102 + padRand() * 20}, 62%, ${46 + padRand() * 12}%)`,
      );
      const px = POND_CENTER_X + Math.cos(a) * r;
      const pz = POND_CENTER_Z + Math.sin(a) * r;
      pad.position.set(px, 0.03, pz);
      pad.userData.baseY = 0.03;
      pad.userData.bobSeed = padRand() * Math.PI * 2;
      scene.add(pad);
      lilyPads.push(pad);
    }

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

    // mushroom groves instead of trees
    const mushroomRand = seededRandom(42);
    const mushroomPositions = [];
    const mushroomClusters = [];
    let mAttempts = 0, mPlaced = 0;
    const margin = 2;
    const MUSHROOM_EDGE_PAD = 1.6; // keep clear of the actual hex edge so caps don't clip off the island
    while (mPlaced < MUSHROOM_COUNT && mAttempts < MUSHROOM_COUNT * 40) {
      mAttempts++;
      const mx = WORLD_CENTER + (mushroomRand() - 0.5) * 2 * HEX_APOTHEM;
      const mz = WORLD_CENTER + (mushroomRand() - 0.5) * 2 * HEX_APOTHEM;
      if (!insideHexArea(mx, mz, MUSHROOM_EDGE_PAD)) continue;
      if (inClearing(mx, mz) || insidePond(mx, mz, 2) || tooCloseTo(mushroomPositions, mx, mz, MUSHROOM_MIN_SPACING)) continue;
      const cluster = buildMushroomCluster(mushroomRand);
      cluster.position.set(mx, 0, mz);
      cluster.rotation.y = mushroomRand() * Math.PI * 2;
      scene.add(cluster);
      mushroomClusters.push(cluster);
      mushroomPositions.push({ x: mx, z: mz });
      mPlaced++;
      collisionBoxesRef.current.push({
        cx: worldToNorm(mx),
        cy: worldToNorm(mz),
        hw: 0.9 / WORLD_SIZE,
        hh: 0.9 / WORLD_SIZE,
      });
    }

    // cattails, thickest right around the pond's edge
    const cattailRand = seededRandom(31);
    const cattailPositions = [];
    const cattailClumps = [];
    let cAttempts = 0, cPlaced = 0;
    while (cPlaced < CATTAIL_COUNT && cAttempts < CATTAIL_COUNT * 15) {
      cAttempts++;
      const nearShore = cattailRand() < 0.6;
      let cx, cz;
      if (nearShore) {
        const a = cattailRand() * Math.PI * 2;
        const r = POND_RADIUS * (1.05 + cattailRand() * 0.35);
        cx = POND_CENTER_X + Math.cos(a) * r;
        cz = POND_CENTER_Z + Math.sin(a) * r;
      } else {
        cx = WORLD_MIN + margin + cattailRand() * (WORLD_SIZE - margin * 2);
        cz = WORLD_MIN + margin + cattailRand() * (WORLD_SIZE - margin * 2);
      }
      if (inClearing(cx, cz) || insidePond(cx, cz, 0.5) || tooCloseTo(cattailPositions, cx, cz, 1.1)) continue;
      if (tooCloseTo(mushroomPositions, cx, cz, 1.3)) continue;
      const clump = buildCattailClump(cattailRand);
      clump.position.set(cx, 0, cz);
      clump.rotation.y = cattailRand() * Math.PI * 2;
      scene.add(clump);
      cattailClumps.push(clump);
      cattailPositions.push({ x: cx, z: cz });
      cPlaced++;
    }

    // dirt path from spawn to the pond
    const dirtTex = buildDirtTexture();
    const pathMat = new THREE.MeshBasicMaterial({ map: dirtTex, transparent: true, depthWrite: false });
    const pathRand = seededRandom(71);
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
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

    // moss patches scattered across the grass
    const mossRand = seededRandom(83);
    const mossPositions = [];
    const mossPatches = [];
    let mossAttempts = 0, mossPlaced = 0;
    while (mossPlaced < MOSS_PATCH_COUNT && mossAttempts < MOSS_PATCH_COUNT * 15) {
      mossAttempts++;
      const fx = WORLD_MIN + margin + mossRand() * (WORLD_SIZE - margin * 2);
      const fz = WORLD_MIN + margin + mossRand() * (WORLD_SIZE - margin * 2);
      if (insidePond(fx, fz, 1.6) || tooCloseTo(mossPositions, fx, fz, 2.4)) continue;
      const tex = buildMossPatchTexture(mossRand);
      const size = 2.2 + mossRand() * 1.8;
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = mossRand() * Math.PI * 2;
      patch.position.set(fx, 0.012, fz);
      scene.add(patch);
      mossPositions.push({ x: fx, z: fz });
      mossPatches.push(patch);
      mossPlaced++;
    }

    // flower tufts — bright colorful accents scattered fairly densely
    const flowerRand = seededRandom(211);
    const flowerPositions = [];
    const flowerTufts = [];
    let flowerAttempts = 0, flowerPlaced = 0;
    while (flowerPlaced < FLOWER_TUFT_COUNT && flowerAttempts < FLOWER_TUFT_COUNT * 15) {
      flowerAttempts++;
      const fx = WORLD_MIN + margin + flowerRand() * (WORLD_SIZE - margin * 2);
      const fz = WORLD_MIN + margin + flowerRand() * (WORLD_SIZE - margin * 2);
      if (insidePond(fx, fz, 1.4) || tooCloseTo(flowerPositions, fx, fz, 1.6)) continue;
      if (tooCloseTo(mushroomPositions, fx, fz, 1.1)) continue;
      const tuft = buildFlowerTuft(flowerRand);
      tuft.position.set(fx, 0, fz);
      tuft.rotation.y = flowerRand() * Math.PI * 2;
      scene.add(tuft);
      flowerPositions.push({ x: fx, z: fz });
      flowerTufts.push(tuft);
      flowerPlaced++;
    }

    // small mossy rock clusters, scattered for ground variety
    const rockClusterRand = seededRandom(311);
    const rockClusterPositions = [];
    const rockClusters = [];
    let rockAttempts = 0, rockPlaced = 0;
    while (rockPlaced < ROCK_CLUSTER_COUNT && rockAttempts < ROCK_CLUSTER_COUNT * 15) {
      rockAttempts++;
      const rx = WORLD_MIN + margin + rockClusterRand() * (WORLD_SIZE - margin * 2);
      const rz = WORLD_MIN + margin + rockClusterRand() * (WORLD_SIZE - margin * 2);
      if (inClearing(rx, rz) || insidePond(rx, rz, 1.4) || tooCloseTo(rockClusterPositions, rx, rz, 2.6)) continue;
      if (tooCloseTo(mushroomPositions, rx, rz, 1.4)) continue;
      const cluster = buildRockCluster(rockClusterRand);
      cluster.position.set(rx, 0, rz);
      cluster.rotation.y = rockClusterRand() * Math.PI * 2;
      scene.add(cluster);
      rockClusterPositions.push({ x: rx, z: rz });
      rockClusters.push(cluster);
      rockPlaced++;
    }

    // a tiny mushroom house tucked into the grove, out of the way of the
    // spawn clearing, the pond, and the other mushroom clusters
    const houseRand = seededRandom(401);
    const mushroomHouse = buildMushroomHouse(houseRand);
    let houseX = WORLD_CENTER, houseZ = WORLD_CENTER;
    {
      let hAttempts = 0;
      let placed = false;
      while (hAttempts < 200 && !placed) {
        hAttempts++;
        const hx = WORLD_MIN + margin + houseRand() * (WORLD_SIZE - margin * 2);
        const hz = WORLD_MIN + margin + houseRand() * (WORLD_SIZE - margin * 2);
        if (inClearing(hx, hz) || insidePond(hx, hz, 4)) continue;
        if (tooCloseTo(mushroomPositions, hx, hz, 3.2)) continue;
        houseX = hx;
        houseZ = hz;
        placed = true;
      }
    }
    mushroomHouse.position.set(houseX, 0, houseZ);
    mushroomHouse.rotation.y = houseRand() * Math.PI * 2;
    scene.add(mushroomHouse);
    collisionBoxesRef.current.push({
      cx: worldToNorm(houseX),
      cy: worldToNorm(houseZ),
      hw: 2.1 / WORLD_SIZE,
      hh: 2.1 / WORLD_SIZE,
    });

    // little frogs scattered around the pond edge and grass for froggy vibes
    const frogRand = seededRandom(421);
    const frogPositions = [];
    const frogs = [];
    let frogAttempts = 0, frogPlaced = 0;
    while (frogPlaced < FROG_COUNT && frogAttempts < FROG_COUNT * 30) {
      frogAttempts++;
      const nearShore = frogRand() < 0.65;
      let fx, fz;
      if (nearShore) {
        const a = frogRand() * Math.PI * 2;
        const r = POND_RADIUS * (0.95 + frogRand() * 0.4);
        fx = POND_CENTER_X + Math.cos(a) * r;
        fz = POND_CENTER_Z + Math.sin(a) * r;
      } else {
        fx = WORLD_MIN + margin + frogRand() * (WORLD_SIZE - margin * 2);
        fz = WORLD_MIN + margin + frogRand() * (WORLD_SIZE - margin * 2);
      }
      if (inClearing(fx, fz) || insidePond(fx, fz, 0.6) || tooCloseTo(frogPositions, fx, fz, 2.6)) continue;
      if (tooCloseTo(mushroomPositions, fx, fz, 1.2)) continue;
      const frog = buildFrog(frogRand);
      frog.position.set(fx, 0, fz);
      frog.rotation.y = frogRand() * Math.PI * 2;
      frog.userData.baseX = fx;
      frog.userData.baseZ = fz;
      scene.add(frog);
      frogPositions.push({ x: fx, z: fz });
      frogs.push(frog);
      frogPlaced++;
    }

    // dragonflies drifting in lazy loops
    const dragonflyRand = seededRandom(97);
    const dragonflies = [];
    for (let i = 0; i < DRAGONFLY_COUNT; i++) {
      const hue = 170 + dragonflyRand() * 60;
      const mat = new THREE.SpriteMaterial({ map: buildDragonflyTexture(hue), transparent: true });
      const sprite = new THREE.Sprite(mat);
      const baseScale = 0.55 + dragonflyRand() * 0.25;
      sprite.scale.set(baseScale, baseScale, 1);
      sprite.userData = {
        centerX: WORLD_MIN + margin + dragonflyRand() * (WORLD_SIZE - margin * 2),
        centerZ: WORLD_MIN + margin + dragonflyRand() * (WORLD_SIZE - margin * 2),
        radiusX: 2 + dragonflyRand() * 3,
        radiusZ: 2 + dragonflyRand() * 3,
        speed: 0.5 + dragonflyRand() * 0.5,
        phase: dragonflyRand() * Math.PI * 2,
        bobPhase: dragonflyRand() * Math.PI * 2,
        baseScale,
      };
      scene.add(sprite);
      dragonflies.push(sprite);
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

    // sleepy "Zzz" while idle
    const zzzTex = buildZzzTexture();
    const zzzSprites = [];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.SpriteMaterial({ map: zzzTex, transparent: true, opacity: 0, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.3, 0.3, 1);
      scene.add(sprite);
      zzzSprites.push(sprite);
    }

    // splash droplets + ripples near the pond edge
    const splashTex = buildGlowTexture("220,255,235");
    const droplets = [];
    function spawnSplash(x, z) {
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.SpriteMaterial({ map: splashTex, transparent: true, opacity: 0.85, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.18, 0.18, 1);
        const ang = Math.random() * Math.PI * 2;
        const spd = 0.4 + Math.random() * 0.5;
        sprite.position.set(x, 0.1, z);
        sprite.userData = { vx: Math.cos(ang) * spd, vz: Math.sin(ang) * spd, vy: 0.9 + Math.random() * 0.4 };
        scene.add(sprite);
        droplets.push({ mesh: sprite, born: performance.now(), life: 500 });
      }
    }
    const rippleGeo = new THREE.RingGeometry(0.3, 0.42, 24);
    const ripples = [];
    let ambientRippleTimer = 0;
    let lastSplashTime = -999;
    function spawnRipple(x, z, life = 1.6) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xdff5e6, transparent: true, opacity: 0.5, depthWrite: false });
      const mesh = new THREE.Mesh(rippleGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.035, z);
      scene.add(mesh);
      ripples.push({ mesh, born: performance.now(), life: life * 1000 });
    }

    // the old square MOVEMENT_BOUNDS was much smaller than this hex
    // plane (its half-extent is ~38 world units vs. the hex's ~60 unit
    // apothem) — swap in a generous outer square that never actually
    // triggers, and let the hex clamp be the real, exact boundary
    const outerHalfNorm = (HEX_RADIUS + 4) / WORLD_SIZE;
    posRef.current.bounds = {
      minX: 0.5 - outerHalfNorm,
      maxX: 0.5 + outerHalfNorm,
      minY: 0.5 - outerHalfNorm,
      maxY: 0.5 + outerHalfNorm,
    };
    posRef.current.isWalkable = undefined;
    posRef.current.nearestWalkable = undefined;
    posRef.current.clampToBounds = clampToHexBounds;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const model = modelRef.current;
      const now = performance.now();
      const t = now * 0.001;

      lilyPads.forEach((pad) => {
        pad.position.y = pad.userData.baseY + Math.sin(t * 0.8 + pad.userData.bobSeed) * 0.015;
      });

      fishList.forEach((fish) => {
        const u = fish.userData;
        const angle = t * u.orbitSpeed + u.orbitPhase;
        const nx = POND_CENTER_X + u.orbitOffsetX + Math.cos(angle) * u.orbitRadius;
        const nz = POND_CENTER_Z + u.orbitOffsetZ + Math.sin(angle * 1.3) * u.orbitRadius * 0.7;
        const prevX = fish.position.x, prevZ = fish.position.z;
        fish.position.x = nx;
        fish.position.z = nz;
        const heading = Math.atan2(nx - prevX, nz - prevZ);
        if (isFinite(heading)) fish.rotation.y = heading;
      });

      frogs.forEach((frog) => {
        const u = frog.userData;
        const hop = Math.max(0, Math.sin(t * u.hopSpeed + u.hopPhase));
        frog.position.y = hop * 0.18;
        frog.scale.y = 1 - hop * 0.12;
      });

      dragonflies.forEach((d) => {
        const u = d.userData;
        const angle = t * u.speed + u.phase;
        d.position.x = u.centerX + Math.cos(angle) * u.radiusX;
        d.position.z = u.centerZ + Math.sin(angle * 1.4) * u.radiusZ;
        d.position.y = 1.6 + Math.sin(t * 3 + u.bobPhase) * 0.4;
        const scaleJitter = 1 + Math.sin(t * 10 + u.phase) * 0.08;
        d.scale.set(u.baseScale * scaleJitter, u.baseScale, 1);
      });

      fireflies.forEach((f) => {
        const u = f.userData;
        const angle = t * u.speed + u.phase;
        f.position.x = u.centerX + Math.cos(angle) * u.radius;
        f.position.z = u.centerZ + Math.sin(angle * 0.8) * u.radius;
        f.position.y = u.baseHeight + Math.sin(t * 0.7 + u.phase) * 0.3;
        f.material.opacity = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * u.twinkleSpeed));
      });

      ambientRippleTimer -= 1;
      if (ambientRippleTimer <= 0) {
        ambientRippleTimer = 90 + Math.floor(Math.random() * 60);
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * POND_RADIUS * 0.8;
        spawnRipple(POND_CENTER_X + Math.cos(a) * r, POND_CENTER_Z + Math.sin(a) * r, 2.2);
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        const progress = (now - rp.born) / rp.life;
        if (progress >= 1) {
          scene.remove(rp.mesh);
          rp.mesh.material.dispose();
          ripples.splice(i, 1);
          continue;
        }
        const scale = 0.5 + progress * 4.5;
        rp.mesh.scale.set(scale, scale, scale);
        rp.mesh.material.opacity = 0.5 * (1 - progress);
      }
      for (let i = droplets.length - 1; i >= 0; i--) {
        const d = droplets[i];
        const progress = (now - d.born) / d.life;
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
        keysRef.current.ArrowUp || keysRef.current.ArrowDown ||
        keysRef.current.ArrowLeft || keysRef.current.ArrowRight;

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
        model.position.y = baseY + Math.sin(floatTRef.current) * (isMoving ? 0.1 : 0.05);
        model.position.z = wz;

        if (isMoving) {
          const ddx = wx - POND_CENTER_X;
          const ddz = wz - POND_CENTER_Z;
          const distFromCenter = Math.sqrt(ddx * ddx + ddz * ddz);
          const nearShore = distFromCenter > POND_RADIUS * 0.92 && distFromCenter < POND_RADIUS * 1.3;
          if (nearShore && now - lastSplashTime > 180) {
            lastSplashTime = now;
            const edgeX = POND_CENTER_X + (ddx / distFromCenter) * POND_RADIUS * 1.02;
            const edgeZ = POND_CENTER_Z + (ddz / distFromCenter) * POND_RADIUS * 1.02;
            spawnRipple(edgeX, edgeZ, 0.9);
            spawnSplash(edgeX, edgeZ);
          }
        }

        if (isMoving) idleTimeRef.current = 0;
        else idleTimeRef.current += 1 / 60;
        const showZzz = idleTimeRef.current > 60;
        zzzSprites.forEach((s, i) => {
          const cycle = 2.2;
          const localT = ((t + i * 0.7) % cycle) / cycle;
          s.position.set(wx + 0.4 + Math.sin(t * 1.4 + i) * 0.05, baseY + 1.3 + localT * 0.9, wz - 0.15);
          const fadeIn = Math.min(localT / 0.15, 1);
          const fadeOut = Math.min((1 - localT) / 0.25, 1);
          const targetOpacity = showZzz ? Math.min(fadeIn, fadeOut) * 0.9 : 0;
          s.material.opacity += (targetOpacity - s.material.opacity) * 0.15;
          const scale = 0.22 + localT * 0.18 + i * 0.02;
          s.scale.set(scale, scale, 1);
        });

        const followX = WORLD_CENTER + (wx - WORLD_CENTER) * CAMERA_FOLLOW_FACTOR;
        const followZ = WORLD_CENTER + (wz - WORLD_CENTER) * CAMERA_FOLLOW_FACTOR;
        camera.position.x += (followX - camera.position.x) * CAMERA_LERP;
        camera.position.z += (followZ + CAMERA_BACK_OFFSET - camera.position.z) * CAMERA_LERP;
        camera.position.y = CAMERA_HEIGHT;
        camera.lookAt(followX, 0, followZ);

        if (manualInput) {
          const k = keysRef.current;
          let dx = 0, dz = 0;
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
            const glowTarget = active ? 0.4 + Math.sin(floatTRef.current * 2) * 0.25 : 0;
            child.material.opacity += (glowTarget - child.material.opacity) * 0.08;
          }
        });
      }

      const agent = agentRef.current;
      if (agent && model) {
        agentFloatTRef.current += 0.045;
        const trailAngle = model.rotation.y + Math.PI * 0.78;
        const targetX = model.position.x + Math.sin(trailAngle) * AGENT_FOLLOW_DISTANCE;
        const targetZ = model.position.z + Math.cos(trailAngle) * AGENT_FOLLOW_DISTANCE;
        agent.position.x += (targetX - agent.position.x) * AGENT_FOLLOW_LERP;
        agent.position.z += (targetZ - agent.position.z) * AGENT_FOLLOW_LERP;
        const agentBaseY = agent.userData.baseY ?? 0.3;
        agent.position.y =
          (model.userData.baseY ?? 0) + AGENT_HOVER_HEIGHT + agentBaseY +
          Math.sin(agentFloatTRef.current * 1.6) * 0.09;
        if (agent.userData.glow) {
          agent.userData.glow.material.opacity = 0.32 + Math.sin(agentFloatTRef.current) * 0.15;
        }
        const reportPos = onAgentScreenPositionChangeRef.current;
        if (reportPos && mountRef.current) {
          const worldPos = new THREE.Vector3();
          agent.getWorldPosition(worldPos);
          worldPos.y += agentBaseY;
          const ndc = worldPos.project(camera);
          const mnt = mountRef.current;
          reportPos({
            x: (ndc.x * 0.5 + 0.5) * mnt.clientWidth,
            y: (-ndc.y * 0.5 + 0.5) * mnt.clientHeight,
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
          if (entry.msgSprite) {
            const ALERT_TTL = 6000;
            const alertAt = messageAlertsRef?.current?.get(id);
            const age = alertAt ? now - alertAt : Infinity;
            const active = age < ALERT_TTL;
            const targetOpacity = active ? 0.95 : 0;
            entry.msgSprite.material.opacity += (targetOpacity - entry.msgSprite.material.opacity) * 0.15;
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
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      groundGeo.dispose();
      rockMat.dispose();
      hexTopGeo.dispose();
      grassTopMat.dispose();
      skyTex.dispose();
      waterMesh.geometry.dispose();
      waterMat.dispose();
      shoreMesh.geometry.dispose();
      shoreMesh.material.dispose();
      dirtTex.dispose();
      pathMat.dispose();
      fireflyTex.dispose();
      splashTex.dispose();
      rippleGeo.dispose();
      zzzTex.dispose();
      lilyPads.forEach((pad) => { scene.remove(pad); pad.geometry.dispose(); pad.material.dispose(); });
      fishList.forEach((fish) => { scene.remove(fish); fish.geometry.dispose(); fish.material.dispose(); });
      mushroomClusters.forEach((cluster) => disposeGroup(scene, cluster));
      disposeGroup(scene, mushroomHouse);
      frogs.forEach((frog) => disposeGroup(scene, frog));
      cattailClumps.forEach((clump) => disposeGroup(scene, clump));
      flowerTufts.forEach((tuft) => disposeGroup(scene, tuft));
      rockClusters.forEach((cluster) => disposeGroup(scene, cluster));
      dragonflies.forEach((d) => { scene.remove(d); d.material.map?.dispose(); d.material.dispose(); });
      fireflies.forEach((f) => { scene.remove(f); f.material.dispose(); });
      zzzSprites.forEach((s) => { scene.remove(s); s.material.dispose(); });
      mossPatches.forEach((patch) => { scene.remove(patch); patch.geometry.dispose(); patch.material.map?.dispose(); patch.material.dispose(); });
      ripples.forEach((rp) => { scene.remove(rp.mesh); rp.mesh.material.dispose(); });
      droplets.forEach((d) => { scene.remove(d.mesh); d.mesh.material.dispose(); });
      otherModelsRef.current.forEach((entry) => { scene.remove(entry.pivot); disposePivot(entry.pivot); });
      otherModelsRef.current.clear();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
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
        if (modelRef.current) pivot.position.copy(modelRef.current.position);
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

  // avatar loader
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

  // remote party members
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
          const wx = normToWorld(player.x);
          const wz = normToWorld(player.y);
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

export default React.memo(FrogLandCanvas);
