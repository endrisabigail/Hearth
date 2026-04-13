import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import QuestNodes from "../components/questNodes.jsx";
import MessageModal from "../components/messageModal.jsx";
import "../pages/styles/dashboard.css";
import "../pages/styles/questModal.css";
import "../pages/styles/messageModal.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const AVATAR_MAP = {
  tomato: "🍅",
  frog: "🐸",
  fish: "🐟",
  mushroom: "🍄",
  apple: "🍎",
  snail: "🐌",
};

const AVATAR_CONFIG = {
  tomato: { scale: 1.2, offsetX: 0 },
  frog: { scale: 1.2, offsetX: 0 },
  fish: { scale: 1.2, offsetX: 0.05 },
  mushroom: { scale: 1.2, offsetX: 0 },
  apple: { scale: 1.2, offsetX: 0 },
  snail: { scale: 1.2, offsetX: 0 },
};

const DEFAULT_BOUNDS = { minX: 0.05, maxX: 0.95, minY: 0.05, maxY: 0.95 };
const MOVE_SPEED = 0.008;
const SAVE_DEBOUNCE = 1500;
const PANELS = ["members", "mail", "focus"];
const GROUND_SCALE = 120;
const COLLISION_PADDING = 0.3;

// status badge background is data-driven so kept as a lookup used inline
const STATUS_COLOR = {
  "Not Started": "#f5a623",
  "In Progress": "#2196f3",
  Completed: "#4caf50",
};

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed"];
const CATEGORY_OPTIONS = [
  "general",
  "fitness",
  "study",
  "chores",
  "creative",
  "social",
  "other",
];

function collidesWithAny(nx, ny, boxes) {
  return boxes.some(
    (b) =>
      nx > b.cx - b.hw &&
      nx < b.cx + b.hw &&
      ny > b.cy - b.hh &&
      ny < b.cy + b.hh,
  );
}

function worldBoxToNorm(box, padding) {
  return {
    cx: (box.min.x + box.max.x) / 2 / 4.0 + 0.5,
    cy: (box.min.z + box.max.z) / 2 / 3.0 + 0.5,
    hw: (box.max.x - box.min.x) / 2 / 4.0 + padding / 4.0,
    hh: (box.max.z - box.min.z) / 2 / 3.0 + padding / 3.0,
  };
}

function FieldGroup({ label, children }) {
  return (
    <div className="qm-field">
      <label className="qm-label">{label}</label>
      {children}
    </div>
  );
}

