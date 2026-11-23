import * as THREE from "three";

const MODES = { drift: 0, fall: 1, rise: 2 };
const SHAPES = { dot: 0, streak: 1, bubble: 2, petal: 3, star: 4 };

const SHAPE_GLSL = `
  float shapeAlpha(vec2 uv, int shape) {
    vec2 c = uv - 0.5;
    if (shape == 1) return smoothstep(0.08, 0.0, abs(c.x)) * smoothstep(0.5, 0.2, abs(c.y));
    if (shape == 2) { float r = length(c); return smoothstep(0.5, 0.42, r) * (0.35 + smoothstep(0.3, 0.45, r) * 0.65); }
    if (shape == 3) { vec2 q = vec2(c.x * 1.8, c.y); return smoothstep(0.5, 0.35, length(q)); }
    if (shape == 4) { float a = atan(c.y, c.x); float r = length(c); float k = 0.22 + 0.2 * pow(abs(cos(a * 2.5)), 3.0); return smoothstep(k + 0.05, k - 0.03, r); }
    return smoothstep(0.5, 0.0, length(c));
  }`;

export class ParticleField {
  constructor(engine, {
    count = 200,
    radius = 20,
    center = [0, 0, 0],
    yMin = 0.3,
    yMax = 6,
    mode = "drift",
    shape = "dot",
    color = "#fff3b0",
    color2 = null,
    size = 0.25,
    speed = 1,
    swirl = 0.4,
    blink = 0,
    opacity = 1,
    additive = true,
  } = {}) {
    this.engine = engine;
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(...center), radius + yMax + 4);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: engine.uniforms.uTime,
        uScale: { value: 1 },
        uSize: { value: size },
        uSpeed: { value: speed },
        uSwirl: { value: swirl },
        uRadius: { value: radius },
        uCenter: { value: new THREE.Vector3(...center) },
        uYMin: { value: yMin },
        uYMax: { value: yMax },
        uBlink: { value: blink },
        uOpacity: { value: opacity },
        uColor: { value: new THREE.Color(color) },
        uColor2: { value: new THREE.Color(color2 || color) },
      },
      defines: { MODE: MODES[mode] ?? 0, SHAPE: SHAPES[shape] ?? 0 },
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime, uScale, uSize, uSpeed, uSwirl, uRadius, uYMin, uYMax, uBlink;
        uniform vec3 uCenter;
        varying float vAlpha;
        varying float vMix;
        void main() {
          float ang = aSeed.x * 6.28318;
          float rr = sqrt(aSeed.y) * uRadius;
          vec3 p = uCenter + vec3(cos(ang) * rr, 0.0, sin(ang) * rr);
          float H = uYMax - uYMin;
          vAlpha = 1.0;
          #if MODE == 0
            p.y = uYMin + aSeed.z * H + sin(uTime * 0.7 * uSpeed + aSeed.w * 20.0) * 0.45;
            p.x += sin(uTime * 0.31 * uSpeed + aSeed.w * 12.0) * uSwirl * 3.0;
            p.z += cos(uTime * 0.27 * uSpeed + aSeed.z * 9.0) * uSwirl * 3.0;
            vAlpha = mix(1.0, 0.5 + 0.5 * sin(uTime * (1.5 + aSeed.z * 2.0) + aSeed.w * 30.0), uBlink);
          #elif MODE == 1
            float f = mod(aSeed.z * H + uTime * uSpeed * (0.7 + aSeed.w * 0.6), H);
            p.y = uYMax - f;
            p.x += sin(uTime * 1.3 + aSeed.w * 10.0 + f) * uSwirl;
            p.z += cos(uTime * 1.1 + aSeed.z * 10.0 + f) * uSwirl;
            vAlpha = smoothstep(0.0, 0.08, f / H) * smoothstep(1.0, 0.9, f / H);
          #else
            float f = mod(aSeed.z * H + uTime * uSpeed * (0.6 + aSeed.w * 0.8), H);
            p.y = uYMin + f;
            p.x += sin(uTime * 2.0 + aSeed.w * 10.0) * uSwirl * 0.4;
            p.z += cos(uTime * 1.7 + aSeed.x * 10.0) * uSwirl * 0.4;
            vAlpha = smoothstep(0.0, 0.1, f / H) * (1.0 - smoothstep(0.82, 1.0, f / H));
          #endif
          vMix = aSeed.w;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * uScale * (0.6 + aSeed.w * 0.8) * (300.0 / max(-mv.z, 0.1));
        }`,
      fragmentShader: `
        uniform vec3 uColor, uColor2;
        uniform float uOpacity;
        varying float vAlpha;
        varying float vMix;
        ${SHAPE_GLSL}
        void main() {
          float a = shapeAlpha(gl_PointCoord, SHAPE) * vAlpha * uOpacity;
          if (a < 0.01) discard;
          gl_FragColor = vec4(mix(uColor, uColor2, vMix), a);
        }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.off = engine.add(() => {
      this.material.uniforms.uScale.value = (engine.height * engine.renderer.getPixelRatio()) / 900;
    });
  }

  set opacity(v) {
    this.material.uniforms.uOpacity.value = v;
  }

  dispose() {
    this.off();
  }
}

export class Burst {
  constructor(engine, max = 260, { shape = "star", additive = true } = {}) {
    this.engine = engine;
    this.max = max;
    this.items = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 1 } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 color;
        uniform float uScale; varying float vA; varying vec3 vC;
        void main(){ vA = aAlpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale * (300.0 / max(-mv.z, 0.1)); }`,
      fragmentShader: `
        varying float vA; varying vec3 vC;
        ${SHAPE_GLSL}
        void main(){ float a = shapeAlpha(gl_PointCoord, ${SHAPES[shape] ?? 4}) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.off = engine.add((dt) => this.update(dt));
  }

  spawn(origin, { count = 60, colors = ["#ffd166", "#fff3b0", "#ff9ecb"], speed = 5, up = 6, spread = 1, gravity = 9, life = 1.4, size = 0.6 } = {}) {
    const palette = colors.map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) this.items.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.items.push({
        x: origin.x + (Math.random() - 0.5) * spread,
        y: origin.y + Math.random() * 0.4,
        z: origin.z + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * s,
        vy: up * (0.5 + Math.random() * 0.8),
        vz: Math.sin(a) * s,
        g: gravity,
        life,
        age: 0,
        size: size * (0.5 + Math.random()),
        c: palette[i % palette.length],
      });
    }
  }

  update(dt) {
    this.material.uniforms.uScale.value = (this.engine.height * this.engine.renderer.getPixelRatio()) / 900;
    const items = this.items;
    let w = 0;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy -= p.g * dt;
      p.vx *= 0.985;
      p.vz *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      items[w++] = p;
    }
    items.length = w;
    for (let i = 0; i < this.max; i++) {
      const p = items[i];
      if (p) {
        this.pos[i * 3] = p.x;
        this.pos[i * 3 + 1] = p.y;
        this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = p.c.r;
        this.col[i * 3 + 1] = p.c.g;
        this.col[i * 3 + 2] = p.c.b;
        const k = p.age / p.life;
        this.size[i] = p.size * (1 - k * 0.5);
        this.alpha[i] = k < 0.1 ? k * 10 : 1 - (k - 0.1) / 0.9;
      } else {
        this.alpha[i] = 0;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.setDrawRange(0, Math.max(1, items.length));
  }

  dispose() {
    this.off();
  }
}
