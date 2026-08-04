import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// how the ai-agent companion trails the player
export const AGENT_TARGET_HEIGHT = 0.55; // world units
export const AGENT_FOLLOW_DISTANCE = 1.3; // trails behind-right of the avatar
export const AGENT_FOLLOW_LERP = 0.07;
export const AGENT_HOVER_HEIGHT = 0.5; // above the avatar's base

// each avatar has its own matching companion
export const agentModelFor = (id) =>
  `/assets/models/ai-agent${id.charAt(0).toUpperCase()}${id.slice(1)}.glb`;

// Config
export const AVATAR_CONFIG = {
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
export const WORLD_SIZE = WORLD_MAX - WORLD_MIN; // 80
const WORLD_CENTER = (WORLD_MIN + WORLD_MAX) / 2; // 8

const TILE_SIZE = 2;
const TILES = WORLD_SIZE / TILE_SIZE;
const TREE_COUNT = 210;
const BUSH_COUNT = 130;
const PX = 64;

// ambient extras
const FLOWER_PATCH_COUNT = 30; // marigold/poppy wildflower patches around the fields
const BUTTERFLY_COUNT = 9;
const FIREFLY_COUNT = 16; // drifting pollen motes over the crops in the evening light
const TOMATO_ROWS = 6;
const TOMATO_PER_ROW = 9;
const HAY_BALE_COUNT = 10;
const CRATE_COUNT = 8;

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

// tomato garden 
export const GARDEN_CENTER_X = WORLD_MAX - 15;
export const GARDEN_CENTER_Z = WORLD_MAX - 11;
export const GARDEN_RADIUS = 7.5;
// kept as aliases in case other files still import the old pond names
export const POND_CENTER_X = GARDEN_CENTER_X;
export const POND_CENTER_Z = GARDEN_CENTER_Z;
export const POND_RADIUS = GARDEN_RADIUS;

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

      const hue = 92 + ((row * 4 + col) % 5) * 4;
      ctx.fillStyle = `hsl(${hue}, 48%, 40%)`;
      ctx.fillRect(x, y, PX, PX);

      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, PX - 1, PX - 1);

      ctx.fillStyle = `hsl(${hue + 10}, 52%, 50%)`;
      const rng = (row * 4 + col + 1) * 13;
      for (let i = 0; i < 6; i++) {
        const bx = x + ((rng * (i + 1) * 7) % (PX - 8)) + 4;
        const by = y + ((rng * (i + 1) * 11) % (PX - 10)) + 5;
        ctx.fillRect(bx, by, 2, 5);
        ctx.fillRect(bx + 3, by + 2, 2, 4);
      }

      // little flecks of fallen tomato and gold chaff scattered in the grass
      if ((row + col) % 3 === 0) {
        ctx.fillStyle = "#d9503a";
        ctx.beginPath();
        ctx.arc(
          x + 20 + ((col * 7) % 24),
          y + 20 + ((row * 9) % 24),
          3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = "#f4d27a";
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
export function buildWaterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, "#4cc3ea");
  grad.addColorStop(1, "#2e9ddb");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  // soft white caustic swirl lines, like light rippling on the surface
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

  // finer secondary swirls for depth
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
export function buildSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#7ec3e8");
  grad.addColorStop(0.42, "#bfe0c8");
  grad.addColorStop(0.72, "#f3e2a3");
  grad.addColorStop(1, "#ffcf8f");
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
export function buildGlowTexture(rgb) {
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
export function buildLilyPad(radius, rand) {
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

// a single tomato plant — stem, leafy puffs, and a handful of ripening fruit
function buildTomatoPlant(rand) {
  const group = new THREE.Group();
  const height = 0.55 + rand() * 0.35;

  const stemMat = new THREE.MeshLambertMaterial({ color: 0x3f6b2c });
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, height, 6),
    stemMat,
  );
  stem.position.y = height / 2;
  stem.castShadow = true;
  group.add(stem);

  const leafMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(`hsl(${96 + rand() * 20}, 45%, ${30 + rand() * 10}%)`),
    flatShading: true,
  });
  const leafCount = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < leafCount; i++) {
    const r = 0.13 + rand() * 0.09;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafMat);
    leaf.scale.set(1, 0.6, 1);
    leaf.position.set(
      (rand() - 0.5) * 0.28,
      height * (0.45 + rand() * 0.5),
      (rand() - 0.5) * 0.28,
    );
    leaf.rotation.y = rand() * Math.PI;
    leaf.castShadow = true;
    group.add(leaf);
  }

  const ripeMat = new THREE.MeshStandardMaterial({
    color: 0xd94a2b,
    roughness: 0.4,
    metalness: 0.05,
  });
  const greenMat = new THREE.MeshStandardMaterial({
    color: 0x7fa347,
    roughness: 0.5,
  });
  const tomatoCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < tomatoCount; i++) {
    const r = 0.055 + rand() * 0.035;
    const tomato = new THREE.Mesh(
      new THREE.SphereGeometry(r, 8, 8),
      rand() > 0.25 ? ripeMat : greenMat,
    );
    tomato.position.set(
      (rand() - 0.5) * 0.3,
      height * (0.35 + rand() * 0.55),
      (rand() - 0.5) * 0.3,
    );
    tomato.castShadow = true;
    group.add(tomato);
  }

  group.userData.swaySeed = rand() * Math.PI * 2;
  return group;
}

