import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trainingRulesVersion } from '../../components/asteroids/game'
import Runner from './runner'

const { get, set } = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))
vi.mock('../storage', () => ({ get, set }))

describe('Runner.mapOutputToKeys', () => {
  const runner = new Runner()
  // default keyMap: shoot 32, boost 38, rotateLeft 37, rotateRight 39
  // mapOutputToKeys reads them in [shoot, boost, rotateLeft, rotateRight] order

  it('maps rounded network output to the matching key codes', () => {
    // [shoot, boost, rotateLeft, rotateRight]
    expect(runner.mapOutputToKeys([0.9, 0.1, 0.6, 0.2])).toEqual([32, 37])
  })

  it('returns no keys when every output rounds to zero', () => {
    expect(runner.mapOutputToKeys([0, 0.4, 0.49, 0])).toEqual([])
  })

  it('presses every key when all outputs are high', () => {
    expect(runner.mapOutputToKeys([1, 1, 1, 1])).toEqual([32, 38, 37, 39])
  })
})

describe('Runner.recordGenerationStats', () => {
  it('summarises the generation and captures the best genome', () => {
    const runner = new Runner()
    runner.neat.population[3].score = 42
    runner.neat.population[10].score = 17

    runner.recordGenerationStats()

    expect(runner.history).toHaveLength(1)
    const [stat] = runner.history
    expect(stat.best).toBe(42)
    expect(stat.min).toBe(0)
    expect(runner.best?.score).toBe(42)
    expect(runner.best?.gen).toBe(0)
  })

  it('only replaces the all-time best when a generation beats it', () => {
    const runner = new Runner()
    runner.neat.population[0].score = 30
    runner.recordGenerationStats()
    runner.neat.population[0].score = 10
    runner.recordGenerationStats()
    expect(runner.best?.score).toBe(30)
  })
})

describe('Runner.init', () => {
  beforeEach(() => {
    get.mockReset()
    set.mockReset()
  })

  const makeStored = (rulesVersion?: number) => {
    const source = new Runner()
    return {
      head: { generation: 42 },
      currentGeneration: source.neat.population.map((genome) => genome.toJSON()),
      best: { json: source.neat.population[0].toJSON(), gen: 30, score: 2000 },
      history: [{ gen: 41, best: 2000, avg: 400, min: 5 }],
      rulesVersion
    }
  }

  it('restores stats saved under the current rules', async () => {
    get.mockResolvedValue(makeStored(trainingRulesVersion))
    const runner = new Runner()
    await runner.init()
    expect(runner.neat.generation).toBe(42)
    expect(runner.best?.score).toBe(2000)
    expect(runner.history).toHaveLength(1)
  })

  it('keeps the population but resets stats from a different rules version', async () => {
    get.mockResolvedValue(makeStored(trainingRulesVersion + 1))
    const runner = new Runner()
    await runner.init()
    expect(runner.neat.generation).toBe(42)
    expect(runner.best).toBeUndefined()
    expect(runner.history).toHaveLength(0)
  })

  it('treats unversioned saves (pre rules-version) as stale stats', async () => {
    get.mockResolvedValue(makeStored(undefined))
    const runner = new Runner()
    await runner.init()
    expect(runner.neat.generation).toBe(42)
    expect(runner.best).toBeUndefined()
    expect(runner.history).toHaveLength(0)
  })

  it('stamps the current rules version on save', () => {
    const runner = new Runner()
    runner.saveCurrentGeneration(true)
    expect(set).toHaveBeenCalledWith(
      runner.storeKey,
      expect.objectContaining({ rulesVersion: trainingRulesVersion })
    )
  })
})

describe('Runner.nextGeneration', () => {
  it('records stats and advances the generation counter', () => {
    const runner = new Runner()
    runner.neat.population[0].score = 5
    runner.nextGeneration()
    expect(runner.neat.generation).toBe(1)
    expect(runner.history).toHaveLength(1)
    expect(runner.neat.population).toHaveLength(200)
  })
})
