import { Suspense, lazy, useEffect, useRef } from 'react'
import AstroFooter from '../components/asteroids/footer'
import Ship from '../components/asteroids/objects/ship'
import StarMap from '../components/asteroids/star-map'
import { makeAsteroids } from '../components/asteroids/util/asteroid-generator'
import type { KeyMap } from '../services/defaults'
import Runner, { type BrainGraph } from '../services/train/runner'
import type { P5, P5WithKeyCode } from '../types/p5'
import type AstroObject from './asteroids/astro-object'
import AstroBanner from './asteroids/banner'
import Asteroid from './asteroids/objects/asteroid'
import type Bullet from './asteroids/objects/bullet'
import AstroOverlay from './asteroids/overlay'
import {
  type GameSize,
  type Line,
  closestPoint,
  distanceBetweenPoints,
  getDirectionVector
} from './asteroids/util/geometry'
import { useKeyMapState } from './hooks/use-keymap-state'
import { useStateWithLocalStorage } from './hooks/use-state-with-storage'

import './style/asteroids.scss'

// react-p5 touches `window` on import, so load it lazily (client-only, code-split).
const Sketch = lazy(() => import('react-p5'))

interface SensePoint {
  line: number
  point: number[]
}

interface Sense {
  lines: Line[]
  input: SensePoint | undefined
  value: number
}

const asteroidKillScore = 10
let ship: Ship
let asteroids: Asteroid[]
let bullets: Bullet[]
let starMap: StarMap
let senses: Sense[]
let pressedKeys: number[]
let score = 0
let gameState = -1
let runner: Runner
let trainingStarted = false
let brainGraph: BrainGraph | [] | undefined

