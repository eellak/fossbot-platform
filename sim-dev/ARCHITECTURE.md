# Architecture Deepening Opportunities

> Use the vocabulary from the `improve-codebase-architecture` skill.
> **Module** = anything with an interface + implementation.
> **Depth** = leverage behind a small interface. **Shallow** = interface ≈ implementation.
> **Seam** = where behaviour can be altered without editing in place.
> **Locality** = bugs/knowledge concentrated in one place.

## Status

| # | Candidate | Status | Notes |
|---|-----------|--------|-------|
| 1 | Extract `SimEngine` from `App.tsx` | 🟧 in progress | God module → deepened module |
| 2 | Remove world singleton, make it a creation parameter | 🟧 in progress | Enables multi-instance, testability |
| 3 | Split stage builders (visual vs collider) | ⬜ proposed | Shallow `Built` interface |
| 4 | Clean control interface (replace `RuntimeControls` mutation) | ⬜ proposed | Leaky debug menu grab-bag |
| 5 | Separate vehicle physics from visual sync | ⬜ proposed | Physics → render coupling |
| 6 | Configurable asset paths | 🟧 partial | Stage glob fixed; robot `assetBaseUrl` param exists in SimEngineConfig |

---

## 1. Extract `SimEngine` from `App.tsx`

**Files:** `src/App.tsx`

**Problem:** `App.tsx`'s `useEffect` is ~400 lines managing scene init, physics boot, robot loading, stage loading, vehicle creation, debug menu wiring, camera switching, movement presets, position presets, splash screen, telemetry overlay, the game loop, preset drive logic, and cleanup. Its "interface" is the entire closure (~30 local variables). **Deletion test**: deleting it concentrates all complexity — it's not shallow, but it lacks **locality**. The game loop, physics stepping, input processing, and mesh sync are inseparable but spread across callback bodies and inline functions.

**Solution:** Extract a `SimEngine` class that owns the full simulation lifecycle: scene, world, robot, stage, vehicle, game loop, and cleanup. `App.tsx` becomes a thin React wrapper — `new SimEngine(container)`, `engine.start()`, cleanup on unmount. The engine's interface: `start()`, `stop()`, `get controls()`.

**Benefits:** **Locality** — all physics-loop logic in one module. **Leverage** — small interface for a lot of behaviour. Testable (import `SimEngine` without React, drive frame-by-frame, assert state). Front-end integration becomes `useRef` + `new SimEngine()`.

---

## 2. Remove World Singleton

**Files:** `src/physics/world.ts`

**Problem:** `world.ts` uses module-level singleton state (`worldInstance`, `initialized`). `initializeWorld()` always returns the same instance. This prevents multiple simulator instances and provides no **seam** for testing (can't inject a mock world). The coupling is implicit — `createRobotBody` calls `getWorld()` rather than receiving the world as a parameter.

**Solution:** Replace `initializeWorld()` / `getWorld()` with `createWorld()` returning `{ world, step, dispose }`. Pass the world instance into modules that need it. `RAPIER.init()` remains a one-time module-level init.

**Benefits:** **Seam** — inject mock worlds for tests. Multi-instance support. Explicit dependencies (creation vs. access).

---

## 3. Split Stage Builders (Visual vs Collider)

**Files:** `src/stages/builders.ts`, `src/stages/loader.ts`

**Problem:** `builders.ts` (~400 lines) creates both Three.js visuals AND Rapier colliders for every stage entry. The `Built` interface forces both concerns together — every caller must understand the visual+physics duality. Model loading (OBJ/STL caching, CoACD resolution, compound convex generation) is mixed with primitive shape construction. The **interface** is nearly as complex as the implementations.

**Solution:** Split into visual builders (Three.js objects) and collider builders (Rapier `ColliderDesc` arrays). Shared input schema, separate outputs. The loader composes them. Model loading becomes its own module.

**Benefits:** **Locality** — collider logic in one place, visual logic in another. Testable (assert collider shapes without rendering). Adding a stage type = two focused functions.

---

## 4. Clean Control Interface

**Files:** `src/debug/`, `src/debug/types.ts`, `src/App.tsx`

**Problem:** `RuntimeControls` is a plain object mutated directly by the debug menu. The debug menu also receives `robotPhysics`, `vehicle`, `world`, `getCurrentStage` as a grab-bag — it knows internals of every layer. No **seam** between UI and engine.

**Solution:** Define `SimControlInterface` with deliberate surfaces: `pause()`, `resume()`, `stepOnce()`, `setTimeScale(n)`, `setTurnScale(n)`, `setTelemetryVisible(bool)`, `showColliders(bool)`, `resetRobot()`. Debug menu uses only this interface.

**Benefits:** Clean **seam**. Debug menu becomes a pure consumer. Mockable for testing.

---

## 5. Separate Vehicle Physics from Visual Sync

**Files:** `src/physics/vehicle.ts`

**Problem:** `createVehicle` (~250 lines) implements the entire raycast wheel model AND directly manipulates visual wheels (`visualWheels[i].rotation.x = wheelSpin[i]`). Physics and rendering are coupled. No **adapter seam** to swap the drive model.

**Solution:** Vehicle outputs `WheelPhysicsResult` per wheel (contact, forces, suspension compression). A separate sync function applies rotations to Three.js meshes.

**Benefits:** Testable physics without Three.js. **Locality** of math. Clean **interface** for the engine.

---

## 6. Configurable Asset Paths

**Files:** `src/robot/v2.ts`, `src/stages/index.ts`

**Problem:** Robot loader hardcodes `BASE_URL = '/js-simulator/models/robots/v2'`. Stage loader uses a relative glob reaching into `front-end/public/`. When this becomes a submodule, paths break.

**Solution:** Pass `AssetResolver` or base URL at engine initialization. Stages glob relative to own `data/` directory, not `front-end/`.

**Benefits:** Portability. Drop-in anywhere.
