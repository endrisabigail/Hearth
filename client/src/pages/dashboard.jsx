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
import FrogLandCanvas from "../components/frogLandCanvas.jsx";
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
import FrogLandCanvas, { frogNormToWorld } from "../components/frogLandCanvas.jsx";

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
const PANELS = ["members", "focus"];

const SOUND_FILES = {
  mail: "/sounds/mail.mp3",
  notify: "/sounds/notify.mp3",
  newMember: "/sounds/new.mp3",
  click: "/sounds/click.mp3",
};

function playSound(name, volume = 1) {
  try {
    const src = SOUND_FILES[name];
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volume));
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
  useEffect(() => {
    const handleAnyClick = () => playSound("click", 0.5);
    document.addEventListener("click", handleAnyClick);
    return () => document.removeEventListener("click", handleAnyClick);
  }, []);

  // notify.mp3 once whenever the unread bell-notification count goes up
  const prevUnreadBellRef = useRef(0);
  useEffect(() => {
    const unread = notifications.filter(
      (n) => !n.read && !n.message?.startsWith("✉️"),
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

  const handleQuestUpdated = (updated) =>
    setQuests((prev) => prev.map((q) => (q._id === updated._id ? updated : q)));
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
  const isMailNotification = (n) => n.message?.startsWith("✉️");

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
      <div className="hud-icon-cluster hud-icon-cluster--left">
        <button
          className="mail-envelope-trigger"
          onClick={() => setMsgModalOpen(true)}
          title={unreadMailCount > 0 ? "you've got mail!" : "check mail"}
        >
          <span
            className={`mail-envelope${unreadMailCount > 0 ? " mail-envelope--shake" : ""}`}
          >
            <span className="mail-letter">
              <span className="mail-letter-line" />
              <span className="mail-letter-line mail-letter-line--short" />
            </span>
            <span className="mail-envelope-flap" />
            <span className="mail-envelope-body" />
            {unreadMailCount > 0 && (
              <span className="mail-envelope-badge">{unreadMailCount}</span>
            )}
          </span>
        </button>
      </div>

      <div className="hud-icon-cluster hud-icon-cluster--right">
        <div className="bell-wrap" ref={bellPanelRef}>
          <button
            className={`bell-trigger${unreadBellCount > 0 ? " bell-trigger--ring" : ""}`}
            onClick={() => setBellPopoverOpen((o) => !o)}
            title={
              unreadBellCount > 0
                ? `${unreadBellCount} new notifications`
                : "notifications"
            }
          >
            <span className="bell-icon">🔔</span>
            {unreadBellCount > 0 && (
              <span className="bell-badge">{unreadBellCount}</span>
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
                        <p className="mail-message">{n.message}</p>
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

      <nav className="navbar wood-surface">
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
            <div className="member-icon-grid">
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
                  <span className="focus-note-tape" />
                  <p className="focus-goal-label">
                    📌{" "}
                    {focusQuest.dueDate
                      ? `due ${new Date(focusQuest.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                      : "due soonest"}
                  </p>
                  <p className="focus-task">{focusQuest.title}</p>
                  <p className="focus-desc">{focusQuest.description}</p>
                  {focusQuest.assignedTo && (
                    <p className="focus-assigned">
                      {AVATAR_MAP[focusQuest.assignedTo.avatarId]}{" "}
                      {focusQuest.assignedTo.username}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="empty-msg">
                {userData?.isPartyOwner
                  ? "no quests yet! add a quest node to get started 🪡"
                  : "no active quests! wait for your lead to get started!"}
              </p>
            )}
            <style>{`
              .focus-panel--paper {
                background: transparent;
                box-shadow: none;
                border: none;
                padding: 0;
              }
              .focus-panel--paper .panel-header {
                background: transparent;
                padding: 2px 6px 4px;
              }
              .focus-note-wrap {
                display: flex;
                justify-content: center;
                padding: 10px 12px 18px;
              }
              .focus-note {
                position: relative;
                width: 100%;
                max-width: 260px;
                background: #fdf6e3;
                background-image: repeating-linear-gradient(
                  #fdf6e3,
                  #fdf6e3 26px,
                  #ecdfb8 27px
                );
                padding: 28px 20px 18px;
                border-radius: 2px;
                transform: rotate(-1.6deg);
                box-shadow:
                  0 10px 18px rgba(0, 0, 0, 0.3),
                  0 1px 0 rgba(255, 255, 255, 0.4) inset;
              }
              .focus-note-tape {
                position: absolute;
                top: -13px;
                left: 50%;
                width: 74px;
                height: 26px;
                margin-left: -37px;
                transform: rotate(-3deg);
                background: rgba(255, 255, 255, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.65);
                box-shadow: 0 2px 3px rgba(0, 0, 0, 0.18);
              }
              .focus-note .focus-goal-label,
              .focus-note .focus-task,
              .focus-note .focus-desc,
              .focus-note .focus-assigned {
                position: relative;
                z-index: 1;
              }
            `}</style>
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
              {panel === "members" ? "👥 members" : "🎯 focus"}
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
          className="floating-add-btn floating-add-btn--sprout"
          onClick={() => {
            setModalQuest(null);
            setModalOpen(true);
          }}
          title="add quest"
        >
          <span className="sprout-scene">
            <span className="sprout-sparkle sprout-sparkle--1">✦</span>
            <span className="sprout-sparkle sprout-sparkle--2">✦</span>
            <span className="sprout-bud" />
            <span className="sprout-leaf sprout-leaf--left" />
            <span className="sprout-leaf sprout-leaf--right" />
            <span className="sprout-stem" />
            <span className="sprout-pot" />
            <span className="sprout-plus">+</span>
          </span>
          <style>{`
            .floating-add-btn--sprout {
              background: transparent;
              border: none;
              padding: 0;
              cursor: pointer;
            }
            .floating-add-btn--sprout:hover .sprout-scene {
              transform: scale(1.08);
            }
            .sprout-scene {
              position: relative;
              display: block;
              width: 52px;
              height: 52px;
              transition: transform 0.2s ease;
            }
            .sprout-pot {
              position: absolute;
              bottom: 2px;
              left: 50%;
              transform: translateX(-50%);
              width: 28px;
              height: 18px;
              background: linear-gradient(160deg, #c8860a, #8b6914);
              border-radius: 4px 4px 12px 12px;
              box-shadow: 0 3px 6px rgba(0, 0, 0, 0.28);
            }
            .sprout-stem {
              position: absolute;
              bottom: 17px;
              left: 50%;
              width: 4px;
              height: 15px;
              margin-left: -2px;
              background: #4a8f3c;
              border-radius: 2px;
              transform-origin: bottom center;
              animation: sprout-sway 3s ease-in-out infinite;
            }
            .sprout-leaf {
              position: absolute;
              bottom: 24px;
              width: 15px;
              height: 10px;
              background: linear-gradient(135deg, #86cf60, #4a8f3c);
              border-radius: 60% 60% 60% 5%;
              animation: sprout-sway 3s ease-in-out infinite;
            }
            .sprout-leaf--left {
              left: 9px;
              transform-origin: bottom right;
              animation-delay: -0.3s;
            }
            .sprout-leaf--right {
              right: 9px;
              transform: scaleX(-1);
              transform-origin: bottom left;
              animation-delay: -0.6s;
            }
            .sprout-bud {
              position: absolute;
              top: 5px;
              left: 50%;
              margin-left: -6px;
              width: 12px;
              height: 12px;
              background: radial-gradient(circle at 35% 30%, #ffe066, #ffb300);
              border-radius: 50%;
              box-shadow: 0 0 6px rgba(255, 193, 7, 0.6);
              animation: sprout-bob 3s ease-in-out infinite;
            }
            .sprout-plus {
              position: absolute;
              top: -3px;
              right: -3px;
              width: 18px;
              height: 18px;
              background: #fff8ec;
              color: #b8860b;
              border: 2px solid #ffb300;
              border-radius: 50%;
              font-size: 12px;
              font-weight: 800;
              line-height: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
            }
            .sprout-sparkle {
              position: absolute;
              font-size: 9px;
              color: #ffe066;
              opacity: 0;
              animation: sprout-twinkle 2.4s ease-in-out infinite;
            }
            .sprout-sparkle--1 {
              top: 0px;
              left: -3px;
              animation-delay: 0.4s;
            }
            .sprout-sparkle--2 {
              top: 10px;
              right: -7px;
              animation-delay: 1.4s;
            }
            @keyframes sprout-sway {
              0%, 100% { transform: rotate(-6deg); }
              50% { transform: rotate(6deg); }
            }
            @keyframes sprout-bob {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-3px); }
            }
            @keyframes sprout-twinkle {
              0%, 100% { opacity: 0; transform: scale(0.6); }
              50% { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </button>
      )}

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
  return (
    <div
      className="member-icon"
      title={`${member.username}${isOwner ? " · lead" : ""} · ${isLive ? "live" : "away"}`}
    >
      <div className={`member-icon-avatar${isOwner ? " member-icon-avatar--owner" : ""}`}>
        {AVATAR_MAP[member.avatarId] || "🐾"}
      </div>
      <span className={`member-icon-status ${isLive ? "is-live" : "is-away"}`}>
        {isLive ? "🟢" : "🌙"}
      </span>
      {isOwner && <span className="member-icon-crown">👑</span>}
      <p className="member-icon-name">{member.username}</p>
    </div>
  );
}

export default Dashboard;