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

function seenKey(currentUserId, otherId) {
  return `hearth_chat_seen_${currentUserId}_${otherId}`;
}
function getSeenAt(currentUserId, otherId) {
  return Number(localStorage.getItem(seenKey(currentUserId, otherId)) || 0);
}
function markSeen(currentUserId, otherId) {
  localStorage.setItem(seenKey(currentUserId, otherId), Date.now().toString());
}

export default function MessageModal({
  partyMembers,
  currentUserId,
  api,
  onClose,
  onSent,
  onThreadOpened,
}) {
  const teammates = partyMembers.filter(
    (m) => m._id?.toString() !== currentUserId?.toString(),
  );
  const teammateIds = teammates.map((m) => m._id).join(",");

  // "list" = pick who to message (like the iMessage inbox), "thread" = the
  // actual conversation with one person
  const [view, setView] = useState("list");
  const [recipientId, setRecipientId] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const bottomRef = useRef(null);

  // Load every teammate's history up front so the list view can show a
  // preview + unread state for each conversation, iMessage-inbox style.
  useEffect(() => {
    if (!teammates.length) {
      setLoadingList(false);
      return;
    }
    let cancelled = false;
    setLoadingList(true);

    Promise.all(
      teammates.map((m) =>
        api
          .get(`/dashboard/notifications/messages/${m._id}`)
          .then((res) => [m._id, res.data || []])
          .catch(() => [m._id, []]),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setHistory((prev) => {
        const next = { ...prev };
        entries.forEach(([id, msgs]) => {
          next[id] = msgs;
        });
        return next;
      });
      setLoadingList(false);
    });

    return () => {
      cancelled = true;
    };
  }, [teammateIds]);

  // Scroll to bottom when a thread's messages load or a new one arrives
  useEffect(() => {
    if (view === "thread") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [history, recipientId, view]);

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

  // compose/conversation section attempting to replicate regular texting type of structure.
  // conversations preview for the list of convo options, most recent activity/convo first. 
  const conversations = teammates
    .map((m) => {
      const msgs = history[m._id] || [];
      const lastMessage = msgs.length ? msgs[msgs.length - 1] : null;
      const isUnread =
        !!lastMessage &&
        lastMessage.senderId?.toString() !== currentUserId?.toString() &&
        new Date(lastMessage.createdAt).getTime() >
        getSeenAt(currentUserId, m._id);
      return { member: m, lastMessage, isUnread };
    })
    .sort((a, b) => {
      const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at;
    });

  const openThread = (id) => {
    setRecipientId(id);
    setView("thread");
    setError("");
    markSeen(currentUserId, id);
    onThreadOpened?.(id);
  };

  const backToList = () => {
    setView("list");
    setRecipientId(null);
    setError("");
  };

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

      // replace optimistic message with real one
      setHistory((prev) => ({
        ...prev,
        [recipientId]: (prev[recipientId] || []).map((m) =>
          m._id === optimisticMsg._id
            ? res.data || { ...optimisticMsg, pending: false }
            : m,
        ),
      }));

      onSent?.(recipientId);
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

  const recipient = teammates.find((m) => m._id === recipientId);

  return (
    <div className="mm-overlay" onClick={onClose}>
      <div
        className="mm-card mm-card--chat"
        onClick={(e) => e.stopPropagation()}
      >
        {view === "list" ? (
          <>
            {/* List header */}
            <div className="mm-header">
              <span className="mm-header-title">✉️ messages</span>
              <button className="mm-close" onClick={onClose}>
                ✕
              </button>
            </div>

            {/* Conversation list */}
            <div className="mm-list">
              {loadingList ? (
                <p className="mm-loading">loading messages... ✦</p>
              ) : conversations.length === 0 ? (
                <p className="mm-empty-inline">no teammates yet!</p>
              ) : (
                conversations.map(({ member, lastMessage, isUnread }) => (
                  <button
                    key={member._id}
                    className={`mm-convo-row${isUnread ? " unread" : ""}`}
                    onClick={() => openThread(member._id)}
                  >
                    <div className="mm-convo-avatar">
                      {AVATAR_MAP[member.avatarId] || "🐾"}
                    </div>
                    <div className="mm-convo-body">
                      <div className="mm-convo-top">
                        <span className="mm-convo-name">{member.username}</span>
                        {lastMessage && (
                          <span className="mm-convo-time">
                            {formatTime(lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="mm-convo-preview">
                        {lastMessage
                          ? `${lastMessage.senderId?.toString() ===
                            currentUserId?.toString()
                            ? "you: "
                            : ""
                          }${lastMessage.message}`
                          : "say hi to your neighbor! ✦"}
                      </p>
                    </div>
                    {isUnread && <div className="mm-convo-dot" />}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Thread header */}
            <div className="mm-header">
              <button className="mm-back-btn" onClick={backToList}>
                ←
              </button>
              <div className="mm-thread-title">
                <span className="mm-thread-avatar">
                  {AVATAR_MAP[recipient?.avatarId] || "🐾"}
                </span>
                <span className="mm-thread-name">{recipient?.username}</span>
              </div>
              <button className="mm-close" onClick={onClose}>
                ✕
              </button>
            </div>

            {/* Chat history */}
            <div className="mm-history">
              {currentMessages.length === 0 ? (
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
          </>
        )}
      </div>
    </div>
  );
}
  