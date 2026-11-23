import * as THREE from "three";
import { blobShadowTexture } from "./shaders.js";
import { makeLabel, makeBubble } from "./labels.js";

const TAU = Math.PI * 2;

function angleLerp(a, b, k) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * k;
}

export class Character {
  constructor({ geometry, material, height = 1.7, castShadow = true, name = null, nameDot = null, floaty = false, hover = 0 }) {
    this.root = new THREE.Group();
    this.hop = new THREE.Group();
    this.squash = new THREE.Group();
    this.tilt = new THREE.Group();
    this.root.add(this.hop);
    this.hop.add(this.tilt);
    this.tilt.add(this.squash);

    const bb = geometry.boundingBox;
    const s = height / (bb.max.y - bb.min.y);
    this.height = height;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.scale.setScalar(s);
    this.mesh.castShadow = castShadow;
    this.squash.add(this.mesh);

    const radius = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * s * 0.75;
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;
    this.shadow.scale.setScalar(radius * 2.2);
    this.shadow.renderOrder = 2;
    this.shadowBase = radius * 2.2;
    this.root.add(this.shadow);

    if (name) {
      this.label = makeLabel(name, { dot: nameDot, height: 0.42 });
      this.label.position.y = height + 0.35 + hover;
      this.root.add(this.label);
    }

    this.floaty = floaty;
    this.hover = hover;
    this.heading = 0;
    this.targetHeading = 0;
    this.phase = Math.random() * 10;
    this.speed = 0;
    this.jumpT = -1;
    this.celebrateT = -1;
    this.waveT = -1;
    this.landSquash = 0;
    this.seed = Math.random() * 100;
    this.bubbleUntil = 0;
  }

  get position() {
    return this.root.position;
  }

  face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) this.targetHeading = Math.atan2(dx, dz);
  }

  jump() {
    if (this.jumpT < 0 && this.celebrateT < 0) this.jumpT = 0;
  }

  celebrate() {
    this.celebrateT = 0;
    this.jumpT = -1;
  }

  wave() {
    if (this.waveT < 0) this.waveT = 0;
  }

  get airborne() {
    return this.jumpT >= 0 || this.celebrateT >= 0;
  }

  showBubble(emoji = "💬", seconds = 4) {
    if (!this.bubble) {
      this.bubble = makeBubble(emoji);
      this.bubble.position.y = this.height + 0.95 + this.hover;
      this.root.add(this.bubble);
    }
    this.bubble.visible = true;
    this.bubbleUntil = performance.now() + seconds * 1000;
  }

  setNameVisible(v) {
    if (this.label) this.label.visible = v;
  }

  update(dt, t, speed01 = 0) {
    this.speed += (speed01 - this.speed) * Math.min(1, dt * 10);
    const sp = this.speed;
    this.heading = angleLerp(this.heading, this.targetHeading, Math.min(1, dt * 12));
    this.root.rotation.y = this.heading;

    let y = this.hover;
    let sy = 1;
    let rx = 0;
    let rz = 0;
    let extraYaw = 0;

    if (this.floaty) {
      y += Math.sin(t * 1.7 + this.seed) * 0.14 + 0.1;
      rz = Math.sin(t * 1.1 + this.seed) * 0.05;
      rx = sp * 0.22;
      sy = 1 + Math.sin(t * 3.4 + this.seed) * 0.03;
    } else {
      this.phase += dt * (7.5 + sp * 5) * Math.max(sp, 0.0001);
      const hopK = Math.abs(Math.sin(this.phase));
      y += hopK * 0.2 * sp;
      const contact = 1 - hopK;
      sy = 1 - contact * 0.1 * sp + hopK * 0.05 * sp;
      rx = 0.13 * sp;
      rz = Math.sin(this.phase) * 0.09 * sp;
      const idle = 1 - sp;
      sy += Math.sin(t * 2.4 + this.seed) * 0.025 * idle;
      rz += Math.sin(t * 1.2 + this.seed) * 0.02 * idle;
    }

    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const D = 0.6;
      const k = this.jumpT / D;
      if (k >= 1) {
        this.jumpT = -1;
        this.landSquash = 1;
      } else {
        y += 4 * 1.15 * k * (1 - k);
        sy *= k < 0.15 ? 1 + k * 1.2 : 1 + (1 - k) * 0.08;
      }
    }

    if (this.celebrateT >= 0) {
      this.celebrateT += dt;
      const D = 1.25;
      const k = this.celebrateT / D;
      if (k >= 1) {
        this.celebrateT = -1;
        this.landSquash = 1.2;
      } else {
        const jk = Math.min(1, k / 0.85);
        y += 4 * 1.5 * jk * (1 - jk);
        extraYaw = TAU * (1 - Math.pow(1 - Math.min(1, k / 0.8), 3));
        sy *= 1 + Math.sin(k * Math.PI) * 0.12;
      }
    }

    if (this.waveT >= 0) {
      this.waveT += dt;
      const k = this.waveT / 1.2;
      if (k >= 1) this.waveT = -1;
      else rz += Math.sin(k * Math.PI * 6) * 0.2 * Math.sin(k * Math.PI);
    }

    if (this.landSquash > 0) {
      sy *= 1 - this.landSquash * 0.18;
      this.landSquash = Math.max(0, this.landSquash - dt * 5);
    }

    this.hop.position.y = y;
    this.hop.rotation.y = extraYaw;
    this.tilt.rotation.x = rx;
    this.tilt.rotation.z = rz;
    const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
    this.squash.scale.set(sxz, sy, sxz);

    const lift = Math.max(0, y - this.hover);
    const sh = this.shadowBase * (1 - Math.min(0.5, lift * 0.3));
    this.shadow.scale.set(sh, sh, sh);
    this.shadow.material.opacity = 1 - Math.min(0.6, lift * 0.35);

    if (this.bubble?.visible) {
      this.bubble.position.y = this.height + 0.95 + this.hover + Math.sin(t * 3) * 0.06;
      if (performance.now() > this.bubbleUntil) this.bubble.visible = false;
    }
  }

  dispose() {
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    if (this.label) {
      this.label.material.map.dispose();
      this.label.material.dispose();
    }
    if (this.bubble) {
      this.bubble.material.map.dispose();
      this.bubble.material.dispose();
    }
  }
}
