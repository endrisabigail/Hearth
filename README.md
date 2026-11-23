![Status](https://img.shields.io/badge/Status-In--Development-green?style=flat-square)
# [Hearth](https://hearth-umber-six.vercel.app/) 
**Gamified Project Management Web App**

Hearth is a fully deployed, full-stack MERN application with Socket.IO as a real-time engine and firebase authentication, that replaces traditional checkboxes with a hand-crafted 3D environment. Built for those who find standard productivity tools clinical, Hearth turns "to-dos" into a digital plaza where every completed task contributes to a evolving world. Hearth also includes an AI companion to help break down tasks/quests to better incentivize users in starting task.

---

## Technical Stack

- **Frontend:** React.js, Three.js (3D Rendering)
- **Backend:** Node.js, Express.js
- **Real-Time Engine:** Socket.IO (live multiplayer presence in the plaza)
- **Database:** MongoDB Atlas (Mongoose ODM)
- **Authentication:** Firebase Authentication (ID tokens verified server-side via Firebase Admin SDK)
- **Creative Suite:** Blender & Nomad (3D Assets & Animation), Procreate (2D UI/UX)

---

## How It Works

Hearth bridges a high-performance 3D engine with a traditional MERN stack, turning standard database operations into a tangible, interactive experience.

### The 3D Engine & Input
* **Keyboard State Tracking:** Utilizes custom event listeners for **WASD/Arrow keys** to bypass default browser latency, allowing for fluid, "zero-lag" character movement.
* **Proximity Logic:** The application calculates the player's mathematical distance to 3D task nodes in real-time to determine which quest is currently being "visited" or interacted with.
* **Asset Optimization:** Custom **Blender** models are exported as `.glb` files.

### Live Multiplayer Plaza
* **Real-Time Presence:** A Socket.IO layer runs alongside the Express server, broadcasting each player's position to every other member of their party as they move — so party members can see each other's characters walking around the plaza live, not just on refresh.
* **Party-Scoped Rooms:** Presence is scoped per party (the "Hearth" a group shares), so only teammates who've joined the same invite link see each other in real time.
* **Persistence Separate from Presence:** Live movement streams over the socket for responsiveness, while each player's last-known position is still saved to MongoDB, so a page refresh restores exactly where they left off.

---

### The Gamified Backend
* **Dynamic Reward Scaling:** Upon task completion, the Node/Express backend calculates XP rewards based on priority and difficulty metadata, triggering a "Gold XP" animation on the frontend.
* **Cloud Persistence:** All user states, character choices, and party memberships are synced via **MongoDB Atlas**, ensuring progress is saved and synchronized across all sessions.
* **Secure Collaboration:** Plazas and quest data are protected by **Firebase-verified authentication**, ensuring that party interactions and private data remain secure.

---

## Key Features

- **Explorable 3D Plaza:** A fully interactive isometric world where tasks are represented as physical, interactive nodes.
- **Live Multiplayer Presence:** Watch party members' characters move through the plaza in real time via Socket.IO.
- **Social Party System:** Invite friends to your plaza to share quest lists and track group productivity in a shared space.
- **Persistent Progression:** Real-time streak tracking and experience points (XP) that evolve your digital garden over time.
- **Character Customization:** Choose from unique, Blender-rendered companions that represent your player profile.
- **Security-First Design:** Firebase-authenticated protected routes for all user data.
  
---

## Technical Highlights

- **The Game Loop:** Implemented a `requestAnimationFrame` loop in React to handle smooth 60fps character movement and collision detection.
- **Real-Time Sync:** Socket.IO namespace scoped per party, with client-side interpolation so remote players' movement appears smooth despite network-rate position updates.
- **State Management:** Utilized React Hooks and Refs to decouple heavy 3D rendering from the UI, solving potential performance bottlenecks.
- **Asset Optimization:** Low-poly Blender models exported as `.glb` for fast web delivery.

---

## The "Why"
Hearth was born from a desire to bridge the gap between "work" and "play." Inspired by the rewarding feedback loops in games like *Stardew Valley*, I built this to prove that productivity doesn't have to be stressful but instead, a restorative, creative experience.

---

### Connect with Me
**Abigail Endris** [LinkedIn](https://www.linkedin.com/in/abigail-endris/) · [Email](mailto:endrisabigail@gmail.com)
