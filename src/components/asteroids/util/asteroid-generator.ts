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

export const makeAsteroids = (gameSize: GameSize, shipInfo: Ship): Asteroid[] => {
  const num = 4 + Math.random() * 3
  return Array.from({ length: num }).map(() => {
    const [x, y] = randomCoords(gameSize, shipInfo)
    return new Asteroid(x, y).withRandom()
  })
}
