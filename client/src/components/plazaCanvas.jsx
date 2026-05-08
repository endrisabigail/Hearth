import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const AVATAR_CONFIG = {
  tomato: { scale: 1.2, offsetX: 0 },
  frog: { scale: 1.2, offsetX: 0 },
  fish: { scale: 1.2, offsetX: 0.05 },
  mushroom: { scale: 1.2, offsetX: 0 },
  apple: { scale: 1.2, offsetX: 0 },
  snail: { scale: 1.2, offsetX: 0 },
};

const COLLISION_PADDING = 0.3;
const TRAVEL_SPEED = 0.006;
const ARRIVAL_THRESHOLD = 0.018;

// Tilemap config
// World size: X ∈ [-4, 4], Z ∈ [-3, 3]
const WORLD_W = 8; // world units wide  (X axis)
const WORLD_H = 6; // world units tall  (Z axis)
const TILE_SIZE = 1; // one tile = 1 world unit

// Tile type IDs
const T = {
  GRASS: 0,
  STONE: 1,
  DIRT: 2,
  WATER: 3,
  FLOWER: 4,
  DARK_GRASS: 5,
};

const TILE_MAP = [
  [
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
  ],
  [
    T.DARK_GRASS,
    T.FLOWER,
    T.GRASS,
    T.STONE,
    T.STONE,
    T.GRASS,
    T.FLOWER,
    T.DARK_GRASS,
  ],
  [
    T.DARK_GRASS,
    T.GRASS,
    T.DIRT,
    T.DIRT,
    T.DIRT,
    T.DIRT,
    T.GRASS,
    T.DARK_GRASS,
  ],
  [
    T.DARK_GRASS,
    T.GRASS,
    T.DIRT,
    T.WATER,
    T.WATER,
    T.DIRT,
    T.GRASS,
    T.DARK_GRASS,
  ],
  [
    T.DARK_GRASS,
    T.FLOWER,
    T.GRASS,
    T.STONE,
    T.STONE,
    T.GRASS,
    T.FLOWER,
    T.DARK_GRASS,
  ],
  [
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
    T.DARK_GRASS,
  ],
];

// Tile visual definitions (drawn procedurally onto a canvas texture)
const TILE_DEFS = {
  [T.GRASS]: { base: "#6abf5e", detail: "#7dd96e", pattern: "dots" },
  [T.STONE]: { base: "#9e9e9e", detail: "#bdbdbd", pattern: "cracks" },
  [T.DIRT]: { base: "#a0724a", detail: "#b8885e", pattern: "dots" },
  [T.WATER]: { base: "#4fc3f7", detail: "#81d4fa", pattern: "waves" },
  [T.FLOWER]: { base: "#6abf5e", detail: "#f48fb1", pattern: "flower" },
  [T.DARK_GRASS]: { base: "#4a9e40", detail: "#5ab34e", pattern: "none" },
};

const PX = 64; // pixels per tile on the texture canvas

