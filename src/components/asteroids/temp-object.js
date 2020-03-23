import AstroObject from './astro-object'

class TempObject extends AstroObject {
  constructor (x, y) {
    super(x, y)
    this.old = false

    this.distX = 0
    this.distY = 0
  }

  withMaxDistance (maxDistance) {
    this.maxDistance = maxDistance
    return this
  }

  trackTravel (x, y) {
    this.distX += x || 0
    this.distY += y || 0

    if (Math.hypot(this.distX, this.distY) > this.maxDistance) {
      this.old = true
    }
  }
}

export default TempObject
