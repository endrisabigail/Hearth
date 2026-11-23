import * as THREE from "three";
import { loadGeometry, characterMaterial } from "../engine/assets.js";

const cache = new Map();
const listeners = new Map();
let renderer = null;
let queue = Promise.resolve();

function getRenderer() {
  if (!renderer) {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(192, 192, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  return renderer;
}

async function render(url, { yaw = -0.35, framing = "head" } = {}) {
  const geo = await loadGeometry(url);
  const r = getRenderer();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#8a7a6a", 2));
  const d = new THREE.DirectionalLight("#ffffff", 2.2);
  d.position.set(2, 3, 4);
  scene.add(d);
  const mesh = new THREE.Mesh(geo, characterMaterial());
  mesh.rotation.y = yaw;
  scene.add(mesh);
  const bb = geo.boundingBox;
  const h = bb.max.y - bb.min.y;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const focusY = framing === "head" ? bb.min.y + h * 0.66 : bb.min.y + h * 0.5;
  const dist = framing === "head" ? h * 2.1 : h * 3.1;
  cam.position.set(0, focusY + h * 0.08, dist);
  cam.lookAt(0, focusY, 0);
  r.render(scene, cam);
  const url2 = r.domElement.toDataURL("image/png");
  mesh.material.dispose();
  return url2;
}

export function getThumb(url, opts) {
  const key = `${url}|${opts?.framing || "head"}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const stored = sessionStorage.getItem(`thumb:${key}`);
    if (stored) {
      cache.set(key, stored);
      return stored;
    }
  } catch {}
  return null;
}

export function requestThumb(url, opts, cb) {
  const key = `${url}|${opts?.framing || "head"}`;
  const hit = getThumb(url, opts);
  if (hit) {
    cb(hit);
    return () => {};
  }
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
    queue = queue.then(async () => {
      try {
        const data = await render(url, opts);
        cache.set(key, data);
        try {
          sessionStorage.setItem(`thumb:${key}`, data);
        } catch {}
        listeners.get(key)?.forEach((fn) => fn(data));
      } catch (err) {
        console.warn("thumbnail failed", url, err);
      }
      listeners.delete(key);
    });
  }
  listeners.get(key).add(cb);
  return () => listeners.get(key)?.delete(cb);
}
