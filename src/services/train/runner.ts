import { isEmpty } from 'lodash'
import { type Genome, type GenomeJSON, Neat } from '../../lib/neat'
import { getDefault } from '../defaults'
import { get, set } from '../storage'
import { mapOutputToKeys } from './controls'

interface BrainHead {
  generation: number
}

/* Compact per-generation summary, kept for the whole run so a fitness chart can
   show progress over time without storing every genome of every generation. */
export interface GenStat {
  gen: number
  best: number
  avg: number
  min: number
  /* Number of active species at the end of this generation. Optional so that
     older saved histories (pre-species tracking) remain valid. */
  species?: number
}

export interface BestRecord {
  json: GenomeJSON
  gen: number
  score: number
}

interface StoredBrain {
  head: BrainHead
  currentGeneration?: GenomeJSON[]
  best?: BestRecord
  history?: GenStat[]
}

export interface BrainGraphNode {
  // ELK node id, of the form `n${nodeId}`, used to look up the node's activation.
  id: string
  x: number
  y: number
  width: number
  height: number
  type?: 'input' | 'output' | 'hidden'
  // Number of enabled connections touching this node (in + out). Drives the
  // node's drawn size, and flags isolated nodes the network no longer uses.
  connections: number
}

export interface BrainGraphEdgeSection {
  startPoint: { x: number; y: number }
  endPoint: { x: number; y: number }
}

export interface BrainGraphEdge {
  weight: number
  // Source node ids (`n${nodeId}`); the first drives the edge's live brightness.
  sources?: string[]
  sections: BrainGraphEdgeSection[]
}

export interface BrainGraph {
  width: number
  height: number
  children: BrainGraphNode[]
  edges: BrainGraphEdge[]
}

/*
 * 16 vision whiskers x 2 channels (distance + closing rate) = 32, plus one
 * ammo-available reading appended at the end. See GameInstance.generateBrainInput.
 */
const inputs = 33
const outputs = 4
const populationSize = 200

/* Side length (diagram units) each neuron occupies in the layout. The renderer
   draws nodes to match, and the radial layout uses this as the base unit for
   computing ring radii so nodes never overlap. */
export const BRAIN_NODE_SIZE = 46

/*
 * The IndexedDB key the run is persisted under. Shared so the trainer, the
 * champion replay (watch mode) and the data screen all read the same record.
 * Bumped to v4 because the input layout grew to include the ammo sensor (33
 * inputs total); v3 genomes have the wrong input count and must not be loaded.
 */
export const BRAIN_STORE_KEY = 'brain_data_v4'

// Owns the NEAT population and the run's recorded history. The heavy lifting
// (mutation, crossover, speciation, elitism) lives in the `neat` package; this
// class just wires it to persistence, stats and the brain diagram.
class Runner {
  neat: Neat
  storeKey = BRAIN_STORE_KEY
  history: GenStat[] = []
  best?: BestRecord
  private lastSaveAt = 0
  /* Persisting the whole current generation is expensive, so throttle it during
     fast headless training; generation boundaries force a save (see Trainer). */
  saveIntervalMs = 1500

  constructor() {
    this.neat = new Neat({ inputs, outputs, populationSize })
  }

  async init() {
    const stored = (await get(this.storeKey)) as StoredBrain | undefined
    if (stored?.currentGeneration?.length) {
      this.neat.loadPopulation(stored.currentGeneration, stored.head.generation)
      this.history = stored.history ?? []
      this.best = stored.best
    }
  }

  recordGenerationStats() {
    const scores = this.neat.population.map((genome) => genome.score ?? 0)
    const best = Math.max(...scores)
    const min = Math.min(...scores)
    const avg = scores.reduce((acc, score) => acc + score, 0) / scores.length
    this.history.push({
      gen: this.neat.generation,
      best,
      avg,
      min,
      species: this.neat.species.length
    })

    if (!this.best || best > this.best.score) {
      const bestGenome = this.neat.population[scores.indexOf(best)]
      this.best = { json: bestGenome.toJSON(), gen: this.neat.generation, score: best }
    }
  }

  nextGeneration() {
    // Snapshot the completed generation, then let the engine evolve it. Elitism
    // and champion preservation are handled inside neat.evolve(), so progress
    // can no longer go backwards the way it did with the hand-rolled loop.
    this.recordGenerationStats()
    this.neat.evolve()
  }

  saveCurrentGeneration(force = false) {
    const now = performance.now()
    if (!force && now - this.lastSaveAt < this.saveIntervalMs) return
    this.lastSaveAt = now

    // Store only the current generation plus a compact history and the best
    // genome, rather than every generation ever (which grew without bound).
    set(this.storeKey, {
      head: { generation: this.neat.generation },
      currentGeneration: this.neat.population.map((genome) => genome.toJSON()),
      best: this.best,
      history: this.history
    } satisfies StoredBrain)
  }

