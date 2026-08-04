import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import PlazaCanvas, { MOVEMENT_BOUNDS, normToWorld as grassNormToWorld } from "../components/plazaCanvas.jsx";
import FrogLandCanvas, { frogNormToWorld } from "../components/frogLandCanvas.jsx";
import QuestModal from "../components/questModal.jsx";
import QuestNodes, { NODE_POSITIONS } from "../components/questNodes.jsx";
import MessageModal from "../components/messageModal.jsx";
import NavModal from "../components/navModal.jsx";
import AgentModal from "../components/agentModal.jsx";
import { CATEGORY_ICON } from "../components/questModal.jsx";
import "../pages/styles/dashboard.css";
import "../pages/styles/questModal.css";
import "../pages/styles/messageModal.css";
import "../pages/styles/agentModal.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const STAR_LAYER_DEPTHS = [6, 4, 2, 0, -2, -4, -6];

const AVATAR_MAP = {
  tomato: "🍅",
  frog: "🐸",
  fish: "🐟",
  mushroom: "🍄",
  apple: "🍎",
  snail: "🐌",
};

const MOVE_SPEED = 0.0004; // units per ms; multiplied by dt in the game loop
const SAVE_DEBOUNCE = 1500;
const PANELS = ["members"];

const SOUND_FILES = {
  mail: "/sounds/mail.mp3",
  notify: "/sounds/notify.mp3",
  newMember: "/sounds/new.mp3",
  click: "/sounds/click.mp3",
};

const NAV_ICONS = {
  map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="9 3 3 5 3 19 9 17 15 19 21 17 21 3 15 5 9 3" />
      <line x1="9" y1="3" x2="9" y2="17" />
      <line x1="15" y1="5" x2="15" y2="19" />
    </svg>
  ),
  board: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 2h6v3H9z" />
      <line x1="8" y1="10.5" x2="16" y2="10.5" />
      <line x1="8" y1="14.5" x2="16" y2="14.5" />
      <line x1="8" y1="18.5" x2="13" y2="18.5" />
    </svg>
  ),
  passport: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="10" r="2.4" />
      <path d="M8.5 16c0-2 1.5-3 3.5-3s3.5 1 3.5 3" />
    </svg>
  ),
  pocket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8a5 5 0 0 1 10 0v3" />
      <rect x="4" y="8" width="16" height="13" rx="3" />
      <line x1="9" y1="12.5" x2="15" y2="12.5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.3 13.8a7.6 7.6 0 0 0 0-3.6l1.9-1.4-2-3.4-2.2.8a7.6 7.6 0 0 0-3.1-1.8L13.5 2h-3l-.4 2.4a7.6 7.6 0 0 0-3.1 1.8l-2.2-.8-2 3.4L4.7 10.2a7.6 7.6 0 0 0 0 3.6l-1.9 1.4 2 3.4 2.2-.8a7.6 7.6 0 0 0 3.1 1.8L10.5 22h3l.4-2.4a7.6 7.6 0 0 0 3.1-1.8l2.2.8 2-3.4z" />
    </svg>
  ),
};

// icons
const BELL_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path
      d="M12 4.6c-3.1.4-5.4 3-5.4 6.2v2.6c0 .6-.2 1.2-.7 1.7l-1.1 1.2c-.5.5-.1 1.4.6 1.4h13.2c.7 0 1.1-.9.6-1.4l-1.1-1.2c-.5-.5-.7-1.1-.7-1.7v-2.6c0-3.2-2.3-5.8-5.4-6.2"
      fill="#f6c667"
      stroke="#8b6914"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path
      d="M9.8 17.4a2.3 2.3 0 0 0 4.4 0"
      fill="none"
      stroke="#8b6914"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <g transform="translate(12 3.3)">
      <path d="M-2.4 0 L0 1.3 L-2.4 2.5 Z" fill="#ff9ecb" stroke="#c9457e" strokeWidth="0.4" />
      <path d="M2.4 0 L0 1.3 L2.4 2.5 Z" fill="#ff9ecb" stroke="#c9457e" strokeWidth="0.4" />
      <circle r="0.9" fill="#ffd23f" stroke="#c9457e" strokeWidth="0.4" />
    </g>
  </svg>
);

