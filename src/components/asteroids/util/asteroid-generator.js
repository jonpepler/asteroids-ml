import Asteroid from '../objects/asteroid'

class AsteroidGenerator {
  static makeAsteroids (gameSize) {
    const num = 4 + Math.random() * 3
    return Array.from({ length: num })
      .map(x => new Asteroid(...this.randomCoords(gameSize)).withRandom())
  }

  static randomCoords (gameSize) {
    return [Math.random() * gameSize.w, Math.random() * gameSize.h]
  }
}

export default AsteroidGenerator
