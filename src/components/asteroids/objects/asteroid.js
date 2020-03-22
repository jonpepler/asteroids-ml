import AstroObject from '../astro-object'

const size = 100
class Asteroid extends AstroObject {
  constructor (x, y) {
    super(x, y, 0)
      .withSize(size)
      .withShape(Asteroid.randomShape())
      .withDelta(Asteroid.randomDelta())
  }

  static randomShape () {
    return [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]]
  }

  static randomDelta () {
    return { x: 0, y: 0, r: 1 }
  }
}

export default Asteroid
