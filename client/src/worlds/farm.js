import * as THREE from "three";
import { loadGeometry, sceneryMaterial } from "../engine/assets.js";
import { addSway } from "../engine/shaders.js";
import { ParticleField } from "../engine/particles.js";
import {
  rng, fbm, smooth, colored, merge, at, mat, makeGround, setupAtmosphere, setupLights, instanced, scatter, ringPoints,
  rockGeo, bushGeo, flowerGeo, fenceGeo, addClouds, butterflies, Flock, GrowthSet, nearAny,
} from "./kit.js";

const FIELD = { x0: 7, x1: 20, z0: -19, z1: -6 };
const inField = (x, z, pad = 0) => x > FIELD.x0 - pad && x < FIELD.x1 + pad && z > FIELD.z0 - pad && z < FIELD.z1 + pad;

function barnGeo() {
  const red = "#c2412f";
  const white = "#f4ead8";
  const roof = "#5a3b2e";
  const w = 6;
  const d = 7;
  const h = 3.6;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-w / 2 - 0.3, 0);
  roofShape.lineTo(0, 2.4);
  roofShape.lineTo(w / 2 + 0.3, 0);
  roofShape.lineTo(-w / 2 - 0.3, 0);
  const gable = new THREE.ExtrudeGeometry(roofShape, { depth: d + 0.6, bevelEnabled: false });
  const gableWall = new THREE.ExtrudeGeometry(
    (() => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(0, 2.1);
      s.lineTo(w / 2, 0);
      s.lineTo(-w / 2, 0);
      return s;
    })(),
    { depth: d, bevelEnabled: false },
  );
  return merge([
    colored(at(new THREE.BoxGeometry(w, h, d), 0, h / 2, 0), red),
    colored(at(gableWall, 0, h, -d / 2), red),
    colored(at(gable, 0, h + 0.05, -d / 2 - 0.3), roof),
    colored(at(new THREE.BoxGeometry(2.2, 2.6, 0.1), 0, 1.3, d / 2 + 0.03), "#7a2a1f"),
    colored(at(new THREE.BoxGeometry(2.4, 0.16, 0.14), 0, 2.65, d / 2 + 0.06), white),
    colored(at(new THREE.BoxGeometry(0.14, 2.6, 0.14), -1.15, 1.3, d / 2 + 0.06), white),
    colored(at(new THREE.BoxGeometry(0.14, 2.6, 0.14), 1.15, 1.3, d / 2 + 0.06), white),
    colored(at(new THREE.BoxGeometry(0.12, 3.4, 0.12), 0, 1.3, d / 2 + 0.07, { rz: 0.72 }), white),
    colored(at(new THREE.BoxGeometry(0.12, 3.4, 0.12), 0, 1.3, d / 2 + 0.07, { rz: -0.72 }), white),
    colored(at(new THREE.BoxGeometry(1, 1, 0.1), 0, h + 0.9, d / 2 + 0.04), white),
    colored(at(new THREE.BoxGeometry(0.8, 0.8, 0.12), 0, h + 0.9, d / 2 + 0.06), "#3d2a22"),
  ]);
}

function siloGeo() {
  return merge([
    colored(at(new THREE.CylinderGeometry(1.5, 1.5, 6, 14), 0, 3, 0), "#d9d2c3"),
    colored(at(new THREE.CylinderGeometry(1.55, 1.55, 0.2, 14), 0, 2, 0), "#9aa4a8"),
    colored(at(new THREE.CylinderGeometry(1.55, 1.55, 0.2, 14), 0, 4, 0), "#9aa4a8"),
    colored(at(new THREE.SphereGeometry(1.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 6, 0), "#b84a37"),
  ]);
}

function greenhouseFrame(w, d, h) {
  const c = "#f4f1ea";
  const parts = [];
  const t = 0.1;
  for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) parts.push(colored(at(new THREE.BoxGeometry(t, h, t), x, h / 2, z), c));
  for (const z of [-d / 2, -d / 4, 0, d / 4, d / 2]) {
    parts.push(colored(at(new THREE.BoxGeometry(t, t, w / 2 / Math.cos(0.5) + 0.1), -w / 4, h + 0.55, z, { ry: Math.PI / 2, rz: 0, rx: 0.5 }), c));
    parts.push(colored(at(new THREE.BoxGeometry(t, t, w / 2 / Math.cos(0.5) + 0.1), w / 4, h + 0.55, z, { ry: Math.PI / 2, rx: -0.5 }), c));
  }
  parts.push(colored(at(new THREE.BoxGeometry(t, t, d), 0, h + 1.1, 0), c));
  parts.push(colored(at(new THREE.BoxGeometry(w, t, t), 0, h, -d / 2), c));
  parts.push(colored(at(new THREE.BoxGeometry(w, t, t), 0, h, d / 2), c));
  parts.push(colored(at(new THREE.BoxGeometry(w + 0.2, 0.4, d + 0.2), 0, 0.2, 0), "#8d6b4a"));
  return merge(parts);
}

