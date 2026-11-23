import * as THREE from "three";
import { loadGeometry, sceneryMaterial } from "../engine/assets.js";
import { addSway, addCaustics, glowSprite } from "../engine/shaders.js";
import { ParticleField, Burst } from "../engine/particles.js";
import { rng, fbm, smooth, colored, merge, at, mat, makeGround, setupAtmosphere, setupLights, instanced, scatter, ringPoints, rockGeo, jitterGeo, Flock, nearAny } from "./kit.js";

function branchCoral(rand, color) {
  const parts = [];
  const grow = (x, y, z, len, rad, ax, az, depth) => {
    const g = new THREE.CylinderGeometry(rad * 0.7, rad, len, 5);
    g.translate(0, len / 2, 0);
    g.rotateX(ax);
    g.rotateZ(az);
    g.translate(x, y, z);
    parts.push(colored(g, color, 0.12, rand));
    const tip = new THREE.Vector3(0, len, 0).applyEuler(new THREE.Euler(ax, 0, az));
    const nx = x + tip.x;
    const ny = y + tip.y;
    const nz = z + tip.z;
    if (depth > 0) {
      const n = 2 + (rand() > 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) grow(nx, ny, nz, len * 0.72, rad * 0.7, ax + (rand() - 0.5) * 1.1, az + (rand() - 0.5) * 1.1, depth - 1);
    } else {
      parts.push(colored(at(new THREE.SphereGeometry(rad * 1.1, 5, 4), nx, ny, nz), color));
    }
  };
  for (let i = 0; i < 3; i++) grow((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3, 0.7, 0.12, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6, 2);
  return merge(parts);
}

function brainCoral(rand, color) {
  const g = new THREE.IcosahedronGeometry(0.8, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 + Math.sin(v.x * 9 + v.y * 4) * 0.05 + Math.sin(v.z * 8) * 0.04;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, Math.max(-0.2, v.y) * 0.75 + 0.15, v.z);
  }
  return colored(g, color, 0.08, rand);
}

function tubeCoral(rand, color) {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const h = 0.5 + rand() * 0.9;
    const x = (rand() - 0.5) * 0.7;
    const z = (rand() - 0.5) * 0.7;
    parts.push(colored(at(new THREE.CylinderGeometry(0.12, 0.09, h, 7, 1, true), x, h / 2, z), color));
    parts.push(colored(at(new THREE.TorusGeometry(0.11, 0.035, 4, 8), x, h, z, { rx: Math.PI / 2 }), "#fff1d6"));
  }
  return merge(parts);
}

function fanCoral(rand, color) {
  const parts = [colored(at(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 4), 0, 0.2, 0), color)];
  const g = new THREE.CircleGeometry(0.9, 9, 0, Math.PI);
  jitterGeo(g, 0.12, rand);
  parts.push(colored(at(g, 0, 0.3, 0), color, 0.1, rand));
  return merge(parts);
}

function kelpGeo(h = 6) {
  const g = new THREE.PlaneGeometry(0.45, h, 1, 10);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) * (1 - y / h * 0.6) + Math.sin(y * 0.9) * 0.15);
  }
  const cols = new Float32Array(p.count * 3);
  const a = new THREE.Color("#2f6b3a");
  const b = new THREE.Color("#9bbf4a");
  for (let i = 0; i < p.count; i++) {
    const c = a.clone().lerp(b, p.getY(i) / h);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

function fishGeo() {
  return merge([
    colored(at(new THREE.SphereGeometry(0.22, 8, 6), 0, 0, 0, { sx: 0.45, sz: 1 }), "#ffffff"),
    colored(at(new THREE.ConeGeometry(0.14, 0.22, 4), 0, 0, -0.28, { rx: -Math.PI / 2, sx: 0.25 }), "#ffffff"),
  ]);
}

function jellyGeo() {
  const parts = [colored(at(new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0, { sy: 0.8 }), "#ffb8d9")];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(colored(at(new THREE.CylinderGeometry(0.025, 0.01, 1.4, 3), Math.cos(a) * 0.4, -0.7, Math.sin(a) * 0.4), "#ffd6ea"));
  }
  return merge(parts);
}

