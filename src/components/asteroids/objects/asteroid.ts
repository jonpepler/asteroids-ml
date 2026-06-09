import AstroObject from '../astro-object'
import { type Point, type Vector, asRadians } from './../util/geometry'

const minSize = 50

class Asteroid extends AstroObject {
  timesHit = 0
  health = 3

  constructor(x: number, y: number) {
    super(x, y, 0)
    this.size = 200
  }

  withRandom() {
    return this.withSize(Math.random() * ((1 / 2) * this.size) + this.size / 2)
      .withRandomShape()
      .withRandomDelta()
  }

  withRandomDelta() {
    return this.withDelta(Asteroid.randomDelta())
  }

  withRandomShape() {
    return this.withShape(Asteroid.randomShape())
  }

  withRandomCorner(boundX: number, boundY: number) {
    const random = (): Point => (Math.random() < 0.5 ? [0, -this.size] : [1, this.size])
    const [rX, rY] = [random(), random()]
    this.x = rX[0] * boundX + rX[1]
    this.y = rY[0] * boundY + rY[1]
    return this
  }

  static randomShape(): number[][] {
    const numPoints = Math.floor(Math.random() * 15 + 5)
    const circle = 2 * Math.PI
    const step = circle / numPoints

    const points: number[][] = []
    for (let i = 0; i < circle; i += step) {
      const length = Math.random() * (2 / 3) + 1 / 3
      points.push([length * Math.cos(i), length * Math.sin(i)])
    }

    return points
  }

  static randomDelta(): Vector {
    const random = () => Math.random() * 4 - 2
    return { x: random(), y: random(), r: random() }
  }

  spawnChildren(): Asteroid[] {
    const newSize = (this.size * 2) / 3
    if (newSize < minSize) return []
    const newAsteroid = (delta: Vector) =>
      new Asteroid(this.x, this.y).withSize(newSize).withRandomShape().withDelta(delta)

    // keep one child on the same delta, and send the other two at 45 degree angles
    // slightly increase the rotation speed
    const newDelta = (x: number, y: number, r: number, a: number): Vector => ({
      x: x * Math.cos(asRadians(a)) + y * -Math.sin(asRadians(a)),
      y: x * Math.sin(asRadians(a)) + y * Math.cos(asRadians(a)),
      r: (r * 4) / 3
    })
    return [
      newAsteroid(newDelta(this.d.x || 0, this.d.y || 0, this.d.r || 0, 45)),
      newAsteroid(newDelta(this.d.x || 0, this.d.y || 0, this.d.r || 0, 0)),
      newAsteroid(newDelta(this.d.x || 0, this.d.y || 0, this.d.r || 0, -45))
    ]
  }

  hit() {
    this.timesHit++
    if (this.timesHit > this.health) this.cleanup()
  }
}

export default Asteroid
