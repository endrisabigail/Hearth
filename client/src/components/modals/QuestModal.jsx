import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Modal, ModalHeader, Button, Field, Segmented, IconButton, Spinner } from "../ui/primitives.jsx";
import Icon from "../ui/Icon.jsx";
import Avatar from "../ui/Avatar.jsx";
import { api, connectSocket, errMsg } from "../../lib/api.js";
import { CATEGORY_ICONS, categoryIcon, PRIORITY, STATUS } from "../../lib/avatars.js";
import { dueInfo, timeAgo, toDateInput, fromDateInput } from "../../lib/format.js";
import { sfx } from "../../lib/sound.js";

const STATUS_OPTS = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label, color: s.color }));
const PRIORITY_OPTS = Object.entries(PRIORITY).map(([value, p]) => ({ value, label: p.label, color: p.color }));

function useAiSocket(open) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open) return;
    const s = connectSocket("/ai");
    ref.current = s;
    s.on("connect", () => setReady(true));
    s.on("disconnect", () => setReady(false));
    return () => {
      s.disconnect();
      ref.current = null;
      setReady(false);
    };
  }, [open]);
  return { socket: ref, ready };
}

function QuestForm({ initial, members, categories, onAddCategory, onSubmit, onCancel, submitLabel, ai }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [due, setDue] = useState(toDateInput(initial?.dueDate));
  const [priority, setPriority] = useState(initial?.priority || "medium");
  const [points, setPoints] = useState(initial?.points ?? 5);
  const [category, setCategory] = useState(initial?.category || "general");
  const [assignee, setAssignee] = useState(initial?.assignedTo?._id || "");
  const [tags, setTags] = useState((initial?.tags || []).join(", "));
  const [newCat, setNewCat] = useState("");
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const writeWithAi = () => {
    if (!title.trim() || !ai.socket.current) return;
    const requestId = Math.random().toString(36).slice(2);
    const s = ai.socket.current;
    setWriting(true);
    setDescription("");
    const onStart = (p) => p.requestId === requestId && setDescription("");
    const onChunk = (p) => p.requestId === requestId && setDescription((d) => d + p.chunk);
    const cleanup = () => {
      s.off("ai:description:start", onStart);
      s.off("ai:description:chunk", onChunk);
      s.off("ai:description:done", onDone);
      s.off("ai:description:error", onErr);
      setWriting(false);
    };
    const onDone = (p) => p.requestId === requestId && cleanup();
    const onErr = (p) => {
      if (p.requestId !== requestId) return;
      setError(p.msg || "The companion couldn't write that one.");
      cleanup();
    };
    s.on("ai:description:start", onStart);
    s.on("ai:description:chunk", onChunk);
    s.on("ai:description:done", onDone);
    s.on("ai:description:error", onErr);
    s.emit("ai:description", { requestId, title: title.trim(), questId: initial?._id });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Give the quest a title.");
    if (!description.trim()) return setError("Add a short description so your party knows what it involves.");
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        dueDate: fromDateInput(due),
        priority,
        points: Number(points) || 0,
        category,
        assignedTo: assignee || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(errMsg(err, "Couldn't save the quest."));
      setBusy(false);
    }
  };

  return (
    <form className="qform" onSubmit={submit}>
      <Field label="Title">
        <input className="input input--lg" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder="Water the office plants" data-autofocus />
      </Field>
      <Field label="Description">
        <div className="textarea-wrap">
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does done look like?" />
          <button type="button" className="ai-chip" onClick={writeWithAi} disabled={!title.trim() || writing || !ai.ready} data-tip={title.trim() ? "Draft a description from the title" : "Add a title first"}>
            {writing ? <Spinner size={14} /> : <Icon name="sparkle" size={14} />} Write it for me
          </button>
        </div>
      </Field>
      <div className="qform__grid">
        <Field label="Due">
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
        </Field>
        <Field label="Points">
          <div className="stepper">
            <button type="button" onClick={() => setPoints((p) => Math.max(0, p - 1))} aria-label="Fewer points">−</button>
            <input className="input" type="number" min={0} max={100} value={points} onChange={(e) => setPoints(e.target.value)} />
            <button type="button" onClick={() => setPoints((p) => Math.min(100, Number(p) + 1))} aria-label="More points">+</button>
          </div>
        </Field>
      </div>
      <Field label="Priority">
        <Segmented options={PRIORITY_OPTS} value={priority} onChange={setPriority} className="seg-priority" />
      </Field>
      <Field label="Category">
        <div className="chips">
          {categories.map((c) => (
            <button type="button" key={c} className={`chip ${category === c ? "is-on" : ""}`} onClick={() => setCategory(c)}>
              <span>{categoryIcon(c)}</span> {c}
            </button>
          ))}
          <span className="chip chip--input">
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="+ new"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const c = newCat.trim().toLowerCase();
                  if (c) {
                    onAddCategory(c);
                    setCategory(c);
                    setNewCat("");
                  }
                }
              }}
            />
          </span>
        </div>
      </Field>
      <div className="qform__grid">
        <Field label="Assigned to">
          <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Anyone</option>
            {members.map((m) => (
              <option key={m._id} value={m._id}>{m.username}</option>
            ))}
          </select>
        </Field>
        <Field label="Tags" hint="Separate with commas">
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="design, urgent" />
        </Field>
      </div>
      {error && <p className="form__error" role="alert">{error}</p>}
      <div className="qform__actions">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary" loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}

