import { describe, expect, it } from 'vitest'
import Runner from './runner'

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

describe('Runner score helpers', () => {
  it('averages only the brains tested so far', () => {
    const runner = new Runner()
    runner.neat.population[0].score = 10
    runner.neat.population[1].score = 20
    runner.currentPopIndex = 2
    // (10 + 20) / (currentPopIndex + 1) = 30 / 3
    expect(runner.getAverage()).toBe('10.00')
  })

  it('reports the max score among tested brains', () => {
    const runner = new Runner()
    runner.neat.population[0].score = 5
    runner.neat.population[1].score = 42
    runner.neat.population[2].score = 13
    runner.currentPopIndex = 3
    expect(runner.getMaxScore()).toBe(42)
  })
})

describe('Runner.giveScore', () => {
  it('accumulates score onto the current brain', () => {
    const runner = new Runner()
    runner.currentPopIndex = 0
    runner.getCurrentBrain().score = 0
    runner.giveScore(10)
    runner.giveScore(5)
    expect(runner.getCurrentBrain().score).toBe(15)
  })
})
