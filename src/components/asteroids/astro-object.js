import { sumVectors, polygonsIntersect, asRadians } from './util/geometry'
import Polygon from 'polygon'

class AstroObject {
  constructor (x, y, r, d) {
    this.x = x
    this.y = y
    this.r = r || 0
    this.d = d || { x: 0, y: 0, r: 0 }
    this.shape = []
    this.size = 1
  }

  withShape (shape) { this.shape = shape; return this }
  withSize (size) { this.size = size; return this }
  withDelta (delta) { this.d = delta; return this }

  addDelta (newDelta) {
    this.d = sumVectors(this.d, newDelta)
  }

  drawPreShape (p5) {}
  drawAfterShape (p5) {}

  draw (p5) {
    p5.push()

    p5.noFill()
    p5.stroke(255)
    p5.translate(this.x, this.y)
    p5.angleMode(p5.DEGREES)
    p5.rotate(this.r)
    p5.scale(this.size)
    // maintain constant stroke width
    p5.strokeWeight(1 / this.size)

    p5.push()
    this.drawPreShape(p5)
    p5.pop()

    this.drawShape(p5, this.shape)

    p5.push()
    this.drawAfterShape(p5)
    p5.pop()

    p5.pop()
  }

  drawShape (p5, shape) {
    p5.beginShape()
    shape.forEach(point => {
      p5.vertex(...point)
    })
    p5.endShape(p5.CLOSE)
  }

  // overridden by temp-object to age objects
  trackTravel () {}

  applyDelta (boundX, boundY) {
    const { x, y, r } = this.d
    if (x) this.x += x
    if (y) this.y += y
    if (r) this.r += r
    this.trackTravel(x, y)

    const offset = this.size * 1.25
    if (this.x > boundX + offset) this.x -= boundX + offset * 2
    if (this.y > boundY + offset) this.y -= boundY + offset * 2
    if (this.x < 0 - offset) this.x += boundX + offset * 2
    if (this.y < 0 - offset) this.y += boundY + offset * 2
  }

  getTransformedPolygon () {
    return Polygon(this.shape)
      .translate([this.x, this.y])
      .scale([this.size, this.size])
      .rotate(asRadians(this.r))
  }

  isHit (hittable) {
    // TODO combine this logic with the transformations in draw
    const shape = this.getTransformedPolygon()
    const hShape = hittable.getTransformedPolygon()
    const hit = polygonsIntersect(shape, hShape)
    if (hit) {
      this.hit()
      hittable.hit()
    }
    return hit
  }

  hit () { this.cleanup() }

  cleanup () {
    this.old = true
  }
}

export default AstroObject
