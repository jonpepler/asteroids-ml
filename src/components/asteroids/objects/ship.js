import AstroObject from '../astro-object'

const shape = [[0, -0.5], [0.33, 0.5], [0, 0.33], [-0.33, 0.5]]
const boosterShape = [[0, 0.33], [-0.02, 0.36], [0, 0.66], [0.02, 0.36]]
const size = 100
const speed = 0.1
const rotateSpeed = 3
class Ship extends AstroObject {
  constructor (x, y) {
    super(x, y).withShape(shape).withSize(size)
    this.booster = false
  }

  drawAfterShape (p5) {
    if (this.booster) {
      this.drawShape(p5, boosterShape)
    }
  }

  arrowLeft () {
    this.r -= rotateSpeed
  }

  arrowUp () {
    this.booster = true

    // We know the hypotenuse is 1
    const normalised = a => a - Math.PI / 2
    const asRadians = a => a * Math.PI / 180
    const dx = Math.cos(normalised(asRadians(this.r)))
    const dy = Math.sin(normalised(asRadians(this.r)))
    this.addDelta({ x: speed * dx, y: speed * dy })
  }

  arrowUpOff () {
    this.booster = false
  }

  arrowRight () {
    this.r += rotateSpeed
  }
}

export default Ship