function Checklist({ quest, onUpdate, toast }) {
  const [items, setItems] = useState(quest.checklist || []);
  const [text, setText] = useState("");
  useEffect(() => setItems(quest.checklist || []), [quest._id, quest.checklist]);
  const save = async (next) => {
    const prev = items;
    setItems(next);
    try {
      const r = await api.put(`/quests/${quest._id}/checklist`, { items: next.map(({ text, done }) => ({ text, done })) });
      onUpdate(r.data);
    } catch (err) {
      setItems(prev);
      toast(errMsg(err, "Couldn't update the checklist."), { tone: "error" });
    }
  };
  const done = items.filter((i) => i.done).length;
  return (
    <section className="qsec">
      <div className="qsec__head">
        <h3>Steps</h3>
        {items.length > 0 && <span className="muted">{done} of {items.length}</span>}
      </div>
      {items.length > 0 && (
        <div className="meter"><span style={{ width: `${(done / items.length) * 100}%` }} /></div>
      )}
      <ul className="checklist">
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <motion.li key={it._id || `${it.text}-${i}`} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <label className={`check ${it.done ? "is-done" : ""}`}>
                <input
                  type="checkbox"
                  checked={it.done}
                  onChange={() => {
                    if (!it.done) sfx("pop", 0.6);
                    save(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)));
                  }}
                />
                <span className="check__box"><Icon name="check" size={14} stroke={3} /></span>
                <span className="check__text">{it.text}</span>
              </label>
              <IconButton icon="close" label="Remove step" size={14} className="icon-btn--flat icon-btn--sm" onClick={() => save(items.filter((_, j) => j !== i))} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          save([...items, { text: text.trim(), done: false }]);
          setText("");
        }}
      >
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a step" maxLength={300} />
        <Button size="sm" type="submit" icon="plus" disabled={!text.trim()}>Add</Button>
      </form>
    </section>
  );
}

function CompanionHelp({ quest, ai, companionName, avatarId, onSteps }) {
  const [text, setText] = useState(quest.aiBreakdown || "");
  const [state, setState] = useState(quest.aiBreakdown ? "done" : "idle");
  const [err, setErr] = useState("");

  useEffect(() => {
    const s = ai.socket.current;
    if (!s) return;
    const mine = (p) => p.questId === quest._id;
    const onStart = (p) => mine(p) && (setText(""), setState("streaming"));
    const onChunk = (p) => mine(p) && setText((t) => t + p.chunk);
    const onDone = (p) => mine(p) && setState("done");
    const onErr = (p) => {
      if (!mine(p)) return;
      setErr(p.msg || "No steps this time.");
      setState("idle");
    };
    s.on("ai:breakdown:start", onStart);
    s.on("ai:breakdown:chunk", onChunk);
    s.on("ai:breakdown:done", onDone);
    s.on("ai:breakdown:error", onErr);
    return () => {
      s.off("ai:breakdown:start", onStart);
      s.off("ai:breakdown:chunk", onChunk);
      s.off("ai:breakdown:done", onDone);
      s.off("ai:breakdown:error", onErr);
    };
  }, [ai.ready, quest._id]);

  const ask = (regenerate = false) => {
    setErr("");
    setState("streaming");
    ai.socket.current?.emit("ai:breakdown", { questId: quest._id, regenerate });
  };

  const steps = useMemo(
    () => text.split("\n").map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim()).filter((l) => l.length > 2),
    [text],
  );

  return (
    <section className="qsec pal-help">
      <div className="pal-help__head">
        <Avatar avatarId={avatarId} companion size={40} />
        <div>
          <h3>{companionName} can help you start</h3>
          <p className="muted">Small, doable first steps for when a quest feels big.</p>
        </div>
      </div>
      {state === "idle" && (
        <Button icon="sparkle" onClick={() => ask(false)} disabled={!ai.ready}>
          {ai.ready ? "Help me start" : "Connecting…"}
        </Button>
      )}
      {(state === "streaming" || state === "done") && (
        <div className="pal-help__text">
          {text ? <p>{text}</p> : <Spinner />}
          {state === "done" && (
            <div className="pal-help__actions">
              {steps.length > 1 && (
                <Button size="sm" icon="plus" onClick={() => onSteps(steps)}>Add as steps</Button>
              )}
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => ask(true)}>Try again</Button>
            </div>
          )}
        </div>
      )}
      {err && <p className="form__error">{err}</p>}
    </section>
  );
}

