import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Config
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

// world layout
const WORLD_MIN = -32; // left/up extent  
const WORLD_MAX = 48; // right/down extent (grown from 32 -> 48)
const WORLD_SIZE = WORLD_MAX - WORLD_MIN; // 80
const WORLD_CENTER = (WORLD_MIN + WORLD_MAX) / 2; // 8

const TILE_SIZE = 2;
const TILES = WORLD_SIZE / TILE_SIZE;
const TREE_COUNT = 210;
const BUSH_COUNT = 130;
const PX = 64;

function normToWorld(n) {
  return WORLD_MIN + n * WORLD_SIZE;
}
function worldToNorm(w) {
  return (w - WORLD_MIN) / WORLD_SIZE;
}

// room is kept at the very edge of the grass so the
// character never visually clips off into the fog.
const EDGE_PAD = 1.5 / WORLD_SIZE;
export const MOVEMENT_BOUNDS = {
  minX: EDGE_PAD,
  maxX: 1 - EDGE_PAD,
  minY: EDGE_PAD,
  maxY: 1 - EDGE_PAD,
};

// pond  
const POND_CENTER_X = WORLD_MAX - 15;
const POND_CENTER_Z = WORLD_MAX - 11;
const POND_RADIUS = 7.5;

// character spawn radius
const SPAWN_CLEAR_RADIUS = 6.5;

// build grass texture
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

// cloud texture  
function buildCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const puffs = [
    [128, 150, 78],
    [78, 130, 54],
    [178, 130, 54],
    [100, 100, 46],
    [156, 100, 46],
    [128, 90, 60],
  ];
  puffs.forEach(([cx, cy, r]) => {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.7, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });

  return new THREE.CanvasTexture(canvas);
}

