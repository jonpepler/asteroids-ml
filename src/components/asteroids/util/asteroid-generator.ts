import Asteroid from '../objects/asteroid'
import type Ship from '../objects/ship'
import { type GameSize, type Point, pointInPolygon } from './geometry'

// probably not the best way to do this
// you could make a new polygon that is the full game space,
// subtract clearArea, and then find a random point inside the result,
// but I feel like on average this might work out faster
export const randomCoords = (gameSize: GameSize, shipInfo: Ship): Point => {
  const clearArea = [
    [shipInfo.x + shipInfo.size * 2, shipInfo.y + shipInfo.size * 2],
    [shipInfo.x + shipInfo.size * 2, shipInfo.y - shipInfo.size * 2],
    [shipInfo.x - shipInfo.size * 2, shipInfo.y - shipInfo.size * 2],
    [shipInfo.x - shipInfo.size * 2, shipInfo.y + shipInfo.size * 2]
  ]

  let pointFound = false
  let point: Point = [0, 0]
  while (!pointFound) {
    point = [Math.random() * gameSize.w, Math.random() * gameSize.h]
    pointFound = !pointInPolygon(point, clearArea)
  }
  return point
}

// The asteroid field is kept at a roughly fixed size, which caps the reachable
// score once a genome learns to clear it. To raise that ceiling we feed a strong
// player more targets: one extra asteroid for every 100 points scored above 500
// (so a bonus asteroid at 600, 700, 800, ... points).
export const bonusAsteroidScoreThreshold = 500
export const bonusAsteroidScoreStep = 100
export const bonusAsteroidsForScore = (score: number): number =>
  Math.max(0, Math.floor((score - bonusAsteroidScoreThreshold) / bonusAsteroidScoreStep))

export const makeAsteroids = (gameSize: GameSize, shipInfo: Ship): Asteroid[] => {
  const num = 4 + Math.random() * 3
  return Array.from({ length: num }).map(() => {
    const [x, y] = randomCoords(gameSize, shipInfo)
    return new Asteroid(x, y).withRandom()
  })
}
