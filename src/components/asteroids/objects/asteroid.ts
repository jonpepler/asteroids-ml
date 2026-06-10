import AstroObject from '../astro-object'
import { type Point, type RandomFn, type Vector, asRadians } from './../util/geometry'

const minSize = 50

class Asteroid extends AstroObject {
  timesHit = 0
  /*
   * Hits needed to destroy this asteroid. One, like the arcade original: a shot
   * splits it into children (see spawnChildren) rather than chipping a health
   * bar. A higher value would make shooting a poor investment for the trainer.
   */
  health = 1

  constructor(x: number, y: number) {
    super(x, y, 0)
    this.size = 200
  }

  withRandom(random: RandomFn = Math.random) {
    return this.withSize(random() * ((1 / 2) * this.size) + this.size / 2)
      .withRandomShape(random)
      .withRandomDelta(random)
  }

  withRandomDelta(random: RandomFn = Math.random) {
    return this.withDelta(Asteroid.randomDelta(random))
  }

  withRandomShape(random: RandomFn = Math.random) {
    return this.withShape(Asteroid.randomShape(random))
  }

  withRandomCorner(boundX: number, boundY: number, random: RandomFn = Math.random) {
    const corner = (): Point => (random() < 0.5 ? [0, -this.size] : [1, this.size])
    const [rX, rY] = [corner(), corner()]
    this.x = rX[0] * boundX + rX[1]
    this.y = rY[0] * boundY + rY[1]
    return this
  }

  static randomShape(random: RandomFn = Math.random): number[][] {
    const numPoints = Math.floor(random() * 15 + 5)
    const circle = 2 * Math.PI
    const step = circle / numPoints

    const points: number[][] = []
    for (let i = 0; i < circle; i += step) {
      const length = random() * (2 / 3) + 1 / 3
      points.push([length * Math.cos(i), length * Math.sin(i)])
    }

    return points
  }

  static randomDelta(random: RandomFn = Math.random): Vector {
    const component = () => random() * 4 - 2
    return { x: component(), y: component(), r: component() }
  }

  spawnChildren(random: RandomFn = Math.random): Asteroid[] {
    const newSize = (this.size * 2) / 3
    if (newSize < minSize) return []
    const newAsteroid = (delta: Vector) =>
      new Asteroid(this.x, this.y).withSize(newSize).withRandomShape(random).withDelta(delta)

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
    if (this.timesHit >= this.health) this.cleanup()
  }
}

export default Asteroid
