import { useEffect, useRef } from "react";
import * as THREE from "three";

export const NODE_POSITIONS = [
  { id: "node-1", nx: 0.25, ny: 0.3 },
  { id: "node-2", nx: 0.75, ny: 0.28 },
  { id: "node-3", nx: 0.5, ny: 0.55 },
  { id: "node-4", nx: 0.22, ny: 0.72 },
  { id: "node-5", nx: 0.78, ny: 0.7 },
];

function normToWorld(nx, ny) {
  return new THREE.Vector3((nx - 0.5) * 4.0, 0, (ny - 0.5) * 3.0);
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

function makeChest(colors) {
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
}) {
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

      const chest = makeChest(colors);
      const wp = normToWorld(node.nx, node.ny);
      chest.position.set(wp.x, wp.y, wp.z);
      chest.userData.baseY = wp.y;
      chest.userData.nodeId = node.id;
      chest.userData.quest = quest;

      if (quest.status === "In Progress") {
        const ring = makeGlowRing(0x64b5f6);
        ring.userData.isGlow = true;
        chest.add(ring);
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
          if (child.isMesh && !child.userData.isGlow) {
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
