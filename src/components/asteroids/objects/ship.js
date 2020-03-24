import AstroObject from '../astro-object'
import { getDirectionVector, asRadians } from '../util/geometry'
import Bullet from './bullet'

const shape = [[0, -0.5], [0.33, 0.5], [0, 0.33], [-0.33, 0.5]]
const boosterShape = [[0, 0.33], [-0.02, 0.36], [0, 0.66], [0.02, 0.36]]
const size = 100
const speed = 0.1
const bulletPushbackSpeed = 0.02
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

  getShipTip () {
    // return [this.x + Math.cos(asRadians(this.r)), this.y + (shape[0][1] + Math.sin(asRadians(this.r))) * size]
    return [this.x + Math.sin(asRadians(this.r)) * size / 2, this.y + shape[0][1] * Math.cos(asRadians(this.r)) * size]
  }

  arrowLeft () {
    this.r -= rotateSpeed
  }

  arrowUp () {
    this.booster = true
    const [dx, dy] = getDirectionVector(this.r)
    const delta = { x: speed * dx, y: speed * dy }
    this.addDelta(delta)
    return delta
  }

  arrowUpOff () {
    this.booster = false
  }

  arrowRight () {
    this.r += rotateSpeed
  }

  shoot () {
    const [shipTipX, shipTipY] = this.getShipTip()
    const [dx, dy] = getDirectionVector(this.r)
    this.addDelta({ x: -bulletPushbackSpeed * dx, y: -bulletPushbackSpeed * dy })
    return new Bullet(shipTipX, shipTipY, this.d, this.r).withMaxDistance(1000)
  }

  hit () {
    this.shape = [[-0.08, -0.1], [0, -0.5], [0.05, -0.42], [0.3, 0.4], [0, 0.25], [-0.12, 0.42]]
    if (!this.old) this.addDelta({ r: 10 })
    this.cleanup()
  }
}

export default Ship