function greenhouseGlass(w, d, h) {
  const g = [];
  g.push(at(new THREE.BoxGeometry(w, h, d), 0, h / 2, 0));
  const roofL = at(new THREE.PlaneGeometry(d, w / 2 / Math.cos(0.5)), -w / 4, h + 0.55, 0, { rx: -Math.PI / 2, rz: Math.PI / 2, ry: 0 });
  roofL.rotateZ(0);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(0, 1.1);
  shape.lineTo(w / 2, 0);
  shape.lineTo(-w / 2, 0);
  const prism = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  g.push(at(prism, 0, h, -d / 2));
  return merge(g.map((x) => colored(x, "#cfeff2")));
}

function tomatoPlant(rand) {
  const parts = [bushGeo(rand, ["#3f8a3a", "#4f9c44"], 0.75)];
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2;
    parts.push(colored(at(new THREE.IcosahedronGeometry(0.11, 1), Math.cos(a) * 0.32, 0.25 + rand() * 0.45, Math.sin(a) * 0.32), i % 3 === 0 ? "#f08a3a" : "#e2382b"));
  }
  parts.push(colored(at(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 4), 0.1, 0.65, 0.1), "#b8935e"));
  return merge(parts);
}

function sunflowerGeo() {
  const parts = [colored(at(new THREE.CylinderGeometry(0.04, 0.05, 1.8, 5), 0, 0.9, 0), "#5c9b3e")];
  parts.push(colored(at(new THREE.SphereGeometry(0.2, 6, 3), 0.15, 0.7, 0, { sy: 0.2, rz: 0.6 }), "#5c9b3e"));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push(colored(at(new THREE.SphereGeometry(0.1, 5, 3), Math.cos(a) * 0.22, 1.85 + Math.sin(a) * 0.22, 0.06, { sx: 1.6, sz: 0.3, rz: a }), "#ffc928"));
  }
  parts.push(colored(at(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 8), 0, 1.85, 0.08, { rx: Math.PI / 2 }), "#5b3a1e"));
  return merge(parts);
}

function chickenGeo() {
  return merge([
    colored(at(new THREE.SphereGeometry(0.28, 8, 6), 0, 0.38, 0, { sz: 1.25 }), "#fffaf0"),
    colored(at(new THREE.SphereGeometry(0.16, 8, 6), 0, 0.66, 0.24), "#fffaf0"),
    colored(at(new THREE.ConeGeometry(0.05, 0.12, 4), 0, 0.64, 0.42, { rx: Math.PI / 2 }), "#f4a62a"),
    colored(at(new THREE.BoxGeometry(0.05, 0.12, 0.14), 0, 0.82, 0.22), "#e2382b"),
    colored(at(new THREE.SphereGeometry(0.1, 6, 4), 0, 0.5, -0.32, { sy: 1.6 }), "#f1e6d2"),
    colored(at(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 4), 0.1, 0.09, 0), "#f4a62a"),
    colored(at(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 4), -0.1, 0.09, 0), "#f4a62a"),
  ]);
}

function birdGeo() {
  const w = new THREE.BufferGeometry();
  w.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.2, -0.6, 0.05, -0.1, 0, 0, -0.2, 0, 0, 0.2, 0, 0, -0.2, 0.6, 0.05, -0.1], 3));
  return colored(w, "#3d3a40");
}

