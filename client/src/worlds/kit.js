import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { skyMaterial } from "../engine/shaders.js";

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash2 = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function noise2(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const fbm = (x, z) => noise2(x, z) * 0.6 + noise2(x * 2.1, z * 2.1) * 0.3 + noise2(x * 4.3, z * 4.3) * 0.1;

export const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const lerp = (a, b, t) => a + (b - a) * t;

const tmpC = new THREE.Color();

export function colored(geometry, color, jitter = 0, rand = Math.random) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const base = new THREE.Color(color);
  for (let i = 0; i < n; i += 3) {
    tmpC.copy(base);
    if (jitter) tmpC.offsetHSL((rand() - 0.5) * jitter * 0.2, 0, (rand() - 0.5) * jitter);
    for (let k = 0; k < 3 && i + k < n; k++) {
      arr[(i + k) * 3] = tmpC.r;
      arr[(i + k) * 3 + 1] = tmpC.g;
      arr[(i + k) * 3 + 2] = tmpC.b;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

export function merge(parts) {
  const prepared = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    if (g.attributes.uv) g.deleteAttribute("uv");
    return g;
  });
  const m = mergeGeometries(prepared, false);
  m.computeBoundingBox();
  m.computeBoundingSphere();
  return m;
}

export function at(geometry, x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0, s = 1, sx, sy, sz } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx ?? s, sy ?? s, sz ?? s),
  );
  geometry.applyMatrix4(m);
  return geometry;
}

export function jitterGeo(geometry, amount, rand) {
  const p = geometry.attributes.position;
  const key = (i) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
  const offsets = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    if (!offsets.has(k)) offsets.set(k, [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount]);
    const o = offsets.get(k);
    p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
  }
  return geometry;
}

export const mat = (opts = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
export const stdMat = (opts = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...opts });

export function makeGround({ radius = 60, segments = 140, height = () => 0, color = () => "#7cb36a", material } = {}) {
  const geo = new THREE.CircleGeometry(radius, segments, 0, Math.PI * 2);
  geo.rotateX(-Math.PI / 2);
  const ringGeo = new THREE.PlaneGeometry(radius * 2, radius * 2, segments, segments);
  ringGeo.rotateX(-Math.PI / 2);
  const g = ringGeo;
  const p = g.attributes.position;
  const cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const h = height(x, z);
    p.setY(i, h);
    tmpC.set(color(x, z, h));
    cols[i * 3] = tmpC.r;
    cols[i * 3 + 1] = tmpC.g;
    cols[i * 3 + 2] = tmpC.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  geo.dispose();
  const mesh = new THREE.Mesh(g, material || mat());
  mesh.receiveShadow = true;
  return mesh;
}

export function setupAtmosphere(engine, { top, mid, bottom, fog, fogNear = 40, fogFar = 140, sun, sunColor, sunSize, stars = 0, exposure = 1.05 }) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMaterial({ top, mid, bottom, sun, sunColor, stars, sunSize }));
  sky.material.uniforms.uTime = engine.uniforms.uTime;
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  engine.scene.add(sky);
  engine.scene.fog = new THREE.Fog(fog || mid, fogNear, fogFar);
  engine.scene.background = new THREE.Color(mid);
  engine.renderer.toneMappingExposure = exposure;
  return sky;
}

export function setupLights(engine, { sunDir = [12, 22, 8], sunColor = "#fff2d9", sunIntensity = 2.4, sky = "#cfe8ff", ground = "#5d6b45", hemi = 1.2, shadowSize = 26, ambient = 0 }) {
  const hemiL = new THREE.HemisphereLight(sky, ground, hemi);
  engine.scene.add(hemiL);
  if (ambient) engine.scene.add(new THREE.AmbientLight("#ffffff", ambient));
  const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
  const dir = new THREE.Vector3(...sunDir);
  sun.userData.offset = dir.clone();
  sun.position.copy(dir);
  sun.castShadow = engine.quality !== "low";
  const res = engine.quality === "high" ? 2048 : 1024;
  sun.shadow.mapSize.set(res, res);
  const cam = sun.shadow.camera;
  cam.left = -shadowSize;
  cam.right = shadowSize;
  cam.top = shadowSize;
  cam.bottom = -shadowSize;
  cam.near = 1;
  cam.far = 90;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  engine.scene.add(sun);
  engine.scene.add(sun.target);
  return { sun, hemi: hemiL };
}

