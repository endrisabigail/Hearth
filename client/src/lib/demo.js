const FLAG = "hearth_demo";
const STATE = "hearth_demo_state_v2";

export const isDemo = () => {
  try {
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};

export function enterDemo(avatarId = "apple") {
  sessionStorage.setItem(FLAG, "1");
  const s = loadState();
  s.users.me.avatarId = avatarId;
  saveState(s);
}

export function exitDemo() {
  sessionStorage.removeItem(FLAG);
  sessionStorage.removeItem(STATE);
}

const day = 86400000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString();
let idSeq = 1000;
const nid = () => `d${(idSeq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function seed() {
  const users = {
    me: { _id: "me", username: "you", avatarId: "apple", rank: "Fledgling", streak: { current: 4, longest: 9 } },
    june: { _id: "june", username: "juniper", avatarId: "frog", rank: "Wayfinder", streak: { current: 12, longest: 12 } },
    ollie: { _id: "ollie", username: "ollie", avatarId: "snail", rank: "Fledgling", streak: { current: 2, longest: 6 } },
    maren: { _id: "maren", username: "maren", avatarId: "fish", rank: "Sprout", streak: { current: 7, longest: 15 } },
  };
  const mk = (title, description, extra = {}) => ({
    _id: nid(),
    title,
    description,
    dueDate: iso(3),
    category: "general",
    priority: "medium",
    tags: [],
    points: 5,
    status: "Not Started",
    checklist: [],
    comments: [],
    editHistory: [],
    assignedTo: null,
    completedBy: null,
    completedAt: null,
    aiBreakdown: null,
    createdAt: iso(-2),
    ...extra,
  });
  const quests = [
    mk("Sketch the landing page", "Rough out three layout ideas for the new landing page and pick a favourite to polish.", {
      category: "creative", priority: "high", dueDate: iso(1), points: 10, assignedTo: "me", status: "In Progress", tags: ["design"],
      checklist: [{ _id: nid(), text: "Moodboard", done: true }, { _id: nid(), text: "Three thumbnails", done: true }, { _id: nid(), text: "Pick one", done: false }],
    }),
    mk("Write sprint recap", "Summarise what shipped this week and what moved to next sprint.", { category: "work", dueDate: iso(2), assignedTo: "june", points: 5 }),
    mk("Fix the login bug", "Password reset links expire too fast on mobile. Reproduce and patch.", { category: "work", priority: "high", dueDate: iso(0.5), points: 15, assignedTo: "maren", tags: ["bug"] }),
    mk("Study for algorithms quiz", "Dynamic programming and graph traversal, chapters 6 to 8.", { category: "school", dueDate: iso(4), points: 10, assignedTo: "me" }),
    mk("Water the office plants", "The fern is looking dramatic again.", { category: "home", priority: "low", dueDate: iso(5), points: 3, assignedTo: "ollie" }),
    mk("Plan team picnic", "Pick a park, a date, and who brings the lemonade.", { category: "social", priority: "low", dueDate: iso(9), points: 5 }),
    mk("Record demo video", "60 seconds, show the plaza and a quest getting completed.", { category: "creative", dueDate: iso(6), points: 10 }),
    mk("Set up CI pipeline", "Lint, test and build on every push.", { category: "work", status: "Completed", completedBy: "june", completedAt: iso(-1), points: 10 }),
    mk("Clean up the backlog", "Archive anything older than two months.", { category: "work", status: "Completed", completedBy: "me", completedAt: iso(-2), points: 5 }),
  ];
  const notifications = [
    { _id: nid(), type: "general", message: "💬 juniper: the orchard looks so good at sunset 🍎", fromUser: "june", read: false, createdAt: iso(-0.05) },
    { _id: nid(), type: "quest_complete", message: "juniper completed \"Set up CI pipeline\"! ⚔️", fromUser: "june", read: false, createdAt: iso(-1) },
    { _id: nid(), type: "member_joined", message: "maren joined your Hearth! 🏡", fromUser: "maren", read: true, createdAt: iso(-3) },
    { _id: nid(), type: "general", message: "💬 maren: on the login bug now, think it's the token TTL", fromUser: "maren", read: true, createdAt: iso(-0.4) },
    { _id: nid(), type: "badge_earned", message: "You earned the \"work First Timer\" badge! 🏅", fromUser: null, read: true, createdAt: iso(-2) },
  ];
  return {
    users,
    quests,
    notifications,
    me: {
      totalPoints: 45,
      points: { work: 25, creative: 15, school: 5 },
      badges: [
        { badgeName: "work First Timer", badgeDescription: "Congratulations on completing your first quest!", earnedAt: iso(-12) },
        { badgeName: "work Level 20", badgeDescription: "You've earned 20 points in work!", earnedAt: iso(-3) },
        { badgeName: "creative First Timer", badgeDescription: "Congratulations on completing your first quest!", earnedAt: iso(-6) },
      ],
      plazaPosition: { x: 0.5, y: 0.62 },
      bio: "",
    },
    chat: [],
  };
}

function loadState() {
  try {
    const s = JSON.parse(sessionStorage.getItem(STATE) || "null");
    if (s) return s;
  } catch {}
  const s = seed();
  saveState(s);
  return s;
}

function saveState(s) {
  try {
    sessionStorage.setItem(STATE, JSON.stringify(s));
  } catch {}
}

const pick = (u) => (u ? { _id: u._id, username: u.username, avatarId: u.avatarId, rank: u.rank, streak: u.streak } : null);

function populate(q, s) {
  return {
    ...q,
    assignedTo: pick(s.users[q.assignedTo]),
    completedBy: pick(s.users[q.completedBy]),
    comments: (q.comments || []).map((c) => ({ ...c, author: pick(s.users[c.author]), isMine: c.author === "me" })),
    editHistory: (q.editHistory || []).map((h) => ({ ...h, editedBy: pick(s.users[h.editedBy]) })),
  };
}

function populateNotif(n, s) {
  return { ...n, fromUser: pick(s.users[n.fromUser]) };
}

const ok = (config, data, status = 200) =>
  Promise.resolve({ data, status, statusText: "OK", headers: {}, config, request: {} });

const fail = (config, status, msg) => {
  const err = new Error(msg);
  err.config = config;
  err.response = { status, data: { msg }, config };
  return Promise.reject(err);
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function demoAdapter(config) {
  await wait(120 + Math.random() * 180);
  const s = loadState();
  const method = (config.method || "get").toLowerCase();
  const url = (config.url || "").replace(/^\/+/, "/").replace(/\?.*$/, "");
  const body = typeof config.data === "string" ? JSON.parse(config.data || "{}") : config.data || {};
  const me = s.users.me;
  let m;

  if (method === "get" && url === "/dashboard") {
    return ok(config, {
      user: {
        id: "me",
        username: me.username,
        rank: me.rank,
        avatarId: me.avatarId,
        bio: s.me.bio,
        points: s.me.points,
        totalPoints: s.me.totalPoints,
        badges: s.me.badges,
        streak: me.streak,
        neighbors: [pick(s.users.june)],
        isPartyOwner: true,
        plazaPosition: s.me.plazaPosition,
      },
      quests: s.quests.filter((q) => q.status !== "Completed").slice(0, 5).map((q) => populate(q, s)),
      notifications: s.notifications.map((n) => populateNotif(n, s)),
      unreadCount: s.notifications.filter((n) => !n.read).length,
    });
  }
  if (method === "patch" && url === "/dashboard/position") {
    s.me.plazaPosition = { x: body.x, y: body.y };
    saveState(s);
    return ok(config, { msg: "Position saved." });
  }
  if (method === "post" && url === "/dashboard/notifications/read") {
    s.notifications.forEach((n) => (n.read = true));
    saveState(s);
    return ok(config, { msg: "ok" });
  }
  if (method === "post" && url === "/dashboard/notifications/message") {
    const target = s.users[body.recipientId];
    if (target) {
      setTimeout(() => {
        const st = loadState();
        const replies = ["haha yes!! 🌱", "on it ✨", "omg same", "ok see you at the plaza", "you're the best"];
        st.notifications.unshift({
          _id: nid(),
          type: "general",
          message: `💬 ${target.username}: ${replies[Math.floor(Math.random() * replies.length)]}`,
          fromUser: target._id,
          read: false,
          createdAt: new Date().toISOString(),
        });
        saveState(st);
        demoBus.dispatchEvent(new CustomEvent("message", { detail: { fromUserId: target._id } }));
      }, 2600);
    }
    return ok(config, { msg: "Message sent!" });
  }
  if (method === "post" && url === "/dashboard/neighbor/request") {
    return body.username ? ok(config, { msg: "Neighbor request sent!" }) : fail(config, 404, "User not found.");
  }
  if (method === "post" && url === "/dashboard/neighbor/accept") return ok(config, { msg: "Neighbor added!" });
  if (method === "get" && url === "/party") {
    return ok(config, {
      _id: "party",
      name: "The Cozy Collective",
      inviteCode: "demo1234",
      owner: pick(s.users.me),
      members: [pick(s.users.june), pick(s.users.ollie), pick(s.users.maren)],
    });
  }
  if (method === "get" && (m = url.match(/^\/party\/invite\/(.+)$/))) {
    return ok(config, { partyName: "The Cozy Collective", owner: pick(s.users.june), memberCount: 3 });
  }
  if (method === "post" && url === "/auth/update-avatar") {
    me.avatarId = body.avatarId;
    saveState(s);
    return ok(config, { msg: "Avatar updated!", avatarId: body.avatarId });
  }
  if (method === "get" && url === "/quests") {
    return ok(config, [...s.quests].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((q) => populate(q, s)));
  }
  if (method === "post" && url === "/quests") {
    const q = {
      _id: nid(),
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      category: body.category || "general",
      priority: body.priority || "medium",
      tags: body.tags || [],
      points: typeof body.points === "number" ? body.points : 5,
      status: "Not Started",
      checklist: [],
      comments: [],
      editHistory: [],
      assignedTo: body.assignedTo || null,
      completedBy: null,
      completedAt: null,
      aiBreakdown: null,
      createdAt: new Date().toISOString(),
    };
    s.quests.unshift(q);
    saveState(s);
    return ok(config, populate(q, s), 201);
  }
  if (method === "post" && url === "/quests/complete") {
    const q = s.quests.find((x) => x._id === body.questId);
    if (!q) return fail(config, 404, "Quest not found.");
    if (q.status === "Completed") return fail(config, 400, "Quest already completed.");
    q.status = "Completed";
    q.completedBy = "me";
    q.completedAt = new Date().toISOString();
    const before = s.me.points[q.category] || 0;
    const after = before + q.points;
    s.me.points[q.category] = after;
    s.me.totalPoints += q.points;
    let badge = null;
    if (after >= 5 && before < 5) badge = { badgeName: `${q.category} First Timer`, badgeDescription: "Congratulations on completing your first quest!" };
    else if (Math.floor(after / 20) > Math.floor(before / 20)) {
      const ms = Math.floor(after / 20) * 20;
      badge = { badgeName: `${q.category} Level ${ms}`, badgeDescription: `You've earned ${ms} points in ${q.category}!` };
    }
    if (badge && !s.me.badges.some((b) => b.badgeName === badge.badgeName)) {
      s.me.badges.push({ ...badge, earnedAt: new Date().toISOString() });
      s.notifications.unshift({ _id: nid(), type: "badge_earned", message: `You earned the "${badge.badgeName}" badge! 🏅`, fromUser: null, read: false, createdAt: new Date().toISOString() });
    }
    saveState(s);
    return ok(config, populate(q, s));
  }
  if ((m = url.match(/^\/quests\/([^/]+)(?:\/(.+))?$/))) {
    const [, id, rest] = m;
    const q = s.quests.find((x) => x._id === id);
    if (!q) return fail(config, 404, "Quest not found.");
    if (method === "delete" && !rest) {
      s.quests = s.quests.filter((x) => x._id !== id);
      saveState(s);
      return ok(config, { msg: "Quest deleted." });
    }
    if (method === "put" && !rest) {
      for (const f of ["title", "description", "dueDate", "category", "points", "assignedTo", "tags", "priority"]) {
        if (f in body && JSON.stringify(body[f]) !== JSON.stringify(q[f])) {
          q.editHistory.push({ field: f, oldValue: q[f], newValue: body[f], editedBy: "me", editedAt: new Date().toISOString() });
          q[f] = body[f] || (f === "assignedTo" ? null : body[f]);
        }
      }
    } else if (method === "put" && rest === "status") {
      q.status = body.status;
    } else if (method === "put" && rest === "checklist") {
      q.checklist = body.items.map((it) => ({ _id: it._id || nid(), text: it.text, done: !!it.done }));
    } else if (method === "post" && rest === "comments") {
      q.comments.push({ _id: nid(), text: body.text, author: "me", createdAt: new Date().toISOString() });
    } else if (method === "delete" && rest?.startsWith("comments/")) {
      const cid = rest.split("/")[1];
      q.comments = q.comments.filter((c) => c._id !== cid);
    } else {
      return fail(config, 404, "Not found in demo.");
    }
    saveState(s);
    return ok(config, populate(q, s));
  }
  if ((m = url.match(/^\/ai\/history\/(.+)$/))) {
    if (method === "delete") {
      s.chat = [];
      saveState(s);
      return ok(config, { msg: "Conversation cleared." });
    }
    return ok(config, s.chat);
  }
  return fail(config, 404, `Demo has no route for ${method.toUpperCase()} ${url}`);
}

