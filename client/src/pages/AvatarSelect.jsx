import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import AvatarStage from "../components/AvatarStage.jsx";
import Avatar from "../components/ui/Avatar.jsx";
import Icon from "../components/ui/Icon.jsx";
import { Button } from "../components/ui/primitives.jsx";
import { Brand } from "./AuthLayout.jsx";
import { AVATARS, applyTheme, themeFor } from "../lib/avatars.js";
import { api, errMsg } from "../lib/api.js";
import { sfx } from "../lib/sound.js";
import { isDemo, enterDemo } from "../lib/demo.js";

export default function AvatarSelect() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [index, setIndex] = useState(() => Math.max(0, AVATARS.findIndex((a) => a.id === (params.get("current") || "apple"))));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stageRef = useRef(null);
  const av = AVATARS[index];
  const theme = themeFor(av.id);

  useEffect(() => {
    applyTheme(av.id);
  }, [av.id]);

  const go = (d) => {
    sfx("click", 0.7);
    setIndex((i) => (i + d + AVATARS.length) % AVATARS.length);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (saving) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving]);

  const confirm = async () => {
    setSaving(true);
    setError("");
    sfx("complete", 0.7);
    stageRef.current?.celebrate();
    try {
      if (isDemo()) enterDemo(av.id);
      await Promise.all([api.post("/auth/update-avatar", { avatarId: av.id }), new Promise((r) => setTimeout(r, 1300))]);
      navigate("/plaza");
    } catch (err) {
      setError(errMsg(err, "Couldn't save your character. Try again."));
      setSaving(false);
    }
  };

  return (
    <div className="pick">
      <div className="pick__sky" aria-hidden="true" />
      <header className="pick__top">
        <Brand small />
        <span className="pick__step">{params.get("invite") ? "Last step before you join your party" : "Choose who you'll be in the plaza"}</span>
      </header>
      <AvatarStage ref={stageRef} mode="single" avatarId={av.id} className="pick__stage" />
      <button className="pick__nav pick__nav--prev icon-btn" onClick={() => go(-1)} aria-label="Previous character">
        <Icon name="back" size={24} />
      </button>
      <button className="pick__nav pick__nav--next icon-btn" onClick={() => go(1)} aria-label="Next character">
        <Icon name="chevron" size={24} />
      </button>
      <section className="pick__card sticker" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div key={av.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <p className="pick__class">{av.title}</p>
            <h1 className="pick__name">{av.name}</h1>
            <p className="pick__blurb">{av.blurb}</p>
            <div className="pick__plaza">
              <span className="pick__swatch" style={{ background: `linear-gradient(135deg, ${theme.sky[0]}, ${theme.sky[2]})` }} />
              <div>
                <p className="pick__plaza-name">Plaza: {theme.name}</p>
                <p className="pick__plaza-line">{theme.tagline}</p>
              </div>
            </div>
            <p className="pick__companion">Your companion is {av.companionName}, who floats beside you and helps break big quests into small steps.</p>
          </motion.div>
        </AnimatePresence>
        <div className="pick__thumbs" role="tablist" aria-label="Characters">
          {AVATARS.map((a, i) => (
            <button key={a.id} role="tab" aria-selected={i === index} aria-label={a.name} className={`pick__thumb ${i === index ? "is-on" : ""}`} onClick={() => setIndex(i)}>
              <Avatar avatarId={a.id} size={40} />
            </button>
          ))}
        </div>
        {error && <p className="form__error">{error}</p>}
        <Button variant="primary" size="lg" onClick={confirm} loading={saving} className="pick__confirm">
          Play as {av.short}
        </Button>
      </section>
    </div>
  );
}
