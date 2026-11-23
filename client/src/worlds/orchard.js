import * as THREE from "three";
import { loadGeometry, sceneryMaterial } from "../engine/assets.js";
import { addSway, glowSprite } from "../engine/shaders.js";
import { ParticleField } from "../engine/particles.js";
import {
  rng, fbm, smooth, colored, merge, at, mat, makeGround, setupAtmosphere, setupLights, instanced, scatter, ringPoints,
  rockGeo, blobTree, bushGeo, flowerGeo, fenceGeo, addClouds, butterflies, Flock, GrowthSet, nearAny,
} from "./kit.js";

function millGeo() {
  return merge([
    colored(at(new THREE.CylinderGeometry(2.4, 2.8, 3.2, 10), 0, 1.6, 0), "#b9a58c", 0.08),
    colored(at(new THREE.CylinderGeometry(2.1, 2.4, 3, 10), 0, 4.7, 0), "#e8d6b5"),
    ...[0, 1, 2, 3, 4].map((i) => colored(at(new THREE.BoxGeometry(0.16, 3, 0.16), Math.cos((i / 5) * Math.PI * 2) * 2.22, 4.7, Math.sin((i / 5) * Math.PI * 2) * 2.22), "#6e4a2e")),
    colored(at(new THREE.ConeGeometry(2.7, 2.6, 10), 0, 7.5, 0), "#8a3a2c"),
    colored(at(new THREE.BoxGeometry(1.3, 2, 0.2), 0, 1, 2.72), "#6e4a2e"),
    colored(at(new THREE.BoxGeometry(0.7, 0.7, 0.15), 0, 4.8, 2.3), "#ffd38a"),
    colored(at(new THREE.CylinderGeometry(0.25, 0.25, 1.4, 8), 0, 6.1, 2.3, { rx: Math.PI / 2 }), "#5a3b26"),
  ]);
}

function sailsGeo() {
  const parts = [colored(at(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 8), 0, 0, 0, { rx: Math.PI / 2 }), "#5a3b26")];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    parts.push(colored(at(new THREE.BoxGeometry(0.16, 4.6, 0.1), Math.sin(a) * 2.3, Math.cos(a) * 2.3, 0, { rz: -a }), "#6e4a2e"));
    parts.push(colored(at(new THREE.BoxGeometry(1.1, 3.6, 0.04), Math.sin(a) * 2.6 + Math.cos(a) * 0.55, Math.cos(a) * 2.6 - Math.sin(a) * 0.55, 0.06, { rz: -a }), "#f6ead0"));
  }
  return merge(parts);
}

function barrelGeo() {
  return merge([
    colored(at(new THREE.CylinderGeometry(0.42, 0.42, 1, 10), 0, 0.5, 0, { sx: 1, sz: 1 }), "#9b6a3e", 0.08),
    colored(at(new THREE.CylinderGeometry(0.47, 0.47, 0.08, 10), 0, 0.82, 0), "#4a3a2e"),
    colored(at(new THREE.CylinderGeometry(0.47, 0.47, 0.08, 10), 0, 0.18, 0), "#4a3a2e"),
  ]);
}

function cartGeo() {
  const wheel = (x, z) => colored(at(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 10), x, 0.45, z, { rx: Math.PI / 2 }), "#5a3b26");
  const parts = [
    colored(at(new THREE.BoxGeometry(1.8, 0.6, 1.1), 0, 0.9, 0), "#a7774a"),
    colored(at(new THREE.BoxGeometry(1.6, 0.4, 0.9), 0, 1.05, 0), "#8a5d38"),
    wheel(0.55, 0.6),
    wheel(0.55, -0.6),
    colored(at(new THREE.BoxGeometry(1.4, 0.08, 0.08), -1.4, 0.75, 0.3, { rz: 0.25 }), "#7a5236"),
    colored(at(new THREE.BoxGeometry(1.4, 0.08, 0.08), -1.4, 0.75, -0.3, { rz: 0.25 }), "#7a5236"),
  ];
  for (let i = 0; i < 14; i++) parts.push(colored(at(new THREE.IcosahedronGeometry(0.17, 1), -0.6 + (i % 5) * 0.3, 1.32 + Math.floor(i / 5) * 0.12, -0.3 + (Math.floor(i / 5) % 2) * 0.3 + (i % 2) * 0.15), i % 4 ? "#d8352a" : "#e2b33a"));
  return merge(parts);
}

