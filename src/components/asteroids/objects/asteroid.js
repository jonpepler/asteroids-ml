import AstroObject from '../astro-object'

const size = 100
class Asteroid extends AstroObject {
  constructor (x, y) {
    super(x, y, 0)
      .withSize(Math.random() * (3 / 4 * size) + size)
      .withShape(Asteroid.randomShape())
      .withDelta(Asteroid.randomDelta())
  }

  static randomShape () {
    const numPoints = Math.floor(Math.random() * 15 + 5)
    const circle = 2 * Math.PI
    const step = circle / numPoints

    const points = []
    for (let i = 0; i < circle; i += step) {
      const length = Math.random() * (2 / 3) + (1 / 3)
      points.push([
        length * Math.cos(i),
        length * Math.sin(i)
      ])
    }

    return points
  }

  static randomDelta () {
    const random = () => Math.random() * 2 - 1
    return { x: random(), y: random(), r: random() }
  }
}

export default Asteroid
