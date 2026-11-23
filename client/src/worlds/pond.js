import * as THREE from "three";
import { loadGeometry, sceneryMaterial } from "../engine/assets.js";
import { addSway, makeWater, glowSprite } from "../engine/shaders.js";
import { ParticleField } from "../engine/particles.js";
import { rng, fbm, smooth, colored, merge, at, mat, makeGround, setupAtmosphere, setupLights, instanced, scatter, ringPoints, rockGeo, bushGeo, flowerGeo, Flock, GrowthSet, nearAny } from "./kit.js";

const P = { x: 0, z: -4, r: 10 };
const inPond = (x, z, pad = 0) => Math.hypot(x - P.x, z - P.z) < P.r + pad;
const onWalk = (x, z) => Math.abs(x) < 1.15 && z > P.z - P.r - 1 && z < P.z + P.r + 1;
const onDeck = (x, z) => Math.hypot(x - P.x, z - P.z) < 3;

function willowGeo(rand) {
  const parts = [colored(at(new THREE.CylinderGeometry(0.2, 0.35, 3.2, 6), 0, 1.6, 0, { rz: 0.08 }), "#5c4a3a", 0.1, rand)];
  const crown = new THREE.IcosahedronGeometry(1.8, 1);
  parts.push(colored(at(crown, 0.1, 3.6, 0, { sy: 0.6 }), "#76a066", 0.1, rand));
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.2;
    const r = 1.45 + rand() * 0.35;
    const len = 1.6 + rand() * 1.1;
    parts.push(colored(at(new THREE.CylinderGeometry(0.16, 0.05, len, 4), Math.cos(a) * r, 3.3 - len / 2, Math.sin(a) * r, { sx: 1.6, sz: 0.5, ry: -a }), i % 2 ? "#7fa86a" : "#94b878", 0.08, rand));
  }
  return merge(parts);
}

function lotusGeo(petal = "#f7a8c8", glow = "#fff0b0") {
  const parts = [];
  for (let ring = 0; ring < 2; ring++) {
    const n = ring ? 6 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.3;
      const g = new THREE.SphereGeometry(0.16, 6, 4);
      parts.push(colored(at(g, Math.cos(a) * (0.16 - ring * 0.07), 0.12 + ring * 0.06, Math.sin(a) * (0.16 - ring * 0.07), { sx: 0.55, sy: 1.3 - ring * 0.2, sz: 0.3, ry: -a + Math.PI / 2, rz: 0.5 - ring * 0.3 }), ring ? "#ffd0e2" : petal));
    }
  }
  parts.push(colored(at(new THREE.SphereGeometry(0.08, 6, 4), 0, 0.2, 0), glow));
  return merge(parts);
}

function boardwalkGeo(len) {
  const parts = [];
  for (let z = 0; z < len; z += 0.5) {
    parts.push(colored(at(new THREE.BoxGeometry(2.3, 0.1, 0.42), 0, 0.12, -z), z % 1 ? "#a07a56" : "#93704f"));
  }
  for (let z = 0; z <= len; z += 2.5) {
    for (const x of [-1.15, 1.15]) {
      parts.push(colored(at(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 5), x, 0, -z), "#6b5038"));
      parts.push(colored(at(new THREE.BoxGeometry(0.1, 0.08, 2.5), x, 0.62, -z - 1.25), "#7d5d40"));
    }
  }
  return merge(parts);
}

function deckGeo() {
  const parts = [colored(at(new THREE.CylinderGeometry(3, 3, 0.16, 12), 0, 0.12, 0), "#9a7553", 0.08)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    parts.push(colored(at(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 5), Math.cos(a) * 2.7, 1.4, Math.sin(a) * 2.7), "#6b5038"));
  }
  parts.push(colored(at(new THREE.ConeGeometry(3.6, 1.4, 6), 0, 3.3, 0, { ry: Math.PI / 6 }), "#5f7a6a", 0.06));
  parts.push(colored(at(new THREE.SphereGeometry(0.18, 6, 4), 0, 4.1, 0), "#e8c26a"));
  return merge(parts);
}

function frogGeo() {
  return merge([
    colored(at(new THREE.SphereGeometry(0.22, 8, 6), 0, 0.16, 0, { sy: 0.7, sz: 1.15 }), "#6fb24a"),
    colored(at(new THREE.SphereGeometry(0.07, 6, 4), 0.1, 0.3, 0.12), "#e8f5c8"),
    colored(at(new THREE.SphereGeometry(0.07, 6, 4), -0.1, 0.3, 0.12), "#e8f5c8"),
    colored(at(new THREE.SphereGeometry(0.035, 5, 3), 0.11, 0.32, 0.17), "#1e1e1e"),
    colored(at(new THREE.SphereGeometry(0.035, 5, 3), -0.11, 0.32, 0.17), "#1e1e1e"),
  ]);
}

