import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const CONVERSATION_ID = "companion"; // one running thread with the agent for now

function AgentModal({ screenPos, open, onToggle, onClose }) {
  const [messages, setMessages] = useState([]); // {role: "user"|"assistant", content}
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const token = localStorage.getItem("token");

  // connect once on mount so the socket's ready the moment someone clicks
  useEffect(() => {
    if (!token) return;

    const socket = io(`${API_URL}/ai`, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("ai:start", () => {
      setStreaming(true);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    });

    socket.on("ai:chunk", ({ chunk }) => {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: last.content + chunk,
          };
        }
        return updated;
      });
    });

    socket.on("ai:done", () => setStreaming(false));

    socket.on("ai:error", ({ msg }) => {
      setStreaming(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${msg || "Something went wrong."}` },
      ]);
    });

    socket.on("connect_error", (err) => {
      console.error("agent socket connection failed:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // auto-scroll to the newest message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  const sendPrompt = () => {
    const trimmed = input.trim();
    if (!trimmed || streaming || !socketRef.current) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    socketRef.current.emit("ai:prompt", {
      prompt: trimmed,
      conversationId: CONVERSATION_ID,
    });
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  };

  // nothing to draw if the agent is off-screen and the popup isn't open
  if (!screenPos?.visible && !open) return null;

  return (
    <>
      {screenPos?.visible && (
        <button
          className={`am-marker ${open ? "am-marker--active" : ""}`}
          style={{ left: screenPos.x, top: screenPos.y }}
          onClick={onToggle}
          title="Ask your companion"
        />
      )}

      {open && (
        <div
          className="am-popup"
          style={{
            left: screenPos ? screenPos.x : "50%",
            top: screenPos ? screenPos.y : "50%",
          }}
        >
          <div className="am-header">
            <p className="am-title">🌱 Your Companion</p>
            <button className="am-close" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="am-messages" ref={listRef}>
            {messages.length === 0 && (
              <p className="am-empty">
                Ask me anything about your quests, your streak, or just say hi ✦
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`am-bubble am-bubble--${m.role}`}>
                {m.content ? (
                  m.content
                ) : streaming && i === messages.length - 1 ? (
                  <span className="am-swirl" />
                ) : (
                  ""
                )}
              </div>
            ))}
          </div>

          <div className="am-input-row">
            <input
              className="am-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? "Ask something..." : "Connecting..."}
              disabled={!connected || streaming}
            />
            <button
              className="am-send"
              onClick={sendPrompt}
              disabled={!connected || streaming || !input.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default AgentModal;
