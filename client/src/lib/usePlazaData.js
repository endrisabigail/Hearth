import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, connectSocket } from "./api.js";
import { sfx } from "./sound.js";

export const isMessage = (n) => typeof n?.message === "string" && (n.message.startsWith("💬") || n.message.startsWith("✉️"));

export function parseMessage(n) {
  const m = n.message.replace(/^(💬|✉️)\s*/, "");
  const i = m.indexOf(":");
  return i > -1 ? m.slice(i + 1).trim() : m;
}

const sentKey = (uid) => `hearth_sent_${uid}`;

export function usePlazaData({ onMessageFrom, onJoin } = {}) {
  const [user, setUser] = useState(null);
  const [party, setParty] = useState(null);
  const [quests, setQuests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [online, setOnline] = useState(new Set());
  const [sent, setSent] = useState([]);
  const playersRef = useRef(new Map());
  const [playersVersion, setPlayersVersion] = useState(0);
  const socketRef = useRef(null);
  const saveTimer = useRef(null);
  const lastPos = useRef(null);
  const cbRef = useRef({ onMessageFrom, onJoin });
  cbRef.current = { onMessageFrom, onJoin };

  const loadQuests = useCallback(async (fallback) => {
    try {
      const r = await api.get("/quests");
      setQuests(r.data);
    } catch {
      if (fallback) setQuests(fallback);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    const r = await api.get("/dashboard");
    setUser(r.data.user);
    setNotifications(r.data.notifications || []);
    return r.data;
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const pending = localStorage.getItem("pendingInvite");
      if (pending) {
        localStorage.removeItem("pendingInvite");
        await api.post(`/party/join/${pending}`).catch(() => {});
      }
      const [dash, partyRes] = await Promise.all([api.get("/dashboard"), api.get("/party").catch(() => null)]);
      setUser(dash.data.user);
      setNotifications(dash.data.notifications || []);
      if (partyRes) setParty(partyRes.data);
      await loadQuests(dash.data.quests);
      try {
        setSent(JSON.parse(localStorage.getItem(sentKey(dash.data.user.id)) || "[]"));
      } catch {}
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [loadQuests]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!user?.id) return;
    const socket = connectSocket("/plaza");
    socketRef.current = socket;
    const sync = () => {
      setOnline(new Set(playersRef.current.keys()));
      setPlayersVersion((v) => v + 1);
    };
    socket.on("plaza:snapshot", (members) => {
      playersRef.current.clear();
      members.forEach((m) => playersRef.current.set(m.userId, { x: m.x, y: m.y, avatarId: m.avatarId, username: m.username }));
      sync();
    });
    socket.on("plaza:userJoined", (m) => {
      playersRef.current.set(m.userId, { x: m.x, y: m.y, avatarId: m.avatarId, username: m.username });
      sync();
      sfx("join", 0.7);
      cbRef.current.onJoin?.(m);
    });
    socket.on("plaza:userMoved", ({ userId, x, y }) => {
      const p = playersRef.current.get(userId);
      if (p) {
        p.x = x;
        p.y = y;
      }
    });
    socket.on("plaza:userLeft", ({ userId }) => {
      playersRef.current.delete(userId);
      sync();
    });
    socket.on("plaza:messageReceived", ({ fromUserId }) => {
      sfx("mail");
      cbRef.current.onMessageFrom?.(fromUserId);
      refreshDashboard().catch(() => {});
    });
    socket.on("connect_error", (e) => console.warn("plaza socket:", e.message));
    return () => {
      socket.disconnect();
      socketRef.current = null;
      playersRef.current.clear();
    };
  }, [user?.id, refreshDashboard]);

  useEffect(() => {
    if (!user?.id) return;
    const iv = setInterval(() => {
      if (document.hidden) return;
      loadQuests();
      refreshDashboard().catch(() => {});
    }, 45000);
    return () => clearInterval(iv);
  }, [user?.id, loadQuests, refreshDashboard]);

  const sendMove = useCallback((x, y) => {
    lastPos.current = { x, y };
    if (socketRef.current?.connected) socketRef.current.emit("plaza:move", { x, y });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.patch("/dashboard/position", lastPos.current).catch(() => {});
    }, 1500);
  }, []);

  const upsertQuest = useCallback((q) => {
    setQuests((prev) => (prev.some((x) => x._id === q._id) ? prev.map((x) => (x._id === q._id ? q : x)) : [q, ...prev]));
  }, []);
  const removeQuest = useCallback((id) => setQuests((prev) => prev.filter((q) => q._id !== id)), []);

  const markRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await api.post("/dashboard/notifications/read").catch(() => {});
  }, []);

  const sendMessage = useCallback(
    async (recipientId, text) => {
      await api.post("/dashboard/notifications/message", { recipientId, message: text });
      const entry = { to: recipientId, text, at: new Date().toISOString() };
      setSent((prev) => {
        const next = [...prev, entry].slice(-300);
        try {
          localStorage.setItem(sentKey(user.id), JSON.stringify(next));
        } catch {}
        return next;
      });
      socketRef.current?.emit("plaza:message", { toUserId: recipientId });
    },
    [user?.id],
  );

  const members = useMemo(() => [...(party?.owner ? [party.owner] : []), ...(party?.members || [])], [party]);
  const completedCount = useMemo(() => quests.filter((q) => q.status === "Completed").length, [quests]);

  return {
    user,
    setUser,
    party,
    quests,
    notifications,
    loading,
    error,
    online,
    members,
    completedCount,
    playersRef,
    playersVersion,
    sent,
    fetchAll,
    refreshDashboard,
    loadQuests,
    sendMove,
    upsertQuest,
    removeQuest,
    markRead,
    sendMessage,
  };
}
