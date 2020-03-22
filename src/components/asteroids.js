import React, { useRef, useEffect } from 'react'
import { loadableSketch as Sketch } from './loadable-react-p5'
import { useStateWithLocalStorage } from './hooks/use-state-with-storage'

import AstroFooter from '../components/asteroids/footer'

import Ship from '../components/asteroids/objects/ship'
import AsteroidGenerator from '../components/asteroids/util/asteroid-generator'

import './style/asteroids.scss'

const drawables = [new Ship(825, 525)]
const Asteroids = () => {
  const containerName = 'asteroid-container'
  const containerEl = useRef(null)
  const defaultFill = 255
  const defaultBackground = 0
  const [circleColour] = useStateWithLocalStorage('circleColour')
  const [targetSize] = useStateWithLocalStorage('targetSize')

  // don't return anything to useEffect
  // eslint-disable-next-line no-void
  useEffect(() => void (drawables.push(...AsteroidGenerator.makeAsteroids(targetSize))), [])

  const getWidth = () => (containerEl.current && containerEl.current.offsetWidth) || 0
  const getHeight = () => (containerEl.current && containerEl.current.offsetHeight) || 0
  const getRelativeWidth = () => getWidth() / targetSize.w
  const getRelativeHeight = () => getHeight() / targetSize.h
  const getRelativeSize = p5 => ({ relativeWidth: getRelativeWidth(), relativeHeight: getRelativeHeight() })

  const setup = (p5, canvasParentRef) => {
    p5.createCanvas(targetSize.w, targetSize.h).parent(canvasParentRef)
    windowResized(p5)
  }

  const draw = p5 => {
    setScale(p5)
    p5.background(defaultBackground)
    drawables.forEach(element => {
      element.applyDelta()
      element.draw(p5)
    })
    p5.fill(p5.color(circleColour))
    p5.circle(200, 150, 50)
    resetFill(p5)
  }

  const resetFill = p5 => p5.fill(defaultFill)

  let scale = 1
  const updateScale = (p5) => {
    const { relativeWidth, relativeHeight } = getRelativeSize(p5)
    const normalise = n => n < 1 ? 1 - n : n - 1
    const widthBigger = normalise(relativeWidth) > normalise(relativeHeight)
    scale = widthBigger ? relativeWidth : relativeHeight
    return widthBigger ? [getWidth(), targetSize.h * scale] : [targetSize.w * scale, getHeight()]
  }
  updateScale()

  const setScale = p5 => p5.scale(scale)

  const windowResized = p5 => {
    const canvasSize = updateScale(p5)
    p5.resizeCanvas(...canvasSize)
  }

  return (
    <div className={containerName} ref={containerEl}>
      <Sketch
        setup={setup}
        draw={draw}
        windowResized={windowResized}
      />
      <AstroFooter />
    </div>
  )
}

export default Asteroids