function dragonflyGeo() {
  const wing = (x, z, rz) => colored(at(new THREE.PlaneGeometry(0.34, 0.08), x, 0.02, z, { rx: -Math.PI / 2, rz }), "#cfeaff");
  return merge([
    colored(at(new THREE.CylinderGeometry(0.02, 0.012, 0.45, 4), 0, 0, -0.05, { rx: Math.PI / 2 }), "#3a8fb3"),
    colored(at(new THREE.SphereGeometry(0.04, 5, 3), 0, 0, 0.18), "#2c6b8a"),
    wing(0.18, 0.08, 0.15),
    wing(-0.18, 0.08, -0.15),
    wing(0.16, -0.02, -0.15),
    wing(-0.16, -0.02, 0.15),
  ]);
}

function markerGeo() {
  const pad = new THREE.CircleGeometry(0.7, 14, 0.3, Math.PI * 2 - 0.5);
  pad.rotateX(-Math.PI / 2);
  return merge([
    colored(at(new THREE.CylinderGeometry(0.75, 0.8, 0.14, 12), 0, 0.07, 0), "#6c5a48"),
    colored(at(pad, 0, 0.16, 0), "#5aa04a"),
    colored(at(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4), 0, 0.4, 0), "#5aa04a"),
    at(lotusGeo("#f39ac0", "#fff3b0"), 0, 0.55, 0, { s: 2.1 }),
  ]);
}

