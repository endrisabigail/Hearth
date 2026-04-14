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

const GROUND_SCALE = 120;
const COLLISION_PADDING = 0.3;
const TRAVEL_SPEED = 0.006;
const ARRIVAL_THRESHOLD = 0.018;

function worldBoxToNorm(box, padding) {
  return {
    cx: (box.min.x + box.max.x) / 2 / 4.0 + 0.5,
    cy: (box.min.z + box.max.z) / 2 / 3.0 + 0.5,
    hw: (box.max.x - box.min.x) / 2 / 4.0 + padding / 4.0,
    hh: (box.max.z - box.min.z) / 2 / 3.0 + padding / 3.0,
  };
}

const TREE_PLACEMENTS = [
  { x: -24.0, z: -18.0, ry: 0.0 },
  { x: -20.0, z: -19.5, ry: 1.1 },
  { x: -16.0, z: -18.5, ry: 2.3 },
  { x: -12.0, z: -19.0, ry: 0.7 },
  { x: -8.0, z: -18.5, ry: 1.9 },
  { x: -4.0, z: -19.0, ry: 3.1 },
  { x: 0.0, z: -18.0, ry: 0.4 },
  { x: 4.0, z: -19.5, ry: 2.8 },
  { x: 8.0, z: -18.5, ry: 1.5 },
  { x: 12.0, z: -19.0, ry: 0.9 },
  { x: 16.0, z: -18.5, ry: 3.3 },
  { x: 20.0, z: -19.0, ry: 1.7 },
  { x: 24.0, z: -18.0, ry: 4.1 },
  { x: -24.0, z: 18.0, ry: 3.2 },
  { x: -20.0, z: 19.5, ry: 0.9 },
  { x: -16.0, z: 18.5, ry: 4.1 },
  { x: -12.0, z: 19.0, ry: 2.5 },
  { x: -8.0, z: 18.5, ry: 5.0 },
  { x: -4.0, z: 19.0, ry: 1.3 },
  { x: 0.0, z: 18.0, ry: 3.7 },
  { x: 4.0, z: 19.5, ry: 0.6 },
  { x: 8.0, z: 18.5, ry: 2.2 },
  { x: 12.0, z: 19.0, ry: 4.8 },
  { x: 16.0, z: 18.5, ry: 1.0 },
  { x: 20.0, z: 19.0, ry: 3.5 },
  { x: 24.0, z: 18.0, ry: 5.3 },
  { x: -24.0, z: -14.0, ry: 1.0 },
  { x: -23.0, z: -10.0, ry: 2.4 },
  { x: -24.0, z: -6.0, ry: 0.3 },
  { x: -23.0, z: -2.0, ry: 3.5 },
  { x: -24.0, z: 2.0, ry: 1.8 },
  { x: -23.0, z: 6.0, ry: 4.2 },
  { x: -24.0, z: 10.0, ry: 0.7 },
  { x: -23.0, z: 14.0, ry: 2.9 },
  { x: 24.0, z: -14.0, ry: 4.2 },
  { x: 23.0, z: -10.0, ry: 0.8 },
  { x: 24.0, z: -6.0, ry: 2.9 },
  { x: 23.0, z: -2.0, ry: 1.6 },
  { x: 24.0, z: 2.0, ry: 5.1 },
  { x: 23.0, z: 6.0, ry: 0.3 },
  { x: 24.0, z: 10.0, ry: 3.4 },
  { x: 23.0, z: 14.0, ry: 1.9 },
  { x: -23.0, z: -17.0, ry: 0.5 },
  { x: -21.0, z: -18.5, ry: 1.7 },
  { x: 23.0, z: -17.0, ry: 3.3 },
  { x: 21.0, z: -18.5, ry: 0.2 },
  { x: -23.0, z: 17.0, ry: 2.0 },
  { x: -21.0, z: 18.5, ry: 4.4 },
  { x: 23.0, z: 17.0, ry: 1.2 },
  { x: 21.0, z: 18.5, ry: 3.8 },
  { x: -14.0, z: -8.0, ry: 0.6 },
  { x: 14.0, z: -8.0, ry: 2.7 },
  { x: -14.0, z: 8.0, ry: 4.9 },
  { x: 14.0, z: 8.0, ry: 1.4 },
  { x: -8.0, z: -4.0, ry: 3.2 },
  { x: 8.0, z: 4.0, ry: 0.8 },
  { x: -6.0, z: 10.0, ry: 2.1 },
  { x: 6.0, z: -10.0, ry: 4.6 },
];

