import React, { useEffect, useRef, useState } from "react";
import "./questModal.css";

const AVATAR_MAP = {
  tomato: "🍅",
  frog: "🐸",
  fish: "🐟",
  mushroom: "🍄",
  apple: "🍎",
  snail: "🐌",
};

const STATUS_COLOR = {
  "Not Started": "#f5a623",
  "In Progress": "#2196f3",
  Completed: "#4caf50",
};

const STATUS_ICON = {
  "Not Started": "🌱",
  "In Progress": "🌿",
  Completed: "🌳",
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

export const CATEGORY_ICON = {
  general: "🌿",
  fitness: "💪",
  study: "📚",
  chores: "🧹",
  creative: "🎨",
  social: "🎉",
  other: "🌰",
};

const COMPLETE_SOUND_SRC = "/sounds/complete.mp3";

const CONFETTI_EMOJI = ["✦", "⭐", "🌟", "✨", "🍀", "🎉"];

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
}) {
  const isNew = !quest;
  const isLocked = !quest && !isOwner;

  // Local mirror of the quest so comments / attachments / edits / history
  // can update in place without closing the modal after every action.
  const [localQuest, setLocalQuest] = useState(quest);
  useEffect(() => {
    setLocalQuest(quest);
  }, [quest?._id]);

  const applyUpdate = (updated) => {
    if (!updated) return;
    setLocalQuest(updated);
    onQuestUpdated?.(updated);
  };

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

  // ---- edit mode -----------------------------------------------------
  const [editing, setEditing] = useState(false);

  const startEditing = () => {
    setForm((p) => ({
      ...p,
      title: localQuest.title || "",
      description: localQuest.description || "",
      dueDate: localQuest.dueDate
        ? new Date(localQuest.dueDate).toISOString().split("T")[0]
        : "",
      category: localQuest.category || "general",
      points: localQuest.points || 5,
      assignedTo: localQuest.assignedTo?._id || "",
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
      });
      applyUpdate(res.data);
      setEditing(false);
    } catch (e) {
      setError(e.response?.data?.msg || "failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // ---- status / create / delete (unchanged behavior) -----------------
  const handleSaveStatus = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.put(`/quests/${quest._id}/status`, {
        status: form.status,
      });
      applyUpdate(res.data);
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

  // ---- completion + celebration ---------------------------------------
  const [celebrate, setCelebrate] = useState(false);
  const confettiBits = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: Math.round(Math.random() * 100),
      delay: (Math.random() * 0.6).toFixed(2),
      duration: (1.4 + Math.random() * 1.1).toFixed(2),
      emoji:
        CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)],
      drift: Math.round((Math.random() - 0.5) * 120),
    })),
  ).current;

  const handleComplete = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/quests/complete", { questId: quest._id });
      const updated =
        res.data && res.data._id ? res.data : { ...localQuest, status: "Completed" };
      applyUpdate(updated);
      setCelebrate(true);
      try {
        const audio = new Audio(COMPLETE_SOUND_SRC);
        audio.volume = 0.8;
        audio.play().catch(() => {});
      } catch {
        // sound is a nice-to-have, never block completion on it
      }
    } catch (e) {
      setError(e.response?.data?.msg || "failed to complete quest.");
    } finally {
      setSaving(false);
    }
  };

  // ---- comments ---------------------------------------------------------
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

  // ---- attachments (pdf) --------------------------------------------------
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
      // NOTE: assumes `api` won't force a JSON content-type header onto
      // this request — axios sets the multipart boundary itself when
      // given a FormData body, as long as nothing overrides it.
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

  return (
    <div className="qm-overlay" onClick={onClose}>
      <div className="qm-card" onClick={(e) => e.stopPropagation()}>
        <button className="qm-close" onClick={onClose}>
          ✕
        </button>

        {isLocked && (
          <div className="qm-locked">
            <div className="qm-locked-icon">🌰</div>
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
                    {CATEGORY_ICON[c] || "🌿"} {c}
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
              <textarea
                className="qm-textarea"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="what needs to be done?"
              />
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
              <FieldGroup label="points">
                <input
                  type="number"
                  min="1"
                  className="qm-input"
                  value={form.points}
                  onChange={(e) => set("points", Number(e.target.value) || 1)}
                />
              </FieldGroup>
            </div>
            <FieldGroup label="category">
              <select
                className="qm-select"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {[...CATEGORY_OPTIONS, ...customCategories].map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_ICON[c] || "🌿"} {c}
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
                    {AVATAR_MAP[m.avatarId] || "🐾"} {m.username}
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
                {STATUS_ICON[localQuest.status] || "✦"} {localQuest.status}
              </span>
              {isOwner && localQuest.status !== "Completed" && (
                <button className="qm-edit-toggle" onClick={startEditing}>
                  ✏️ edit
                </button>
              )}
              <h2 className="qm-quest-title">{localQuest.title}</h2>
              <p className="qm-quest-meta">
                {CATEGORY_ICON[localQuest.category] || "🌿"}{" "}
                {localQuest.category} · ⭐ {localQuest.points} pts
              </p>
            </div>
            <div className="qm-section-box">
              <label className="qm-label">description</label>
              <p className="qm-section-text">{localQuest.description}</p>
            </div>
            <div className="qm-two-col">
              <div className="qm-section-box">
                <label className="qm-label">due date</label>
                <p className="qm-section-text">
                  📅{" "}
                  {localQuest.dueDate
                    ? new Date(localQuest.dueDate).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              <div className="qm-section-box">
                <label className="qm-label">assigned to</label>
                <p className="qm-section-text">
                  {localQuest.assignedTo
                    ? `${AVATAR_MAP[localQuest.assignedTo.avatarId] || "🐾"} ${localQuest.assignedTo.username}`
                    : "— unassigned"}
                </p>
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
                        📄 {a.filename}
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
                      {STATUS_ICON[s]} {s}
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
            {localQuest.status !== "Completed" && (
              <button
                className="qm-btn-primary qm-btn-primary--complete"
                onClick={handleComplete}
                disabled={saving}
              >
                {saving ? "..." : "mark complete & claim points"}
              </button>
            )}
            {localQuest.status === "Completed" && !celebrate && (
              <div className="qm-completed-msg">
                ✓ quest completed!
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
                  📜 edit history ({editHistory.length}){" "}
                  {showHistory ? "▲" : "▼"}
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
                      <span className="qm-comment-avatar">
                        {AVATAR_MAP[c.author?.avatarId] || "🐾"}
                      </span>
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
                🗑 delete quest
              </button>
            )}
            {error && <p className="qm-error">{error}</p>}
          </>
        )}

        {celebrate && (
          <div className="qm-celebrate-overlay">
            {confettiBits.map((b) => (
              <span
                key={b.id}
                className="qm-confetti-bit"
                style={{
                  left: `${b.left}%`,
                  animationDelay: `${b.delay}s`,
                  animationDuration: `${b.duration}s`,
                  "--drift": `${b.drift}px`,
                }}
              >
                {b.emoji}
              </span>
            ))}
            <div className="qm-celebrate-card">
              <div className="qm-celebrate-icon">🏆</div>
              <h2 className="qm-celebrate-title">quest complete!</h2>
              <p className="qm-celebrate-points">
                +{localQuest?.points ?? quest?.points ?? 0} pts ✦
              </p>
              <button
                className="qm-btn-primary"
                onClick={() => {
                  setCelebrate(false);
                  onClose();
                }}
              >
                nice! ✦
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuestModal;
