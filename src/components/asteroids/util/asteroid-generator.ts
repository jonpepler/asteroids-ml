import Asteroid from '../objects/asteroid'
import type Ship from '../objects/ship'
import { type GameSize, type Point, type RandomFn, pointInPolygon } from './geometry'

// probably not the best way to do this
// you could make a new polygon that is the full game space,
// subtract clearArea, and then find a random point inside the result,
// but I feel like on average this might work out faster
export const randomCoords = (
  gameSize: GameSize,
  shipInfo: Ship,
  random: RandomFn = Math.random
): Point => {
  const clearArea = [
    [shipInfo.x + shipInfo.size * 2, shipInfo.y + shipInfo.size * 2],
    [shipInfo.x + shipInfo.size * 2, shipInfo.y - shipInfo.size * 2],
    [shipInfo.x - shipInfo.size * 2, shipInfo.y - shipInfo.size * 2],
    [shipInfo.x - shipInfo.size * 2, shipInfo.y + shipInfo.size * 2]
  ]

  let pointFound = false
  let point: Point = [0, 0]
  while (!pointFound) {
    point = [random() * gameSize.w, random() * gameSize.h]
    pointFound = !pointInPolygon(point, clearArea)
  }
  return point
}

/*
 * The game is endless, so the field keeps escalating instead of being cleared:
 * one extra asteroid arrives for every 100 points scored.
 */
export const bonusAsteroidScoreStep = 100
export const bonusAsteroidsForScore = (score: number): number =>
  Math.max(0, Math.floor(score / bonusAsteroidScoreStep))

export const makeAsteroids = (
  gameSize: GameSize,
  shipInfo: Ship,
  random: RandomFn = Math.random
): Asteroid[] => {
  const num = 4 + random() * 3
  return Array.from({ length: num }).map(() => {
    const [x, y] = randomCoords(gameSize, shipInfo, random)
    return new Asteroid(x, y).withRandom(random)
  })
}
