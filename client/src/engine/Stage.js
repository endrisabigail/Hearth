import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Engine } from "./Engine.js";
import { Character } from "./Character.js";
import { Burst } from "./particles.js";
import { loadGeometry, characterMaterial } from "./assets.js";
import { AVATARS, avatarFor } from "../lib/avatars.js";
import { rng, ringPoints } from "../worlds/kit.js";
import { addSway } from "./shaders.js";

const R = 4;

const DRESS = {
  default: { top: "#8fc46a", edge: "#77ad58", band: "#c9a77c", under: "#9c7a58", tuft: "#8cc65e", accents: ["#ffd6e6", "#fff1b0", "#d9ccff"], kind: "flowers" },
  apple: { top: "#a9b85a", edge: "#93a44c", band: "#c99d6c", under: "#8f6a48", tuft: "#c9b45a", accents: ["#d8352a", "#e8822a", "#f2c14e"], kind: "leaves" },
  fish: { top: "#e8d6a6", edge: "#d6c08a", band: "#b9a57a", under: "#6f8f8a", tuft: "#7fd1a0", accents: ["#ff7a8a", "#ffd36a", "#5fd0c8"], kind: "coral" },
  frog: { top: "#86b46a", edge: "#6f9e58", band: "#9a8a68", under: "#5f6b55", tuft: "#7fb06a", accents: ["#f7a8c8", "#ffd0e2", "#e0c3ff"], kind: "lotus" },
  mushroom: { top: "#3b4a72", edge: "#2f3b5e", band: "#5a4a7a", under: "#241d40", tuft: "#5fd8c4", accents: ["#9a6bff", "#38e0c8", "#ff6fd1"], kind: "shrooms" },
  snail: { top: "#6f9a58", edge: "#5f8a4c", band: "#9a9d94", under: "#6f746a", tuft: "#86b46a", accents: ["#cfefff", "#b9c8c4", "#f2c46d"], kind: "pebbles" },
  tomato: { top: "#8fc45e", edge: "#79b04e", band: "#a9784e", under: "#7a5236", tuft: "#9ccf62", accents: ["#e2382b", "#ffc928", "#ffffff"], kind: "flowers" },
};

function platformGeo(d) {
  const pts = [
    [0, 0.02],
    [R * 0.6, 0.01],
    [R - 0.28, -0.02],
    [R - 0.06, -0.1],
    [R, -0.24],
    [R - 0.02, -0.42],
    [R - 0.12, -0.56],
    [R * 0.86, -0.78],
    [R * 0.62, -1.02],
    [R * 0.34, -1.2],
    [0, -1.26],
  ]
    .reverse()
    .map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 96);
  const p = g.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const top = new THREE.Color(d.top);
  const edge = new THREE.Color(d.edge);
  const band = new THREE.Color(d.band);
  const under = new THREE.Color(d.under);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (y > -0.12) c.copy(top).lerp(edge, Math.min(1, Math.max(0, (r - R * 0.55) / (R * 0.45))));
    else if (y > -0.6) c.copy(band).lerp(edge, Math.max(0, (y + 0.12) / 0.1) * 0);
    else c.copy(band).lerp(under, Math.min(1, (-y - 0.6) / 0.5));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

function smooth(geo, color) {
  const g = geo.index ? geo : geo;
  const n = g.attributes.position.count;
  const c = new THREE.Color(color);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute("uv");
  return g;
}

function mergeSmooth(parts) {
  return BufferGeometryUtils.mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
}

function flowerGeo() {
  const parts = [smooth(new THREE.CylinderGeometry(0.018, 0.022, 0.32, 6).translate(0, 0.16, 0), "#5f9a48")];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const g = new THREE.SphereGeometry(0.06, 12, 8);
    g.scale(1.25, 0.45, 0.8);
    g.translate(0.07, 0, 0);
    g.rotateY(a);
    g.translate(0, 0.33, 0);
    parts.push(smooth(g, "#ffffff"));
  }
  parts.push(smooth(new THREE.SphereGeometry(0.04, 12, 8).translate(0, 0.35, 0), "#f2b630"));
  return mergeSmooth(parts);
}

function pebbleGeo() {
  const g = new THREE.SphereGeometry(0.18, 18, 12);
  g.scale(1.2, 0.55, 0.95);
  g.translate(0, 0.05, 0);
  return smooth(g, "#ffffff");
}

function shroomGeo() {
  const cap = new THREE.SphereGeometry(0.16, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.scale(1, 0.7, 1).translate(0, 0.2, 0);
  return mergeSmooth([smooth(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 10).translate(0, 0.11, 0), "#f2ecf8"), smooth(cap, "#ffffff")]);
}

function coralGeo() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const h = 0.22 + (i % 3) * 0.08;
    const g = new THREE.CapsuleGeometry(0.035, h, 4, 10);
    g.translate(0, h / 2, 0);
    g.rotateZ((i - 2) * 0.28);
    g.rotateX(((i * 7) % 5 - 2) * 0.12);
    parts.push(smooth(g, "#ffffff"));
  }
  return mergeSmooth(parts);
}

