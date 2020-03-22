import Asteroid from '../objects/asteroid'

class AsteroidGenerator {
  static makeAsteroids (gameSize) {
    const num = 5 + Math.random() * 3
    return Array.from({ length: num })
      .map(x => new Asteroid(...this.randomCoords(gameSize)))
  }

  static randomCoords (gameSize) {
    return [Math.random() * gameSize.w, Math.random() * gameSize.h]
  }
}

export default AsteroidGenerator