function markerGeo() {
  return merge([
    colored(at(new THREE.CylinderGeometry(0.52, 0.4, 0.55, 12, 1, true), 0, 0.28, 0), "#b8874e", 0.15),
    colored(at(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12), 0, 0.03, 0), "#8a5d38"),
    colored(at(new THREE.TorusGeometry(0.52, 0.05, 5, 14), 0, 0.55, 0, { rx: Math.PI / 2 }), "#8a5d38"),
    colored(at(new THREE.TorusGeometry(0.42, 0.04, 5, 10, Math.PI), 0, 0.55, 0, { ry: Math.PI / 2 }), "#8a5d38"),
    colored(at(new THREE.SphereGeometry(0.36, 12, 10), 0, 0.82, 0, { sy: 0.9 }), "#e03a2a"),
    colored(at(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 4), 0, 1.18, 0, { rz: 0.3 }), "#5a3b26"),
    colored(at(new THREE.SphereGeometry(0.12, 6, 4), 0.12, 1.2, 0, { sx: 1.6, sy: 0.3, rz: -0.4 }), "#6aa83a"),
  ]);
}

export async function build({ engine, quality }) {
  const rand = rng(21);
  const scene = engine.scene;
  const u = engine.uniforms;
  const lowQ = quality === "low";

  setupAtmosphere(engine, { top: "#6f5fa8", mid: "#f6a06a", bottom: "#f9d3a8", fog: "#f2b48a", fogNear: 40, fogFar: 140, sun: [-0.55, 0.1, -0.8], sunColor: "#ffcf8a", sunSize: 0.05, exposure: 1.05 });
  const { sun } = setupLights(engine, { sunDir: [-16, 11, -18], sunColor: "#ffb47a", sunIntensity: 2.4, sky: "#ffd2b0", ground: "#55663a", hemi: 1.45 });

  const rowsX = (x) => Math.abs(x) > 10.5 && Math.abs(x) < 24;
  const height = (x, z) => smooth(27, 60, Math.hypot(x, z)) * (fbm(x * 0.05, z * 0.05) * 8 + 1);
  scene.add(
    makeGround({
      radius: 110,
      height,
      color: (x, z) => {
        const r = Math.hypot(x, z);
        if (rowsX(x) && Math.abs(((Math.abs(x) - 10.5) % 4.5) - 2.25) > 1.4 && r < 26) return "#a98f5e";
        const lane = Math.abs(x + Math.sin(z * 0.2) * 0.8) < 1.3 && z > -16 && z < 24;
        if (lane || r < 3.2) return "#d8b77d";
        const n = fbm(x * 0.12, z * 0.12);
        return new THREE.Color("#7fa548").lerp(new THREE.Color("#b3b358"), n * 0.85).lerp(new THREE.Color("#6f8f42"), smooth(30, 70, r) * 0.5);
      },
    }),
  );

  const anchors = [
    { x: -5, z: -7 },
    { x: 4.5, z: -6.5 },
    { x: -6.5, z: 1 },
    { x: 6.5, z: 1.5 },
    { x: -5, z: 9 },
    { x: 5, z: 9.5 },
    { x: 0, z: 15 },
    { x: -7, z: 17 },
    { x: 7, z: 17 },
  ];
  const nearAnchor = nearAny(anchors, 2.2);
  const obstacles = [];
  const sceneryMat = mat();

  const treeVariants = [0, 1, 2].map((i) =>
    blobTree(rand, { leaves: i === 2 ? ["#b99a3a", "#d1a23e"] : ["#6c9a3a", "#86ab45"], fruit: "#d8352a", fruitCount: 10, h: 2.8 + i * 0.3, w: 1.7 }),
  );
  const rows = [[], [], []];
  let ti = 0;
  for (const side of [-1, 1]) {
    for (let col = 0; col < 3; col++) {
      const x = side * (12.75 + col * 4.5);
      for (let z = -18; z <= 20; z += 4.2) {
        if (Math.hypot(x, z) > 25) continue;
        const it = { x: x + (rand() - 0.5) * 0.4, z: z + (rand() - 0.5) * 0.4, s: 0.95 + rand() * 0.25, ry: rand() * 6 };
        rows[ti++ % 3].push(it);
        obstacles.push({ x: it.x, z: it.z, r: 0.7 });
      }
    }
  }
  const treeMat = addSway(mat(), u, { strength: 0.012, speed: 1, height: 0.5 });
  rows.forEach((items, i) => scene.add(instanced(treeVariants[i], treeMat, items, { castShadow: !lowQ })));

  const outer = scatter(rand, lowQ ? 40 : 70, { rMin: 28, rMax: 62, minDist: 3.4 }).map((p) => ({ ...p, y: height(p.x, p.z), s: 1.2 + rand() * 0.8, ry: rand() * 6 }));
  const outerA = outer.filter((_, i) => i % 2);
  const outerB = outer.filter((_, i) => !(i % 2));
  scene.add(instanced(treeVariants[2], treeMat, outerA));
  scene.add(instanced(blobTree(rand, { leaves: ["#c4683a", "#d98a3e"], h: 3, w: 1.8 }), treeMat, outerB));

  const mill = new THREE.Mesh(millGeo(), sceneryMat);
  mill.position.set(0, 0, -19.5);
  mill.castShadow = true;
  mill.receiveShadow = true;
  scene.add(mill);
  obstacles.push({ x: 0, z: -19.5, r: 3.1 });
  const sails = new THREE.Mesh(sailsGeo(), sceneryMat);
  sails.position.set(0, 6.1, -16.9);
  sails.castShadow = true;
  scene.add(sails);
  const millGlow = glowSprite("#ffcf7a", 2.4, 0.6);
  millGlow.position.set(0, 4.8, -16.9);
  scene.add(millGlow);

  const barrels = [
    { x: -3.6, z: -16.2, ry: 0.3 },
    { x: -4.5, z: -15.5, ry: 1.2 },
    { x: -3.9, z: -15.2, ry: 2, y: 0 },
    { x: 3.8, z: -16, ry: 0.8 },
  ];
  scene.add(instanced(barrelGeo(), sceneryMat, barrels, { castShadow: true }));
  barrels.forEach((b) => obstacles.push({ x: b.x, z: b.z, r: 0.55 }));
  const cart = new THREE.Mesh(cartGeo(), sceneryMat);
  cart.position.set(5.5, 0, -12.5);
  cart.rotation.y = -0.6;
  cart.castShadow = true;
  scene.add(cart);
  obstacles.push({ x: 5.5, z: -12.5, r: 1.3 });

  const fenceItems = [];
  for (const p of ringPoints(60, 25.6, { offset: 0.05 })) {
    if (Math.abs(Math.cos(p.a)) < 0.06 && Math.sin(p.a) > 0) continue;
    fenceItems.push({ x: p.x, z: p.z, y: height(p.x, p.z), ry: -p.a + Math.PI / 2, s: 1.34 });
  }
  scene.add(instanced(fenceGeo(2, "#8f6a45"), sceneryMat, fenceItems, { castShadow: !lowQ }));

  const avoidCore = (x, z) => nearAnchor(x, z) || rowsX(x) || Math.hypot(x, z + 19.5) < 5 || Math.hypot(x - 5.5, z + 12.5) < 2.4;
  const pumpkins = scatter(rand, 10, { rMin: 6, rMax: 22, minDist: 2.5, avoid: avoidCore });
  const pumpkinGeo = merge([
    ...[0, 1, 2, 3, 4, 5].map((i) => colored(at(new THREE.SphereGeometry(0.4, 10, 8), Math.cos((i / 6) * Math.PI * 2) * 0.15, 0.34, Math.sin((i / 6) * Math.PI * 2) * 0.15, { sy: 0.8, sx: 0.65 }), "#e8822a")),
    colored(at(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 5), 0, 0.72, 0, { rz: 0.2 }), "#5a6b2e"),
  ]);
  scene.add(instanced(pumpkinGeo, sceneryMat, pumpkins.map((p) => ({ ...p, s: 0.8 + rand() * 0.6, ry: rand() * 6 })), { castShadow: true }));
  pumpkins.forEach((p) => obstacles.push({ x: p.x, z: p.z, r: 0.45 }));

  const baleGeo = colored(at(new THREE.BoxGeometry(1.4, 0.7, 0.8), 0, 0.35, 0), "#e0bf6a", 0.18, rand);
  const bales = scatter(rand, 6, { rMin: 8, rMax: 22, minDist: 3, avoid: avoidCore, existing: pumpkins });
  scene.add(instanced(baleGeo, sceneryMat, bales.map((p) => ({ ...p, ry: rand() * 6 })), { castShadow: true }));
  bales.forEach((p) => obstacles.push({ x: p.x, z: p.z, r: 0.8 }));

  const grassGeo = await loadGeometry("/models/grass.glb");
  const tufts = scatter(rand, lowQ ? 90 : 180, { rMin: 3, rMax: 27, minDist: 0.9, avoid: (x, z) => Math.abs(x) < 1.6 }).map((p) => ({ ...p, y: height(p.x, p.z), s: 0.9 + rand() * 0.8, ry: rand() * 6, color: rand() > 0.5 ? "#d8c46a" : "#a9b85a" }));
  scene.add(instanced(grassGeo, addSway(sceneryMaterial(), u, { strength: 0.25, speed: 2, height: 2.2 }), tufts));

  const flowers = scatter(rand, lowQ ? 50 : 110, { rMin: 3, rMax: 25, minDist: 0.7, avoid: (x, z) => Math.abs(x) < 1.6 });
  scene.add(instanced(flowerGeo("#ffffff"), addSway(mat(), u, { strength: 0.12, speed: 2, height: 2 }), flowers.map((p) => ({ ...p, s: 0.8 + rand() * 0.5, ry: rand() * 6 })), { colors: ["#fff1c2", "#ffb07a", "#f27a8a", "#ffd25e"] }));

  const rocks = scatter(rand, 8, { rMin: 6, rMax: 24, minDist: 4, avoid: avoidCore }).map((p) => ({ ...p, s: 0.4 + rand() * 0.4, ry: rand() * 6 }));
  scene.add(instanced(rockGeo(rand, "#b7a28a"), sceneryMat, rocks, { castShadow: true }));

  const growth = new GrowthSet(engine, 2);
  const lanternPost = merge([
    colored(at(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6), 0, 1.1, 0), "#5a3b26"),
    colored(at(new THREE.BoxGeometry(0.7, 0.06, 0.06), 0.3, 2.15, 0), "#5a3b26"),
  ]);
  const lanternBulb = merge([
    colored(at(new THREE.SphereGeometry(0.22, 10, 8), 0, 0, 0, { sy: 1.15 }), "#ffcf7a"),
    colored(at(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 6), 0, 0.26, 0), "#8a3a2c"),
  ]);
  const bulbMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lanternSpots = [];
  for (let z = -12; z <= 22; z += 5.6) for (const sx of [-1, 1]) lanternSpots.push({ x: sx * 2.3 + Math.sin(z * 0.2) * -0.8, z, a: sx > 0 ? Math.PI : 0 });
  const posts = [];
  lanternSpots.forEach((p) => {
    posts.push({ x: p.x, z: p.z, ry: -p.a });
    obstacles.push({ x: p.x, z: p.z, r: 0.2 });
    const g = new THREE.Group();
    const bulb = new THREE.Mesh(lanternBulb, bulbMat);
    const halo = glowSprite("#ffb85a", 1.8, 0.7);
    g.add(bulb, halo);
    g.position.set(p.x + Math.cos(-p.a) * 0.55, 1.85, p.z - Math.sin(-p.a) * 0.55);
    scene.add(g);
    growth.add(g);
  });
  scene.add(instanced(lanternPost, sceneryMat, posts, { castShadow: !lowQ }));

  const leaves = new ParticleField(engine, { count: lowQ ? 70 : 160, radius: 26, yMin: 0, yMax: 9, mode: "fall", shape: "petal", color: "#e8752a", color2: "#c9402a", size: 0.28, speed: 0.6, swirl: 1.1, additive: false, opacity: 0.95 });
  scene.add(leaves.points);
  const motes = new ParticleField(engine, { count: lowQ ? 40 : 90, radius: 20, yMin: 0.5, yMax: 4, mode: "drift", color: "#ffe2a0", size: 0.16, speed: 0.6, blink: 1, swirl: 0.6 });
  scene.add(motes.points);
  butterflies(engine, { count: lowQ ? 5 : 9, radius: 16, colors: ["#ffd25e", "#ffb07a", "#fff1c2"] });
  const cloudTick = addClouds(engine, rand, { count: 8, y: 26, radius: 80, speed: 0.5, color: "#ffd9c2", emissive: 0.5 });

  const birdShape = new THREE.BufferGeometry();
  birdShape.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.2, -0.6, 0.05, -0.1, 0, 0, -0.2, 0, 0, 0.2, 0, 0, -0.2, 0.6, 0.05, -0.1], 3));
  new Flock(engine, colored(birdShape, "#3d2b3a"), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }), 7, (a, t, dt, o) => {
    const k = ((t * 0.035 + a.i * 0.013) % 1) * 2 - 1;
    o.position.set(-60 + (k + 1) * 60 + (a.i % 3) * 1.4, 20 + Math.abs(a.i - 3) * 0.7, -30 + Math.abs(a.i - 3) * 1.2);
    o.rotation.set(0, Math.PI / 2, Math.sin(t * 7 + a.i) * 0.45);
    o.scale.set(1.3, 1 + Math.sin(t * 7 + a.i) * 0.5, 1.3);
  });

  const markerGeometry = markerGeo();

  return {
    bounds: 25,
    spawn: { x: 0, z: 3 },
    obstacles,
    anchors,
    sun,
    heightAt: () => 0,
    palette: { glow: "#ffcf7a" },
    makeMarker: () => {
      const m = new THREE.Mesh(markerGeometry, sceneryMat);
      m.castShadow = true;
      return m;
    },
    setGrowth: (n) => growth.setLevel(n),
    update: (dt, t) => {
      sails.rotation.z -= dt * 0.35;
      millGlow.material.opacity = 0.5 + Math.sin(t * 2) * 0.08;
      cloudTick(dt);
    },
    dispose: () => {
      leaves.dispose();
      motes.dispose();
    },
  };
}
