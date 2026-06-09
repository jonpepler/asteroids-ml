import AstroObject from './astro-object'

class TempObject extends AstroObject {
  maxDistance = Number.POSITIVE_INFINITY
  distX = 0
  distY = 0

  withMaxDistance(maxDistance: number) {
    this.maxDistance = maxDistance
    return this
  }

  trackTravel(x?: number, y?: number) {
    this.distX += x || 0
    this.distY += y || 0

    if (Math.hypot(this.distX, this.distY) > this.maxDistance) {
      this.old = true
    }
  }
}

export default TempObject