// squat striped hay bale
function buildHayBale(rand) {
  const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.62, 14);
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(`hsl(${42 + rand() * 8}, 55%, ${52 + rand() * 8}%)`),
  });
  const bale = new THREE.Mesh(geo, mat);
  bale.rotation.z = Math.PI / 2;
  bale.castShadow = true;
  bale.receiveShadow = true;
  return bale;
}

// wooden crate stacked with freshly picked tomatoes
function buildCrate(rand) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a5a34 });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), woodMat);
  crate.position.y = 0.2;
  crate.castShadow = true;
  crate.receiveShadow = true;
  group.add(crate);

  const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xd94a2b, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const r = 0.07 + rand() * 0.02;
    const t = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), tomatoMat);
    t.position.set((rand() - 0.5) * 0.4, 0.42 + rand() * 0.08, (rand() - 0.5) * 0.4);
    t.castShadow = true;
    group.add(t);
  }
  return group;
}

// plain wooden fence post, ringed around the garden plot
function buildFencePost() {
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a5a34 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.85, 6), woodMat);
  post.position.y = 0.42;
  post.castShadow = true;
  post.receiveShadow = true;
  return post;
}

// a friendly scarecrow keeping watch over the crops
function buildScarecrow() {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x7a5330 });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.0, 6), woodMat);
  post.position.y = 1.0;
  post.castShadow = true;
  group.add(post);

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), woodMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.y = 1.5;
  beam.castShadow = true;
  group.add(beam);

  const shirtMat = new THREE.MeshLambertMaterial({ color: 0xb2472f });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.7, 8), shirtMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  group.add(torso);

  const sackMat = new THREE.MeshLambertMaterial({ color: 0xcbab6f });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), sackMat);
  head.position.y = 1.95;
  head.castShadow = true;
  group.add(head);

  const hatMat = new THREE.MeshLambertMaterial({ color: 0x4a3826 });
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 12), hatMat);
  hatBrim.position.y = 2.1;
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 12), hatMat);
  hatTop.position.y = 2.24;
  group.add(hatBrim, hatTop);

  const strawMat = new THREE.MeshLambertMaterial({ color: 0xe0c264 });
  for (let i = 0; i < 5; i++) {
    const straw = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.3, 4), strawMat);
    straw.position.set(-0.55 + i * 0.03, 1.55, 0);
    straw.rotation.z = Math.PI / 2.6;
    group.add(straw);
    const straw2 = straw.clone();
    straw2.position.x = 0.55 - i * 0.03;
    straw2.rotation.z = -Math.PI / 2.6;
    group.add(straw2);
  }

  return group;
}

// height (world units) that spawned trees are randomised between
const TREE_MIN_HEIGHT = 1.8;
const TREE_MAX_HEIGHT = 3.0;

