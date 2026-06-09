import { describe, expect, it } from 'vitest'
import {
  type Line,
  asRadians,
  closestPoint,
  distanceBetweenPoints,
  getDirectionVector,
  lineCrossesLine,
  lineCrossesPolygon,
  pointInPolygon,
  sumVectors
} from './geometry'

describe('sumVectors', () => {
  it('adds matching components', () => {
    expect(sumVectors({ x: 1, y: 2, r: 3 }, { x: 4, y: 5, r: 6 })).toEqual({ x: 5, y: 7, r: 9 })
  })

  it('treats missing components as zero', () => {
    expect(sumVectors({ x: 1 }, { y: 2 })).toEqual({ x: 1, y: 2, r: 0 })
    expect(sumVectors({}, {})).toEqual({ x: 0, y: 0, r: 0 })
  })
})

describe('asRadians', () => {
  it('converts degrees to radians', () => {
    expect(asRadians(180)).toBeCloseTo(Math.PI)
    expect(asRadians(90)).toBeCloseTo(Math.PI / 2)
    expect(asRadians(0)).toBe(0)
  })
})

describe('getDirectionVector', () => {
  it('returns a unit-length vector', () => {
    const [x, y] = getDirectionVector(123)
    expect(Math.hypot(x, y)).toBeCloseTo(1)
  })

  it('points up (negative y) at 0 degrees', () => {
    const [x, y] = getDirectionVector(0)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(-1)
  })

  it('points right (positive x) at 90 degrees', () => {
    const [x, y] = getDirectionVector(90)
    expect(x).toBeCloseTo(1)
    expect(y).toBeCloseTo(0)
  })
})

describe('distanceBetweenPoints', () => {
  it('measures euclidean distance', () => {
    expect(distanceBetweenPoints([0, 0], [3, 4])).toBe(5)
    expect(distanceBetweenPoints([1, 1], [1, 1])).toBe(0)
  })
})

describe('closestPoint', () => {
  it('returns the nearest point to the target', () => {
    expect(
      closestPoint(
        [0, 0],
        [
          [10, 10],
          [1, 1],
          [5, 5]
        ]
      )
    ).toEqual([1, 1])
  })

  it('returns an empty array when there are no candidates', () => {
    expect(closestPoint([0, 0], [])).toEqual([])
  })
})

describe('pointInPolygon', () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10]
  ]

  it('detects a point inside the polygon', () => {
    expect(pointInPolygon([5, 5], square)).toBe(true)
  })

  it('detects a point outside the polygon', () => {
    expect(pointInPolygon([15, 5], square)).toBe(false)
  })
})

describe('lineCrossesLine', () => {
  it('returns the intersection point of crossing segments', () => {
    const a: Line = [
      [0, 0],
      [10, 10]
    ]
    const b: Line = [
      [0, 10],
      [10, 0]
    ]
    expect(lineCrossesLine(a, b)).toEqual([5, 5])
  })

  it('returns an empty array for parallel segments', () => {
    const a: Line = [
      [0, 0],
      [10, 0]
    ]
    const b: Line = [
      [0, 5],
      [10, 5]
    ]
    expect(lineCrossesLine(a, b)).toEqual([])
  })

  it('returns an empty array when segments do not reach each other', () => {
    const a: Line = [
      [0, 0],
      [1, 1]
    ]
    const b: Line = [
      [8, 0],
      [9, 1]
    ]
    expect(lineCrossesLine(a, b)).toEqual([])
  })
})

describe('lineCrossesPolygon', () => {
  const square = {
    toArray: () => [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ]
  }

  it('returns intersection points where a line crosses the polygon edges', () => {
    const line: Line = [
      [-5, 5],
      [15, 5]
    ]
    // crosses the left edge (x=0) and the right edge (x=10) at y=5
    const crossings = lineCrossesPolygon(line, square as never)
    expect(crossings).toContainEqual([0, 5])
    expect(crossings).toContainEqual([10, 5])
  })

  it('returns no crossings for a line outside the polygon', () => {
    const line: Line = [
      [-5, 20],
      [15, 20]
    ]
    expect(lineCrossesPolygon(line, square as never)).toEqual([])
  })
})
