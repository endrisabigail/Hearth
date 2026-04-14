import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "../pages/styles/avatarRegister.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// nomad sculpted characters !!
const avatars = [
  {
    id: "tomato",
    bg: "linear-gradient(180deg, #e74c3c 0%, #f39c12 100%)",
    model: "/assets/models/tomato.glb",
    thumb: "/assets/thumbs/tomato.png",
    label: "Tammy the Tomato ",
    class: "Forest Keeper",
    description:
      "Ketchup's to everything eventually 🍅",
  },
  {
    id: "frog",
    bg: "linear-gradient(180deg, #4a9fd4 0%, #2ecc71 100%)",
    model: "/assets/models/frog.glb",
    thumb: "/assets/thumbs/frog.png",
    label: "Froppy the Frog ",
    class: "Wanderer",
    description:
      "Thrives when jumping between big ideas 𖠊",
  },
  {
    id: "fish",
    bg: "linear-gradient(180deg, #2980b9 0%, #6dd5fa 100%)",
    model: "/assets/models/fish.glb",
    thumb: "/assets/thumbs/fish.png",
    label: "Finn the Fish ",
    class: "Stream Guide",
    description:
      "Plenty of fish in the sea, but none quite like her 𓆝",
    offsetX: 0.2,
  },
  {
    id: "mushroom",
    bg: "linear-gradient(180deg, #a77dc7 0%, #ff0000 100%)",
    model: "/assets/models/mushroom.glb",
    thumb: "/assets/thumbs/mushroom.png",
    label: "Mossy the Mushroom",
    class: "Forest Sage",
    description:
      "Grows best in quiet, focused environments 𓍊",
  },
  {
    id: "apple",
    bg: "linear-gradient(180deg, #ff6b6b 0%, #c0392b 100%)",
    model: "/assets/models/apple.glb",
    thumb: "/assets/thumbs/apple.png",
    label: "Abbey the Apple ",
    class: "Harvest Guardian",
    description:
      "An apple a day keeps the quests at bay 🍎",
  },
  {
    id: "snail",
    bg: "linear-gradient(180deg, #f9d423 0%, #a8c639 100%)",
    model: "/assets/models/snail.glb",
    thumb: "/assets/thumbs/snail.png",
    label: "Shelby the Snail",
    class: "Patient Seeker",
    description: "Never rushed, never behind ๑ï",
  },
];

