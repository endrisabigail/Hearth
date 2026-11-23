import { useSyncExternalStore } from "react";

const KEY = "hearth_settings_v2";

const prefersReduced =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const DEFAULTS = {
  musicVolume: 0.55,
  sfxVolume: 0.6,
  quality: "auto",
  reducedMotion: !!prefersReduced,
  showNames: true,
  seenControls: false,
  visitTheme: null,
};

function load() {
  try {
    const legacyMusic = localStorage.getItem("hearth_musicVolume");
    const legacySfx = localStorage.getItem("hearth_sfxVolume");
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    const base = { ...DEFAULTS };
    if (legacyMusic !== null) base.musicVolume = Number(legacyMusic) / 100;
    if (legacySfx !== null) base.sfxVolume = Number(legacySfx) / 100;
    return { ...base, ...(saved || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

let state = typeof window === "undefined" ? { ...DEFAULTS } : load();
const listeners = new Set();

export function getSettings() {
  return state;
}

export function setSettings(patch) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l(state));
}

export function subscribeSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSettings() {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}
