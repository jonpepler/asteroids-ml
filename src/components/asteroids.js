import React, { useRef } from 'react'
import { loadableSketch as Sketch } from './loadable-react-p5'
import { useStateWithLocalStorage } from './hooks/use-state-with-storage'

import AstroFooter from '../components/asteroids/footer'

import './style/asteroids.scss'

const Asteroids = () => {
  const containerName = 'asteroid-container'
  const containerEl = useRef(null)
  const defaultFill = 0
  const defaultBackground = 0
  const [circleColour] = useStateWithLocalStorage('circleColour')
  const [targetSize] = useStateWithLocalStorage('targetSize')

  const getWidth = () => containerEl.current.offsetWidth || 0
  const getHeight = () => containerEl.current.offsetHeight || 0
  const getRelativeWidth = () => getWidth() / targetSize.w
  const getRelativeHeight = () => getHeight() / targetSize.h
  const getRelativeSize = p5 => ({ relativeWidth: getRelativeWidth(), relativeHeight: getRelativeHeight() })

  const setup = (p5, canvasParentRef) => {
    p5.createCanvas(targetSize.w, targetSize.h).parent(canvasParentRef)
    console.log(`using background ${defaultBackground}`)
    windowResized(p5)
  }

  const draw = p5 => {
    setScale(p5)
    p5.background(defaultBackground)
    p5.fill(p5.color(circleColour))
    p5.circle(200, 150, 50)
    resetFill(p5)
  }

  const resetFill = p5 => p5.fill(defaultFill)

  const getScale = (p5, returnSizes) => {
    const { relativeWidth, relativeHeight } = getRelativeSize(p5)
    const normalise = n => n < 1 ? 1 - n : n - 1
    const widthBigger = normalise(relativeWidth) > normalise(relativeHeight)
    const scale = widthBigger ? relativeWidth : relativeHeight
    console.log(`using scale ${scale}`)
    if (!returnSizes) return scale
    let canvasSize
    if (widthBigger) {
      canvasSize = [getWidth(), targetSize.h * scale]
    } else {
      canvasSize = [targetSize.w * scale, getHeight()]
    }
    console.log(`using canvas ${canvasSize}`)
    return { scale, canvasSize }
  }

  const setScale = p5 => p5.scale(getScale(p5))

  const windowResized = p5 => {
    console.log('resized')
    const { canvasSize } = getScale(p5, true)
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
