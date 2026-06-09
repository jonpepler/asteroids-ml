import { describe, expect, it } from 'vitest'
import { Genome } from './genome'
import { InnovationTracker } from './innovation'
import { Neat, defaultConfig } from './neat'
import { Rng } from './rng'
import type { NeatConfig } from './types'

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
})
