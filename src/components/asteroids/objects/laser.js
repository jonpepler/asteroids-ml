import TempObject from '../temp-object'
import AstroObject from '../astro-object'
import { getDirectionVector } from '../util/geometry'

const size = 2
const speed = 10
class Laser extends TempObject {
  constructor (x, y, d, shootDirection) {
    super(x, y)
      .withSize(size)
      .withShape(AstroObject.SHAPE_CIRCLE)
      .withDelta(d)

    // launch vector
    const [dx, dy] = getDirectionVector(shootDirection)
    this.addDelta({ x: speed * dx, y: speed * dy })
  }
}

export default Laser
