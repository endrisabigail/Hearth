import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Modal, ModalHeader, Segmented, Button, EmptyState } from "../ui/primitives.jsx";
import Icon from "../ui/Icon.jsx";
import Avatar from "../ui/Avatar.jsx";
import { categoryIcon, PRIORITY, STATUS } from "../../lib/avatars.js";
import { dueInfo, timeAgo } from "../../lib/format.js";

const PRI_ORDER = { high: 0, medium: 1, low: 2 };

export default function QuestLog({ open, onClose, quests, me, isLead, onOpen, onGo, onAdd }) {
  const [tab, setTab] = useState("open");
  const [scope, setScope] = useState("all");
  const [sort, setSort] = useState("due");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    let l = quests.filter((x) => (tab === "open" ? x.status !== "Completed" : x.status === "Completed"));
    if (scope === "mine") l = l.filter((x) => x.assignedTo?._id === me);
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((x) => x.title.toLowerCase().includes(s) || x.description?.toLowerCase().includes(s) || (x.tags || []).some((t) => t.toLowerCase().includes(s)));
    }
    const by = {
      due: (a, b) => new Date(a.dueDate || 8e15) - new Date(b.dueDate || 8e15),
      priority: (a, b) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority],
      points: (a, b) => b.points - a.points,
      recent: (a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt),
    };
    return [...l].sort(tab === "done" ? by.recent : by[sort]);
  }, [quests, tab, scope, sort, q, me]);

  const total = quests.length;
  const done = quests.filter((x) => x.status === "Completed").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <Modal open={open} onClose={onClose} side="right" label="Quest log" className="log">
      <ModalHeader title="Quest log" onClose={onClose}>
        {isLead && <Button size="sm" variant="primary" icon="plus" onClick={onAdd}>New</Button>}
      </ModalHeader>
      <div className="log__progress">
        <svg viewBox="0 0 40 40" className="ring" aria-hidden="true">
          <circle cx="20" cy="20" r="16" className="ring__bg" />
          <motion.circle cx="20" cy="20" r="16" className="ring__fg" initial={{ pathLength: 0 }} animate={{ pathLength: pct / 100 }} transition={{ duration: 1, ease: "easeOut" }} />
        </svg>
        <div>
          <p className="log__pct">{pct}% of the party's quests done</p>
          <p className="muted">{done} completed, {total - done} still open. Each one grows the plaza a little.</p>
        </div>
      </div>
      <div className="log__controls">
        <Segmented options={[{ value: "open", label: "Open" }, { value: "done", label: "Done" }]} value={tab} onChange={setTab} className="seg-tab" />
        <div className="log__filters">
          <label className="search">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search quests" />
          </label>
          <select className="input input--sm" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Whose quests">
            <option value="all">Everyone's</option>
            <option value="mine">Mine</option>
          </select>
          {tab === "open" && (
            <select className="input input--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
              <option value="due">Due soonest</option>
              <option value="priority">Priority</option>
              <option value="points">Most points</option>
            </select>
          )}
        </div>
      </div>
      <div className="modal__body log__body">
        {list.length === 0 ? (
          <EmptyState emoji={tab === "open" ? "🌾" : "🪺"} title={tab === "open" ? (q ? "No quests match that search" : "No open quests") : "Nothing completed yet"}>
            {tab === "open" && isLead && !q && <Button variant="primary" icon="plus" onClick={onAdd}>Plant the first one</Button>}
          </EmptyState>
        ) : (
          <ul className="log__list">
            <AnimatePresence initial={false}>
              {list.map((x) => {
                const due = dueInfo(x.dueDate);
                const steps = x.checklist?.length || 0;
                const stepsDone = x.checklist?.filter((c) => c.done).length || 0;
                return (
                  <motion.li key={x._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} className="qrow" style={{ "--prio": PRIORITY[x.priority]?.color }}>
                    <button className="qrow__main" onClick={() => onOpen(x)}>
                      <span className="qrow__cat" aria-hidden="true">{categoryIcon(x.category)}</span>
                      <span className="qrow__text">
                        <span className="qrow__title">{x.title}</span>
                        <span className="qrow__meta">
                          {x.status === "Completed" ? (
                            <span>Done by {x.completedBy?.username || "someone"} {x.completedAt ? timeAgo(x.completedAt) : ""}</span>
                          ) : (
                            <>
                              <span className={`tone-${due.tone}`}>{due.label}</span>
                              <span className="qrow__status" style={{ color: STATUS[x.status]?.color }}>{STATUS[x.status]?.label}</span>
                              {steps > 0 && <span>{stepsDone}/{steps} steps</span>}
                            </>
                          )}
                        </span>
                      </span>
                      <span className="qrow__pts"><Icon name="coin" size={14} />{x.points}</span>
                      {x.assignedTo && <Avatar avatarId={x.assignedTo.avatarId} size={28} title={x.assignedTo.username} />}
                    </button>
                    {x.status !== "Completed" && (
                      <button className="qrow__go" onClick={() => onGo(x)} aria-label={`Walk to ${x.title}`} data-tip="Walk there">
                        <Icon name="walk" size={18} />
                      </button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Modal>
  );
}
