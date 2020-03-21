import React from 'react'
import { loadableSketch as Sketch } from './loadable-react-p5'

import { get } from '../services/storage'

const Asteroids = () => {
  const setup = (p5, canvasParentRef) => {
    p5.createCanvas(400, 300).parent(canvasParentRef)
    p5.background(0)
    p5.fill(p5.color(get('circleColour')))
  }

  const draw = p5 => {
    p5.circle(200, 150, 50)
  }

  return (
    <Sketch setup={setup} draw={draw} />
  )
}

export default Asteroids
