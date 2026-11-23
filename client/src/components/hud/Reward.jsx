import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import Icon from "../ui/Icon.jsx";
import { Button } from "../ui/primitives.jsx";

function Confetti({ run, colors }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!run) return;
    const c = ref.current;
    const g = c.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    g.scale(dpr, dpr);
    const parts = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.42,
      vx: (Math.random() - 0.5) * 14,
      vy: -8 - Math.random() * 10,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 6,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf;
    const t0 = performance.now();
    const step = (now) => {
      const k = (now - t0) / 2600;
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.32;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        g.save();
        g.globalAlpha = Math.max(0, 1 - k * k);
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.c;
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        g.restore();
      }
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}

export function RewardBurst({ reward, theme, reduced }) {
  return (
    <>
      {reward && !reduced && <Confetti run={reward.key} colors={[theme.accent, theme.accent2, "#ffd166", "#ffffff", "#7fd6ff"]} />}
      <AnimatePresence>
        {reward && (
          <motion.div key={reward.key} className="reward" initial={{ opacity: 0, scale: 0.6, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -40, scale: 0.9 }} transition={{ type: "spring", stiffness: 380, damping: 18 }} role="status">
            <span className="reward__coin"><Icon name="coin" size={34} /></span>
            <span className="reward__pts">+{reward.points}</span>
            <span className="reward__title">{reward.title}</span>
            <span className="reward__sub">{reward.sub}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function BadgeCard({ badge, onClose }) {
  return (
    <AnimatePresence>
      {badge && (
        <motion.div className="badge-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="badge-card sticker" initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: -2 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New stamp">
            <motion.span className="badge-card__stamp" initial={{ scale: 2.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.25, type: "spring", stiffness: 500, damping: 16 }}>
              {badge.badgeName.includes("First") ? "🌱" : "🌿"}
            </motion.span>
            <p className="badge-card__kicker">New stamp in your passport</p>
            <h2 className="badge-card__name">{badge.badgeName}</h2>
            <p className="badge-card__desc">{badge.badgeDescription}</p>
            <Button variant="primary" onClick={onClose} data-autofocus>Nice!</Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
