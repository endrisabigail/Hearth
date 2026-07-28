import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "../pages/styles/avatarRegister.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// each avatar has a matching companion, e.g. "mushroom" -> ai-agentMushroom.glb
const agentModelFor = (id) =>
  `/assets/models/ai-agent${id.charAt(0).toUpperCase()}${id.slice(1)}.glb`;

const AGENT_OFFSET_X = 1.3;
const AGENT_OFFSET_Z = -0.3;
const AGENT_SCALE_TARGET = 0.7;

// nomad sculpted characters !!
const avatars = [
  {
    id: "tomato",
    bg: "linear-gradient(180deg, #e74c3c 0%, #f39c12 100%)",
    model: "/assets/models/tomato.glb",
    thumb: "/assets/thumbs/tomato.png",
    label: "Tammy the Tomato ",
    class: "Forest Keeper",
    description: "Ketchup's to everything eventually 🍅",
  },
  {
    id: "frog",
    bg: "linear-gradient(180deg, #4a9fd4 0%, #2ecc71 100%)",
    model: "/assets/models/frog.glb",
    thumb: "/assets/thumbs/frog.png",
    label: "Froppy the Frog ",
    class: "Wanderer",
    description: "Thrives when jumping between big ideas 𖠊",
  },
  {
    id: "fish",
    bg: "linear-gradient(180deg, #2980b9 0%, #6dd5fa 100%)",
    model: "/assets/models/fish.glb",
    thumb: "/assets/thumbs/fish.png",
    label: "Finn the Fish ",
    class: "Stream Guide",
    description: "Plenty of fish in the sea, but none quite like her 𓆝",
    offsetX: 0.2,
  },
  {
    id: "mushroom",
    bg: "linear-gradient(180deg, #a77dc7 0%, #ff0000 100%)",
    model: "/assets/models/mushroom.glb",
    thumb: "/assets/thumbs/mushroom.png",
    label: "Mossy the Mushroom",
    class: "Forest Sage",
    description: "Grows best in quiet, focused environments 𓍊",
  },
  {
    id: "apple",
    bg: "linear-gradient(180deg, #ff6b6b 0%, #c0392b 100%)",
    model: "/assets/models/apple.glb",
    thumb: "/assets/thumbs/apple.png",
    label: "Abbey the Apple ",
    class: "Harvest Guardian",
    description: "An apple a day keeps the quests at bay 🍎",
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
  const currentAgentModel = useRef(null);
  const currentAgentShadow = useRef(null);
  const animFrame = useRef(null);
  const loader = useRef(new GLTFLoader());
  const agentLoader = useRef(new GLTFLoader());
  const agentFloatT = useRef(0);
  const isJumping = useRef(false);
  const jumpStart = useRef(0);
  const isDragging = useRef(false);
  const lastPointerX = useRef(0);
  const clickSound = useRef(
    typeof Audio !== "undefined" ? new Audio("/assets/sounds/click.mp3") : null,
  );
  const bgMusic = useRef(
    typeof Audio !== "undefined" ? new Audio("/assets/sounds/Main.mp3") : null,
  );
  const casualClickSound = useRef(
    typeof Audio !== "undefined"
      ? new Audio("/assets/sounds/casualClick.mp3")
      : null,
  );

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
    controls.enableRotate = false; // camera stays put - dragging now only spins the character
    controls.autoRotate = false;
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

      if (currentAgentModel.current) {
        agentFloatT.current += 0.02;
        const agentBaseY = currentAgentModel.current.userData.agentBaseY ?? 0.3;
        const bob = Math.sin(agentFloatT.current * 1.6 + Math.PI) * 0.09;
        currentAgentModel.current.position.y = agentBaseY + bob;

        if (currentAgentShadow.current) {
          const liftRatio = bob / 0.09; // -1 (low) to 1 (high)
          const s = 1 - liftRatio * 0.2;
          currentAgentShadow.current.scale.setScalar(s);
          currentAgentShadow.current.material.opacity = 0.16 - liftRatio * 0.06;
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

    // drag-to-spin, applied only to the character model (agent stays independent)
    const getClientX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);

    const onPointerDown = (e) => {
      isDragging.current = true;
      lastPointerX.current = getClientX(e);
    };
    const onPointerMove = (e) => {
      if (!isDragging.current || !currentModel.current) return;
      const x = getClientX(e);
      const deltaX = x - lastPointerX.current;
      lastPointerX.current = x;
      currentModel.current.rotation.y += deltaX * 0.01;
    };
    const onPointerUp = () => {
      isDragging.current = false;
    };

    const dom = renderer.domElement;
    dom.style.touchAction = "none";
    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      cancelAnimationFrame(animFrame.current);
      window.removeEventListener("resize", onResize);
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // background music
  useEffect(() => {
    const music = bgMusic.current;
    if (!music) return;

    music.loop = true;
    music.volume = 0.4;
    music.play().catch(() => {
      // autoplay was blocked - retry on the first user interaction
      const resume = () => {
        music.play().catch(() => { });
        window.removeEventListener("pointerdown", resume);
      };
      window.addEventListener("pointerdown", resume, { once: true });
    });

    return () => {
      music.pause();
      music.currentTime = 0;
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

    if (currentAgentModel.current) {
      scene.remove(currentAgentModel.current);
      currentAgentModel.current = null;
    }
    if (currentAgentShadow.current) {
      scene.remove(currentAgentShadow.current);
      currentAgentShadow.current = null;
    }

    agentLoader.current.load(
      agentModelFor(selected.id),
      (gltf) => {
        const agent = gltf.scene;
        const box = new THREE.Box3().setFromObject(agent);
        const size = box.getSize(new THREE.Vector3());
        const scale = AGENT_SCALE_TARGET / size.y;
        agent.scale.setScalar(scale);

        const center = box.getCenter(new THREE.Vector3());
        agent.position.sub(center.multiplyScalar(scale));
        agent.position.y += 0.0;
        agent.position.x += AGENT_OFFSET_X;
        agent.position.z += AGENT_OFFSET_Z;
        agent.userData.agentBaseY = agent.position.y;
        agent.rotation.y = -0.4; // angled slightly toward the character

        scene.add(agent);
        currentAgentModel.current = agent;

        // flat shadow blob sitting at the agent's estimated ground contact point
        const groundY = agent.position.y - (size.y * scale) / 2;
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(AGENT_SCALE_TARGET * 0.35, 24),
          new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(agent.position.x, groundY + 0.01, agent.position.z);
        scene.add(shadow);
        currentAgentShadow.current = shadow;
      },
      undefined,
      (err) =>
        console.error(`Agent model load error for ${selected.id}:`, err),
    );
  }, [selectedIndex]);

  const handleSelect = (index) => {
    if (casualClickSound.current) {
      casualClickSound.current.currentTime = 0;
      casualClickSound.current.play().catch(() => { });
    }
    setIsConfirmed(false);
    isJumping.current = false;
    setSelectedIndex(index);
  };

  const handleConfirm = () => {
    if (clickSound.current) {
      clickSound.current.currentTime = 0;
      clickSound.current.play().catch(() => { });
    }

    setIsConfirmed(true);
    isJumping.current = true;
    jumpStart.current = Date.now();

    setTimeout(async () => {
      try {
        await axios.post(
          `${API_URL}/api/auth/update-avatar`,
          { avatarId: selected.id },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const pendingInvite = localStorage.getItem("pendingInvite");
        if (pendingInvite) {
          localStorage.removeItem("pendingInvite");
          try {
            await axios.post(
              `${API_URL}/api/party/join/${pendingInvite}`,
              {},
              { headers: { Authorization: `Bearer ${token}` } },
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
    <div className="avatar-register-wrapper">
      <img
        src="/hearth-favicon.png"
        alt="Hearth"
        style={{
          width: "40px",
          position: "fixed",
          top: "14px",
          left: "14px",
          opacity: 0.85,
          zIndex: 999,
        }}
      />{" "}
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
          <h1 className="choose-heading">Every story needs a main character!</h1>
          <p className="choose-sub">
            Arrow through to meet them all, then pick the one you feel
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
          {isConfirmed ? "Entering the garden..." : "Start Adventure!"}
        </button>
      </div>
    </div>
  );
}

export default AvatarRegister;