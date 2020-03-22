class AstroObject {
  constructor (x, y) {
    this.x = x
    this.y = y
    this.shape = []
    this.size = 1
  }

  withShape (shape) { this.shape = shape; return this }
  withSize (size) { this.size = size; return this }

  draw (p5) {
    p5.push()

    p5.noFill()
    p5.stroke(255)

    p5.translate(this.x, this.y)
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
}

export default AstroObject
