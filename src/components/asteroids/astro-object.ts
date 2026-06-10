import Polygon from 'polygon'
import type { P5 } from '../../types/p5'
import {
  type Line,
  type Vector,
  asRadians,
  lineCrossesPolygon,
  polygonsIntersect,
  sumVectors
} from './util/geometry'

class AstroObject {
  x: number
  y: number
  r: number
  d: Vector
  shape: number[][] = []
  size = 1
  old = false

  constructor(x: number, y: number, r?: number, d?: Vector) {
    this.x = x
    this.y = y
    this.r = r || 0
    this.d = d || { x: 0, y: 0, r: 0 }
  }

  withShape(shape: number[][]) {
    this.shape = shape
    return this
  }

  withSize(size: number) {
    this.size = size
    return this
  }

  withDelta(delta: Vector) {
    this.d = delta
    return this
  }

  addDelta(newDelta: Vector) {
    this.d = sumVectors(this.d, newDelta)
  }

  drawPreShape(_p5: P5) {}
  drawAfterShape(_p5: P5) {}

  draw(p5: P5) {
    p5.push()

    p5.fill(0)
    p5.stroke(255)

    p5.push()
    this.drawPreShape(p5)
    p5.pop()

    this.drawShape(p5, this.getTransformedPolygon(this.shape).toArray())

    p5.push()
    this.drawAfterShape(p5)
    p5.pop()

    p5.pop()
  }

  drawShape(p5: P5, shape: number[][]) {
    p5.beginShape()
    shape.forEach((point) => {
      p5.vertex(point[0], point[1])
    })
    p5.endShape(p5.CLOSE)
  }

  // overridden by temp-object to age objects
  trackTravel(_x?: number, _y?: number) {}

  applyDelta(boundX: number, boundY: number) {
    const { x, y, r } = this.d
    if (x) this.x += x
    if (y) this.y += y
    if (r) this.r += r
    this.trackTravel(x, y)

    this.wrap(boundX, boundY)
  }

  getOffset() {
    return this.size * 2.5
  }

  wrap(boundX: number, boundY: number) {
    const offset = this.getOffset()
    if (this.x > boundX + offset) this.x -= boundX + offset * 2
    if (this.y > boundY + offset) this.y -= boundY + offset * 2
    if (this.x < 0 - offset) this.x += boundX + offset * 2
    if (this.y < 0 - offset) this.y += boundY + offset * 2
  }

  /*
   * Per-object cache of the last transformed polygon. The transform is a pure
   * function of (shape, size, x, y, r), and within a single tick an object is
   * queried many times at one pose (every sensing whisker, every collision
   * pair), so memoising collapses hundreds of identical rebuilds per tick to
   * one. Invalidated automatically when any input changes (notably applyDelta
   * moving the object, or ship.hit swapping the shape array). Bit-exact: same
   * maths in the same order, just not repeated.
   */
  private cachedPolygon: Polygon | null = null
  private cachedRadius = 0
  private cacheX = Number.NaN
  private cacheY = Number.NaN
  private cacheR = Number.NaN
  private cacheSize = Number.NaN
  private cacheShape: number[][] | null = null

  getTransformedPolygon(shape?: number[][]): Polygon {
    // An explicit shape (the draw path) bypasses the cache.
    if (shape !== undefined) {
      return Polygon(shape)
        .scale([this.size, this.size])
        .translate([this.x, this.y])
        .rotate(asRadians(this.r))
    }
    if (
      this.cachedPolygon === null ||
      this.x !== this.cacheX ||
      this.y !== this.cacheY ||
      this.r !== this.cacheR ||
      this.size !== this.cacheSize ||
      this.shape !== this.cacheShape
    ) {
      this.cachedPolygon = Polygon(this.shape)
        .scale([this.size, this.size])
        .translate([this.x, this.y])
        .rotate(asRadians(this.r))
      /*
       * Bounding radius about (x, y): the farthest transformed vertex. The
       * circle it defines contains the whole polygon, so two objects whose
       * circles do not overlap cannot intersect. Measured from the actual
       * transformed vertices, so it is correct whatever point the rotation is
       * centred on, and never under-estimates (which would drop a real hit).
       */
      let maxSq = 0
      for (const [vx, vy] of this.cachedPolygon.toArray()) {
        const dx = vx - this.x
        const dy = vy - this.y
        const distSq = dx * dx + dy * dy
        if (distSq > maxSq) maxSq = distSq
      }
      this.cachedRadius = Math.sqrt(maxSq)
      this.cacheX = this.x
      this.cacheY = this.y
      this.cacheR = this.r
      this.cacheSize = this.size
      this.cacheShape = this.shape
    }
    return this.cachedPolygon
  }

  boundingRadius(): number {
    this.getTransformedPolygon()
    return this.cachedRadius
  }

  crossedByLine(line: Line): number[][] {
    return lineCrossesPolygon(line, this.getTransformedPolygon()).filter((res) => res.length !== 0)
  }

  isHit(hittable: AstroObject): boolean {
    // Broad phase: skip the full polygon test when the bounding circles are too
    // far apart to overlap. Conservative, so the exact result is unchanged.
    const dx = this.x - hittable.x
    const dy = this.y - hittable.y
    const reach = this.boundingRadius() + hittable.boundingRadius()
    if (dx * dx + dy * dy > reach * reach) return false

    const shape = this.getTransformedPolygon()
    const hShape = hittable.getTransformedPolygon()
    const hit = polygonsIntersect(shape, hShape)
    if (hit) {
      this.hit()
      hittable.hit()
    }
    return hit
  }

  hit() {
    this.cleanup()
  }

  cleanup() {
    this.old = true
  }
}

export default AstroObject
