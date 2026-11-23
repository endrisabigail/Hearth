import { useEffect, useState } from "react";
import { motion } from "motion/react";
import AvatarStage from "../components/AvatarStage.jsx";
import Icon from "../components/ui/Icon.jsx";
import { applyTheme } from "../lib/avatars.js";
import { playMusic, stopMusic } from "../lib/sound.js";

export function Brand({ small }) {
  return (
    <div className={`brand ${small ? "brand--small" : ""}`}>
      <img src="/hearth-mark.png" alt="" className="brand__mark" />
      <span className="brand__word">Hearth</span>
    </div>
  );
}

export default function AuthLayout({ children, stage = true, theme = "frog" }) {
  const [music, setMusic] = useState(false);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => () => stopMusic(), []);

  const toggleMusic = () => {
    if (music) stopMusic();
    else playMusic("/audio/calm_breeze.mp3");
    setMusic(!music);
  };

  return (
    <div className="auth">
      <div className="auth__sky" aria-hidden="true">
        <span className="cloud cloud--a" />
        <span className="cloud cloud--b" />
        <span className="cloud cloud--c" />
      </div>
      {stage && <AvatarStage mode="ring" className="auth__stage" />}
      <motion.main className="auth__panel sticker" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.05 }}>
        <Brand />
        {children}
      </motion.main>
      <button className="icon-btn auth__music" onClick={toggleMusic} aria-label={music ? "Turn music off" : "Turn music on"} data-tip={music ? "Music on" : "Music off"}>
        <Icon name={music ? "sound" : "mute"} />
      </button>
    </div>
  );
}
