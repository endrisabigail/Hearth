import * as THREE from "three";
import { loadGeometry, sceneryMaterial } from "../engine/assets.js";
import { addSway, makeWater, glowSprite } from "../engine/shaders.js";
import { ParticleField } from "../engine/particles.js";
import { rng, fbm, smooth, colored, merge, at, mat, makeGround, setupAtmosphere, setupLights, instanced, scatter, ringPoints, rockGeo, blobTree, bushGeo, Flock, GrowthSet, nearAny } from "./kit.js";

const sx = (z) => 13 + Math.sin(z * 0.18) * 2.5;
const SW = 1.7;
const inStream = (x, z, pad = 0) => Math.abs(x - sx(z)) < SW + pad;
const BRIDGE = { z: 0, half: 1.3 };
const onBridge = (x, z) => Math.abs(z - BRIDGE.z) < BRIDGE.half && Math.abs(x - sx(BRIDGE.z)) < SW + 1.2;
const ZEN = { x: -9, z: -6, r: 5 };

function streamGeo() {
  const g = new THREE.PlaneGeometry(SW * 2 + 0.6, 90, 6, 120);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + sx(p.getZ(i)));
  g.computeVertexNormals();
  return g;
}

function bridgeGeo() {
  const parts = [];
  const span = (SW + 1.2) * 2;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = -span / 2 + t * span;
    const y = Math.sin(t * Math.PI) * 0.75;
    parts.push(colored(at(new THREE.BoxGeometry(span / n + 0.04, 0.12, BRIDGE.half * 2), x, y + 0.1, 0, { rz: Math.cos(t * Math.PI) * 0.35 }), "#b0453a"));
  }
  for (const z of [-BRIDGE.half, BRIDGE.half]) {
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const x = -span / 2 + t * span;
      const y = Math.sin(t * Math.PI) * 0.75;
      parts.push(colored(at(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 5), x, y + 0.5, z), "#c4503f"));
    }
    for (let i = 0; i < 10; i++) {
      const t = (i + 0.5) / 10;
      const x = -span / 2 + t * span;
      const y = Math.sin(t * Math.PI) * 0.75;
      parts.push(colored(at(new THREE.BoxGeometry(span / 10 + 0.05, 0.08, 0.1), x, y + 0.88, z, { rz: Math.cos(t * Math.PI) * 0.35 }), "#c4503f"));
    }
  }
  return merge(parts);
}

function stoneLanternGeo() {
  return merge([
    colored(at(new THREE.CylinderGeometry(0.45, 0.55, 0.25, 6), 0, 0.12, 0), "#9a9d94"),
    colored(at(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 6), 0, 0.7, 0), "#a3a69c"),
    colored(at(new THREE.CylinderGeometry(0.4, 0.3, 0.16, 6), 0, 1.2, 0), "#9a9d94"),
    colored(at(new THREE.BoxGeometry(0.46, 0.42, 0.46), 0, 1.5, 0), "#8e9189"),
    colored(at(new THREE.BoxGeometry(0.3, 0.26, 0.5), 0, 1.5, 0), "#ffd58a"),
    colored(at(new THREE.ConeGeometry(0.62, 0.42, 6), 0, 1.92, 0), "#82867e"),
    colored(at(new THREE.SphereGeometry(0.1, 6, 4), 0, 2.18, 0), "#82867e"),
  ]);
}

function bambooGeo(rand) {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const h = 4 + rand() * 3;
    const x = (rand() - 0.5) * 1.6;
    const z = (rand() - 0.5) * 1.6;
    for (let y = 0; y < h; y += 0.8) parts.push(colored(at(new THREE.CylinderGeometry(0.07, 0.08, 0.76, 6), x, y + 0.38, z), "#7fae55"));
    for (let k = 0; k < 4; k++) parts.push(colored(at(new THREE.ConeGeometry(0.1, 0.7, 3), x + (rand() - 0.5) * 0.6, h - k * 0.5, z + (rand() - 0.5) * 0.6, { rz: (rand() - 0.5) * 2, rx: (rand() - 0.5) * 2, sz: 0.2 }), "#8fc062"));
  }
  return merge(parts);
}

function hostaGeo(rand, color = "#6fa35a") {
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const g = new THREE.SphereGeometry(0.32, 6, 4);
    parts.push(colored(at(g, Math.cos(a) * 0.32, 0.28, Math.sin(a) * 0.32, { sx: 0.5, sy: 0.12, sz: 1, ry: -a + Math.PI / 2, rx: 0.5 }), i % 2 ? color : "#8fc070"));
  }
  return merge(parts);
}

