import { describe, expect, it, vi } from 'vitest'
import { getDefault } from '../../services/defaults'
import { GameInstance } from './game'
import { bonusAsteroidsForScore } from './util/asteroid-generator'

const targetSize = getDefault('targetSize')
const keyMap = getDefault('keyMap')

describe('bonusAsteroidsForScore', () => {
  it('adds nothing up to and including the 500 point threshold', () => {
    expect(bonusAsteroidsForScore(0)).toBe(0)
    expect(bonusAsteroidsForScore(500)).toBe(0)
    expect(bonusAsteroidsForScore(599)).toBe(0)
  })

  it('adds one asteroid per 100 points above 500', () => {
    expect(bonusAsteroidsForScore(600)).toBe(1)
    expect(bonusAsteroidsForScore(700)).toBe(2)
    expect(bonusAsteroidsForScore(1500)).toBe(10)
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

describe('GameInstance bonus asteroids', () => {
  it('spawns extra asteroids as the score passes each threshold, only once each', () => {
    const game = new GameInstance({ targetSize, keyMap, training: false })
    const before = game.asteroids.length
    // floor((2000 - 500) / 100) = 15 bonus asteroids are due in this single step,
    // which dwarfs the at-most-one fixed-density respawn.
    game.score = 2000
    game.step([])
    expect(game.asteroids.length).toBeGreaterThanOrEqual(before + 15)

    // The same score is already satisfied, so no further bonus is added (the
    // count can only grow by the single fixed-density respawn, if at all).
    const afterFirstStep = game.asteroids.length
    game.step([])
    expect(game.asteroids.length).toBeLessThanOrEqual(afterFirstStep + 1)
  })
})