function markerGeo() {
  return merge([
    colored(at(new THREE.BoxGeometry(0.8, 0.55, 0.8), 0, 0.28, 0), "#b9875a", 0.1),
    colored(at(new THREE.BoxGeometry(0.84, 0.08, 0.84), 0, 0.55, 0), "#8c6240"),
    colored(at(new THREE.SphereGeometry(0.42, 12, 10), 0, 0.98, 0, { sy: 0.85 }), "#e63b2e"),
    colored(at(new THREE.ConeGeometry(0.2, 0.18, 5), 0, 1.36, 0), "#3f9a3a"),
    colored(at(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 4), 0, 1.5, 0), "#3f9a3a"),
  ]);
}

export async function build({ engine, quality }) {
  const rand = rng(7);
  const scene = engine.scene;
  const u = engine.uniforms;
  const lowQ = quality === "low";

  setupAtmosphere(engine, { top: "#3d9be0", mid: "#a8d8f2", bottom: "#d6eef6", fog: "#c5e3f0", fogNear: 45, fogFar: 150, sun: [0.5, 0.55, -0.4], sunColor: "#fff6d8", sunSize: 0.015, exposure: 1.1 });
  const { sun } = setupLights(engine, { sunDir: [14, 24, 10], sunColor: "#fff1d2", sunIntensity: 2.6, sky: "#cde9ff", ground: "#6f8a46", hemi: 1.25 });

  const height = (x, z) => {
    const r = Math.hypot(x, z);
    return smooth(28, 60, r) * (fbm(x * 0.05, z * 0.05) * 9 + 1) + (inField(x, z) ? -0.05 : 0);
  };
  const ground = makeGround({
    radius: 110,
    segments: 150,
    height,
    color: (x, z, h) => {
      if (inField(x, z)) return Math.floor((x - FIELD.x0) / 1.3) % 2 ? "#7a5236" : "#6a4630";
      const pathD = Math.min(Math.abs(z - 2 + Math.sin(x * 0.15) * 1.2), Math.hypot(x, z) < 3.6 ? 0 : 99);
      if (pathD < 1.1 && x > -22 && x < 22) return pathD < 0.8 ? "#d6b98a" : "#b9c576";
      const n = fbm(x * 0.15, z * 0.15);
      const c = new THREE.Color("#7fbd55").lerp(new THREE.Color("#a6cd5f"), n);
      return c.lerp(new THREE.Color("#5e9a49"), smooth(30, 70, Math.hypot(x, z)) * 0.6);
    },
  });
  scene.add(ground);

  const anchors = [
    { x: -6, z: -4 },
    { x: 2, z: -8 },
    { x: 8, z: -2.5 },
    { x: 6.5, z: 5 },
    { x: -1, z: 10 },
    { x: -9, z: 6 },
    { x: -13, z: -1 },
    { x: 15, z: -1 },
    { x: 3.5, z: 16 },
  ];
  const nearAnchor = nearAny(anchors, 2.2);
  const obstacles = [];
  const sceneryMat = mat();

  const barn = new THREE.Mesh(barnGeo(), sceneryMat);
  barn.position.set(-14, 0, -12);
  barn.rotation.y = 0.5;
  barn.castShadow = true;
  barn.receiveShadow = true;
  scene.add(barn);
  obstacles.push({ x: -14, z: -12, r: 4.4 });

  const silo = new THREE.Mesh(siloGeo(), sceneryMat);
  silo.position.set(-19.5, 0, -5);
  silo.castShadow = true;
  scene.add(silo);
  obstacles.push({ x: -19.5, z: -5, r: 1.8 });

  const gh = { x: 13, z: 10, w: 5, d: 7, h: 2.4 };
  const ghFrame = new THREE.Mesh(greenhouseFrame(gh.w, gh.d, gh.h), sceneryMat);
  ghFrame.castShadow = true;
  const ghGlass = new THREE.Mesh(
    greenhouseGlass(gh.w, gh.d, gh.h),
    new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1, depthWrite: false }),
  );
  const ghGroup = new THREE.Group();
  ghGroup.add(ghFrame, ghGlass);
  ghGroup.position.set(gh.x, 0, gh.z);
  ghGroup.rotation.y = -0.35;
  scene.add(ghGroup);
  obstacles.push({ x: gh.x - 1.2, z: gh.z - 1.6, r: 2.4 }, { x: gh.x + 1.2, z: gh.z + 1.6, r: 2.4 });
  const ghPlants = [];
  for (let i = 0; i < 8; i++) ghPlants.push({ x: (i % 2 ? 1 : -1) * 1.3, y: 0.4, z: -2.6 + Math.floor(i / 2) * 1.7, s: 0.7, ry: rand() * 6 });
  const ghPlantMesh = instanced(tomatoPlant(rand), sceneryMat, ghPlants);
  ghGroup.add(ghPlantMesh);

  const plantGeo = tomatoPlant(rand);
  const plants = [];
  for (let x = FIELD.x0 + 0.65; x < FIELD.x1; x += 1.3) {
    if (Math.floor((x - FIELD.x0) / 1.3) % 2) continue;
    for (let z = FIELD.z0 + 0.8; z < FIELD.z1 - 0.4; z += 1.15) plants.push({ x: x + (rand() - 0.5) * 0.1, z, s: 0.85 + rand() * 0.3, ry: rand() * 6 });
  }
  const plantMesh = instanced(plantGeo, addSway(mat(), u, { strength: 0.05, speed: 1.6 }), plants, { castShadow: !lowQ });
  scene.add(plantMesh);

  const scarecrow = new THREE.Mesh(
    merge([
      colored(at(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 5), 0, 1.1, 0), "#8a6a45"),
      colored(at(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), 0, 1.6, 0, { rz: Math.PI / 2 }), "#8a6a45"),
      colored(at(new THREE.BoxGeometry(0.7, 0.8, 0.35), 0, 1.45, 0), "#4f7fb8"),
      colored(at(new THREE.SphereGeometry(0.28, 8, 6), 0, 2.1, 0), "#e8cf96"),
      colored(at(new THREE.ConeGeometry(0.5, 0.45, 8), 0, 2.45, 0), "#c99a3c"),
      colored(at(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 10), 0, 2.27, 0), "#c99a3c"),
    ]),
    sceneryMat,
  );
  scarecrow.position.set(6, 0, -13);
  scarecrow.rotation.y = 0.8;
  scarecrow.castShadow = true;
  scene.add(scarecrow);
  obstacles.push({ x: 6, z: -13, r: 0.5 });

  const fenceItems = [];
  for (const p of ringPoints(64, 25.5, { offset: 0.03 })) {
    const gate = Math.abs(Math.sin(p.a - Math.PI / 2)) < 0.05 || Math.abs(Math.sin(p.a)) < 0.04;
    if (gate) continue;
    fenceItems.push({ x: p.x, z: p.z, y: height(p.x, p.z), ry: -p.a + Math.PI / 2, s: 1.24 });
  }
  scene.add(instanced(fenceGeo(2, "#b88c5c"), sceneryMat, fenceItems, { castShadow: !lowQ }));

  const sunflowers = [];
  for (let x = FIELD.x0; x <= FIELD.x1; x += 0.9) sunflowers.push({ x, z: FIELD.z1 + 0.9 + (rand() - 0.5) * 0.2, s: 0.9 + rand() * 0.3, ry: rand() * 0.6 - 0.3 });
  for (let z = FIELD.z0; z <= FIELD.z1; z += 0.9) sunflowers.push({ x: FIELD.x0 - 0.9, z, s: 0.9 + rand() * 0.3, ry: Math.PI / 2 + rand() * 0.6 - 0.3 });
  scene.add(instanced(sunflowerGeo(), addSway(mat(), u, { strength: 0.03, speed: 1.2, height: 0.6 }), sunflowers, { castShadow: !lowQ }));

  const avoidCore = (x, z) => nearAnchor(x, z) || inField(x, z, 1.5) || Math.hypot(x - -14, z - -12) < 6 || Math.hypot(x - gh.x, z - gh.z) < 5.5 || Math.hypot(x - -19.5, z - -5) < 3;
  const props = scatter(rand, 12, { rMin: 12, rMax: 23, minDist: 3, avoid: avoidCore });
  const bales = props.slice(0, 7).map((p) => ({ ...p, ry: rand() * 6, s: 1 }));
  const crates = props.slice(7).map((p) => ({ ...p, ry: rand() * 6, s: 0.9 + rand() * 0.3 }));
  const baleGeo = merge([
    colored(at(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12), 0, 0.75, 0, { rz: Math.PI / 2 }), "#e3c26a", 0.15, rand),
    colored(at(new THREE.CylinderGeometry(0.6, 0.6, 1.32, 12), 0, 0.75, 0, { rz: Math.PI / 2 }), "#d1ab52"),
  ]);
  scene.add(instanced(baleGeo, sceneryMat, bales, { castShadow: true }));
  const crateGeo = merge([
    colored(at(new THREE.BoxGeometry(0.9, 0.6, 0.7), 0, 0.3, 0), "#a97a4c", 0.1, rand),
    ...[0, 1, 2, 3, 4, 5].map((i) => colored(at(new THREE.SphereGeometry(0.15, 6, 4), -0.28 + (i % 3) * 0.28, 0.66, i < 3 ? -0.15 : 0.15), "#e2382b")),
  ]);
  scene.add(instanced(crateGeo, sceneryMat, crates, { castShadow: true }));
  props.forEach((p, i) => obstacles.push({ x: p.x, z: p.z, r: i < 7 ? 0.95 : 0.6 }));

  const treeGeo = await loadGeometry("/models/tree.glb");
  const trees = scatter(rand, lowQ ? 50 : 85, { rMin: 28, rMax: 62, minDist: 3.2 }).map((p) => ({ ...p, y: height(p.x, p.z) - 0.1, s: 3.4 + rand() * 2.4, ry: rand() * 6 }));
  const inner = scatter(rand, 9, { rMin: 19, rMax: 24, minDist: 4, avoid: avoidCore }).map((p) => ({ ...p, y: 0, s: 3 + rand() * 1.4, ry: rand() * 6 }));
  inner.forEach((p) => obstacles.push({ x: p.x, z: p.z, r: 0.8 }));
  scene.add(instanced(treeGeo, addSway(sceneryMaterial(), u, { strength: 0.015, speed: 0.9, height: 0.6 }), [...trees, ...inner], { castShadow: !lowQ }));

  const grassGeo = await loadGeometry("/models/grass.glb");
  const tufts = scatter(rand, lowQ ? 90 : 200, { rMin: 3, rMax: 27, minDist: 0.9, avoid: (x, z) => inField(x, z, 0.5) || Math.abs(z - 2 + Math.sin(x * 0.15) * 1.2) < 1.2 }).map((p) => ({ ...p, y: height(p.x, p.z), s: 0.9 + rand() * 0.9, ry: rand() * 6 }));
  scene.add(instanced(grassGeo, addSway(sceneryMaterial(), u, { strength: 0.25, speed: 2.2, height: 2.2 }), tufts));

  const rockItems = scatter(rand, 14, { rMin: 6, rMax: 25, minDist: 3, avoid: avoidCore }).map((p) => ({ ...p, s: 0.35 + rand() * 0.5, ry: rand() * 6 }));
  scene.add(instanced(rockGeo(rand, "#a8a395"), sceneryMat, rockItems, { castShadow: true }));

  const flowerColors = ["#ff8fb1", "#fff1a8", "#b7a6ff", "#ffffff", "#ffb35c"];
  const flowerSpots = scatter(rand, lowQ ? 70 : 140, { rMin: 3, rMax: 25, minDist: 0.6, avoid: (x, z) => inField(x, z, 1) });
  scene.add(instanced(flowerGeo("#ffffff"), addSway(mat(), u, { strength: 0.12, speed: 2, height: 2 }), flowerSpots.map((p) => ({ ...p, s: 0.8 + rand() * 0.6, ry: rand() * 6 })), { colors: flowerColors }));

  const growth = new GrowthSet(engine, 2);
  const pumpkinGeo = merge([
    ...[0, 1, 2, 3, 4, 5].map((i) => colored(at(new THREE.SphereGeometry(0.42, 10, 8), Math.cos((i / 6) * Math.PI * 2) * 0.16, 0.36, Math.sin((i / 6) * Math.PI * 2) * 0.16, { sy: 0.8, sx: 0.65 }), "#f08a2a")),
    colored(at(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 5), 0, 0.75, 0, { rz: 0.2 }), "#5a6b2e"),
  ]);
  const bloomGeo = merge([bushGeo(rand, ["#5aa64a", "#6cb453"], 0.7), ...[0, 1, 2, 3, 4].map((i) => colored(at(new THREE.SphereGeometry(0.12, 6, 4), Math.cos(i * 1.3) * 0.32, 0.55 + (i % 2) * 0.12, Math.sin(i * 1.3) * 0.32), i % 2 ? "#ff8fb1" : "#fff1a8"))]);
  const growthSpots = ringPoints(18, 6.2, { rand, jitter: 0.4, offset: 0.2 });
  growthSpots.forEach((p, i) => {
    const m = new THREE.Mesh(i % 3 === 0 ? pumpkinGeo : bloomGeo, sceneryMat);
    m.position.set(p.x, 0, p.z);
    m.rotation.y = rand() * 6;
    m.scale.setScalar(0.9 + rand() * 0.4);
    m.castShadow = true;
    scene.add(m);
    growth.add(m);
  });

  const butterfly = butterflies(engine, { count: lowQ ? 6 : 12, radius: 18 });
  const cloudTick = addClouds(engine, rand, { count: 10, y: 30, radius: 80, speed: 0.8 });
  const pollen = new ParticleField(engine, { count: lowQ ? 60 : 140, radius: 24, yMin: 0.5, yMax: 5, mode: "drift", color: "#fffbe0", size: 0.12, speed: 0.6, swirl: 0.6, opacity: 0.8 });
  scene.add(pollen.points);

  const chickens = [];
  const chickenFlock = new Flock(engine, chickenGeo(), mat(), 7, (a, t, dt, o) => {
    if (!a.init) {
      a.init = true;
      const p = scatter(rand, 1, { rMin: 8, rMax: 16, avoid: avoidCore })[0] || { x: -8, z: -4 };
      a.x = p.x;
      a.z = p.z;
      a.tx = a.x;
      a.tz = a.z;
      a.wait = rand() * 2;
      a.h = rand() * 6;
      chickens.push(a);
    }
    const dx = a.tx - a.x;
    const dz = a.tz - a.z;
    const d = Math.hypot(dx, dz);
    let peck = 0;
    if (d < 0.1) {
      a.wait -= dt;
      peck = Math.max(0, Math.sin(t * 9 + a.seed)) * 0.5;
      if (a.wait <= 0) {
        const ang = rand() * Math.PI * 2;
        const r = 1 + rand() * 3;
        const nx = a.x + Math.cos(ang) * r;
        const nz = a.z + Math.sin(ang) * r;
        if (!avoidCore(nx, nz) && Math.hypot(nx, nz) < 22 && Math.hypot(nx, nz) > 4) {
          a.tx = nx;
          a.tz = nz;
        }
        a.wait = 1.5 + rand() * 3;
      }
    } else {
      const sp = Math.min(d, dt * 1.6);
      a.x += (dx / d) * sp;
      a.z += (dz / d) * sp;
      a.h = Math.atan2(dx, dz);
    }
    const hop = d >= 0.1 ? Math.abs(Math.sin(t * 14 + a.seed)) * 0.08 : 0;
    o.position.set(a.x, hop, a.z);
    o.rotation.set(peck, a.h, 0);
    o.scale.setScalar(1);
  });
  chickenFlock.mesh.castShadow = true;
  chickenFlock.mesh.receiveShadow = false;

  new Flock(engine, birdGeo(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }), 5, (a, t, dt, o) => {
    const k = t * 0.12 + a.i * 0.12;
    o.position.set(Math.cos(k) * 30 + a.i * 1.2, 22 + Math.sin(t * 0.5 + a.i) * 0.6, Math.sin(k) * 24 - a.i * 0.8);
    o.rotation.set(0, -k, Math.sin(t * 8 + a.i) * 0.5);
    o.scale.set(1.4, 1 + Math.sin(t * 8 + a.i) * 0.6, 1.4);
  });


  const markerGeometry = markerGeo();
  const markerMat = mat();

  return {
    bounds: 25,
    spawn: { x: 0, z: 2 },
    obstacles,
    anchors,
    sun,
    heightAt: () => 0,
    isWalkable: (x, z) => !inField(x, z, 0.2),
    palette: { glow: "#ffe08a" },
    makeMarker: () => {
      const m = new THREE.Mesh(markerGeometry, markerMat);
      m.castShadow = true;
      return m;
    },
    setGrowth: (n) => growth.setLevel(n),
    update: (dt, t) => {
      cloudTick(dt);
    },
    onCelebrate: () => {},
    dispose: () => {
      pollen.dispose();
    },
    debug: { butterfly, chickens },
  };
}