/** Draw a single tile onto a canvas 2D context at (tx, ty) in tile coords */
function drawTile(ctx, col, row, type) {
  const def = TILE_DEFS[type];
  const x = col * PX;
  const y = row * PX;

  // base fill
  ctx.fillStyle = def.base;
  ctx.fillRect(x, y, PX, PX);

  // inner border for grid feel
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, PX - 1, PX - 1);

  ctx.fillStyle = def.detail;

  switch (def.pattern) {
    case "dots":
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          ctx.beginPath();
          ctx.arc(x + 12 + c * 20, y + 12 + r * 20, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      break;

    case "cracks":
      ctx.strokeStyle = def.detail;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 10);
      ctx.lineTo(x + 28, y + 30);
      ctx.moveTo(x + 38, y + 15);
      ctx.lineTo(x + 55, y + 40);
      ctx.moveTo(x + 20, y + 42);
      ctx.lineTo(x + 40, y + 58);
      ctx.stroke();
      break;

    case "waves":
      ctx.strokeStyle = def.detail;
      ctx.lineWidth = 2;
      for (let wy = 0; wy < 4; wy++) {
        ctx.beginPath();
        for (let wx = 0; wx <= PX; wx += 8) {
          const waveY = y + 14 + wy * 14 + Math.sin(wx / 8) * 4;
          wx === 0 ? ctx.moveTo(x + wx, waveY) : ctx.lineTo(x + wx, waveY);
        }
        ctx.stroke();
      }
      break;

    case "flower": {
      // base grass dots
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          ctx.fillStyle = def.detail;
          ctx.beginPath();
          ctx.arc(x + 12 + c * 20, y + 12 + r * 20, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      // small flowers
      const centers = [
        [x + 16, y + 16],
        [x + 48, y + 48],
        [x + 48, y + 16],
      ];
      centers.forEach(([fx, fy]) => {
        const petals = [
          [0, -5],
          [5, 0],
          [0, 5],
          [-5, 0],
          [4, -4],
          [4, 4],
          [-4, 4],
          [-4, -4],
        ];
        ctx.fillStyle = "#f48fb1";
        petals.forEach(([px2, py2]) => {
          ctx.beginPath();
          ctx.arc(fx + px2, fy + py2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "#fff176";
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }

    default:
      break;
  }
}

/** Build a THREE.Texture from the procedural tile map */
function buildTilemapTexture(cols, rows) {
  const canvas = document.createElement("canvas");
  canvas.width = cols * PX;
  canvas.height = rows * PX;
  const ctx = canvas.getContext("2d");

  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      drawTile(ctx, col, row, TILE_MAP[row][col]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; // crisp pixel look
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// Tree / grass placements  
const TREE_PLACEMENTS = [
  { x: -3.2, z: -2.5, ry: 0.0 },
  { x: -2.5, z: -2.7, ry: 1.1 },
  { x: -1.6, z: -2.6, ry: 2.3 },
  { x: -0.8, z: -2.7, ry: 0.7 },
  { x: 0.0, z: -2.5, ry: 1.9 },
  { x: 0.8, z: -2.6, ry: 3.1 },
  { x: 1.6, z: -2.7, ry: 0.4 },
  { x: 2.5, z: -2.6, ry: 2.8 },
  { x: 3.2, z: -2.5, ry: 1.5 },
  { x: -3.2, z: 2.5, ry: 3.2 },
  { x: -2.5, z: 2.7, ry: 0.9 },
  { x: -1.6, z: 2.6, ry: 4.1 },
  { x: -0.8, z: 2.7, ry: 2.5 },
  { x: 0.0, z: 2.5, ry: 5.0 },
  { x: 0.8, z: 2.6, ry: 1.3 },
  { x: 1.6, z: 2.7, ry: 3.7 },
  { x: 2.5, z: 2.6, ry: 0.6 },
  { x: 3.2, z: 2.5, ry: 2.2 },
  { x: -3.3, z: -1.8, ry: 1.0 },
  { x: -3.2, z: -0.8, ry: 2.4 },
  { x: -3.3, z: 0.2, ry: 0.3 },
  { x: -3.2, z: 1.2, ry: 3.5 },
  { x: 3.3, z: -1.8, ry: 4.2 },
  { x: 3.2, z: -0.8, ry: 0.8 },
  { x: 3.3, z: 0.2, ry: 2.9 },
  { x: 3.2, z: 1.2, ry: 1.6 },
];

const GRASS_PLACEMENTS = [
  { x: -0.6, z: -1.0, sc: 1.1 },
  { x: 0.8, z: 1.2, sc: 0.85 },
  { x: 1.2, z: -1.5, sc: 1.0 },
  { x: -1.5, z: 0.8, sc: 0.75 },
  { x: 0.2, z: 0.3, sc: 0.7 },
  { x: -1.0, z: -0.5, sc: 1.0 },
  { x: 1.8, z: 0.6, sc: 0.85 },
  { x: -0.2, z: 1.5, sc: 1.2 },
  { x: 0.6, z: -0.8, sc: 0.9 },
  { x: -1.8, z: -1.2, sc: 1.05 },
];

function worldBoxToNorm(box, padding) {
  return {
    cx: (box.min.x + box.max.x) / 2 / 4.0 + 0.5,
    cy: (box.min.z + box.max.z) / 2 / 3.0 + 0.5,
    hw: (box.max.x - box.min.x) / 2 / 4.0 + padding / 4.0,
    hh: (box.max.z - box.min.z) / 2 / 3.0 + padding / 3.0,
  };
}

// Component
function PlazaCanvas({
  avatarId,
  posRef,
  keysRef,
  collisionBoxesRef,
  onSceneReady,
  hasActiveQuest,
  travelTargetRef,
  onArrived,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const modelRef = useRef(null);
  const loaderRef = useRef(new GLTFLoader());
  const frameRef = useRef(null);
  const floatTRef = useRef(0);
  const hasActiveQuestRef = useRef(false);
  const onArrivedRef = useRef(onArrived);

  useEffect(() => {
    hasActiveQuestRef.current = hasActiveQuest;
  }, [hasActiveQuest]);
  useEffect(() => {
    onArrivedRef.current = onArrived;
  }, [onArrived]);

  // Main scene setup
  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    sceneRef.current = scene;

    // Camera   
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 12, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 2.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-3, 2, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, -2, -3);
    scene.add(rim);

    // 2D Tilemap ground
    const cols = WORLD_W / TILE_SIZE; // 8
    const rows = WORLD_H / TILE_SIZE; // 6
    const tilemapTex = buildTilemapTexture(cols, rows);

    const groundGeo = new THREE.PlaneGeometry(WORLD_W, WORLD_H);
    const groundMat = new THREE.MeshLambertMaterial({ map: tilemapTex });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2; // lay flat
    groundMesh.position.y = -0.01; // just below y=0
    scene.add(groundMesh);

    // Set movement bounds from ground size
    posRef.current.bounds = {
      minX: 0.08,
      maxX: 0.92,
      minY: 0.08,
      maxY: 0.92,
    };

    // Trees (3D GLB)
    const glbLoader = new GLTFLoader();
    const fantasyColors = [0xe8a0bf, 0xb39ddb, 0x80cbc4, 0xf48fb1, 0xa5d6a7];

    glbLoader.load(
      "/assets/models/tree.glb",
      (gltf) => {
        const template = gltf.scene;
        const box0 = new THREE.Box3().setFromObject(template);
        const size0 = box0.getSize(new THREE.Vector3());
        const center0 = box0.getCenter(new THREE.Vector3());
        const treeScale = 2.5 / size0.y;

        TREE_PLACEMENTS.forEach((p) => {
          const inst = template.clone(true);
          inst.scale.setScalar(treeScale);
          inst.position.x = p.x - center0.x * treeScale;
          inst.position.z = p.z - center0.z * treeScale;
          inst.position.y = -center0.y * treeScale;
          inst.rotation.y = p.ry;
          let colorIndex = 0;
          inst.traverse((child) => {
            if (child.isMesh && child.visible) {
              child.material = new THREE.MeshToonMaterial({
                color: fantasyColors[colorIndex % fantasyColors.length],
              });
              colorIndex++;
            }
          });
          scene.add(inst);
          const wb = new THREE.Box3().setFromObject(inst);
          collisionBoxesRef.current.push(worldBoxToNorm(wb, COLLISION_PADDING));
        });
      },
      undefined,
      (err) => console.error("tree load error:", err),
    );

    // Grass (3D GLB)
    glbLoader.load(
      "/assets/models/grass.glb",
      (gltf) => {
        const template = gltf.scene;
        const box0 = new THREE.Box3().setFromObject(template);
        const size0 = box0.getSize(new THREE.Vector3());
        const center0 = box0.getCenter(new THREE.Vector3());

        GRASS_PLACEMENTS.forEach((p, i) => {
          const patch = template.clone(true);
          const sc = (0.5 * p.sc) / size0.y;
          patch.scale.setScalar(sc);
          patch.position.x = p.x - center0.x * sc;
          patch.position.z = p.z - center0.z * sc;
          patch.position.y = -center0.y * sc;
          patch.rotation.y = (i * 1.61803) % (Math.PI * 2);
          scene.add(patch);
        });
      },
      undefined,
      (err) => console.warn("grass load skipped:", err),
    );

    // Resize handler
    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    // Animate
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const model = modelRef.current;

      const manualInput =
        keysRef.current.ArrowUp ||
        keysRef.current.ArrowDown ||
        keysRef.current.ArrowLeft ||
        keysRef.current.ArrowRight;

      if (manualInput && travelTargetRef) travelTargetRef.current = null;

      const target = travelTargetRef?.current;

      if (target && !manualInput) {
        const dx = target.x - posRef.current.x;
        const dy = target.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ARRIVAL_THRESHOLD) {
          posRef.current = { ...posRef.current, x: target.x, y: target.y };
          travelTargetRef.current = null;
          onArrivedRef.current?.();
        } else {
          posRef.current = {
            ...posRef.current,
            x: posRef.current.x + (dx / dist) * TRAVEL_SPEED,
            y: posRef.current.y + (dy / dist) * TRAVEL_SPEED,
          };
          if (model) {
            const targetAngle = Math.atan2(dx, dy);
            let delta = targetAngle - model.rotation.y;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            model.rotation.y += delta * 0.18;
          }
        }
      }

      if (model) {
        const isMoving = manualInput || !!target;
        floatTRef.current += isMoving ? 0.12 : 0.04;
        const floatAmp = isMoving ? 0.12 : 0.06;
        const baseY = model.userData.baseY ?? 0;

        model.position.y = baseY + Math.sin(floatTRef.current) * floatAmp;
        model.position.x =
          ((posRef.current._smoothX ?? posRef.current.x) - 0.5) * WORLD_W;
        model.position.z =
          ((posRef.current._smoothY ?? posRef.current.y) - 0.5) * WORLD_H;

        if (manualInput) {
          const k = keysRef.current;
          let dx = 0,
            dz = 0;
          if (k.ArrowLeft) dx -= 1;
          if (k.ArrowRight) dx += 1;
          if (k.ArrowUp) dz -= 1;
          if (k.ArrowDown) dz += 1;
          const targetAngle = Math.atan2(dx, dz);
          let delta = targetAngle - model.rotation.y;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          model.rotation.z = 0;
          model.rotation.y += delta * 0.18;
        }

        model.traverse((child) => {
          if (child.userData.isCharGlow) {
            const active = hasActiveQuestRef.current;
            const glowTarget = active
              ? 0.4 + Math.sin(floatTRef.current * 2) * 0.25
              : 0;
            child.material.opacity +=
              (glowTarget - child.material.opacity) * 0.08;
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();
    onSceneReady(scene, camera, renderer);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      tilemapTex.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
    };
  }, []);

  // Avatar loader
  useEffect(() => {
    if (!sceneRef.current || !avatarId) return;
    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current);
      modelRef.current = null;
    }
    let cancelled = false;
    const cfg = AVATAR_CONFIG[avatarId] || { scale: 1.2, offsetX: 0 };

    loaderRef.current.load(
      `/assets/models/${avatarId}.glb`,
      (gltf) => {
        if (cancelled) return;
        const g = gltf.scene;
        const box = new THREE.Box3().setFromObject(g);
        const sz = box.getSize(new THREE.Vector3());
        const sc = cfg.scale / sz.y;
        g.scale.setScalar(sc);
        const center = box.getCenter(new THREE.Vector3());
        g.position.sub(center.multiplyScalar(sc));
        g.position.y += 0.5;

        const pivot = new THREE.Group();
        pivot.add(g);
        pivot.position.x = cfg.offsetX;
        pivot.userData.baseY = g.position.y;

        const glowRing = new THREE.Mesh(
          new THREE.RingGeometry(0.45, 0.65, 32),
          new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
          }),
        );
        glowRing.rotation.x = -Math.PI / 2;
        glowRing.position.y = -g.position.y + 0.05;
        glowRing.userData.isCharGlow = true;
        pivot.add(glowRing);

        sceneRef.current.add(pivot);
        modelRef.current = pivot;
      },
      undefined,
      (err) => console.error("avatar load error:", err),
    );

    return () => {
      cancelled = true;
    };
  }, [avatarId]);

  return <div ref={mountRef} className="plaza-canvas-mount" />;
}

export default React.memo(PlazaCanvas);