function Comments({ quest, isLead, onUpdate, toast }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const post = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.post(`/quests/${quest._id}/comments`, { text: text.trim() });
      onUpdate(r.data);
      setText("");
    } catch (err) {
      toast(errMsg(err, "Couldn't post that."), { tone: "error" });
    }
    setBusy(false);
  };
  const remove = async (id) => {
    try {
      const r = await api.delete(`/quests/${quest._id}/comments/${id}`);
      onUpdate(r.data);
    } catch (err) {
      toast(errMsg(err, "Couldn't delete that comment."), { tone: "error" });
    }
  };
  return (
    <section className="qsec">
      <div className="qsec__head">
        <h3>Notes</h3>
        <span className="muted">{quest.comments?.length || 0}</span>
      </div>
      <ul className="comments">
        {(quest.comments || []).map((c) => (
          <li key={c._id} className={`comment ${c.isMine ? "is-mine" : ""}`}>
            <Avatar avatarId={c.author?.avatarId} size={28} />
            <div className="comment__body">
              <p className="comment__meta">
                <strong>{c.isMine ? "You" : c.author?.username}</strong> <span>{timeAgo(c.createdAt)}</span>
              </p>
              <p>{c.text}</p>
            </div>
            {(c.isMine || isLead) && <IconButton icon="trash" label="Delete note" size={14} className="icon-btn--flat icon-btn--sm" onClick={() => remove(c._id)} />}
          </li>
        ))}
      </ul>
      <form className="inline-add" onSubmit={post}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Leave a note for the party" />
        <Button size="sm" type="submit" icon="send" loading={busy} disabled={!text.trim()}>Post</Button>
      </form>
    </section>
  );
}

