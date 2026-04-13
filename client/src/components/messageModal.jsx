import React, { useState } from "react";
import "../pages/styles/messageModal.css";

const AVATAR_MAP = {
  tomato: "🍅",
  frog: "🐸",
  fish: "🐟",
  mushroom: "🍄",
  apple: "🍎",
  snail: "🐌",
};

export default function MessageModal({
  partyMembers,
  currentUserId,
  api,
  onClose,
  onSent,
}) {
  const teammates = partyMembers.filter(
    (m) => m._id?.toString() !== currentUserId?.toString(),
  );

  const [recipientId, setRecipientId] = useState(teammates[0]?._id || "");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!text.trim() || !recipientId) return;
    setSending(true);
    setError("");
    try {
      await api.post("/dashboard/notifications/message", {
        recipientId,
        message: text.trim(),
      });
      setSent(true);
      onSent?.();
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(e.response?.data?.msg || "couldn't send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mm-overlay" onClick={onClose}>
      <div className="mm-card" onClick={(e) => e.stopPropagation()}>
        <button className="mm-close" onClick={onClose}>
          ✕
        </button>

        <h2 className="mm-title">✉️ message a teammate</h2>

        {teammates.length === 0 ? (
          <p className="mm-empty">
            no teammates yet! share your invite link to get started ✦
          </p>
        ) : sent ? (
          <div className="mm-sent">
            <div className="mm-sent-icon">🌿</div>
            <p>message sent!</p>
          </div>
        ) : (
          <>
            <div className="mm-field">
              <label className="mm-label">to</label>
              <div className="mm-recipient-row">
                {teammates.map((m) => (
                  <button
                    key={m._id}
                    className={`mm-recipient-btn${recipientId === m._id ? " selected" : ""}`}
                    onClick={() => setRecipientId(m._id)}
                  >
                    {AVATAR_MAP[m.avatarId] || "🐾"} {m.username}
                  </button>
                ))}
              </div>
            </div>

            <div className="mm-field">
              <label className="mm-label">message</label>
              <textarea
                className="mm-textarea"
                placeholder="type something nice..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={280}
              />
              <p className="mm-char-count">{text.length}/280</p>
            </div>

            {error && <p className="mm-error">{error}</p>}

            <button
              className="mm-send-btn"
              onClick={handleSend}
              disabled={sending || !text.trim() || !recipientId}
            >
              {sending ? "sending... ✦" : "send ✉️"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
