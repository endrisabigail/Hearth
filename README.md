# Hearth
**Gamified Project Management Software**

Hearth is a full-stack productivity app built around a cozy isometric game world. Instead of checkboxes and kanban boards, you manage your tasks inside a hand-crafted environment that allows you to earn XP, maintain streaks, and pick a character to call your own.

Every 3D asset was modeled, lit, and rendered in Blender from scratch. Any 2D features were hand drawn and designed using Procreate.

---

## Demo

---
## Stack

**Frontend** : React.js  
**Backend** : Node.js, Express.js  
**Database** : MongoDB  
**Auth** : JWT (JSON Web Tokens)  
**3D Assets** : Blender  
**2D Assets** : Procreate
**API** : REST  

---

## Features

- Isometric cozy-game interface as the primary UI
- Character selection with custom Blender-rendered characters
- Task management with full CRUD operations
- XP system with dynamic scaling based on task priority and effort
- Streak tracking with server-side validation
- Persistent user progression stored in MongoDB
- JWT-based authentication and protected routes

---

## How It Works

Users log in and are dropped into an isometric world where their tasks and projects exist as in-game objects. Completing a task awards XP (calculated server-side based on difficulty) and contributes to a daily streak. Progress is saved to MongoDB and synced on every session.

Auth is handled with JWTs. Tokens are verified on the server before any protected route is accessed, keeping the client from touching anything it shouldn't.

---

## Background

I built Hearth because I wanted to see if task management could actually feel enjoyable. The cozy-game genre (think Stardew Valley or Animal Crossing) has this quality where even repetitive actions feel rewarding. I wanted to bring that to productivity.

To see more on my journey of making this project, along with live demos, here is a website to my portfolio: 

---

** Built by Abigail Endris ** : [yourportfolio.com] · [(https://www.linkedin.com/in/abigail-endris/)] · [endrisabigail@gmail.com]