export const demoBus = typeof window !== "undefined" ? new EventTarget() : null;

class FakeSocket {
  constructor() {
    this.handlers = new Map();
    this.connected = true;
    this.timers = [];
  }
  on(ev, fn) {
    if (!this.handlers.has(ev)) this.handlers.set(ev, new Set());
    this.handlers.get(ev).add(fn);
    return this;
  }
  off(ev, fn) {
    this.handlers.get(ev)?.delete(fn);
    return this;
  }
  fire(ev, payload) {
    this.handlers.get(ev)?.forEach((fn) => fn(payload));
  }
  later(ms, fn) {
    const t = setTimeout(fn, ms);
    this.timers.push(t);
    return t;
  }
  disconnect() {
    this.connected = false;
    this.timers.forEach(clearTimeout);
    this.timers.forEach(clearInterval);
    this.handlers.clear();
    this.onDisconnect?.();
  }
}

function streamText(sock, text, ev, extra, done) {
  const words = text.split(/(\s+)/);
  let i = 0;
  const tick = () => {
    if (!sock.connected) return;
    if (i >= words.length) return done();
    const chunk = words.slice(i, i + 2).join("");
    i += 2;
    sock.fire(ev, { ...extra, chunk });
    sock.later(35 + Math.random() * 40, tick);
  };
  tick();
}

