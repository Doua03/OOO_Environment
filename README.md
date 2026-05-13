# OOO — Opening Environment

A browser-based 3D interactive experience built with [Three.js](https://threejs.org/). The player explores a magical nexus containing four character portals, each leading to a unique world.

---

## Preview

> Walk through a mystical environment, approach a portal, and press `E` to enter a character's world.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)

### Install & Run

```bash
# Install dependencies
npm install

# Start the dev server
npx vite
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Controls

| Input | Action |
|---|---|
| `Click` | Lock mouse pointer |
| `W A S D` | Move |
| `Mouse` | Look around |
| `E` | Enter a portal (when close enough) |
| `Any key` | Dismiss character introduction card |

---

## Project Structure

```
├── index.html          # Entry point, import map for Three.js
├── main.js             # All scene logic
└── models/
    ├── environment/    # Main nexus environment (GLTF)
    ├── portal/         # Portal arch model (GLTF) — used for all 4 portals
    ├── grass/          # Grass asset
    ├── trees/          # Trees asset
    ├── sky/            # Sky asset
    └── lonely/         # Sidewalk scene asset (loaded on Kael's portal)
```

---

## Characters & Portals

Four portals are placed in a row along the far wall of the environment, each tinted with its character's color.

| # | Name | Subtitle | Color | Zone |
|---|---|---|---|---|
| 1 | Kael | The Lonely | Ice Blue `#88ccff` | Hollow Forest |
| 2 | Sura | The Controller | Rose Gold `#ffaa99` | Candy Ruins |
| 3 | Lome | The Shapeshifter | Amber Green `#aaff88` | Shifting Marsh |
| 4 | Vey | The Grieving | Deep Violet `#8800ff` | Ash Plains |

### Kael's Portal — The Lonely World

Entering Kael's portal transitions the player into a separate procedural scene:
- Dark ground plane with a faint blue grid
- A single street lamp casting warm amber light
- Drifting fog motes
- Silhouette pillars receding into the dark

---

## Visual Systems

| System | Description |
|---|---|
| Sky shader | Animated gradient sky with drifting clouds |
| God rays | Rotating radial light effect overhead |
| Ambient particles | 5000 floating blue motes drifting through the scene |
| Portal arch lights | 7 point lights per portal flickering like torchlight through stone |
| Portal swirl particles | Rotating particle cloud around each portal |
| Portal interaction prompt | Appears when player is within range of a portal |
| Character introduction card | Slides in on portal entry with lore and zone info |
| Scene transition | Fade-to-black between main scene and character worlds |

---

## Configuration

Key values are centralized in the `CONFIG` object at the top of `main.js`:

```js
const CONFIG = {
    player:  { speed: 4, height: 9 },
    portals: { interactionDistance: 12, transitionDuration: 1.0 },
    shadows: { mapSize: 1024, bias: -0.001 }
};
```

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| [three](https://www.npmjs.com/package/three) | `^0.167.1` | 3D rendering |
| [vite](https://vitejs.dev/) | latest (via npx) | Dev server & bundler |

---

## License

Assets in the `models/` directory are sourced from [Sketchfab](https://sketchfab.com) under their respective licenses. See the `license.txt` file inside each model folder for details.
