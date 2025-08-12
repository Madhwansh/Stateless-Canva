# Stateless-Canva

This repository contains a Vite + React implementation of a shareable canvas editor.  The application allows users to draw rectangles, circles and freeform paths, insert editable text, adjust colours, undo/redo actions, export the canvas and collaborate through a shared link.  The state of each canvas is stored in Firebase Firestore; clients listen for real‑time updates via `onSnapshot()` and persist changes by writing serialised Fabric.js JSON using `set()`.

## Features

* **Modern tooling** – Built with [Vite](https://vitejs.dev/) for fast development builds and [Tailwind CSS](https://tailwindcss.com/) for styling.
* **Real‑time collaboration** – Multiple users editing the same `/canvas/:id` route will see each other's changes instantly thanks to Firestore snapshots.
* **Rich editing tools** – Add rectangles, circles, text boxes or draw freely with the pen tool.  Modify object colours, move, resize and rotate objects.
* **Undo/Redo & Export** – Navigate through a history of changes or export the canvas as PNG or SVG images.
* **Shareable links** – The home route generates a new scene ID and redirects to `/canvas/:id`.  Share the URL to collaborate with anyone.

## Project structure

```
vite-canvas-app/
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
   cd vite-canvas-app
   npm install
   npm run dev
   ```

   Vite will start a development server (default at `http://localhost:5173`) with hot module replacement.  Navigate to `/` to begin.

2. **Configure Firebase** – Open `src/config/firestore.js` and replace the placeholder fields (`apiKey`, `authDomain`, `projectId`, …) with your Firebase project’s credentials.  See the Firebase documentation for how to obtain these values.

   Ensure that your Firestore rules permit unauthenticated read and write access to the `scenes` collection if you want open collaboration.  A permissive development ruleset might look like:

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

   **Note:** Open rules are unsafe for production.  Add appropriate authentication and validation for a real deployment.

3. **Using the app** – Visit the root of the development server.  You’ll be redirected to `/canvas/<generated-id>`.  Use the toolbar to draw, edit and export your canvas.  Click **Share** to copy the current URL to your clipboard.

## Styling

The interface is styled with Tailwind CSS utility classes.  For example, the toolbar uses `flex`, `gap-2`, `bg-white`, `shadow`, `sticky` and other classes to achieve a clean responsive layout.  Custom CSS is kept to a minimum; you can add global styles in `src/index.css` or extend Tailwind via `tailwind.config.js`.

## Technical notes

* Firestore listeners created with `onSnapshot()` fire immediately with the current document contents and then whenever the document changes.  The app uses this mechanism to keep all clients in sync.
* Fabric.js serialises the canvas with `toJSON()` and restores it with `loadFromJSON()`.  These objects are saved as plain JSON documents in Firestore.
* Undo/Redo stacks are stored in memory and capped at 50 states.  Feel free to improve this for larger projects.

Enjoy building and collaborating on your canvases!