export function createDemoSocket(namespace) {
  const sock = new FakeSocket();
  if (namespace === "/plaza") {
    const s = loadState();
    const online = [s.users.june, s.users.maren].map((u, i) => ({
      userId: u._id,
      username: u.username,
      avatarId: u.avatarId,
      rank: u.rank,
      x: 0.42 + i * 0.16,
      y: 0.48 + i * 0.05,
      tx: 0.5,
      ty: 0.5,
      pause: 0,
    }));
    sock.later(400, () => {
      sock.fire("connect");
      sock.fire("plaza:snapshot", online.map(({ tx, ty, pause, ...m }) => m));
    });
    const iv = setInterval(() => {
      if (!sock.connected) return;
      for (const p of online) {
        if (p.pause > 0) {
          p.pause -= 1;
          continue;
        }
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.01) {
          const a = Math.random() * Math.PI * 2;
          const r = 0.08 + Math.random() * 0.24;
          p.tx = 0.5 + Math.cos(a) * r;
          p.ty = 0.5 + Math.sin(a) * r;
          p.pause = 10 + Math.floor(Math.random() * 40);
          continue;
        }
        const step = Math.min(d, 0.006);
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
        sock.fire("plaza:userMoved", { userId: p.userId, x: p.x, y: p.y });
      }
    }, 100);
    sock.timers.push(iv);
    const onMsg = (e) => sock.fire("plaza:messageReceived", { fromUserId: e.detail.fromUserId });
    demoBus.addEventListener("message", onMsg);
    sock.onDisconnect = () => demoBus.removeEventListener("message", onMsg);
    sock.emit = () => sock;
    return sock;
  }
  if (namespace === "/ai") {
    sock.later(200, () => sock.fire("connect"));
    sock.emit = (ev, payload = {}) => {
      if (ev === "ai:prompt") {
        const st = loadState();
        st.chat.push({ role: "user", content: payload.prompt, createdAt: new Date().toISOString() });
        const reply =
          "Hi friend! 🌱 This is the demo plaza, so I'm running on a little script instead of the real companion brain. In your own Hearth I can break quests into tiny first steps, cheer you on, and help you decide what to tackle next. Try opening a quest and tapping \"Help me start\".";
        sock.later(300, () => {
          sock.fire("ai:start", { conversationId: payload.conversationId });
          streamText(sock, reply, "ai:chunk", { conversationId: payload.conversationId }, () => {
            st.chat.push({ role: "assistant", content: reply, createdAt: new Date().toISOString() });
            saveState(st);
            sock.fire("ai:done", { conversationId: payload.conversationId });
          });
        });
      }
      if (ev === "ai:breakdown") {
        const steps =
          "1. Set a 10 minute timer and open everything you need.\n2. Write down the very first tiny action, then do only that.\n3. Take a sip of water and check one thing off.\n4. Keep going for one more timer, then reward yourself. You've got this ✨";
        sock.later(300, () => {
          sock.fire("ai:breakdown:start", { questId: payload.questId, cached: false });
          streamText(sock, steps, "ai:breakdown:chunk", { questId: payload.questId }, () =>
            sock.fire("ai:breakdown:done", { questId: payload.questId }),
          );
        });
      }
      if (ev === "ai:description") {
        const text = `A cozy little quest: ${payload.title.toLowerCase()}. Break it into small steps, take breaks, and celebrate when it's done.`;
        sock.later(250, () => {
          sock.fire("ai:description:start", { requestId: payload.requestId });
          streamText(sock, text, "ai:description:chunk", { requestId: payload.requestId }, () =>
            sock.fire("ai:description:done", { requestId: payload.requestId }),
          );
        });
      }
      return sock;
    };
    return sock;
  }
  sock.emit = () => sock;
  return sock;
}
