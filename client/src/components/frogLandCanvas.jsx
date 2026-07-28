import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  AVATAR_CONFIG,
  AGENT_TARGET_HEIGHT,
  AGENT_FOLLOW_DISTANCE,
  AGENT_FOLLOW_LERP,
  AGENT_HOVER_HEIGHT,
  agentModelFor,
  seededRandom,
  buildGlowTexture,
  buildWaterTexture,
  buildSkyTexture,
  buildLilyPad,
  buildAvatarPivot,
  buildAgentPivot,
  buildMessageBubbleTexture,
  disposePivot,
} from "./plazaCanvas.jsx";
import {
  NODE_POSITIONS,
  NODES_PER_ROW,
  GRID_START_NY,
  GRID_ROW_GAP,
  GRID_COL_MARGIN,
  GRID_COL_GAP,
  GRID_MAX_ROWS,
  makeChest,
} from "./questNodes.jsx";

// world scale
const WORLD_MIN = -18;
const WORLD_MAX = 18;
const WORLD_SIZE = WORLD_MAX - WORLD_MIN;
const WORLD_CENTER = (WORLD_MIN + WORLD_MAX) / 2;

export function normToWorld(n) {
  return WORLD_MIN + n * WORLD_SIZE;
}
export function worldToNorm(w) {
  return (w - WORLD_MIN) / WORLD_SIZE;
}

const EDGE_PAD = 1.5 / WORLD_SIZE;
export const FROG_MOVEMENT_BOUNDS = {
  minX: EDGE_PAD,
  maxX: 1 - EDGE_PAD,
  minY: EDGE_PAD,
  maxY: 1 - EDGE_PAD,
};

const TRAVEL_SPEED = 0.0022;
const ARRIVAL_THRESHOLD = 0.016;

//lily pad network
const HUB_NX = 0.5;
const HUB_NY = Math.max(GRID_START_NY - 0.09, 0.02);
const LANE_HALF_WIDTH = 0.02;
const NODE_PAD_RADIUS = 0.034;
const HUB_PAD_RADIUS = 0.05;

const COL_X = Array.from(
  { length: NODES_PER_ROW },
  (_, c) => GRID_COL_MARGIN + c * GRID_COL_GAP,
);
const ROW_Y = Array.from(
  { length: GRID_MAX_ROWS },
  (_, r) => GRID_START_NY + r * GRID_ROW_GAP,
);
const ROW_TOP = ROW_Y[0];
const ROW_BOTTOM = ROW_Y[ROW_Y.length - 1];

const LANE_SEGMENTS = [
  // hub down into row 0, along the center column
  { x1: HUB_NX, y1: HUB_NY, x2: HUB_NX, y2: ROW_TOP },
  // vertical column lanes
  ...COL_X.map((x) => ({ x1: x, y1: ROW_TOP, x2: x, y2: ROW_BOTTOM })),
  // horizontal row lanes
  ...ROW_Y.map((y) => ({
    x1: COL_X[0],
    y1: y,
    x2: COL_X[COL_X.length - 1],
    y2: y,
  })),
];

const PAD_CIRCLES = [
  { x: HUB_NX, y: HUB_NY, r: HUB_PAD_RADIUS },
  ...NODE_POSITIONS.map((n) => ({ x: n.nx, y: n.ny, r: NODE_PAD_RADIUS })),
];

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// character off a pad and into the water  
export function isOnLilyPad(nx, ny) {
  for (const c of PAD_CIRCLES) {
    if (Math.hypot(nx - c.x, ny - c.y) <= c.r) return true;
  }
  for (const s of LANE_SEGMENTS) {
    if (distToSegment(nx, ny, s.x1, s.y1, s.x2, s.y2) <= LANE_HALF_WIDTH) {
      return true;
    }
  }
  return false;
}

