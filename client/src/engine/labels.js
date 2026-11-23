import * as THREE from "three";

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function makeLabel(text, {
  bg = "rgba(255, 250, 240, 0.92)",
  fg = "#2d2a24",
  dot = null,
  font = "900 34px Nunito, system-ui, sans-serif",
  height = 0.5,
  maxChars = 22,
} = {}) {
  const t = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  g.font = font;
  const pad = 22;
  const dotW = dot ? 30 : 0;
  const w = Math.ceil(g.measureText(t).width) + pad * 2 + dotW;
  const h = 58;
  c.width = w;
  c.height = h + 6;
  g.font = font;
  g.shadowColor = "rgba(0,0,0,0.18)";
  g.shadowBlur = 6;
  g.shadowOffsetY = 2;
  g.fillStyle = bg;
  roundRect(g, 2, 2, w - 4, h - 4, (h - 4) / 2);
  g.fill();
  g.shadowColor = "transparent";
  if (dot) {
    g.fillStyle = dot;
    g.beginPath();
    g.arc(pad + 8, h / 2, 9, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = fg;
  g.textBaseline = "middle";
  g.fillText(t, pad + dotW, h / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.renderOrder = 10;
  s.scale.set((height * c.width) / c.height, height, 1);
  s.center.set(0.5, 0);
  return s;
}

export function makeBubble(emoji = "💬", { height = 0.7 } = {}) {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 104;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(255,255,255,0.96)";
  g.shadowColor = "rgba(0,0,0,0.2)";
  g.shadowBlur = 6;
  roundRect(g, 6, 6, 84, 72, 30);
  g.fill();
  g.beginPath();
  g.moveTo(38, 76);
  g.lineTo(48, 96);
  g.lineTo(58, 76);
  g.fill();
  g.shadowColor = "transparent";
  g.font = "44px system-ui, Apple Color Emoji, Segoe UI Emoji";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 48, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  s.renderOrder = 11;
  s.scale.set((height * 96) / 104, height, 1);
  s.center.set(0.5, 0);
  return s;
}
