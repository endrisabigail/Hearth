import { useState } from "react";
import { motion } from "motion/react";
import { Modal, ModalHeader, Button, EmptyState } from "../ui/primitives.jsx";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import { avatarFor, categoryIcon, themeFor } from "../../lib/avatars.js";
import { api, errMsg } from "../../lib/api.js";

const badgeEmoji = (name = "") => (name.includes("First") ? "🌱" : name.match(/Level (\d+)/) ? (Number(name.match(/Level (\d+)/)[1]) >= 60 ? "🏆" : Number(name.match(/Level (\d+)/)[1]) >= 40 ? "🌳" : "🌿") : "🏅");

export default function Passport({ open, onClose, user, toast }) {
  const [neighbor, setNeighbor] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const av = avatarFor(user.avatarId);
  const points = Object.entries(user.points || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(20, ...points.map((p) => p[1]));
  const badges = [...(user.badges || [])].sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));

  const addNeighbor = async (e) => {
    e.preventDefault();
    if (!neighbor.trim()) return;
    setBusy(true);
    try {
      const r = await api.post("/dashboard/neighbor/request", { username: neighbor.trim() });
      toast(r.data.msg || "Request sent", { icon: "🤝" });
      setNeighbor("");
    } catch (err) {
      toast(errMsg(err, "Couldn't send that request."), { tone: "error" });
    }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} label="Passport" wide className="passport">
      <ModalHeader title="Passport" onClose={onClose} />
      <div className="modal__body passport__body">
        <section className="passport__id">
          <div className="passport__photo">
            <Avatar avatarId={user.avatarId} size={112} />
          </div>
          <div>
            <h3 className="passport__name">{user.username}</h3>
            <p className="passport__rank">{user.rank} · {av.title}</p>
            <p className="muted">Home plaza: {themeFor(user.avatarId).name}</p>
          </div>
          <dl className="stats">
            <div>
              <dt>Points</dt>
              <dd><Icon name="coin" size={16} /> {user.totalPoints || 0}</dd>
            </div>
            <div>
              <dt>Streak</dt>
              <dd><Icon name="flame" size={16} /> {user.streak?.current || 0}d</dd>
            </div>
            <div>
              <dt>Best streak</dt>
              <dd>{user.streak?.longest || 0}d</dd>
            </div>
            <div>
              <dt>Badges</dt>
              <dd>{badges.length}</dd>
            </div>
          </dl>
        </section>

        <section className="qsec">
          <h3>Points by category</h3>
          {points.length === 0 ? (
            <p className="muted">Complete a quest to start filling these in.</p>
          ) : (
            <ul className="bars">
              {points.map(([cat, v], i) => (
                <li key={cat}>
                  <span className="bars__label">{categoryIcon(cat)} {cat}</span>
                  <span className="bars__track">
                    <motion.span className="bars__fill" initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }} transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 120, damping: 20 }} />
                  </span>
                  <span className="bars__val">{v}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="qsec">
          <h3>Stamps</h3>
          {badges.length === 0 ? (
            <EmptyState emoji="📭" title="No stamps yet">Your first completed quest in a category earns one.</EmptyState>
          ) : (
            <ul className="stamps">
              {badges.map((b, i) => (
                <motion.li key={b.badgeName} className="stamp" initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: ((i % 3) - 1) * 2, opacity: 1 }} transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 18 }} title={b.badgeDescription}>
                  <span className="stamp__emoji">{badgeEmoji(b.badgeName)}</span>
                  <span className="stamp__name">{b.badgeName}</span>
                  <span className="stamp__date">{new Date(b.earnedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        <section className="qsec">
          <h3>Neighbors</h3>
          <div className="neighbors">
            {(user.neighbors || []).map((n) => (
              <span key={n._id} className="neighbor">
                <Avatar avatarId={n.avatarId} size={32} /> {n.username}
              </span>
            ))}
            {(user.neighbors || []).length === 0 && <p className="muted">Neighbors are friends from other parties.</p>}
          </div>
          <form className="inline-add" onSubmit={addNeighbor}>
            <input className="input" value={neighbor} onChange={(e) => setNeighbor(e.target.value)} placeholder="Their username" />
            <Button size="sm" type="submit" icon="plus" loading={busy} disabled={!neighbor.trim()}>Send request</Button>
          </form>
        </section>
      </div>
    </Modal>
  );
}