const Asteroids = (props: { mode?: string }) => {
  const containerName = 'asteroid-container'
  const containerEl = useRef<HTMLDivElement>(null)
  const defaultFill = 255
  const defaultBackground = 0
  const [targetSize] = useStateWithLocalStorage<GameSize>('targetSize')
  const [keyMap] = useKeyMapState()
  const isPlayMode = props.mode === 'play'
  const isTrainMode = !isPlayMode

  const getBrainGraph = async () => {
    brainGraph = await runner.getBrainGraph()
  }

  const setupGame = () => {
    ship = new Ship(targetSize.w / 2, targetSize.h / 2)
    asteroids = makeAsteroids(targetSize, ship)
    bullets = []
    starMap = StarMap.generate(targetSize.w, targetSize.h)
    pressedKeys = []
    senses = []
    if (score !== 0) score = 0
    if (gameState !== 0) {
      const start = () => {
        gameState = 0
      }
      if (isTrainMode && !trainingStarted) {
        runner = new Runner()
        runner.init().then(() => {
          trainingStarted = true
          getBrainGraph()
          start()
        })
      } else {
        start()
      }
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: setupGame seeds module-level game state and must run exactly once on mount.
  useEffect(() => {
    setupGame()
  }, [])

  const getWidth = () => containerEl.current?.offsetWidth || 0
  const getHeight = () => containerEl.current?.offsetHeight || 0
  const getRelativeWidth = () => getWidth() / targetSize.w
  const getRelativeHeight = () => getHeight() / targetSize.h
  const getRelativeSize = () => ({
    relativeWidth: getRelativeWidth(),
    relativeHeight: getRelativeHeight()
  })

  const setup = (p5: P5, canvasParentRef: Element) => {
    p5.createCanvas(targetSize.w, targetSize.h).parent(canvasParentRef)
    windowResized(p5)
  }

  const draw = (p5: P5) => {
    setScale(p5)
    p5.background(defaultBackground)
    if (gameState !== -1) gameLoop()
    starMap.draw(p5)
    drawObjects(p5, [ship], asteroids, bullets)
    if (isTrainMode) drawSenses(p5)
    if (isTrainMode && trainingStarted) drawGeneticInfo(p5)
    drawTexts(p5)
    resetFill(p5)
  }

  const trainingEnd = (win: boolean) => {
    if (win) runner.giveScore(1000)
    if (!runner.nextBrain()) runner.nextGeneration()
    getBrainGraph()
    setupGame()
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

  const generateBrainInput = (): number[] => {
    const whiskers = 8
    const longLength = 500
    const shortLength = 200
    const whiskerPoints: Line[][] = []
    const makeWhiskers = (num: number, length: number, offset: number) => {
      for (let i = 0; i < num; i++) {
        const line: Line[] = []
        const angle = ship.r + offset + (360 / num) * i
        let startPoint: number[] = ship.getPointOnEdgeOfShip(angle)
        const angleVector = getDirectionVector(angle)
        const boundOffset = ship.getOffset()

        let endPoint: number[] = []
        const recalcEndPoint = () => {
          endPoint = [
            startPoint[0] + angleVector[0] * length,
            startPoint[1] + angleVector[1] * length
          ]
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
            line.push([
              [-boundOffset, startPoint[1] + yUnder],
              [boundXOver - boundOffset, startPoint[1] + yUnder + yOver]
            ])
          }
        }
        if (startPoint[0] < -boundOffset) {
          startPoint = [startPoint[0] + targetSize.w + boundOffset * 2, startPoint[1]]
          recalcEndPoint()
        } else {
          if (endPoint[0] < -boundOffset) {
            isNormalLine = false
            const boundXUnder = endPoint[0] + boundOffset
            const lengthOver = boundXUnder / angleVector[0]
            const yOver = angleVector[1] * lengthOver
            const yUnder = angleVector[1] * (length - lengthOver)
            line.push([startPoint, [-boundOffset, startPoint[1] + yUnder]])
            line.push([
              [targetSize.w + boundOffset, startPoint[1] + yUnder],
              [targetSize.w + boundXUnder + boundOffset, startPoint[1] + yUnder + yOver]
            ])
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
            line.push([
              [startPoint[0] + xUnder, -boundOffset],
              [startPoint[0] + xUnder + xOver, boundYOver - boundOffset]
            ])
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
            line.push([
              [startPoint[0] + xUnder, targetSize.h + boundOffset],
              [startPoint[0] + xUnder + xOver, targetSize.h + boundYUnder + boundOffset]
            ])
          }
        }
        if (isNormalLine) {
          line.push([startPoint, endPoint])
        }
        whiskerPoints.push(line)
      }
    }
    makeWhiskers(whiskers, longLength, 0)
    makeWhiskers(whiskers, shortLength, 360 / whiskers / 2)

    const arraysWithElementsOnly = (arr: number[]) => arr.length !== 0
    const sensePoint = (sense: Line[]): SensePoint | undefined => {
      // use old school loop so we can break early
      for (let i = 0; i < sense.length; i++) {
        const point = closestPoint(
          sense[i][0],
          asteroids.flatMap((a) => a.crossedByLine(sense[i])).filter(arraysWithElementsOnly)
        )
        if (point.length !== 0) return { line: i, point }
      }
      return undefined
    }
    senses = whiskerPoints.map((sense) => {
      // get coords and line index of intersection point
      const input = sensePoint(sense)
      let value = 1
      if (input) {
        let length = 0

        // measure length up to the line with the sense point
        for (let i = 0; i < input.line; i++) {
          length += distanceBetweenPoints(sense[i][0], sense[i][1])
        }

        let fullLength = length
        // add the length of the next line up to the sense point
        length += distanceBetweenPoints(sense[input.line][0], input.point)

        // measure the rest of the full length of the line (could use whiskerLength)
        for (let i = input.line; i < sense.length; i++) {
          fullLength += distanceBetweenPoints(sense[i][0], sense[i][1])
        }
        value = length / fullLength
      }
      return {
        lines: sense,
        // record which line part hit an astroid, for logging and display reasons
        input,
        value
      }
    })
    return senses.map((sense) => sense.value)
  }

  const trainingLoop = () => {
    if (isTrainMode) {
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
    bullets = bullets.filter((obj) => !obj.old)
    updateAsteroids(asteroids)
    testWinGame()
    testLoseGame()
  }

  const effectObjects = (func: (obj: AstroObject) => void, ...objectLists: AstroObject[][]) => {
    objectLists.forEach((objects) => {
      objects.forEach(func)
    })
  }

  const updateObjects = (...objectLists: AstroObject[][]) => {
    effectObjects(
      (element) => {
        element.applyDelta(targetSize.w, targetSize.h)
      },
      ...objectLists
    )
  }

  const drawObjects = (p5: P5, ...objectLists: AstroObject[][]) => {
    effectObjects(
      (element) => {
        element.draw(p5)
      },
      ...objectLists
    )
  }

  const drawSenses = (p5: P5) => {
    p5.push()
    p5.stroke(50)
    p5.strokeWeight(2)
    senses.forEach((sense) => {
      sense.lines.forEach((line) => {
        p5.line(line[0][0], line[0][1], line[1][0], line[1][1])
      })
      const { input } = sense
      if (input?.point) {
        p5.push()
        p5.stroke('red')
        p5.strokeWeight(5)
        p5.point(input.point[0], input.point[1])
        p5.pop()
      }
    })
    p5.pop()
  }

  const drawGeneticInfo = (p5: P5) => {
    if (trainingStarted) {
      p5.push()
      p5.textSize(18)
      p5.textAlign(p5.LEFT)
      p5.text(runner.getInfo(), 28, targetSize.h - 40)
      p5.pop()

      drawBrain(p5)
    }
  }

  const drawBrain = (p5: P5) => {
    if (brainGraph === undefined || Array.isArray(brainGraph)) return
    const scale = 0.1
    const height = brainGraph.height * scale
    const heightOffset = targetSize.h - 40 - 15 - height
    const widthOffset = 28
    const nodeSize = 50
    const connectionWeightOffset = 2.5
    p5.push()
    p5.stroke(250)
    p5.translate(widthOffset, heightOffset)
    p5.scale(scale)
    // for each edge
    p5.push()
    brainGraph.edges.forEach((edge) => {
      p5.strokeWeight(edge.weight + connectionWeightOffset)
      p5.stroke(120 + edge.weight * 40)
      edge.sections.forEach((section) =>
        p5.line(section.startPoint.x, section.startPoint.y, section.endPoint.x, section.endPoint.y)
      )
    })
    p5.pop()
    // for each child
    p5.strokeWeight(5)
    p5.rectMode(p5.CENTER)
    brainGraph.children.forEach((child) => {
      p5.push()
      switch (child.type) {
        case 'input':
          p5.fill('orange')
          break
        case 'output':
          p5.fill('green')
          break
      }
      p5.square(child.x, child.y, nodeSize)
      p5.pop()
    })
    p5.pop()
  }

  const drawTexts = (p5: P5) => {
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

  const checkCollisions = (objects: AstroObject[], hittables: AstroObject[]) => {
    objects.forEach((obj) => {
      hittables.forEach((hittable) => obj.isHit(hittable))
    })
  }

  const updateAsteroids = (asteroids: Asteroid[]) => {
    const newAsteroids: Asteroid[] = []
    const asteroidsToSplice: number[] = []
    asteroids.forEach((obj, i) => {
      if (obj.old) {
        newAsteroids.push(...obj.spawnChildren())
        asteroidsToSplice.push(i)
        if (gameState === 0) {
          if (isTrainMode) runner.giveScore(asteroidKillScore)
          score += asteroidKillScore
        }
      }
    })
    asteroidsToSplice.forEach((index) => asteroids.splice(index, 1))
    asteroids.push(...newAsteroids)
    const totalSize = asteroids.reduce((ts, a) => ts + a.size, 0)
    if (totalSize < 1200) {
      asteroids.push(
        new Asteroid(0, 0)
          .withRandomShape()
          .withRandomCorner(targetSize.w, targetSize.h)
          .withRandomDelta()
      )
    }
  }

  const resetFill = (p5: P5) => p5.fill(defaultFill)

  let scale = 1
  const updateScale = (): [number, number] => {
    const { relativeWidth, relativeHeight } = getRelativeSize()
    const normalise = (n: number) => (n < 1 ? 1 - n : n - 1)
    const widthBigger = normalise(relativeWidth) > normalise(relativeHeight)
    scale = widthBigger ? relativeWidth : relativeHeight
    if (widthBigger) return [getWidth(), targetSize.h * scale]
    return [targetSize.w * scale, getHeight()]
  }
  updateScale()

  const setScale = (p5: P5) => p5.scale(scale)

  const windowResized = (p5: P5) => {
    const [w, h] = updateScale()
    p5.resizeCanvas(w, h)
  }

  const keyPressed = (p5: P5) => {
    pressedKeys.push((p5 as P5WithKeyCode).keyCode)
  }

  const keyReleased = (p5: P5) => {
    const { keyCode } = p5 as P5WithKeyCode
    const index = pressedKeys.indexOf(keyCode)
    if (index > -1) pressedKeys.splice(index, 1)
    switch (keyCode) {
      // ArrowUp
      case keyMap.boost:
        ship.moveUpOff()
        break
      case keyMap.rotateLeft:
        ship.rotateLeftOff()
        break
      case keyMap.rotateRight:
        ship.rotateRightOff()
        break
    }
  }

  const fireLimiter = 3
  let fireCount = 0
  const reportKeysToShip = (keys: number[]) => {
    keys.forEach((key) => {
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
      <Suspense fallback={null}>
        <Sketch
          setup={setup}
          draw={draw}
          windowResized={windowResized}
          keyPressed={keyPressed}
          keyReleased={keyReleased}
        />
      </Suspense>
      <AstroFooter />
    </div>
  )
}

export default Asteroids
