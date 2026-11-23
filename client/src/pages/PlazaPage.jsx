import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PlazaCanvas from "../components/PlazaCanvas.jsx";
import { TopBar, PartyRail, FocusCard, Dock, ProximityPrompt, Minimap, ControlsHint, LoadingVeil, CompanionMarker } from "../components/hud/Hud.jsx";
import { RewardBurst, BadgeCard } from "../components/hud/Reward.jsx";
import QuestModal, { DEFAULT_CATEGORIES } from "../components/modals/QuestModal.jsx";
import QuestLog from "../components/modals/QuestLog.jsx";
import Messages, { buildThreads } from "../components/modals/Messages.jsx";
import Companion from "../components/modals/Companion.jsx";
import Settings, { PlazaPicker } from "../components/modals/Settings.jsx";
import Passport from "../components/modals/Passport.jsx";
import { Button, useToast } from "../components/ui/primitives.jsx";
import { usePlazaData } from "../lib/usePlazaData.js";
import { useSettings, setSettings } from "../lib/settings.js";
import { applyTheme, avatarFor, themeFor } from "../lib/avatars.js";
import { playMusic, stopMusic, sfx } from "../lib/sound.js";
import { isDemo } from "../lib/demo.js";

const CAT_KEY = "hearth_categories";

export default function PlazaPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const plazaRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0.05);
  const [near, setNear] = useState(null);
  const [palPos, setPalPos] = useState(null);
  const [modal, setModal] = useState(null);
  const [questId, setQuestId] = useState(null);
  const [msgTo, setMsgTo] = useState(null);
  const [reward, setReward] = useState(null);
  const [badge, setBadge] = useState(null);
  const [liveQuality, setLiveQuality] = useState(null);
  const [seenTick, setSeenTick] = useState(0);
  const [engineError, setEngineError] = useState(null);
  const [customCats, setCustomCats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CAT_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const data = usePlazaData({
    onMessageFrom: (id) => {
      plazaRef.current?.alertFrom(id);
      const m = data.members.find((x) => x._id === id);
      toast(`${m?.username || "A teammate"} sent you a message`, { icon: "💌" });
    },
    onJoin: (m) => toast(`${m.username} walked into the plaza`, { icon: "👋" }),
  });
  const { user, party, quests, notifications, members } = data;

  const homeTheme = party?.owner?.avatarId || user?.avatarId || "frog";
  const themeId = settings.visitTheme || homeTheme;
  const theme = themeFor(themeId);
  const avatar = avatarFor(user?.avatarId);
  const isLead = !!user?.isPartyOwner;

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    if (ready) playMusic(theme.music);
  }, [ready, theme.music]);
  useEffect(() => () => stopMusic(), []);

  useEffect(() => {
    if (data.error?.response?.status === 401) navigate("/login", { replace: true });
  }, [data.error]);

  useEffect(() => {
    setReady(false);
    setProgress(0.05);
  }, [themeId]);

  const openQuest = useCallback((q) => {
    sfx("pop", 0.6);
    setQuestId(q._id);
    setModal("quest");
  }, []);

  const newQuest = useCallback(() => {
    setQuestId(null);
    setModal("quest");
  }, []);

  const goTo = useCallback(
    (q) => {
      setModal(null);
      if (!plazaRef.current?.travelTo(q._id)) openQuest(q);
    },
    [openQuest],
  );

  const callbacks = useMemo(
    () => ({
      onReady: () => setReady(true),
      onProgress: setProgress,
      onNear: setNear,
      onOpenQuest: (q) => openQuest(q),
      onCompanion: setPalPos,
      onMove: data.sendMove,
      onQualityChange: setLiveQuality,
      onError: (e) => {
        console.error(e);
        setEngineError(e);
      },
    }),
    [openQuest, data.sendMove],
  );

  const threads = useMemo(() => (user ? buildThreads(notifications, data.sent, members, user.id) : []), [notifications, data.sent, members, user?.id, seenTick]);
  const unreadMail = threads.reduce((a, t) => a + t.unread, 0);
  const openQuests = quests.filter((q) => q.status !== "Completed");
  const focus = useMemo(() => {
    const mine = openQuests.filter((q) => q.assignedTo?._id === user?.id);
    const pool = mine.length ? mine : openQuests;
    return [...pool].sort((a, b) => new Date(a.dueDate || 8e15) - new Date(b.dueDate || 8e15))[0] || null;
  }, [quests, user?.id]);
  const activeQuest = questId ? quests.find((q) => q._id === questId) || null : null;
  const categories = useMemo(() => [...new Set([...DEFAULT_CATEGORIES, ...customCats, ...quests.map((q) => q.category).filter(Boolean)])], [customCats, quests]);

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (modal || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "q") setModal("log");
      else if (k === "n" && isLead) newQuest();
      else if (k === "m") setModal("messages");
      else if (k === "c") setModal("companion");
      else if (k === "p") setModal("passport");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, isLead, newQuest]);

  const onCompleted = async (updated, before) => {
    data.upsertQuest(updated);
    setModal(null);
    sfx("complete", 0.9);
    plazaRef.current?.celebrate(updated._id);
    setReward({ key: Date.now(), points: updated.points, title: "Quest complete!", sub: updated.title });
    setTimeout(() => setReward(null), 2600);
    const oldBadges = new Set((user?.badges || []).map((b) => b.badgeName));
    try {
      const d = await data.refreshDashboard();
      const fresh = (d.user.badges || []).find((b) => !oldBadges.has(b.badgeName));
      if (fresh) setTimeout(() => setBadge(fresh), 1800);
    } catch {
      data.setUser((u) => (u ? { ...u, totalPoints: (u.totalPoints || 0) + (updated.points || 0) } : u));
    }
  };

  const addCategory = (c) => {
    setCustomCats((prev) => {
      if (prev.includes(c)) return prev;
      const next = [...prev, c];
      localStorage.setItem(CAT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const copyInvite = async () => {
    if (!party?.inviteCode) return toast("You're not in a party yet", { tone: "error" });
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${party.inviteCode}`);
      toast("Invite link copied. Send it to a friend!", { icon: "🔗" });
    } catch {
      setModal("settings");
    }
  };

  const getMinimap = useCallback(() => plazaRef.current?.minimap(), []);

  if (data.loading) return <LoadingVeil show theme={null} progress={0.1} />;

  if (data.error && !user) {
    return (
      <div className="fatal">
        <div className="fatal__card sticker">
          <h1>Can't reach your plaza</h1>
          <p>The Hearth server didn't answer. It may be waking up, which can take up to a minute on the free hosting plan.</p>
          <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="plaza">
      {engineError ? (
        <div className="fatal fatal--inline">
          <div className="fatal__card sticker">
            <h1>3D isn't available here</h1>
            <p>Your browser couldn't start WebGL. Your quests still work from the quest log.</p>
            <Button variant="primary" icon="board" onClick={() => setModal("log")}>Open quest log</Button>
          </div>
        </div>
      ) : (
        user && (
          <PlazaCanvas
            ref={plazaRef}
            theme={theme}
            avatarId={user.avatarId}
            start={user.plazaPosition}
            quests={quests}
            growth={data.completedCount}
            playersRef={data.playersRef}
            playersVersion={data.playersVersion}
            settings={settings}
            callbacks={callbacks}
          />
        )
      )}

      <CompanionMarker pos={ready && !modal ? palPos : null} name={avatar.companionName} onClick={() => setModal("companion")} />

      <div className={`hud ${ready ? "is-ready" : ""}`}>
        <TopBar
          theme={theme}
          party={party}
          user={user}
          notifications={notifications}
          unreadMail={unreadMail}
          onMail={() => {
            setMsgTo(null);
            setModal("messages");
          }}
          onPassport={() => setModal("passport")}
          onMarkRead={data.markRead}
          toast={toast}
        />
        {isDemo() && (
          <div className="demo-flag sticker">
            Demo plaza. Changes reset when you close the tab. <button className="link-btn" onClick={() => navigate("/signup")}>Make your own</button>
          </div>
        )}
        {settings.visitTheme && (
          <div className="visit-flag sticker">
            Visiting the {theme.name}
            <button className="link-btn" onClick={() => setSettings({ visitTheme: null })}>Go home</button>
          </div>
        )}
        <PartyRail
          members={members}
          online={data.online}
          me={user?.id}
          onMessage={(id) => {
            setMsgTo(id);
            setModal("messages");
          }}
          onInvite={copyInvite}
        />
        <FocusCard quest={focus} isLead={isLead} onOpen={openQuest} onGo={goTo} onAdd={newQuest} />
        <Minimap getData={getMinimap} />
        <ProximityPrompt quest={!modal ? near : null} onOpen={openQuest} />
        <Dock
          isLead={isLead}
          openCount={openQuests.length}
          onBoard={() => setModal("log")}
          onAdd={newQuest}
          onCompanion={() => setModal("companion")}
          onSettings={() => setModal("settings")}
          onPlazas={() => setModal("plazas")}
          onEmote={() => plazaRef.current?.emote("wave")}
        />
        <ControlsHint show={ready && !settings.seenControls} onDone={() => setSettings({ seenControls: true })} />
      </div>

      <LoadingVeil show={!ready && !engineError} theme={theme} progress={progress} />
      <RewardBurst reward={reward} theme={theme} reduced={settings.reducedMotion} />
      <BadgeCard badge={badge} onClose={() => setBadge(null)} />

      <QuestModal
        open={modal === "quest"}
        quest={activeQuest}
        isLead={isLead}
        members={members}
        onClose={() => setModal(null)}
        onSaved={data.upsertQuest}
        onCreated={data.upsertQuest}
        onDeleted={data.removeQuest}
        onCompleted={onCompleted}
        companionName={avatar.companionName}
        avatarId={user?.avatarId}
        categories={categories}
        onAddCategory={addCategory}
        toast={toast}
      />
      <QuestLog open={modal === "log"} onClose={() => setModal(null)} quests={quests} me={user?.id} isLead={isLead} onOpen={openQuest} onGo={goTo} onAdd={newQuest} />
      <Messages
        open={modal === "messages"}
        onClose={() => setModal(null)}
        initialTo={msgTo}
        notifications={notifications}
        sent={data.sent}
        members={members}
        me={user?.id}
        onSend={data.sendMessage}
        onSeen={() => setSeenTick((t) => t + 1)}
        toast={toast}
      />
      <Companion open={modal === "companion"} onClose={() => setModal(null)} avatarId={user?.avatarId} name={avatar.companionName} quests={quests} />
      <Settings open={modal === "settings"} onClose={() => setModal(null)} party={party} user={user} liveQuality={liveQuality} toast={toast} />
      <PlazaPicker
        open={modal === "plazas"}
        onClose={() => setModal(null)}
        homeId={homeTheme}
        currentId={themeId}
        onPick={(id) => {
          setModal(null);
          if ((id || homeTheme) !== themeId) setSettings({ visitTheme: id });
        }}
      />
      <Passport open={modal === "passport"} onClose={() => setModal(null)} user={user} toast={toast} />
    </div>
  );
}