function History({ quest }) {
  const [open, setOpen] = useState(false);
  const h = quest.editHistory || [];
  if (!h.length) return null;
  const fmt = (f, v) => {
    if (v === null || v === undefined || v === "") return "nothing";
    if (f === "dueDate") return new Date(v).toLocaleDateString();
    if (f === "assignedTo") return "someone new";
    return String(v);
  };
  return (
    <section className="qsec">
      <button className="disclosure" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name="chevron" size={16} className={open ? "rot-90" : ""} /> Edit history ({h.length})
      </button>
      {open && (
        <ul className="history">
          {[...h].reverse().map((e, i) => (
            <li key={i}>
              <strong>{e.editedBy?.username || "Someone"}</strong> changed {e.field === "dueDate" ? "the due date" : e.field} from {fmt(e.field, e.oldValue)} to {fmt(e.field, e.newValue)} <span className="muted">{timeAgo(e.editedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function QuestModal({ open, quest, isLead, members, onClose, onSaved, onCreated, onDeleted, onCompleted, companionName, avatarId, categories, onAddCategory, toast }) {
  const [editing, setEditing] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ai = useAiSocket(open);
  const creating = open && !quest;

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
  }, [quest?._id, open]);

  const setStatus = async (status) => {
    if (status === quest.status || statusBusy) return;
    setStatusBusy(true);
    try {
      if (status === "Completed") {
        const r = await api.post("/quests/complete", { questId: quest._id });
        onCompleted(r.data, quest);
      } else {
        const r = await api.put(`/quests/${quest._id}/status`, { status });
        onSaved(r.data);
      }
    } catch (err) {
      toast(errMsg(err, "Couldn't change the status."), { tone: "error" });
    }
    setStatusBusy(false);
  };

  const addSteps = async (steps) => {
    const items = [...(quest.checklist || []).map(({ text, done }) => ({ text, done })), ...steps.map((text) => ({ text: text.slice(0, 300), done: false }))];
    try {
      const r = await api.put(`/quests/${quest._id}/checklist`, { items });
      onSaved(r.data);
      toast(`Added ${steps.length} steps`, { icon: "✨" });
    } catch (err) {
      toast(errMsg(err, "Couldn't add those steps."), { tone: "error" });
    }
  };

  const del = async () => {
    try {
      await api.delete(`/quests/${quest._id}`);
      onDeleted(quest._id);
      toast("Quest deleted");
      onClose();
    } catch (err) {
      toast(errMsg(err, "Couldn't delete the quest."), { tone: "error" });
    }
  };

  const due = quest ? dueInfo(quest.dueDate) : null;

  return (
    <Modal open={open} onClose={onClose} label={creating ? "New quest" : quest?.title} wide className="qmodal">
      {creating && (
        <>
          <ModalHeader title="Plant a new quest" onClose={onClose} />
          <div className="modal__body">
            <QuestForm
              members={members}
              categories={categories}
              onAddCategory={onAddCategory}
              ai={ai}
              submitLabel="Plant quest"
              onSubmit={async (data) => {
                const r = await api.post("/quests", data);
                sfx("join", 0.7);
                onCreated(r.data);
                toast(`"${r.data.title}" sprouted in the plaza`, { icon: "🌱" });
                onClose();
              }}
            />
          </div>
        </>
      )}
      {quest && !editing && (
        <>
          <header className="qhero" style={{ "--prio": PRIORITY[quest.priority]?.color }}>
            <div className="qhero__top">
              <span className="qhero__cat">{categoryIcon(quest.category)} {quest.category}</span>
              <div className="qhero__tools">
                {isLead && <IconButton icon="edit" label="Edit quest" onClick={() => setEditing(true)} className="icon-btn--flat" />}
                <IconButton icon="close" label="Close" onClick={onClose} className="icon-btn--flat" />
              </div>
            </div>
            <h2 className="qhero__title">{quest.title}</h2>
            <div className="qhero__meta">
              <span className={`tag tone-${due.tone}`}><Icon name="clock" size={14} /> {due.label}</span>
              <span className="tag"><span className="dot" style={{ background: PRIORITY[quest.priority]?.color }} /> {PRIORITY[quest.priority]?.label} priority</span>
              <span className="tag tag--coin"><Icon name="coin" size={14} /> {quest.points} pts</span>
              {quest.assignedTo ? (
                <span className="tag"><Avatar avatarId={quest.assignedTo.avatarId} size={20} /> {quest.assignedTo.username}</span>
              ) : (
                <span className="tag muted">Anyone can take this</span>
              )}
              {(quest.tags || []).map((t) => <span key={t} className="tag tag--soft">#{t}</span>)}
            </div>
          </header>
          <div className="modal__body">
            <p className="qdesc">{quest.description}</p>
            <div className="qstatus">
              <Segmented options={STATUS_OPTS} value={quest.status} onChange={setStatus} className="seg-status" />
              {statusBusy && <Spinner />}
            </div>
            {quest.status === "Completed" && quest.completedBy && (
              <p className="done-note">🎉 Completed by {quest.completedBy.username} {quest.completedAt ? timeAgo(quest.completedAt) : ""}</p>
            )}
            {quest.status !== "Completed" && <CompanionHelp quest={quest} ai={ai} companionName={companionName} avatarId={avatarId} onSteps={addSteps} />}
            <Checklist quest={quest} onUpdate={onSaved} toast={toast} />
            <Comments quest={quest} isLead={isLead} onUpdate={onSaved} toast={toast} />
            <History quest={quest} />
            {isLead && (
              <div className="danger-zone">
                {confirmDelete ? (
                  <>
                    <span>Delete this quest for everyone?</span>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
                    <Button size="sm" variant="danger" icon="trash" onClick={del}>Delete quest</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirmDelete(true)}>Delete quest</Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {quest && editing && (
        <>
          <ModalHeader title="Edit quest" onBack={() => setEditing(false)} onClose={onClose} />
          <div className="modal__body">
            <QuestForm
              initial={quest}
              members={members}
              categories={categories}
              onAddCategory={onAddCategory}
              ai={ai}
              submitLabel="Save changes"
              onCancel={() => setEditing(false)}
              onSubmit={async (data) => {
                const r = await api.put(`/quests/${quest._id}`, data);
                onSaved(r.data);
                toast("Changes saved");
                setEditing(false);
              }}
            />
          </div>
        </>
      )}
    </Modal>
  );
}

export const DEFAULT_CATEGORIES = Object.keys(CATEGORY_ICONS);