// nearest walkable point, used to recover a character who spawns somewhere
// (e.g. a saved position from a different habitat) that isn't on a pad
function nearestWalkablePoint(nx, ny) {
  if (isOnLilyPad(nx, ny)) return { x: nx, y: ny };
  let best = { x: HUB_NX, y: HUB_NY };
  let bestDist = Infinity;
  const consider = (x, y) => {
    const d = Math.hypot(nx - x, ny - y);
    if (d < bestDist) {
      bestDist = d;
      best = { x, y };
    }
  };
  PAD_CIRCLES.forEach((c) => consider(c.x, c.y));
  LANE_SEGMENTS.forEach((s) => {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((nx - s.x1) * dx + (ny - s.y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    consider(s.x1 + t * dx, s.y1 + t * dy);
  });
  return best;
}

// simple two-waypoint route along the lattice  
function buildTravelRoute(from, to) {
  const waypoints = [];
  const mid = { x: from.x, y: to.y };
  if (Math.hypot(mid.x - from.x, mid.y - from.y) > 0.005) waypoints.push(mid);
  waypoints.push({ x: to.x, y: to.y });
  return waypoints;
}

// builds a chest sitting on its own lily pad, for QuestNodes' buildNodeMesh
export function buildLilyChestNode(quest, node, colors) {
  const group = new THREE.Group();
  const seed = Array.from(node.id).reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const rand = seededRandom(seed);
  const pad = buildLilyPad(0.9 + rand() * 0.2, rand);
  pad.position.y = 0.02;
  group.add(pad);
  group.add(makeChest(colors));
  return group;
}

//coins and tadpole trail
const COIN_SPAWN_INTERVAL = [4000, 8000]; // ms, random between
const MAX_COINS = 6;
const COIN_COLLECT_RADIUS = 0.028;
const TRAIL_SAMPLE_INTERVAL = 4; // frames between history samples
const TRAIL_GAP = 6; // history samples between each tadpole

function buildCoin() {
  const group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffd54a,
    metalness: 0.6,
    roughness: 0.25,
    emissive: 0x7a5b00,
    emissiveIntensity: 0.25,
  });
  const coin = new THREE.Mesh(geo, mat);
  coin.rotation.x = Math.PI / 2;
  coin.position.y = 0.18;
  group.add(coin);

  const glowTex = buildGlowTexture("255,221,110");
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  glow.scale.set(0.5, 0.5, 1);
  glow.position.y = 0.18;
  group.add(glow);

  group.userData.spin = 0;
  return group;
}

function buildTadpole() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2e3b1f });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), bodyMat);
  body.scale.set(1, 0.85, 1.15);
  group.add(body);

  const tailMat = new THREE.MeshLambertMaterial({
    color: 0x39481f,
    transparent: true,
    opacity: 0.85,
  });
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.32, 8),
    tailMat,
  );
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -0.22;
  group.add(tail);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  [-0.06, 0.06].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat);
    eye.position.set(ex, 0.08, 0.1);
    group.add(eye);
  });

  group.userData.baseY = 0.06;
  group.userData.bobSeed = Math.random() * Math.PI * 2;
  return group;
}

// small decorative reed cluster for the pond edges (purely visual, no collision)
function buildReedClump(rand) {
  const group = new THREE.Group();
  const count = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const h = 0.9 + rand() * 0.9;
    const geo = new THREE.CylinderGeometry(0.03, 0.045, h, 6);
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(`hsl(${95 + rand() * 20}, 40%, ${28 + rand() * 12}%)`),
    });
    const reed = new THREE.Mesh(geo, mat);
    reed.position.set((rand() - 0.5) * 0.4, h / 2, (rand() - 0.5) * 0.4);
    reed.rotation.z = (rand() - 0.5) * 0.25;
    group.add(reed);
  }
  return group;
}

