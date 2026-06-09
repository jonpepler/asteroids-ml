import { cloneDeep } from 'lodash'
import Polygon from 'polygon'
import type { P5 } from '../../../types/p5'
import AstroObject from '../astro-object'
import { type Point, asRadians, getDirectionVector } from '../util/geometry'
import Bullet from './bullet'

const shape: number[][] = [
  [0, -0.5],
  [0.33, 0.5],
  [0, 0.33],
  [-0.33, 0.5]
]
const boosterShape: number[][] = [
  [0, 0.33],
  [-0.02, 0.36],
  [0, 0.66],
  [0.02, 0.36]
]
const boosterSkew = 0.02
const size = 100
const speed = 0.1
const bulletPushbackSpeed = 0.02
const rotateSpeed = 3

class Ship extends AstroObject {
  booster = false
  rotatingLeft = false
  rotatingRight = false

  constructor(x: number, y: number) {
    super(x, y)
    this.withShape(shape).withSize(size)
  }

  drawAfterShape(p5: P5) {
    if (this.booster) {
      const [rx, ry] = getDirectionVector(this.r)
      const skew = (toSkew: number[][]) => {
        const newShape = cloneDeep(toSkew)
        if (this.rotatingLeft) newShape[2][0] = newShape[2][0] - boosterSkew
        if (this.rotatingRight) newShape[2][0] = newShape[2][0] + boosterSkew
        return newShape
      }
      this.drawShape(
        p5,
        Polygon(skew(boosterShape))
          .translate([this.x, this.y])
          .translate([rx * -(this.size / 2), ry * -(this.size / 2)])
          .scale([this.size, this.size])
          .rotate(asRadians(this.r))
          .toArray()
      )
    }
  }

  getShipTip(): Point {
    return this.getPointOnEdgeOfShip(this.r)
  }

  getPointOnEdgeOfShip(angle: number): Point {
    return [
      this.x + (Math.sin(asRadians(angle)) * size) / 2,
      this.y + shape[0][1] * Math.cos(asRadians(angle)) * size
    ]
  }

  rotateLeft() {
    this.r -= rotateSpeed
    this.rotatingLeft = true
  }

  rotateLeftOff() {
    this.rotatingLeft = false
  }

  moveUp() {
    this.booster = true
    const [dx, dy] = getDirectionVector(this.r)
    const delta = { x: speed * dx, y: speed * dy }
    this.addDelta(delta)
    return delta
  }

  moveUpOff() {
    this.booster = false
  }

  rotateRight() {
    this.r += rotateSpeed
    this.rotatingRight = true
  }

  rotateRightOff() {
    this.rotatingRight = false
  }

  shoot(): Bullet {
    const [dx, dy] = getDirectionVector(this.r)
    this.addDelta({ x: -bulletPushbackSpeed * dx, y: -bulletPushbackSpeed * dy })
    return new Bullet(this, { dx, dy }).withMaxDistance(1000)
  }

  hit() {
    this.shape = [
      [-0.08, -0.1],
      [0, -0.5],
      [0.05, -0.42],
      [0.3, 0.4],
      [0, 0.25],
      [-0.12, 0.42]
    ]
    if (!this.old) this.addDelta({ r: 10 })
    this.cleanup()
  }
}

export default Ship
