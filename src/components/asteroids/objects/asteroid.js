import AstroObject from '../astro-object'
import { asRadians } from './../util/geometry'

const minSize = 50
class Asteroid extends AstroObject {
  constructor (x, y) {
    super(x, y, 0)
    this.size = 200

    this.timesHit = 0
    this.health = 3
  }

  withRandom () {
    return this
      .withSize(Math.random() * (1 / 2 * this.size) + this.size / 2)
      .withRandomShape()
      .withDelta(Asteroid.randomDelta())
  }

  withRandomShape () {
    return this.withShape(Asteroid.randomShape())
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
    const random = () => Math.random() * 4 - 2
    return { x: random(), y: random(), r: random() }
  }

  spawnChildren () {
    const newSize = this.size * 2 / 3
    if (newSize < minSize) return []
    const newAsteroid = (delta) => new Asteroid(this.x, this.y).withSize(newSize).withRandomShape().withDelta(delta)

    // keep one child on the same delta, and send the other two at 45 degree angles
    // slightly increase the rotation speed
    const newDelta = (x, y, r, a) => ({
      x: x * Math.cos(asRadians(a)) + y * -Math.sin(asRadians(a)),
      y: x * Math.sin(asRadians(a)) + y * Math.cos(asRadians(a)),
      r: r * 4 / 3
    })
    return [
      newAsteroid(newDelta(this.d.x, this.d.y, this.d.r, 45)),
      newAsteroid(newDelta(this.d.x, this.d.y, this.d.r, 0)),
      newAsteroid(newDelta(this.d.x, this.d.y, this.d.r, -45))
    ]
  }

  hit () {
    this.timesHit++
    if (this.timesHit > this.health) this.cleanup()
  }
}

export default Asteroid