function shipGeo() {
  const hull = new THREE.CylinderGeometry(1.8, 1.8, 7, 12, 1, false, 0, Math.PI);
  hull.rotateZ(Math.PI / 2);
  hull.rotateY(Math.PI / 2);
  return merge([
    colored(at(hull, 0, 1.6, 0, { sy: 1, sx: 0.9 }), "#6a4b3a", 0.15),
    colored(at(new THREE.BoxGeometry(3.2, 0.15, 6.6), 0, 1.6, 0), "#836048"),
    colored(at(new THREE.CylinderGeometry(0.13, 0.16, 5.5, 6), 0.2, 4.2, 0.8, { rz: 0.35 }), "#5a3e2e"),
    colored(at(new THREE.BoxGeometry(2.4, 0.12, 0.12), 0.8, 5.6, 0.8, { rz: 0.35 }), "#5a3e2e"),
    colored(at(new THREE.PlaneGeometry(2, 1.8), 0.95, 4.6, 0.85, { rz: 0.35 }), "#cbb99a"),
    colored(at(new THREE.BoxGeometry(0.9, 0.6, 0.7), -0.6, 2, -2), "#8a5a2e"),
    colored(at(new THREE.BoxGeometry(0.95, 0.12, 0.75), -0.6, 2.33, -2), "#d9b04a"),
  ]);
}

function clamGeo(open = 0.5) {
  const bottom = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const top = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  return {
    bottom: colored(at(bottom, 0, 0.6, 0, { sy: 0.55 }), "#a786c9", 0.08),
    top: colored(at(top, 0, 0, 0, { sy: 0.55 }), "#b996dc", 0.08),
  };
}

function markerGeo() {
  const b = new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const t = new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  return merge([
    colored(at(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 8), 0, 0.15, 0), "#c9b58a", 0.1),
    colored(at(b, 0, 0.55, 0, { sy: 0.6 }), "#f39bb8"),
    colored(at(t, 0, 0.55, -0.12, { sy: 0.6, rx: -0.7 }), "#f6b3c9"),
    colored(at(new THREE.SphereGeometry(0.2, 12, 10), 0, 0.66, 0.08), "#fff8f0"),
  ]);
}