function AvatarRegister() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const currentModel = useRef(null);
  const animFrame = useRef(null);
  const loader = useRef(new GLTFLoader());
  const isJumping = useRef(false);
  const jumpStart = useRef(0);

  const selected = avatars[selectedIndex];

  // Three.js boot
  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0.5, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = false;
    controls.rotateSpeed = 0.4;
    controls.minPolarAngle = Math.PI / 2;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(0, 0.5, 0);
    controlsRef.current = controls;

    // neutral lighting
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

    const animate = () => {
      animFrame.current = requestAnimationFrame(animate);
      controls.update();

      if (currentModel.current) {
        const baseY = currentModel.current.userData.baseY ?? 0.5;

        if (isJumping.current) {
          const elapsed = (Date.now() - jumpStart.current) / 1000;
          const jumpHeight = Math.max(0, Math.sin(elapsed * Math.PI * 2) * 0.6);
          currentModel.current.position.y = baseY + jumpHeight;
          if (elapsed > 0.5) isJumping.current = false;
        } else {
          currentModel.current.position.y =
            baseY + Math.sin(Date.now() * 0.002) * 0.1;
        }
      }

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
        const scale = (selected.scale || 2.8) / size.y;
        model.scale.setScalar(scale);

        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(scale));
        model.position.y += 0.5;
        model.position.x += selected.offsetX || 0;
        model.userData.baseY = model.position.y;
        model.rotation.y = 0;

        scene.add(model);
        currentModel.current = model;
      },
      undefined,
      (err) => console.error("Model load error:", err),
    );
  }, [selectedIndex]);

  const handleSelect = (index) => {
    setIsConfirmed(false);
    isJumping.current = false;
    setSelectedIndex(index);
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    isJumping.current = true;
    jumpStart.current = Date.now();

    setTimeout(async () => {
      try {
        await axios.post(
          `${API_URL}/api/auth/update-avatar`,
          { avatarId: selected.id },
          { headers: { "x-auth-token": token } },
        );

        // Join the pending invite party if there is one
        const pendingInvite = localStorage.getItem("pendingInvite");
        if (pendingInvite) {
          localStorage.removeItem("pendingInvite");
          try {
            await axios.post(
              `${API_URL}/api/party/join/${pendingInvite}`,
              {},
              { headers: { "x-auth-token": token } },
            );
          } catch (err) {
            console.error("Could not join party:", err);
          }
        }

        navigate("/dashboard");
      } catch (err) {
        console.error("Couldn't save avatar selection", err);
        setIsConfirmed(false);
        isJumping.current = false;
      }
    }, 1500);
  };

  return (
    <div className="avatar-register-container">
      {/* clouds */}
      <svg
        className="cloud cloud-lg"
        style={{ left: "5%" }}
        viewBox="0 0 110 55"
        fill="none"
      >
        <ellipse
          cx="55"
          cy="38"
          rx="46"
          ry="17"
          fill="rgba(255,255,255,0.88)"
        />
        <ellipse
          cx="35"
          cy="30"
          rx="22"
          ry="20"
          fill="rgba(255,255,255,0.88)"
        />
        <ellipse
          cx="62"
          cy="26"
          rx="26"
          ry="22"
          fill="rgba(255,255,255,0.88)"
        />
        <ellipse
          cx="84"
          cy="33"
          rx="18"
          ry="15"
          fill="rgba(255,255,255,0.88)"
        />
      </svg>
      <svg
        className="cloud cloud-sm"
        style={{ left: "45%" }}
        viewBox="0 0 75 40"
        fill="none"
      >
        <ellipse
          cx="37"
          cy="28"
          rx="32"
          ry="12"
          fill="rgba(255,255,255,0.80)"
        />
        <ellipse
          cx="22"
          cy="22"
          rx="16"
          ry="14"
          fill="rgba(255,255,255,0.80)"
        />
        <ellipse
          cx="45"
          cy="18"
          rx="18"
          ry="16"
          fill="rgba(255,255,255,0.80)"
        />
        <ellipse
          cx="60"
          cy="24"
          rx="13"
          ry="11"
          fill="rgba(255,255,255,0.80)"
        />
      </svg>
      <svg
        className="cloud cloud-xl"
        style={{ left: "70%" }}
        viewBox="0 0 140 65"
        fill="none"
      >
        <ellipse
          cx="70"
          cy="48"
          rx="60"
          ry="18"
          fill="rgba(255,255,255,0.85)"
        />
        <ellipse
          cx="42"
          cy="38"
          rx="28"
          ry="24"
          fill="rgba(255,255,255,0.85)"
        />
        <ellipse
          cx="78"
          cy="32"
          rx="33"
          ry="28"
          fill="rgba(255,255,255,0.85)"
        />
        <ellipse
          cx="110"
          cy="40"
          rx="24"
          ry="20"
          fill="rgba(255,255,255,0.85)"
        />
      </svg>

      {/* fireflies */}
      <div className="fireflies fireflies-1" />
      <div className="fireflies fireflies-2" />
      <div className="fireflies fireflies-3" />
      <div className="fireflies fireflies-4" />

      {/* center stage */}
      <div className="center-panel" style={{ background: selected.bg }}>
        <div className="egg-row">
          <button
            className="arrow-btn"
            onClick={() =>
              handleSelect(
                (selectedIndex - 1 + avatars.length) % avatars.length,
              )
            }
          >
            ‹
          </button>

          <div className="stage-wrap">
            <span className="sparkle s1">✦</span>
            <span className="sparkle s2">✦</span>
            <span className="sparkle s3">✦</span>
            <div className="sculpture-stage" ref={mountRef} />
          </div>

          <button
            className="arrow-btn"
            onClick={() => handleSelect((selectedIndex + 1) % avatars.length)}
          >
            ›
          </button>
        </div>

        <div className="egg-shadow" />
        <p className="drag-hint">✦ drag to spin ✦</p>

        {/* dot indicators */}
        <div className="dot-row">
          {avatars.map((_, i) => (
            <div
              key={i}
              className={`dot ${i === selectedIndex ? "active" : ""}`}
              onClick={() => handleSelect(i)}
            />
          ))}
        </div>
      </div>

      {/* right info panel */}
      <div className="right-panel">
        {/* prompt header */}
        <div className="choose-header">
          <p className="choose-eyebrow">step 1 of 1</p>
          <h1 className="choose-heading">Every adventure needs a companion!</h1>
          <p className="choose-sub">
            Arrow through to meet them all — then pick the one you feel
            connected to ♡
          </p>
        </div>

        <div className="panel-divider" />

        <div>
          <h2 className="char-name">{selected.label}</h2>
          <p className="char-class">{selected.class}</p>
        </div>
        <div className="panel-divider" />
        <p className="char-description">{selected.description}</p>
        <div className="panel-divider" />
        <button
          className={`select-btn ${isConfirmed ? "confirmed" : ""}`}
          onClick={handleConfirm}
        >
          {isConfirmed ? "Entering the plaza..." : "Start Adventure!"}
        </button>
      </div>
    </div>
  );
}

export default AvatarRegister;
