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
