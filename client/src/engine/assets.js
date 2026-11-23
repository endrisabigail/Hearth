import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const cache = new Map();

function bakeGeometry(gltf) {
  gltf.scene.updateMatrixWorld(true);
  const parts = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.geometry;
    const g = new THREE.BufferGeometry();
    const pos = src.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      arr[i * 3] = pos.getX(i);
      arr[i * 3 + 1] = pos.getY(i);
      arr[i * 3 + 2] = pos.getZ(i);
    }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const col = src.attributes.color;
    if (col) {
      const c = new Float32Array(col.count * 3);
      for (let i = 0; i < col.count; i++) {
        c[i * 3] = col.getX(i);
        c[i * 3 + 1] = col.getY(i);
        c[i * 3 + 2] = col.getZ(i);
      }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    }
    if (src.index) g.setIndex(Array.from(src.index.array));
    g.applyMatrix4(o.matrixWorld);
    parts.push(g);
  });
  const geometry = parts[0];
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  geometry.translate(-cx, -bb.min.y, -cz);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function loadGeometry(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      loader.loadAsync(url).then(bakeGeometry).catch((err) => {
        cache.delete(url);
        throw err;
      }),
    );
  }
  return cache.get(url);
}

export function geometryHeight(geometry) {
  const bb = geometry.boundingBox;
  return bb.max.y - bb.min.y;
}

export function characterMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
}

export function sceneryMaterial(opts = {}) {
  return new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
}

export function preload(urls) {
  return Promise.all(urls.map((u) => loadGeometry(u).catch(() => null)));
}