function QuestModal({
  quest,
  isOwner,
  partyMembers,
  api,
  onClose,
  onQuestUpdated,
  onQuestCreated,
  onQuestDeleted,
  customCategories = [],
  onSaveCategory,
  onDeleteCategory,
}) {
  const isNew = !quest;
  const isLocked = !quest && !isOwner;

  const [form, setForm] = useState({
    title: quest?.title || "",
    description: quest?.description || "",
    dueDate: quest?.dueDate
      ? new Date(quest.dueDate).toISOString().split("T")[0]
      : "",
    category: quest?.category || "general",
    points: quest?.points || 5,
    status: quest?.status || "Not Started",
    assignedTo: quest?.assignedTo?._id || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSaveStatus = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.put(`/quests/${quest._id}/status`, {
        status: form.status,
      });
      onQuestUpdated(res.data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.msg || "failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/quests", {
        title: form.title,
        description: form.description,
        dueDate: form.dueDate,
        category: form.category,
        assignedTo: form.assignedTo || null,
      });
      onQuestCreated(res.data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.msg || "failed to create quest.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`delete quest "${quest.title}"?`)) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/quests/${quest._id}`);
      onQuestDeleted(quest._id);
      onClose();
    } catch (e) {
      setError(e.response?.data?.msg || "failed to delete quest.");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setError("");
    try {
      await api.post("/quests/complete", { questId: quest._id });
      onQuestUpdated({ ...quest, status: "Completed" });
      onClose();
    } catch (e) {
      setError(e.response?.data?.msg || "failed to complete quest.");
    } finally {
      setSaving(false);
    }
  };
  const [navModalOpen, setNavModalOpen] = useState(false);

  return (
    <div className="qm-overlay" onClick={onClose}>
      <div className="qm-card" onClick={(e) => e.stopPropagation()}>
        <button className="qm-close" onClick={onClose}>
          ✕
        </button>

        {isLocked && (
          <div className="qm-locked">
            <div className="qm-locked-icon">🔒</div>
            <h2>quest locked</h2>
            <p>this quest slot hasn't been filled yet.</p>
          </div>
        )}

        {isNew && isOwner && (
          <>
            <h2 className="qm-create-title">✦ create new quest</h2>

            <FieldGroup label="title">
              <input
                className="qm-input"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="quest title..."
              />
            </FieldGroup>

            <FieldGroup label="description">
              <textarea
                className="qm-textarea"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="what needs to be done?"
              />
            </FieldGroup>

            <FieldGroup label="due date">
              <input
                type="date"
                className="qm-input"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </FieldGroup>

            <FieldGroup label="category">
              <select
                className="qm-select"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {[...CATEGORY_OPTIONS, ...customCategories].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="qm-custom-cat-row">
                <input
                  className="qm-input qm-input--sm"
                  placeholder="+ new category"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      onSaveCategory?.(e.target.value);
                      set("category", e.target.value.trim().toLowerCase());
                      e.target.value = "";
                    }
                  }}
                />
                {customCategories.length > 0 && (
                  <div className="qm-custom-cat-tags">
                    {customCategories.map((c) => (
                      <span key={c} className="qm-cat-tag">
                        {c}
                        <button onClick={() => onDeleteCategory?.(c)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </FieldGroup>

            <FieldGroup label="assign to">
              <select
                className="qm-select"
                value={form.assignedTo}
                onChange={(e) => set("assignedTo", e.target.value)}
              >
                <option value="">— unassigned —</option>
                {partyMembers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {AVATAR_MAP[m.avatarId] || "🐾"} {m.username}
                  </option>
                ))}
              </select>
            </FieldGroup>

            {error && <p className="qm-error">{error}</p>}

            <button
              className="qm-btn-primary"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? "creating... ✦" : "create quest ✦"}
            </button>
          </>
        )}

        {quest && (
          <>
            <div className="qm-quest-header">
              <span
                className="qm-status-badge"
                style={{ background: STATUS_COLOR[quest.status] || "#aaa" }}
              >
                {quest.status}
              </span>
              <h2 className="qm-quest-title">{quest.title}</h2>
              <p className="qm-quest-meta">
                📁 {quest.category} · ⭐ {quest.points} pts
              </p>
            </div>

            <div className="qm-section-box">
              <label className="qm-label">description</label>
              <p className="qm-section-text">{quest.description}</p>
            </div>

            <div className="qm-two-col">
              <div className="qm-section-box">
                <label className="qm-label">due date</label>
                <p className="qm-section-text">
                  📅{" "}
                  {quest.dueDate
                    ? new Date(quest.dueDate).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              <div className="qm-section-box">
                <label className="qm-label">assigned to</label>
                <p className="qm-section-text">
                  {quest.assignedTo
                    ? `${AVATAR_MAP[quest.assignedTo.avatarId] || "🐾"} ${quest.assignedTo.username}`
                    : "— unassigned"}
                </p>
              </div>
            </div>

            {quest.status !== "Completed" && (
              <div className="qm-section-box">
                <label className="qm-label">update status</label>
                <select
                  className="qm-select qm-select--mb"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  className="qm-btn-secondary"
                  onClick={handleSaveStatus}
                  disabled={saving}
                >
                  {saving ? "saving..." : "save status"}
                </button>
              </div>
            )}

            {quest.status !== "Completed" && (
              <button
                className="qm-btn-primary qm-btn-primary--complete"
                onClick={handleComplete}
                disabled={saving}
              >
                {saving ? "..." : "⚔️ mark complete & claim points"}
              </button>
            )}

            {quest.status === "Completed" && (
              <div className="qm-completed-msg">
                ✓ quest completed!
                {quest.completedBy && (
                  <span className="qm-completed-by">
                    by {quest.completedBy.username || "a party member"}
                  </span>
                )}
              </div>
            )}

            {isOwner && (
              <button
                className="qm-btn-delete"
                onClick={handleDelete}
                disabled={saving}
              >
                🗑 delete quest
              </button>
            )}

            {error && <p className="qm-error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// PlazaCanvas

function PlazaCanvas({
  avatarId,
  posRef,
  keysRef,
  collisionBoxesRef,
  onSceneReady,
  hasActiveQuest,
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
  useEffect(() => {
    hasActiveQuestRef.current = hasActiveQuest;
  }, [hasActiveQuest]);

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

    // lighting
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

    // ground
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

    // grass patches
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
      (err) => console.warn("grass load skipped (no asset yet):", err),
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
      if (model) {
        const isMoving =
          keysRef.current.ArrowUp ||
          keysRef.current.ArrowDown ||
          keysRef.current.ArrowLeft ||
          keysRef.current.ArrowRight;

        floatTRef.current += isMoving ? 0.12 : 0.04;
        const floatAmp = isMoving ? 0.12 : 0.06;
        const baseY = model.userData.baseY ?? 0;
        model.position.y = baseY + Math.sin(floatTRef.current) * floatAmp;
        model.position.x =
          ((posRef.current._smoothX ?? posRef.current.x) - 0.5) * 4.0;
        model.position.z =
          ((posRef.current._smoothY ?? posRef.current.y) - 0.5) * 3.0;

        const k = keysRef.current;
        if (k.ArrowLeft || k.ArrowRight || k.ArrowUp || k.ArrowDown) {
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
            const target = active
              ? 0.4 + Math.sin(floatTRef.current * 2) * 0.25
              : 0;
            child.material.opacity += (target - child.material.opacity) * 0.08;
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

// Dashboard
function Dashboard() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [party, setParty] = useState(null);
  const [quests, setQuests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("map");
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuest, setModalQuest] = useState(null);
  const [msgModalOpen, setMsgModalOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hearth_categories") || "[]");
    } catch {
      return [];
    }
  });

  const saveCategory = (cat) => {
    const trimmed = cat.trim().toLowerCase();
    if (!trimmed) return;
    setCustomCategories((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      localStorage.setItem("hearth_categories", JSON.stringify(next));
      return next;
    });
  };

  const deleteCategory = (cat) => {
    setCustomCategories((prev) => {
      const next = prev.filter((c) => c !== cat);
      localStorage.setItem("hearth_categories", JSON.stringify(next));
      return next;
    });
  };

  const [threeCtx, setThreeCtx] = useState({
    scene: null,
    camera: null,
    renderer: null,
  });
  const [openPanels, setOpenPanels] = useState({
    members: true,
    mail: true,
    focus: true,
  });

  const posRef = useRef({ x: 0.5, y: 0.5 });
  const keysRef = useRef({});
  const saveTimer = useRef(null);
  const mapAreaRef = useRef(null);
  const collisionBoxesRef = useRef([]);

  const token = localStorage.getItem("token");
  const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: { "x-auth-token": token },
  });

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    const pendingInvite = localStorage.getItem("pendingInvite");
    if (pendingInvite) {
      localStorage.removeItem("pendingInvite");
      api.post(`/party/join/${pendingInvite}`).finally(() => fetchAll());
    } else {
      fetchAll();
    }
  }, []);

  const fetchAll = async () => {
    try {
      const [dashRes, partyRes] = await Promise.all([
        api.get("/dashboard"),
        api.get("/party").catch(() => null),
      ]);
      const user = dashRes.data.user;
      setUserData(user);
      setQuests(dashRes.data.quests);
      setNotifications(dashRes.data.notifications);
      if (user.plazaPosition) {
        posRef.current = {
          x: user.plazaPosition.x ?? 0.5,
          y: user.plazaPosition.y ?? 0.5,
        };
      }
      if (partyRes) setParty(partyRes.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const { x, y } = posRef.current;
        await api.patch("/dashboard/position", { x, y });
      } catch (err) {
        console.error("position save failed:", err);
      }
    }, SAVE_DEBOUNCE);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        keysRef.current[e.key] = true;
      }
    };
    const onKeyUp = (e) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let frameId;
    let lastTime = performance.now();
    const smoothPos = { x: posRef.current.x, y: posRef.current.y };

    const tick = () => {
      frameId = requestAnimationFrame(tick);

      const now = performance.now();
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;

      const k = keysRef.current;
      let moved = false;
      let { x, y } = posRef.current;
      let nx = x,
        ny = y;
      const speed = MOVE_SPEED * dt;

      if (k.ArrowLeft) {
        nx -= speed;
        moved = true;
      }
      if (k.ArrowRight) {
        nx += speed;
        moved = true;
      }
      if (k.ArrowUp) {
        ny -= speed;
        moved = true;
      }
      if (k.ArrowDown) {
        ny += speed;
        moved = true;
      }

      if (moved) {
        const b = posRef.current.bounds || DEFAULT_BOUNDS;
        const boxes = collisionBoxesRef.current;
        nx = Math.max(b.minX, Math.min(b.maxX, nx));
        ny = Math.max(b.minY, Math.min(b.maxY, ny));

        if (collidesWithAny(nx, ny, boxes)) {
          const blockedX = collidesWithAny(nx, y, boxes);
          const blockedY = collidesWithAny(x, ny, boxes);
          if (!blockedX) ny = y;
          else if (!blockedY) nx = x;
          else {
            nx = x;
            ny = y;
          }
        }

        posRef.current = { ...posRef.current, x: nx, y: ny };
        scheduleSave();
      }

      // framerate-independent lerp for smooth gliding
      const lerpFactor = 1 - Math.pow(0.01, dt / 1000);
      smoothPos.x += (posRef.current.x - smoothPos.x) * lerpFactor;
      smoothPos.y += (posRef.current.y - smoothPos.y) * lerpFactor;
      posRef.current._smoothX = smoothPos.x;
      posRef.current._smoothY = smoothPos.y;
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const togglePanel = (panel) =>
    setOpenPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));

  const copyInviteLink = () => {
    if (!party?.inviteCode) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/join/${party.inviteCode}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const markNotificationsRead = async () => {
    try {
      await api.post("/dashboard/notifications/read");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNodeClick = (quest) => {
    setModalQuest(quest);
    setModalOpen(true);
  };
  const handleQuestCreated = (created) =>
    setQuests((prev) => [created, ...prev]);
  const handleQuestDeleted = (id) =>
    setQuests((prev) => prev.filter((q) => q._id !== id));

  const partyMembers = [
    ...(party?.owner ? [party.owner] : []),
    ...(party?.members || []),
  ];

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
        <p>loading your plaza... ✦</p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const minimizedPanels = PANELS.filter((p) => !openPanels[p]);
  const hasTeammates = partyMembers.some(
    (m) => m._id?.toString() !== userData?.id?.toString(),
  );

  const mailIcon = (n) => {
    if (n.type === "quest_complete") return "⚔️";
    if (n.type === "badge_earned") return "🏅";
    if (n.type === "member_joined") return "🏡";
    if (n.type === "quest_assigned") return "📋";
    if (n.type === "streak_milestone") return "🔥";
    if (n.type === "neighbor_request") return "🤝";
    if (n.type === "neighbor_accepted") return "🌿";
    if (n.message?.startsWith("💬")) return "💬";
    return "✉️";
  };

  return (
    <div className="dashboard">
      <div className="scene-bg" ref={mapAreaRef}>
        {userData?.avatarId && (
          <PlazaCanvas
            avatarId={userData.avatarId}
            posRef={posRef}
            keysRef={keysRef}
            collisionBoxesRef={collisionBoxesRef}
            onSceneReady={(scene, camera, renderer) =>
              setThreeCtx({ scene, camera, renderer })
            }
            hasActiveQuest={quests.some(
              (q) =>
                q.status !== "Completed" &&
                q.assignedTo?._id?.toString() === userData?.id?.toString(),
            )}
          />
        )}

        {threeCtx.scene && (
          <QuestNodes
            scene={threeCtx.scene}
            camera={threeCtx.camera}
            renderer={threeCtx.renderer}
            quests={quests}
            onNodeClick={handleNodeClick}
          />
        )}

        <div className="controls-hint">
          <div className="arrow-grid">
            <span />
            <span className="key-chip">↑</span>
            <span />
            <span className="key-chip">←</span>
            <span className="key-chip">↓</span>
            <span className="key-chip">→</span>
          </div>
          <p className="controls-label">move</p>
        </div>
      </div>

      <div className="fireflies fireflies-1" />
      <div className="fireflies fireflies-2" />
      <div className="fireflies fireflies-3" />
      <div className="fireflies fireflies-4" />

      <nav className="navbar">
        {[
          { id: "map", icon: "🗺️", label: "Plaza Map" },
          { id: "board", icon: "📋", label: "Board", path: "/board" },
          { id: "passport", icon: "📖", label: "Passport", path: "/passport" },
          { id: "pocket", icon: "🎒", label: "Pocket", path: "/pocket" },
          { id: "settings", icon: "⚙️", label: "Settings" },
        ].map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeNav === item.id ? "active" : ""}`}
            onClick={() => {
              setActiveNav(item.id);
              if (item.id === "settings") {
                setNavModalOpen(true);
              } else if (item.path) {
                navigate(item.path);
              }
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </div>
        ))}
      </nav>

      {/* left column */}
      <div className="left-col">
        {openPanels.members && (
          <div className="panel members-panel">
            <div className="panel-header">
              <span className="panel-title">{party?.name || "my hearth"}</span>
              <button
                className="panel-close"
                onClick={() => togglePanel("members")}
              >
                ✕
              </button>
            </div>
            <div className="member-list">
              {party?.owner && (
                <div className="member-row owner-row">
                  <div className="member-avatar">
                    {AVATAR_MAP[party.owner.avatarId] || "🐾"}
                  </div>
                  <div className="member-info">
                    <p className="member-name">
                      {party.owner.username}
                      <span className="lead-badge"> 👑 lead</span>
                    </p>
                    <p className="member-status">{party.owner.rank}</p>
                  </div>
                  <div className="member-streak">
                    🔥 {party.owner.streak?.current || 0}
                  </div>
                </div>
              )}
              {party?.members?.length > 0 ? (
                party.members.map((member) => (
                  <div key={member._id} className="member-row">
                    <div className="member-avatar">
                      {AVATAR_MAP[member.avatarId] || "🐾"}
                    </div>
                    <div className="member-info">
                      <p className="member-name">{member.username}</p>
                      <p className="member-status">{member.rank}</p>
                    </div>
                    <div className="member-streak">
                      🔥 {member.streak?.current || 0}
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-msg">no members yet! share your link ✦</p>
              )}
            </div>
            {userData?.isPartyOwner && party?.inviteCode && (
              <div className="invite-section">
                <p className="invite-label">invite link</p>
                <button className="invite-btn" onClick={copyInviteLink}>
                  {copied ? "✓ copied!" : "🔗 copy invite link"}
                </button>
              </div>
            )}
          </div>
        )}

        {openPanels.mail && (
          <div className="panel mail-panel">
            <div className="panel-header">
              <span className="panel-title">
                📬 mail
                {unreadCount > 0 && (
                  <span className="unread-badge">{unreadCount}</span>
                )}
              </span>
              <div className="panel-header-actions">
                {hasTeammates && (
                  <button
                    className="compose-btn"
                    onClick={() => setMsgModalOpen(true)}
                  >
                    ✉️ compose
                  </button>
                )}
                {unreadCount > 0 && (
                  <button
                    className="read-all-btn"
                    onClick={markNotificationsRead}
                  >
                    mark read
                  </button>
                )}
                <button
                  className="panel-close"
                  onClick={() => togglePanel("mail")}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="mail-list">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n._id}
                    className={`mail-row ${n.read ? "read" : "unread"}`}
                  >
                    <span className="mail-icon">{mailIcon(n)}</span>
                    <div className="mail-content">
                      <p className="mail-message">{n.message}</p>
                      <p className="mail-time">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!n.read && <div className="unread-dot" />}
                  </div>
                ))
              ) : (
                <p className="empty-msg">no mail yet! 📭</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* right column */}
      <div className="right-col">
        {openPanels.focus && (
          <div className="panel focus-panel">
            <div className="panel-header">
              <span className="panel-title">focus of the day</span>
              <button
                className="panel-close"
                onClick={() => togglePanel("focus")}
              >
                ✕
              </button>
            </div>
            {quests.length > 0 ? (
              <>
                <p className="focus-goal-label">active quest</p>
                <p className="focus-task">{quests[0].title}</p>
                <p className="focus-desc">{quests[0].description}</p>
                {quests[0].assignedTo && (
                  <p className="focus-assigned">
                    {AVATAR_MAP[quests[0].assignedTo.avatarId]}{" "}
                    {quests[0].assignedTo.username}
                  </p>
                )}
              </>
            ) : (
              <p className="empty-msg">
                {userData?.isPartyOwner
                  ? "no quests yet! add a quest node to get started 🪡"
                  : "no active quests! wait for your lead to get started! "}
              </p>
            )}
            <div className="streak-section">
              <div className="streak-label">🔥 weekly streak</div>
              <div className="streak-bar-bg">
                <div
                  className="streak-bar-fill"
                  style={{
                    width: `${Math.min(((userData?.streak?.current || 0) / 7) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="streak-days">
                {userData?.streak?.current || 0} day
                {userData?.streak?.current !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* minimised footer pills */}
      {minimizedPanels.length > 0 && (
        <div className="hud-footer">
          {minimizedPanels.map((panel) => (
            <button
              key={panel}
              className="footer-pill"
              onClick={() => togglePanel(panel)}
            >
              {panel === "members"
                ? "👥 members"
                : panel === "mail"
                  ? `📬 mail${unreadCount > 0 ? ` (${unreadCount})` : ""}`
                  : "🎯 focus"}
            </button>
          ))}
        </div>
      )}

      {/* modals */}
      {modalOpen && (
        <QuestModal
          quest={modalQuest}
          isOwner={userData?.isPartyOwner}
          partyMembers={partyMembers}
          api={api}
          onClose={() => setModalOpen(false)}
          onQuestUpdated={handleQuestUpdated}
          onQuestCreated={handleQuestCreated}
          onQuestDeleted={handleQuestDeleted}
          customCategories={customCategories}
          onSaveCategory={saveCategory}
          onDeleteCategory={deleteCategory}
        />
      )}

      {userData?.isPartyOwner && (
        <button
          className="floating-add-btn"
          onClick={() => {
            setModalQuest(null);
            setModalOpen(true);
          }}
          title="add quest"
        >
          🪡
        </button>
      )}

      {msgModalOpen && (
        <MessageModal
          partyMembers={partyMembers}
          currentUserId={userData?.id}
          api={api}
          onClose={() => setMsgModalOpen(false)}
          onSent={() => setNotifications((prev) => prev)}
        />
      )}
    </div>
  );
}

export default Dashboard;
