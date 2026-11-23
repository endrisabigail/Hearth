import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Icon from "../ui/Icon.jsx";
import Avatar from "../ui/Avatar.jsx";
import { AnimatedNumber, IconButton, Button } from "../ui/primitives.jsx";
import { categoryIcon, PRIORITY } from "../../lib/avatars.js";
import { dueInfo, timeAgo } from "../../lib/format.js";
import { isMessage } from "../../lib/usePlazaData.js";
import { api } from "../../lib/api.js";

const NOTIF_ICON = {
  quest_complete: "⚔️",
  badge_earned: "🏅",
  member_joined: "🏡",
  quest_assigned: "📜",
  streak_milestone: "🔥",
  neighbor_request: "🤝",
  neighbor_accepted: "🌿",
};

export function TopBar({ theme, party, user, notifications, unreadMail, onMail, onPassport, onMarkRead, toast }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const bell = notifications.filter((n) => !isMessage(n));
  const unread = bell.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const close = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const accept = async (n) => {
    try {
      await api.post("/dashboard/neighbor/accept", { fromUserId: n.fromUser?._id });
      toast(`You and ${n.fromUser?.username} are neighbors now`, { icon: "🌿" });
    } catch {
      toast("Couldn't accept that request", { tone: "error" });
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__place sticker">
        <img src="/hearth-mark.png" alt="Hearth" className="topbar__mark" />
        <div className="topbar__names">
          <span className="topbar__party">{party?.name || "Your Hearth"}</span>
          <span className="topbar__plaza">{theme.name}</span>
        </div>
      </div>
      <div className="topbar__right">
        <div className="pill sticker" data-tip={`Streak: ${user?.streak?.current || 0} days (best ${user?.streak?.longest || 0})`}>
          <Icon name="flame" size={18} className="pill__flame" />
          <AnimatedNumber value={user?.streak?.current || 0} />
        </div>
        <button className="pill pill--coins sticker" onClick={onPassport} data-tip="Points earned. Open your passport">
          <Icon name="coin" size={18} className="pill__coin" />
          <AnimatedNumber value={user?.totalPoints || 0} className="coins-value" />
        </button>
        <IconButton icon="mail" label="Messages (M)" badge={unreadMail} onClick={onMail} className={unreadMail ? "is-wiggle" : ""} />
        <div className="bell-wrap" ref={wrap}>
          <IconButton icon="bell" label="Notifications" badge={unread} onClick={() => setOpen((o) => !o)} aria-expanded={open} />
          <AnimatePresence>
            {open && (
              <motion.div className="popover sticker" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
                <div className="popover__head">
                  <h3>Notifications</h3>
                  {unread > 0 && (
                    <button className="link-btn" onClick={onMarkRead}>
                      Mark all read
                    </button>
                  )}
                </div>
                <ul className="notif-list">
                  {bell.length === 0 && <li className="notif-empty">Nothing yet. Completed quests and new teammates show up here.</li>}
                  {bell.map((n) => (
                    <li key={n._id} className={`notif ${n.read ? "" : "is-unread"}`}>
                      <span className="notif__icon">{NOTIF_ICON[n.type] || "🔔"}</span>
                      <div className="notif__body">
                        <p>{n.message}</p>
                        <span className="notif__time">{timeAgo(n.createdAt)}</span>
                        {n.type === "neighbor_request" && n.fromUser && (
                          <Button size="sm" variant="primary" onClick={() => accept(n)}>
                            Accept
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button className="me-btn" onClick={onPassport} aria-label="Open your passport" data-tip="Passport (P)">
          <Avatar avatarId={user?.avatarId} size={44} />
        </button>
      </div>
    </header>
  );
}

export function PartyRail({ members, online, me, onMessage, onInvite }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside className={`rail sticker ${collapsed ? "is-collapsed" : ""}`} aria-label="Party">
      <button className="rail__toggle" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Show party" : "Hide party"} data-tip={collapsed ? "Show party" : "Hide party"}>
        <Icon name="users" size={18} />
        <span className="rail__count">{members.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.ul className="rail__list" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {members.map((m, i) => {
              const isMe = m._id === me;
              const live = isMe || online.has(m._id);
              return (
                <li key={m._id}>
                  <button className="rail__member" onClick={() => !isMe && onMessage(m._id)} disabled={isMe} data-tip={isMe ? "You" : `Message ${m.username}`}>
                    <Avatar avatarId={m.avatarId} size={40} live={live} ring={i === 0 ? "var(--accent-2)" : undefined} />
                    {i === 0 && <span className="rail__crown" aria-label="Party lead">👑</span>}
                    <span className="rail__name">{isMe ? "you" : m.username}</span>
                  </button>
                </li>
              );
            })}
            <li>
              <button className="rail__invite" onClick={onInvite} data-tip="Copy invite link">
                <Icon name="plus" size={18} />
              </button>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </aside>
  );
}

export function FocusCard({ quest, isLead, onOpen, onGo, onAdd }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) {
    return (
      <button className="focus-chip sticker" onClick={() => setHidden(false)} data-tip="Show up next">
        <Icon name="target" size={18} />
      </button>
    );
  }
  const due = quest ? dueInfo(quest.dueDate) : null;
  const done = quest?.checklist?.filter((c) => c.done).length || 0;
  const total = quest?.checklist?.length || 0;
  return (
    <motion.section className="focus sticker" layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      <div className="focus__head">
        <h3>Up next</h3>
        <IconButton icon="close" label="Hide" size={16} className="icon-btn--flat icon-btn--sm" onClick={() => setHidden(true)} />
      </div>
      {quest ? (
        <>
          <button className="focus__title" onClick={() => onOpen(quest)}>
            <span className="focus__cat">{categoryIcon(quest.category)}</span>
            {quest.title}
          </button>
          <p className={`focus__due tone-${due.tone}`}>
            <Icon name="clock" size={14} /> {due.label}
          </p>
          {total > 0 && (
            <div className="meter" aria-label={`${done} of ${total} steps done`}>
              <span style={{ width: `${(done / total) * 100}%` }} />
            </div>
          )}
          <div className="focus__foot">
            {quest.assignedTo ? (
              <span className="focus__who">
                <Avatar avatarId={quest.assignedTo.avatarId} size={22} /> {quest.assignedTo.username}
              </span>
            ) : (
              <span className="focus__who muted">Unassigned</span>
            )}
            <Button size="sm" icon="walk" onClick={() => onGo(quest)}>
              Walk there
            </Button>
          </div>
        </>
      ) : (
        <div className="focus__empty">
          <p>No open quests. {isLead ? "Plant one and it'll appear in the plaza." : "Your party lead adds quests here."}</p>
          {isLead && (
            <Button size="sm" variant="primary" icon="plus" onClick={onAdd}>
              New quest
            </Button>
          )}
        </div>
      )}
    </motion.section>
  );
}

export function Dock({ isLead, onBoard, onAdd, onCompanion, onSettings, onEmote, onPlazas, openCount }) {
  return (
    <nav className="dock sticker" aria-label="Plaza actions">
      <IconButton icon="board" label="Quest log (Q)" badge={openCount} onClick={onBoard} />
      <IconButton icon="map" label="Visit other plazas" onClick={onPlazas} />
      {isLead && (
        <button className="dock__add" onClick={onAdd} aria-label="New quest (N)" data-tip="New quest (N)">
          <Icon name="plus" size={26} stroke={2.6} />
        </button>
      )}
      <IconButton icon="wave" label="Wave (or Space to jump)" onClick={onEmote} />
      <IconButton icon="sparkle" label="Ask your companion (C)" onClick={onCompanion} />
      <IconButton icon="settings" label="Settings" onClick={onSettings} />
    </nav>
  );
}

export function ProximityPrompt({ quest, onOpen }) {
  return (
    <AnimatePresence>
      {quest && (
        <motion.button key={quest._id} className="prompt sticker" onClick={() => onOpen(quest)} initial={{ y: 16, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 10, opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
          <kbd>E</kbd>
          <span className="prompt__text">
            Open <strong>{quest.title}</strong>
          </span>
          <span className="prompt__dot" style={{ background: PRIORITY[quest.priority]?.color }} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export function Minimap({ getData }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    let last = 0;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 120) return;
      last = now;
      const c = ref.current;
      const d = getData();
      if (!c || !d) return;
      const g = c.getContext("2d");
      const S = c.width;
      const k = (S / 2 - 6) / d.bounds;
      g.clearRect(0, 0, S, S);
      const style = getComputedStyle(c);
      g.fillStyle = style.getPropertyValue("--mm-fill") || "#fff";
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - 3, 0, Math.PI * 2);
      g.fill();
      const tx = (x) => S / 2 + x * k;
      const tz = (z) => S / 2 + z * k;
      d.quests.forEach((q) => {
        g.fillStyle = q.color;
        g.beginPath();
        g.arc(tx(q.x), tz(q.z), 4, 0, Math.PI * 2);
        g.fill();
      });
      g.fillStyle = "#4fae6a";
      d.others.forEach((o) => {
        g.beginPath();
        g.arc(tx(o.x), tz(o.z), 3.5, 0, Math.PI * 2);
        g.fill();
      });
      const px = tx(d.player.x);
      const pz = tz(d.player.z);
      g.save();
      g.translate(px, pz);
      g.rotate(-d.player.h + Math.PI);
      g.fillStyle = style.getPropertyValue("--mm-me") || "#222";
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(5, 5);
      g.lineTo(0, 2.5);
      g.lineTo(-5, 5);
      g.closePath();
      g.fill();
      g.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getData]);
  return (
    <div className="minimap sticker" aria-hidden="true">
      <canvas ref={ref} width="132" height="132" />
    </div>
  );
}

export function ControlsHint({ show, onDone }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDone, 9000);
    return () => clearTimeout(t);
  }, [show]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="hint sticker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} onClick={onDone}>
          <div className="hint__keys">
            <span />
            <kbd>W</kbd>
            <span />
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd>
          </div>
          <p>
            Walk with <strong>WASD</strong> or arrows, or click the ground. Walk up to a glowing quest and press <kbd>E</kbd>.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LoadingVeil({ show, theme, progress }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="veil" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }}>
          <div className="veil__inner">
            <img src="/hearth-mark.png" alt="" className="veil__mark" />
            <p className="veil__title">{theme?.name || "Hearth"}</p>
            <p className="veil__line">{theme?.tagline}</p>
            <div className="meter meter--veil">
              <span style={{ width: `${Math.round((progress || 0.05) * 100)}%` }} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CompanionMarker({ pos, name, onClick, active }) {
  if (!pos?.visible) return null;
  return (
    <button className={`pal-marker ${active ? "is-active" : ""}`} style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }} onClick={onClick} aria-label={`Talk to ${name}`}>
      <span className="pal-marker__bubble">
        <Icon name="sparkle" size={14} />
      </span>
    </button>
  );
}
