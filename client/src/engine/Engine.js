import * as THREE from "three";

export class Engine {
  constructor(canvas, { quality = "high", alpha = false } = {}) {
    this.canvas = canvas;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== "low",
      powerPreference: "high-performance",
      alpha,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.applyPixelRatio();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
    this.uniforms = { uTime: { value: 0 } };
    this.updaters = new Set();
    this.last = performance.now();
    this.running = false;
    this.paused = false;
    this.fpsSamples = [];
    this.onSlow = null;

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.onVisibility = () => {
      this.paused = document.hidden;
      this.last = performance.now();
    };
    document.addEventListener("visibilitychange", this.onVisibility);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(canvas.parentElement || canvas);
    this.resize();
  }

  applyPixelRatio() {
    const cap = this.quality === "low" ? 1 : this.quality === "medium" ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.applyPixelRatio();
    this.renderer.shadowMap.enabled = q !== "low";
    this.scene.traverse((o) => {
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => (m.needsUpdate = true));
      }
    });
    this.resize();
  }

  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.width = w;
    this.height = h;
  }

  add(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.renderer.setAnimationLoop(this.frame);
  }

  frame() {
    if (this.paused) return;
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    const t = (this.uniforms.uTime.value += dt);
    for (const fn of this.updaters) fn(dt, t);
    this.renderer.render(this.scene, this.camera);
    this.trackFps(dt);
  }

  trackFps(dt) {
    if (!this.onSlow) return;
    this.fpsSamples.push(dt);
    if (this.fpsSamples.length >= 150) {
      const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
      this.fpsSamples.length = 0;
      if (1 / avg < 42) this.onSlow(1 / avg);
    }
  }

  stats() {
    const r = this.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles, geometries: this.renderer.info.memory.geometries };
  }

  project(vec3) {
    const v = vec3.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-v.y * 0.5 + 0.5) * this.height,
      visible: v.z < 1 && v.x > -1.15 && v.x < 1.15 && v.y > -1.15 && v.y < 1.15,
    };
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.running = false;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.ro.disconnect();
    const seen = new Set();
    this.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData?.shared && !seen.has(o.geometry)) {
        seen.add(o.geometry);
        o.geometry.dispose();
      }
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => {
        if (seen.has(m)) return;
        seen.add(m);
        Object.values(m).forEach((v) => v?.isTexture && v.dispose());
        m.dispose();
      });
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.updaters.clear();
  }
}
