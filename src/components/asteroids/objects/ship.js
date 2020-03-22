import AstroObject from '../astro-object'

const shape = [[0, -0.5], [0.33, 0.5], [0, 0.33], [-0.33, 0.5]]
const size = 100
class Ship extends AstroObject {
  constructor (x, y) {
    super(x, y).withShape(shape).withSize(size)
  }
}

export default Ship
