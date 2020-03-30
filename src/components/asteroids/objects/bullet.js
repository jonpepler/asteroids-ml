import TempObject from '../temp-object'

const shape = [[0, -0.5], [0.25, -0.25], [0.25, 0.5], [-0.25, 0.5], [-0.25, -0.25]]
const size = 10
const speed = 10
class Bullet extends TempObject {
  constructor (ship, delta) {
    super(...ship.getShipTip(), ship.r)
      .withSize(size)
      .withShape(shape)
      .withDelta(ship.d)

    this.ship = ship
    // launch vector
    const { dx, dy } = delta
    this.addDelta({ x: speed * dx, y: speed * dy })
  }

  // special case where bullets need to be positioned considering that
  // they may have been fired beyond their personal offset due to ship
  // size
  getOffset () {
    return this.ship.size * 2.5
  }
}

export default Bullet