// envelope 
const MAIL_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <rect x="2.6" y="6.6" width="18.8" height="12.2" rx="3" fill="#f6ecd2" stroke="#8b6914" strokeWidth="1.3" />
    <g className="mail-icon-letter">
      <rect x="5.4" y="3.2" width="13.2" height="9.6" rx="1.2" fill="#fffdf6" stroke="#c9a86a" strokeWidth="1" />
      <line x1="7.6" y1="5.8" x2="16.4" y2="5.8" stroke="#dccf9e" strokeWidth="1" strokeLinecap="round" />
      <line x1="7.6" y1="8.2" x2="14" y2="8.2" stroke="#dccf9e" strokeWidth="1" strokeLinecap="round" />
      <line x1="7.6" y1="10.6" x2="15.2" y2="10.6" stroke="#dccf9e" strokeWidth="1" strokeLinecap="round" />
    </g>
    <path
      className="mail-icon-flap"
      d="M2.6 6.6 L21.4 6.6 L12 13.2 Z"
      fill="#fdf6e3"
      stroke="#8b6914"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="13" r="2" fill="#ff9ecb" stroke="#8b6914" strokeWidth="1" />
  </svg>
);

// coin
const COIN_ICON = (
  <svg viewBox="0 0 24 24" width="18" height="18">
    <circle cx="12" cy="12" r="8.6" fill="#ffd23f" stroke="#8b6914" strokeWidth="1.3" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="#f6c667" strokeWidth="1.1" />
    <path
      d="M12 8.4c-1.3 0-2.1.6-2.1 1.5 0 2 4.2.9 4.2 2.9 0 .9-.9 1.4-2.1 1.4s-2.1-.5-2.1-1.4"
      fill="none"
      stroke="#8b6914"
      strokeWidth="1"
      strokeLinecap="round"
    />
    <line x1="12" y1="7.4" x2="12" y2="16.6" stroke="#8b6914" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

function getSfxVolume() {
  const saved = localStorage.getItem("hearth_sfxVolume");
  return saved !== null ? Number(saved) / 100 : 0.5;
}

let currentSfxVolume = getSfxVolume();
if (typeof window !== "undefined") {
  window.addEventListener("hearth:volumechange", (e) => {
    if (e.detail?.channel === "sfx") currentSfxVolume = e.detail.value;
  });
}

function playSound(name, volume) {
  try {
    const src = SOUND_FILES[name];
    if (!src) return;
    const audio = new Audio(src);
    const effectiveVolume = volume !== undefined ? volume : currentSfxVolume;
    audio.volume = Math.max(0, Math.min(1, effectiveVolume));
    audio.play().catch(() => {
      /* browser blocked autoplay until a user gesture happens; safe to ignore */
    });
  } catch (err) {
    console.error("sound playback failed:", err);
  }
}

// how close the character needs to be to a chest to trigger on walk-in
const PROXIMITY_THRESHOLD = 0.06;

function collidesWithAny(nx, ny, boxes) {
  return boxes.some(
    (b) =>
      nx > b.cx - b.hw &&
      nx < b.cx + b.hw &&
      ny > b.cy - b.hh &&
      ny < b.cy + b.hh,
  );
}

function resolveStuck(x, y, boxes) {
  const EPS = 0.0005;
  for (const b of boxes) {
    const inside =
      x > b.cx - b.hw && x < b.cx + b.hw && y > b.cy - b.hh && y < b.cy + b.hh;
    if (!inside) continue;
    const penLeft = x - (b.cx - b.hw);
    const penRight = b.cx + b.hw - x;
    const penTop = y - (b.cy - b.hh);
    const penBottom = b.cy + b.hh - y;
    const minPen = Math.min(penLeft, penRight, penTop, penBottom);
    if (minPen === penLeft) x = b.cx - b.hw - EPS;
    else if (minPen === penRight) x = b.cx + b.hw + EPS;
    else if (minPen === penTop) y = b.cy - b.hh - EPS;
    else y = b.cy + b.hh + EPS;
  }
  return { x, y };
}

function Dashboard() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [party, setParty] = useState(null);
  const [quests, setQuests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("map");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuest, setModalQuest] = useState(null);
  const [addQuestBlooming, setAddQuestBlooming] = useState(false);
  const [msgModalOpen, setMsgModalOpen] = useState(false);
  const [bellPopoverOpen, setBellPopoverOpen] = useState(false);
  const bellPanelRef = useRef(null);
  const [navModalOpen, setNavModalOpen] = useState(false);
  const [showControls, setShowControls] = useState(true); // show movement controls hint on first load
  const [agentScreenPos, setAgentScreenPos] = useState(null);
  const [agentPopupOpen, setAgentPopupOpen] = useState(false);

  const focusQuest = useMemo(() => {
    const active = quests.filter((q) => q.status !== "Completed");
    const withDueDate = active
      .filter((q) => q.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return withDueDate[0] || active[0] || null;
  }, [quests]);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setShowControls("fading"), 8500);
    const hideTimer = setTimeout(() => setShowControls(false), 10000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hearth_categories") || "[]");
    } catch {
      return [];
    }
  });
  const [threeCtx, setThreeCtx] = useState({
    scene: null,
    camera: null,
    renderer: null,
  });
  const [openPanels, setOpenPanels] = useState({
    members: true,
    focus: true,
  });

  const posRef = useRef({ x: 0.5, y: 0.5 });
  const keysRef = useRef({});
  const saveTimer = useRef(null);
  const mapAreaRef = useRef(null);
  const collisionBoxesRef = useRef([]);

  // live plaza multiplayer state
  const socketRef = useRef(null);
  const otherPlayersRef = useRef(new Map()); // userId -> { x, y, avatarId, username }
  const lastEmitRef = useRef(0);
  const lastEmitPosRef = useRef({ x: null, y: null });
  // userId -> timestamp of the most recent message they sent us, so we can
  // pop a speech bubble above their avatar for a few seconds
  const messageAlertsRef = useRef(new Map());
  // bumped whenever someone joins/leaves so PlazaCanvas knows to load/remove a model.
  // movement is read straight from otherPlayersRef each frame.
  const [playersVersion, setPlayersVersion] = useState(0);

  // travel target ref set to { x, y } to start auto-travel, null to stop
  const travelTargetRef = useRef(null);
  // quest to open when character arrives at chest
  const pendingQuestRef = useRef(null);
  // track which chests already proximity-triggered to avoid repeat opens
  const proximityTriggeredRef = useRef(new Set());

  const token = localStorage.getItem("token");
  const apiRef = useRef(
    axios.create({
      baseURL: `${API_URL}/api`,
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  const api = apiRef.current;

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
        const rawX = user.plazaPosition.x;
        const rawY = user.plazaPosition.y;
        // check if the user has a stored plaza position and clamp it to bounds
        const hasStoredPosition =
          typeof rawX === "number" &&
          typeof rawY === "number" &&
          !(rawX === 0 && rawY === 0);

        const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

        posRef.current = {
          ...posRef.current,
          x: hasStoredPosition
            ? clamp(rawX, MOVEMENT_BOUNDS.minX, MOVEMENT_BOUNDS.maxX)
            : 0.5,
          y: hasStoredPosition
            ? clamp(rawY, MOVEMENT_BOUNDS.minY, MOVEMENT_BOUNDS.maxY)
            : 0.5,
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

  // connect to the live plaza namespace so we can see (and be seen by) other
  // party members currently online
  useEffect(() => {
    if (!token) return;

    const socket = io(`${API_URL}/plaza`, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("plaza:snapshot", (members) => {
      otherPlayersRef.current.clear();
      members.forEach((m) => {
        otherPlayersRef.current.set(m.userId, {
          x: m.x,
          y: m.y,
          avatarId: m.avatarId,
          username: m.username,
        });
      });
      setPlayersVersion((v) => v + 1);
    });

    socket.on("plaza:userJoined", (member) => {
      otherPlayersRef.current.set(member.userId, {
        x: member.x,
        y: member.y,
        avatarId: member.avatarId,
        username: member.username,
      });
      setPlayersVersion((v) => v + 1);
      playSound("newMember");
    });

    socket.on("plaza:userMoved", ({ userId, x, y }) => {
      const existing = otherPlayersRef.current.get(userId);
      if (existing) {
        existing.x = x;
        existing.y = y;
      }
      // PlazaCanvas reads this ref live every frame
    });

    socket.on("plaza:userLeft", ({ userId }) => {
      otherPlayersRef.current.delete(userId);
      setPlayersVersion((v) => v + 1);
    });

    // stamp time if someone messages so plazacanvas can show a speech bubble over messaging character 
    socket.on("plaza:messageReceived", ({ fromUserId }) => {
      if (!fromUserId) return;
      messageAlertsRef.current.set(fromUserId, Date.now());
      playSound("mail");
    });

    socket.on("connect_error", (err) => {
      console.error("plaza socket connection failed:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      otherPlayersRef.current.clear();
      messageAlertsRef.current.clear();
    };
  }, [token]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const x = Number(posRef.current.x.toFixed(4));
        const y = Number(posRef.current.y.toFixed(4));
        await api.patch("/dashboard/position", { x, y });
      } catch (err) {
        console.error("position save failed:", err);
      }
    }, SAVE_DEBOUNCE);
  }, []);

  // called when character arrives at a chest via click-to-travel
  const handleArrived = useCallback(() => {
    if (pendingQuestRef.current) {
      setModalQuest(pendingQuestRef.current);
      setModalOpen(true);
      pendingQuestRef.current = null;
    }
    scheduleSave();
  }, [scheduleSave]);

  // game loop to handle manual movement + proximity detection
  // solely handles listening to keys and keeping them updated
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        // Ignore movement if typing in an input field or textarea
        const target = e.target.tagName;
        if (target === "INPUT" || target === "TEXTAREA" || e.target.isContentEditable) {
          return;
        }
        e.preventDefault();
        keysRef.current[e.key] = true;
      }
    };

    const handleKeyUp = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        keysRef.current[e.key] = false;
      }
    };

    const handleBlur = () => {
      keysRef.current = {};
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []); // safe to leave empty because it only modifies refs, which don't trigger re-renders

  // separate effects, the 60fps frame tick loop independently
  useEffect(() => {
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

      let nx = x, ny = y;
      const speed = MOVE_SPEED * dt;

      // check if the user is typing anywhere on the dashboard

      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable
      );
      //only allow input calculations if not typing
      if (!isTyping) {
        if (k.ArrowLeft) { nx -= speed; moved = true; }
        if (k.ArrowRight) { nx += speed; moved = true; }
        if (k.ArrowUp) { ny -= speed; moved = true; }
        if (k.ArrowDown) { ny += speed; moved = true; }

      }

      if (moved) {
        const b = posRef.current.bounds || MOVEMENT_BOUNDS;

        // only enforce bounds constraints (prevent falling outside of the grass plane)
        nx = Math.max(b.minX, Math.min(b.maxX, nx));
        ny = Math.max(b.minY, Math.min(b.maxY, ny));

        const walkable = posRef.current.isWalkable;
        if (walkable && !walkable(nx, ny)) {
          const nearest = posRef.current.nearestWalkable;
          const snapped = nearest?.(nx, ny);
          const SNAP_TOLERANCE = 0.045; // normalized units
          if (snapped && Math.hypot(snapped.x - nx, snapped.y - ny) <= SNAP_TOLERANCE) {
            nx = snapped.x;
            ny = snapped.y;
          } else if (walkable(nx, y)) {
            ny = y;
          } else if (walkable(x, ny)) {
            nx = x;
          } else {
            nx = x;
            ny = y;
          }
        }
        const clampToBounds = posRef.current.clampToBounds;
        if (clampToBounds) {
          const clamped = clampToBounds(nx, ny);
          nx = clamped.x;
          ny = clamped.y;
        }

        posRef.current = { ...posRef.current, x: nx, y: ny };
        scheduleSave();

        NODE_POSITIONS.forEach((node, i) => {
          const dx = posRef.current.x - node.nx;
          const dy = posRef.current.y - node.ny;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < PROXIMITY_THRESHOLD && !proximityTriggeredRef.current.has(node.id)) {
            proximityTriggeredRef.current.add(node.id);
            setTimeout(() => {
              setQuests((currentQuests) => {
                const quest = currentQuests[i];
                if (quest) {
                  setModalQuest(quest);
                  setModalOpen(true);
                }
                return currentQuests;
              });
            }, 0);
          }
          if (dist > PROXIMITY_THRESHOLD * 1.5) {
            proximityTriggeredRef.current.delete(node.id);
          }
        });
      }

      const lerpFactor = 1 - Math.pow(0.01, dt / 1000);
      smoothPos.x += (posRef.current.x - smoothPos.x) * lerpFactor;
      smoothPos.y += (posRef.current.y - smoothPos.y) * lerpFactor;
      posRef.current._smoothX = smoothPos.x;
      posRef.current._smoothY = smoothPos.y;

      if (socketRef.current?.connected && now - lastEmitRef.current > 80) {
        const ex = Number(posRef.current.x.toFixed(4));
        const ey = Number(posRef.current.y.toFixed(4));
        if (ex !== lastEmitPosRef.current.x || ey !== lastEmitPosRef.current.y) {
          socketRef.current.emit("plaza:move", { x: ex, y: ey });
          lastEmitPosRef.current = { x: ex, y: ey };
        }
        lastEmitRef.current = now;
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [scheduleSave]);

  useEffect(() => {
    if (!bellPopoverOpen) return;
    const handleClickOutside = (e) => {
      if (bellPanelRef.current && !bellPanelRef.current.contains(e.target)) {
        setBellPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [bellPopoverOpen]);

  // click.mp3 on literally any click anywhere on the dashboard
  // (capture phase so modals that call e.stopPropagation(), like NavModal's
  // card, don't silently swallow the click before it reaches document)
  useEffect(() => {
    const handleAnyClick = () => playSound("click");
    document.addEventListener("click", handleAnyClick, true);
    return () => document.removeEventListener("click", handleAnyClick, true);
  }, []);

  // notify.mp3 once whenever the unread bell-notification count goes up
  const prevUnreadBellRef = useRef(0);
  useEffect(() => {
    const unread = notifications.filter(
      (n) => !n.read && !(typeof n.message === "string" && n.message.startsWith("✉️")),
    ).length;
    if (unread > prevUnreadBellRef.current) {
      playSound("notify");
    }
    prevUnreadBellRef.current = unread;
  }, [notifications]);

  const togglePanel = (panel) =>
    setOpenPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));

  const markNotificationsRead = async () => {
    try {
      await api.post("/dashboard/notifications/read");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  // clicking a chest results in starting travel toward it and opens modal on arrival
  const handleNodeClick = useCallback((quest, node) => {
    pendingQuestRef.current = quest;
    travelTargetRef.current = { x: node.nx, y: node.ny };
  }, []);

  const handleQuestUpdated = (updated) => {
    setQuests((prev) => prev.map((q) => (q._id === updated._id ? updated : q)));

    // Bump totalPoints optimistically the moment *this* user completes a
    // quest that wasn't already completed — guards against double-counting
    // on later edits to an already-completed quest, and against counting a
    // party member's completion as our own. The real source of truth is
    // still the next /dashboard fetch; this just keeps the top bar from
    // looking stale. (Note: `points` on the user is a per-category Map, not
    // a number — the running total lives in `totalPoints`.)
    const wasAlreadyCompleted =
      quests.find((q) => q._id === updated._id)?.status === "Completed";
    const justCompletedByMe =
      updated.status === "Completed" &&
      !wasAlreadyCompleted &&
      updated.completedBy?._id?.toString() === userData?.id?.toString();

    if (justCompletedByMe) {
      setUserData((prev) =>
        prev
          ? { ...prev, totalPoints: (prev.totalPoints || 0) + (updated.points || 0) }
          : prev,
      );
    }
  };
  const handleQuestCreated = (created) =>
    setQuests((prev) => [created, ...prev]);
  const handleQuestDeleted = (id) =>
    setQuests((prev) => prev.filter((q) => q._id !== id));

  const hasActiveQuest = useMemo(
    () =>
      quests.some(
        (q) =>
          q.status !== "Completed" &&
          q.assignedTo?._id?.toString() === userData?.id?.toString(),
      ),
    [quests, userData?.id],
  );

  const partyMembers = useMemo(
    () => [...(party?.owner ? [party.owner] : []), ...(party?.members || [])],
    [party],
  );


  const habitat = party?.habitatId || party?.owner?.avatarId || userData?.avatarId;
  const isFrogLand = habitat === "frog";

  const notifIcon = (n) => {
    if (n.type === "quest_complete") return "⚔️";
    if (n.type === "badge_earned") return "🏅";
    if (n.type === "member_joined") return "🏡";
    if (n.type === "quest_assigned") return "📋";
    if (n.type === "streak_milestone") return "🔥";
    if (n.type === "neighbor_request") return "🤝";
    if (n.type === "neighbor_accepted") return "🌿";
    return "🔔";
  };

  // new-message notifications live on the envelope; everything else rings the bell
  const isMailNotification = (n) =>
    typeof n.message === "string" && n.message.startsWith("✉️");
  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-fireflies">
          <span className="loading-firefly loading-firefly--1" />
          <span className="loading-firefly loading-firefly--2" />
          <span className="loading-firefly loading-firefly--3" />
          <span className="loading-firefly loading-firefly--4" />
          <span className="loading-firefly loading-firefly--5" />
          <span className="loading-firefly loading-firefly--6" />
        </div>
        <div className="loading-card">
          <div className="loading-sprout">
            <span className="loading-sprout-stem" />
            <span className="loading-sprout-leaf loading-sprout-leaf--left" />
            <span className="loading-sprout-leaf loading-sprout-leaf--right" />
            <span className="loading-sprout-bud" />
          </div>
          <p className="loading-title">Hearth</p>
          <p className="loading-subtitle">
            loading your plaza
            <span className="loading-ellipsis">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
        </div>
      </div>
    );
  }

  const bellNotifications = notifications.filter((n) => !isMailNotification(n));
  const unreadMailCount = notifications.filter(
    (n) => !n.read && isMailNotification(n),
  ).length;
  const unreadBellCount = bellNotifications.filter((n) => !n.read).length;
  const minimizedPanels = PANELS.filter((p) => !openPanels[p]);

  return (
    <div className="dashboard">
      <img
        src="/hearth-favicon.png"
        alt="Hearth"
        style={{
          position: "absolute",
          top: "18px",
          left: "18px",
          width: "34px",
          zIndex: 10,
          opacity: 0.9,
        }}
      />
      <div className="hud-icon-cluster hud-icon-cluster--right">
        <div className="hud-points" title="your points">
          <span className="hud-points-icon">{COIN_ICON}</span>
          <span className="hud-points-value" key={userData?.totalPoints ?? 0}>
            {userData?.totalPoints ?? 0}
          </span>
        </div>

        <button
          className={`hud-trigger hud-trigger--mail${unreadMailCount > 0 ? " hud-trigger--shake" : ""}`}
          onClick={() => setMsgModalOpen(true)}
          title={unreadMailCount > 0 ? "you've got mail!" : "check mail"}
        >
          <span className="hud-trigger-icon">{MAIL_ICON}</span>
          {unreadMailCount > 0 && (
            <span className="hud-trigger-badge">{unreadMailCount}</span>
          )}
        </button>

        <div className="bell-wrap" ref={bellPanelRef}>
          <button
            className={`hud-trigger${unreadBellCount > 0 ? " bell-trigger--ring" : ""}`}
            onClick={() => setBellPopoverOpen((o) => !o)}
            title={
              unreadBellCount > 0
                ? `${unreadBellCount} new notifications`
                : "notifications"
            }
          >
            <span className="hud-trigger-icon">{BELL_ICON}</span>
            {unreadBellCount > 0 && (
              <span className="hud-trigger-badge">{unreadBellCount}</span>
            )}
          </button>

          {bellPopoverOpen && (
            <div className="bell-popover">
              <div className="bell-popover-header">
                <span className="bell-popover-title">notifications</span>
                {unreadBellCount > 0 && (
                  <button className="read-all-btn" onClick={markNotificationsRead}>
                    mark read
                  </button>
                )}
              </div>
              <div className="mail-list">
                {bellNotifications.length > 0 ? (
                  bellNotifications.map((n) => (
                    <div
                      key={n._id}
                      className={`mail-row ${n.read ? "read" : "unread"}`}
                    >
                      <span className="mail-icon">{notifIcon(n)}</span>
                      <div className="mail-content">
                        <p className="mail-message">{typeof n.message === "string" ? n.message : ""}</p>
                        <p className="mail-time">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {!n.read && <div className="unread-dot" />}
                    </div>
                  ))
                ) : (
                  <p className="empty-msg">no notifications yet!</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="scene-bg" ref={mapAreaRef}>
        {userData?.avatarId && (isFrogLand ? (
          <FrogLandCanvas
            avatarId={userData.avatarId}
            posRef={posRef}
            keysRef={keysRef}
            collisionBoxesRef={collisionBoxesRef}
            onSceneReady={(scene, camera, renderer) =>
              setThreeCtx({ scene, camera, renderer })
            }
            hasActiveQuest={hasActiveQuest}
            travelTargetRef={travelTargetRef}
            onArrived={handleArrived}
            otherPlayersRef={otherPlayersRef}
            playersVersion={playersVersion}
            messageAlertsRef={messageAlertsRef}
            onAgentScreenPositionChange={setAgentScreenPos}
          />
        ) : (
          <PlazaCanvas
            avatarId={userData.avatarId}
            posRef={posRef}
            keysRef={keysRef}
            collisionBoxesRef={collisionBoxesRef}
            onSceneReady={(scene, camera, renderer) =>
              setThreeCtx({ scene, camera, renderer })
            }
            hasActiveQuest={hasActiveQuest}
            travelTargetRef={travelTargetRef}
            onArrived={handleArrived}
            otherPlayersRef={otherPlayersRef}
            playersVersion={playersVersion}
            messageAlertsRef={messageAlertsRef}
            onAgentScreenPositionChange={setAgentScreenPos}
          />
        ))}
        <AgentModal
          screenPos={agentScreenPos}
          open={agentPopupOpen}
          onToggle={() => setAgentPopupOpen((v) => !v)}
          onClose={() => setAgentPopupOpen(false)}
        />
        {threeCtx.scene && (
          <QuestNodes
            scene={threeCtx.scene}
            camera={threeCtx.camera}
            renderer={threeCtx.renderer}
            quests={quests}
            onNodeClick={handleNodeClick}
            normToWorld={isFrogLand ? frogNormToWorld : grassNormToWorld}
          />
        )}
        {showControls && (
          <div
            className="controls-hint"
            style={{
              position: "absolute",
              left: "50%",
              top: "65%",
              transform: "translateX(-50%)",
              opacity: showControls === "fading" ? 0 : 1,
              transition: "opacity 1.5s ease",
              zIndex: 10,
            }}
          >
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
        )}
      </div>

      <div className="fireflies fireflies-1" />
      <div className="fireflies fireflies-2" />
      <div className="fireflies fireflies-3" />
      <div className="fireflies fireflies-4" />

      <nav className="navbar">
        {[
          { id: "map", label: "Plaza Map" },
          { id: "board", label: "Board", path: "/board" },
          { id: "passport", label: "Passport", path: "/passport" },
          { id: "pocket", label: "Pocket", path: "/pocket" },
          { id: "settings", label: "Settings" },
        ].map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeNav === item.id ? "active" : ""}`}
            title={item.label}
            onClick={() => {
              setActiveNav(item.id);
              if (item.id === "settings") {
                setNavModalOpen(true);
              } else if (item.path) {
                navigate(item.path);
              }
            }}
          >
            <span className="nav-icon">{NAV_ICONS[item.id]}</span>
          </div>
        ))}
      </nav>

      {/* left column */}
      <div className="left-col">
        {openPanels.members && (
          <div className="member-icon-grid member-icon-grid--sidebar">
            {party?.owner && (
              <MemberIcon
                key={party.owner._id}
                member={party.owner}
                isOwner
                isLive={
                  party.owner._id?.toString() === userData?.id?.toString() ||
                  otherPlayersRef.current.has(party.owner._id)
                }
              />
            )}
            {party?.members?.length > 0
              ? party.members.map((member) => (
                <MemberIcon
                  key={member._id}
                  member={member}
                  isLive={
                    member._id?.toString() === userData?.id?.toString() ||
                    otherPlayersRef.current.has(member._id)
                  }
                />
              ))
              : !party?.owner && (
                <p className="empty-msg">no members yet! share your link ✦</p>
              )}
          </div>
        )}
      </div>

      {/* right column */}
      <div className="right-col">
        {openPanels.focus && (
          <div className="panel focus-panel focus-panel--paper">
            <div className="panel-header panel-header--titleless">
              <span className="panel-title" />
              <button
                className="panel-close"
                onClick={() => togglePanel("focus")}
              >
                ✕
              </button>
            </div>
            {focusQuest ? (
              <div className="focus-note-wrap">
                <div className="focus-note">
                  <p className="focus-goal-label">
                    📌{" "}
                    {focusQuest.dueDate
                      ? `due ${new Date(focusQuest.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                      : "due soonest"}
                  </p>
                  <p className="focus-task">{typeof focusQuest.title === "string" ? focusQuest.title : ""}</p>
                  <p className="focus-desc">{typeof focusQuest.description === "string" ? focusQuest.description : ""}</p>
                  {focusQuest.assignedTo && (
                    <p className="focus-assigned">
                      {AVATAR_MAP[focusQuest.assignedTo.avatarId]}{" "}
                      {typeof focusQuest.assignedTo.username === "string"
                        ? focusQuest.assignedTo.username
                        : ""}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              !userData?.isPartyOwner && (
                <p className="empty-msg">
                  no active quests! wait for your lead to get started!
                </p>
              )
            )}
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
              {panel === "members" ? "👥 members" : panel}
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
          viewerAvatarId={userData?.avatarId}
        />
      )}

      <div className="bottom-dock">
        {userData?.isPartyOwner && (
          <button
            type="button"
            className={`add-quest-btn${addQuestBlooming ? " add-quest-btn--grown" : ""}`}
            onClick={() => {
              if (addQuestBlooming) return;
              setAddQuestBlooming(true);
              // let the bloom animation play before the modal actually opens
              setTimeout(() => {
                setModalQuest(null);
                setModalOpen(true);
                setAddQuestBlooming(false);
              }, 550);
            }}
            title="Add quest"
            aria-label="Add quest"
          >
            <span className="add-quest-pot" />
            <span className="add-quest-stem" />
            <span className="add-quest-leaf add-quest-leaf--left" />
            <span className="add-quest-leaf add-quest-leaf--right" />
            <span className="add-quest-flower">
              <span className="add-quest-petal" />
              <span className="add-quest-petal" />
              <span className="add-quest-petal" />
              <span className="add-quest-petal" />
              <span className="add-quest-flower-center" />
            </span>
            <span className="add-quest-seed" />
          </button>
        )}

        {!openPanels.focus && (
          <button
            type="button"
            className="focus-toggle-btn"
            onClick={() => togglePanel("focus")}
            title="Show focus of the day"
            aria-label="Show focus of the day"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="4.5" />
              <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
            </svg>
          </button>
        )}
      </div>

      {msgModalOpen && (
        <MessageModal
          partyMembers={partyMembers}
          currentUserId={userData?.id}
          api={api}
          onClose={() => setMsgModalOpen(false)}
          onSent={(recipientId) => {
            // let the recipient's client know live, so a speech bubble can
            // pop above our avatar on their screen right away
            socketRef.current?.emit("plaza:message", { toUserId: recipientId });
          }}
          onThreadOpened={(recipientId) => {
            // message actively viewed=clear
            messageAlertsRef.current.delete(recipientId);
          }}
        />
      )}

      {navModalOpen && (
        <NavModal
          userData={userData}
          party={party}
          api={api}
          onClose={() => setNavModalOpen(false)}
        />
      )}
    </div>
  );
}

function MemberIcon({ member, isOwner, isLive }) {
  const username = typeof member.username === "string" ? member.username : "";
  return (
    <div
      className="member-icon"
      title={`${username}${isOwner ? " · lead" : ""} · ${isLive ? "live" : "away"}`}
    >
      <div className={`member-icon-avatar${isOwner ? " member-icon-avatar--owner" : ""}`}>
        {AVATAR_MAP[member.avatarId] || "🐾"}
      </div>
      <span className={`member-icon-status ${isLive ? "is-live" : "is-away"}`}>
        {isLive ? "🟢" : "🌙"}
      </span>
      {isOwner && <span className="member-icon-crown">👑</span>}
      <p className="member-icon-name">{username}</p>
    </div>
  );
}

export default Dashboard;