function fernGeo(rand) {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand();
    parts.push(colored(at(new THREE.ConeGeometry(0.14, 1.1, 3), Math.cos(a) * 0.35, 0.35, Math.sin(a) * 0.35, { rz: Math.cos(a) * 0.9, rx: -Math.sin(a) * 0.9, sz: 0.25 }), "#4f8a45", 0.1, rand));
  }
  return merge(parts);
}

function mapleGeo(rand) {
  return blobTree(rand, { trunk: "#4f3a30", leaves: ["#c9483a", "#e0703e"], h: 3, w: 1.8 });
}

function snailGeo() {
  return merge([
    colored(at(new THREE.CapsuleGeometry(0.08, 0.32, 3, 6), 0, 0.08, 0, { rx: Math.PI / 2 }), "#d8c39e"),
    colored(at(new THREE.TorusGeometry(0.11, 0.07, 6, 10), 0, 0.2, -0.04, { ry: Math.PI / 2 }), "#b97a4a"),
    colored(at(new THREE.SphereGeometry(0.06, 6, 4), 0, 0.2, -0.04), "#8f5a36"),
    colored(at(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 3), 0.03, 0.18, 0.2, { rx: -0.4 }), "#d8c39e"),
    colored(at(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 3), -0.03, 0.18, 0.2, { rx: -0.4 }), "#d8c39e"),
  ]);
}

function koiGeo() {
  return merge([
    colored(at(new THREE.SphereGeometry(0.16, 8, 6), 0, 0, 0, { sx: 0.5, sy: 0.4, sz: 1.2 }), "#ffffff"),
    colored(at(new THREE.ConeGeometry(0.1, 0.18, 4), 0, 0, -0.24, { rx: -Math.PI / 2, sx: 0.2 }), "#ffffff"),
  ]);
}

function rainbowGeo() {
  const g = new THREE.TorusGeometry(40, 2.6, 6, 48, Math.PI);
  const p = g.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const bands = ["#ff6b6b", "#ffb36b", "#fff06b", "#7fe08a", "#6bb8ff", "#b18cff"].map((c) => new THREE.Color(c));
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    const k = Math.min(bands.length - 1, Math.max(0, Math.floor(((r - 37.4) / 5.2) * bands.length)));
    const c = bands[bands.length - 1 - k];
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  return g;
}

function markerGeo() {
  const leaf = new THREE.SphereGeometry(0.6, 10, 6);
  return merge([
    colored(at(new THREE.CylinderGeometry(0.5, 0.65, 0.3, 7), 0, 0.15, 0), "#9a9d94", 0.08),
    colored(at(leaf, 0, 0.42, 0, { sy: 0.14, sz: 1.2, rx: 0.2 }), "#5f9e4a"),
    colored(at(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 3), 0, 0.5, 0, { rx: Math.PI / 2 + 0.2 }), "#86c26a"),
    colored(at(new THREE.SphereGeometry(0.22, 12, 10), 0.05, 0.66, 0.1), "#cfefff"),
  ]);
}

