import React, { useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import { loadableSketch as Sketch } from './loadable-react-p5'
import { useStateWithLocalStorage } from './hooks/use-state-with-storage'
import { useKeyMapState } from './hooks/use-keymap-state'

import AstroBanner from './asteroids/banner'
import AstroOverlay from './asteroids/overlay'
import AstroFooter from '../components/asteroids/footer'

import Ship from '../components/asteroids/objects/ship'
import AsteroidGenerator from '../components/asteroids/util/asteroid-generator'
import StarMap from '../components/asteroids/star-map'

import Runner from '../services/train/runner'
import { getDirectionVector } from './asteroids/util/geometry'

import './style/asteroids.scss'

const asteroidKillScore = 10
let ship
let asteroids
let bullets
let starMap
let senses
let pressedKeys
let score = 0
let gameState = 0
const Asteroids = (props) => {
  const containerName = 'asteroid-container'
  const containerEl = useRef(null)
  const defaultFill = 255
  const defaultBackground = 0
  const [targetSize] = useStateWithLocalStorage('targetSize')
  const [keyMap] = useKeyMapState()
  const isPlayMode = props.mode === 'play'
  const isTrainMode = !isPlayMode

  const setupGame = () => {
    ship = new Ship(targetSize.w / 2, targetSize.h / 2)
    asteroids = AsteroidGenerator.makeAsteroids(targetSize, ship)
    bullets = []
    starMap = StarMap.generate(targetSize.w, targetSize.h)
    pressedKeys = []
    if (score !== 0) score = 0
    if (gameState !== 0) gameState = 0
  }

  useEffect(() => setupGame(), [])

  const getWidth = () => (containerEl.current && containerEl.current.offsetWidth) || 0
  const getHeight = () => (containerEl.current && containerEl.current.offsetHeight) || 0
  const getRelativeWidth = () => getWidth() / targetSize.w
  const getRelativeHeight = () => getHeight() / targetSize.h
  const getRelativeSize = p5 => ({ relativeWidth: getRelativeWidth(), relativeHeight: getRelativeHeight() })

  let runner
  let trainingStarted = false
  const startTraining = () => {
    console.log('new generation!')
    if (!trainingStarted) trainingStarted = true
    runner = new Runner()
    console.log(runner.getInfo())
  }

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
    if (isTrainMode) drawSenses(p5)
    drawTexts(p5)
    resetFill(p5)
  }

  const trainingEnd = win => {
    if (win) runner.giveScore(100)
    if (!runner.nextBrain()) runner.nextGeneration()
    setupGame()
    console.log(runner.getInfo())
  }

  const testWinGame = () => {
    if (asteroids.length === 0) {
      gameState = 1
      if (isTrainMode) trainingEnd(true)
    }
  }

  const testLoseGame = () => {
    if (ship.old) {
      gameState = 2
      if (isTrainMode) trainingEnd(false)
    }
  }

  const generateBrainInput = () => {
    const whiskers = 8
    const longLength = 500
    const shortLength = 200
    const whiskerPoints = []
    const makeWhiskers = (num, length, offset) => {
      for (let i = 0; i < num; i++) {
        const line = []
        const angle = ship.r + offset + (360 / num) * i
        let startPoint = ship.getPointOnEdgeOfShip(angle)
        const angleVector = getDirectionVector(angle)
        const boundOffset = ship.getOffset()

        let endPoint
        const recalcEndPoint = () => {
          endPoint = [startPoint[0] + angleVector[0] * length, startPoint[1] + angleVector[1] * length]
        }
        recalcEndPoint()
        let isNormalLine = true
        if (startPoint[0] > targetSize.w + boundOffset) {
          startPoint = [startPoint[0] - targetSize.w - boundOffset * 2, startPoint[1]]
          recalcEndPoint()
        } else {
          if (endPoint[0] > targetSize.w + boundOffset) {
            isNormalLine = false
            const boundXOver = endPoint[0] - targetSize.w - boundOffset
            const lengthOver = boundXOver / angleVector[0]
            const yOver = angleVector[1] * lengthOver
            const yUnder = angleVector[1] * (length - lengthOver)
            line.push([startPoint, [targetSize.w + boundOffset, startPoint[1] + yUnder]])
            line.push([[-boundOffset, startPoint[1] + yUnder], [boundXOver - boundOffset, startPoint[1] + yUnder + yOver]])
          }
        }
        if (startPoint[0] < -boundOffset) {
          startPoint = [startPoint[0] + targetSize.w + boundOffset * 2, startPoint[1]]
          recalcEndPoint()
        } else {
          if (endPoint[0] < -boundOffset) {
            isNormalLine = false
            const tboundXUnder = endPoint[0] + boundOffset
            const tlengthOver = tboundXUnder / angleVector[0]
            const tyOver = angleVector[1] * tlengthOver
            const tyUnder = angleVector[1] * (length - tlengthOver)
            line.push([startPoint, [-boundOffset, startPoint[1] + tyUnder]])
            line.push([[targetSize.w + boundOffset, startPoint[1] + tyUnder], [targetSize.w + tboundXUnder + boundOffset, startPoint[1] + tyUnder + tyOver]])
          }
        }
        if (startPoint[1] > targetSize.h + boundOffset) {
          startPoint = [startPoint[0], startPoint[1] - targetSize.h - boundOffset * 2]
          recalcEndPoint()
        } else {
          if (endPoint[1] > targetSize.h + boundOffset) {
            isNormalLine = false
            const boundYOver = endPoint[1] - targetSize.h - boundOffset
            const lengthOver = boundYOver / angleVector[1]
            const xOver = angleVector[0] * lengthOver
            const xUnder = angleVector[0] * (length - lengthOver)
            line.push([startPoint, [startPoint[0] + xUnder, targetSize.h + boundOffset]])
            line.push([[startPoint[0] + xUnder, -boundOffset], [startPoint[0] + xUnder + xOver, boundYOver - boundOffset]])
          }
        }
        if (startPoint[1] < -boundOffset) {
          startPoint = [startPoint[0], startPoint[1] + targetSize.h + boundOffset * 2]
          recalcEndPoint()
        } else {
          if (endPoint[1] < -boundOffset) {
            isNormalLine = false
            const boundYUnder = endPoint[1] + boundOffset
            const lengthOver = boundYUnder / angleVector[1]
            const xOver = angleVector[0] * lengthOver
            const xUnder = angleVector[0] * (length - lengthOver)
            line.push([startPoint, [startPoint[0] + xUnder, -boundOffset]])
            line.push([[startPoint[0] + xUnder, targetSize.h + boundOffset], [startPoint[0] + xUnder + xOver, targetSize.h + boundYUnder + boundOffset]])
          }
        }
        if (isNormalLine) {
          line.push([startPoint, endPoint])
        }
        whiskerPoints.push(line)
      }
    }
    makeWhiskers(whiskers, longLength, 0)
    makeWhiskers(whiskers, shortLength, (360 / whiskers) / 2)

    senses = whiskerPoints
    // do same for short whiskies
    // scan along each whisky for objects
    // on first found item, add a third point inbetween the first two
    // save the position as a ratio of the length (0 -> 1 where 1 is right next to the ship)

    return Array.from({ length: 16 }).map(x => 0)
  }

  const trainingLoop = () => {
    if (isTrainMode) {
      if (!trainingStarted) startTraining()
      const input = generateBrainInput()
      pressedKeys = runner.getBrainOutput(input)
    }
  }

  const gameLoop = () => {
    trainingLoop()
    generateBrainInput()
    reportKeysToShip(pressedKeys)
    updateObjects([ship], asteroids, bullets)
    checkCollisions(asteroids, bullets)
    checkCollisions([ship], bullets)
    checkCollisions([ship], asteroids)
    bullets = bullets.filter(obj => !obj.old)
    updateAsteroids(asteroids)
    testWinGame()
    testLoseGame()
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

  const drawSenses = p5 => {
    p5.push()
    p5.stroke(50)
    p5.strokeWeight(2)
    senses.forEach(sense => {
      sense.forEach(line => {
        p5.line(...line[0], ...line[1])
      })
    })
    p5.pop()
  }

  const drawTexts = p5 => {
    p5.push()
    p5.textSize(48)
    p5.text(`SCORE ${score.toString().padStart(4, '0')}`, 40, 80)
    p5.textAlign(p5.CENTER)
    if (gameState === 1) {
      p5.text('YOU WIN', targetSize.w / 2, targetSize.h / 2)
    }
    if (gameState === 2) {
      p5.text('YOU LOSE', targetSize.w / 2, targetSize.h / 2)
    }
    p5.pop()
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
        if (gameState === 0) {
          if (isTrainMode) {
            runner.giveScore(asteroidKillScore)
            console.log(runner.getInfo())
          }
          score += asteroidKillScore
        }
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
        ship.moveUpOff()
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
        case keyMap.rotateLeft:
          ship.rotateLeft()
          break
        case keyMap.boost:
          starMap.applyTravelFeel(ship.moveUp())
          break
        case keyMap.rotateRight:
          ship.rotateRight()
          break
      }
    })
  }

  return (
    <div className={containerName} ref={containerEl}>
      <AstroBanner />
      <AstroOverlay />
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