const GRASS_PLACEMENTS = [
  { x: -5.5, z: -2.5, sc: 1.1 },
  { x: -4.8, z: 0.8, sc: 0.8 },
  { x: -3.2, z: -4.2, sc: 0.9 },
  { x: -2.0, z: 4.5, sc: 1.0 },
  { x: -0.6, z: -5.2, sc: 1.2 },
  { x: 0.8, z: 4.8, sc: 0.85 },
  { x: 2.0, z: -4.5, sc: 1.0 },
  { x: 3.2, z: 1.6, sc: 0.7 },
  { x: 4.0, z: -2.8, sc: 1.15 },
  { x: 5.0, z: 2.2, sc: 0.9 },
  { x: 5.5, z: -0.5, sc: 1.0 },
  { x: -1.5, z: 1.8, sc: 0.75 },
  { x: 0.8, z: -2.2, sc: 0.8 },
  { x: -3.8, z: 2.8, sc: 1.1 },
  { x: 3.5, z: 3.8, sc: 0.9 },
  { x: -2.5, z: -0.8, sc: 0.65 },
  { x: 1.8, z: 0.5, sc: 0.7 },
  { x: -6.0, z: 1.5, sc: 1.0 },
  { x: 6.0, z: 3.2, sc: 0.85 },
  { x: 0.3, z: 5.2, sc: 1.2 },
  { x: -3.5, z: -5.0, sc: 0.9 },
  { x: 4.2, z: -4.0, sc: 1.05 },
  { x: -0.2, z: 0.3, sc: 0.6 },
  { x: -14.0, z: -8.0, sc: 0.9 },
  { x: 14.0, z: -8.0, sc: 0.9 },
  { x: -14.0, z: 8.0, sc: 0.9 },
  { x: 14.0, z: 8.0, sc: 0.9 },
  { x: -8.0, z: -4.0, sc: 0.9 },
  { x: 8.0, z: 4.0, sc: 0.9 },
  { x: -6.0, z: 10.0, sc: 0.9 },
  { x: 6.0, z: -10.0, sc: 0.9 },
];

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

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 12, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x87ceeb, 1);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

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

    const glbLoader = new GLTFLoader();

    glbLoader.load(
      "/assets/models/ground.glb",
      (gltf) => {
        const ground = gltf.scene;
        const box = new THREE.Box3().setFromObject(ground);
        const size = box.getSize(new THREE.Vector3());
        const scale = GROUND_SCALE / size.x;
        ground.scale.setScalar(scale);
        const center = box.getCenter(new THREE.Vector3());
        ground.position.sub(center.multiplyScalar(scale));
        ground.position.y = -2;
        scene.add(ground);
        const groundBox = new THREE.Box3().setFromObject(ground);
        posRef.current.bounds = {
          minX: groundBox.min.x / 4.0 + 0.5,
          maxX: groundBox.max.x / 4.0 + 0.5,
          minY: groundBox.min.z / 3.0 + 0.5,
          maxY: groundBox.max.z / 3.0 + 0.5,
        };
      },
      undefined,
      (err) => console.error("ground load error:", err),
    );

    glbLoader.load(
      "/assets/models/tree.glb",
      (gltf) => {
        const template = gltf.scene;
        const box0 = new THREE.Box3().setFromObject(template);
        const size0 = box0.getSize(new THREE.Vector3());
        const center0 = box0.getCenter(new THREE.Vector3());
        const treeScale = 2.5 / size0.y;
        const fantasyColors = [
          0xe8a0bf, 0xb39ddb, 0x80cbc4, 0xf48fb1, 0xa5d6a7,
        ];

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

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const model = modelRef.current;

      // cancel travel if player presses arrow keys
      const manualInput =
        keysRef.current.ArrowUp ||
        keysRef.current.ArrowDown ||
        keysRef.current.ArrowLeft ||
        keysRef.current.ArrowRight;

      if (manualInput && travelTargetRef) {
        travelTargetRef.current = null;
      }

      const target = travelTargetRef?.current;

      if (target && !manualInput) {
        // auto-travel toward target
        const dx = target.x - posRef.current.x;
        const dy = target.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ARRIVAL_THRESHOLD) {
          posRef.current = { ...posRef.current, x: target.x, y: target.y };
          travelTargetRef.current = null;
          onArrivedRef.current?.();
        } else {
          const nx = posRef.current.x + (dx / dist) * TRAVEL_SPEED;
          const ny = posRef.current.y + (dy / dist) * TRAVEL_SPEED;
          posRef.current = { ...posRef.current, x: nx, y: ny };

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
          ((posRef.current._smoothX ?? posRef.current.x) - 0.5) * 4.0;
        model.position.z =
          ((posRef.current._smoothY ?? posRef.current.y) - 0.5) * 3.0;

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
      renderer.dispose();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
    };
  }, []);

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