export async function build({ engine, quality }) {
  const rand = rng(91);
  const scene = engine.scene;
  const u = engine.uniforms;
  const lowQ = quality === "low";

  const sky = setupAtmosphere(engine, { top: "#7f939a", mid: "#b2c0bd", bottom: "#d9e1da", fog: "#adbcb8", fogNear: 24, fogFar: 92, sun: [0.3, 0.4, -0.85], sunColor: "#fff8e0", sunSize: 0.03, exposure: 1.05 });
  sky.material.uniforms.uSun.value = 0;
  const { sun, hemi } = setupLights(engine, { sunDir: [10, 22, -12], sunColor: "#f1efe4", sunIntensity: 1.1, sky: "#e3ece8", ground: "#56684f", hemi: 1.9 });

  const anchors = [
    { x: -3.5, z: 5 },
    { x: 4, z: -4.5 },
    { x: -2, z: -10 },
    { x: 6, z: 7.5 },
    { x: -9.5, z: 4.5 },
    { x: -15, z: -2 },
    { x: 1, z: 14 },
    { x: 19.5, z: -6 },
    { x: 19, z: 8 },
  ];
  const nearAnchor = nearAny(anchors, 2.2);

  const height = (x, z) => {
    const s = -smooth(SW + 0.8, SW - 0.6, Math.abs(x - sx(z))) * 0.7;
    return s + smooth(27, 60, Math.hypot(x, z)) * (fbm(x * 0.05, z * 0.05) * 9 + 1);
  };
  scene.add(
    makeGround({
      radius: 110,
      height,
      color: (x, z) => {
        const dz = Math.hypot(x - ZEN.x, z - ZEN.z);
        if (dz < ZEN.r) return Math.sin(dz * 5) > 0.2 ? "#b3b1a4" : "#9f9d90";
        if (dz < ZEN.r + 0.35) return "#8d8f86";
        if (Math.abs(x - sx(z)) < SW + 0.6) return "#6a6f5f";
        const n = fbm(x * 0.2, z * 0.2);
        return new THREE.Color("#55784a").lerp(new THREE.Color("#7a9a5c"), n).lerp(new THREE.Color("#3f6a3d"), smooth(28, 70, Math.hypot(x, z)) * 0.5);
      },
    }),
  );

  const water = makeWater(u, streamGeo(), { deep: "#3f6a6a", shallow: "#5f8a85", foam: "#dfeee8", sky: "#b8c8c4", radius: 200, opacity: 0.9 });
  water.position.y = -0.12;
  scene.add(water);

  const obstacles = [];
  const sceneryMat = mat();

  const bridge = new THREE.Mesh(bridgeGeo(), sceneryMat);
  bridge.position.set(sx(BRIDGE.z), 0, BRIDGE.z);
  bridge.castShadow = true;
  bridge.receiveShadow = true;
  scene.add(bridge);

  const zenRock = new THREE.Mesh(rockGeo(rand, "#7f8279", { detail: 1, s: 1.6, squash: 0.9 }), sceneryMat);
  zenRock.position.set(ZEN.x, 0, ZEN.z);
  zenRock.castShadow = true;
  scene.add(zenRock);
  const zenRock2 = new THREE.Mesh(rockGeo(rand, "#8a8d84", { detail: 1, s: 0.8 }), sceneryMat);
  zenRock2.position.set(ZEN.x + 2, 0, ZEN.z + 1.4);
  scene.add(zenRock2);
  obstacles.push({ x: ZEN.x, z: ZEN.z, r: 1.6 }, { x: ZEN.x + 2, z: ZEN.z + 1.4, r: 0.8 });

  const lanterns = [
    { x: -5.5, z: -1 },
    { x: 1.5, z: 3 },
    { x: 8.5, z: -1.5 },
    { x: 8.5, z: 1.8 },
    { x: -12, z: -10.5 },
    { x: -4, z: 11 },
    { x: 4, z: -13 },
  ];
  scene.add(instanced(stoneLanternGeo(), sceneryMat, lanterns.map((p) => ({ ...p, ry: rand() * 6 })), { castShadow: true }));
  lanterns.forEach((p) => obstacles.push({ x: p.x, z: p.z, r: 0.5 }));
  const growth = new GrowthSet(engine, 1);
  lanterns.forEach((p) => {
    const g = glowSprite("#ffcf7a", 2.4, 0.75);
    g.position.set(p.x, 1.5, p.z);
    scene.add(g);
    growth.add(g);
  });

  const avoid = (x, z) => nearAnchor(x, z) || inStream(x, z, 1.2) || Math.hypot(x - ZEN.x, z - ZEN.z) < ZEN.r + 1 || lanterns.some((l) => Math.hypot(l.x - x, l.z - z) < 1.5);
  const bamboo = [
    ...ringPoints(6, 3, { cx: -16, cz: -14, jitter: 1, rand }),
    ...ringPoints(5, 2.5, { cx: 20, cz: -17, jitter: 1, rand }),
    ...scatter(rand, lowQ ? 10 : 22, { rMin: 26, rMax: 40, minDist: 3 }),
  ].map((p) => ({ x: p.x, z: p.z, y: height(p.x, p.z), s: 1 + rand() * 0.4, ry: rand() * 6 }));
  scene.add(instanced(bambooGeo(rand), addSway(mat(), u, { strength: 0.006, speed: 0.9, height: 0.6 }), bamboo, { castShadow: !lowQ }));
  bamboo.filter((p) => Math.hypot(p.x, p.z) < 25).forEach((p) => obstacles.push({ x: p.x, z: p.z, r: 0.9 }));

  const maples = [{ x: -18, z: 7 }, { x: 4, z: -19 }, { x: -6, z: 19 }].map((p) => ({ ...p, s: 1.3, ry: rand() * 6 }));
  scene.add(instanced(mapleGeo(rand), addSway(mat(), u, { strength: 0.012, speed: 1, height: 0.5 }), maples, { castShadow: true }));
  maples.forEach((p) => obstacles.push({ x: p.x, z: p.z, r: 0.8 }));

  const treeGeo = await loadGeometry("/models/tree.glb");
  const pines = scatter(rand, lowQ ? 40 : 70, { rMin: 28, rMax: 60, minDist: 3.4 }).map((p) => ({ ...p, y: height(p.x, p.z) - 0.1, s: 3.4 + rand() * 2.2, ry: rand() * 6, color: "#7fa58a" }));
  scene.add(instanced(treeGeo, sceneryMaterial(), pines));

  const hostas = scatter(rand, lowQ ? 30 : 55, { rMin: 4, rMax: 25, minDist: 1.6, avoid }).map((p) => ({ ...p, s: 1 + rand() * 0.9, ry: rand() * 6 }));
  scene.add(instanced(hostaGeo(rand), addSway(mat(), u, { strength: 0.08, speed: 1.6, height: 1.5 }), hostas, { castShadow: !lowQ }));
  const ferns = scatter(rand, lowQ ? 30 : 60, { rMin: 4, rMax: 25, minDist: 1.4, avoid, existing: hostas }).map((p) => ({ ...p, s: 1 + rand() * 0.6, ry: rand() * 6 }));
  scene.add(instanced(fernGeo(rand), addSway(mat(), u, { strength: 0.1, speed: 1.8, height: 1.5 }), ferns));

  const moss = scatter(rand, 16, { rMin: 4, rMax: 24, minDist: 2.5, avoid, existing: [...hostas, ...ferns] }).map((p) => ({ ...p, s: 0.7 + rand() * 0.6, ry: rand() * 6 }));
  scene.add(instanced(bushGeo(rand, ["#5f9a4a", "#78ad55"], 1), sceneryMat, moss.map((p) => ({ ...p, sy: p.s * 0.6 }))));
  const rocks = scatter(rand, 16, { rMin: 5, rMax: 25, minDist: 3, avoid }).map((p) => ({ ...p, s: 0.35 + rand() * 0.6, ry: rand() * 6 }));
  const streamRocks = [];
  for (let z = -24; z < 24; z += 2.6) streamRocks.push({ x: sx(z) + (rand() > 0.5 ? 1 : -1) * (SW + 0.2), z: z + rand(), y: -0.1, s: 0.3 + rand() * 0.4, ry: rand() * 6 });
  scene.add(instanced(rockGeo(rand, "#8a8f86"), sceneryMat, [...rocks, ...streamRocks.filter((p) => Math.abs(p.z - BRIDGE.z) > 2)], { castShadow: true }));
  rocks.forEach((p) => obstacles.push({ x: p.x, z: p.z, r: p.s * 0.9 }));

  const steps = [];
  for (let t = 0; t < 1; t += 0.07) {
    const x = -2 + Math.sin(t * 6) * 2 + t * 8;
    const z = 12 - t * 13;
    if (!avoid(x, z)) steps.push({ x, z, y: -0.05, s: 0.42, sy: 0.25, ry: rand() * 6 });
  }
  scene.add(instanced(rockGeo(rand, "#b4b5ab", { squash: 0.4 }), sceneryMat, steps));

  const puddles = scatter(rand, 8, { rMin: 3, rMax: 20, minDist: 4, avoid }).map((p) => ({ ...p, r: 0.8 + rand() * 0.9 }));
  const puddleMat = new THREE.MeshStandardMaterial({ color: "#7f9696", roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.75 });
  const puddleGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  scene.add(instanced(puddleGeo, puddleMat, puddles.map((p) => ({ x: p.x, z: p.z, y: 0.02, s: p.r, sz: p.r * 0.75, ry: rand() * 6 }))));

  const ripples = [];
  const rippleGeo = new THREE.RingGeometry(0.12, 0.16, 16).rotateX(-Math.PI / 2);
  const rippleMat = new THREE.MeshBasicMaterial({ color: "#eef6f4", transparent: true, opacity: 0.5, depthWrite: false });
  const rippleMesh = new THREE.InstancedMesh(rippleGeo, rippleMat, 40);
  rippleMesh.frustumCulled = false;
  scene.add(rippleMesh);
  for (let i = 0; i < 40; i++) ripples.push({ t: rand(), x: 0, z: 0 });
  const dummy = new THREE.Object3D();

  const rain = new ParticleField(engine, { count: lowQ ? 350 : 800, radius: 24, yMin: 0, yMax: 18, mode: "fall", shape: "streak", color: "#e8f2f4", size: 0.75, speed: 13, swirl: 0.05, additive: false, opacity: 0.6 });
  scene.add(rain.points);

  const rainbow = new THREE.Mesh(rainbowGeo(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  rainbow.position.set(5, -6, -70);
  scene.add(rainbow);

  new Flock(engine, snailGeo(), mat(), 6, (a, t, dt, o) => {
    if (!a.init) {
      a.init = true;
      const p = scatter(rand, 1, { rMin: 5, rMax: 20, avoid })[0] || { x: 0, z: 0 };
      a.x = p.x;
      a.z = p.z;
      a.h = rand() * 6;
    }
    a.h += Math.sin(t * 0.3 + a.seed) * dt * 0.3;
    const nx = a.x + Math.sin(a.h) * dt * 0.12;
    const nz = a.z + Math.cos(a.h) * dt * 0.12;
    if (avoid(nx, nz) || Math.hypot(nx, nz) > 22) a.h += Math.PI * dt * 2;
    else {
      a.x = nx;
      a.z = nz;
    }
    o.position.set(a.x, 0, a.z);
    o.rotation.set(0, a.h, 0);
    const stretch = 1 + Math.sin(t * 2 + a.seed) * 0.08;
    o.scale.set(1.6, 1.6, 1.6 * stretch);
  });

  const koi = new Flock(engine, koiGeo(), mat(), 7, (a, t, dt, o) => {
    const z = ((t * (0.6 + (a.i % 3) * 0.2) + a.seed * 8) % 44) - 22;
    const x = sx(z) + Math.sin(t * 0.9 + a.seed) * 0.8;
    o.position.set(x, -0.35, z);
    o.rotation.set(0, Math.atan2(Math.cos(z * 0.18) * 0.45, 1) + Math.sin(t * 5 + a.seed) * 0.15, 0);
    o.scale.setScalar(1.6);
  });
  ["#ff8a3a", "#ffffff", "#ff5a3a", "#ffd0a0", "#ff8a3a", "#ffffff", "#f2b24a"].forEach((c, i) => koi.mesh.setColorAt(i, new THREE.Color(c)));
  koi.mesh.instanceColor.needsUpdate = true;

  let clear = 0;
  let clearTarget = 0;
  const markerGeometry = markerGeo();
  const markerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });
  const bridgeX = sx(BRIDGE.z);
  const span = SW + 1.2;

  return {
    bounds: 25,
    spawn: { x: -1, z: 1 },
    obstacles,
    anchors,
    sun,
    heightAt: (x, z) => {
      if (onBridge(x, z)) {
        const t = (x - bridgeX + span) / (span * 2);
        return Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * 0.75 + 0.16;
      }
      return Math.max(0, height(x, z));
    },
    isWalkable: (x, z) => !inStream(x, z, 0.2) || onBridge(x, z),
    palette: { glow: "#cfefff" },
    makeMarker: () => {
      const m = new THREE.Mesh(markerGeometry, markerMat);
      m.castShadow = true;
      return m;
    },
    setGrowth: (n) => {
      growth.setLevel(n);
      clearTarget = Math.min(1, n / 7);
    },
    update: (dt, t) => {
      clear += (clearTarget - clear) * Math.min(1, dt * 0.8);
      rain.opacity = 0.6 * (1 - clear * 0.85);
      sun.intensity = 1.1 + clear * 1.4;
      hemi.intensity = 1.9 - clear * 0.3;
      sky.material.uniforms.uSun.value = clear > 0.5 ? 1 : 0;
      sky.material.uniforms.uTop.value.set("#7f939a").lerp(new THREE.Color("#7fb5d6"), clear);
      rainbow.material.opacity = smooth(0.5, 1, clear) * 0.45;
      const active = Math.floor(40 * (1 - clear * 0.8));
      for (let i = 0; i < 40; i++) {
        const r = ripples[i];
        r.t += dt * 1.6;
        if (r.t >= 1) {
          r.t = 0;
          if (rand() < 0.5 && puddles.length) {
            const p = puddles[Math.floor(rand() * puddles.length)];
            r.x = p.x + (rand() - 0.5) * p.r * 1.2;
            r.z = p.z + (rand() - 0.5) * p.r * 0.9;
            r.y = 0.04;
          } else {
            const z = (rand() - 0.5) * 44;
            r.x = sx(z) + (rand() - 0.5) * SW * 1.6;
            r.z = z;
            r.y = -0.06;
          }
        }
        dummy.position.set(r.x, r.y, r.z);
        dummy.scale.setScalar(i < active ? 0.6 + r.t * 3 : 0.0001);
        dummy.updateMatrix();
        rippleMesh.setMatrixAt(i, dummy.matrix);
      }
      rippleMesh.instanceMatrix.needsUpdate = true;
      rippleMat.opacity = 0.45;
    },
    dispose: () => rain.dispose(),
  };
}
