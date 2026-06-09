import { describe, expect, it, vi } from 'vitest'
import { Rng } from '../../lib/neat'
import { getDefault } from '../../services/defaults'
import { GameInstance } from './game'
import { bonusAsteroidsForScore } from './util/asteroid-generator'

const targetSize = getDefault('targetSize')
const keyMap = getDefault('keyMap')

describe('bonusAsteroidsForScore', () => {
  it('adds one asteroid for every 100 points scored', () => {
    expect(bonusAsteroidsForScore(0)).toBe(0)
    expect(bonusAsteroidsForScore(99)).toBe(0)
    expect(bonusAsteroidsForScore(100)).toBe(1)
    expect(bonusAsteroidsForScore(250)).toBe(2)
    expect(bonusAsteroidsForScore(1500)).toBe(15)
  })
})

describe('GameInstance fire penalty', () => {
  it('emits a small negative fitness each time a shot is fired while training', () => {
    const onScore = vi.fn()
    const game = new GameInstance({ targetSize, keyMap, training: true, onScore })
    // Hold the fire key long enough for the fire limiter to release a shot.
    for (let i = 0; i < 12; i++) game.step([keyMap.shoot])
    const amounts = onScore.mock.calls.map((call) => call[0])
    expect(amounts).toContain(-0.15)
  })

  it('does not penalise firing outside training (play mode)', () => {
    const onScore = vi.fn()
    const game = new GameInstance({ targetSize, keyMap, training: false, onScore })
    for (let i = 0; i < 12; i++) game.step([keyMap.shoot])
    expect(onScore.mock.calls.every((call) => call[0] >= 0)).toBe(true)
  })
})

describe('GameInstance is endless', () => {
  it('never reaches a win state and keeps a big asteroid in play', () => {
    const game = new GameInstance({ targetSize, keyMap, training: false })
    for (let i = 0; i < 50; i++) game.step([])
    // No win status exists any more, and the field is never left empty.
    expect(game.status).not.toBe('won')
    expect(game.asteroids.length).toBeGreaterThan(0)
  })

  it('spawns extra asteroids as the score climbs, only once per 100 points', () => {
    const game = new GameInstance({ targetSize, keyMap, training: false })
    const before = game.asteroids.length
    // floor(2000 / 100) = 20 bonus asteroids are due in this single step, which
    // dwarfs the at-most-one big-asteroid top-up.
    game.score = 2000
    game.step([])
    expect(game.asteroids.length).toBeGreaterThanOrEqual(before + 20)

    // The same score is already satisfied, so no further bonus is added (the
    // count can only grow by the single big-asteroid top-up, if at all).
    const afterFirstStep = game.asteroids.length
    game.step([])
    expect(game.asteroids.length).toBeLessThanOrEqual(afterFirstStep + 1)
  })

  it('spawns an extra asteroid on the timed cadence', () => {
    // Two identical seeded games (no input, so no kills or removals); the one
    // that crosses the 600-tick boundary gains the timed spawn the other has not.
    const make = () => {
      const rng = new Rng(7)
      return new GameInstance({ targetSize, keyMap, training: false, random: () => rng.next() })
    }
    const before = make()
    for (let i = 0; i < 599; i++) before.step([])
    const after = make()
    for (let i = 0; i < 600; i++) after.step([])
    expect(after.asteroids.length).toBeGreaterThan(before.asteroids.length)
  })
})

describe('GameInstance seeding', () => {
  const layout = (seed: number) => {
    const rng = new Rng(seed)
    const game = new GameInstance({ targetSize, keyMap, training: true, random: () => rng.next() })
    return game.asteroids.map((a) => [Math.round(a.x), Math.round(a.y), Math.round(a.size)])
  }

  it('produces an identical asteroid layout for the same seed', () => {
    expect(layout(42)).toEqual(layout(42))
  })

  it('produces a different layout for a different seed', () => {
    expect(layout(1)).not.toEqual(layout(2))
  })
})
