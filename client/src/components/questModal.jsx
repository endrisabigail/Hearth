import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getAuth, onIdTokenChanged } from "firebase/auth";
import "../pages/styles/agentModal.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// each companion's own portrait, keyed by the same avatarId used in AVATAR_MAP
const AGENT_IMAGE_MAP = {
  apple: "/models/ai-agentApple.png",
  snail: "/models/ai-agentSnail.png",
  tomato: "/models/ai-agentTomato.png",
  fish: "/models/ai-agentFish.png",
  frog: "/models/ai-agentFrog.png",
};


const AGENT_EMOJI_FALLBACK = {
  mushroom: "🍄",
};

function AgentAvatarImage({ avatarId }) {
  const [failed, setFailed] = useState(false);
  const hasDeliberateEmoji = Object.prototype.hasOwnProperty.call(
    AGENT_EMOJI_FALLBACK,
    avatarId,
  );
  const imageSrc = hasDeliberateEmoji
    ? null
    : AGENT_IMAGE_MAP[avatarId] || AGENT_IMAGE_MAP.frog;

  if (!imageSrc || failed) {
    return (
      <span className="qm-agent-fallback">
        {AGENT_EMOJI_FALLBACK[avatarId] || "🐸"}
      </span>
    );
  }

  return (
    <div className="qm-agent-3d">
      <img
        src={imageSrc}
        alt=""
        className="qm-agent-portrait"
        onError={(e) => {
          console.error(
            `AgentAvatarImage: failed to load "${imageSrc}" — check it actually exists at that exact path under your public/ folder (filenames are case-sensitive once deployed) and that the request isn't 404ing in the Network tab.`,
            e,
          );
          setFailed(true);
        }}
      />
    </div>
  );
}

const STATUS_COLOR = {
  "Not Started": "#f5a623",
  "In Progress": "#2196f3",
  Completed: "#4caf50",
};

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed"];

const PRIORITY_OPTIONS = ["low", "medium", "high"];
const PRIORITY_COLOR = {
  low: "#8bc34a",
  medium: "#f5a623",
  high: "#e53935",
};

const COMPLETE_SOUND_SRC = "assets/sounds/complete.mp3";
const NEW_SOUND_SRC = "assets/sounds/new.mp3";

const CONFETTI_COLORS = [
  "#ffb703",
  "#fb8500",
  "#8ecae6",
  "#219ebc",
  "#95d5b2",
  "#ffd166",
];

const CONFETTI_SYMBOLS = ["⭐", "✨", "🪙", "🎉"];