export async function build({ engine, quality }) {
  const rand = rng(33);
  const scene = engine.scene;
  const u = engine.uniforms;
  const lowQ = quality === "low";

  setupAtmosphere(engine, { top: "#6fd3dc", mid: "#13708a", bottom: "#082f40", fog: "#145f78", fogNear: 16, fogFar: 62, exposure: 0.95 });
  const { sun } = setupLights(engine, { sunDir: [4, 26, 6], sunColor: "#c4f3ff", sunIntensity: 1.25, sky: "#5fc4d4", ground: "#0f3a48", hemi: 1.15 });

  const height = (x, z) => {
    const r = Math.hypot(x, z);
    return smooth(24, 50, r) * (fbm(x * 0.06, z * 0.06) * 10 + 2) + fbm(x * 0.3, z * 0.3) * 0.25;
  };
  const groundMat = addCaustics(mat(), u, { scale: 0.28, strength: 0.22, color: "#9ff0ff" });
  scene.add(
    makeGround({
      radius: 100,
      height,
      material: groundMat,
      color: (x, z, h) => {
        const ripple = Math.sin(x * 1.3 + Math.sin(z * 0.4) * 2) * 0.5 + 0.5;
        const base = new THREE.Color("#c8b88a").lerp(new THREE.Color("#b09e72"), ripple * 0.5).lerp(new THREE.Color("#4f9ea3"), 0.3);
        const r = Math.hypot(x, z);
        return base.lerp(new THREE.Color("#7a8f84"), smooth(22, 40, r) * 0.6 + fbm(x * 0.2, z * 0.2) * 0.15);
      },
    }),
  );

  const anchors = ringPoints(9, 11, { offset: 0.35 }).map((p, i) => ({ x: p.x * (i % 2 ? 1 : 0.82), z: p.z * (i % 2 ? 1 : 0.82) }));
  const nearAnchor = nearAny(anchors, 2.2);
  const obstacles = [];
  const sceneryMat = mat();

  const ship = new THREE.Mesh(shipGeo(), sceneryMat);
  ship.position.set(-15, -0.6, -11);
  ship.rotation.set(0.12, 0.7, 0.18);
  ship.castShadow = true;
  scene.add(ship);
  obstacles.push({ x: -15, z: -11, r: 2.6 }, { x: -17.2, z: -13.6, r: 2 }, { x: -12.8, z: -8.4, r: 2 });

  const clam = clamGeo();
  const clamGroup = new THREE.Group();
  const clamBottom = new THREE.Mesh(clam.bottom, sceneryMat);
  const clamTop = new THREE.Mesh(clam.top, sceneryMat);
  clamTop.position.set(0, 0.6, -0.9);
  clamTop.geometry.translate(0, 0, 0.9);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshStandardMaterial({ color: "#fff7ef", roughness: 0.15, metalness: 0.2, emissive: "#ffe9f4", emissiveIntensity: 0.4 }));
  pearl.position.y = 0.75;
  const pearlGlow = glowSprite("#ffe0f0", 3, 0.6);
  pearlGlow.position.y = 0.8;
  clamGroup.add(clamBottom, clamTop, pearl, pearlGlow);
  clamGroup.position.set(15, 0, -12);
  clamGroup.scale.setScalar(1.6);
  clamGroup.rotation.y = -0.6;
  scene.add(clamGroup);
  obstacles.push({ x: 15, z: -12, r: 1.9 });

  const coralColors = ["#ff7a8a", "#ff9f5a", "#c58bff", "#ffd36a", "#5fd0c8", "#ff6fb5"];
  const avoid = (x, z) => nearAnchor(x, z) || Math.hypot(x + 15, z + 11) < 5 || Math.hypot(x - 15, z + 12) < 3.5 || Math.hypot(x, z) < 4.5;
  const coralSpots = scatter(rand, lowQ ? 40 : 70, { rMin: 6, rMax: 26, minDist: 2.1, avoid });
  const variants = [branchCoral(rand, "#ffffff"), branchCoral(rand, "#ffffff"), brainCoral(rand, "#ffffff"), tubeCoral(rand, "#ffffff"), fanCoral(rand, "#ffffff")];
  const buckets = variants.map(() => []);
  coralSpots.forEach((p, i) => {
    const v = i % variants.length;
    buckets[v].push({ ...p, y: height(p.x, p.z) - 0.05, s: 0.8 + rand() * 0.9, ry: rand() * 6, color: coralColors[Math.floor(rand() * coralColors.length)] });
    if (Math.hypot(p.x, p.z) < 23) obstacles.push({ x: p.x, z: p.z, r: 0.55 });
  });
  const fanMat = addSway(mat({ side: THREE.DoubleSide }), u, { strength: 0.06, speed: 1, height: 1 });
  buckets.forEach((items, i) => scene.add(instanced(variants[i], i === 4 ? fanMat : sceneryMat, items, { castShadow: !lowQ && i !== 4 })));

  const rockItems = scatter(rand, 18, { rMin: 8, rMax: 26, minDist: 3, avoid, existing: coralSpots }).map((p) => ({ ...p, y: height(p.x, p.z) - 0.2, s: 0.7 + rand() * 1.2, ry: rand() * 6 }));
  scene.add(instanced(rockGeo(rand, "#6f8a86", { detail: 1 }), sceneryMat, rockItems, { castShadow: true }));
  rockItems.forEach((p) => obstacles.push({ x: p.x, z: p.z, r: p.s * 0.8 }));

  const kelpItems = [
    ...ringPoints(lowQ ? 40 : 70, 27, { jitter: 2.2, rand }),
    ...scatter(rand, lowQ ? 20 : 40, { rMin: 29, rMax: 45, minDist: 1.6 }),
  ].map((p) => ({ x: p.x, z: p.z, y: height(p.x, p.z) - 0.1, s: 0.8 + rand() * 0.7, ry: rand() * 6 }));
  scene.add(instanced(kelpGeo(7), addSway(mat({ side: THREE.DoubleSide }), u, { strength: 0.03, speed: 1.1, height: 1 }), kelpItems));

  const grassGeo = await loadGeometry("/models/grass.glb");
  const seaGrass = scatter(rand, lowQ ? 60 : 130, { rMin: 4, rMax: 26, minDist: 1, avoid }).map((p) => ({ ...p, y: height(p.x, p.z), s: 0.8 + rand() * 0.8, ry: rand() * 6, color: rand() > 0.5 ? "#7fd1a0" : "#b6d66a" }));
  scene.add(instanced(grassGeo, addSway(sceneryMaterial(), u, { strength: 0.35, speed: 1.4, height: 2.2 }), seaGrass));

  const shafts = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(1.2, 3.2, 34, 10, 1, true);
  shaftGeo.translate(0, 17, 0);
  const shaftMats = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.MeshBasicMaterial({ color: "#d8fbff", transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    shaftMats.push(m);
    const s = new THREE.Mesh(shaftGeo, m);
    const p = ringPoints(7, 12 + (i % 3) * 5, { offset: i * 0.6 })[i];
    s.position.set(p.x, -1, p.z);
    s.rotation.set(0.18, 0, -0.22);
    s.renderOrder = 5;
    shafts.add(s);
  }
  scene.add(shafts);

  const bubbles = new ParticleField(engine, { count: lowQ ? 70 : 150, radius: 26, yMin: 0, yMax: 16, mode: "rise", shape: "bubble", color: "#e8fdff", size: 0.3, speed: 1.4, swirl: 0.6, additive: true, opacity: 0.8 });
  scene.add(bubbles.points);
  const plankton = new ParticleField(engine, { count: lowQ ? 80 : 180, radius: 24, yMin: 0.5, yMax: 9, mode: "drift", color: "#c6fff6", size: 0.08, speed: 0.4, swirl: 0.8, blink: 0.6, opacity: 0.8 });
  scene.add(plankton.points);
  const trail = new Burst(engine, 80, { shape: "bubble" });
  scene.add(trail.points);

  const schoolColors = ["#ffcf5a", "#5fd8ff", "#ff8a6a"];
  const fishMat = mat();
  for (let s = 0; s < 3; s++) {
    const count = lowQ ? 8 : 14;
    const cx = [-8, 9, 2][s];
    const cz = [4, 6, -12][s];
    const r = [7, 6, 8][s];
    const flock = new Flock(engine, fishGeo(), fishMat, count, (a, t, dt, o) => {
      const k = t * (0.35 + s * 0.05) * (s % 2 ? -1 : 1) + a.i * 0.09;
      const rr = r + Math.sin(a.seed) * 1.4;
      o.position.set(cx + Math.cos(k) * rr, 2.2 + s * 0.8 + Math.sin(t + a.seed) * 0.6 + Math.sin(a.seed * 2) * 0.8, cz + Math.sin(k) * rr * 0.75);
      o.rotation.set(0, -k + (s % 2 ? Math.PI : 0) + Math.sin(t * 6 + a.seed) * 0.12, 0);
      o.scale.setScalar(0.9 + Math.sin(a.seed * 3) * 0.3);
    });
    for (let i = 0; i < count; i++) flock.mesh.setColorAt(i, new THREE.Color(schoolColors[s]).offsetHSL(0, 0, (rand() - 0.5) * 0.15));
    flock.mesh.instanceColor.needsUpdate = true;
  }

  const jellyMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.6, emissive: "#ff9ccd", emissiveIntensity: 0.35, depthWrite: false });
  new Flock(engine, jellyGeo(), jellyMat, lowQ ? 4 : 7, (a, t, dt, o) => {
    const ang = a.seed * 2;
    const r = 10 + (a.seed % 1) * 12;
    const pulse = Math.sin(t * 2 + a.seed);
    o.position.set(Math.cos(ang + t * 0.03) * r, 5 + Math.sin(t * 0.4 + a.seed) * 2 + pulse * 0.15, Math.sin(ang + t * 0.03) * r);
    o.rotation.set(Math.sin(t * 0.5 + a.seed) * 0.2, 0, Math.cos(t * 0.4 + a.seed) * 0.2);
    o.scale.set(1 + pulse * 0.12, 1 - pulse * 0.12, 1 + pulse * 0.12);
  });

  const growthGroup = new THREE.Group();
  scene.add(growthGroup);
  const glowCoralGeo = branchCoral(rand, "#ffffff");
  const glowMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#ff9ccd", emissiveIntensity: 0.6 });
  const glowSpots = ringPoints(16, 7, { rand, jitter: 0.5 });
  const glowItems = [];
  const growthLevelMeshes = [];
  glowSpots.forEach((p, i) => {
    const m = new THREE.Mesh(glowCoralGeo, glowMat);
    m.position.set(p.x, 0, p.z);
    m.scale.setScalar(0.0001);
    m.rotation.y = rand() * 6;
    m.userData.target = 0.8 + rand() * 0.4;
    m.visible = false;
    growthGroup.add(m);
    growthLevelMeshes.push(m);
    glowItems.push(m);
  });
  let growthLevel = 0;

  const markerGeometry = markerGeo();
  let trailT = 0;

  return {
    bounds: 25,
    spawn: { x: 0, z: 2 },
    obstacles,
    anchors,
    sun,
    flags: { underwater: true },
    heightAt: (x, z) => Math.max(0, fbm(x * 0.3, z * 0.3) * 0.25 - 0.05),
    palette: { glow: "#bff6ff" },
    camera: { distance: 14.5, height: 11.5 },
    makeMarker: () => new THREE.Mesh(markerGeometry, sceneryMat),
    setGrowth: (n) => {
      growthLevel = Math.min(glowItems.length, n * 2);
    },
    onPlayer: (pl, sp, dt) => {
      trailT += dt * (0.6 + sp * 0.7);
      if (trailT > 0.35) {
        trailT = 0;
        trail.spawn({ x: pl.position.x, y: pl.position.y + 1.2, z: pl.position.z }, { count: 1, colors: ["#e8fdff"], speed: 0.3, up: 1.6, gravity: -1.2, life: 2.2, size: 0.45, spread: 0.4 });
      }
    },
    update: (dt, t) => {
      shaftMats.forEach((m, i) => (m.opacity = 0.045 + Math.sin(t * 0.5 + i * 1.7) * 0.025));
      const o = (Math.sin(t * 0.5) * 0.5 + 0.5) * 0.45;
      clamTop.rotation.x = -o;
      pearlGlow.material.opacity = 0.45 + o * 0.5;
      glowItems.forEach((m, i) => {
        const goal = i < growthLevel ? m.userData.target : 0;
        const cur = m.scale.x;
        const next = cur + (goal - cur) * Math.min(1, dt * 2.5);
        m.scale.setScalar(Math.max(0.0001, next));
        m.visible = next > 0.01;
      });
    },
    dispose: () => {
      bubbles.dispose();
      plankton.dispose();
      trail.dispose();
    },
  };
}
