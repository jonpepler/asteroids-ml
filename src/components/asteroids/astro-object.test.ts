import { describe, expect, it } from 'vitest'
import Ship from './objects/ship'

describe('AstroObject bounding radius', () => {
  it('contains every transformed vertex, whatever the rotation', () => {
    // The broad-phase cull is only safe if the radius never under-estimates, so
    // the bounding circle must enclose every vertex of the transformed polygon.
    const ship = new Ship(300, 200)
    ship.r = 37
    const radius = ship.boundingRadius()
    for (const [vx, vy] of ship.getTransformedPolygon().toArray()) {
      expect(Math.hypot(vx - ship.x, vy - ship.y)).toBeLessThanOrEqual(radius + 1e-9)
    }
  })
})

describe('AstroObject hit detection', () => {
  it('does not register a hit when the objects are far apart', () => {
    const a = new Ship(0, 0)
    const b = new Ship(100000, 100000)
    expect(a.isHit(b)).toBe(false)
  })

  it('registers a hit when the objects overlap', () => {
    const a = new Ship(0, 0)
    const b = new Ship(0, 0)
    expect(a.isHit(b)).toBe(true)
  })
})
