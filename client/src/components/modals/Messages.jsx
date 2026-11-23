import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Modal, ModalHeader, Button, EmptyState } from "../ui/primitives.jsx";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import { isMessage, parseMessage } from "../../lib/usePlazaData.js";
import { timeAgo } from "../../lib/format.js";
import { errMsg } from "../../lib/api.js";

const seenKey = (me, other) => `hearth_seen_${me}_${other}`;
export const lastSeen = (me, other) => Number(localStorage.getItem(seenKey(me, other)) || 0);
const markSeen = (me, other) => localStorage.setItem(seenKey(me, other), String(Date.now()));

export function buildThreads(notifications, sent, members, me) {
  const mates = members.filter((m) => m._id !== me);
  return mates
    .map((m) => {
      const incoming = notifications
        .filter((n) => isMessage(n) && (n.fromUser?._id || n.fromUser) === m._id)
        .map((n) => ({ id: n._id, from: m._id, text: parseMessage(n), at: n.createdAt }));
      const outgoing = sent.filter((s) => s.to === m._id).map((s, i) => ({ id: `s${i}${s.at}`, from: me, text: s.text, at: s.at }));
      const msgs = [...incoming, ...outgoing].sort((a, b) => new Date(a.at) - new Date(b.at));
      const last = msgs[msgs.length - 1];
      const unread = incoming.filter((x) => new Date(x.at).getTime() > lastSeen(me, m._id)).length;
      return { member: m, msgs, last, unread };
    })
    .sort((a, b) => new Date(b.last?.at || 0) - new Date(a.last?.at || 0));
}

export default function Messages({ open, onClose, initialTo, notifications, sent, members, me, onSend, onSeen, toast }) {
  const [to, setTo] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef(null);
  const threads = useMemo(() => buildThreads(notifications, sent, members, me), [notifications, sent, members, me]);
  const thread = threads.find((t) => t.member._id === to);

  useEffect(() => {
    if (open) setTo(initialTo || null);
  }, [open, initialTo]);

  useEffect(() => {
    if (to && open) {
      markSeen(me, to);
      onSeen?.();
    }
    bottom.current?.scrollIntoView({ block: "end" });
  }, [to, open, thread?.msgs.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !to) return;
    setSending(true);
    try {
      await onSend(to, text.trim());
      setText("");
    } catch (err) {
      toast(errMsg(err, "Message didn't send. Try again."), { tone: "error" });
    }
    setSending(false);
  };

  return (
    <Modal open={open} onClose={onClose} label="Messages" className="msgs">
      {!thread ? (
        <>
          <ModalHeader title="Messages" onClose={onClose} />
          <div className="modal__body">
            {threads.length === 0 ? (
              <EmptyState emoji="📮" title="No teammates yet">
                Invite friends from Settings and you can message them here.
              </EmptyState>
            ) : (
              <ul className="threads">
                {threads.map((t) => (
                  <li key={t.member._id}>
                    <button className={`thread ${t.unread ? "is-unread" : ""}`} onClick={() => setTo(t.member._id)}>
                      <Avatar avatarId={t.member.avatarId} size={44} />
                      <span className="thread__text">
                        <span className="thread__name">{t.member.username}</span>
                        <span className="thread__preview">{t.last ? `${t.last.from === me ? "You: " : ""}${t.last.text}` : "Say hi"}</span>
                      </span>
                      <span className="thread__side">
                        {t.last && <span className="thread__time">{timeAgo(t.last.at)}</span>}
                        {t.unread > 0 && <span className="thread__badge">{t.unread}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          <ModalHeader title={thread.member.username} onBack={() => setTo(null)} onClose={onClose}>
            <Avatar avatarId={thread.member.avatarId} size={30} />
          </ModalHeader>
          <div className="modal__body chat">
            {thread.msgs.length === 0 && <p className="chat__empty">This is the start of your messages with {thread.member.username}.</p>}
            <AnimatePresence initial={false}>
              {thread.msgs.map((m) => (
                <motion.div key={m.id} className={`bubble ${m.from === me ? "bubble--me" : ""}`} initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                  <p>{m.text}</p>
                  <span>{timeAgo(m.at)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bottom} />
          </div>
          <form className="composer" onSubmit={send}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${thread.member.username}`} autoFocus maxLength={500} />
            <Button type="submit" variant="primary" icon="send" loading={sending} disabled={!text.trim()} aria-label="Send" />
          </form>
          <p className="composer__note">Messages arrive as notifications. Only you can see the ones you've sent, on this device.</p>
        </>
      )}
    </Modal>
  );
}