export function followShadow(sun, focus) {
  sun.target.position.set(focus.x, 0, focus.z);
  sun.position.set(focus.x + sun.userData.offset.x, sun.userData.offset.y, focus.z + sun.userData.offset.z);
}

const dummy = new THREE.Object3D();

export function instanced(geometry, material, items, { castShadow = false, receiveShadow = true, colors = null } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  items.forEach((it, i) => {
    dummy.position.set(it.x, it.y || 0, it.z);
    dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    const s = it.s ?? 1;
    dummy.scale.set(it.sx ?? s, it.sy ?? s, it.sz ?? s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colors) mesh.setColorAt(i, tmpC.set(colors[i % colors.length]));
    else if (it.color) mesh.setColorAt(i, tmpC.set(it.color));
  });
  mesh.count = items.length;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function scatter(rand, count, { rMin = 0, rMax = 30, minDist = 1.5, avoid = () => false, existing = [], cx = 0, cz = 0, tries = 30 } = {}) {
  const pts = [];
  const all = [...existing];
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < tries; t++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(lerp(rMin * rMin, rMax * rMax, rand()));
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (avoid(x, z)) continue;
      if (all.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (minDist * (p.k || 1)) ** 2)) continue;
      const pt = { x, z };
      pts.push(pt);
      all.push(pt);
      break;
    }
  }
  return pts;
}

export function ringPoints(n, r, { cx = 0, cz = 0, offset = 0, jitter = 0, rand = Math.random } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const a = offset + (i / n) * Math.PI * 2 + (rand() - 0.5) * jitter;
    const rr = r + (rand() - 0.5) * jitter * 2;
    return { x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr, a };
  });
}

export function rockGeo(rand, color = "#9a9a8e", { detail = 0, s = 1, squash = 0.7 } = {}) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  jitterGeo(g, 0.45, rand);
  at(g, 0, 0.35 * squash, 0, { sx: s, sy: s * squash, sz: s * (0.8 + rand() * 0.4) });
  return colored(g, color, 0.12, rand);
}

export function blobTree(rand, { trunk = "#7a5236", leaves = ["#5fa34a", "#74b856"], fruit = null, fruitCount = 0, h = 2.6, w = 1.6 } = {}) {
  const parts = [colored(at(new THREE.CylinderGeometry(0.13, 0.22, h * 0.55, 6), 0, h * 0.27, 0), trunk, 0.1, rand)];
  const blobs = 4;
  const centers = [];
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rand();
    const r = i === 0 ? 0 : w * 0.38;
    const c = { x: Math.cos(a) * r, y: h * 0.62 + (i === 0 ? w * 0.35 : rand() * 0.35), z: Math.sin(a) * r, s: w * (i === 0 ? 0.62 : 0.45 + rand() * 0.12) };
    centers.push(c);
    const g = new THREE.IcosahedronGeometry(1, 1);
    jitterGeo(g, 0.18, rand);
    parts.push(colored(at(g, c.x, c.y, c.z, { s: c.s, sy: c.s * 0.88 }), leaves[i % leaves.length], 0.1, rand));
  }
  for (let i = 0; i < fruitCount; i++) {
    const c = centers[Math.floor(rand() * centers.length)];
    const th = rand() * Math.PI * 2;
    const ph = rand() * Math.PI * 0.6 + 0.4;
    const fx = c.x + Math.sin(ph) * Math.cos(th) * c.s * 0.95;
    const fy = c.y + Math.cos(ph) * c.s * 0.8 - 0.1;
    const fz = c.z + Math.sin(ph) * Math.sin(th) * c.s * 0.95;
    parts.push(colored(at(new THREE.IcosahedronGeometry(0.14, 1), fx, fy, fz), fruit, 0.08, rand));
  }
  return merge(parts);
}

