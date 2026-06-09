import { describe, expect, it } from 'vitest'
import { Genome } from './genome'
import { InnovationTracker } from './innovation'
import { Neat, defaultConfig } from './neat'
import { Rng } from './rng'
import type { ConnectionGene, NeatConfig, NodeGene } from './types'

const config = (overrides: Partial<NeatConfig> = {}): NeatConfig => ({
  inputs: 3,
  outputs: 2,
  ...defaultConfig,
  ...overrides
})

// A throwaway innovation tracker for genome-level tests.
const makeTracker = () => new InnovationTracker(0, 5)

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(123)
    const b = new Rng(123)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('produces different streams for different seeds', () => {
    const a = new Rng(1).next()
    const b = new Rng(2).next()
    expect(a).not.toEqual(b)
  })
})

describe('Genome', () => {
  it('starts minimal: every input connected to every output, no hidden nodes', () => {
    const rng = new Rng(1)
    const g = Genome.minimal(rng, makeTracker(), config())
    expect(g.nodes.filter((n) => n.type === 'input')).toHaveLength(3)
    expect(g.nodes.filter((n) => n.type === 'output')).toHaveLength(2)
    expect(g.nodes.filter((n) => n.type === 'hidden')).toHaveLength(0)
    expect(g.connections).toHaveLength(3 * 2)
  })

  it('activates to one bounded value per output', () => {
    const g = Genome.minimal(new Rng(7), makeTracker(), config())
    const out = g.activate([0.2, -0.5, 1])
    expect(out).toHaveLength(2)
    for (const value of out) {
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('stays acyclic and activatable after heavy structural mutation', () => {
    const rng = new Rng(99)
    const tracker = makeTracker()
    const cfg = config({ addConnectionRate: 1, addNodeRate: 1 })
    const g = Genome.minimal(rng, tracker, cfg)
    for (let i = 0; i < 100; i++) g.mutate(rng, tracker, cfg)
    expect(g.nodes.some((n) => n.type === 'hidden')).toBe(true)
    const out = g.activate([1, 1, 1])
    expect(out.every((v) => Number.isFinite(v))).toBe(true)
  })

  it('survives a JSON round-trip unchanged', () => {
    const g = Genome.minimal(new Rng(3), makeTracker(), config())
    g.score = 42
    const restored = Genome.fromJSON(g.toJSON())
    expect(restored.toJSON()).toEqual(g.toJSON())
    expect(restored.activate([0.1, 0.2, 0.3])).toEqual(g.activate([0.1, 0.2, 0.3]))
  })

  it('reports zero distance to its own clone and more to a mutated one', () => {
    const rng = new Rng(5)
    const tracker = makeTracker()
    const cfg = config()
    const g = Genome.minimal(rng, tracker, cfg)
    expect(g.distance(g.clone(), cfg)).toBeCloseTo(0)
    const mutated = g.clone()
    const heavy = config({ addNodeRate: 1, addConnectionRate: 1 })
    for (let i = 0; i < 5; i++) mutated.mutate(rng, tracker, heavy)
    expect(g.distance(mutated, cfg)).toBeGreaterThan(0)
  })
})

describe('Neat evolution', () => {
  // Deterministic fitness so the test is repeatable: reward a high first output.
  const samples = [
    [0.5, -0.5, 1],
    [-1, 1, 0],
    [0.2, 0.8, -0.3]
  ]
  const evaluate = (neat: Neat) => {
    for (const g of neat.population) {
      g.score = samples.reduce((sum, input) => sum + g.activate(input)[0], 0) / samples.length
    }
  }

  it('keeps the population size fixed across generations', () => {
    const neat = new Neat(config({ populationSize: 40, seed: 11 }))
    evaluate(neat)
    for (let i = 0; i < 5; i++) {
      neat.evolve()
      evaluate(neat)
      expect(neat.population).toHaveLength(40)
    }
  })

  it('never lets the champion regress and improves over generations', () => {
    const neat = new Neat(config({ populationSize: 60, seed: 7 }))
    evaluate(neat)
    let previousBest = neat.best().score
    const firstBest = previousBest
    for (let i = 0; i < 25; i++) {
      neat.evolve()
      evaluate(neat)
      const best = neat.best().score
      // preserveChampion + deterministic fitness => best is monotonic.
      expect(best).toBeGreaterThanOrEqual(previousBest - 1e-9)
      previousBest = best
    }
    expect(previousBest).toBeGreaterThan(firstBest)
  })

  it('grows hidden structure as it evolves', () => {
    const neat = new Neat(config({ populationSize: 50, seed: 21, addNodeRate: 0.5 }))
    evaluate(neat)
    for (let i = 0; i < 15; i++) {
      neat.evolve()
      evaluate(neat)
    }
    const hiddenCounts = neat.population.map(
      (g) => g.nodes.filter((n) => n.type === 'hidden').length
    )
    expect(Math.max(...hiddenCounts)).toBeGreaterThan(0)
  })

  it('restores a saved population and continues from the same generation', () => {
    const neat = new Neat(config({ populationSize: 30, seed: 4 }))
    evaluate(neat)
    neat.evolve()
    const saved = neat.toJSON()

    const reloaded = new Neat(config({ populationSize: 30, seed: 4 }))
    reloaded.loadPopulation(saved.population, saved.generation)
    expect(reloaded.generation).toBe(saved.generation)
    expect(reloaded.population).toHaveLength(30)
    // Continues to evolve without colliding ids or throwing.
    evaluate(reloaded)
    reloaded.evolve()
    expect(reloaded.population).toHaveLength(30)
  })

  it('gives new structure fresh innovation numbers after a reload, with no collisions', () => {
    const neat = new Neat(
      config({ populationSize: 20, seed: 8, addNodeRate: 1, addConnectionRate: 1 })
    )
    evaluate(neat)
    for (let i = 0; i < 3; i++) {
      neat.evolve()
      evaluate(neat)
    }
    const saved = neat.toJSON()

    const reloaded = new Neat(
      config({ populationSize: 20, seed: 8, addNodeRate: 1, addConnectionRate: 1 })
    )
    reloaded.loadPopulation(saved.population, saved.generation)
    const maxBefore = Math.max(
      ...reloaded.population.flatMap((g) => g.connections.map((c) => c.innovation))
    )

    evaluate(reloaded)
    reloaded.evolve()

    // No genome reuses an innovation number for two different connections.
    for (const genome of reloaded.population) {
      const innovations = genome.connections.map((c) => c.innovation)
      expect(new Set(innovations).size).toBe(innovations.length)
    }
    // New connections were minted beyond anything loaded, proving the tracker
    // restarted past the saved structure rather than colliding with it.
    const maxAfter = Math.max(
      ...reloaded.population.flatMap((g) => g.connections.map((c) => c.innovation))
    )
    expect(maxAfter).toBeGreaterThan(maxBefore)
  })
})

describe('Genome.crossover', () => {
  it('inherits matching genes and takes disjoint/excess from the fitter parent', () => {
    const fitter = new Genome(
      [
        { id: 0, type: 'input', bias: 0 },
        { id: 1, type: 'input', bias: 0 },
        { id: 2, type: 'output', bias: 0 },
        { id: 3, type: 'hidden', bias: 0 }
      ],
      [
        { innovation: 0, from: 0, to: 2, weight: 0.5, enabled: true },
        { innovation: 1, from: 1, to: 2, weight: 0.6, enabled: true },
        { innovation: 2, from: 0, to: 3, weight: 0.7, enabled: true },
        { innovation: 4, from: 3, to: 2, weight: 0.8, enabled: true }
      ]
    )
    fitter.score = 10
    const other = new Genome(
      [
        { id: 0, type: 'input', bias: 0 },
        { id: 1, type: 'input', bias: 0 },
        { id: 2, type: 'output', bias: 0 },
        { id: 5, type: 'hidden', bias: 0 }
      ],
      [
        { innovation: 0, from: 0, to: 2, weight: -1, enabled: true },
        { innovation: 1, from: 1, to: 2, weight: -1, enabled: true },
        { innovation: 3, from: 1, to: 5, weight: -1, enabled: true },
        { innovation: 6, from: 5, to: 2, weight: -1, enabled: true }
      ]
    )
    other.score = 1

    const child = Genome.crossover(fitter, other, new Rng(1))
    // Matching genes (0, 1) plus the fitter's own genes (2, 4); none of the
    // other parent's disjoint/excess genes (3, 6).
    expect(child.connections.map((c) => c.innovation).sort((a, b) => a - b)).toEqual([0, 1, 2, 4])
    // Hidden node referenced by the fitter's genes is carried; the other
    // parent's unused hidden node is not.
    expect(child.nodes.some((n) => n.id === 3)).toBe(true)
    expect(child.nodes.some((n) => n.id === 5)).toBe(false)
    // A matching gene's weight comes from one of the two parents.
    const matching = child.connections.find((c) => c.innovation === 0)
    expect([0.5, -1]).toContain(matching?.weight)
  })
})

describe('Genome add-connection mutation', () => {
  it('does not duplicate connections once the network is saturated', () => {
    const cfg = config({
      inputs: 1,
      outputs: 1,
      addConnectionRate: 1,
      addNodeRate: 0,
      weightMutationRate: 0,
      biasMutationRate: 0
    })
    const rng = new Rng(2)
    const tracker = new InnovationTracker(0, 2)
    const genome = Genome.minimal(rng, tracker, cfg)
    expect(genome.connections).toHaveLength(1)
    // The only feed-forward connection already exists, so repeated attempts add
    // nothing rather than duplicating it or looping forever.
    for (let i = 0; i < 50; i++) genome.mutate(rng, tracker, cfg)
    expect(genome.connections).toHaveLength(1)
  })
})

describe('Neat speciation', () => {
  const speciesNodes = (): NodeGene[] => [
    { id: 0, type: 'input', bias: 0 },
    { id: 1, type: 'input', bias: 0 },
    { id: 2, type: 'output', bias: 0 }
  ]
  const speciesConns = (weight: number): ConnectionGene[] => [
    { innovation: 0, from: 0, to: 2, weight, enabled: true },
    { innovation: 1, from: 1, to: 2, weight, enabled: true }
  ]

  it('splits structurally distant genomes into separate species', () => {
    const neat = new Neat(config({ inputs: 2, outputs: 1, populationSize: 20, seed: 3 }))
    const near = Array.from({ length: 10 }, () => {
      const g = new Genome(speciesNodes(), speciesConns(0))
      g.score = 1
      return g
    })
    // Identical structure but very different weights pushes the compatibility
    // distance past the threshold, so these form a second species.
    const far = Array.from({ length: 10 }, () => {
      const g = new Genome(speciesNodes(), speciesConns(8))
      g.score = 1
      return g
    })
    neat.population = [...near, ...far]
    neat.evolve()
    expect(neat.species.length).toBeGreaterThanOrEqual(2)
  })
})
