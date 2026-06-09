# neat

A small, typed, dependency-free implementation of NEAT (NeuroEvolution of
Augmenting Topologies) built for this project but written so it could be lifted
out into its own package unchanged. Nothing in this folder imports from the host
app; the only public surface is `index.ts`.

## Why this exists

The project used to depend on `@liquid-carrot/carrot`. That library is
unmaintained, ships no types, could not be bundled without aliasing it to its
own source, and needed two `patch-package` fixes just to run under ESM strict
mode. Replacing it with a focused in-house engine buys us:

- **Types end to end.** No `.d.ts` shim guessing at an untyped library.
- **No build hacks.** No source alias, no patches, no `postinstall` step. It
  bundles like any other module and the worker build shrinks.
- **Ownership of the evolution loop.** The old code hand-rolled elitism in the
  trainer to stop the champion being corrupted each generation. That logic now
  lives in `Neat.evolve()` and is covered by a test that asserts the champion
  can never regress.
- **Feed-forward by design.** The task (reacting to whisker sensors) is
  stateless, so the engine only ever builds acyclic networks. No recurrent or
  gated connections to bloat the search.
- **Reproducibility.** Everything random flows through one seeded RNG
  (`Rng`), so a run can be replayed exactly. With the global `Math.random` carrot
  used, two runs could never be compared.
- **Compact, versioned serialisation** that suits IndexedDB persistence and a
  future export / share-a-brain feature.

## Public API

```ts
import { Neat, Genome } from './lib/neat'

const neat = new Neat({ inputs: 16, outputs: 4, populationSize: 200, seed: 1 })

// one generation:
for (const genome of neat.population) {
  genome.score = evaluate(genome) // you run the game; genome.activate(inputs) -> outputs
}
neat.evolve() // speciate, cull stagnant species, reproduce with elitism

const champion = neat.best()
const saved = neat.toJSON()
neat.loadPopulation(saved.population, saved.generation)
```

`Genome` is both genotype and phenotype: `activate(input)` runs a forward pass,
`toJSON` / `fromJSON` round-trip it, `clone` copies it, `distance` measures
compatibility for speciation.

## How it works (full NEAT)

- **Genome.** Node genes (input / hidden / output, each with a bias) plus
  connection genes (from, to, weight, enabled, and an innovation number).
- **Innovation tracking** (`innovation.ts`). Structural mutations get historical
  markings so crossover can line up genes from parents that have diverged.
- **Mutation** (`genome.ts`). Perturb / replace weights and biases, add a
  connection (rejected if it would create a cycle, keeping the graph
  feed-forward), and add a node by splitting a connection so behaviour is
  unchanged at the moment of mutation.
- **Crossover.** Matching genes inherited at random, disjoint and excess genes
  taken from the fitter parent.
- **Speciation** (`species.ts`, `neat.ts`). Genomes are grouped by compatibility
  distance; fitness is shared within a species so a new topology gets time to
  mature. Stagnant species are retired (the best is always kept), and the global
  champion is always carried forward untouched.
- **Network** (`network.ts`). Compiles a genome into a topologically ordered
  feed-forward pass with a steepened sigmoid, cached until the genome mutates.

Defaults live in `defaultConfig`; pass overrides to the `Neat` constructor.

## Taking it further

Ordered roughly by value-for-effort for this project:

1. **Seed the game, not just the engine.** Fitness is currently noisy because
   asteroid spawns are random, so even the preserved champion scores differently
   each generation. Feeding a per-generation seed into the simulation would make
   fitness comparable and the learning curve far smoother.
2. **Tune speciation to the task.** `compatibilityThreshold` and the distance
   coefficients are paper defaults; auto-adjusting the threshold to hold a target
   species count is a well-known, cheap improvement.
3. **Config from the UI.** Surface population size, mutation rates and the seed
   in the settings page so runs can be experimented with without a rebuild.
4. **Export / import a brain.** `toJSON` already produces a compact, portable
   genome; a download / upload button and a bundled default champion would make
   `/watch` useful on a first visit.
5. **Novelty search or other objectives.** The engine only needs a scalar
   `score`; swapping in a novelty or multi-objective measure is a contained
   change to how the trainer scores genomes.
6. **Extract to its own package.** Everything here is app-agnostic. Add a
   `package.json` and it publishes as-is.