export function bushGeo(rand, colors = ["#5b9a48", "#6fae55"], s = 1) {
  const parts = [];
  const n = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    jitterGeo(g, 0.2, rand);
    const r = 0.45 * s * (0.7 + rand() * 0.5);
    parts.push(colored(at(g, (rand() - 0.5) * 0.7 * s, r * 0.75, (rand() - 0.5) * 0.7 * s, { s: r }), colors[i % colors.length], 0.1, rand));
  }
  return merge(parts);
}

export function flowerGeo(petal = "#ffd166", center = "#7a4b1e", stem = "#5d9a45") {
  const parts = [colored(at(new THREE.CylinderGeometry(0.02, 0.025, 0.45, 4), 0, 0.22, 0), stem)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(colored(at(new THREE.SphereGeometry(0.07, 5, 3), Math.cos(a) * 0.08, 0.46, Math.sin(a) * 0.08, { sy: 0.4 }), petal));
  }
  parts.push(colored(at(new THREE.SphereGeometry(0.05, 5, 3), 0, 0.48, 0), center));
  return merge(parts);
}

export function lanternGeo({ post = "#5a4632", glass = "#ffe6a8", h = 1.6 } = {}) {
  return merge([
    colored(at(new THREE.CylinderGeometry(0.05, 0.07, h, 6), 0, h / 2, 0), post),
    colored(at(new THREE.BoxGeometry(0.32, 0.36, 0.32), 0, h + 0.18, 0), glass),
    colored(at(new THREE.ConeGeometry(0.28, 0.2, 4), 0, h + 0.46, 0, { ry: Math.PI / 4 }), post),
  ]);
}

export function fenceGeo(len = 2, color = "#a07a52") {
  return merge([
    colored(at(new THREE.BoxGeometry(0.12, 0.8, 0.12), -len / 2, 0.4, 0), color),
    colored(at(new THREE.BoxGeometry(0.12, 0.8, 0.12), len / 2, 0.4, 0), color),
    colored(at(new THREE.BoxGeometry(len, 0.1, 0.06), 0, 0.55, 0), color),
    colored(at(new THREE.BoxGeometry(len, 0.1, 0.06), 0, 0.28, 0), color),
  ]);
}

export function cloudGeo(rand, color = "#ffffff") {
  const parts = [];
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const r = 1 + rand() * 1.2;
    parts.push(colored(at(g, (i - n / 2) * 1.3 + rand(), rand() * 0.6, (rand() - 0.5) * 1.2, { s: r, sy: r * 0.7 }), color));
  }
  return merge(parts);
}

export function addClouds(engine, rand, { count = 9, color = "#ffffff", y = 26, radius = 70, speed = 0.6, opacity = 0.95, emissive = 0.35 } = {}) {
  const variants = [cloudGeo(rand, color), cloudGeo(rand, color), cloudGeo(rand, color)];
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: opacity < 1, opacity, emissive: new THREE.Color(color).multiplyScalar(emissive), fog: false });
  const group = new THREE.Group();
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(variants[i % 3], material);
    const a = rand() * Math.PI * 2;
    const r = radius * (0.35 + rand() * 0.65);
    m.position.set(Math.cos(a) * r, y + rand() * 8, Math.sin(a) * r);
    m.scale.setScalar(1.4 + rand() * 1.6);
    m.rotation.y = rand() * Math.PI;
    clouds.push({ m, v: speed * (0.6 + rand() * 0.8) });
    group.add(m);
  }
  engine.scene.add(group);
  return (dt) => {
    for (const c of clouds) {
      c.m.position.x += c.v * dt;
      if (c.m.position.x > radius) c.m.position.x = -radius;
    }
  };
}

