# Collaborative Canvas with Real-Time User Presence

## 📌 Overview

This project is a **real-time collaborative canvas** built using **React**, **Fabric.js**, and **Firebase Firestore**.  
Multiple users can **draw, add shapes, and edit a shared canvas** simultaneously.  
Each connected participant is represented by a **“Guest N”** identity with a unique color-coded live cursor.

The system automatically:

- Detects when a user **joins** the canvas and shows a **toast notification**.
- Detects when a user **leaves** or closes their tab and shows a **toast notification**.
- Syncs the canvas state in real-time across all connected clients.

## ⚖️ Trade-offs & Design Decisions

1. **No Authentication for Speed**

   - Avoided user accounts to simplify the setup and speed up development.
   - Used generated client IDs with auto-assigned `Guest N` labels.
   - **Trade-off:** No real-world user identification and possible name collisions.

2. **Optimized for Real-Time Presence First**

   - Main focus was multi-user presence and live cursor updates.
   - Deferred **Snap-to-Grid** and **alignment guides** for later development.

3. **Undo/Redo with Local History**

   - Undo/redo stacks are stored locally to avoid heavy Firestore writes.
   - **Trade-off:** History does not persist after page refresh.

4. **Firestore for State & Presence Sync**
   - Firestore stores both the full canvas JSON and presence data.
   - **Trade-off:** Large canvases can increase Firestore read/write costs.

---

## ✨ Bonus Features (Current & Planned)

### ✅ Currently Implemented

- **User Presence Tracking**
  - Live connected user list with unique colors.
  - Join/leave toast notifications.
- **Real-Time Canvas Sync** between multiple clients.
- **Basic Drawing Tools**: Rectangle, Circle, Text, Freehand Pen.
- **Undo/Redo** (local session only).

### 📅 Planned for Future Updates

- **Snap-to-Grid** & **Smart Alignment Guides**.
- **Persistent Undo/Redo Across Sessions**.
- **Drawing Permissions** (viewer/editor roles).
- **Authentication & Named Users**.

## Project structure

```
stateless-canva-app/
├── index.html              # HTML entry point used by Vite
├── package.json            # Project metadata, dependencies and scripts
├── postcss.config.js       # PostCSS configuration for Tailwind
├── tailwind.config.js      # Tailwind configuration
├── vite.config.js          # Vite configuration with React plugin
├── src/
│   ├── main.jsx            # React entry point
│   ├── App.jsx             # Root component
│   ├── index.css           # Tailwind directives
│   ├── config/
│   │   └── firestore.js     # Firebase initialisation
│   ├── routes/
│   │   └── AppRoutes.jsx    # React Router configuration
│   ├── screens/
│   │   ├── HomeScreen.jsx   # Redirects to a new scene
│   │   └── CanvasScreen.jsx # Main collaborative editor
│   └── components/
│       └── Toolbar.jsx      # Toolbar UI component
└── README.md               # This file
```

## Getting started

1. **Install dependencies** (requires Node.js and npm):

   ```bash
   cd stateless-canva-app
   npm install
   npm run dev
   ```

   Vite will start a development server (default at `http://localhost:5173`) with hot module replacement. Navigate to `/` to begin.

2. **Configure Firebase** – Open `src/config/firestore.js` and replace the placeholder fields (`apiKey`, `authDomain`, `projectId`, …) with your Firebase project’s credentials. See the Firebase documentation for how to obtain these values.

   Ensure that your Firestore rules permit unauthenticated read and write access to the `scenes` collection if you want open collaboration. A permissive development ruleset might look like:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /scenes/{sceneId} {
         allow read, write: if true;
       }
     }
   }
   ```

   **Note:** Open rules are unsafe for production. Add appropriate authentication and validation for a real deployment.

3. **Using the app** – Visit the root of the development server. You’ll be redirected to `/canvas/<generated-id>`. Use the toolbar to draw, edit and export your canvas. Click **Share** to copy the current URL to your clipboard.

