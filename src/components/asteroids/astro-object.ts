import Polygon from 'polygon'
import type { P5 } from '../../types/p5'
import {
  type Line,
  type Vector,
  asRadians,
  lineCrossesPolygon,
  polygonsIntersect,
  sumVectors
} from './util/geometry'

class AstroObject {
  x: number
  y: number
  r: number
  d: Vector
  shape: number[][] = []
  size = 1
  old = false

  constructor(x: number, y: number, r?: number, d?: Vector) {
    this.x = x
    this.y = y
    this.r = r || 0
    this.d = d || { x: 0, y: 0, r: 0 }
  }

  withShape(shape: number[][]) {
    this.shape = shape
    return this
  }

  withSize(size: number) {
    this.size = size
    return this
  }

  withDelta(delta: Vector) {
    this.d = delta
    return this
  }

  addDelta(newDelta: Vector) {
    this.d = sumVectors(this.d, newDelta)
  }

  drawPreShape(_p5: P5) {}
  drawAfterShape(_p5: P5) {}

  draw(p5: P5) {
    p5.push()

    p5.fill(0)
    p5.stroke(255)

    p5.push()
    this.drawPreShape(p5)
    p5.pop()

    this.drawShape(p5, this.getTransformedPolygon(this.shape).toArray())

    p5.push()
    this.drawAfterShape(p5)
    p5.pop()

    p5.pop()
  }

  drawShape(p5: P5, shape: number[][]) {
    p5.beginShape()
    shape.forEach((point) => {
      p5.vertex(point[0], point[1])
    })
    p5.endShape(p5.CLOSE)
  }

  // overridden by temp-object to age objects
  trackTravel(_x?: number, _y?: number) {}

  applyDelta(boundX: number, boundY: number) {
    const { x, y, r } = this.d
    if (x) this.x += x
    if (y) this.y += y
    if (r) this.r += r
    this.trackTravel(x, y)

    this.wrap(boundX, boundY)
  }

  getOffset() {
    return this.size * 2.5
  }

  wrap(boundX: number, boundY: number) {
    const offset = this.getOffset()
    if (this.x > boundX + offset) this.x -= boundX + offset * 2
    if (this.y > boundY + offset) this.y -= boundY + offset * 2
    if (this.x < 0 - offset) this.x += boundX + offset * 2
    if (this.y < 0 - offset) this.y += boundY + offset * 2
  }

  getTransformedPolygon(shape?: number[][]): Polygon {
    const points = shape === undefined ? this.shape : shape
    return Polygon(points)
      .scale([this.size, this.size])
      .translate([this.x, this.y])
      .rotate(asRadians(this.r))
  }

  crossedByLine(line: Line): number[][] {
    return lineCrossesPolygon(line, this.getTransformedPolygon()).filter((res) => res.length !== 0)
  }

  isHit(hittable: AstroObject): boolean {
    const shape = this.getTransformedPolygon()
    const hShape = hittable.getTransformedPolygon()
    const hit = polygonsIntersect(shape, hShape)
    if (hit) {
      this.hit()
      hittable.hit()
    }
    return hit
  }

  hit() {
    this.cleanup()
  }

  cleanup() {
    this.old = true
  }
}

export default AstroObject
