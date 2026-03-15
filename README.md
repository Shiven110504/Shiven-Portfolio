# Shiven — Robotics & RL Portfolio

A personal portfolio website showcasing robotics simulation expertise. The core feature is an interactive hero section running real MuJoCo physics and RL-trained policies entirely in the browser via WebAssembly — no server required.

## Live Features

| Feature | Status |
|---------|--------|
| MuJoCo physics (WASM) | ✅ |
| Three.js 3D rendering | ✅ |
| MuJoCo Humanoid robot | ✅ |
| Unitree Go2 quadruped | ✅ |
| Unitree H1 humanoid | ✅ |
| Model switching | ✅ |
| Mouse drag / force application | ✅ |
| Camera follow mode | ✅ |
| Pause / Resume / Reset physics | ✅ |
| Walking gait (hand-tuned) | ✅ |
| RL policy inference (ONNX Runtime Web) | 🔜 Phase 4 |
| Portfolio sections (About, Skills, Projects, Contact) | 🔜 Phase 3 |
| Full test suite | 🔜 Phase 2 |

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5 (strict)
- **Physics:** MuJoCo 2.2.2+ via WebAssembly
- **3D Rendering:** Three.js 0.179
- **Animation:** Framer Motion 12
- **Styling:** Tailwind CSS 4
- **Testing:** Vitest + React Testing Library + Playwright _(coming Phase 2)_
- **RL Inference:** ONNX Runtime Web _(coming Phase 4)_

## Local Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint       # ESLint
```

## Testing

```bash
npm test           # unit + component tests (Vitest)
npm run test:watch # watch mode
npm run test:e2e   # Playwright end-to-end tests
```

> Tests will be wired up in Phase 2. Run `npm run lint` in the meantime.

## Architecture

```
src/
  app/
    layout.tsx              — root layout, metadata, fonts
    page.tsx                — main page (simulator + future portfolio sections)
    globals.css             — global styles
  components/
    MuJoCoSimulator.tsx     — core: physics loop, Three.js render, model loading
    gait-controller.ts      — sinusoidal gait controller (walk), PD control for motors
    mujoco-loader.ts        — WASM loading, virtual filesystem setup
    robot-geometry-builder.ts — converts MuJoCo model → Three.js meshes
    robot-models.ts         — robot config registry (paths, display names)
    DragStateManager.ts     — mouse raycasting + force application
    camera-controller.ts    — camera follow / orbit logic
    Reflector.ts            — reflective ground plane shader
    types/mujoco.ts         — TypeScript types for MuJoCo WASM API
    ui/
      control-panel.tsx     — model/action selector, pause/reset buttons
      loading-screen.tsx    — loading state UI
      error-screen.tsx      — error display

public/
  mujoco_wasm.{wasm,js,d.ts}   — MuJoCo WebAssembly binary + loader
  humanoid/                     — MuJoCo standard humanoid (XML)
  unitree_go2/                  — Unitree Go2 quadruped (XML + OBJ meshes)
  unitree_h1/                   — Unitree H1 humanoid (XML + STL meshes)
  common/                       — shared environment XML
  policies/                     — ONNX policy weights (Phase 4)
```

## Roadmap

### Phase 1 — Cleanup & Refactoring ✅
- Removed dead code (`action-controller.ts`)
- Removed vendor READMEs / CHANGELOGs from `public/`
- Removed duplicate `lib/wasm/` directory
- Renamed `ZMPController` → `GaitController`, file renamed accordingly
- Cleaned all debug `console.log` from production hot paths
- Updated layout metadata (title, description, OG tags)

### Phase 2 — Testing Infrastructure 🔜
- Vitest + React Testing Library for unit + component tests
- Playwright for E2E tests
- MuJoCo WASM mock for fast unit tests
- Target: >70% coverage on core controller and loader logic

### Phase 3 — Portfolio Page Structure 🔜
- Scrollable page: Hero → About → Skills → Projects → Contact
- Sticky navigation bar with smooth-scroll links
- Simulator as full-viewport hero section
- Responsive design (mobile + desktop)

### Phase 4 — RL Policy Integration 🔜
- ONNX Runtime Web for in-browser policy inference
- Walk, Run, Squat, Dance actions driven by trained policies
- Policy weights: `public/policies/<robot>/<action>.onnx`
- Web Worker inference to keep render thread smooth
- Graceful fallback to hand-tuned gaits if ONNX unavailable

### Phase 5 — Polish & Launch 🔜
- Lighthouse ≥ 90 across Performance, Accessibility, Best Practices, SEO
- OG image, `robots.txt`, `sitemap.xml`
- Accessibility: `aria-label`, keyboard nav, reduced-motion support
- Mobile: lower render quality, touch-friendly controls

## Robot Models

| Robot | Type | Joints | Source |
|-------|------|--------|--------|
| MuJoCo Humanoid | Bipedal | 23 | MuJoCo standard library |
| Unitree Go2 | Quadruped | 12 | Unitree public URDF (BSD-3-Clause) |
| Unitree H1 | Humanoid | ~26 | Unitree public URDF (BSD-3-Clause) |

## Interaction Guide

- **Drag** any part of the robot to apply forces
- **Orbit** camera: left-click drag
- **Pan** camera: right-click drag
- **Zoom**: scroll wheel
- **Walk action**: starts gait; camera auto-follows
- **R key**: reset simulation