export async function build({ engine, quality }) {
  const rand = rng(51);
  const scene = engine.scene;
  const u = engine.uniforms;
  const lowQ = quality === "low";

  setupAtmosphere(engine, { top: "#4a4a86", mid: "#c99ac0", bottom: "#f3cbb8", fog: "#b99ab9", fogNear: 30, fogFar: 110, sun: [0.7, 0.06, -0.7], sunColor: "#ffc1a6", sunSize: 0.04, stars: 0.5, exposure: 1.05 });
  const { sun } = setupLights(engine, { sunDir: [18, 10, -16], sunColor: "#ffbfa0", sunIntensity: 2.1, sky: "#cdb8f0", ground: "#5f7350", hemi: 1.85 });

  const height = (x, z) => {
    const d = Math.hypot(x - P.x, z - P.z);
    const bowl = -smooth(P.r + 1.2, P.r - 1.5, d) * 1.1;
    return bowl + smooth(27, 60, Math.hypot(x, z)) * (fbm(x * 0.05, z * 0.05) * 9 + 1);
  };
  scene.add(
    makeGround({
      radius: 110,
      height,
      color: (x, z, h) => {
        const d = Math.hypot(x - P.x, z - P.z);
        if (d < P.r + 0.3) return "#4a5a46";
        if (d < P.r + 1.4) return "#8b8a5e";
        const path = Math.abs(x + Math.sin(z * 0.3) * 0.4) < 1.1 && z > P.z + P.r;
        if (path) return "#b9a27a";
        const n = fbm(x * 0.14, z * 0.14);
        return new THREE.Color("#6f9e5e").lerp(new THREE.Color("#8fb072"), n).lerp(new THREE.Color("#4f7a4f"), smooth(28, 70, Math.hypot(x, z)) * 0.6);
      },
    }),
  );

  const water = makeWater(u, new THREE.CircleGeometry(P.r + 0.6, 48).rotateX(-Math.PI / 2), { deep: "#1f3c5c", shallow: "#3d6b7c", foam: "#c9b8de", sky: "#8f7fb3", radius: P.r + 0.6, cx: P.x, cz: P.z, opacity: 0.93 });
  water.position.set(P.x, -0.08, P.z);
  scene.add(water);

  const anchors = [
    { x: -6.5, z: 9 },
    { x: 6.5, z: 9.5 },
    { x: -12.5, z: -1 },
    { x: 12.5, z: -3 },
    { x: -9, z: -15.5 },
    { x: 9, z: -16 },
    { x: 0, z: -17.5 },
    { x: -1.8, z: -2.2 },
    { x: 1.6, z: -6 },
  ];
  const nearAnchor = nearAny(anchors, 2.2);
  const obstacles = [];
  const sceneryMat = mat();

  const walkLen = P.r * 2 + 2;
  const walk = new THREE.Mesh(boardwalkGeo(walkLen), sceneryMat);
  walk.position.set(0, 0, P.z + P.r + 1);
  walk.castShadow = true;
  walk.receiveShadow = true;
  scene.add(walk);
  const deck = new THREE.Mesh(deckGeo(), sceneryMat);
  deck.position.set(P.x, 0, P.z);
  deck.castShadow = true;
  deck.receiveShadow = true;
  scene.add(deck);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    obstacles.push({ x: P.x + Math.cos(a) * 2.7, z: P.z + Math.sin(a) * 2.7, r: 0.12 });
  }
  const deckGlow = glowSprite("#ffd08a", 2.2, 0.55);
  deckGlow.position.set(P.x, 2.4, P.z);
  scene.add(deckGlow);

  const lilyGeo = await loadGeometry("/models/lilypad.glb");
  const bigLilyGeo = await loadGeometry("/models/largeLilypad.glb");
  const pads = scatter(rand, lowQ ? 30 : 55, { rMin: 3.6, rMax: P.r - 0.6, cx: P.x, cz: P.z, minDist: 1.1, avoid: (x) => Math.abs(x) < 1.8 });
  scene.add(instanced(lilyGeo, sceneryMaterial(), pads.map((p) => ({ ...p, y: -0.06, s: 0.9 + rand() * 0.9, ry: rand() * 6, sy: 0.4 }))));
  const tallPads = scatter(rand, 9, { rMin: 4, rMax: P.r - 1.5, cx: P.x, cz: P.z, minDist: 3, avoid: (x) => Math.abs(x) < 2.4, existing: pads });
  scene.add(instanced(bigLilyGeo, addSway(sceneryMaterial(), u, { strength: 0.02, speed: 0.8, height: 0.4 }), tallPads.map((p) => ({ ...p, y: -0.1, s: 1.6 + rand() * 0.8, ry: rand() * 6 })), { castShadow: !lowQ }));

  const lotusPts = pads.filter((_, i) => i % 3 === 0);
  scene.add(instanced(lotusGeo(), mat({ emissive: "#ff9ac8", emissiveIntensity: 0.12 }), lotusPts.map((p) => ({ ...p, y: 0.02, s: 1 + rand() * 0.5, ry: rand() * 6 }))));

  const cattailGeo = await loadGeometry("/models/cattail.glb");
  const cattails = [];
  for (const p of ringPoints(lowQ ? 26 : 44, P.r + 0.4, { cx: P.x, cz: P.z, jitter: 0.6, rand })) {
    if (Math.abs(p.x) < 2.2) continue;
    cattails.push({ x: p.x, z: p.z, y: height(p.x, p.z), s: 1.6 + rand() * 1.1, ry: rand() * 6 });
  }
  const outerCattails = scatter(rand, lowQ ? 20 : 40, { rMin: 24, rMax: 34, minDist: 1.5 }).map((p) => ({ ...p, y: height(p.x, p.z), s: 1.6 + rand(), ry: rand() * 6 }));
  scene.add(instanced(cattailGeo, addSway(sceneryMaterial(), u, { strength: 0.06, speed: 1.3, height: 0.9 }), [...cattails, ...outerCattails], { castShadow: !lowQ }));

  const willow = willowGeo(rand);
  const willows = [
    { x: -13.5, z: -10 },
    { x: 13, z: -12 },
    { x: -15, z: 5 },
    { x: 15.5, z: 4 },
    { x: -18, z: 13 },
    { x: 18.5, z: 12 },
    ...scatter(rand, lowQ ? 18 : 34, { rMin: 26, rMax: 58, minDist: 4.5 }),
  ].map((p, i) => ({ ...p, y: height(p.x, p.z), s: (i < 6 ? 1.15 : 1.4) + rand() * 0.5, ry: rand() * 6 }));
  willows.slice(0, 6).forEach((p) => obstacles.push({ x: p.x, z: p.z, r: 0.7 }));
  scene.add(instanced(willow, addSway(mat(), u, { strength: 0.015, speed: 0.9, height: 0.5 }), willows, { castShadow: !lowQ }));

  const avoidLand = (x, z) => inPond(x, z, 2) || Math.abs(x) < 1.6 || nearAnchor(x, z);
  const rocks = scatter(rand, 14, { rMin: 10, rMax: 25, minDist: 3, avoid: avoidLand }).map((p) => ({ ...p, y: height(p.x, p.z), s: 0.35 + rand() * 0.55, ry: rand() * 6 }));
  const pondRocks = ringPoints(10, P.r + 0.2, { cx: P.x, cz: P.z, jitter: 0.8, rand, offset: 0.4 }).filter((p) => Math.abs(p.x) > 2).map((p) => ({ x: p.x, z: p.z, y: -0.2, s: 0.4 + rand() * 0.5, ry: rand() * 6 }));
  scene.add(instanced(rockGeo(rand, "#8b8d86"), sceneryMat, [...rocks, ...pondRocks], { castShadow: true }));
  rocks.forEach((p) => obstacles.push({ x: p.x, z: p.z, r: p.s * 0.9 }));

  const bushes = scatter(rand, 14, { rMin: 14, rMax: 25, minDist: 3, avoid: avoidLand, existing: rocks }).map((p) => ({ ...p, s: 1 + rand() * 0.6, ry: rand() * 6 }));
  scene.add(instanced(bushGeo(rand, ["#4f7f52", "#5f8f5a"]), sceneryMat, bushes, { castShadow: true }));
  bushes.forEach((p) => obstacles.push({ x: p.x, z: p.z, r: 0.8 * p.s }));

  const grassGeo = await loadGeometry("/models/grass.glb");
  const tufts = scatter(rand, lowQ ? 80 : 170, { rMin: P.r + 1.5, rMax: 27, minDist: 0.9, cx: 0, cz: 0, avoid: (x, z) => inPond(x, z, 1.4) || Math.abs(x) < 1.4 }).map((p) => ({ ...p, y: height(p.x, p.z), s: 0.9 + rand() * 0.8, ry: rand() * 6 }));
  scene.add(instanced(grassGeo, addSway(sceneryMaterial(), u, { strength: 0.25, speed: 1.8, height: 2.2 }), tufts));
  const flowers = scatter(rand, lowQ ? 40 : 80, { rMin: P.r + 2, rMax: 25, minDist: 0.8, avoid: avoidLand });
  scene.add(instanced(flowerGeo("#ffffff"), addSway(mat(), u, { strength: 0.12, speed: 1.6, height: 2 }), flowers.map((p) => ({ ...p, y: height(p.x, p.z), s: 0.8 + rand() * 0.5, ry: rand() * 6 })), { colors: ["#e0c3ff", "#ffd1e8", "#fff3c8", "#bfe3ff"] }));

  const growth = new GrowthSet(engine, 2);
  const lanternGeo = merge([lotusGeo("#ffb3d1", "#fff8c8")]);
  const lanternMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lanternSpots = ringPoints(16, 6.3, { cx: P.x, cz: P.z, rand, jitter: 0.6 }).filter((p) => Math.abs(p.x) > 1.8);
  const floaters = [];
  lanternSpots.forEach((p) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(lanternGeo, lanternMat);
    m.scale.setScalar(1.6);
    const halo = glowSprite("#ffd6a8", 1.6, 0.75);
    halo.position.y = 0.35;
    g.add(m, halo);
    g.position.set(p.x, 0, p.z);
    g.userData.seed = rand() * 10;
    scene.add(g);
    growth.add(g);
    floaters.push(g);
  });

  const fireflies = new ParticleField(engine, { count: lowQ ? 60 : 130, radius: 22, yMin: 0.4, yMax: 4, mode: "drift", color: "#e8ff9a", color2: "#fff3a0", size: 0.22, speed: 0.8, blink: 1, swirl: 0.7 });
  scene.add(fireflies.points);
  const mist = new ParticleField(engine, { count: lowQ ? 14 : 26, radius: P.r + 2, center: [P.x, 0, P.z], yMin: 0.2, yMax: 0.8, mode: "drift", color: "#f2e6f6", size: 9, speed: 0.15, swirl: 0.9, additive: false, opacity: 0.14 });
  scene.add(mist.points);

  new Flock(engine, dragonflyGeo(), mat({ side: THREE.DoubleSide }), lowQ ? 4 : 7, (a, t, dt, o) => {
    const k = t * 0.4 + a.seed;
    const r = 4 + (a.i % 3) * 2.5;
    const dart = Math.sin(t * 1.3 + a.seed) > 0.85 ? 1 : 0;
    o.position.set(P.x + Math.cos(k) * r + Math.sin(t * 3 + a.seed) * 0.3 * dart, 1 + Math.sin(t * 2 + a.seed) * 0.4, P.z + Math.sin(k * 1.3) * r);
    o.rotation.set(0, -k * 1.15, Math.sin(t * 40) * 0.05);
    o.scale.setScalar(1.2);
  });

  const ripples = [];
  const rippleGeo = new THREE.RingGeometry(0.35, 0.42, 24).rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const r = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: "#f6ecff", transparent: true, opacity: 0, depthWrite: false }));
    r.position.y = 0.0;
    r.userData.t = 1;
    scene.add(r);
    ripples.push(r);
  }
  const spawnRipple = (x, z) => {
    const r = ripples.find((q) => q.userData.t >= 1) || ripples[0];
    r.position.set(x, 0.0, z);
    r.userData.t = 0;
  };

  const frogPads = pads.filter((_, i) => i % 4 === 1).slice(0, 5);
  const frogs = frogPads.map((p) => ({ home: p, x: p.x, z: p.z, hopT: -1, next: 2 + rand() * 6, from: p, to: p }));
  const frogFlock = new Flock(engine, frogGeo(), mat(), Math.max(1, frogs.length), (a, t, dt, o) => {
    const f = frogs[a.i];
    if (!f) return;
    if (f.hopT < 0) {
      f.next -= dt;
      if (f.next <= 0) {
        const cands = pads.filter((p) => Math.hypot(p.x - f.x, p.z - f.z) < 3.5 && p !== f.from);
        f.to = cands[Math.floor(rand() * cands.length)] || f.home;
        f.from = { x: f.x, z: f.z };
        f.hopT = 0;
      }
    } else {
      f.hopT += dt / 0.55;
      if (f.hopT >= 1) {
        f.hopT = -1;
        f.x = f.to.x;
        f.z = f.to.z;
        f.next = 3 + rand() * 6;
        spawnRipple(f.x, f.z);
      } else {
        f.x = f.from.x + (f.to.x - f.from.x) * f.hopT;
        f.z = f.from.z + (f.to.z - f.from.z) * f.hopT;
      }
    }
    const k = f.hopT >= 0 ? f.hopT : 0;
    o.position.set(f.x, 0.02 + 4 * 0.6 * k * (1 - k), f.z);
    o.rotation.set(0, f.hopT >= 0 ? Math.atan2(f.to.x - f.from.x, f.to.z - f.from.z) : o.rotation.y, 0);
    o.scale.setScalar(1.2);
  });
  frogFlock.mesh.castShadow = true;

  const markerGeometry = markerGeo();
  const markerMat = mat({ emissive: "#ff9ac8", emissiveIntensity: 0.08 });

  return {
    bounds: 25,
    spawn: { x: 0, z: 10 },
    obstacles,
    anchors,
    sun,
    heightAt: (x, z) => (onWalk(x, z) || onDeck(x, z) ? 0.17 : Math.max(0, height(x, z))),
    isWalkable: (x, z) => !inPond(x, z, 0.3) || onWalk(x, z) || onDeck(x, z),
    palette: { glow: "#ffd6a8" },
    makeMarker: () => {
      const m = new THREE.Mesh(markerGeometry, markerMat);
      m.castShadow = true;
      return m;
    },
    setGrowth: (n) => growth.setLevel(n),
    onPlayer: (pl, sp) => {
      if (sp > 1 && Math.random() < 0.03 && (onWalk(pl.position.x, pl.position.z) || onDeck(pl.position.x, pl.position.z))) {
        spawnRipple(pl.position.x + (Math.random() - 0.5) * 3.5, pl.position.z + (Math.random() - 0.5) * 2);
      }
    },
    update: (dt, t) => {
      for (const r of ripples) {
        if (r.userData.t >= 1) continue;
        r.userData.t = Math.min(1, r.userData.t + dt * 0.7);
        const k = r.userData.t;
        r.scale.setScalar(1 + k * 4);
        r.material.opacity = (1 - k) * 0.55;
      }
      for (const g of floaters) {
        g.position.y = Math.sin(t * 1.2 + g.userData.seed) * 0.05;
        g.rotation.y = t * 0.1 + g.userData.seed;
      }
      deckGlow.material.opacity = 0.5 + Math.sin(t * 1.7) * 0.08;
      if (Math.random() < dt * 0.6) {
        const a = Math.random() * Math.PI * 2;
        const rr = 3.5 + Math.random() * (P.r - 4);
        spawnRipple(P.x + Math.cos(a) * rr, P.z + Math.sin(a) * rr);
      }
    },
    dispose: () => {
      fireflies.dispose();
      mist.dispose();
    },
  };
}
