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
import "../pages/styles/dashboard.css";
import "../pages/styles/questModal.css";
import "../pages/styles/messageModal.css";
import "../pages/styles/agentModal.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
const PANELS = ["members", "mail", "focus"];

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
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuest, setModalQuest] = useState(null);
  const [msgModalOpen, setMsgModalOpen] = useState(false);
  const [navModalOpen, setNavModalOpen] = useState(false);
  const [showControls, setShowControls] = useState(true); // show movement controls hint on first load
  const [agentScreenPos, setAgentScreenPos] = useState(null);
  const [agentPopupOpen, setAgentPopupOpen] = useState(false);

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
    mail: true,
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

        // habitats like frog land (all water except lily pads) restrict
        // where the character is allowed to stand. A step that's only
        // slightly off the lane gets snapped back onto it (so grazing
        // an edge doesn't read as "that direction is broken"); only a
        // step that's genuinely headed into open water gets rejected.
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

        // some habitats define an exact (non-rectangular) play area —
        // e.g. frog land's hexagonal plane — via a clamp function that
        // pulls an out-of-bounds step back to the nearest edge point
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

      // broadcast our position to everyone else in the plaza
      // (arrow key) movement and click-to-travel since both write to posRef.
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

  // TODO(backend): this assumes the party document has a `habitatId` field
  // set when the owner picks their habitat, defaulting to the owner's own
  // avatar for parties created before that field existed. Every member
  // renders THIS habitat regardless of their own avatarId/avatar model —
  // only which .glb loads for each person's own character differs.
  const habitat = party?.habitatId || party?.owner?.avatarId || userData?.avatarId;
  const isFrogLand = habitat === "frog";

  const mailIcon = (n) => {
    if (n.type === "quest_complete") return "⚔️";
    if (n.type === "badge_earned") return "🏅";
    if (n.type === "member_joined") return "🏡";
    if (n.type === "quest_assigned") return "📋";
    if (n.type === "streak_milestone") return "🔥";
    if (n.type === "neighbor_request") return "🤝";
    if (n.type === "neighbor_accepted") return "🌿";
    if (n.message?.startsWith("✉️")) return "💬";
    return "✉️";
  };

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
            normToWorld={grassNormToWorld}
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
                  : "no active quests! wait for your lead to get started!"}
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

export default Dashboard;