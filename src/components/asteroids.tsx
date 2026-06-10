import { Suspense, lazy, useEffect, useRef } from 'react'
import AstroFooter from '../components/asteroids/footer'
import type { GameSize } from '../components/asteroids/util/geometry'
import { Genome } from '../lib/neat'
import { get } from '../services/storage'
import { mapOutputToKeys } from '../services/train/controls'
import {
  BRAIN_NODE_SIZE,
  BRAIN_STORE_KEY,
  type BestRecord,
  type BrainGraph,
  type GenStat
} from '../services/train/runner'
import { Trainer } from '../services/train/trainer'
import type { P5, P5WithKeyCode } from '../types/p5'
import type AstroObject from './asteroids/astro-object'
import AstroBanner from './asteroids/banner'
import { describeNode } from './asteroids/brain-labels'
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
  const isWatchMode = props.mode === 'watch'
  const isTrainMode = !isPlayMode && !isWatchMode

  // Long-lived state lives in refs so it survives React re-renders.
  // In play mode `gameRef` is the player's game; in training it is the champion
  // replay, while `trainerRef` trains the population headlessly in the
  // background.
  const gameRef = useRef<GameInstance | null>(null)
  const trainerRef = useRef<Trainer | null>(null)
  const startedRef = useRef(false)
  const brainGraphRef = useRef<BrainGraph | [] | undefined>(undefined)
  // In watch mode the champion is loaded once from the saved best genome.
  const watchNetworkRef = useRef<Genome | null>(null)
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
    if (isWatchMode) {
      // Attract mode: replay the saved best genome, no training.
      get(BRAIN_STORE_KEY).then((data) => {
        const stored = data as { best?: BestRecord }
        if (stored?.best?.json) watchNetworkRef.current = Genome.fromJSON(stored.best.json)
      })
      startedRef.current = true
      return
    }
    if (isPlayMode) {
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
      // Seed the chart with any history restored from storage so a refresh
      // shows the existing curve instead of "waiting for first generation".
      if (trainer.history.length) onGenerationRef.current?.(trainer.history)
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
    } else if (isWatchMode) {
      const net = watchNetworkRef.current
      game.step(net ? mapOutputToKeys(net.activate(game.generateBrainInput()), keyMap) : [])
      if (game.status !== 'running') game.reset()
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

  // Base colour per node type, before the activation level brightens it.
  const nodeColour = (type?: string): [number, number, number] => {
    switch (type) {
      case 'input':
        return [255, 176, 64]
      case 'output':
        return [86, 222, 150]
      default:
        return [150, 170, 255]
    }
  }

  const drawBrain = (p5: P5) => {
    const brainGraph = brainGraphRef.current
    if (brainGraph === undefined || Array.isArray(brainGraph)) return
    /*
     * Live activation of every node this tick, so the diagram shows the champion
     * thinking rather than just its wiring. Inputs and outputs both sit in [0, 1].
     */
    const activations = trainerRef.current?.getChampionActivations() ?? new Map<number, number>()
    const nodeId = (id: string) => Number(id.slice(1))
    const intensity = (id: number) => {
      const value = activations.get(id)
      return value === undefined ? 0 : Math.min(1, Math.max(0, value))
    }

    /*
     * Lay the diagram out on a translucent panel pinned to the bottom-left,
     * scaled to fit however large the network grows. The layout already spaces
     * nodes by their real size, so this only needs to fit the whole thing.
     */
    const margin = 26
    const titleH = 28
    const pad = 16
    const scale = Math.min(
      0.3,
      (targetSize.w * 0.5) / (brainGraph.width || 1),
      (targetSize.h * 0.46) / (brainGraph.height || 1)
    )
    const diagramW = brainGraph.width * scale
    const diagramH = brainGraph.height * scale
    const panelW = diagramW + pad * 2
    const panelH = diagramH + pad * 2 + titleH
    const panelX = margin
    // Sit clear of the champion status line drawn at targetSize.h - 40.
    const panelY = targetSize.h - 60 - panelH
    const originX = panelX + pad
    const originY = panelY + titleH + pad

    // Cursor in game coordinates (the canvas is drawn under a global scale).
    const canvasScale = scaleRef.current || 1
    const mouseX = p5.mouseX / canvasScale
    const mouseY = p5.mouseY / canvasScale

    // Panel and title.
    p5.push()
    p5.noStroke()
    p5.fill(10, 12, 18, 205)
    p5.rectMode(p5.CORNER)
    p5.rect(panelX, panelY, panelW, panelH, 12)
    p5.fill(150, 160, 180)
    p5.textSize(14)
    p5.textAlign(p5.LEFT, p5.CENTER)
    p5.text('CHAMPION BRAIN', panelX + pad, panelY + titleH / 2 + 2)
    p5.pop()

    p5.push()
    p5.translate(originX, originY)
    p5.scale(scale)

    /*
     * Edges: thickness tracks the connection weight, hue tracks its sign
     * (teal excitatory, red inhibitory), and brightness tracks the live signal
     * leaving the source node so active pathways glow.
     */
    for (const edge of brainGraph.edges) {
      const signal = intensity(edge.sources?.[0] ? nodeId(edge.sources[0]) : -1)
      const alpha = 30 + signal * 205
      if (edge.weight >= 0) p5.stroke(70, 200, 180, alpha)
      else p5.stroke(235, 110, 95, alpha)
      p5.strokeWeight(0.8 + Math.min(Math.abs(edge.weight), 4) * 0.7)
      for (const section of edge.sections) {
        p5.line(section.startPoint.x, section.startPoint.y, section.endPoint.x, section.endPoint.y)
      }
    }

    /*
     * Nodes: a faint glow when firing, a filled disc tinted by type and
     * brightened by activation. Hit-test the cursor here (cheap, we are already
     * iterating) and remember the node under it for a tooltip drawn afterwards.
     */
    // Size each node by how many connections it carries, relative to the
    // busiest node, so heavily-wired neurons read as hubs. Capped at the layout
    // size so nodes never grow into each other.
    const maxDegree = brainGraph.children.reduce((m, c) => Math.max(m, c.connections), 0)

    let hovered: { id: number; connections: number } | null = null
    p5.ellipseMode(p5.CENTER)
    for (const child of brainGraph.children) {
      const id = nodeId(child.id)
      const level = intensity(id)
      const cx = child.x + child.width / 2
      const cy = child.y + child.height / 2
      const [r, g, b] = nodeColour(child.type)
      const connected = child.connections > 0
      const norm = maxDegree > 0 ? child.connections / maxDegree : 0
      const diameter = BRAIN_NODE_SIZE * (0.45 + 0.55 * norm)
      const nodeRadius = diameter / 2

      if (mouseX >= panelX && mouseY >= panelY) {
        const dx = mouseX - (originX + cx * scale)
        const dy = mouseY - (originY + cy * scale)
        if (dx * dx + dy * dy <= (nodeRadius * scale + 4) ** 2) {
          hovered = { id, connections: child.connections }
        }
      }

      if (connected && level > 0.05) {
        p5.noStroke()
        p5.fill(r, g, b, 40 + level * 90)
        p5.circle(cx, cy, diameter * (1.4 + level * 0.8))
      }
      const isHovered = id === hovered?.id
      p5.strokeWeight(isHovered ? 5 : 3)
      if (isHovered) p5.stroke(255)
      else p5.stroke(18, 20, 28)
      // Cut-off nodes are drawn as a dim grey husk; wired nodes keep their type
      // colour, brightened by activation.
      if (connected) {
        const dim = 0.4 + 0.6 * level
        p5.fill(r * dim, g * dim, b * dim)
      } else {
        p5.fill(64, 68, 78)
      }
      p5.circle(cx, cy, diameter)
    }
    p5.pop()

    if (hovered) {
      drawNodeTooltip(
        p5,
        hovered.id,
        activations.get(hovered.id),
        hovered.connections,
        mouseX,
        mouseY
      )
    }
  }

  // A small label near the cursor naming the hovered neuron and its live value.
  const drawNodeTooltip = (
    p5: P5,
    id: number,
    value: number | undefined,
    connections: number,
    x: number,
    y: number
  ) => {
    const { kind, name, detail } = describeNode(id)
    const boxW = 268
    const boxH = 96
    // Flip the box to whichever side keeps it on screen.
    const bx = x + boxW + 24 > targetSize.w ? x - boxW - 14 : x + 14
    const by = Math.min(y + 14, targetSize.h - boxH - 10)
    p5.push()
    p5.rectMode(p5.CORNER)
    p5.noStroke()
    p5.fill(8, 10, 16, 235)
    p5.rect(bx, by, boxW, boxH, 8)
    p5.fill(255)
    p5.textAlign(p5.LEFT, p5.TOP)
    p5.textSize(15)
    p5.text(name, bx + 12, by + 10)

    /*
     * Three decimals so tiny sigmoid outputs do not all read as 0.00. Outputs
     * only drive the ship once they cross the 0.5 action threshold (see
     * mapOutputToKeys), so flag whether this one is actually firing.
     */
    p5.textSize(12)
    p5.fill(255, 210, 90)
    const reading = value === undefined ? '--' : value.toFixed(3)
    const label = `activation ${reading}`
    p5.text(label, bx + 12, by + 30)
    if (kind === 'output' && value !== undefined) {
      const firing = value >= 0.5
      if (firing) p5.fill(96, 232, 152)
      else p5.fill(120, 130, 150)
      p5.text(firing ? 'firing' : 'idle', bx + 12 + p5.textWidth(label) + 12, by + 30)
    }

    p5.fill(150, 160, 180)
    const plural = connections === 1 ? 'connection' : 'connections'
    p5.text(
      connections === 0 ? 'no connections (cut off)' : `${connections} ${plural}`,
      bx + 12,
      by + 48
    )

    p5.fill(170, 180, 200)
    p5.text(detail, bx + 12, by + 66, boxW - 24, boxH - 70)
    p5.pop()
  }

  const drawTexts = (p5: P5) => {
    const game = gameRef.current
    if (!game) return
    p5.push()
    p5.textSize(48)
    p5.text(`SCORE ${game.score.toString().padStart(4, '0')}`, 40, 80)
    p5.textAlign(p5.CENTER)
    /*
     * The game is endless, so the only banner is the play-mode loss; the
     * champion replay just loops.
     */
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
      {!isWatchMode && <AstroBanner />}
      {!isWatchMode && <AstroOverlay />}
      <Suspense fallback={null}>
        <Sketch
          setup={setup}
          draw={draw}
          windowResized={windowResized}
          keyPressed={keyPressed}
          keyReleased={keyReleased}
        />
      </Suspense>
      {!isWatchMode && <AstroFooter />}
    </div>
  )
}

export default Asteroids
