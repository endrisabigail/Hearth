import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Modal, ModalHeader, Button, IconButton } from "../ui/primitives.jsx";
import Avatar from "../ui/Avatar.jsx";
import { api, connectSocket } from "../../lib/api.js";

const CONVO = "companion";
const STARTERS = ["What should I do first today?", "I'm stuck. Help me get going?", "Give me a pep talk 🌱"];

export default function Companion({ open, onClose, avatarId, name, quests }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const sock = useRef(null);
  const list = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!open) return;
    const s = connectSocket("/ai");
    sock.current = s;
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("ai:start", () => {
      setStreaming(true);
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
    });
    s.on("ai:chunk", ({ chunk }) =>
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + chunk };
        return next;
      }),
    );
    s.on("ai:done", () => setStreaming(false));
    s.on("ai:error", ({ msg }) => {
      setStreaming(false);
      setMessages((m) => [...m, { role: "assistant", content: msg || "I lost my train of thought. Ask again?", error: true }]);
    });
    if (!loaded.current) {
      loaded.current = true;
      api.get(`/ai/history/${CONVO}`).then((r) => setMessages(r.data.map((x) => ({ role: x.role, content: x.content })))).catch(() => {});
    }
    return () => {
      s.disconnect();
      sock.current = null;
      setConnected(false);
      setStreaming(false);
    };
  }, [open]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = (prompt) => {
    const p = (prompt ?? text).trim();
    if (!p || streaming || !sock.current) return;
    const open = quests.filter((q) => q.status !== "Completed").slice(0, 6).map((q) => q.title);
    const context = open.length && messages.length === 0 ? `\n\n(My open quests: ${open.join("; ")})` : "";
    setMessages((m) => [...m, { role: "user", content: p }]);
    sock.current.emit("ai:prompt", { prompt: p + context, conversationId: CONVO });
    setText("");
  };

  const clear = async () => {
    await api.delete(`/ai/history/${CONVO}`).catch(() => {});
    setMessages([]);
  };

  return (
    <Modal open={open} onClose={onClose} label={`Chat with ${name}`} className="pal">
      <ModalHeader title={name} onClose={onClose}>
        <span className={`conn ${connected ? "is-on" : ""}`}>{connected ? "here" : "waking up"}</span>
        {messages.length > 0 && <IconButton icon="refresh" label="Start over" onClick={clear} className="icon-btn--flat" size={18} />}
      </ModalHeader>
      <div className="modal__body chat" ref={list}>
        {messages.length === 0 && (
          <div className="pal__intro">
            <Avatar avatarId={avatarId} companion size={88} />
            <p>Hi! I'm {name}. I know your quests and I'm good at turning big scary ones into tiny first steps.</p>
            <div className="chips">
              {STARTERS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)} disabled={!connected}>{s}</button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} className={`bubble ${m.role === "user" ? "bubble--me" : "bubble--pal"} ${m.error ? "bubble--error" : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {m.content ? <p>{m.content.replace(/\n\n\(My open quests:[^)]*\)$/, "")}</p> : <span className="typing"><i /><i /><i /></span>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ask ${name} anything`} disabled={!connected} data-autofocus />
        <Button type="submit" variant="primary" icon="send" disabled={!text.trim() || streaming || !connected} aria-label="Send" />
      </form>
    </Modal>
  );
}
