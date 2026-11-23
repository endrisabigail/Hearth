import * as THREE from "three";
import { loadGeometry, sceneryMaterial } from "../engine/assets.js";
import { addSway, makeWater, glowTexture, glowSprite } from "../engine/shaders.js";
import { ParticleField } from "../engine/particles.js";
import { rng, fbm, smooth, colored, merge, at, mat, makeGround, setupAtmosphere, setupLights, instanced, scatter, ringPoints, rockGeo, blobTree, Flock, GrowthSet, nearAny, jitterGeo } from "./kit.js";

const POOL = { x: -13, z: 7, r: 3.6 };

function stemGeo(h, r, bend, rand) {
  const g = new THREE.CylinderGeometry(r * 0.75, r, h, 8, 6);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / h;
    p.setX(i, p.getX(i) + Math.sin(y * Math.PI * 0.5) * bend);
  }
  return colored(g, "#e9e0f2", 0.06, rand);
}

function capGeo(r, rand, color, spot) {
  const cap = new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.scale(1, 0.55, 1);
  const parts = [colored(cap, color, 0.05, rand)];
  const under = new THREE.CircleGeometry(r * 0.98, 14);
  under.rotateX(Math.PI / 2);
  parts.push(colored(under, spot));
  for (let i = 0; i < 9; i++) {
    const th = rand() * Math.PI * 2;
    const ph = 0.25 + rand() * 1.0;
    const x = Math.sin(ph) * Math.cos(th) * r;
    const z = Math.sin(ph) * Math.sin(th) * r;
    const y = Math.cos(ph) * r * 0.55;
    parts.push(colored(at(new THREE.SphereGeometry(r * 0.09, 5, 3), x, y, z, { sy: 0.5 }), spot));
  }
  const g = merge(parts);
  const pos = g.attributes.position;
  const col = g.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.45 + 0.55 * Math.min(1, Math.max(0, pos.getY(i) / (r * 0.55)));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  return g;
}

function shroom(rand, { h = 3, r = 1.6, bend = 0.3 }) {
  const stem = stemGeo(h, r * 0.16, bend, rand);
  return { stem, capY: h - 0.05, capX: bend, r };
}

function crystalGeo(rand) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const h = 0.6 + rand() * 1.4;
    const g = new THREE.OctahedronGeometry(0.28, 0);
    g.scale(0.7, h, 0.7);
    g.translate(0, h * 0.5, 0);
    g.rotateZ((rand() - 0.5) * 0.7);
    g.rotateX((rand() - 0.5) * 0.7);
    g.translate((rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.6);
    parts.push(colored(g, i % 2 ? "#9ff7ff" : "#c9a8ff"));
  }
  return merge(parts);
}

function mothGeo() {
  const w = (x, rz) => colored(at(new THREE.CircleGeometry(0.14, 5), x, 0, 0, { rx: -Math.PI / 2, rz }), "#f2e8ff");
  return merge([w(0.12, 0.3), w(-0.12, -0.3), colored(at(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 4), 0, 0, 0, { rx: Math.PI / 2 }), "#5a4a6a")]);
}

