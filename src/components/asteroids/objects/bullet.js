import TempObject from '../temp-object'
import { getDirectionVector } from '../util/geometry'

const shape = [[0, -0.5], [0.25, -0.25], [0.25, 0.5], [-0.25, 0.5], [-0.25, -0.25]]
const size = 10
const speed = 10
class Bullet extends TempObject {
  constructor (x, y, d, shootDirection) {
    super(x, y, shootDirection)
      .withSize(size)
      .withShape(shape)
      .withDelta(d)

    // launch vector
    const [dx, dy] = getDirectionVector(shootDirection)
    this.addDelta({ x: speed * dx, y: speed * dy })
  }
}

export default Bullet
