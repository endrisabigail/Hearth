import { getSettings, subscribeSettings } from "./settings.js";

const SFX = {
  click: "/audio/casualClick.mp3",
  pop: "/audio/click.mp3",
  complete: "/audio/complete.mp3",
  mail: "/audio/mail.mp3",
  join: "/audio/new.mp3",
  notify: "/audio/notify.mp3",
};

const pools = new Map();
let unlocked = false;
let music = null;
let musicSrc = null;
let pendingMusic = null;
const live = new Set();

function pool(name) {
  if (!pools.has(name)) {
    const src = SFX[name];
    pools.set(
      name,
      Array.from({ length: 3 }, () => {
        const a = new Audio(src);
        a.preload = "auto";
        return a;
      }),
    );
  }
  return pools.get(name);
}

export function sfx(name, gain = 1) {
  if (!SFX[name] || typeof Audio === "undefined") return;
  const vol = getSettings().sfxVolume * gain;
  if (vol <= 0.001) return;
  const list = pool(name);
  const a = list.find((x) => x.paused || x.ended) || list[0];
  try {
    a.currentTime = 0;
    a.volume = Math.min(1, vol);
    a.play().catch(() => {});
  } catch {}
}

function fade(audio, target, ms, done) {
  cancelAnimationFrame(audio._fade);
  const start = audio.volume;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    audio.volume = Math.max(0, Math.min(1, start + (target - start) * k));
    if (k < 1) audio._fade = requestAnimationFrame(step);
    else done?.();
  };
  audio._fade = requestAnimationFrame(step);
}

function retire(audio) {
  if (!audio) return;
  fade(audio, 0, 600, () => {
    audio.pause();
    live.delete(audio);
  });
  setTimeout(() => {
    if (audio !== music) {
      audio.pause();
      live.delete(audio);
    }
  }, 900);
}

export function playMusic(src) {
  if (typeof Audio === "undefined") return;
  if (!unlocked) {
    pendingMusic = src;
    return;
  }
  if (src && src === musicSrc && music && !music.paused) return;
  for (const a of live) if (a !== music) retire(a);
  retire(music);
  music = null;
  musicSrc = src || null;
  if (!src) return;
  const next = new Audio(src);
  next.loop = true;
  next.volume = 0;
  music = next;
  live.add(next);
  next
    .play()
    .then(() => {
      if (music !== next) {
        next.pause();
        live.delete(next);
        return;
      }
      fade(next, getSettings().musicVolume * 0.6, 1400);
    })
    .catch(() => live.delete(next));
}

export function stopMusic() {
  pendingMusic = null;
  playMusic(null);
}

subscribeSettings((s) => {
  if (music) music.volume = Math.min(1, s.musicVolume * 0.6);
});

if (typeof window !== "undefined") {
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    Object.keys(SFX).forEach(pool);
    if (pendingMusic) {
      const p = pendingMusic;
      pendingMusic = null;
      playMusic(p);
    }
  };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });
}
