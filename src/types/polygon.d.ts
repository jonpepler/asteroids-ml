// Local shim for the `polygon` package. The DefinitelyTyped types reject the
// array arguments this project passes to scale/translate and pull in vec2, so
// we declare only the surface we use, matching the library's real runtime API
// (callable with or without `new`, and accepting plain [x, y] points).
declare module 'polygon' {
  type Point = [number, number]

  interface Polygon {
    scale(amount: number | Point, origin?: Point | null, returnNew?: boolean): Polygon
    translate(vec: Point, returnNew?: boolean): Polygon
    rotate(rads: number, origin?: Point | null, returnNew?: boolean): Polygon
    toArray(): number[][]
  }

  interface PolygonConstructor {
    (points: number[][]): Polygon
    new (points: number[][]): Polygon
  }

  const Polygon: PolygonConstructor
  export = Polygon
}
