import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PlazaCanvas from "../components/plazaCanvas.jsx";
import QuestModal from "../components/questModal.jsx";
import QuestNodes, { NODE_POSITIONS } from "../components/questNodes.jsx";
import MessageModal from "../components/messageModal.jsx";
import NavModal from "../components/navModal.jsx";
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

const DEFAULT_BOUNDS = { minX: 0.05, maxX: 0.95, minY: 0.05, maxY: 0.95 };
const MOVE_SPEED = 0.008;
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
      headers: { "x-auth-token": token },
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

        // proximity check for all nodes to trigger modal open on walk-in
        NODE_POSITIONS.forEach((node, i) => {
          const dx = posRef.current.x - node.nx;
          const dy = posRef.current.y - node.ny;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (
            dist < PROXIMITY_THRESHOLD &&
            !proximityTriggeredRef.current.has(node.id)
          ) {
            proximityTriggeredRef.current.add(node.id);
            // use a small timeout to let React state (quests) be accessible
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
          // reset trigger when player walks away
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
            hasActiveQuest={hasActiveQuest}
            travelTargetRef={travelTargetRef}
            onArrived={handleArrived}
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
          onSent={() => setNotifications((prev) => prev)}
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
