import * as THREE from "three";

export function addSway(material, uniforms, { strength = 0.06, speed = 1.4, height = 1 } = {}) {
  const key = `sway-${strength}-${speed}-${height}`;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.(shader, r);
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 swayP = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 swayP = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
        #endif
        float swayH = max(transformed.y, 0.0) * ${height.toFixed(3)};
        float swayW = sin(uTime * ${speed.toFixed(3)} + swayP.x * 0.31 + swayP.z * 0.23) + 0.35 * sin(uTime * ${(speed * 2.3).toFixed(3)} + swayP.x * 0.9);
        transformed.x += swayW * swayH * swayH * ${strength.toFixed(4)};
        transformed.z += cos(uTime * ${(speed * 0.8).toFixed(3)} + swayP.z * 0.29) * swayH * swayH * ${(strength * 0.6).toFixed(4)};`,
      );
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ""}${key}`;
  return material;
}

export function addCaustics(material, uniforms, { scale = 0.22, strength = 0.35, color = "#bff6ff" } = {}) {
  const c = new THREE.Color(color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uCausticColor = { value: c };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldP;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWorldP;
        uniform float uTime;
        uniform vec3 uCausticColor;
        float cell(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); float d = 1.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y));
            vec2 o = 0.5 + 0.5 * sin(uTime * 0.9 + 6.2831 * fract(sin(dot(i + g, vec2(127.1, 311.7))) * 43758.5453) + vec2(0.0, 1.7));
            d = min(d, length(g + o - f));
          }
          return d;
        }`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        vec2 cp = vWorldP.xz * ${scale.toFixed(3)};
        float ca = pow(1.0 - cell(cp), 6.0) + pow(1.0 - cell(cp * 1.7 + 3.1), 6.0) * 0.6;
        gl_FragColor.rgb += uCausticColor * ca * ${strength.toFixed(3)};`,
      );
  };
  material.customProgramCacheKey = () => `caustics-${scale}-${strength}`;
  return material;
}

export function skyMaterial({ top, mid, bottom, sun = null, sunColor = "#fff4d6", stars = 0, sunSize = 0.02 }) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uMid: { value: new THREE.Color(mid) },
      uBottom: { value: new THREE.Color(bottom) },
      uSunDir: { value: sun ? new THREE.Vector3(...sun).normalize() : new THREE.Vector3(0, -1, 0) },
      uSunColor: { value: new THREE.Color(sunColor) },
      uSun: { value: sun ? 1 : 0 },
      uSunSize: { value: sunSize },
      uStars: { value: stars },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uBottom, uSunDir, uSunColor;
      uniform float uSun, uSunSize, uStars, uTime;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){
        float h = vDir.y;
        vec3 col = h > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.55, h)) : mix(uMid, uBottom, smoothstep(0.0, -0.25, h));
        if (uSun > 0.5) {
          float d = dot(normalize(vDir), uSunDir);
          col += uSunColor * smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.6, d);
          col += uSunColor * pow(max(d, 0.0), 12.0) * 0.35;
        }
        if (uStars > 0.0 && h > 0.05) {
          vec3 p = floor(vDir * 260.0);
          float s = step(0.9965, hash(p));
          float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(p + 1.0) * 40.0);
          col += vec3(s * tw * uStars * smoothstep(0.05, 0.35, h));
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function makeWater(uniforms, geometry, { deep = "#2f6d74", shallow = "#7fc4bb", foam = "#eafff7", radius = 10, opacity = 0.88, sky = "#cfe6f0", cx = 0, cz = 0 } = {}) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: uniforms.uTime,
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uFoam: { value: new THREE.Color(foam) },
      uSky: { value: new THREE.Color(sky) },
      uRadius: { value: radius },
      uOpacity: { value: opacity },
      uCenter: { value: new THREE.Vector2(cx, cz) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.y += sin(w.x * 0.6 + uTime * 1.3) * 0.03 + cos(w.z * 0.5 + uTime) * 0.03;
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uDeep, uShallow, uFoam, uSky;
      uniform float uRadius, uOpacity, uTime;
      uniform vec2 uCenter;
      varying vec3 vW;
      #include <fog_pars_fragment>
      float n(vec2 p){ return sin(p.x) * cos(p.y); }
      void main(){
        float r = length(vW.xz - uCenter) / uRadius;
        vec3 col = mix(uDeep, uShallow, smoothstep(0.35, 1.0, r));
        float rip = n(vW.xz * 1.7 + uTime * 0.8) * n(vW.xz * 1.3 - uTime * 0.6);
        col = mix(col, uSky, 0.18 + rip * 0.12);
        float spark = smoothstep(0.82, 0.98, n(vW.xz * 4.0 + uTime * 1.6) * n(vW.xz * 3.1 - uTime));
        col += spark * 0.45;
        col = mix(col, uFoam, smoothstep(0.9, 1.0, r) * 0.55);
        gl_FragColor = vec4(col, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  return mesh;
}

export function ringMaterial(uniforms, color = "#ffffff") {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: uniforms.uTime, uColor: { value: new THREE.Color(color) }, uBoost: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime, uBoost; uniform vec3 uColor;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float pulse = fract(uTime * 0.6);
        float ring = smoothstep(0.08, 0.0, abs(r - pulse)) * (1.0 - pulse);
        float base = smoothstep(1.0, 0.55, r) * smoothstep(0.35, 0.6, r) * 0.35;
        float a = (ring * 0.9 + base) * (1.0 + uBoost);
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.userData.shared = true;
  return glowTex;
}

let shadowTex = null;
export function blobShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(0.6, "rgba(0,0,0,0.25)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

export function glowSprite(color, size = 1, opacity = 0.8) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  s.scale.setScalar(size);
  return s;
}