function staticGlows(points, { size = 3, opacity = 0.6 } = {}) {
  const pos = new Float32Array(points.length * 3);
  const col = new Float32Array(points.length * 3);
  const c = new THREE.Color();
  points.forEach((p, i) => {
    pos.set([p.x, p.y, p.z], i * 3);
    c.set(p.color);
    col.set([c.r, c.g, c.b], i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, map: glowTexture(), vertexColors: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  return new THREE.Points(g, m);
}

function markerGeo(rand) {
  return merge([
    colored(at(new THREE.CylinderGeometry(0.5, 0.6, 0.18, 8), 0, 0.09, 0), "#3a3358"),
    stemGeo(0.9, 0.12, 0.05, rand),
    at(capGeo(0.55, rand, "#b28cff", "#e8fffb"), 0.05, 0.86, 0),
    at(stemGeo(0.45, 0.06, -0.05, rand), 0.35, 0.15, 0.2),
    at(capGeo(0.25, rand, "#6ff7dc", "#ffffff"), 0.32, 0.58, 0.2),
  ]);
}

export async function build({ engine, quality }) {
  const rand = rng(77);
  const scene = engine.scene;
  const u = engine.uniforms;
  const lowQ = quality === "low";

  setupAtmosphere(engine, { top: "#090822", mid: "#22194a", bottom: "#140f2e", fog: "#1c1542", fogNear: 22, fogFar: 85, stars: 1.2, exposure: 1.25 });
  const { sun } = setupLights(engine, { sunDir: [-10, 24, 6], sunColor: "#a9b6ff", sunIntensity: 0.9, sky: "#5a4aa0", ground: "#141030", hemi: 1.1 });
  const moon = glowSprite("#e6e4ff", 26, 0.7);
  moon.position.set(-60, 70, -120);
  moon.material.fog = false;
  scene.add(moon);
  const moonCore = glowSprite("#ffffff", 9, 0.95);
  moonCore.position.copy(moon.position);
  moonCore.material.fog = false;
  scene.add(moonCore);

  const playerLight = new THREE.PointLight("#ffd9b0", 6, 9, 1.6);
  playerLight.position.set(0, 2.5, 0);
  scene.add(playerLight);

  const anchors = [
    { x: -5, z: -5 },
    { x: 5.5, z: -5.5 },
    { x: -7.5, z: 2.5 },
    { x: 7.5, z: 2 },
    { x: -4, z: 10.5 },
    { x: 5, z: 10 },
    { x: 0, z: -12.5 },
    { x: -12, z: -6 },
    { x: 13, z: -7 },
  ];
  const nearAnchor = nearAny(anchors, 2.2);

  const height = (x, z) => {
    const d = Math.hypot(x - POOL.x, z - POOL.z);
    return -smooth(POOL.r + 0.8, POOL.r - 1, d) * 0.6 + smooth(26, 55, Math.hypot(x, z)) * (fbm(x * 0.06, z * 0.06) * 10 + 1.5);
  };
  scene.add(
    makeGround({
      radius: 100,
      height,
      color: (x, z) => {
        const r = Math.hypot(x, z);
        const n = fbm(x * 0.16, z * 0.16);
        const moss = smooth(0.55, 0.75, fbm(x * 0.3 + 5, z * 0.3));
        const path = Math.abs(r - 4) < 0.5 ? 0.6 : 0;
        return new THREE.Color("#1d2440").lerp(new THREE.Color("#2b3a5a"), n).lerp(new THREE.Color("#2f7f86"), moss * 0.55 + path).lerp(new THREE.Color("#120f26"), smooth(26, 50, r) * 0.6);
      },
    }),
  );

  const water = makeWater(u, new THREE.CircleGeometry(POOL.r + 0.4, 32).rotateX(-Math.PI / 2), { deep: "#1a1050", shallow: "#3a7fd0", foam: "#9ff7ff", sky: "#5f4ac0", radius: POOL.r + 0.4, cx: POOL.x, cz: POOL.z, opacity: 0.92 });
  water.position.set(POOL.x, -0.1, POOL.z);
  scene.add(water);
  const poolGlow = glowSprite("#6fe8ff", 9, 0.25);
  poolGlow.position.set(POOL.x, 0.4, POOL.z);
  scene.add(poolGlow);

  const obstacles = [{ x: POOL.x, z: POOL.z, r: POOL.r + 0.2 }];
  const stemMat = mat();
  const capMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const capColors = [
    ["#9a6bff", "#e6fff8"],
    ["#38e0c8", "#f2fff9"],
    ["#ff6fd1", "#fff2fb"],
    ["#6fa8ff", "#f3f8ff"],
  ];

  const giants = [
    { x: -15, z: -12, h: 7, r: 3.4 },
    { x: 15, z: -13, h: 8, r: 3.8 },
    { x: -19, z: 0, h: 5.5, r: 2.8 },
    { x: 19, z: 1, h: 6, r: 3 },
    { x: -8, z: -19, h: 6.5, r: 3 },
    { x: 9, z: -19, h: 5, r: 2.6 },
    { x: 17, z: 13, h: 5.5, r: 2.8 },
    { x: -18, z: 15, h: 4.5, r: 2.4 },
    ...scatter(rand, lowQ ? 14 : 26, { rMin: 26, rMax: 50, minDist: 5 }).map((p) => ({ ...p, h: 6 + rand() * 6, r: 3 + rand() * 2 })),
  ];
  const glowPts = [];
  const stems = [];
  const capBuckets = capColors.map(() => []);
  giants.forEach((g, i) => {
    const bend = (rand() - 0.5) * 0.8;
    const y0 = height(g.x, g.z);
    const ry = rand() * 6;
    stems.push(merge([stemGeo(g.h, g.r * 0.16, bend, rand)]).applyMatrix4(new THREE.Matrix4().makeRotationY(ry)).translate(g.x, y0, g.z));
    const ci = i % capColors.length;
    const cx = g.x + Math.cos(-ry) * bend;
    const cz = g.z + Math.sin(-ry) * bend * -1;
    capBuckets[ci].push({ x: cx, y: y0 + g.h - 0.05, z: cz, s: g.r, ry: rand() * 6 });
    glowPts.push({ x: cx, y: y0 + g.h - 0.6, z: cz, color: capColors[ci][0] });
    if (Math.hypot(g.x, g.z) < 25) obstacles.push({ x: g.x, z: g.z, r: g.r * 0.2 + 0.3 });
  });
  const stemMesh = new THREE.Mesh(merge(stems), stemMat);
  stemMesh.castShadow = !lowQ;
  scene.add(stemMesh);
  capColors.forEach(([c, s], i) => scene.add(instanced(capGeo(1, rand, c, s), capMat, capBuckets[i])));

  const avoid = (x, z) => nearAnchor(x, z) || Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 1.5 || Math.hypot(x, z) < 5;
  const smallSpots = scatter(rand, lowQ ? 24 : 44, { rMin: 6, rMax: 25, minDist: 2.2, avoid });
  const smallStem = stemGeo(0.7, 0.08, 0.05, rand);
  const smallCap = at(capGeo(0.38, rand, "#ffffff", "#ffffff"), 0.05, 0.68, 0);
  const smallColors = ["#9a6bff", "#38e0c8", "#ff6fd1", "#6fa8ff", "#c9f76f"];
  const smallItems = smallSpots.map((p, i) => ({ ...p, s: 0.55 + rand() * 0.8, ry: rand() * 6, color: smallColors[i % smallColors.length] }));
  scene.add(instanced(smallStem, stemMat, smallItems.map(({ color, ...r }) => r)));
  scene.add(instanced(smallCap, capMat, smallItems));
  smallItems.forEach((p) => glowPts.push({ x: p.x, y: 0.6 * p.s, z: p.z, color: p.color }));
  smallItems.filter((p) => p.s > 1.1).forEach((p) => obstacles.push({ x: p.x, z: p.z, r: 0.3 }));

  const crystals = scatter(rand, 9, { rMin: 8, rMax: 24, minDist: 4, avoid, existing: smallSpots }).map((p) => ({ ...p, s: 0.8 + rand() * 0.8, ry: rand() * 6 }));
  const crystalMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
  scene.add(instanced(crystalGeo(rand), crystalMat, crystals));
  crystals.forEach((p) => {
    obstacles.push({ x: p.x, z: p.z, r: 0.6 * p.s });
    glowPts.push({ x: p.x, y: 0.8, z: p.z, color: "#9ff7ff" });
  });

  const darkTrees = scatter(rand, lowQ ? 30 : 60, { rMin: 27, rMax: 60, minDist: 4 }).map((p) => ({ ...p, y: height(p.x, p.z), s: 1.6 + rand(), ry: rand() * 6 }));
  scene.add(instanced(blobTree(rand, { trunk: "#2a2238", leaves: ["#2a2f5a", "#33306a"], h: 3.4, w: 2 }), mat(), darkTrees));

  const rocks = scatter(rand, 12, { rMin: 6, rMax: 24, minDist: 3, avoid }).map((p) => ({ ...p, s: 0.4 + rand() * 0.6, ry: rand() * 6 }));
  scene.add(instanced(rockGeo(rand, "#3d3a5a"), stemMat, rocks, { castShadow: true }));
  rocks.forEach((p) => obstacles.push({ x: p.x, z: p.z, r: p.s * 0.9 }));

  const grassGeo = await loadGeometry("/models/grass.glb");
  const tufts = scatter(rand, lowQ ? 80 : 170, { rMin: 3, rMax: 27, minDist: 0.9, avoid: (x, z) => Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 0.6 }).map((p) => ({ ...p, y: height(p.x, p.z), s: 0.8 + rand() * 0.8, ry: rand() * 6, color: rand() > 0.6 ? "#6ff7dc" : "#7a8fd8" }));
  scene.add(instanced(grassGeo, addSway(new THREE.MeshBasicMaterial({ vertexColors: true }), u, { strength: 0.25, speed: 1.4, height: 2.2 }), tufts.map((t) => ({ ...t, color: new THREE.Color(t.color).multiplyScalar(0.45).getStyle() }))));

  const stoneRing = ringPoints(14, 4, { offset: 0.1 }).map((p) => ({ x: p.x, z: p.z, s: 0.22, ry: p.a }));
  scene.add(instanced(rockGeo(rand, "#6f7fd0"), new THREE.MeshBasicMaterial({ vertexColors: true }), stoneRing));
  stoneRing.forEach((p) => glowPts.push({ x: p.x, y: 0.2, z: p.z, color: "#4f6fd0" }));

  const growth = new GrowthSet(engine, 2);
  const ringGeo = merge([stemGeo(0.5, 0.06, 0.03, rand), at(capGeo(0.26, rand, "#ffffff", "#ffffff"), 0.03, 0.48, 0)]);
  ringPoints(18, 8.6, { rand, jitter: 0.4, offset: 0.2 }).forEach((p, i) => {
    if (nearAnchor(p.x, p.z)) return;
    const c = smallColors[i % smallColors.length];
    const g = new THREE.Group();
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ vertexColors: true, color: c }));
    m.scale.setScalar(1.6);
    const halo = glowSprite(c, 2.2, 0.6);
    halo.position.y = 0.7;
    g.add(m, halo);
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    growth.add(g);
  });

  const glows = staticGlows(glowPts, { size: lowQ ? 2.2 : 3, opacity: 0.45 });
  scene.add(glows);

  const spores = new ParticleField(engine, { count: lowQ ? 120 : 260, radius: 26, yMin: 0, yMax: 9, mode: "rise", color: "#7ff7e0", color2: "#c9a8ff", size: 0.16, speed: 0.35, swirl: 1.2, blink: 0.6 });
  scene.add(spores.points);
  const fireflies = new ParticleField(engine, { count: lowQ ? 40 : 90, radius: 20, yMin: 0.5, yMax: 3.5, mode: "drift", color: "#fff2a8", size: 0.2, speed: 0.7, blink: 1, swirl: 0.8 });
  scene.add(fireflies.points);

  new Flock(engine, mothGeo(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), lowQ ? 6 : 12, (a, t, dt, o) => {
    const g = giants[a.i % 8];
    const k = t * (0.8 + (a.i % 3) * 0.2) + a.seed;
    o.position.set(g.x + Math.cos(k) * (g.r * 0.8), g.h - 1.2 + Math.sin(t * 2 + a.seed) * 0.4, g.z + Math.sin(k) * (g.r * 0.8));
    o.rotation.set(0, -k, 0);
    o.scale.set(0.4 + Math.abs(Math.sin(t * 16 + a.seed)) * 0.8, 1, 1.2);
  });

  const markerGeometry = markerGeo(rand);
  const markerMat = new THREE.MeshBasicMaterial({ vertexColors: true });

  return {
    bounds: 25,
    spawn: { x: 0, z: 2 },
    obstacles,
    anchors,
    sun,
    heightAt: (x, z) => Math.max(0, height(x, z)),
    isWalkable: (x, z) => Math.hypot(x - POOL.x, z - POOL.z) > POOL.r,
    palette: { glow: "#bfa8ff" },
    makeMarker: () => new THREE.Mesh(markerGeometry, markerMat),
    setGrowth: (n) => growth.setLevel(n),
    onPlayer: (pl) => {
      playerLight.position.set(pl.position.x, pl.position.y + 2.6, pl.position.z + 0.8);
    },
    update: (dt, t) => {
      glows.material.opacity = 0.42 + Math.sin(t * 1.3) * 0.06;
      poolGlow.material.opacity = 0.22 + Math.sin(t * 0.9) * 0.05;
    },
    dispose: () => {
      spores.dispose();
      fireflies.dispose();
    },
  };
}
