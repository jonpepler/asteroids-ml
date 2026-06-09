import type { P5 } from '../../types/p5'
import type { Point, Vector } from './util/geometry'

class StarMap {
  stars: Point[]
  power = 3

  constructor(starPoints: Point[]) {
    this.stars = starPoints
  }

  static generate(maxX: number, maxY: number): StarMap {
    const starNum = Math.floor((Math.random() * maxX * maxY) / 2800)
    const random = (bound: number) => Math.random() * (bound + 100) - 100
    return new StarMap(
      Array.from({ length: starNum }).map((): Point => [random(maxX), random(maxY)])
    )
  }

  draw(p5: P5) {
    p5.push()
    p5.stroke(255)
    p5.strokeWeight(2)
    this.stars.forEach((star) => {
      p5.push()
      if (Math.random() < 0.0005) p5.strokeWeight(4)
      p5.point(star[0], star[1])
      p5.pop()
    })
    p5.pop()
  }

  applyTravelFeel(delta: Vector) {
    this.stars = this.stars.map(
      (star): Point => [
        star[0] - (delta.x ?? 0) * this.power,
        star[1] - (delta.y ?? 0) * this.power
      ]
    )
  }
}

export default StarMap