// Seeded random
export function seededRandom(seed) {
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
export function buildAvatarPivot(gltf, cfg) {
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
export function buildAgentPivot(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      // only fall back to a flat material if the mesh truly has none —
      // don't override a glb's own baked-in material/color
      if (!child.material) {
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

export function disposePivot(pivot) {
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
export function buildMessageBubbleTexture() {
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
  const agentPrevPlayerPosRef = useRef({ x: null, z: null });
  const onAgentScreenPositionChangeRef = useRef(onAgentScreenPositionChange);

  // ambient farm music plus a footstep loop toggled on/off as the character moves
  const bgMusicRef = useRef(null);
  const walkAudioRef = useRef(null);
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
    const skyTex = buildSkyTexture();
    scene.background = skyTex;
    scene.fog = new THREE.Fog(0xf0e2b8, WORLD_SIZE * 0.48, WORLD_SIZE * 0.88);
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

    // background farm music, loops for the whole session
    const bgMusic = new Audio("/assets/audio/backgroundTomato.mp3");
    bgMusic.loop = true;
    bgMusic.volume = 0.35;
    const resumeMusicOnInteract = () => {
      bgMusic.play().catch(() => { });
      window.removeEventListener("pointerdown", resumeMusicOnInteract);
      window.removeEventListener("keydown", resumeMusicOnInteract);
    };
    bgMusic.play().catch(() => {
      // autoplay is blocked until the user interacts with the page —
      // pick it back up on their first click or keypress
      window.addEventListener("pointerdown", resumeMusicOnInteract);
      window.addEventListener("keydown", resumeMusicOnInteract);
    });
    bgMusicRef.current = bgMusic;

    // footstep loop — started/stopped whenever the character starts/stops moving
    const walkAudio = new Audio("/assets/audio/walkingGround.mp3");
    walkAudio.loop = true;
    walkAudio.volume = 0.5;
    walkAudioRef.current = walkAudio;

    // Lights
    scene.add(new THREE.AmbientLight(0xfff1d6, 2.0));
    const sun = new THREE.DirectionalLight(0xfff4dd, 1.0);
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

    // Grass ground — built with real thickness so it reads as a floating
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

    // tomato garden — a fenced farm plot where the pond used to be
    const gardenSeed = seededRandom(7);
    const plotShape = buildBlobShape(GARDEN_RADIUS * 1.05, 0.12, 28, gardenSeed);
    const tilledMat = new THREE.MeshLambertMaterial({ color: 0x6b4a30 });
    const tilledMesh = new THREE.Mesh(new THREE.ShapeGeometry(plotShape), tilledMat);
    tilledMesh.rotation.x = -Math.PI / 2;
    tilledMesh.position.set(GARDEN_CENTER_X, 0.008, GARDEN_CENTER_Z);
    tilledMesh.receiveShadow = true;
    scene.add(tilledMesh);

    // furrow stripes across the tilled soil, so it reads as a proper crop plot
    const furrowMat = new THREE.MeshBasicMaterial({
      color: 0x543a24,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const furrowGroup = new THREE.Group();
    for (let i = -5; i <= 5; i++) {
      const furrow = new THREE.Mesh(
        new THREE.PlaneGeometry(GARDEN_RADIUS * 2.1, 0.12),
        furrowMat,
      );
      furrow.rotation.x = -Math.PI / 2;
      furrow.position.set(GARDEN_CENTER_X, 0.01, GARDEN_CENTER_Z + i * 0.95);
      furrowGroup.add(furrow);
    }
    scene.add(furrowGroup);

    // rows of tomato plants filling the plot
    const tomatoRand = seededRandom(157);
    const tomatoPlants = [];
    for (let row = 0; row < TOMATO_ROWS; row++) {
      for (let col = 0; col < TOMATO_PER_ROW; col++) {
        const rowSpread = (row / (TOMATO_ROWS - 1) - 0.5) * GARDEN_RADIUS * 1.5;
        const colSpread = (col / (TOMATO_PER_ROW - 1) - 0.5) * GARDEN_RADIUS * 1.7;
        const px = GARDEN_CENTER_X + colSpread + (tomatoRand() - 0.5) * 0.25;
        const pz = GARDEN_CENTER_Z + rowSpread + (tomatoRand() - 0.5) * 0.25;
        const dx = px - GARDEN_CENTER_X;
        const dz = pz - GARDEN_CENTER_Z;
        if (dx * dx + dz * dz > (GARDEN_RADIUS * 0.98) * (GARDEN_RADIUS * 0.98)) continue;
        const plant = buildTomatoPlant(tomatoRand);
        plant.position.set(px, 0, pz);
        plant.rotation.y = tomatoRand() * Math.PI * 2;
        scene.add(plant);
        tomatoPlants.push(plant);
      }
    }

    // wooden fence ringing the plot
    const fenceRand = seededRandom(211);
    const FENCE_POSTS = 26;
    const fencePosts = [];
    for (let i = 0; i < FENCE_POSTS; i++) {
      const a = (i / FENCE_POSTS) * Math.PI * 2;
      const r = GARDEN_RADIUS * 1.12 * (1 + (fenceRand() - 0.5) * 0.06);
      const post = buildFencePost();
      post.position.set(
        GARDEN_CENTER_X + Math.cos(a) * r,
        0,
        GARDEN_CENTER_Z + Math.sin(a) * r,
      );
      post.rotation.y = fenceRand() * Math.PI;
      scene.add(post);
      fencePosts.push(post);
    }

    // hay bales and crates parked around the field's edge
    const farmPropRand = seededRandom(233);
    const farmProps = [];
    for (let i = 0; i < HAY_BALE_COUNT; i++) {
      const a = farmPropRand() * Math.PI * 2;
      const r = GARDEN_RADIUS * (1.25 + farmPropRand() * 0.35);
      const bale = buildHayBale(farmPropRand);
      bale.position.set(
        GARDEN_CENTER_X + Math.cos(a) * r,
        0.42,
        GARDEN_CENTER_Z + Math.sin(a) * r,
      );
      bale.rotation.y = farmPropRand() * Math.PI;
      scene.add(bale);
      farmProps.push(bale);
    }
    for (let i = 0; i < CRATE_COUNT; i++) {
      const a = farmPropRand() * Math.PI * 2;
      const r = GARDEN_RADIUS * (1.2 + farmPropRand() * 0.4);
      const crate = buildCrate(farmPropRand);
      crate.position.set(
        GARDEN_CENTER_X + Math.cos(a) * r,
        0,
        GARDEN_CENTER_Z + Math.sin(a) * r,
      );
      crate.rotation.y = farmPropRand() * Math.PI;
      scene.add(crate);
      farmProps.push(crate);
    }

    // scarecrow keeping watch over the crops
    const scarecrow = buildScarecrow();
    scarecrow.position.set(GARDEN_CENTER_X, 0, GARDEN_CENTER_Z - GARDEN_RADIUS * 0.55);
    scarecrow.rotation.y = Math.PI * 0.15;
    scene.add(scarecrow);

    // block so the character can't walk straight through the fenced garden
    collisionBoxesRef.current.push({
      cx: worldToNorm(GARDEN_CENTER_X),
      cy: worldToNorm(GARDEN_CENTER_Z),
      hw: (GARDEN_RADIUS * 1.05) / WORLD_SIZE,
      hh: (GARDEN_RADIUS * 1.05) / WORLD_SIZE,
    });
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
    function inGarden(x, z, pad) {
      const dx = x - GARDEN_CENTER_X;
      const dz = z - GARDEN_CENTER_Z;
      return dx * dx + dz * dz < (GARDEN_RADIUS + pad) * (GARDEN_RADIUS + pad);
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
      if (inGarden(bx, bz, 1.2)) continue;
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
      const px = THREE.MathUtils.lerp(WORLD_CENTER, GARDEN_CENTER_X, t) + wiggle;
      const pz = THREE.MathUtils.lerp(WORLD_CENTER, GARDEN_CENTER_Z, t);
      if (inGarden(px, pz, 1.5)) continue;
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
      [28, 45, 15], // marigold oranges and golds
      [50, 40, 340], // sunflower yellow with a hint of pink
      [10, 350, 30], // poppy red and warm orange
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
      if (inGarden(fx, fz, 1.6)) continue;
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
          if (inGarden(tx, tz, 1.8)) continue;
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

      // cloud drift
      cloudMeshes.forEach((c) => {
        c.position.x += c.userData.driftSpeed;
        if (c.position.x > WORLD_MAX + WORLD_SIZE * 0.25) {
          c.position.x = WORLD_MIN - WORLD_SIZE * 0.25;
        }
      });

      const now = performance.now();
      const t = now * 0.001;

      // tomato plants sway gently in the breeze
      tomatoPlants.forEach((plant) => {
        plant.rotation.z = Math.sin(t * 0.6 + plant.userData.swaySeed) * 0.035;
        plant.rotation.x = Math.cos(t * 0.5 + plant.userData.swaySeed) * 0.02;
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

        // toggle the footstep loop on/off whenever movement starts or stops
        if (isMoving !== wasMovingRef.current) {
          wasMovingRef.current = isMoving;
          const walkAudio = walkAudioRef.current;
          if (walkAudio) {
            if (isMoving) {
              walkAudio.currentTime = 0;
              walkAudio.play().catch(() => { });
            } else {
              walkAudio.pause();
            }
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

        const prevPlayer = agentPrevPlayerPosRef.current;
        const moveDX = prevPlayer.x === null ? 0 : model.position.x - prevPlayer.x;
        const moveDZ = prevPlayer.z === null ? 0 : model.position.z - prevPlayer.z;

        // carry the agent by the exact same amount the character moved this
        // frame, so it keeps pace with her instead of trailing farther and
        // farther behind while she's actively running
        if (prevPlayer.x !== null) {
          agent.position.x += moveDX;
          agent.position.z += moveDZ;
        }
        prevPlayer.x = model.position.x;
        prevPlayer.z = model.position.z;

        // face whichever way she's actually moving
        if (Math.abs(moveDX) > 0.0004 || Math.abs(moveDZ) > 0.0004) {
          const targetAgentAngle = Math.atan2(moveDX, moveDZ);
          let agentDelta = targetAgentAngle - agent.rotation.y;
          while (agentDelta > Math.PI) agentDelta -= Math.PI * 2;
          while (agentDelta < -Math.PI) agentDelta += Math.PI * 2;
          agent.rotation.y += agentDelta * 0.18;
        }

        const trailAngle = model.rotation.y + Math.PI * 0.78;
        const targetX =
          model.position.x + Math.sin(trailAngle) * AGENT_FOLLOW_DISTANCE;
        const targetZ =
          model.position.z + Math.cos(trailAngle) * AGENT_FOLLOW_DISTANCE;

        // gentle corrective pull to keep it near its proper trailing spot
        // (fixes spawn offset / drift) without being the main speed driver
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
          worldPos.y += agentBaseY; // center of the creature, not above it
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
      window.removeEventListener("pointerdown", resumeMusicOnInteract);
      window.removeEventListener("keydown", resumeMusicOnInteract);
      bgMusicRef.current?.pause();
      bgMusicRef.current = null;
      walkAudioRef.current?.pause();
      walkAudioRef.current = null;
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
      cloudMeshes.forEach((c) => {
        c.geometry.dispose();
        c.material.dispose();
      });
      skyTex.dispose();
      dirtTex.dispose();
      pathMat.dispose();
      fireflyTex.dispose();
      flowerTextures.forEach((tx) => tx.dispose());
      tilledMesh.geometry.dispose();
      tilledMat.dispose();
      furrowGroup.children.forEach((f) => f.geometry.dispose());
      furrowMat.dispose();
      tomatoPlants.forEach((plant) => {
        scene.remove(plant);
        disposePivot(plant);
      });
      fencePosts.forEach((post) => {
        scene.remove(post);
        disposePivot(post);
      });
      farmProps.forEach((prop) => {
        scene.remove(prop);
        disposePivot(prop);
      });
      scene.remove(scarecrow);
      disposePivot(scarecrow);
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

  // ai-agent companion — swaps to match whichever avatar the player is
  // wearing, and reloads if they change avatars
  useEffect(() => {
    if (!sceneRef.current || !avatarId) return;
    let cancelled = false;
    const agentLoader = new GLTFLoader();

    if (agentRef.current) {
      sceneRef.current.remove(agentRef.current);
      disposePivot(agentRef.current);
      agentRef.current = null;
    }
    agentPrevPlayerPosRef.current = { x: null, z: null };

    agentLoader.load(
      agentModelFor(avatarId),
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