export const sumVectors = (a, b) => {
  const res = {
    x: (a.x || 0) + (b.x || 0),
    y: (a.y || 0) + (b.y || 0),
    r: (a.r || 0) + (b.r || 0)
  }
  return res
}
