export const AVATARS = [
  {
    id: "tomato",
    name: "Tammy the Tomato",
    short: "Tammy",
    title: "Forest Keeper",
    blurb: "Ketchup's to everything eventually.",
    emoji: "🍅",
    model: "/models/tomato.glb",
    companion: "/models/companion-tomato.glb",
    companionName: "Sprout",
  },
  {
    id: "frog",
    name: "Froppy the Frog",
    short: "Froppy",
    title: "Wanderer",
    blurb: "Thrives when jumping between big ideas.",
    emoji: "🐸",
    model: "/models/frog.glb",
    companion: "/models/companion-frog.glb",
    companionName: "Lumen",
  },
  {
    id: "fish",
    name: "Finn the Fish",
    short: "Finn",
    title: "Stream Guide",
    blurb: "Plenty of fish in the sea, but none quite like her.",
    emoji: "🐟",
    model: "/models/fish.glb",
    companion: "/models/companion-fish.glb",
    companionName: "Bubbles",
  },
  {
    id: "mushroom",
    name: "Mossy the Mushroom",
    short: "Mossy",
    title: "Forest Sage",
    blurb: "Grows best in quiet, focused places.",
    emoji: "🍄",
    model: "/models/mushroom.glb",
    companion: "/models/companion-mushroom.glb",
    companionName: "Spore",
  },
  {
    id: "apple",
    name: "Abbey the Apple",
    short: "Abbey",
    title: "Harvest Guardian",
    blurb: "An apple a day keeps the quests at bay.",
    emoji: "🍎",
    model: "/models/apple.glb",
    companion: "/models/companion-apple.glb",
    companionName: "Pip",
  },
  {
    id: "snail",
    name: "Shelby the Snail",
    short: "Shelby",
    title: "Patient Seeker",
    blurb: "Never rushed, never behind.",
    emoji: "🐌",
    model: "/models/snail.glb",
    companion: "/models/companion-snail.glb",
    companionName: "Dewdrop",
  },
];

export const AVATAR_BY_ID = Object.fromEntries(AVATARS.map((a) => [a.id, a]));

export const avatarFor = (id) => AVATAR_BY_ID[id] || AVATAR_BY_ID.frog;

export const THEMES = {
  apple: {
    id: "apple",
    world: "orchard",
    name: "Sunset Orchard",
    accent: "#f2734f",
    accent2: "#ffc46b",
    ink: "#4a2a24",
    sky: ["#f7a46b", "#f9d6a3", "#fbe9cf"],
    music: "/audio/backgroundApple.mp3",
    dark: false,
  },
  fish: {
    id: "fish",
    world: "reef",
    name: "Coral Reef",
    accent: "#2fb7c9",
    accent2: "#ff8fa3",
    ink: "#0e3442",
    sky: ["#0d5a73", "#1f8ea3", "#7fd3d9"],
    music: "/audio/backgroundFish.mp3",
    dark: true,
  },
  frog: {
    id: "frog",
    world: "pond",
    name: "Lily Pond",
    accent: "#8fbf5a",
    accent2: "#d8a6e8",
    ink: "#26342a",
    sky: ["#5d5a8f", "#c49bc2", "#f2c8b8"],
    music: "/audio/backgroundFrog.mp3",
    dark: false,
  },
  mushroom: {
    id: "mushroom",
    world: "glowwood",
    name: "Glowwood",
    accent: "#a58bff",
    accent2: "#5ff2d6",
    ink: "#1a1533",
    sky: ["#0d0b24", "#231a4a", "#3d2a68"],
    music: "/audio/backgroundMushroom.mp3",
    dark: true,
  },
  snail: {
    id: "snail",
    world: "raingarden",
    name: "Rain Garden",
    accent: "#6fa58a",
    accent2: "#f2c46d",
    ink: "#23332c",
    sky: ["#8fa3a8", "#b9c6c4", "#dfe5df"],
    music: "/audio/backgroundSnail.mp3",
    dark: false,
  },
  tomato: {
    id: "tomato",
    world: "farm",
    name: "Sunny Farm",
    accent: "#e5533d",
    accent2: "#6cc04a",
    ink: "#3a2a1c",
    sky: ["#5fb4ea", "#a9daf5", "#e8f6fb"],
    music: "/audio/backgroundTomato.mp3",
    dark: false,
  },
};

export const themeFor = (id) => THEMES[id] || THEMES.frog;

export const CATEGORY_ICONS = {
  general: "✦",
  work: "💼",
  school: "📚",
  home: "🏡",
  health: "🌿",
  creative: "🎨",
  errands: "🧺",
  social: "💌",
};

export const categoryIcon = (c) => CATEGORY_ICONS[c] || "🔖";

export const PRIORITY = {
  low: { label: "Low", color: "#7cb86a" },
  medium: { label: "Medium", color: "#e9a93a" },
  high: { label: "High", color: "#e2574c" },
};

export const STATUS = {
  "Not Started": { label: "Not started", color: "#c9a25f" },
  "In Progress": { label: "In progress", color: "#4f8fe0" },
  Completed: { label: "Completed", color: "#4fae6a" },
};

const PANEL = {
  apple: { panel: "#fff4ea", panel2: "#ffe6d2", text: "#4a2a24", muted: "#8a6256", edge: "#4a2a24" },
  fish: { panel: "#0f3746", panel2: "#16495b", text: "#e6fbff", muted: "#8fc4cf", edge: "#06202a" },
  frog: { panel: "#f6f2fb", panel2: "#e9e1f4", text: "#2b2a3d", muted: "#6f6a86", edge: "#2b2a3d" },
  mushroom: { panel: "#1f1a3d", panel2: "#2b2454", text: "#efeaff", muted: "#a59fd0", edge: "#0a0820" },
  snail: { panel: "#f1f5f1", panel2: "#e1ebe3", text: "#23332c", muted: "#62756b", edge: "#23332c" },
  tomato: { panel: "#f4faff", panel2: "#e1f0fb", text: "#3a2a1c", muted: "#7a6a5a", edge: "#3a2a1c" },
};

export function themeVars(id) {
  const t = themeFor(id);
  const p = PANEL[t.id];
  return {
    "--accent": t.accent,
    "--accent-2": t.accent2,
    "--panel": p.panel,
    "--panel-2": p.panel2,
    "--text": p.text,
    "--muted": p.muted,
    "--edge": p.edge,
    "--sky-a": t.sky[0],
    "--sky-b": t.sky[1],
    "--sky-c": t.sky[2],
    "--glass": t.dark ? "rgba(15, 20, 40, 0.62)" : "rgba(255, 255, 255, 0.66)",
    "--line": t.dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
    "color-scheme": t.dark ? "dark" : "light",
  };
}

export function applyTheme(id) {
  const vars = themeVars(id);
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = themeFor(id).id;
  root.dataset.dark = themeFor(id).dark ? "1" : "0";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", vars["--sky-a"]);
}