export class Flock {
  constructor(engine, geometry, material, count, step) {
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.frustumCulled = false;
    this.count = count;
    this.step = step;
    this.agents = Array.from({ length: count }, (_, i) => ({ i, seed: Math.random() * 100, s: 1 }));
    engine.scene.add(this.mesh);
    this.obj = new THREE.Object3D();
    engine.add((dt, t) => {
      for (const a of this.agents) {
        this.step(a, t, dt, this.obj);
        this.obj.updateMatrix();
        this.mesh.setMatrixAt(a.i, this.obj.matrix);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    });
  }
}

export function butterflyGeo(color = "#ffb4d2") {
  const wing = new THREE.CircleGeometry(0.16, 6);
  const l = at(wing.clone(), -0.14, 0, 0, { rx: -Math.PI / 2 });
  const r = at(wing.clone(), 0.14, 0, 0, { rx: -Math.PI / 2 });
  return merge([colored(l, color), colored(r, color), colored(at(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 4), 0, 0, 0, { rx: Math.PI / 2 }), "#3a2d2a")]);
}

export function butterflies(engine, { count = 10, colors = ["#ffb4d2", "#ffe08a", "#b9d7ff"], radius = 22, yMin = 0.8, yMax = 3, cx = 0, cz = 0 } = {}) {
  const geo = butterflyGeo("#ffffff");
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const flock = new Flock(engine, geo, m, count, (a, t, dt, o) => {
    const k = t * 0.25 + a.seed;
    const r = radius * (0.3 + 0.6 * ((Math.sin(a.seed * 3.1) + 1) / 2));
    o.position.set(cx + Math.cos(k * (0.6 + (a.i % 3) * 0.15)) * r, yMin + (yMax - yMin) * (0.5 + 0.5 * Math.sin(t * 0.8 + a.seed)), cz + Math.sin(k * 0.8) * r * 0.8);
    o.rotation.set(0, -k + Math.PI / 2, 0);
    const flap = Math.abs(Math.sin(t * 14 + a.seed));
    o.scale.set(0.35 + flap * 0.65, 1, 1);
  });
  for (let i = 0; i < count; i++) flock.mesh.setColorAt(i, tmpC.set(colors[i % colors.length]));
  flock.mesh.instanceColor.needsUpdate = true;
  return flock;
}

export class GrowthSet {
  constructor(engine, perLevel = 1) {
    this.items = [];
    this.level = 0;
    this.perLevel = perLevel;
    engine.add((dt) => this.update(dt));
  }
  add(obj, onReveal) {
    obj.userData.targetScale = obj.scale.clone();
    obj.userData.k = 0;
    obj.userData.goal = 0;
    obj.userData.onReveal = onReveal;
    obj.scale.setScalar(0.0001);
    obj.visible = false;
    this.items.push(obj);
    return obj;
  }
  setLevel(n) {
    const shown = Math.min(this.items.length, Math.floor(n * this.perLevel));
    this.items.forEach((o, i) => {
      const goal = i < shown ? 1 : 0;
      if (goal && !o.userData.goal) {
        o.userData.delay = (i - (this.level * this.perLevel)) * 0.12;
        o.userData.onReveal?.();
      }
      o.userData.goal = goal;
    });
    this.level = n;
  }
  update(dt) {
    for (const o of this.items) {
      const d = o.userData;
      if (d.delay > 0) {
        d.delay -= dt;
        continue;
      }
      if (d.k === d.goal) continue;
      d.k = d.goal > d.k ? Math.min(1, d.k + dt * 1.8) : Math.max(0, d.k - dt * 2.5);
      const e = d.goal ? 1 + Math.sin(d.k * Math.PI) * 0.25 * (1 - d.k) : d.k;
      const k = d.goal ? Math.min(1.12, d.k * e) : e;
      o.visible = d.k > 0.001;
      o.scale.copy(d.targetScale).multiplyScalar(Math.max(0.0001, k));
    }
  }
}

export const nearAny = (pts, d) => (x, z) => pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < d * d);

export function circleWalkable(radius) {
  return (x, z) => x * x + z * z < radius * radius;
}
