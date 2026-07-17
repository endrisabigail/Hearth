import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// config
const AVATAR_CONFIG = {
  tomato: { scale: 1.2, offsetX: 0 },
  frog: { scale: 1.2, offsetX: 0 },
  fish: { scale: 1.2, offsetX: 0.05 },
  mushroom: { scale: 1.2, offsetX: 0 },
  apple: { scale: 1.2, offsetX: 0 },
  snail: { scale: 1.2, offsetX: 0 },
};

const TRAVEL_SPEED = 0.006;
const ARRIVAL_THRESHOLD = 0.018;

const WORLD_UNITS = 64; // total world size (square) — bumped up for more open plane space
const TILE_SIZE = 2; // each tile is 2 world units
const TILES = WORLD_UNITS / TILE_SIZE;
const TREE_COUNT = 180; // scaled up to keep tree density similar on the bigger plane
const PX = 64; // pixels per tile on texture canvas

//character edge pad
const EDGE_PAD = 1.5 / WORLD_UNITS;
export const MOVEMENT_BOUNDS = {
  minX: EDGE_PAD,
  maxX: 1 - EDGE_PAD,
  minY: EDGE_PAD,
  maxY: 1 - EDGE_PAD,
};

// Build grass texture
function buildGrassTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = PX * 4;
  canvas.height = PX * 4;
  const ctx = canvas.getContext("2d");

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * PX;
      const y = row * PX;

      const hue = 118 + ((row * 4 + col) % 5) * 4;
      ctx.fillStyle = `hsl(${hue}, 52%, 42%)`;
      ctx.fillRect(x, y, PX, PX);

      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, PX - 1, PX - 1);

      ctx.fillStyle = `hsl(${hue + 10}, 55%, 52%)`;
      const rng = (row * 4 + col + 1) * 13;
      for (let i = 0; i < 6; i++) {
        const bx = x + ((rng * (i + 1) * 7) % (PX - 8)) + 4;
        const by = y + ((rng * (i + 1) * 11) % (PX - 10)) + 5;
        ctx.fillRect(bx, by, 2, 5);
        ctx.fillRect(bx + 3, by + 2, 2, 4);
      }

      if ((row + col) % 3 === 0) {
        ctx.fillStyle = "#f9c6d0";
        ctx.beginPath();
        ctx.arc(
          x + 20 + ((col * 7) % 24),
          y + 20 + ((row * 9) % 24),
          3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = "#fff59d";
        ctx.beginPath();
        ctx.arc(
          x + 20 + ((col * 7) % 24),
          y + 20 + ((row * 9) % 24),
          1.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(TILES / 4, TILES / 4);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// Height (world units) that spawned trees are randomised between
const TREE_MIN_HEIGHT = 1.8;
const TREE_MAX_HEIGHT = 3.0;

// plaza tree border
const BORDER_INSET = 2.2; // world units in from the true edge of the plane
const BORDER_SPACING = 2.4; // world units between border trees along each side
const BORDER_JITTER = 0.35; // random wobble so the ring doesn't look like a fence

function buildBorderTreePositions(half, rand) {
  const r = half - BORDER_INSET;
  const jitter = () => (rand() - 0.5) * BORDER_JITTER;
  const positions = [];
  for (let v = -r; v <= r; v += BORDER_SPACING) {
    positions.push({ x: v + jitter(), z: -r + jitter() }); // north edge
    positions.push({ x: v + jitter(), z: r + jitter() }); // south edge
    positions.push({ x: -r + jitter(), z: v + jitter() }); // west edge
    positions.push({ x: r + jitter(), z: v + jitter() }); // east edge
  }
  return positions;
}

// Seeded random
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
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

  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, WORLD_UNITS * 0.45, WORLD_UNITS * 0.85);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 14, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(5, 10, 6);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-4, 3, -3);
    scene.add(fill);

    // Grass ground
    const grassTex = buildGrassTexture();
    const groundGeo = new THREE.PlaneGeometry(WORLD_UNITS, WORLD_UNITS);
    const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    // 3D tree sculptures cloned + scattered around the plaza
    const rand = seededRandom(42);
    const half = WORLD_UNITS / 2;
    const margin = 2;

    collisionBoxesRef.current = [];

    const treeLoader = new GLTFLoader();
    let treesCancelled = false;
    treeLoader.load(
      "/assets/models/tree.glb",
      (gltf) => {
        if (treesCancelled) return;
        const template = gltf.scene;

        // Normalise so "scale" below maps to an actual world-unit height
        const baseBox = new THREE.Box3().setFromObject(template);
        const baseSize = baseBox.getSize(new THREE.Vector3());
        const baseHeight = baseSize.y || 1;
        const baseRadius =
          Math.max(baseSize.x, baseSize.z) / 2 / baseHeight || 0.3;
        const baseMinY = baseBox.min.y; // how far the model's origin sits below its own base

        // Shared placement logic so interior scatter trees and the border
        // ring both get a matching visual tree + collision box.
        const placeTree = (tx, tz) => {
          const targetHeight =
            TREE_MIN_HEIGHT + rand() * (TREE_MAX_HEIGHT - TREE_MIN_HEIGHT);
          const scale = targetHeight / baseHeight;

          const tree = template.clone(true);
          tree.scale.setScalar(scale);
          // Shift up so the model's true base (not its origin) sits on the grass
          const groundLift = -baseMinY * scale + 0.02;
          tree.position.set(tx, groundLift, tz);
          tree.rotation.y = rand() * Math.PI * 2;
          scene.add(tree);

          // Collision box in normalised 0–1 space
          const pad = 0.35;
          const treeRadius = baseRadius * targetHeight; // world units
          collisionBoxesRef.current.push({
            cx: tx / WORLD_UNITS + 0.5,
            cy: tz / WORLD_UNITS + 0.5,
            hw: (treeRadius + pad) / WORLD_UNITS,
            hh: (treeRadius + pad) / WORLD_UNITS,
          });
        };

        for (let i = 0; i < TREE_COUNT; i++) {
          const tx = rand() * (WORLD_UNITS - margin * 2) - (half - margin);
          const tz = rand() * (WORLD_UNITS - margin * 2) - (half - margin);

          // Keep spawn area clear
          if (Math.abs(tx) < 3.5 && Math.abs(tz) < 3.5) continue;

          placeTree(tx, tz);
        }

        // border rings hugs the edge of the plane so the character is naturally boxed in by trees 
        buildBorderTreePositions(half, rand).forEach(({ x, z }) =>
          placeTree(x, z),
        );
      },
      undefined,
      (err) => console.error("tree load error:", err),
    );

    // movement bounds
    posRef.current.bounds = MOVEMENT_BOUNDS;

    // animate
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
        const wx =
          (posRef.current._smoothX ?? posRef.current.x - 0.5) * WORLD_UNITS;
        const wz =
          (posRef.current._smoothY ?? posRef.current.y - 0.5) * WORLD_UNITS;

        const isMoving = manualInput || !!target;
        floatTRef.current += isMoving ? 0.12 : 0.04;
        const baseY = model.userData.baseY ?? 0;

        model.position.x = wx;
        model.position.y =
          baseY + Math.sin(floatTRef.current) * (isMoving ? 0.1 : 0.05);
        model.position.z = wz;

        // Smooth camera follow
        camera.position.x += (wx - camera.position.x) * 0.1;
        camera.position.z += (wz + 12 - camera.position.z) * 0.1;
        camera.position.y = 14;
        camera.lookAt(wx, 0, wz);

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

    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      treesCancelled = true;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      grassTex.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
    };
  }, []);

  // avatar loader
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