  getBrainGraph(): Promise<BrainGraph | []> {
    return this.buildGraph(this.neat.best())
  }

  async buildGraph(brain: Genome): Promise<BrainGraph | []> {
    if (!brain || isEmpty(brain.nodes)) return []

    const size = BRAIN_NODE_SIZE
    const WHISKERS = 16

    /* Count enabled connections per node (in + out). Drives the node's drawn
       size and flags isolated nodes the network no longer uses. */
    const degree = new Map<number, number>()
    for (const c of brain.connections) {
      if (!c.enabled) continue
      degree.set(c.from, (degree.get(c.from) ?? 0) + 1)
      degree.set(c.to, (degree.get(c.to) ?? 0) + 1)
    }

    /* Radii are tuned so 16 nodes fit each ring without touching.
       distanceRadius is the outermost ring (long-range whiskers).
       closingRadius nests inside it (closing-rate whiskers).
       hiddenRadius and outputRadius are the two innermost rings.
       stagger offsets the closing-rate ring by half a spoke (11.25 deg)
       so each closing-rate node sits between its two distance neighbours. */
    const distanceRadius = 4.2 * size
    const closingRadius = 2.7 * size
    const hiddenRadius = 1.7 * size
    const outputRadius = 0.85 * size
    const stagger = 11.25

    /* 0 degrees = straight up, increasing clockwise. This matches compass
       bearings, which is how the whisker angles are defined in the game. */
    const onCircle = (deg: number, radius: number): { x: number; y: number } => {
      const a = (deg * Math.PI) / 180
      return { x: Math.sin(a) * radius, y: -Math.cos(a) * radius }
    }

    /* Whisker bearing: long-range sensors (ids 0-7) every 45 deg from 0;
       short-range sensors (ids 8-15) every 45 deg offset by 22.5. */
    const whiskerBearing = (w: number): number => (w < 8 ? 45 * w : 22.5 + 45 * (w - 8))

    const outputIds = brain.nodes.filter((n) => n.type === 'output').map((n) => n.id)
    const hiddenIds = brain.nodes.filter((n) => n.type === 'hidden').map((n) => n.id)

    /* Ammo sensor sits just above the distance ring, centred horizontally. */
    const ammoCenter = { x: 0, y: -(distanceRadius + 2 * size) }

    const centerOf = (n: { id: number; type?: string }): { x: number; y: number } => {
      if (n.type === 'input') {
        if (n.id < WHISKERS) return onCircle(whiskerBearing(n.id), distanceRadius)
        if (n.id < WHISKERS * 2)
          return onCircle(whiskerBearing(n.id - WHISKERS) + stagger, closingRadius)
        return ammoCenter
      }
      if (n.type === 'output') {
        const i = outputIds.indexOf(n.id)
        return onCircle((360 / Math.max(1, outputIds.length)) * i, outputRadius)
      }
      const i = hiddenIds.indexOf(n.id)
      return onCircle((360 / Math.max(1, hiddenIds.length)) * i + 15, hiddenRadius)
    }

    const centers = new Map<number, { x: number; y: number }>()
    for (const n of brain.nodes) centers.set(n.id, centerOf(n))

    /* Normalise so the top-left of the bounding box (including node size) is (0,0). */
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const c of centers.values()) {
      minX = Math.min(minX, c.x - size / 2)
      minY = Math.min(minY, c.y - size / 2)
      maxX = Math.max(maxX, c.x + size / 2)
      maxY = Math.max(maxY, c.y + size / 2)
    }
    const shift = (c: { x: number; y: number }): { x: number; y: number } => ({
      x: c.x - minX,
      y: c.y - minY
    })

    const children: BrainGraphNode[] = brain.nodes.map((n) => {
      const c = shift(centers.get(n.id) as { x: number; y: number })
      return {
        id: `n${n.id}`,
        x: c.x - size / 2,
        y: c.y - size / 2,
        width: size,
        height: size,
        type: n.type as BrainGraphNode['type'],
        connections: degree.get(n.id) ?? 0
      }
    })

    const edges: BrainGraphEdge[] = brain.connections
      .filter((c) => c.enabled)
      .map((e) => {
        const from = shift(centers.get(e.from) as { x: number; y: number })
        const to = shift(centers.get(e.to) as { x: number; y: number })
        return {
          weight: e.weight,
          sources: [`n${e.from}`],
          sections: [{ startPoint: from, endPoint: to }]
        }
      })

    return { width: maxX - minX, height: maxY - minY, children, edges }
  }

  mapOutputToKeys(output: number[]): number[] {
    return mapOutputToKeys(output, getDefault('keyMap'))
  }
}

export default Runner
