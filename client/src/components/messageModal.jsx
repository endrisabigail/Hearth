import React, { useState, useEffect, useRef } from "react";
import "../pages/styles/messageModal.css";

const AVATAR_MAP = {
  tomato: "🍅",
  frog: "🐸",
  fish: "🐟",
  mushroom: "🍄",
  apple: "🍎",
  snail: "🐌",
};

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "today";
  if (d.toDateString() === yesterday.toDateString()) return "yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

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
  const [error, setError] = useState("");
  const [history, setHistory] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef(null);

  // Fetch message history when recipient changes
  useEffect(() => {
    if (!recipientId) return;
    if (history[recipientId]) return; // already loaded

    setLoadingHistory(true);
    api
      .get(`/dashboard/notifications/messages/${recipientId}`)
      .then((res) => {
        setHistory((prev) => ({ ...prev, [recipientId]: res.data || [] }));
      })
      .catch(() => {
        setHistory((prev) => ({ ...prev, [recipientId]: [] }));
      })
      .finally(() => setLoadingHistory(false));
  }, [recipientId]);

  // Scroll to bottom when messages load or new one arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, recipientId]);

  const currentMessages = history[recipientId] || [];

  // Group messages by date for date separators
  const grouped = currentMessages.reduce((acc, msg) => {
    const label = formatDateLabel(msg.createdAt);
    if (!acc.length || acc[acc.length - 1].label !== label) {
      acc.push({ label, messages: [msg] });
    } else {
      acc[acc.length - 1].messages.push(msg);
    }
    return acc;
  }, []);

  const handleSend = async () => {
    if (!text.trim() || !recipientId) return;
    setSending(true);
    setError("");

    const optimisticMsg = {
      _id: `temp-${Date.now()}`,
      senderId: currentUserId,
      recipientId,
      message: text.trim(),
      createdAt: new Date().toISOString(),
      pending: true,
    };

    // Optimistically add to history
    setHistory((prev) => ({
      ...prev,
      [recipientId]: [...(prev[recipientId] || []), optimisticMsg],
    }));
    setText("");

    try {
      const res = await api.post("/dashboard/notifications/message", {
        recipientId,
        message: optimisticMsg.message,
      });

      // Replace optimistic message with real one
      setHistory((prev) => ({
        ...prev,
        [recipientId]: (prev[recipientId] || []).map((m) =>
          m._id === optimisticMsg._id
            ? res.data || { ...optimisticMsg, pending: false }
            : m,
        ),
      }));

      onSent?.();
    } catch (e) {
      setError(e.response?.data?.msg || "couldn't send message.");
      // Remove failed optimistic message
      setHistory((prev) => ({
        ...prev,
        [recipientId]: (prev[recipientId] || []).filter(
          (m) => m._id !== optimisticMsg._id,
        ),
      }));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mm-overlay" onClick={onClose}>
      <div
        className="mm-card mm-card--chat"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mm-header">
          <div className="mm-recipient-row">
            {teammates.length === 0 ? (
              <span className="mm-empty-inline">no teammates yet!</span>
            ) : (
              teammates.map((m) => (
                <button
                  key={m._id}
                  className={`mm-recipient-btn${recipientId === m._id ? " selected" : ""}`}
                  onClick={() => setRecipientId(m._id)}
                >
                  {AVATAR_MAP[m.avatarId] || "🐾"} {m.username}
                </button>
              ))
            )}
          </div>
          <button className="mm-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Chat history */}
        <div className="mm-history">
          {loadingHistory ? (
            <p className="mm-loading">loading messages... ✦</p>
          ) : currentMessages.length === 0 ? (
            <p className="mm-no-history">
              no messages yet...greet your new neighbor!
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.label}>
                <div className="mm-date-label">{group.label}</div>
                {group.messages.map((msg) => {
                  const isMine =
                    msg.senderId?.toString() === currentUserId?.toString();
                  const sender = partyMembers.find(
                    (m) => m._id?.toString() === msg.senderId?.toString(),
                  );
                  return (
                    <div
                      key={msg._id}
                      className={`mm-message-row${isMine ? " mm-message-row--mine" : ""}`}
                    >
                      {!isMine && (
                        <div className="mm-avatar">
                          {AVATAR_MAP[sender?.avatarId] || "🐾"}
                        </div>
                      )}
                      <div className="mm-bubble-wrap">
                        <div
                          className={`mm-bubble${isMine ? " mm-bubble--mine" : ""}${msg.pending ? " mm-bubble--pending" : ""}`}
                        >
                          {msg.message}
                        </div>
                        <div
                          className={`mm-time${isMine ? " mm-time--mine" : ""}`}
                        >
                          {formatTime(msg.createdAt)}
                          {msg.pending && " ·sending"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        {teammates.length > 0 && (
          <div className="mm-input-bar">
            <textarea
              className="mm-textarea"
              placeholder="type your message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={280}
              rows={1}
            />
            <div className="mm-input-meta">
              <span className="mm-char-count">{text.length}/280</span>
              <button
                className="mm-send-btn"
                onClick={handleSend}
                disabled={sending || !text.trim() || !recipientId}
              >
                {sending ? "✦" : "✉️"}
              </button>
            </div>
            {error && <p className="mm-error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
