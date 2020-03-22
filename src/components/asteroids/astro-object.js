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
  withDelta (delta) { this.delta = delta; return this }

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

    p5.beginShape()
    this.shape.forEach(point => {
      p5.vertex(...point)
    })
    p5.endShape(p5.CLOSE)

    p5.pop()
  }

  applyDelta () {
    if (this.delta === undefined) return
    const { x, y, r } = this.delta
    if (x) this.x += x
    if (y) this.y += y
    if (r) this.r += r
  }
}

export default AstroObject