function leafGeo() {
  const g = new THREE.SphereGeometry(0.12, 14, 8);
  g.scale(1, 0.12, 0.6);
  g.translate(0, 0.02, 0);
  return smooth(g, "#ffffff");
}

function lotusGeo() {
  const parts = [];
  const pad = new THREE.CylinderGeometry(0.28, 0.28, 0.02, 24, 1, false, 0.3, Math.PI * 2 - 0.5);
  parts.push(smooth(pad.translate(0, 0.01, 0), "#6fae5a"));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const g = new THREE.SphereGeometry(0.07, 12, 8);
    g.scale(0.55, 1.2, 0.35);
    g.rotateZ(0.5);
    g.translate(0.06, 0.09, 0);
    g.rotateY(a);
    parts.push(smooth(g, "#ffffff"));
  }
  return mergeSmooth(parts);
}

const ACCENT = { flowers: flowerGeo, leaves: leafGeo, coral: coralGeo, lotus: lotusGeo, shrooms: shroomGeo, pebbles: pebbleGeo };

function placeInstances(geo, material, items, castShadow = false) {
  const mesh = new THREE.InstancedMesh(geo, material, items.length);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  items.forEach((it, i) => {
    o.position.set(it.x, it.y || 0, it.z);
    o.rotation.set(0, it.ry || 0, 0);
    o.scale.setScalar(it.s || 1);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
    if (it.color) mesh.setColorAt(i, c.set(it.color));
  });
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

export class Stage {
  constructor(canvas, { mode = "ring", avatarId = "frog", reducedMotion = false } = {}) {
    this.engine = new Engine(canvas, { quality: "high", alpha: true });
    const r = this.engine.renderer;
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.mode = mode;
    this.reduced = reducedMotion;
    this.chars = [];
    this.disposed = false;
    const s = this.engine.scene;
    this.hemi = new THREE.HemisphereLight("#fff8ee", "#7a6a5a", 1.35);
    s.add(this.hemi);
    const key = new THREE.DirectionalLight("#fff0dc", 2.6);
    key.position.set(3.5, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -5.5;
    sc.right = sc.top = 5.5;
    sc.near = 1;
    sc.far = 25;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    s.add(key);
    const rim = new THREE.DirectionalLight("#cfe4ff", 1.6);
    rim.position.set(-5, 4, -7);
    s.add(rim);
    this.island = new THREE.Group();
    s.add(this.island);
    this.dressing = null;
    this.setTheme(mode === "ring" ? "default" : avatarId);
    this.burst = new Burst(this.engine, 120);
    s.add(this.burst.points);
    this.engine.camera.fov = 32;
    this.engine.camera.updateProjectionMatrix();
    this.setCamera();
    this.engine.add((dt, t) => this.update(dt, t));
  }

  setTheme(id) {
    const key = DRESS[id] ? id : "default";
    if (this.themeKey === key) return;
    this.themeKey = key;
    const d = DRESS[key];
    if (this.dressing) {
      this.island.remove(this.dressing);
      this.dressing.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
    const g = new THREE.Group();
    const rand = rng(key.length * 97 + 3);
    const plat = new THREE.Mesh(platformGeo(d), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    plat.receiveShadow = true;
    g.add(plat);
    const tuftItems = [];
    for (const p of ringPoints(34, R - 0.45, { rand, jitter: 0.35 })) tuftItems.push({ x: p.x, z: p.z, s: 1.1 + rand() * 0.6, ry: rand() * 6, color: d.tuft });
    for (const p of ringPoints(10, R * 0.7, { rand, jitter: 0.6, offset: 0.2 })) tuftItems.push({ x: p.x, z: p.z, s: 0.8 + rand() * 0.4, ry: rand() * 6, color: d.tuft });
    loadGeometry("/models/grass.glb").then((geo) => {
      if (this.disposed || this.dressing !== g) return;
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
      addSway(m, this.engine.uniforms, { strength: 0.22, speed: 1.8, height: 2.2 });
      g.add(placeInstances(geo, m, tuftItems));
    });
    const accentItems = ringPoints(d.kind === "lotus" ? 9 : 16, R - 0.9, { rand, jitter: 0.7, offset: 0.5 }).map((p, i) => ({
      x: p.x,
      z: p.z,
      s: 0.8 + rand() * 0.6,
      ry: rand() * 6,
      color: d.accents[i % d.accents.length],
    }));
    const accentMat = d.kind === "shrooms" ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    g.add(placeInstances(ACCENT[d.kind](), accentMat, accentItems, true));
    this.dressing = g;
    this.island.add(g);
    const dark = key === "mushroom";
    this.hemi.intensity = dark ? 1.0 : 1.35;
  }

  setCamera() {
    const cam = this.engine.camera;
    if (this.mode === "ring") {
      cam.position.set(0, 5.2, 17.5);
      cam.lookAt(0, 0.2, 0);
    } else {
      const shift = this.engine.width > 980 ? 2.4 : 0;
      cam.position.set(shift, 3.6, 13.2);
      cam.lookAt(shift, 1.15, 0);
    }
  }

  async init() {
    if (this.mode === "ring") {
      const geos = await Promise.all(AVATARS.map((a) => loadGeometry(a.model)));
      if (this.disposed) return;
      geos.forEach((g, i) => {
        const c = new Character({ geometry: g, material: characterMaterial(), height: 1.55, castShadow: true });
        const a = (i / geos.length) * Math.PI * 2;
        c.position.set(Math.sin(a) * 2.75, 0, Math.cos(a) * 2.75);
        c.shadow.visible = false;
        c.ringAngle = a;
        c.phaseOffset = i * 0.7;
        this.island.add(c.root);
        this.chars.push(c);
      });
    } else {
      await this.show(this.pendingAvatar || "frog", true);
    }
    this.engine.start();
  }

  async show(avatarId, instant = false) {
    this.pendingAvatar = avatarId;
    this.setTheme(avatarId);
    const av = avatarFor(avatarId);
    const [g, cg] = await Promise.all([loadGeometry(av.model), loadGeometry(av.companion)]);
    if (this.disposed || this.pendingAvatar !== avatarId) return;
    for (const old of this.chars) {
      old.leaving = 0;
    }
    const hero = new Character({ geometry: g, material: characterMaterial(), height: 2.1, castShadow: true });
    hero.position.set(-0.35, 0, 0.4);
    hero.shadow.visible = false;
    hero.enter = instant ? 1 : 0;
    hero.root.scale.setScalar(instant ? 1 : 0.001);
    hero.targetHeading = 0.25;
    hero.heading = instant ? 0.25 : -1.4;
    const pal = new Character({ geometry: cg, material: characterMaterial(), height: 0.9, floaty: true, hover: 1.1, castShadow: true });
    pal.position.set(1.35, 0, -0.1);
    pal.shadow.material.opacity = 0.5;
    pal.enter = instant ? 1 : 0;
    pal.root.scale.setScalar(instant ? 1 : 0.001);
    pal.targetHeading = -0.3;
    pal.isPal = true;
    this.island.add(hero.root, pal.root);
    this.chars.push(hero, pal);
    this.hero = hero;
    if (!instant) this.burst.spawn({ x: -0.35, y: 1.2, z: 0.4 }, { count: 40, colors: ["#ffffff", "#fff3b0", "#ffd6e6"], speed: 3, up: 4, life: 1, size: 0.45 });
  }

  celebrate() {
    this.hero?.celebrate();
    this.chars.find((c) => c.isPal && c.leaving === undefined)?.celebrate();
    this.burst.spawn({ x: -0.35, y: 1.6, z: 0.4 }, { count: 90, colors: ["#ffd166", "#ffffff", "#ff9ecb", "#9fe6ff"], speed: 5, up: 7, life: 1.5, size: 0.6 });
  }

  update(dt, t) {
    if (this.mode !== "ring" && this.lastW !== this.engine.width) {
      this.lastW = this.engine.width;
      this.setCamera();
    }
    if (this.mode === "ring") {
      if (!this.reduced) this.island.rotation.y += dt * 0.18;
      this.island.position.y = Math.sin(t * 0.8) * 0.12;
      for (const c of this.chars) {
        const hopping = Math.max(0, Math.sin(t * 0.9 + c.phaseOffset * 2));
        if (hopping > 0.995 && !c.airborne) c.jump();
        c.targetHeading = c.ringAngle + Math.sin(t * 0.5 + c.phaseOffset) * 0.4;
        c.update(dt, t, 0);
      }
    } else {
      this.island.position.y = Math.sin(t * 0.8) * 0.08;
      if (!this.reduced) this.island.rotation.y = Math.sin(t * 0.25) * 0.18;
      for (let i = this.chars.length - 1; i >= 0; i--) {
        const c = this.chars[i];
        if (c.leaving !== undefined) {
          c.leaving += dt * 4;
          c.root.scale.setScalar(Math.max(0.001, 1 - c.leaving));
          c.root.position.y = c.leaving * 0.6;
          if (c.leaving >= 1) {
            this.island.remove(c.root);
            c.dispose();
            this.chars.splice(i, 1);
          }
        } else if (c.enter < 1) {
          c.enter = Math.min(1, c.enter + dt * 2.4);
          const e = c.enter;
          c.root.scale.setScalar(Math.max(0.001, e * (1 + Math.sin(e * Math.PI) * 0.3)));
        }
        if (c.leaving === undefined) c.update(dt, t, 0);
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.burst.dispose();
    this.chars.forEach((c) => c.dispose());
    this.engine.dispose();
  }
}