function FrogLandCanvas({
  avatarId,
  posRef,
  keysRef,
  onSceneReady,
  hasActiveQuest,
  travelTargetRef,
  onArrived,
  otherPlayersRef,
  playersVersion,
  messageAlertsRef,
  onAgentScreenPositionChange,
  onCoinCountChange,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const modelRef = useRef(null);
  const loaderRef = useRef(new GLTFLoader());
  const frameRef = useRef(null);
  const otherModelsRef = useRef(new Map());
  const floatTRef = useRef(0);
  const idleTimeRef = useRef(0);
  const hasActiveQuestRef = useRef(false);
  const onArrivedRef = useRef(onArrived);

  const agentRef = useRef(null);
  const agentFloatTRef = useRef(Math.random() * Math.PI * 2);
  const onAgentScreenPositionChangeRef = useRef(onAgentScreenPositionChange);

  // click-to-travel route queue (lattice-following waypoints, not a
  // straight line, so travel never cuts across open water)
  const routeRef = useRef([]);
  const lastTravelTargetRef = useRef(null);

  // coins + trailing tadpole conga-line
  const coinsRef = useRef([]); // { group, nx, ny }
  const nextCoinSpawnRef = useRef(0);
  const tadpolesRef = useRef([]); // { group }
  const trailHistoryRef = useRef([]); // recent world positions of the frog
  const trailFrameRef = useRef(0);
  const coinCountRef = useRef(0);
  const onCoinCountChangeRef = useRef(onCoinCountChange);

  useEffect(() => {
    hasActiveQuestRef.current = hasActiveQuest;
  }, [hasActiveQuest]);
  useEffect(() => {
    onArrivedRef.current = onArrived;
  }, [onArrived]);
  useEffect(() => {
    onAgentScreenPositionChangeRef.current = onAgentScreenPositionChange;
  }, [onAgentScreenPositionChange]);
  useEffect(() => {
    onCoinCountChangeRef.current = onCoinCountChange;
  }, [onCoinCountChange]);

  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const scene = new THREE.Scene();
    const skyTex = buildSkyTexture();
    scene.background = skyTex;
    scene.fog = new THREE.Fog(0xbfe6f2, WORLD_SIZE * 0.5, WORLD_SIZE * 0.95);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(WORLD_CENTER, 13, WORLD_CENTER + 11);
    camera.lookAt(WORLD_CENTER, 0, WORLD_CENTER);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 2.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(WORLD_CENTER + 5, 10, WORLD_CENTER + 6);
    sun.target.position.set(WORLD_CENTER, 0, WORLD_CENTER);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.bias = -0.0015;
    sun.shadow.radius = 3;
    scene.add(sun);
    scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-4, 3, -3);
    scene.add(fill);

    // the whole "land" is water  
    const waterTex = buildWaterTexture();
    const waterMat = new THREE.MeshLambertMaterial({
      map: waterTex,
      transparent: true,
      opacity: 0.94,
    });
    const waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE * 1.4, WORLD_SIZE * 1.4),
      waterMat,
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(WORLD_CENTER, 0, WORLD_CENTER);
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);

    // a darker underlayer for depth
    const deepMat = new THREE.MeshBasicMaterial({ color: 0x115a72 });
    const deepMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE * 1.5, WORLD_SIZE * 1.5),
      deepMat,
    );
    deepMesh.rotation.x = -Math.PI / 2;
    deepMesh.position.set(WORLD_CENTER, -0.3, WORLD_CENTER);
    scene.add(deepMesh);

    // decorative lily pads scattered along every lane, so the walkway
    // actually reads as lily pads rather than an invisible rule
    const padRand = seededRandom(211);
    const decorPads = [];
    const STEP = 0.045;
    LANE_SEGMENTS.forEach((s) => {
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      const steps = Math.max(1, Math.round(len / STEP));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const nx = s.x1 + (s.x2 - s.x1) * t + (padRand() - 0.5) * 0.012;
        const ny = s.y1 + (s.y2 - s.y1) * t + (padRand() - 0.5) * 0.012;
        const pad = buildLilyPad(0.55 + padRand() * 0.35, padRand);
        const wx = normToWorld(nx);
        const wz = normToWorld(ny);
        pad.position.set(wx, 0.03, wz);
        pad.userData.baseY = 0.03;
        pad.userData.bobSeed = padRand() * Math.PI * 2;
        scene.add(pad);
        decorPads.push(pad);
      }
    });
    // hub pad, a bit bigger since it's the spawn point
    const hubPad = buildLilyPad(1.4, padRand);
    hubPad.position.set(normToWorld(HUB_NX), 0.03, normToWorld(HUB_NY));
    hubPad.userData.baseY = 0.03;
    hubPad.userData.bobSeed = padRand() * Math.PI * 2;
    scene.add(hubPad);
    decorPads.push(hubPad);

    // a few reed clumps around the outer edge, purely decorative
    const reedRand = seededRandom(311);
    const reeds = [];
    for (let i = 0; i < 14; i++) {
      const a = reedRand() * Math.PI * 2;
      const r = WORLD_SIZE * 0.62 + reedRand() * WORLD_SIZE * 0.06;
      const reed = buildReedClump(reedRand);
      reed.position.set(
        WORLD_CENTER + Math.cos(a) * r,
        -0.05,
        WORLD_CENTER + Math.sin(a) * r,
      );
      scene.add(reed);
      reeds.push(reed);
    }

    // clouds, reused sky-dressing
    const cloudMeshes = [];

    // ambient ripples across the pond
    const rippleGeo = new THREE.RingGeometry(0.3, 0.42, 24);
    const ripples = [];
    let ambientRippleTimer = 0;
    let lastSplashTime = -999;
    function spawnRipple(x, z, life = 1.6) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(rippleGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.035, z);
      scene.add(mesh);
      ripples.push({ mesh, born: performance.now(), life: life * 1000 });
    }

    // splash droplets, spawned as the frog hops
    const splashTex = buildGlowTexture("255,255,255");
    const droplets = [];
    function spawnSplash(x, z) {
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.SpriteMaterial({
          map: splashTex,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.16, 0.16, 1);
        const ang = Math.random() * Math.PI * 2;
        const spd = 0.35 + Math.random() * 0.4;
        sprite.position.set(x, 0.1, z);
        sprite.userData = {
          vx: Math.cos(ang) * spd,
          vz: Math.sin(ang) * spd,
          vy: 0.8 + Math.random() * 0.3,
        };
        scene.add(sprite);
        droplets.push({ mesh: sprite, born: performance.now(), life: 450 });
      }
    }

    // sleepy "Zzz" while idle
    const zzzCanvas = document.createElement("canvas");
    zzzCanvas.width = 64;
    zzzCanvas.height = 64;
    const zctx = zzzCanvas.getContext("2d");
    zctx.font = "bold 20px 'Comic Sans MS', sans-serif";
    zctx.textAlign = "center";
    zctx.textBaseline = "middle";
    zctx.fillStyle = "#123a4a";
    zctx.fillText("Z", 32, 34);
    const zzzTex = new THREE.CanvasTexture(zzzCanvas);
    const ZZZ_COUNT = 3;
    const zzzSprites = [];
    for (let i = 0; i < ZZZ_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: zzzTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.3, 0.3, 1);
      scene.add(sprite);
      zzzSprites.push(sprite);
    }

    posRef.current.bounds = FROG_MOVEMENT_BOUNDS;
    posRef.current.isWalkable = isOnLilyPad;

    // recover a character whose saved position (from another habitat, or
    // before this pad layout existed) doesn't land on a pad
    if (!isOnLilyPad(posRef.current.x, posRef.current.y)) {
      const safe = nearestWalkablePoint(posRef.current.x, posRef.current.y);
      posRef.current = { ...posRef.current, x: safe.x, y: safe.y };
    }

    function collectCoinsNear(wx, wz) {
      for (let i = coinsRef.current.length - 1; i >= 0; i--) {
        const coin = coinsRef.current[i];
        const dx = normToWorld(coin.nx) - wx;
        const dz = normToWorld(coin.ny) - wz;
        if (Math.hypot(dx, dz) < COIN_COLLECT_RADIUS * WORLD_SIZE) {
          scene.remove(coin.group);
          coin.group.traverse((c) => {
            c.geometry?.dispose?.();
            c.material?.dispose?.();
          });
          coinsRef.current.splice(i, 1);

          const tadpole = buildTadpole();
          scene.add(tadpole);
          tadpolesRef.current.push({ group: tadpole });

          coinCountRef.current += 1;
          onCoinCountChangeRef.current?.(coinCountRef.current);
        }
      }
    }

    function trySpawnCoin(now) {
      if (coinsRef.current.length >= MAX_COINS) return;
      if (now < nextCoinSpawnRef.current) return;
      const spot = PAD_CIRCLES[Math.floor(Math.random() * PAD_CIRCLES.length)];
      const coin = buildCoin();
      coin.position.set(normToWorld(spot.x), 0, normToWorld(spot.y));
      scene.add(coin);
      coinsRef.current.push({ group: coin, nx: spot.x, ny: spot.y });
      const [minGap, maxGap] = COIN_SPAWN_INTERVAL;
      nextCoinSpawnRef.current = now + minGap + Math.random() * (maxGap - minGap);
    }

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const model = modelRef.current;
      const now = performance.now();
      const t = now * 0.001;

      waterTex.offset.x += 0.0006;
      waterTex.offset.y += 0.0003;

      decorPads.forEach((pad) => {
        pad.position.y =
          pad.userData.baseY + Math.sin(t * 0.8 + pad.userData.bobSeed) * 0.015;
      });

      // coins bob and spin
      coinsRef.current.forEach((coin) => {
        coin.group.rotation.y += 0.05;
        coin.group.position.y = 0.05 + Math.sin(t * 2 + coin.nx * 40) * 0.05;
      });
      trySpawnCoin(now);

      ambientRippleTimer -= 1;
      if (ambientRippleTimer <= 0) {
        ambientRippleTimer = 70 + Math.floor(Math.random() * 50);
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * WORLD_SIZE * 0.5;
        spawnRipple(
          WORLD_CENTER + Math.cos(a) * r,
          WORLD_CENTER + Math.sin(a) * r,
          2.2,
        );
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        const progress = (now - rp.born) / rp.life;
        if (progress >= 1) {
          scene.remove(rp.mesh);
          rp.mesh.material.dispose();
          ripples.splice(i, 1);
          continue;
        }
        const scale = 0.5 + progress * 4.5;
        rp.mesh.scale.set(scale, scale, scale);
        rp.mesh.material.opacity = 0.55 * (1 - progress);
      }
      for (let i = droplets.length - 1; i >= 0; i--) {
        const d = droplets[i];
        const progress = (now - d.born) / d.life;
        if (progress >= 1) {
          scene.remove(d.mesh);
          d.mesh.material.dispose();
          droplets.splice(i, 1);
          continue;
        }
        const dt = 0.016;
        d.mesh.position.x += d.mesh.userData.vx * dt;
        d.mesh.position.z += d.mesh.userData.vz * dt;
        d.mesh.userData.vy -= 2.2 * dt;
        d.mesh.position.y = Math.max(0.06, d.mesh.position.y + d.mesh.userData.vy * dt);
        d.mesh.material.opacity = 0.85 * (1 - progress);
      }

      const manualInput =
        keysRef.current.ArrowUp ||
        keysRef.current.ArrowDown ||
        keysRef.current.ArrowLeft ||
        keysRef.current.ArrowRight;

      if (manualInput && travelTargetRef) {
        travelTargetRef.current = null;
        routeRef.current = [];
        lastTravelTargetRef.current = null;
      }

      // (re)build the waypoint route whenever a new travel target appears
      const target = travelTargetRef?.current;
      if (target && target !== lastTravelTargetRef.current) {
        lastTravelTargetRef.current = target;
        routeRef.current = buildTravelRoute(
          { x: posRef.current.x, y: posRef.current.y },
          target,
        );
      }
      if (!target) {
        routeRef.current = [];
        lastTravelTargetRef.current = null;
      }

      if (!manualInput && routeRef.current.length > 0) {
        const wp = routeRef.current[0];
        const dx = wp.x - posRef.current.x;
        const dy = wp.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ARRIVAL_THRESHOLD) {
          posRef.current = { ...posRef.current, x: wp.x, y: wp.y };
          routeRef.current = routeRef.current.slice(1);
          if (routeRef.current.length === 0) {
            travelTargetRef.current = null;
            lastTravelTargetRef.current = null;
            onArrivedRef.current?.();
          }
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

        const isMoving = manualInput || routeRef.current.length > 0;
        floatTRef.current += isMoving ? 0.14 : 0.04;
        const baseY = model.userData.baseY ?? 0;

        model.position.x = wx;
        model.position.y =
          baseY + Math.abs(Math.sin(floatTRef.current)) * (isMoving ? 0.16 : 0.04);
        model.position.z = wz;

        if (isMoving && now - lastSplashTime > 220) {
          lastSplashTime = now;
          spawnRipple(wx, wz, 0.7);
          if (Math.sin(floatTRef.current) > 0.85) spawnSplash(wx, wz);
        }

        collectCoinsNear(wx, wz);

        // sample the frog's own trail every few frames; each collected
        // tadpole locks onto one of the older samples, so the line grows
        // longer the more coins you've picked up
        trailFrameRef.current += 1;
        if (trailFrameRef.current % TRAIL_SAMPLE_INTERVAL === 0) {
          trailHistoryRef.current.push({ x: wx, z: wz, ry: model.rotation.y });
          const maxLen = TRAIL_GAP * (tadpolesRef.current.length + 1) + 4;
          if (trailHistoryRef.current.length > maxLen) {
            trailHistoryRef.current.shift();
          }
        }
        tadpolesRef.current.forEach((tad, i) => {
          const histIndex =
            trailHistoryRef.current.length - 1 - TRAIL_GAP * (i + 1);
          const sample =
            trailHistoryRef.current[Math.max(0, histIndex)] ||
            trailHistoryRef.current[0];
          if (!sample) return;
          const bob = Math.sin(t * 2.4 + tad.group.userData.bobSeed) * 0.05;
          tad.group.position.x += (sample.x - tad.group.position.x) * 0.35;
          tad.group.position.z += (sample.z - tad.group.position.z) * 0.35;
          tad.group.position.y = tad.group.userData.baseY + bob;
          tad.group.rotation.y += (sample.ry - tad.group.rotation.y) * 0.2;
        });

        if (isMoving) idleTimeRef.current = 0;
        else idleTimeRef.current += 1 / 60;
        const showZzz = idleTimeRef.current > 60;
        zzzSprites.forEach((s, i) => {
          const cycle = 2.2;
          const localT = ((t + i * 0.7) % cycle) / cycle;
          s.position.set(
            wx + 0.35 + Math.sin(t * 1.4 + i) * 0.05,
            baseY + 1.1 + localT * 0.9,
            wz - 0.15,
          );
          const fadeIn = Math.min(localT / 0.15, 1);
          const fadeOut = Math.min((1 - localT) / 0.25, 1);
          const targetOpacity = showZzz ? Math.min(fadeIn, fadeOut) * 0.9 : 0;
          s.material.opacity += (targetOpacity - s.material.opacity) * 0.15;
          const scale = 0.22 + localT * 0.18 + i * 0.02;
          s.scale.set(scale, scale, 1);
        });

        camera.position.x += (wx - camera.position.x) * 0.1;
        camera.position.z += (wz + 11 - camera.position.z) * 0.1;
        camera.position.y = 13;
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

      // ai-agent companion follow (identical behavior to the grass plaza)
      const agent = agentRef.current;
      if (agent && model) {
        agentFloatTRef.current += 0.045;
        const trailAngle = model.rotation.y + Math.PI * 0.78;
        const targetX =
          model.position.x + Math.sin(trailAngle) * AGENT_FOLLOW_DISTANCE;
        const targetZ =
          model.position.z + Math.cos(trailAngle) * AGENT_FOLLOW_DISTANCE;

        agent.position.x += (targetX - agent.position.x) * AGENT_FOLLOW_LERP;
        agent.position.z += (targetZ - agent.position.z) * AGENT_FOLLOW_LERP;

        const agentBaseY = agent.userData.baseY ?? 0.3;
        agent.position.y =
          (model.userData.baseY ?? 0) +
          AGENT_HOVER_HEIGHT +
          agentBaseY +
          Math.sin(agentFloatTRef.current * 1.6) * 0.09;
        if (agent.userData.glow) {
          agent.userData.glow.material.opacity =
            0.32 + Math.sin(agentFloatTRef.current) * 0.15;
        }

        const reportPos = onAgentScreenPositionChangeRef.current;
        if (reportPos && mountRef.current) {
          const worldPos = new THREE.Vector3();
          agent.getWorldPosition(worldPos);
          worldPos.y += agentBaseY;
          const ndc = worldPos.project(camera);
          const mnt = mountRef.current;
          reportPos({
            x: (ndc.x * 0.5 + 0.5) * mnt.clientWidth,
            y: (-ndc.y * 0.5 + 0.5) * mnt.clientHeight,
            visible: ndc.z < 1,
          });
        }
      }

      // remote party members, also confined to the lily-pad lattice
      if (otherPlayersRef) {
        otherModelsRef.current.forEach((entry, id) => {
          const player = otherPlayersRef.current.get(id);
          if (!player) return;

          entry.smoothX += (player.x - entry.smoothX) * 0.15;
          entry.smoothY += (player.y - entry.smoothY) * 0.15;
          const wx = normToWorld(entry.smoothX);
          const wz = normToWorld(entry.smoothY);

          entry.floatT += 0.08;
          const baseY = entry.pivot.userData.baseY ?? 0;

          const dx = wx - entry.pivot.position.x;
          const dz = wz - entry.pivot.position.z;
          if (Math.abs(dx) > 0.0008 || Math.abs(dz) > 0.0008) {
            const targetAngle = Math.atan2(dx, dz);
            let delta = targetAngle - entry.pivot.rotation.y;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            entry.pivot.rotation.y += delta * 0.18;
          }

          entry.pivot.position.x = wx;
          entry.pivot.position.y = baseY + Math.sin(entry.floatT) * 0.08;
          entry.pivot.position.z = wz;

          if (entry.msgSprite) {
            const ALERT_TTL = 6000;
            const alertAt = messageAlertsRef?.current?.get(id);
            const age = alertAt ? now - alertAt : Infinity;
            const active = age < ALERT_TTL;
            const targetOpacity = active ? 0.95 : 0;
            entry.msgSprite.material.opacity +=
              (targetOpacity - entry.msgSprite.material.opacity) * 0.15;
            if (active) {
              entry.msgBubbleT += 0.12;
              const bob = Math.sin(entry.msgBubbleT) * 0.08;
              const pulse = 1 + Math.sin(entry.msgBubbleT * 1.6) * 0.08;
              entry.msgSprite.position.y = baseY + 1.35 + bob;
              entry.msgSprite.scale.set(0.55 * pulse, 0.55 * pulse, 1);
            }
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
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      waterTex.dispose();
      waterMesh.geometry.dispose();
      waterMat.dispose();
      deepMesh.geometry.dispose();
      deepMat.dispose();
      decorPads.forEach((pad) => {
        scene.remove(pad);
        pad.geometry.dispose();
        pad.material.dispose();
      });
      reeds.forEach((r) => scene.remove(r));
      skyTex.dispose();
      splashTex.dispose();
      rippleGeo.dispose();
      zzzTex.dispose();
      zzzSprites.forEach((s) => {
        scene.remove(s);
        s.material.dispose();
      });
      ripples.forEach((rp) => {
        scene.remove(rp.mesh);
        rp.mesh.material.dispose();
      });
      droplets.forEach((d) => {
        scene.remove(d.mesh);
        d.mesh.material.dispose();
      });
      coinsRef.current.forEach((c) => {
        scene.remove(c.group);
        c.group.traverse((child) => {
          child.geometry?.dispose?.();
          child.material?.dispose?.();
        });
      });
      coinsRef.current = [];
      tadpolesRef.current.forEach((tp) => {
        scene.remove(tp.group);
        tp.group.traverse((child) => {
          child.geometry?.dispose?.();
          child.material?.dispose?.();
        });
      });
      tadpolesRef.current = [];
      otherModelsRef.current.forEach((entry) => {
        scene.remove(entry.pivot);
        disposePivot(entry.pivot);
      });
      otherModelsRef.current.clear();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // ai-agent companion — matches whichever avatar the player is wearing,
  // reloads if they change avatars
  useEffect(() => {
    if (!sceneRef.current || !avatarId) return;
    let cancelled = false;
    const agentLoader = new GLTFLoader();

    if (agentRef.current) {
      sceneRef.current.remove(agentRef.current);
      disposePivot(agentRef.current);
      agentRef.current = null;
    }

    agentLoader.load(
      agentModelFor(avatarId),
      (gltf) => {
        if (cancelled || !sceneRef.current) return;
        const pivot = buildAgentPivot(gltf.scene);
        if (modelRef.current) pivot.position.copy(modelRef.current.position);
        sceneRef.current.add(pivot);
        agentRef.current = pivot;
      },
      undefined,
      (err) => console.error(`ai-agent load error for ${avatarId}:`, err),
    );

    return () => {
      cancelled = true;
      if (agentRef.current && sceneRef.current) {
        sceneRef.current.remove(agentRef.current);
        disposePivot(agentRef.current);
      }
      agentRef.current = null;
    };
  }, [avatarId]);

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
        const pivot = buildAvatarPivot(gltf, cfg);
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

  // remote party members
  useEffect(() => {
    if (!sceneRef.current || !otherPlayersRef) return;
    const scene = sceneRef.current;
    const players = otherPlayersRef.current;
    const models = otherModelsRef.current;

    for (const [id, entry] of models) {
      if (!players.has(id)) {
        scene.remove(entry.pivot);
        disposePivot(entry.pivot);
        models.delete(id);
      }
    }

    for (const [id, player] of players) {
      if (models.has(id)) continue;
      const cfg = AVATAR_CONFIG[player.avatarId] || { scale: 1.2, offsetX: 0 };
      loaderRef.current.load(
        `/assets/models/${player.avatarId}.glb`,
        (gltf) => {
          if (!sceneRef.current || !otherPlayersRef.current.has(id)) return;
          const pivot = buildAvatarPivot(gltf, cfg);
          const wx = normToWorld(player.x);
          const wz = normToWorld(player.y);
          pivot.position.set(wx, pivot.userData.baseY ?? 0, wz);
          scene.add(pivot);

          const msgSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: buildMessageBubbleTexture(),
              transparent: true,
              opacity: 0,
              depthWrite: false,
            }),
          );
          msgSprite.scale.set(0.55, 0.55, 1);
          msgSprite.position.set(0, (pivot.userData.baseY ?? 0) + 1.35, 0);
          pivot.add(msgSprite);

          models.set(id, {
            pivot,
            floatT: Math.random() * Math.PI * 2,
            smoothX: player.x,
            smoothY: player.y,
            msgSprite,
            msgBubbleT: 0,
          });
        },
        undefined,
        (err) => console.error("remote avatar load error:", err),
      );
    }
  }, [playersVersion]);

  return <div ref={mountRef} className="plaza-canvas-mount" />;
}

export default React.memo(FrogLandCanvas);
