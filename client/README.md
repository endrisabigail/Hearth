# Hearth client (v2)

React 19 + Vite + Three.js. Talks to the existing Express / Socket.IO / MongoDB backend with no backend changes needed.

## Run it

```bash
cd client
npm install
cp .env.example .env   # fill in VITE_API_URL and the Firebase keys
npm run dev
```

No Firebase keys? The sign-in page still offers **Walk around a demo plaza**, which runs entirely in the browser with fake teammates, quests and a scripted companion. It's handy for portfolio visitors and for working on the UI without the backend.

## Where things live

```
src/
  engine/        3D runtime (no React)
    Engine.js        renderer, frame loop, resize, auto quality
    Plaza.js         player, companion, teammates, input, camera, quest markers
    Character.js     procedural animation: idle, hop-walk, squash and stretch, jump, celebrate, wave
    QuestMarkers.js  themed quest objects, pulse rings, labels, urgency flags
    particles.js     GPU particle fields (fireflies, rain, spores, bubbles) and reward bursts
    shaders.js       wind sway, caustics, sky, water
    Stage.js         the floating island on the sign-in and character screens
  worlds/        one file per plaza, plus kit.js (shared building blocks)
    orchard.js     apple    Sunset Orchard
    reef.js        fish     Coral Reef
    pond.js        frog     Lily Pond
    glowwood.js    mushroom Glowwood
    raingarden.js  snail    Rain Garden
    farm.js        tomato   Sunny Farm
  pages/         sign in, sign up, password reset, invite, character select, plaza
  components/    HUD, modals, UI primitives
  lib/           api + sockets, auth, demo mode, settings, sound, avatar/theme data
public/
  models/        optimized .glb files (meshopt-compressed, single mesh each)
  audio/         re-encoded music and sound effects
```

## How a plaza is chosen

A party's plaza is the party lead's character. Anyone can visit the other five from the map button in the dock; that's local to them, and teammates still see them at home.

## Performance notes

- Every scenery model is drawn with `InstancedMesh`, so 200 trees cost one draw call.
- Each plaza renders in roughly 50–80 draw calls and 200–300k triangles (the old scenes were tens of thousands of draw calls and well over 100 million triangles).
- Graphics quality is automatic by default. If the frame rate drops it steps down from Pretty → Balanced → Battery saver (no shadows, 1x pixel ratio). Players can pin it in Settings.
- Plaza code and music load only when you enter that plaza.

## Growth

Each completed quest in the party grows the world a little: lanterns light up in the Orchard, lotus lanterns float on the Pond, the Rain Garden's rain thins out and a rainbow appears, glowing coral sprouts on the Reef, the Glowwood fairy ring fills in, and the Farm gets pumpkins and flowers.

## Keyboard

| Key | Action |
| --- | --- |
| WASD / arrows | Walk (Shift to run) |
| Click / tap ground | Walk there |
| Space | Jump |
| E or Enter | Open the nearby quest |
| Q | Quest log |
| N | New quest (party lead) |
| M | Messages |
| C | Companion chat |
| P | Passport |
| Esc | Close panel |
