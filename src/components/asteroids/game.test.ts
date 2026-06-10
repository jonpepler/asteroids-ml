import { describe, expect, it, vi } from 'vitest'
import { Rng } from '../../lib/neat'
import { getDefault } from '../../services/defaults'
import { GameInstance } from './game'
import Ship from './objects/ship'
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

describe('GameInstance survival reward', () => {
  it('pays an uncapped, decaying per-tick survival reward while training', () => {
    const onScore = vi.fn()
    const rng = new Rng(3)
    const game = new GameInstance({
      targetSize,
      keyMap,
      training: true,
      random: () => rng.next(),
      onScore
    })
    // No input: the ship just sits and survives the opening, so the only
    // positive sub-kill emissions (kills are 10, the fire cost is negative) are
    // the survival rewards, one per running tick.
    for (let i = 0; i < 100 && game.status === 'running'; i++) game.step([])
    const survival = onScore.mock.calls.map((c) => c[0]).filter((a) => a > 0 && a < 1)

    expect(survival.length).toBeGreaterThan(2)
    // Starts at survivalStartRate (10) per second over 60 ticks, not the old
    // flat 0.1, and tapers off as the episode runs on.
    expect(survival[0]).toBeCloseTo(10 / 60, 4)
    expect(survival[0]).toBeGreaterThan(survival[survival.length - 1])
  })
})

describe('GameInstance miss penalty', () => {
  it('flags a bullet as having hit only once it strikes something', () => {
    const ship = new Ship(0, 0)
    const bullet = ship.shoot()
    expect(bullet.hitTarget).toBe(false)
    bullet.hit()
    expect(bullet.hitTarget).toBe(true)
    expect(bullet.old).toBe(true)
  })

  it('charges a negative penalty for a bullet that ages out without hitting', () => {
    const onScore = vi.fn()
    const game = new GameInstance({ targetSize, keyMap, training: true, onScore })
    // Controlled scenario: no asteroids to strike, and a single spent bullet
    // parked away from the ship so it cannot register a hit this tick.
    game.asteroids = []
    const bullet = game.ship.shoot()
    bullet.x = 5
    bullet.y = 5
    bullet.old = true
    game.bullets = [bullet]
    game.step([])
    const amounts = onScore.mock.calls.map((c) => c[0])
    // One miss costs missPenalty (1); crucially this is a cost, not a reward.
    expect(amounts).toContain(-1)
  })

  it('does not penalise a bullet that ages out after hitting', () => {
    const onScore = vi.fn()
    const game = new GameInstance({ targetSize, keyMap, training: true, onScore })
    game.asteroids = []
    const bullet = game.ship.shoot()
    bullet.x = 5
    bullet.y = 5
    bullet.hit() // marks it hit (and old)
    game.bullets = [bullet]
    game.step([])
    const amounts = onScore.mock.calls.map((c) => c[0])
    expect(amounts).not.toContain(-1)
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

describe('GameInstance asteroid removal', () => {
  it('removes exactly the destroyed asteroids when several die in one tick', () => {
    const game = new GameInstance({ targetSize, keyMap, training: false })
    const [a0, a1, a2] = game.asteroids
    // Park three in a far corner, away from the ship, and destroy two of them.
    for (const [i, a] of [a0, a1, a2].entries()) {
      a.x = 5 + i * 5
      a.y = 5
    }
    game.asteroids = [a0, a1, a2]
    a0.old = true
    a1.old = true // two deaths at once: the old splice dropped a2 by mistake

    game.step([])

    expect(game.asteroids).not.toContain(a0)
    expect(game.asteroids).not.toContain(a1)
    expect(game.asteroids).toContain(a2) // the survivor is the one left alive
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
