import * as THREE from "three";
import { Engine } from "./Engine.js";
import { Character } from "./Character.js";
import { Burst } from "./particles.js";
import { loadGeometry, characterMaterial } from "./assets.js";
import { AVATARS, avatarFor } from "../lib/avatars.js";
import { rng, colored, merge, at, mat, jitterGeo, flowerGeo, instanced, ringPoints, bushGeo } from "../worlds/kit.js";

function islandGeo(rand) {
  const top = new THREE.CylinderGeometry(4.2, 3.6, 0.7, 28, 2);
  jitterGeo(top, 0.12, rand);
  const under = new THREE.ConeGeometry(3.6, 3.4, 14, 3);
  under.rotateX(Math.PI);
  jitterGeo(under, 0.35, rand);
  return merge([colored(at(top, 0, -0.35, 0), "#86bd5a", 0.15, rand), colored(at(under, 0, -2.4, 0), "#8a6a4e", 0.15, rand)]);
}

export class Stage {
  constructor(canvas, { mode = "ring", avatarId = "frog", reducedMotion = false } = {}) {
    this.engine = new Engine(canvas, { quality: "medium", alpha: true });
    this.engine.renderer.setClearColor(0x000000, 0);
    this.engine.renderer.shadowMap.enabled = false;
    this.mode = mode;
    this.reduced = reducedMotion;
    this.chars = [];
    this.spin = 0;
    this.disposed = false;
    const s = this.engine.scene;
    s.add(new THREE.HemisphereLight("#fff6e8", "#6a7a5a", 1.7));
    const sun = new THREE.DirectionalLight("#fff1dc", 2.2);
    sun.position.set(4, 8, 6);
    s.add(sun);
    const rand = rng(4);
    this.island = new THREE.Group();
    this.island.add(new THREE.Mesh(islandGeo(rand), mat()));
    const flowers = ringPoints(18, 3.5, { rand, jitter: 0.6 }).map((p) => ({ x: p.x, z: p.z, s: 0.9 + rand() * 0.5, ry: rand() * 6 }));
    this.island.add(instanced(flowerGeo("#ffffff"), mat(), flowers, { colors: ["#ffd6e6", "#fff1b0", "#d9ccff", "#ffffff"] }));
    const bushes = ringPoints(5, 3.7, { rand, jitter: 0.5, offset: 0.4 }).map((p) => ({ x: p.x, z: p.z, s: 0.6 + rand() * 0.3, ry: rand() * 6 }));
    this.island.add(instanced(bushGeo(rand), mat(), bushes));
    s.add(this.island);
    this.burst = new Burst(this.engine, 120);
    s.add(this.burst.points);
    this.engine.camera.fov = 32;
    this.engine.camera.updateProjectionMatrix();
    this.setCamera();
    this.engine.add((dt, t) => this.update(dt, t));
  }

  setCamera() {
    const cam = this.engine.camera;
    if (this.mode === "ring") {
      cam.position.set(0, 5.2, 17.5);
      cam.lookAt(0, 0.2, 0);
    } else {
      const shift = this.engine.width > 980 ? 2.4 : 0;
      cam.position.set(shift, 3.1, 11.5);
      cam.lookAt(shift, 1.15, 0);
    }
  }

  async init() {
    if (this.mode === "ring") {
      const geos = await Promise.all(AVATARS.map((a) => loadGeometry(a.model)));
      if (this.disposed) return;
      geos.forEach((g, i) => {
        const c = new Character({ geometry: g, material: characterMaterial(), height: 1.55, castShadow: false });
        const a = (i / geos.length) * Math.PI * 2;
        c.position.set(Math.sin(a) * 2.75, 0, Math.cos(a) * 2.75);
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
    const av = avatarFor(avatarId);
    const [g, cg] = await Promise.all([loadGeometry(av.model), loadGeometry(av.companion)]);
    if (this.disposed || this.pendingAvatar !== avatarId) return;
    for (const old of this.chars) {
      old.leaving = 0;
    }
    const hero = new Character({ geometry: g, material: characterMaterial(), height: 2.1, castShadow: false });
    hero.position.set(-0.35, 0, 0.4);
    hero.enter = instant ? 1 : 0;
    hero.root.scale.setScalar(instant ? 1 : 0.001);
    hero.targetHeading = 0.25;
    hero.heading = instant ? 0.25 : -1.4;
    const pal = new Character({ geometry: cg, material: characterMaterial(), height: 0.9, floaty: true, hover: 1.1, castShadow: false });
    pal.position.set(1.35, 0, -0.1);
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
