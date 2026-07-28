import { useEffect, useRef } from "react";
import * as THREE from "three";
import { normToWorld as defaultAxisToWorld } from "./plazaCanvas.jsx";

export const NODES_PER_ROW = 5;
export const GRID_START_NY = 0.12; // top of the plaza
export const GRID_ROW_GAP = 0.13;
export const GRID_COL_MARGIN = 0.14;
export const GRID_COL_GAP = (1 - GRID_COL_MARGIN * 2) / (NODES_PER_ROW - 1);
export const GRID_MAX_ROWS = 6;

function generateNodePositions(count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const row = Math.min(Math.floor(i / NODES_PER_ROW), GRID_MAX_ROWS - 1);
    const col = i % NODES_PER_ROW;
    positions.push({
      id: `node-${i + 1}`,
      nx: GRID_COL_MARGIN + col * GRID_COL_GAP,
      ny: GRID_START_NY + row * GRID_ROW_GAP,
    });
  }
  return positions;
}

export const NODE_POSITIONS = generateNodePositions(30);

function normToWorld(nx, ny, axisToWorld) {
  return new THREE.Vector3(axisToWorld(nx), 0, axisToWorld(ny));
}

const CHEST_COLORS = {
  available: { body: 0xc8860a, lid: 0xe09a10, band: 0x8b6914, latch: 0xffd700 },
  inProgress: {
    body: 0x1565c0,
    lid: 0x1976d2,
    band: 0x0d47a1,
    latch: 0x64b5f6,
  },
  completed: { body: 0x2e7d32, lid: 0x388e3c, band: 0x1b5e20, latch: 0xa5d6a7 },
};

function getChestColors(quest) {
  if (!quest) return null;
  if (quest.status === "Completed") return CHEST_COLORS.completed;
  if (quest.status === "In Progress") return CHEST_COLORS.inProgress;
  return CHEST_COLORS.available;
}

export function makeChest(colors) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color: colors.body });
  const lidMat = new THREE.MeshLambertMaterial({ color: colors.lid });
  const bandMat = new THREE.MeshLambertMaterial({ color: colors.band });
  const latchMat = new THREE.MeshLambertMaterial({ color: colors.latch });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), bodyMat);
  body.position.y = 0.15;
  group.add(body);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.37), lidMat);
  lid.position.y = 0.38;
  group.add(lid);

  const arc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.135, 0.37, 12, 1, false, 0, Math.PI),
    lidMat,
  );
  arc.rotation.z = Math.PI;
  arc.position.y = 0.46;
  group.add(arc);

  [-0.12, 0.12].forEach((bx) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.38), bandMat);
    b.position.set(bx, 0.16, 0);
    group.add(b);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.39), bandMat);
    bl.position.set(bx, 0.38, 0);
    group.add(bl);
  });

  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), latchMat);
  latch.position.set(0, 0.3, 0.185);
  group.add(latch);

  if (colors === CHEST_COLORS.available || colors === CHEST_COLORS.completed) {
    const sm = new THREE.MeshBasicMaterial({ color: colors.latch });
    [
      [-0.1, 0.72, 0.05],
      [0.12, 0.8, -0.04],
      [0.0, 0.88, 0.08],
    ].forEach(([x, y, z]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), sm);
      s.position.set(x, y, z);
      group.add(s);
    });
  }

  return group;
}


function makeBeacon(color) {
  const group = new THREE.Group();

  const beamHeight = 7;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.45, beamHeight, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = beamHeight / 2 + 0.2;
  group.add(beam);


  const base = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.45, 24),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.03;
  group.add(base);

  const light = new THREE.PointLight(color, 1.4, 8, 2);
  light.position.y = 1.1;
  group.add(light);

  group.userData.isBeacon = true;
  group.userData.beamMesh = beam;
  group.userData.baseMesh = base;
  group.userData.light = light;
  return group;
}

function makeGlowRing(color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.55, 32),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  return ring;
}

export default function QuestNodes({
  scene,
  camera,
  renderer,
  quests,
  onNodeClick,
  normToWorld: axisToWorldProp,
  // frog land (and other alt habitats) place chests on lily pads rather
  // than freestanding on grass — pass a mesh-builder override to swap
  // the visual without touching the click/proximity/animation logic below.
  buildNodeMesh,
}) {
  const axisToWorld = axisToWorldProp || defaultAxisToWorld;
  const nodesRef = useRef([]);
  const bobRef = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!scene) return;

    nodesRef.current.forEach(({ group }) => scene.remove(group));
    nodesRef.current = [];

    quests.forEach((quest, i) => {
      const node = NODE_POSITIONS[i % NODE_POSITIONS.length];
      const colors = getChestColors(quest);
      if (!colors) return;

      const chest = buildNodeMesh ? buildNodeMesh(quest, node, colors) : makeChest(colors);
      const wp = normToWorld(node.nx, node.ny, axisToWorld);
      chest.position.set(wp.x, wp.y, wp.z);
      chest.userData.baseY = wp.y;
      chest.userData.nodeId = node.id;
      chest.userData.quest = quest;

      if (quest.status === "In Progress") {
        const ring = makeGlowRing(0x64b5f6);
        ring.userData.isGlow = true;
        chest.add(ring);
      }

      // beacon so it's easy to spot and walk to from across the plaza 
      if (quest.status !== "Completed") {
        const beaconColor =
          quest.status === "In Progress" ? 0x64b5f6 : 0xffd700;
        const beacon = makeBeacon(beaconColor);
        chest.add(beacon);
      }

      scene.add(chest);
      nodesRef.current.push({ group: chest, quest, nodeId: node.id, node });
    });

    cancelAnimationFrame(frameRef.current);
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      bobRef.current += 0.025;
      nodesRef.current.forEach(({ group }) => {
        group.position.y =
          group.userData.baseY + Math.sin(bobRef.current) * 0.07;
        group.rotation.y += 0.008;

        group.traverse((child) => {
          if (child.userData.isGlow) {
            child.material.opacity = 0.4 + Math.sin(bobRef.current * 2) * 0.3;
          }
          if (child.userData.isBeacon) {
            const pulse = 0.5 + Math.sin(bobRef.current * 1.5) * 0.5;
            child.userData.beamMesh.material.opacity = 0.22 + pulse * 0.18;
            child.userData.baseMesh.material.opacity = 0.4 + pulse * 0.3;
            child.userData.light.intensity = 1.0 + pulse * 0.7;
          }
        });
      });
    };
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      nodesRef.current.forEach(({ group }) => scene.remove(group));
      nodesRef.current = [];
    };
  }, [scene, quests]);

  useEffect(() => {
    if (!renderer || !camera) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const meshes = [];
      nodesRef.current.forEach(({ group, quest, node }) => {
        group.traverse((child) => {
          if (
            child.isMesh &&
            !child.userData.isGlow &&
            !child.parent?.userData?.isBeacon
          ) {
            child.userData.quest = quest;
            child.userData.node = node;
            meshes.push(child);
          }
        });
      });

      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        onNodeClick(
          hits[0].object.userData.quest,
          hits[0].object.userData.node,
        );
      }
    };

    renderer.domElement.style.pointerEvents = "auto";
    renderer.domElement.addEventListener("click", onClick);
    return () => renderer.domElement.removeEventListener("click", onClick);
  }, [renderer, camera, onNodeClick]);

  return null;
}
