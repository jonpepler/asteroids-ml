import { sumVectors } from './util/geometry'

class AstroObject {
  constructor (x, y, r, d) {
    this.x = x
    this.y = y
    this.r = r || 0
    this.d = d || {}
    this.shape = []
    this.size = 1
  }

  withShape (shape) { this.shape = shape; return this }
  withSize (size) { this.size = size; return this }
  withDelta (delta) { this.d = delta; return this }

  addDelta (newDelta) {
    this.d = sumVectors(this.d || {}, newDelta)
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

  applyDelta (boundX, boundY) {
    if (this.d === undefined) return
    const { x, y, r } = this.d
    if (x) this.x += x
    if (y) this.y += y
    if (r) this.r += r

    if (this.x > boundX + this.size) this.x -= boundX + this.size
    if (this.y > boundY + this.size) this.y -= boundY + this.size
    if (this.x < 0 - this.size) this.x += boundX + this.size
    if (this.y < 0 - this.size) this.y += boundY + this.size
  }
}

export default AstroObject
