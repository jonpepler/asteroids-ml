import React, { useRef, useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { loadableSketch as Sketch } from './loadable-react-p5'
import { useStateWithLocalStorage } from './hooks/use-state-with-storage'

import AstroBanner from './asteroids/banner'
import AstroOverlay from './asteroids/overlay'
import AstroFooter from '../components/asteroids/footer'

import Ship from '../components/asteroids/objects/ship'
import AsteroidGenerator from '../components/asteroids/util/asteroid-generator'
import StarMap from '../components/asteroids/star-map'

import './style/asteroids.scss'

const asteroidKillScore = 10
const ship = new Ship(825, 525)
const asteroids = []
let bullets = []
const pressedKeys = []
const Asteroids = (props) => {
  const containerName = 'asteroid-container'
  const containerEl = useRef(null)
  const defaultFill = 255
  const defaultBackground = 0
  const [targetSize] = useStateWithLocalStorage('targetSize')
  const [keyMap] = useStateWithLocalStorage('keyMap')
  const [score, updateScore] = useState(0)
  const [gameState, updateGameState] = useState(-1)
  const [starMap] = useState(StarMap.generate(targetSize.w, targetSize.h))
  const isPlayMode = props.mode === 'play'

  useEffect(() => {
    asteroids.push(...AsteroidGenerator.makeAsteroids(targetSize, ship))
  }, [])

  useEffect(() => {
    if (isPlayMode) updateGameState(0)
  }, [])

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
    if (gameState !== -1) gameLoop()
    starMap.draw(p5)
    drawObjects(p5, [ship], asteroids, bullets)
    resetFill(p5)
  }

  const getBrainOutput = () => { throw new Error('unimplemented') }

  const getInput = () => isPlayMode ? pressedKeys : getBrainOutput()

  const gameLoop = () => {
    reportKeysToShip(getInput())
    updateObjects([ship], asteroids, bullets)
    checkCollisions(asteroids, bullets)
    checkCollisions([ship], bullets)
    checkCollisions([ship], asteroids)
    bullets = bullets.filter(obj => !obj.old)
    updateAsteroids(asteroids)
    if (asteroids.length === 0) updateGameState(1)
    if (ship.old) updateGameState(2)
  }

  const effectObjects = (func, ...objectLists) => {
    objectLists.forEach(objects => {
      objects.forEach(func)
    })
  }

  const updateObjects = (...objectLists) => {
    effectObjects(element => {
      element.applyDelta(targetSize.w, targetSize.h)
    }, ...objectLists)
  }

  const drawObjects = (p5, ...objectLists) => {
    effectObjects(element => { element.draw(p5) }, ...objectLists)
  }

  const checkCollisions = (objects, hittables) => {
    objects.forEach(obj => {
      hittables.forEach(hittable => obj.isHit(hittable))
    })
  }

  const updateAsteroids = asteroids => {
    const newAsteroids = []
    const asteroidsToSplice = []
    asteroids.forEach((obj, i) => {
      if (obj.old) {
        newAsteroids.push(...obj.spawnChildren())
        asteroidsToSplice.push(i)
        if (gameState === 0) updateScore(score + asteroidKillScore)
      }
    })
    asteroidsToSplice.forEach(index => asteroids.splice(index, 1))
    asteroids.push(...newAsteroids)
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

  const keyPressed = ({ keyCode }) => {
    pressedKeys.push(keyCode)
  }

  const keyReleased = ({ keyCode }) => {
    const index = pressedKeys.indexOf(keyCode)
    if (index > -1) pressedKeys.splice(index, 1)
    switch (keyCode) {
      // ArrowUp
      case 38:
        ship.arrowUpOff()
        break
    }
  }

  const fireLimiter = 3
  let fireCount = 0
  const reportKeysToShip = (keys) => {
    keys.forEach(key => {
      switch (key) {
        // Space
        case keyMap.shoot:
          if (fireCount > fireLimiter) {
            bullets.push(ship.shoot())
            fireCount = 0
          } else {
            fireCount++
          }
          break
        // ArrowLeft
        case keyMap.rotateLeft:
          ship.arrowLeft()
          break
        // ArrowUp
        case keyMap.boost:
          starMap.applyTravelFeel(ship.arrowUp())
          break
        // ArrowRight
        case keyMap.rotateRight:
          ship.arrowRight()
          break
      }
    })
  }

  return (
    <div className={containerName} ref={containerEl}>
      <AstroBanner score={score} />
      <AstroOverlay gameState={gameState} />
      <Sketch
        setup={setup}
        draw={draw}
        windowResized={windowResized}
        keyPressed={keyPressed}
        keyReleased={keyReleased}
      />
      <AstroFooter />
    </div>
  )
}

Asteroids.propTypes = {
  mode: PropTypes.string
}

export default Asteroids
