import inside from 'point-in-polygon'

export const sumVectors = (a, b) => {
  const res = {
    x: (a.x || 0) + (b.x || 0),
    y: (a.y || 0) + (b.y || 0),
    r: (a.r || 0) + (b.r || 0)
  }
  return res
}

export const asRadians = a => a * Math.PI / 180

export const getDirectionVector = degrees => {
  // We know the hypotenuse is 1
  const normalised = a => a - Math.PI / 2
  const dx = Math.cos(normalised(asRadians(degrees)))
  const dy = Math.sin(normalised(asRadians(degrees)))
  return [dx, dy]
}

// adapted from https://github.com/tmpvar/polygon.js/issues/12
export const polygonsIntersect = (a, b) => {
  const aPoints = a.toArray()
  const bPoints = b.toArray()
  return aPoints.some(point => inside(point, bPoints)) || bPoints.some(point => inside(point, aPoints))
}

export const pointInPolygon = (point, polygon) => {
  return inside(point, polygon)
}

export const lineCrossesLine = (a, b) => {
  const a1 = { x: a[0][0], y: a[0][1] }
  const a2 = { x: a[1][0], y: a[1][1] }
  const b1 = { x: b[0][0], y: b[0][1] }
  const b2 = { x: b[1][0], y: b[1][1] }

  const uaT = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)
  const ubT = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)
  const uB = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y)

  if (uB !== 0) {
    const ua = uaT / uB
    const ub = ubT / uB

    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      return [
        a1.x + ua * (a2.x - a1.x),
        a1.y + ua * (a2.y - a1.y)
      ]
    }
  }
  return []
}

export const lineCrossesPolygon = (line, polygon) => {
  const points = polygon.toArray()
  const result = []
  const length = points.length
  for (let i = 0; i < length; i++) {
    const b0 = points[i]
    const b1 = points[(i + 1) % length]
    const crosses = lineCrossesLine(line, [b0, b1])
    if (crosses) result.push(crosses)
  }
  return result
}

export const distanceBetweenPoints = (a, b) => {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

export const closestPoint = (point, points) => {
  // if (points.length > 3) debugger
  return points.length > 0 ? points.sort(
    (a, b) => distanceBetweenPoints(point, a) - distanceBetweenPoints(point, b)
  )[0] : []
}
