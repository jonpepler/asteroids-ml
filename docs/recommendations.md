# Recommendations

Forward-looking notes after the Vite/TypeScript rehab. Nothing here was changed
as part of that work (behaviour was kept identical); this is a roadmap.

## Current setup, in brief

- Network: `new Neat(16, 4, { population_size: 200, elitism: 10 })`.
- Inputs (16): whisker sensors only. 8 long (500px) + 8 short (200px), each
  returning a distance ratio in `[0, 1]` to the nearest asteroid along that ray
  (`1` = nothing seen, lower = closer). See `generateBrainInput` in
  `src/components/asteroids.tsx`.
- Outputs (4): rounded to booleans for `[shoot, boost, rotateLeft, rotateRight]`.
- Fitness: `+10` per asteroid destroyed, `+1000` for clearing the field. A run
  ends when the ship dies or the field is cleared. See `runner.ts` and
  `updateAsteroids`/`trainingEnd`.
- Each genome is evaluated by playing one real-time, rendered game.

## High impact

### 1. Fix the learning signal: shape the fitness function
Today a genome that survives 60 seconds without hitting anything scores exactly
the same (0) as one that dies instantly. Early random genomes almost never hit
an asteroid, so the fitness landscape is flat and selection has nothing to work
with. Add a small dense reward so survival and aiming are rewarded before kills
become reachable:
- Small per-tick survival reward (e.g. `+0.1`/tick), capped, so "stay alive" is
  learnable. Keep it well below the kill reward so killing still dominates.
- Optionally reward reducing distance to the nearest asteroid, or facing it.
- Add an episode time limit so a purely evasive genome cannot stall a generation
  forever and so fitnesses are comparable.
Watch for reward hacking (drifting forever): kill reward should dominate, and the
time limit bounds passive play.

### 2. Make evaluation fair: seed the RNG per generation
`makeAsteroids` / `randomCoords` / asteroid shapes are random per run, so every
genome faces a different field. That is noise in the exact number selection
drives. Seed a PRNG once per generation so all genomes in a generation play the
same field; reseed each generation. Low effort, high signal-to-noise gain.

### 3. Train headless and accelerated (biggest practical blocker)
Each genome is watched in real time at frame rate, so 200 genomes per generation
is extremely slow. The migration already isolates the pure game logic (objects,
geometry, the step in `gameLoop`) from rendering. Next:
- Extract a headless `step()` that advances the sim without any `p5` draw calls.
- Run many ticks per animation frame (or in a Web Worker) and only render the
  current best genome for the spectator view.
- This is what unlocks enough generations for the net to actually get good.

## Medium impact

### 4. Give the network proprioception (input design)
The net currently has no idea which way it is pointing or how fast it is drifting,
which makes thrust and aim almost unlearnable in a momentum game. Add, normalised
to `[-1, 1]`/`[0, 1]`:
- Ship heading as `sin`/`cos` of rotation (avoid the wrap discontinuity).
- Ship velocity vector (and/or speed).
- Angle to and distance of the nearest asteroid, and closing speed (whiskers give
  static distance only, so the net cannot lead a moving target).
- A boolean "aimed at an asteroid" can make the `shoot` output learnable quickly.

### 5. Rethink the output encoding
`rotateLeft` and `rotateRight` are independent sigmoids thresholded at `0.5`, so a
genome can assert both at once (they cancel). Consider making rotation a single
tri-state (argmax of left/none/right) and revisit the fixed 0.5 threshold. Note
the hard-coded `fireLimiter` (fire every 3 frames) means the net cannot learn fire
timing; that is fine, but worth a conscious decision.

### 6. Cap persisted history
`saveCurrentGeneration` writes the entire `generations` array (every generation's
full JSON) to IndexedDB on every genome switch. This grows without bound and the
write cost climbs over a long session. Persist only the latest generation plus the
best genome, or cap the retained history.

### 7. Seed a starting topology / tune NEAT params
Carrot's `Neat` starts from a minimal topology and grows by mutation. With 16
inputs, 4 outputs and sparse rewards it can take many generations to wire up
anything useful. Consider seeding a small hidden layer, and exposing/tuning
`mutation_rate`, `mutation_amount` and `elitism`. Be aware carrot's speciation is
limited, so novel topologies can be out-competed before they mature.

## Lower impact / housekeeping

### 8. Move game state off module globals
`asteroids.tsx` keeps `ship`, `asteroids`, `runner`, etc. as module-level `let`s.
That blocks running two instances, is awkward under React StrictMode double-mount,
and is hard to unit test. Fold it into a class or a `useRef`/context owned by the
component.

### 9. Broaden tests
With the logic now typed and isolated, add tests for the game objects (collision
via `polygonsIntersect`, screen wrapping in `AstroObject.wrap`, asteroid splitting)
and, once a headless `step()` exists, a deterministic end-to-end sim test.

### 10. Reconsider the NN library
`@liquid-carrot/carrot` is unmaintained and needed a `patch-package` fix to run
under ESM (`patches/`). Options if it becomes a burden: vendor a small NEAT
implementation, or move to a fixed-topology policy network in TensorFlow.js trained
with an evolution strategy. This is a larger decision, not urgent.

## Suggested order

1. Seed the per-generation RNG (#2) and shape fitness (#1) for a real learning signal.
2. Headless accelerated training (#3) so generations are cheap.
3. Improve inputs (#4) and output encoding (#5).
4. Cap persistence (#6); tune topology/params (#7).
5. Housekeeping (#8, #9) as you touch the code.