function FieldGroup({ label, children }) {
  return (
    <div className="qm-field">
      <label className="qm-label">{label}</label>
      {children}
    </div>
  );
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function fieldLabel(field) {
  const labels = {
    title: "title",
    description: "description",
    dueDate: "due date",
    category: "category",
    points: "points",
    assignedTo: "assigned to",
    status: "status",
    tags: "tags",
    priority: "priority",
    checklist: "checklist",
  };
  return labels[field] || field;
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
  viewerAvatarId,
}) {
  const isNew = !quest;
  const isLocked = !quest && !isOwner;


  const [localQuest, setLocalQuest] = useState(quest);
  useEffect(() => {
    setLocalQuest(quest);
    setAiOpen(false);
    setAiText(quest?.aiBreakdown || "");
    setAiError("");
  }, [quest?._id]);

  const applyUpdate = (updated) => {
    if (!updated) return;
    setLocalQuest(updated);
    onQuestUpdated?.(updated);
  };

  const [form, setForm] = useState({
    title: typeof quest?.title === "string" ? quest.title : "",
    description: typeof quest?.description === "string" ? quest.description : "",
    dueDate: quest?.dueDate
      ? new Date(quest.dueDate).toISOString().split("T")[0]
      : "",
    category: quest?.category || "",
    points: quest?.points || 5,
    status: quest?.status || "Not Started",
    assignedTo: quest?.assignedTo?._id || "",
    tags: quest?.tags || [],
    priority: quest?.priority || "medium",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");

  const addTagDraft = () => {
    const v = tagDraft.trim();
    if (!v || form.tags.includes(v)) {
      setTagDraft("");
      return;
    }
    set("tags", [...form.tags, v]);
    setTagDraft("");
  };
  const removeTagDraft = (t) => set("tags", form.tags.filter((x) => x !== t));

  // edit mode 
  const [editing, setEditing] = useState(false);

  const startEditing = () => {
    setForm((p) => ({
      ...p,
      title: typeof localQuest.title === "string" ? localQuest.title : "",
      description: typeof localQuest.description === "string" ? localQuest.description : "",
      dueDate: localQuest.dueDate
        ? new Date(localQuest.dueDate).toISOString().split("T")[0]
        : "",
      category: localQuest.category || "",
      points: localQuest.points || 5,
      assignedTo: localQuest.assignedTo?._id || "",
      tags: localQuest.tags || [],
      priority: localQuest.priority || "medium",
    }));
    setError("");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.put(`/quests/${quest._id}`, {
        title: form.title,
        description: form.description,
        dueDate: form.dueDate,
        category: form.category,
        points: form.points,
        assignedTo: form.assignedTo || null,
        tags: form.tags,
        priority: form.priority,
      });
      applyUpdate(res.data);
      setEditing(false);
    } catch (e) {
      setError(e.response?.data?.msg || "failed to save changes.");
    } finally {
      setSaving(false);
    }
  };
  const handleSaveStatus = async () => {
    setSaving(true);
    setError("");
    try {
      if (form.status === "Completed") {
        const res = await api.post("/quests/complete", { questId: quest._id });
        const updated =
          res.data && res.data._id ? res.data : { ...localQuest, status: "Completed" };
        applyUpdate(updated);
        setCelebrate(true);
        try {
          const audio = new Audio(COMPLETE_SOUND_SRC);
          audio.volume = 0.8;
          audio.play().catch((err) => {
            if (err?.name !== "NotAllowedError") {
              console.error(
                `failed to play "${COMPLETE_SOUND_SRC}" — check the file actually exists at that path:`,
                err,
              );
            }
          });
        } catch {
        }
      } else {
        const res = await api.put(`/quests/${quest._id}/status`, {
          status: form.status,
        });
        applyUpdate(res.data);
        onClose();
      }
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
        tags: form.tags,
        priority: form.priority,
        points: form.points,
      });
      let created = res.data;

      if (pendingFile) {
        try {
          const formData = new FormData();
          formData.append("file", pendingFile);
          const fileRes = await api.post(
            `/quests/${created._id}/attachments`,
            formData,
          );
          created = fileRes.data;
        } catch (e) {
          // don't let a failed attachment undo the quest that already saved
          setError(
            e.response?.data?.msg ||
            "quest created, but the pdf failed to attach.",
          );
        }
        setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }

      try {
        const audio = new Audio(NEW_SOUND_SRC);
        audio.volume = 0.8;
        audio.play().catch(() => { });
      } catch {

      }

      onQuestCreated(created);
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

  // ---- completion + celebration ---------------------------------------
  const [celebrate, setCelebrate] = useState(false);
  const confettiBits = useRef(
    Array.from({ length: 22 }, (_, i) => ({
      id: i,
      left: Math.round(Math.random() * 100),
      delay: (Math.random() * 0.6).toFixed(2),
      duration: (1.4 + Math.random() * 1.1).toFixed(2),
      color:
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      symbol:
        CONFETTI_SYMBOLS[Math.floor(Math.random() * CONFETTI_SYMBOLS.length)],
      drift: Math.round((Math.random() - 0.5) * 120),
    })),
  ).current;

  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const comments = localQuest?.comments || [];

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setPostingComment(true);
    setError("");
    try {
      const res = await api.post(`/quests/${quest._id}/comments`, { text });
      applyUpdate(res.data);
      setCommentText("");
    } catch (e) {
      setError(e.response?.data?.msg || "failed to post comment.");
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const res = await api.delete(
        `/quests/${quest._id}/comments/${commentId}`,
      );
      applyUpdate(res.data);
    } catch (e) {
      setError(e.response?.data?.msg || "failed to delete comment.");
    }
  };

  // attachments (pdf)  
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const attachments = localQuest?.attachments || [];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("only pdf files can be attached.");
      e.target.value = "";
      return;
    }
    setError("");
    setPendingFile(file);
  };

  const handleUploadFile = async () => {
    if (!pendingFile) return;
    setUploadingFile(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      const res = await api.post(
        `/quests/${quest._id}/attachments`,
        formData,
      );
      applyUpdate(res.data);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError(e.response?.data?.msg || "failed to upload attachment.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      const res = await api.delete(
        `/quests/${quest._id}/attachments/${attachmentId}`,
      );
      applyUpdate(res.data);
    } catch (e) {
      setError(e.response?.data?.msg || "failed to remove attachment.");
    }
  };

  const [showHistory, setShowHistory] = useState(false);
  const editHistory = localQuest?.editHistory || [];

  // checklist
  const checklist = localQuest?.checklist || [];
  const [newChecklistText, setNewChecklistText] = useState("");

  const saveChecklist = async (items) => {
    try {
      const res = await api.put(`/quests/${quest._id}/checklist`, { items });
      applyUpdate(res.data);
    } catch (e) {
      setError(e.response?.data?.msg || "failed to update checklist.");
    }
  };

  const handleAddChecklistItem = () => {
    const text = newChecklistText.trim();
    if (!text) return;
    saveChecklist([...checklist, { text, done: false }]);
    setNewChecklistText("");
  };

  const handleToggleChecklistItem = (item) => {
    saveChecklist(
      checklist.map((it) => (it === item ? { ...it, done: !it.done } : it)),
    );
  };

  const handleRemoveChecklistItem = (item) => {
    saveChecklist(checklist.filter((it) => it !== item));
  };

  //quest 
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState(localQuest?.aiBreakdown || "");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiSocketRef = useRef(null);

  const [token, setToken] = useState(null);
  useEffect(() => {
    const auth = getAuth();
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setToken(null);
        return;
      }
      try {
        setToken(await user.getIdToken());
      } catch {
        setToken(null);
      }
    });
  }, []);
  const canUseAi = Boolean(quest?._id) && !isNew && !isLocked;

  // the description writer 
  const canUseAiDescription = isOwner && !isLocked;

  const agentAvatarId = localQuest?.assignedTo?.avatarId || viewerAvatarId;

  // ids  
  const descRequestIdRef = useRef(0);

  useEffect(() => {
    if ((!canUseAi && !canUseAiDescription) || !token) return;

    const socket = io(`${API_URL}/ai`, {
      auth: { token },
      transports: ["websocket"],
    });
    aiSocketRef.current = socket;

    if (canUseAi) {
      socket.on("ai:breakdown:start", ({ questId }) => {
        if (questId !== quest._id) return;
        setAiStreaming(true);
        setAiError("");
        setAiText("");
      });

      socket.on("ai:breakdown:chunk", ({ questId, chunk }) => {
        if (questId !== quest._id) return;
        setAiText((prev) => prev + chunk);
      });

      socket.on("ai:breakdown:done", ({ questId }) => {
        if (questId !== quest._id) return;
        setAiStreaming(false);
      });

      socket.on("ai:breakdown:error", ({ questId, msg }) => {
        if (questId && questId !== quest._id) return;
        setAiStreaming(false);
        setAiError(msg || "couldn't get steps together.");
      });
    }

    // "write with ai" description streaming
    socket.on("ai:description:start", ({ requestId }) => {
      if (requestId !== descRequestIdRef.current) return;
      setAiDescLoading(true);
      setError("");
      setForm((p) => ({ ...p, description: "" }));
    });

    socket.on("ai:description:chunk", ({ requestId, chunk }) => {
      if (requestId !== descRequestIdRef.current) return;
      setForm((p) => ({ ...p, description: p.description + chunk }));
    });

    socket.on("ai:description:done", ({ requestId }) => {
      if (requestId !== descRequestIdRef.current) return;
      setAiDescLoading(false);
    });

    socket.on("ai:description:error", ({ requestId, msg }) => {
      if (requestId && requestId !== descRequestIdRef.current) return;
      setAiDescLoading(false);
      setError(msg || "couldn't write a description.");
    });

    return () => {
      socket.disconnect();
      aiSocketRef.current = null;
    };
  }, [canUseAi, canUseAiDescription, token, quest?._id]);

  const handleAskForHelp = (regenerate = false) => {
    setAiOpen(true);
    if (aiStreaming || !aiSocketRef.current) return;

    if (!regenerate && aiText) return;
    aiSocketRef.current.emit("ai:breakdown", {
      questId: quest._id,
      regenerate,
    });
  };

  // "write with AI" description helper 
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const handleAiDescription = () => {
    if (!form.title.trim()) {
      setError("add a title first so ai has something to work with.");
      return;
    }
    if (!aiSocketRef.current) {
      setError("still connecting to your companion — try again in a sec.");
      return;
    }
    setError("");
    setAiDescLoading(true);
    const requestId = ++descRequestIdRef.current;
    aiSocketRef.current.emit("ai:description", {
      requestId,
      title: form.title,
      questId: quest?._id,
    });
  };

  return (
    <div className="qm-overlay" onClick={onClose}>
      <div className="qm-card" onClick={(e) => e.stopPropagation()}>
        <button className="qm-close" onClick={onClose}>
          ×
        </button>

        {isLocked && (
          <div className="qm-locked">
            <h2>quest locked</h2>
            <p>this quest slot hasn't been filled yet.</p>
          </div>
        )}

        {isNew && isOwner && (
          <>
            <h2 className="qm-create-title">Add a new Quest</h2>
            <FieldGroup label="title">
              <input
                className="qm-input"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="quest title..."
              />
            </FieldGroup>
            <FieldGroup label="description">
              <div className="qm-desc-row">
                <textarea
                  className="qm-textarea"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="what needs to be done?"
                />
                <button
                  type="button"
                  className="qm-btn-secondary qm-btn-secondary--sm"
                  onClick={handleAiDescription}
                  disabled={aiDescLoading}
                >
                  {aiDescLoading ? "writing..." : "write with ai"}
                </button>
              </div>
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
              {customCategories.length > 0 ? (
                <select
                  className="qm-select"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  <option value="">no category</option>
                  {customCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="qm-section-text">
                  create a category below to use it here.
                </p>
              )}
              <div className="qm-custom-cat-row">
                <input
                  className="qm-input qm-input--sm"
                  placeholder="+ new category"
                  value={newCategoryDraft}
                  onChange={(e) => setNewCategoryDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCategoryDraft.trim()) {
                      const v = newCategoryDraft.trim().toLowerCase();
                      onSaveCategory?.(v);
                      set("category", v);
                      setNewCategoryDraft("");
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
            <FieldGroup label="tags">
              {form.tags.length > 0 && (
                <div className="qm-tag-list">
                  {form.tags.map((t) => (
                    <span key={t} className="qm-cat-tag">
                      {t}
                      <button onClick={() => removeTagDraft(t)}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className="qm-input qm-input--sm"
                placeholder="+ add tag"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagDraft.trim()) addTagDraft();
                }}
              />
            </FieldGroup>
            <FieldGroup label="priority">
              <select
                className="qm-select"
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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
                    {m.username}
                  </option>
                ))}
              </select>
            </FieldGroup>
            <FieldGroup label="attachment (pdf)">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="qm-file-input"
              />
              {pendingFile && (
                <p className="qm-section-text">
                  {pendingFile.name} ready to attach.
                </p>
              )}
            </FieldGroup>
            {error && <p className="qm-error">{error}</p>}

            <svg width="0" height="0" style={{ position: "absolute" }}>
              <filter id="quest-goo">
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="10"
                  result="blur"
                />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                  result="goo"
                />
                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
              </filter>
            </svg>
            <button
              className="qm-blob-btn"
              onClick={handleCreate}
              disabled={saving}
            >
              <span className="qm-blob-btn__inner">
                <span className="qm-blob-btn__blobs">
                  <span className="qm-blob-btn__blob" />
                  <span className="qm-blob-btn__blob" />
                  <span className="qm-blob-btn__blob" />
                  <span className="qm-blob-btn__blob" />
                </span>
              </span>
              {saving ? "creating..." : "create quest"}
            </button>
            <style>{`
              .qm-blob-btn {
                z-index: 1;
                position: relative;
                display: block;
                width: 100%;
                margin-top: 6px;
                padding: 16px 20px;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                color: #b8860b;
                font-size: 15px;
                font-weight: 700;
                font-family: inherit;
                background-color: transparent;
                outline: none;
                border: none;
                border-radius: 30px;
                transition: color 0.5s;
                cursor: pointer;
              }
              .qm-blob-btn:disabled {
                cursor: default;
                opacity: 0.7;
              }
              .qm-blob-btn:before {
                content: "";
                z-index: 1;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                border: 2px solid #b8860b;
                border-radius: 30px;
              }
              .qm-blob-btn:after {
                content: "";
                z-index: -2;
                position: absolute;
                left: 3px;
                top: 3px;
                width: 100%;
                height: 100%;
                transition: all 0.3s 0.2s;
                border-radius: 30px;
              }
              .qm-blob-btn:hover {
                color: #fff8ec;
              }
              .qm-blob-btn:hover:after {
                transition: all 0.3s;
                left: 0;
                top: 0;
              }
              .qm-blob-btn__inner {
                z-index: -1;
                overflow: hidden;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                border-radius: 30px;
                background: #fff8ec;
              }
              .qm-blob-btn__blobs {
                position: relative;
                display: block;
                height: 100%;
                filter: url(#quest-goo);
              }
              .qm-blob-btn__blob {
                position: absolute;
                top: 2px;
                width: 25%;
                height: 100%;
                background: #b8860b;
                border-radius: 100%;
                transform: translate3d(0, 150%, 0) scale(1.4);
                transition: transform 0.45s;
              }
              .qm-blob-btn:hover .qm-blob-btn__blob {
                transform: translateZ(0) scale(1.4);
              }
              .qm-blob-btn__blob:nth-child(1) {
                left: 0%;
                transition-delay: 0s;
              }
              .qm-blob-btn__blob:nth-child(2) {
                left: 30%;
                transition-delay: 0.08s;
              }
              .qm-blob-btn__blob:nth-child(3) {
                left: 60%;
                transition-delay: 0.16s;
              }
              .qm-blob-btn__blob:nth-child(4) {
                left: 90%;
                transition-delay: 0.24s;
              }
            `}</style>
          </>
        )}

        {quest && editing && (
          <>
            <h2 className="qm-create-title">Edit Quest</h2>
            <FieldGroup label="title">
              <input
                className="qm-input"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="quest title..."
              />
            </FieldGroup>
            <FieldGroup label="description">
              <div className="qm-desc-row">
                <textarea
                  className="qm-textarea"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="what needs to be done?"
                />
                <button
                  type="button"
                  className="qm-btn-secondary qm-btn-secondary--sm"
                  onClick={handleAiDescription}
                  disabled={aiDescLoading}
                >
                  {aiDescLoading ? "writing..." : "write with ai"}
                </button>
              </div>
            </FieldGroup>
            <div className="qm-two-col">
              <FieldGroup label="due date">
                <input
                  type="date"
                  className="qm-input"
                  value={form.dueDate}
                  onChange={(e) => set("dueDate", e.target.value)}
                />
              </FieldGroup>
            </div>
            <FieldGroup label="category">
              {customCategories.length > 0 ? (
                <select
                  className="qm-select"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  <option value="">no category</option>
                  {customCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="qm-section-text">
                  create a category below to use it here.
                </p>
              )}
              <div className="qm-custom-cat-row">
                <input
                  className="qm-input qm-input--sm"
                  placeholder="+ new category"
                  value={newCategoryDraft}
                  onChange={(e) => setNewCategoryDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCategoryDraft.trim()) {
                      const v = newCategoryDraft.trim().toLowerCase();
                      onSaveCategory?.(v);
                      set("category", v);
                      setNewCategoryDraft("");
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
            <FieldGroup label="tags">
              {form.tags.length > 0 && (
                <div className="qm-tag-list">
                  {form.tags.map((t) => (
                    <span key={t} className="qm-cat-tag">
                      {t}
                      <button onClick={() => removeTagDraft(t)}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className="qm-input qm-input--sm"
                placeholder="+ add tag"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagDraft.trim()) addTagDraft();
                }}
              />
            </FieldGroup>
            <FieldGroup label="priority">
              <select
                className="qm-select"
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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
                    {m.username}
                  </option>
                ))}
              </select>
            </FieldGroup>
            {error && <p className="qm-error">{error}</p>}
            <div className="qm-edit-actions">
              <button
                className="qm-btn-secondary"
                onClick={() => {
                  setEditing(false);
                  setError("");
                }}
                disabled={saving}
              >
                cancel
              </button>
              <button
                className="qm-btn-primary"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? "saving..." : "save changes"}
              </button>
            </div>
          </>
        )}

        {quest && !editing && (
          <>
            <div className="qm-quest-header">
              <span
                className="qm-status-badge"
                style={{ background: STATUS_COLOR[localQuest.status] || "#aaa" }}
              >
                {localQuest.status}
              </span>
              <span
                className="qm-priority-badge"
                style={{
                  background: PRIORITY_COLOR[localQuest.priority] || "#999",
                }}
              >
                {localQuest.priority || "medium"}
              </span>
              {isOwner && localQuest.status !== "Completed" && (
                <button
                  type="button"
                  className="qm-edit-toggle"
                  onClick={startEditing}
                >
                  edit
                </button>
              )}
              {canUseAi && localQuest.status !== "Completed" && (
                <button
                  type="button"
                  className="qm-agent-help"
                  onClick={() => handleAskForHelp(false)}
                  title="get help starting this quest"
                >
                  <AgentAvatarImage avatarId={agentAvatarId} />
                  <span className="qm-agent-bubble">
                    Need help starting?
                  </span>
                </button>
              )}
              <h2 className="qm-quest-title">{typeof localQuest.title === "string" ? localQuest.title : ""}</h2>
              <p className="qm-quest-meta">
                {localQuest.category || "no category"} · {localQuest.points} pts
              </p>
              {localQuest.tags?.length > 0 && (
                <div className="qm-tag-list">
                  {localQuest.tags.map((t) => (
                    <span key={t} className="qm-cat-tag qm-cat-tag--readonly">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="qm-section-box">
              <label className="qm-label">description</label>
              <p className="qm-section-text">{typeof localQuest.description === "string" ? localQuest.description : ""}</p>
            </div>

            {aiOpen && (
              <div className="qm-section-box qm-ai-box">
                <div className="qm-ai-box-header">
                  <label className="qm-label">how to get started</label>
                  <button
                    className="qm-ai-close"
                    onClick={() => setAiOpen(false)}
                    title="close"
                  >
                    ×
                  </button>
                </div>
                {aiError ? (
                  <p className="qm-error">{aiError}</p>
                ) : (
                  <p className="qm-section-text qm-ai-text">
                    {aiText}
                    {aiStreaming && <span className="qm-ai-swirl" />}
                  </p>
                )}
                {!aiStreaming && (
                  <button
                    className="qm-btn-secondary qm-btn-secondary--sm qm-ai-regen"
                    onClick={() => handleAskForHelp(true)}
                  >
                    regenerate
                  </button>
                )}
              </div>
            )}

            <div className="qm-two-col">
              <div className="qm-section-box">
                <label className="qm-label">due date</label>
                <p className="qm-section-text">
                  {localQuest.dueDate
                    ? new Date(localQuest.dueDate).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              <div className="qm-section-box">
                <label className="qm-label">assigned to</label>
                <p className="qm-section-text">
                  {localQuest.assignedTo
                    ? localQuest.assignedTo.username
                    : "— unassigned"}
                </p>
              </div>
            </div>

            {/* ---- checklist ---- */}
            <div className="qm-section-box">
              <label className="qm-label">checklist</label>
              {checklist.length > 0 ? (
                <ul className="qm-checklist">
                  {checklist.map((item, i) => (
                    <li key={item._id || i} className="qm-checklist-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={!!item.done}
                          onChange={() => handleToggleChecklistItem(item)}
                        />
                        <span
                          className={item.done ? "qm-checklist-done" : ""}
                        >
                          {item.text}
                        </span>
                      </label>
                      {isOwner && (
                        <button
                          className="qm-attachment-remove"
                          onClick={() => handleRemoveChecklistItem(item)}
                          title="remove item"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="qm-comment-empty">no checklist items yet.</p>
              )}
              <div className="qm-comment-input-row">
                <input
                  className="qm-input"
                  placeholder="add a checklist item..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddChecklistItem();
                  }}
                />
                <button
                  className="qm-btn-secondary qm-btn-secondary--sm"
                  onClick={handleAddChecklistItem}
                  disabled={!newChecklistText.trim()}
                >
                  add
                </button>
              </div>
            </div>

            {/* ---- attachments ---- */}
            <div className="qm-section-box">
              <label className="qm-label">attachments</label>
              {attachments.length > 0 && (
                <ul className="qm-attachments">
                  {attachments.map((a) => (
                    <li key={a._id} className="qm-attachment-item">
                      <a href={a.url} target="_blank" rel="noreferrer">
                        {a.filename}
                      </a>
                      {isOwner && (
                        <button
                          className="qm-attachment-remove"
                          onClick={() => handleDeleteAttachment(a._id)}
                          title="remove attachment"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="qm-attachment-upload-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="qm-file-input"
                />
                <button
                  className="qm-btn-secondary qm-btn-secondary--sm"
                  onClick={handleUploadFile}
                  disabled={!pendingFile || uploadingFile}
                >
                  {uploadingFile ? "uploading..." : "attach pdf"}
                </button>
              </div>
            </div>

            {localQuest.status !== "Completed" && (
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
            {localQuest.status === "Completed" && !celebrate && (
              <div className="qm-completed-msg">
                quest completed!
                {localQuest.completedBy && (
                  <span className="qm-completed-by">
                    by {localQuest.completedBy.username || "a party member"}
                  </span>
                )}
              </div>
            )}

            {/* ---- edit history ---- */}
            {editHistory.length > 0 && (
              <div className="qm-section-box">
                <button
                  className="qm-history-toggle"
                  onClick={() => setShowHistory((v) => !v)}
                >
                  edit history ({editHistory.length}) {showHistory ? "▲" : "▼"}
                </button>
                {showHistory && (
                  <ul className="qm-history-list">
                    {editHistory
                      .slice()
                      .reverse()
                      .map((h, i) => (
                        <li key={h._id || i} className="qm-history-item">
                          <span className="qm-history-who">
                            {h.editedBy?.username || "someone"}
                          </span>{" "}
                          changed <strong>{fieldLabel(h.field)}</strong> from{" "}
                          <em>{String(h.oldValue ?? "—")}</em> to{" "}
                          <em>{String(h.newValue ?? "—")}</em>
                          <span className="qm-history-time">
                            {" "}
                            · {timeAgo(h.editedAt)}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}

            {/* ---- comments ---- */}
            <div className="qm-section-box">
              <label className="qm-label">comments</label>
              {comments.length > 0 ? (
                <ul className="qm-comments">
                  {comments.map((c) => (
                    <li key={c._id} className="qm-comment">
                      <div className="qm-comment-body">
                        <div className="qm-comment-meta">
                          <span className="qm-comment-author">
                            {c.author?.username || "party member"}
                          </span>
                          <span className="qm-comment-time">
                            {timeAgo(c.createdAt)}
                          </span>
                        </div>
                        <p className="qm-comment-text">{c.text}</p>
                      </div>
                      {(isOwner || c.isMine) && (
                        <button
                          className="qm-comment-remove"
                          onClick={() => handleDeleteComment(c._id)}
                          title="delete comment"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="qm-comment-empty">no comments yet.</p>
              )}
              <div className="qm-comment-input-row">
                <input
                  className="qm-input"
                  placeholder="leave a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePostComment();
                  }}
                />
                <button
                  className="qm-btn-secondary qm-btn-secondary--sm"
                  onClick={handlePostComment}
                  disabled={postingComment || !commentText.trim()}
                >
                  {postingComment ? "..." : "post"}
                </button>
              </div>
            </div>

            {isOwner && (
              <button
                className="qm-btn-delete"
                onClick={handleDelete}
                disabled={saving}
              >
                delete quest
              </button>
            )}
            {error && <p className="qm-error">{error}</p>}
          </>
        )}

        {celebrate && (
          <div className="qm-celebrate-overlay">
            <div className="qm-celebrate-flash" />
            <div className="qm-celebrate-burst" />
            {confettiBits.map((b) => (
              <span
                key={b.id}
                className="qm-confetti-bit"
                style={{
                  left: `${b.left}%`,
                  animationDelay: `${b.delay}s`,
                  animationDuration: `${b.duration}s`,
                  color: b.color,
                  "--drift": `${b.drift}px`,
                }}
              >
                {b.symbol}
              </span>
            ))}
            <div className="qm-celebrate-card">
              <div className="qm-celebrate-icon">🏆</div>
              <h2 className="qm-celebrate-title">quest complete!</h2>
              <p className="qm-celebrate-points">
                +{localQuest?.points ?? quest?.points ?? 0} pts
              </p>
              <button
                className="qm-btn-primary"
                onClick={() => {
                  setCelebrate(false);
                  onClose();
                }}
              >
                nice!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuestModal;