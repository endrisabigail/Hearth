import React, { useState } from "react";

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

export default QuestModal;
