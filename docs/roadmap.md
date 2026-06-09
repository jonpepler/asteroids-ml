# Roadmap

Targets the owner's goals: make learning visible and fast, and keep training
progress safe across reloads. The headline UX target is a single training screen:

```
+-----------------------------------------------+------------------+
|                                               |  fitness chart   |
|     CHAMPION running at 1x (main display)      |  best + average  |
|     full render, whiskers, asteroids           |  over generations|
|                                               |                  |
|                                               |  generation stats|
|  +----------------+                           |  (best/avg/      |
|  | brain activity |   <- bottom left          |   median/hitrate)|
|  | (live node     |                           |                  |
|  |  activations)  |                           |                  |
|  +----------------+                           |                  |
+-----------------------------------------------+------------------+
   meanwhile: N sped-up headless runs evaluate the population off-screen
```

The current best genome plays at 1x on the main canvas with its live brain
activity bottom-left, a fitness-over-generations chart sits beside it, and the
actual population evaluation happens fast and headless in the background.

## Phase 0 - Safety and regression recovery (small, high value, do first)

These are surgical and independently shippable.

- **Harden persistence** (`storage.ts`, `runner.ts:saveCurrentGeneration`):
  await writes and handle errors; persist only the latest generation + the
  best-ever genome + a compact per-generation stats history, instead of the
  whole growing array. Removes the silent-save-failure and quota risks.
- **Recover the ML regression** (`runner.ts`): restore feed-forward-only
  mutation (`methods.mutation.FFW`), raise elitism (~25-50), stop mutating the
  elites, and shape fitness with a small per-tick survival/aim reward plus an
  episode time limit. See `ml-model-regression` notes and `recommendations.md`.
- **Seed the per-generation RNG** so every genome in a generation faces the same
  asteroid field (fair selection, and a prerequisite for deterministic replay
  and side-by-side comparison).

## Phase 1 - Decouple simulation from rendering (the enabler)

Everything below needs this. The seam already exists: `gameLoop` in
`asteroids.tsx` takes no p5 argument and contains the whole simulation.

- **Move game state off module globals** into a `GameInstance` class (or a
  `useRef`-owned object) so multiple independent sims can coexist and React 18
  StrictMode double-mount is safe.
- **Extract a pure `step()`** (sim only, no p5 draw calls) on `GameInstance`,
  taking the seeded RNG. This is what lets the sim run faster than the frame
  rate and run many instances at once.
- A thin render layer draws a given `GameInstance` to a p5 canvas; the sim no
  longer owns the canvas.

## Phase 2 - Headless training engine

- **Fast evaluation**: evaluate each genome by running `step()` to completion
  (or an episode time limit) with no rendering, many ticks per slice.
- **Parallel runs via Web Workers**: carrot networks serialize to JSON, so a
  pool of workers can each own a slice of the population, run headless
  evaluations, and post back scores. Pool size scales to
  `navigator.hardwareConcurrency`. The main thread stays smooth.
- **Champion tracking**: the engine maintains the all-time best genome and a
  compact `GenStat[]` history (best/avg/median/min/max, percent that scored).

## Phase 3 - The training screen (the UX target)

- **Champion display (main, 1x)**: render the current best genome playing a
  full-speed, fully-drawn game (reuses the existing render path).
- **Live brain activity (bottom-left)**: extend `getBrainGraph`/`activate` to
  expose per-node activations; tint nodes by activation and color edges by
  signed weight so you can watch the policy fire as the champion dodges.
- **Fitness chart (side panel)**: best + average curves over generations,
  appending live as generations complete. Small dedicated canvas or uPlot
  (tiny, append-friendly) to fit the Vite/React/p5 stack.
- **Generation stats panel**: best/avg/median and percent-scoring, the earliest
  visible signal that learning is happening.
- **Speed controls**: 1x spectator vs turbo training throughput.

## Phase 4 - Showcase, screensaver, sharing (portfolio polish)

- **Attract-mode route**: a chromeless fullscreen `/watch` (or `/screensaver`)
  that just plays the all-time champion. Easy once Phase 3 exists.
- **macOS `.saver` shim** (optional): a WKWebView wrapper pointing at the
  attract-mode URL to satisfy the README screensaver todo. Separate native
  packaging step; the web route is the substance.
- **Export / import / share a brain**: download the champion as `.brain.json`,
  load one back, and a "watch the best brain" landing experience. Optional
  share-link encoding for small networks.

## Sequencing

Phase 0 (independently shippable) -> Phase 1 (enabler) -> Phase 2 (engine) ->
Phase 3 (the screen, where it all becomes visible) -> Phase 4 (polish). Each
phase is browser-verified on the real app before the next.
