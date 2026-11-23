import * as THREE from "three";
import { ringMaterial, glowSprite } from "./shaders.js";
import { makeLabel } from "./labels.js";
import { PRIORITY } from "../lib/avatars.js";

const RING_GEO = new THREE.PlaneGeometry(3.2, 3.2);
RING_GEO.rotateX(-Math.PI / 2);
RING_GEO.userData.shared = true;
const HIT_GEO = new THREE.CylinderGeometry(1.2, 1.2, 3, 8);
HIT_GEO.translate(0, 1.5, 0);
HIT_GEO.userData.shared = true;
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });

export class QuestMarkers {
  constructor(engine, world, { heightAt = () => 0, showLabels = true } = {}) {
    this.engine = engine;
    this.world = world;
    this.heightAt = heightAt;
    this.showLabels = showLabels;
    this.group = new THREE.Group();
    engine.scene.add(this.group);
    this.markers = new Map();
    this.slotOf = new Map();
    this.leaving = [];
    this.hovered = null;
    this.off = engine.add((dt, t) => this.update(dt, t));
  }

  hitTargets() {
    return [...this.markers.values()].map((m) => m.hit);
  }

  sync(quests) {
    const anchors = this.world.anchors;
    const active = quests.filter((q) => q.status !== "Completed");
    const ids = new Set(active.map((q) => q._id));
    for (const [id, m] of this.markers) {
      if (!ids.has(id)) this.remove(id, m.completing);
    }
    const used = new Set([...this.markers.keys()].map((id) => this.slotOf.get(id)));
    for (const q of active) {
      const existing = this.markers.get(q._id);
      if (existing) {
        this.refresh(existing, q);
        continue;
      }
      let slot = this.slotOf.get(q._id);
      if (slot === undefined || used.has(slot)) {
        slot = anchors.findIndex((_, i) => !used.has(i));
        if (slot === -1) continue;
      }
      used.add(slot);
      this.slotOf.set(q._id, slot);
      this.add(q, anchors[slot]);
    }
  }

  add(quest, anchor) {
    const g = new THREE.Group();
    g.position.set(anchor.x, this.heightAt(anchor.x, anchor.z), anchor.z);
    const body = this.world.makeMarker();
    const bob = new THREE.Group();
    bob.add(body);
    g.add(bob);
    const color = PRIORITY[quest.priority]?.color || "#ffd166";
    const ring = new THREE.Mesh(RING_GEO, ringMaterial(this.engine.uniforms, color));
    ring.position.y = 0.04;
    ring.renderOrder = 3;
    g.add(ring);
    const beacon = glowSprite(this.world.palette?.glow || color, 1.6, 0.55);
    beacon.position.y = 1.4;
    g.add(beacon);
    const hit = new THREE.Mesh(HIT_GEO, HIT_MAT);
    hit.userData.questId = quest._id;
    g.add(hit);
    g.scale.setScalar(0.001);
    this.group.add(g);
    const m = { quest, group: g, bob, body, ring, beacon, hit, label: null, flag: null, appear: 0, seed: Math.random() * 10, hover: 0 };
    this.markers.set(quest._id, m);
    this.refresh(m, quest, true);
  }

  refresh(m, quest, force = false) {
    const sig = `${quest.title}|${quest.priority}|${quest.status}|${quest.dueDate}`;
    if (!force && m.sig === sig) {
      m.quest = quest;
      return;
    }
    m.sig = sig;
    m.quest = quest;
    const color = PRIORITY[quest.priority]?.color || "#ffd166";
    m.ring.material.uniforms.uColor.value.set(color);
    m.ring.material.uniforms.uBoost.value = quest.status === "In Progress" ? 0.8 : 0;
    if (m.label) {
      m.group.remove(m.label);
      m.label.material.map.dispose();
      m.label.material.dispose();
    }
    m.label = makeLabel(quest.title || "Quest", { dot: color, height: 0.5 });
    m.label.position.y = 2.6;
    m.label.visible = this.showLabels;
    m.group.add(m.label);
    const due = quest.dueDate ? new Date(quest.dueDate).getTime() - Date.now() : Infinity;
    const urgent = due < 86400000;
    if (urgent && !m.flag) {
      m.flag = makeLabel("!", { bg: "#e2574c", fg: "#fff", height: 0.55 });
      m.flag.position.y = 3.25;
      m.group.add(m.flag);
    } else if (!urgent && m.flag) {
      m.group.remove(m.flag);
      m.flag.material.map.dispose();
      m.flag.material.dispose();
      m.flag = null;
    }
  }

  setLabelsVisible(v) {
    this.showLabels = v;
    for (const m of this.markers.values()) if (m.label) m.label.visible = v;
  }

  markCompleting(id) {
    const m = this.markers.get(id);
    if (m) m.completing = true;
  }

  remove(id, celebrate = false) {
    const m = this.markers.get(id);
    if (!m) return;
    this.markers.delete(id);
    this.slotOf.delete(id);
    m.leaveT = 0;
    m.celebrate = celebrate;
    this.leaving.push(m);
  }

  positionOf(id) {
    const m = this.markers.get(id);
    return m ? m.group.position : null;
  }

  nearest(pos, maxDist) {
    let best = null;
    let bd = maxDist * maxDist;
    for (const m of this.markers.values()) {
      const d = (m.group.position.x - pos.x) ** 2 + (m.group.position.z - pos.z) ** 2;
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  setHovered(id) {
    this.hovered = id;
  }

  update(dt, t) {
    for (const m of this.markers.values()) {
      m.appear = Math.min(1, m.appear + dt * 2.2);
      const e = m.appear;
      const pop = e < 1 ? e * (1 + Math.sin(e * Math.PI) * 0.35) : 1;
      m.hover += ((this.hovered === m.quest._id ? 1 : 0) - m.hover) * Math.min(1, dt * 10);
      m.group.scale.setScalar(Math.max(0.001, pop * (1 + m.hover * 0.1)));
      m.bob.position.y = Math.sin(t * 2 + m.seed) * 0.08;
      m.bob.rotation.y = Math.sin(t * 0.6 + m.seed) * 0.25;
      m.beacon.position.y = 1.5 + Math.sin(t * 2.4 + m.seed) * 0.12;
      m.beacon.material.opacity = 0.4 + Math.sin(t * 3 + m.seed) * 0.12 + m.hover * 0.3;
      if (m.label) m.label.position.y = 2.6 + m.hover * 0.2;
      if (m.flag) m.flag.position.y = 3.25 + Math.abs(Math.sin(t * 4 + m.seed)) * 0.18;
    }
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const m = this.leaving[i];
      m.leaveT += dt;
      const k = Math.min(1, m.leaveT / (m.celebrate ? 0.9 : 0.4));
      if (m.celebrate) {
        m.group.position.y += dt * 3 * (1 - k);
        m.group.rotation.y += dt * 12 * (1 - k * 0.5);
        m.group.scale.setScalar(Math.max(0.001, (1 + k * 0.3) * (1 - k)));
      } else {
        m.group.scale.setScalar(Math.max(0.001, 1 - k));
      }
      if (k >= 1) {
        this.group.remove(m.group);
        m.ring.material.dispose();
        m.beacon.material.dispose();
        if (m.label) {
          m.label.material.map.dispose();
          m.label.material.dispose();
        }
        if (m.flag) {
          m.flag.material.map.dispose();
          m.flag.material.dispose();
        }
        this.leaving.splice(i, 1);
      }
    }
  }

  dispose() {
    this.off();
  }
}
