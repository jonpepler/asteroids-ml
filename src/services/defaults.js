const defaults = {
  circleColour: '#000',
  targetSize: {
    w: 1680,
    h: 1050
  },
  keyMap: {
    shoot: 32,
    rotateLeft: 37,
    boost: 38,
    rotateRight: 39
  }
}

export const getDefault = key => defaults[key]