// animated water texture
function buildWaterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#4fb3d9";
  ctx.fillRect(0, 0, 128, 128);

  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,0.0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(255,255,255,0.0)");
  ctx.fillStyle = grad;
  for (let i = -1; i < 6; i++) {
    ctx.save();
    ctx.translate(i * 40, 0);
    ctx.fillRect(0, 0, 14, 128);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = 0; i < 10; i++) {
    ctx.fillRect((i * 37) % 128, (i * 53) % 128, 6, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

// height (world units) that spawned trees are randomised between
const TREE_MIN_HEIGHT = 1.8;
const TREE_MAX_HEIGHT = 3.0;

// Seeded random
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// pond shape and grass circles
function buildBlobShape(radius, irregularity, points, rand) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * Math.PI * 2;
    const r = radius * (1 + (rand() - 0.5) * irregularity);
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

// bushes
function buildBush(rand) {
  const group = new THREE.Group();
  const hue = 96 + rand() * 30;
  const puffCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < puffCount; i++) {
    const r = 0.28 + rand() * 0.22;
    const geo = new THREE.IcosahedronGeometry(r, 0);
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(`hsl(${hue}, 45%, ${34 + rand() * 10}%)`),
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (rand() - 0.5) * 0.35 * puffCount,
      r * 0.75,
      (rand() - 0.5) * 0.35 * puffCount,
    );
    mesh.rotation.y = rand() * Math.PI;
    group.add(mesh);
  }
  return group;
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
    scene.fog = new THREE.Fog(0x87ceeb, WORLD_SIZE * 0.45, WORLD_SIZE * 0.85);
    sceneRef.current = scene;

    // Camera 
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(WORLD_CENTER, 14, WORLD_CENTER + 12);
    camera.lookAt(WORLD_CENTER, 0, WORLD_CENTER);
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
    const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(WORLD_CENTER, -0.01, WORLD_CENTER);
    scene.add(ground);

    collisionBoxesRef.current = [];

    // pond
    const pondSeedA = seededRandom(7);
    const pondSeedB = seededRandom(7);
    const shoreShape = buildBlobShape(POND_RADIUS * 1.18, 0.16, 28, pondSeedA);
    const waterShape = buildBlobShape(POND_RADIUS, 0.18, 28, pondSeedB);

    const shoreMat = new THREE.MeshLambertMaterial({ color: 0xe4d6a7 });
    const shoreMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shoreShape),
      shoreMat,
    );
    shoreMesh.rotation.x = -Math.PI / 2;
    shoreMesh.position.set(POND_CENTER_X, 0.0, POND_CENTER_Z);
    scene.add(shoreMesh);

    const waterTex = buildWaterTexture();
    const waterMat = new THREE.MeshLambertMaterial({
      map: waterTex,
      transparent: true,
      opacity: 0.92,
    });
    const waterMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(waterShape),
      waterMat,
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(POND_CENTER_X, 0.02, POND_CENTER_Z);
    scene.add(waterMesh);

    // block so character can't walk into the pond
    collisionBoxesRef.current.push({
      cx: worldToNorm(POND_CENTER_X),
      cy: worldToNorm(POND_CENTER_Z),
      hw: (POND_RADIUS * 1.05) / WORLD_SIZE,
      hh: (POND_RADIUS * 1.05) / WORLD_SIZE,
    });

    //clouds
    const cloudTex = buildCloudTexture();
    const cloudGroup = new THREE.Group();
    const cloudRand = seededRandom(19);
    const CLOUD_COUNT = 7;
    const cloudMeshes = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const size = 10 + cloudRand() * 9;
      const mat = new THREE.MeshBasicMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.55 + cloudRand() * 0.25,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        WORLD_MIN + cloudRand() * WORLD_SIZE * 1.4 - WORLD_SIZE * 0.2,
        20 + cloudRand() * 6,
        WORLD_MIN + cloudRand() * WORLD_SIZE * 1.4 - WORLD_SIZE * 0.2,
      );
      mesh.userData.driftSpeed = 0.004 + cloudRand() * 0.006;
      cloudGroup.add(mesh);
      cloudMeshes.push(mesh);
    }
    scene.add(cloudGroup);

    //bushes
    const bushRand = seededRandom(31);
    const bushPositions = [];
    function tooCloseTo(list, x, z, minDist) {
      for (const p of list) {
        const dx = x - p.x;
        const dz = z - p.z;
        if (dx * dx + dz * dz < minDist * minDist) return true;
      }
      return false;
    }
    function insidePond(x, z, pad) {
      const dx = x - POND_CENTER_X;
      const dz = z - POND_CENTER_Z;
      return dx * dx + dz * dz < (POND_RADIUS + pad) * (POND_RADIUS + pad);
    }
    function inClearing(x, z) {
      const dx = x - WORLD_CENTER;
      const dz = z - WORLD_CENTER;
      return dx * dx + dz * dz < SPAWN_CLEAR_RADIUS * SPAWN_CLEAR_RADIUS;
    }

    const margin = 2;
    let bushAttempts = 0;
    let bushesPlaced = 0;
    while (bushesPlaced < BUSH_COUNT && bushAttempts < BUSH_COUNT * 15) {
      bushAttempts++;
      const bx = WORLD_MIN + margin + bushRand() * (WORLD_SIZE - margin * 2);
      const bz = WORLD_MIN + margin + bushRand() * (WORLD_SIZE - margin * 2);
      if (inClearing(bx, bz)) continue;
      if (insidePond(bx, bz, 1.2)) continue;
      if (tooCloseTo(bushPositions, bx, bz, 1.4)) continue;

      const bush = buildBush(bushRand);
      bush.position.set(bx, 0, bz);
      bush.rotation.y = bushRand() * Math.PI * 2;
      scene.add(bush);
      bushPositions.push({ x: bx, z: bz });
      bushesPlaced++;

      collisionBoxesRef.current.push({
        cx: worldToNorm(bx),
        cy: worldToNorm(bz),
        hw: 0.55 / WORLD_SIZE,
        hh: 0.55 / WORLD_SIZE,
      });
    }

    // trees
    const treeRand = seededRandom(42);
    const treeLoader = new GLTFLoader();
    let treesCancelled = false;
    treeLoader.load(
      "/assets/models/tree.glb",
      (gltf) => {
        if (treesCancelled) return;
        const template = gltf.scene;

        // normalise so "scale" below maps to an actual world-unit height
        const baseBox = new THREE.Box3().setFromObject(template);
        const baseSize = baseBox.getSize(new THREE.Vector3());
        const baseHeight = baseSize.y || 1;
        const baseRadius =
          Math.max(baseSize.x, baseSize.z) / 2 / baseHeight || 0.3;
        const baseMinY = baseBox.min.y; // how far the model's origin sits below its own base

        const treePositions = [];
        const MIN_TREE_SPACING = 3.1;

        let attempts = 0;
        let placed = 0;
        while (placed < TREE_COUNT && attempts < TREE_COUNT * 15) {
          attempts++;
          const tx =
            WORLD_MIN + margin + treeRand() * (WORLD_SIZE - margin * 2);
          const tz =
            WORLD_MIN + margin + treeRand() * (WORLD_SIZE - margin * 2);

          if (inClearing(tx, tz)) continue;
          if (insidePond(tx, tz, 1.8)) continue;
          if (tooCloseTo(treePositions, tx, tz, MIN_TREE_SPACING)) continue;
          if (tooCloseTo(bushPositions, tx, tz, 1.1)) continue;

          const targetHeight =
            TREE_MIN_HEIGHT + treeRand() * (TREE_MAX_HEIGHT - TREE_MIN_HEIGHT);
          const scale = targetHeight / baseHeight;

          const tree = template.clone(true);
          tree.scale.setScalar(scale);
          // shift up so the model's true base (not its origin) sits on the grass
          const groundLift = -baseMinY * scale + 0.02;
          tree.position.set(tx, groundLift, tz);
          tree.rotation.y = treeRand() * Math.PI * 2;
          scene.add(tree);

          treePositions.push({ x: tx, z: tz });
          placed++;

          // Collision box in normalised 0-1 space
          const pad = 0.35;
          const treeRadius = baseRadius * targetHeight; // world units
          collisionBoxesRef.current.push({
            cx: worldToNorm(tx),
            cy: worldToNorm(tz),
            hw: (treeRadius + pad) / WORLD_SIZE,
            hh: (treeRadius + pad) / WORLD_SIZE,
          });
        }
      },
      undefined,
      (err) => console.error("tree load error:", err),
    );

    posRef.current.bounds = MOVEMENT_BOUNDS;

    // Animate
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const model = modelRef.current;

      // cloud drift and water texture animation
      cloudMeshes.forEach((c) => {
        c.position.x += c.userData.driftSpeed;
        if (c.position.x > WORLD_MAX + WORLD_SIZE * 0.25) {
          c.position.x = WORLD_MIN - WORLD_SIZE * 0.25;
        }
      });
      waterTex.offset.x += 0.0006;
      waterTex.offset.y += 0.0003;

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
        const wx = normToWorld(posRef.current._smoothX ?? posRef.current.x);
        const wz = normToWorld(posRef.current._smoothY ?? posRef.current.y);

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
      cloudTex.dispose();
      waterTex.dispose();
      shoreMesh.geometry.dispose();
      shoreMat.dispose();
      waterMesh.geometry.dispose();
      waterMat.dispose();
      cloudMeshes.forEach((c) => {
        c.geometry.dispose();
        c.material.dispose();
      });
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
