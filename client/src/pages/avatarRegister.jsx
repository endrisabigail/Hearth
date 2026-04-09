import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "../styles/avatarRegister.css";

//stat bar colors
const STAT_COLORS = {
  speed: "#fb923c",
  strength: "#f87171",
  magic: "#a78bfa",
  defense: "#34d399",
};

//nomad sculpted characters !!
const avatars = [
  {
    id: "tomato",
    model: "/assets/models/tomato.glb",
    thumb: "/assets/thumbs/tomato.png",
    label: "The Tomato",
    class: "Forest Keeper",
    stats: { speed: 60, strength: 70, magic: 55, defense: 80 },
  },
  {
    id: "frog",
    model: "/assets/models/frog.glb",
    thumb: "/assets/thumbs/frog.png",
    label: "The Frog",
    class: "Wanderer",
    stats: { speed: 72, strength: 55, magic: 80, defense: 45 },
  },
  {
    id: "fish",
    model: "/assets/models/fish.glb",
    thumb: "/assets/thumbs/fish.png",
    label: "The Fish",
    class: "Depths Diver",
    stats: { speed: 90, strength: 40, magic: 65, defense: 38 },
  },
  {
    id: "duck",
    model: "/assets/models/duck.glb",
    thumb: "/assets/thumbs/duck.png",
    label: "The Duck",
    class: "Trailblazer",
    stats: { speed: 78, strength: 60, magic: 50, defense: 60 },
  },
  {
    id: "mushroom",
    model: "/assets/models/mushroom.glb",
    thumb: "/assets/thumbs/mushroom.png",
    label: "The Mushroom",
    class: "Forest Sage",
    stats: { speed: 35, strength: 45, magic: 95, defense: 70 },
  },
  {
    id: "cat",
    model: "/assets/models/cat.glb",
    thumb: "/assets/thumbs/cat.png",
    label: "The Cat",
    class: "Shadow Walker",
    stats: { speed: 88, strength: 68, magic: 55, defense: 42 },
  },
  {
    id: "apple",
    model: "/assets/models/apple.glb",
    thumb: "/assets/thumbs/apple.png",
    label: "The Apple",
    class: "Harvest Guardian",
    stats: { speed: 50, strength: 75, magic: 60, defense: 80 },
  },
  {
    id: "snail",
    model: "/assets/models/snail.glb",
    thumb: "/assets/thumbs/snail.png",
    label: "The Snail",
    class: "Patient Seeker",
    stats: { speed: 20, strength: 50, magic: 70, defense: 92 },
  },
  {
    id: "turtle",
    model: "/assets/models/turtle.glb",
    thumb: "/assets/thumbs/turtle.png",
    label: "The Turtle",
    class: "Ancient Keeper",
    stats: { speed: 30, strength: 65, magic: 75, defense: 95 },
  },
];

function AvatarRegister() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const navigate = useNavigate();

  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const currentModel = useRef(null);
  const animFrame = useRef(null);
  const loader = useRef(new GLTFLoader());

  const selected = avatars[selectedIndex];

  // three.js setup on mount
  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 1, 4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.8;
    controls.target.set(0, 0.5, 0);
    controlsRef.current = controls;
    // neutral lighting so model colors show true
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(3, 5, 4);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, -2, -3);
    scene.add(rim);

    const animate = () => {
      animFrame.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animFrame.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // swap model on selection change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (currentModel.current) {
      scene.remove(currentModel.current);
      currentModel.current = null;
    }

    loader.current.load(
      selected.model,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 2 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);

        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(scale));
        model.position.y += 0.2;

        scene.add(model);
        currentModel.current = model;
      },
      undefined,
      (err) => console.error("Model load error:", err),
    );
  }, [selectedIndex]);

  const handleSelect = (index) => {
    setIsConfirmed(false);
    setSelectedIndex(index);
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    setTimeout(async () => {
      try {
        await axios.post("http://localhost:5000/api/update-avatar", {
          avatarId: selected.id,
        });
        navigate("/dashboard");
      } catch (err) {
        console.error("Couldn't save avatar selection", err);
        setIsConfirmed(false);
      }
    }, 1500);
  };

  return (
    <div className="avatar-register-container">
      {/* left character grid */}
      <div className="left-panel">
        <p className="panel-label">Who are you?</p>
        <div className="char-grid">
          {avatars.map((avatar, i) => (
            <div
              key={avatar.id}
              className={`char-thumb ${i === selectedIndex ? "active" : ""}`}
              onClick={() => handleSelect(i)}
            >
              <img src={avatar.thumb} alt={avatar.label} />
            </div>
          ))}
        </div>
      </div>

      {/* center Three.js stage */}
      <div className="center-panel">
        <div className="sculpture-stage" ref={mountRef}>
          <div className="stage-blob" />
        </div>
        <div className="shadow-oval" />
        <p className="drag-hint">✦ drag to spin ✦</p>
      </div>

      {/* right info & stats */}
      <div className="right-panel">
        <div>
          <h2 className="char-name">{selected.label}</h2>
          <p className="char-class">{selected.class}</p>
        </div>

        <div className="panel-divider" />

        <div className="stats">
          {Object.entries(selected.stats).map(([stat, val]) => (
            <div className="stat-row" key={stat}>
              <span className="stat-label">{stat}</span>
              <div className="stat-bar-bg">
                <div
                  className="stat-bar-fill"
                  style={{
                    width: `${val}%`,
                    background: STAT_COLORS[stat],
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="panel-divider" />

        <button
          className={`select-btn ${isConfirmed ? "confirmed" : ""}`}
          onClick={handleConfirm}
        >
          {isConfirmed ? "Yay! Let's go! 🌿" : "Pick this one! ✦"}
        </button>
      </div>
    </div>
  );
}

export default AvatarRegister;
