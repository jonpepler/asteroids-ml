import AstroObject from '../astro-object'
import { getDirectionVector, asRadians } from '../util/geometry'
import Bullet from './bullet'
import Polygon from 'polygon'
import { cloneDeep } from 'lodash'

const shape = [[0, -0.5], [0.33, 0.5], [0, 0.33], [-0.33, 0.5]]
const boosterShape = [[0, 0.33], [-0.02, 0.36], [0, 0.66], [0.02, 0.36]]
const boosterSkew = 0.02
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
      const [rx, ry] = getDirectionVector(this.r)
      const skew = shape => {
        const newShape = cloneDeep(shape)
        if (this.rotatingLeft) newShape[2][0] = newShape[2][0] - boosterSkew
        if (this.rotatingRight) newShape[2][0] = newShape[2][0] + boosterSkew
        return newShape
      }
      this.drawShape(p5, Polygon(skew(boosterShape))
        .translate([this.x, this.y])
        .translate([rx * -(this.size / 2), ry * -(this.size / 2)])
        .scale([this.size, this.size])
        .rotate(asRadians(this.r))
        .toArray())
    }
  }

  getShipTip () {
    return this.getPointOnEdgeOfShip(this.r)
  }

  getPointOnEdgeOfShip (angle) {
    return [this.x + Math.sin(asRadians(angle)) * size / 2, this.y + shape[0][1] * Math.cos(asRadians(angle)) * size]
  }

  rotateLeft () {
    this.r -= rotateSpeed
    this.rotatingLeft = true
  }

  rotateLeftOff () {
    this.rotatingLeft = false
  }

  moveUp () {
    this.booster = true
    const [dx, dy] = getDirectionVector(this.r)
    const delta = { x: speed * dx, y: speed * dy }
    this.addDelta(delta)
    return delta
  }

  moveUpOff () {
    this.booster = false
  }

  rotateRight () {
    this.r += rotateSpeed
    this.rotatingRight = true
  }

  rotateRightOff () {
    this.rotatingRight = false
  }

  shoot () {
    const [dx, dy] = getDirectionVector(this.r)
    this.addDelta({ x: -bulletPushbackSpeed * dx, y: -bulletPushbackSpeed * dy })
    return new Bullet(this, { dx, dy }).withMaxDistance(1000)
  }

  hit () {
    this.shape = [[-0.08, -0.1], [0, -0.5], [0.05, -0.42], [0.3, 0.4], [0, 0.25], [-0.12, 0.42]]
    if (!this.old) this.addDelta({ r: 10 })
    this.cleanup()
  }
}

export default Ship
