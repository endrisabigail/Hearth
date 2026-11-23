import * as THREE from "three";
import { Engine } from "./Engine.js";
import { Character } from "./Character.js";
import { QuestMarkers } from "./QuestMarkers.js";
import { Burst } from "./particles.js";
import { loadGeometry, characterMaterial } from "./assets.js";
import { followShadow } from "../worlds/kit.js";
import { avatarFor } from "../lib/avatars.js";

export const MAP_HALF = 28;
export const toWorld = (nx, ny) => ({ x: (nx - 0.5) * 2 * MAP_HALF, z: (ny - 0.5) * 2 * MAP_HALF });
export const toNorm = (x, z) => ({
  x: Math.min(1, Math.max(0, x / (2 * MAP_HALF) + 0.5)),
  y: Math.min(1, Math.max(0, z / (2 * MAP_HALF) + 0.5)),
});

const WORLDS = {
  orchard: () => import("../worlds/orchard.js"),
  reef: () => import("../worlds/reef.js"),
  pond: () => import("../worlds/pond.js"),
  glowwood: () => import("../worlds/glowwood.js"),
  raingarden: () => import("../worlds/raingarden.js"),
  farm: () => import("../worlds/farm.js"),
};

const MOVE_KEYS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

const isTyping = () => {
  const el = document.activeElement;
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

export class Plaza {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts;
    this.cb = opts.callbacks || {};
    this.engine = new Engine(canvas, { quality: opts.quality === "auto" ? "high" : opts.quality });
    this.keys = new Set();
    this.remotes = new Map();
    this.travel = null;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.intro = opts.reducedMotion ? 0 : 1;
    this.vel = new THREE.Vector2();
    this.lastEmit = 0;
    this.lastNorm = { x: -1, y: -1 };
    this.near = null;
    this.lastCompanionEmit = 0;
    this.disposed = false;
    this.camTarget = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (opts.quality === "auto") {
      this.engine.onSlow = () => {
        const next = this.engine.quality === "high" ? "medium" : "low";
        if (this.engine.quality !== "low") {
          this.engine.setQuality(next);
          this.cb.onQualityChange?.(next);
        }
      };
    }
  }

  async init() {
    const { theme, avatarId, start } = this.opts;
    const avatar = avatarFor(avatarId);
    const worldMod = await WORLDS[theme.world]();
    if (this.disposed) return;
    this.cb.onProgress?.(0.3);
    const [world, playerGeo, companionGeo] = await Promise.all([
      worldMod.build({ engine: this.engine, quality: this.engine.quality, reducedMotion: this.opts.reducedMotion }),
      loadGeometry(avatar.model),
      loadGeometry(avatar.companion),
    ]);
    if (this.disposed) return;
    this.cb.onProgress?.(0.85);
    this.world = world;
    this.heightAt = world.heightAt || (() => 0);
    const scene = this.engine.scene;

    const floaty = !!world.flags?.underwater;
    this.player = new Character({ geometry: playerGeo, material: characterMaterial(), height: 1.7, floaty, hover: floaty ? 0.25 : 0 });
    scene.add(this.player.root);
    let p = start ? toWorld(start.x, start.y) : world.spawn;
    if (!this.walkable(p.x, p.z)) p = world.spawn;
    this.player.position.set(p.x, this.heightAt(p.x, p.z), p.z);

    this.companion = new Character({ geometry: companionGeo, material: characterMaterial(), height: 0.8, floaty: true, hover: 1.05, castShadow: true });
    this.companion.position.set(p.x - 1.3, 0, p.z + 0.6);
    scene.add(this.companion.root);

    this.markers = new QuestMarkers(this.engine, world, { heightAt: this.heightAt, showLabels: this.opts.showNames !== false });
    this.burst = new Burst(this.engine);
    scene.add(this.burst.points);
    if (this.pendingQuests) this.markers.sync(this.pendingQuests);
    if (this.pendingGrowth !== undefined) world.setGrowth?.(this.pendingGrowth);
    if (this.pendingRemotes) this.syncRemotes(this.pendingRemotes);

    this.placeCamera(true);
    this.bindInput();
    this.engine.add((dt, t) => this.update(dt, t));
    this.engine.start();
    this.cb.onProgress?.(1);
    this.cb.onReady?.();
  }

  walkable(x, z) {
    const w = this.world;
    if (x * x + z * z > w.bounds * w.bounds) return false;
    return w.isWalkable ? w.isWalkable(x, z) : true;
  }

  collide(x, z, r = 0.45) {
    for (const o of this.world.obstacles) {
      const dx = x - o.x;
      const dz = z - o.z;
      const rr = o.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = o.x + (dx / d) * rr;
        z = o.z + (dz / d) * rr;
      }
    }
    return { x, z };
  }

  bindInput() {
    this.onKeyDown = (e) => {
      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (MOVE_KEYS[e.code]) {
        e.preventDefault();
        this.keys.add(e.code);
        this.travel = null;
      } else if (e.code === "Space") {
        e.preventDefault();
        this.player.jump();
      } else if (e.code === "KeyE" || e.code === "Enter") {
        if (this.near) {
          e.preventDefault();
          this.cb.onOpenQuest?.(this.near.quest);
        }
      } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        this.keys.add("Shift");
      }
    };
    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.code.startsWith("Shift")) this.keys.delete("Shift");
    };
    this.onBlur = () => this.keys.clear();
    this.onPointerDown = (e) => {
      this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    this.onPointerUp = (e) => {
      if (!this.downAt) return;
      const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
      this.downAt = null;
      if (moved > 8) return;
      this.handleTap(e);
    };
    this.onPointerMove = (e) => {
      if (e.pointerType !== "mouse") return;
      const now = performance.now();
      if (now - (this.lastHover || 0) < 60) return;
      this.lastHover = now;
      const id = this.pickMarker(e);
      this.markers.setHovered(id);
      this.canvas.style.cursor = id ? "pointer" : "";
    };
    this.onWheel = (e) => {
      e.preventDefault();
      this.zoomTarget = Math.min(1.45, Math.max(0.6, this.zoomTarget * (1 + Math.sign(e.deltaY) * 0.08)));
    };
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  setPointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.engine.camera);
  }

  pickMarker(e) {
    this.setPointer(e);
    const hits = this.raycaster.intersectObjects(this.markers.hitTargets(), false);
    return hits[0]?.object.userData.questId || null;
  }

  handleTap(e) {
    const id = this.pickMarker(e);
    if (id) {
      this.travelToQuest(id, true);
      return;
    }
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      let x = hit.x;
      let z = hit.z;
      const r = Math.hypot(x, z);
      if (r > this.world.bounds - 0.5) {
        x *= (this.world.bounds - 0.5) / r;
        z *= (this.world.bounds - 0.5) / r;
      }
      this.travel = { x, z, questId: null, stop: 0.15 };
      this.burst.spawn({ x, y: 0.1, z }, { count: 10, colors: ["#ffffff"], speed: 2, up: 1.5, gravity: 4, life: 0.5, size: 0.35 });
    }
  }

  travelToQuest(id, open = true) {
    const pos = this.markers.positionOf(id);
    if (!pos) return false;
    this.travel = { x: pos.x, z: pos.z, questId: open ? id : null, stop: 1.7 };
    return true;
  }

  update(dt, t) {
    const pl = this.player;
    let ix = 0;
    let iz = 0;
    if (!isTyping()) {
      for (const k of this.keys) {
        const v = MOVE_KEYS[k];
        if (v) {
          ix += v[0];
          iz += v[1];
        }
      }
    }
    const run = this.keys.has("Shift") ? 1.55 : 1;
    let dirX = 0;
    let dirZ = 0;
    if (ix || iz) {
      const l = Math.hypot(ix, iz);
      dirX = ix / l;
      dirZ = iz / l;
    } else if (this.travel) {
      const dx = this.travel.x - pl.position.x;
      const dz = this.travel.z - pl.position.z;
      const d = Math.hypot(dx, dz);
      if (d <= this.travel.stop) {
        const q = this.travel.questId;
        this.travel = null;
        if (q) {
          const m = this.markers.markers.get(q);
          if (m) {
            pl.face(m.group.position.x - pl.position.x, m.group.position.z - pl.position.z);
            this.cb.onOpenQuest?.(m.quest);
          }
        }
      } else {
        const slow = Math.min(1, d / 1.2);
        dirX = (dx / d) * slow;
        dirZ = (dz / d) * slow;
      }
    }
    const speed = 6.2 * run;
    const accel = Math.min(1, dt * 12);
    this.vel.x += (dirX * speed - this.vel.x) * accel;
    this.vel.y += (dirZ * speed - this.vel.y) * accel;
    const sp = this.vel.length();
    if (sp > 0.05) {
      let nx = pl.position.x + this.vel.x * dt;
      let nz = pl.position.z + this.vel.y * dt;
      ({ x: nx, z: nz } = this.collide(nx, nz));
      if (!this.walkable(nx, nz)) {
        if (this.walkable(nx, pl.position.z)) nz = pl.position.z;
        else if (this.walkable(pl.position.x, nz)) nx = pl.position.x;
        else {
          nx = pl.position.x;
          nz = pl.position.z;
          if (this.travel) this.travel = null;
        }
      }
      const mdx = nx - pl.position.x;
      const mdz = nz - pl.position.z;
      pl.position.x = nx;
      pl.position.z = nz;
      if (Math.abs(mdx) + Math.abs(mdz) > 1e-4) pl.face(mdx, mdz);
    }
    pl.position.y = this.heightAt(pl.position.x, pl.position.z);
    pl.update(dt, t, Math.min(1, sp / 6.2));
    this.world.onPlayer?.(pl, sp, dt);

    this.updateCompanion(dt, t);
    this.updateRemotes(dt, t);
    this.updateCamera(dt);
    if (this.world.sun) followShadow(this.world.sun, pl.position);
    this.world.update?.(dt, t, pl.position);
    this.updateNear();
    this.emitPosition();
  }

  updateCompanion(dt, t) {
    const c = this.companion;
    const pl = this.player;
    const h = pl.heading;
    const ox = Math.cos(h) * -1.25 + Math.sin(h) * -0.7;
    const oz = -Math.sin(h) * -1.25 + Math.cos(h) * -0.7;
    const tx = pl.position.x + ox;
    const tz = pl.position.z + oz;
    const k = Math.min(1, dt * 3.2);
    const dx = (tx - c.position.x) * k;
    const dz = (tz - c.position.z) * k;
    c.position.x += dx;
    c.position.z += dz;
    c.position.y = pl.position.y;
    const moving = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
    if (moving > 0.4) c.face(dx, dz);
    else c.face(pl.position.x - c.position.x + Math.sin(t * 0.4) * 0.6, pl.position.z - c.position.z + 2);
    c.update(dt, t, Math.min(1, moving / 5));
    const now = performance.now();
    if (now - this.lastCompanionEmit > 90) {
      this.lastCompanionEmit = now;
      const head = c.position.clone();
      head.y += c.hover + c.height + 0.15;
      this.cb.onCompanion?.(this.engine.project(head));
    }
  }

  updateRemotes(dt, t) {
    for (const r of this.remotes.values()) {
      if (!r.char) continue;
      const p = r.char.position;
      const dx = r.tx - p.x;
      const dz = r.tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 12) {
        p.x = r.tx;
        p.z = r.tz;
      } else if (d > 0.01) {
        const step = Math.min(d, Math.max(6.5, d * 3) * dt);
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        r.char.face(dx, dz);
      }
      p.y = this.heightAt(p.x, p.z);
      r.speed += ((d > 0.08 ? 1 : 0) - r.speed) * Math.min(1, dt * 6);
      r.char.update(dt, t, r.speed);
    }
  }

  placeCamera(snap = false) {
    const pl = this.player.position;
    const cfg = this.world.camera || {};
    const dist = (cfg.distance ?? 15) * this.zoom * (1 + this.intro * 1.6);
    const height = (cfg.height ?? 12.5) * this.zoom * (1 + this.intro * 1.9);
    const desired = new THREE.Vector3(pl.x + this.intro * 6, pl.y + height, pl.z + dist);
    const look = new THREE.Vector3(pl.x + this.vel.x * 0.12, pl.y + 1, pl.z + this.vel.y * 0.12);
    if (snap) {
      this.engine.camera.position.copy(desired);
      this.camTarget.copy(look);
    }
    return { desired, look };
  }

  updateCamera(dt) {
    if (this.intro > 0) this.intro = Math.max(0, this.intro - dt * 0.55);
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 6);
    const { desired, look } = this.placeCamera();
    const k = Math.min(1, dt * (this.intro > 0 ? 2.2 : 5));
    this.engine.camera.position.lerp(desired, k);
    this.camTarget.lerp(look, Math.min(1, dt * 7));
    this.engine.camera.lookAt(this.camTarget);
  }

  updateNear() {
    const m = this.markers.nearest(this.player.position, 2.4);
    const id = m?.quest._id || null;
    if (id !== (this.near?.quest._id || null)) {
      this.near = m;
      this.cb.onNear?.(m ? m.quest : null);
    } else if (m) {
      this.near = m;
    }
  }

  emitPosition() {
    const now = performance.now();
    if (now - this.lastEmit < 100) return;
    this.lastEmit = now;
    const n = toNorm(this.player.position.x, this.player.position.z);
    const nx = Number(n.x.toFixed(4));
    const ny = Number(n.y.toFixed(4));
    if (nx === this.lastNorm.x && ny === this.lastNorm.y) return;
    this.lastNorm = { x: nx, y: ny };
    this.cb.onMove?.(nx, ny);
  }

  setQuests(quests) {
    this.pendingQuests = quests;
    this.markers?.sync(quests);
  }

  setGrowth(n) {
    this.pendingGrowth = n;
    this.world?.setGrowth?.(n);
  }

  setShowNames(v) {
    this.opts.showNames = v;
    this.markers?.setLabelsVisible(v);
    for (const r of this.remotes.values()) r.char?.setNameVisible(v);
  }

  setQuality(q) {
    this.engine.setQuality(q === "auto" ? "high" : q);
  }

  celebrate(questId) {
    const pos = this.markers?.positionOf(questId);
    this.markers?.markCompleting(questId);
    const origin = pos ? pos.clone() : this.player.position.clone();
    origin.y += 1.2;
    const accent = this.opts.theme.accent;
    this.burst?.spawn(origin, { count: 90, colors: ["#ffd166", "#fff3b0", accent, "#ffffff"], speed: 6, up: 8, life: 1.6, size: 0.7 });
    setTimeout(() => this.burst?.spawn(origin, { count: 40, colors: ["#ffd166", accent], speed: 3, up: 11, life: 1.8, size: 0.9 }), 180);
    this.player?.celebrate();
    this.companion?.celebrate();
    this.world?.onCelebrate?.(origin);
  }

  emote(kind = "wave") {
    if (kind === "jump") this.player?.jump();
    else this.player?.wave();
  }

  syncRemotes(players) {
    if (!this.world) {
      this.pendingRemotes = players;
      return;
    }
    for (const [id, r] of this.remotes) {
      if (!players.has(id)) {
        if (r.char) {
          this.burst.spawn(r.char.position.clone().setY(1), { count: 20, colors: ["#ffffff", "#e8e8ff"], speed: 2, up: 3, life: 0.8 });
          this.engine.scene.remove(r.char.root);
          r.char.dispose();
        }
        this.remotes.delete(id);
      }
    }
    for (const [id, info] of players) {
      let r = this.remotes.get(id);
      const w = toWorld(info.x, info.y);
      if (!r) {
        r = { tx: w.x, tz: w.z, speed: 0, char: null, avatarId: info.avatarId };
        this.remotes.set(id, r);
        const av = avatarFor(info.avatarId);
        loadGeometry(av.model).then((geo) => {
          if (this.disposed || !this.remotes.has(id)) return;
          const floaty = !!this.world.flags?.underwater;
          r.char = new Character({ geometry: geo, material: characterMaterial(), height: 1.7, name: info.username, nameDot: "#4fae6a", floaty, hover: floaty ? 0.25 : 0 });
          r.char.setNameVisible(this.opts.showNames !== false);
          r.char.position.set(r.tx, 0, r.tz);
          this.engine.scene.add(r.char.root);
          this.burst.spawn({ x: r.tx, y: 1, z: r.tz }, { count: 26, colors: ["#ffffff", "#fff3b0"], speed: 2.5, up: 4, life: 0.9 });
        });
      }
      r.tx = w.x;
      r.tz = w.z;
    }
  }

  alertFrom(userId) {
    this.remotes.get(userId)?.char?.showBubble("💌", 5);
  }

  minimap() {
    if (!this.player) return null;
    const pts = [];
    for (const m of this.markers.markers.values()) pts.push({ x: m.group.position.x, z: m.group.position.z, color: m.ring.material.uniforms.uColor.value.getStyle() });
    const others = [];
    for (const r of this.remotes.values()) if (r.char) others.push({ x: r.char.position.x, z: r.char.position.z });
    return { bounds: this.world.bounds, player: { x: this.player.position.x, z: this.player.position.z, h: this.player.heading }, quests: pts, others };
  }

  stats() {
    return this.engine.stats();
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    if (this.onPointerDown) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointerup", this.onPointerUp);
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("wheel", this.onWheel);
    }
    this.world?.dispose?.();
    this.markers?.dispose();
    this.burst?.dispose();
    this.player?.dispose();
    this.companion?.dispose();
    for (const r of this.remotes.values()) r.char?.dispose();
    this.engine.dispose();
  }
}
