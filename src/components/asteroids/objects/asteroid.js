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

    // get current x,y delta
    const newRotation = { r: this.d.r * 4 / 3 }
    const delta1 = { x: this.d.x * Math.cos(asRadians(45)), y: this.d.y * Math.sin(asRadians(45)) }
    const delta2 = { x: this.d.x, y: this.d.y }
    const delta3 = { x: this.d.x * Math.cos(asRadians(-45)), y: this.d.y * Math.sin(asRadians(-45)) }
    return [
      newAsteroid({ ...newRotation, ...delta1 }),
      newAsteroid({ ...newRotation, ...delta2 }),
      newAsteroid({ ...newRotation, ...delta3 })
    ]
  }

  hit () {
    this.timesHit++
    if (this.timesHit > this.health) this.cleanup()
  }
}

export default Asteroid
