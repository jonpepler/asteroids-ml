import { Suspense, lazy, useEffect, useRef } from 'react'
import AstroFooter from '../components/asteroids/footer'
import type { GameSize } from '../components/asteroids/util/geometry'
import type { BrainGraph, GenStat } from '../services/train/runner'
import { Trainer } from '../services/train/trainer'
import type { P5, P5WithKeyCode } from '../types/p5'
import type AstroObject from './asteroids/astro-object'
import AstroBanner from './asteroids/banner'
import { GameInstance } from './asteroids/game'
import AstroOverlay from './asteroids/overlay'
import { useKeyMapState } from './hooks/use-keymap-state'
import { useStateWithLocalStorage } from './hooks/use-state-with-storage'

import './style/asteroids.scss'

// react-p5 touches `window` on import, so load it lazily (client-only, code-split).
const Sketch = lazy(() => import('react-p5'))

interface AsteroidsProps {
  mode?: string
  // Genomes to evaluate (headless) per rendered frame in training mode.
  speed?: number
  // Called at each generation boundary with the run history, for a chart.
  onGeneration?: (history: GenStat[]) => void
}

const Asteroids = (props: AsteroidsProps) => {
  const containerName = 'asteroid-container'
  const containerEl = useRef<HTMLDivElement>(null)
  const defaultFill = 255
  const defaultBackground = 0
  const [targetSize] = useStateWithLocalStorage<GameSize>('targetSize')
  const [keyMap] = useKeyMapState()
  const isPlayMode = props.mode === 'play'
  const isTrainMode = !isPlayMode

  // Long-lived state lives in refs so it survives React re-renders.
  // In play mode `gameRef` is the player's game; in training it is the champion
  // replay, while `trainerRef` trains the population headlessly in the
  // background.
  const gameRef = useRef<GameInstance | null>(null)
  const trainerRef = useRef<Trainer | null>(null)
  const startedRef = useRef(false)
  const brainGraphRef = useRef<BrainGraph | [] | undefined>(undefined)
  const pressedKeysRef = useRef<number[]>([])
  const scaleRef = useRef(1)
  const speedRef = useRef(props.speed ?? 1)
  speedRef.current = props.speed ?? 1
  const onGenerationRef = useRef(props.onGeneration)
  onGenerationRef.current = props.onGeneration

  const refreshChampionGraph = async () => {
    const trainer = trainerRef.current
    if (trainer) brainGraphRef.current = await trainer.getChampionGraph()
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: sets up the game (and trainer) exactly once on mount.
  useEffect(() => {
    gameRef.current = new GameInstance({ targetSize, keyMap, training: false })
    if (!isTrainMode) {
      startedRef.current = true
      return
    }
    let cancelled = false
    const trainer = new Trainer({ targetSize, keyMap })
    trainerRef.current = trainer
    trainer.init().then(() => {
      if (cancelled) {
        trainer.stop()
        return
      }
      // Training runs flat out across worker threads in the background; the
      // generation callback refreshes the chart and the champion diagram.
      trainer.start((history) => {
        onGenerationRef.current?.(history)
        refreshChampionGraph()
      })
      refreshChampionGraph()
      startedRef.current = true
    })
    return () => {
      cancelled = true
      trainer.stop()
    }
  }, [])

  const getWidth = () => containerEl.current?.offsetWidth || 0
  const getHeight = () => containerEl.current?.offsetHeight || 0

  const setup = (p5: P5, canvasParentRef: Element) => {
    p5.createCanvas(targetSize.w, targetSize.h).parent(canvasParentRef)
    windowResized(p5)
  }

  const advance = () => {
    const game = gameRef.current
    if (!game) return
    if (isTrainMode) {
      const trainer = trainerRef.current
      if (!trainer) return
      // Training happens on worker threads; here we just replay the champion.
      // `speed` fast-forwards that replay (training throughput is unaffected).
      const steps = Math.max(1, Math.floor(speedRef.current))
      for (let i = 0; i < steps; i++) {
        game.step(trainer.championKeys(game))
        if (game.status !== 'running') game.reset()
      }
    } else {
      game.step(pressedKeysRef.current)
    }
  }

  const draw = (p5: P5) => {
    setScale(p5)
    p5.background(defaultBackground)
    const game = gameRef.current
    if (!game) return
    if (startedRef.current) advance()
    game.starMap.draw(p5)
    drawObjects(p5, [game.ship], game.asteroids, game.bullets)
    if (isTrainMode) {
      drawSenses(p5)
      drawGeneticInfo(p5)
    }
    drawTexts(p5)
    resetFill(p5)
  }

  const effectObjects = (func: (obj: AstroObject) => void, ...objectLists: AstroObject[][]) => {
    for (const objects of objectLists) {
      for (const element of objects) func(element)
    }
  }

  const drawObjects = (p5: P5, ...objectLists: AstroObject[][]) => {
    effectObjects((element) => element.draw(p5), ...objectLists)
  }

  const drawSenses = (p5: P5) => {
    const game = gameRef.current
    if (!game) return
    p5.push()
    p5.stroke(50)
    p5.strokeWeight(2)
    for (const sense of game.senses) {
      for (const line of sense.lines) {
        p5.line(line[0][0], line[0][1], line[1][0], line[1][1])
      }
      const { input } = sense
      if (input?.point) {
        p5.push()
        p5.stroke('red')
        p5.strokeWeight(5)
        p5.point(input.point[0], input.point[1])
        p5.pop()
      }
    }
    p5.pop()
  }

  const drawGeneticInfo = (p5: P5) => {
    const trainer = trainerRef.current
    if (!trainer) return
    const champion = Number.isFinite(trainer.championScore) ? Math.round(trainer.championScore) : 0
    p5.push()
    p5.textSize(18)
    p5.textAlign(p5.LEFT)
    p5.text(
      `Champion of generation ${trainer.generation} (best ${champion}), training on ${trainer.workerCount} workers`,
      28,
      targetSize.h - 40
    )
    p5.pop()

    drawBrain(p5)
  }

  const drawBrain = (p5: P5) => {
    const brainGraph = brainGraphRef.current
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
    p5.push()
    for (const edge of brainGraph.edges) {
      p5.strokeWeight(edge.weight + connectionWeightOffset)
      p5.stroke(120 + edge.weight * 40)
      for (const section of edge.sections) {
        p5.line(section.startPoint.x, section.startPoint.y, section.endPoint.x, section.endPoint.y)
      }
    }
    p5.pop()
    p5.strokeWeight(5)
    p5.rectMode(p5.CENTER)
    for (const child of brainGraph.children) {
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
    }
    p5.pop()
  }

  const drawTexts = (p5: P5) => {
    const game = gameRef.current
    if (!game) return
    p5.push()
    p5.textSize(48)
    p5.text(`SCORE ${game.score.toString().padStart(4, '0')}`, 40, 80)
    p5.textAlign(p5.CENTER)
    // Win/lose banners are only meaningful in play mode; the champion replay
    // just loops.
    if (isPlayMode && game.status === 'won') {
      p5.text('YOU WIN', targetSize.w / 2, targetSize.h / 2)
    }
    if (isPlayMode && game.status === 'lost') {
      p5.text('YOU LOSE', targetSize.w / 2, targetSize.h / 2)
    }
    p5.pop()
  }

  const resetFill = (p5: P5) => p5.fill(defaultFill)

  const updateScale = (): [number, number] => {
    const relativeWidth = getWidth() / targetSize.w
    const relativeHeight = getHeight() / targetSize.h
    const normalise = (n: number) => (n < 1 ? 1 - n : n - 1)
    const widthBigger = normalise(relativeWidth) > normalise(relativeHeight)
    const scale = widthBigger ? relativeWidth : relativeHeight
    scaleRef.current = scale
    if (widthBigger) return [getWidth(), targetSize.h * scale]
    return [targetSize.w * scale, getHeight()]
  }

  const setScale = (p5: P5) => p5.scale(scaleRef.current)

  const windowResized = (p5: P5) => {
    const [w, h] = updateScale()
    p5.resizeCanvas(w, h)
  }

  const keyPressed = (p5: P5) => {
    pressedKeysRef.current.push((p5 as P5WithKeyCode).keyCode)
  }

  const keyReleased = (p5: P5) => {
    const { keyCode } = p5 as P5WithKeyCode
    const index = pressedKeysRef.current.indexOf(keyCode)
    if (index > -1) pressedKeysRef.current.splice(index, 1)
    const ship = gameRef.current?.ship
    if (!ship) return
    switch (keyCode) {
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
