import Asteroid from '../objects/asteroid'
import { pointInPolygon } from './geometry'

class AsteroidGenerator {
  static makeAsteroids (gameSize, shipInfo) {
    const num = 4 + Math.random() * 3
    return Array.from({ length: num })
      .map(x => new Asteroid(...this.randomCoords(gameSize, shipInfo)).withRandom())
  }

  // probably not the best way to do this
  // you could make a new polygon that is the full game space,
  // subtract clearArea, and then find a random point inside the result,
  // but I feel like on average this might work out faster
  static randomCoords (gameSize, shipInfo) {
    const clearArea = [
      [shipInfo.x + shipInfo.size * 2, shipInfo.y + shipInfo.size * 2],
      [shipInfo.x + shipInfo.size * 2, shipInfo.y - shipInfo.size * 2],
      [shipInfo.x - shipInfo.size * 2, shipInfo.y - shipInfo.size * 2],
      [shipInfo.x - shipInfo.size * 2, shipInfo.y + shipInfo.size * 2]
    ]

    let pointFound = false
    let point = []
    while (!pointFound) {
      point = [Math.random() * gameSize.w, Math.random() * gameSize.h]
      pointFound = !pointInPolygon(point, clearArea)
    }
    return point
  }
}

export default AsteroidGenerator
