# Hearth 
**Gamified Project Management Web App**

Hearth is a full-stack MERN application that replaces traditional checkboxes with a hand-crafted 3D environment. Built for those who find standard productivity tools clinical, Hearth turns "to-dos" into a digital garden where every completed task contributes to a persistent, evolving world.

---

## Live Demo
**Sign Up Screen**
![signuppage](https://github.com/user-attachments/assets/7be25dad-8971-4373-ac78-9c224a4db629)


**Companion Selection Screen**
![avatarselection](https://github.com/user-attachments/assets/5e2d948a-a81f-4471-8cf4-b679cdbbde85)

<h3 align="center"> Feature Gallery</h3>

<table align="center">
  <tr>
    <td align="center"><img src="./client/public/assets/screenshots/dashboardopening.png" width="350px"><br><sub><b>3D Plaza Overview</b></sub></td>
    <td align="center"><img src="./client/public/assets/screenshots/createQuest.png" width="350px"><br><sub><b>Add a task</b></sub></td>
  </tr>
  <tr>
       <td align="center"><img src="./client/public/assets/screenshots/newQuestAdded.png" width="300px"><br><sub> Dynamic Updates</sub></td>
    <td align="center"><img src="./client/public/assets/screenshots/joinParty.png" width="350px"><br><sub><b>Party Invite </b></sub></td>
  </tr>
</table>

<details>
  <summary align="center"><b>View More System Screenshots (XP Updates, Empty States, etc.)</b></summary>
  <br>
  <table align="center">
    <tr>
          <td align="center"><img src="./client/public/assets/screenshots/manageQuest.png" width="350px"><br><sub><b>Manage the Quest</b></sub></td>
      <td align="center"><img src="./client/public/assets/screenshots/questUpdate.png" width="300px"><br><sub>Task in Progress </sub></td>
    </tr>
    <tr>
      <td align="center"><img src="./client/public/assets/screenshots/blankDash.png" width="300px"><br><sub>Completed Task </sub></td>
      <td></td>
    </tr>
  </table>
</details>


---

## Technical Stack

- **Frontend:** React.js, Three.js (3D Rendering)
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT (Stateful session management)
- **Creative Suite:** Blender & Nomad (3D Assets), Procreate (2D UI/UX)

---

## Key Features

- **Isometric 3D Interface:** A custom-rendered world where tasks are represented as interactive nodes.
- **Dynamic XP System:** Server-side logic calculates XP scaling based on task priority and complexity.
- **Persistent Progression:** Real-time streak tracking and user data synced via MongoDB.
- **Character Customization:** Integrated Blender-rendered.
- **Security:** Full JWT-based protected routes and hashed password storage.

---

## Technical Highlights

- **The Game Loop:** Implemented a `requestAnimationFrame` loop in React to handle smooth 60fps character movement and collision detection.
- **State Management:** Utilized React Hooks and Refs to decouple heavy 3D rendering from the UI, solving potential performance bottlenecks.
- **Asset Optimization:** Low-poly Blender models exported as `.glb` for fast web delivery.

---

## The "Why"
Hearth was born from a desire to bridge the gap between "work" and "play." Inspired by the rewarding feedback loops in games like *Stardew Valley*, I built this to prove that productivity doesn't have to be stressful but instead, a restorative, creative experience.

---

### Connect with Me
**Abigail Endris** [LinkedIn](https://www.linkedin.com/in/abigail-endris/) · [Email](mailto:endrisabigail@gmail.com)
