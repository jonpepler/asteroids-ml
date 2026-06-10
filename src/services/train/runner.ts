import ELK, { type ELK as ElkInstance, type ElkNode } from 'elkjs/lib/elk.bundled.js'
import { isEmpty } from 'lodash'
import { type Genome, type GenomeJSON, Neat } from '../../lib/neat'
import { getDefault } from '../defaults'
import { get, set } from '../storage'
import { mapOutputToKeys } from './controls'

interface BrainHead {
  generation: number
}

// Compact per-generation summary, kept for the whole run so a fitness chart can
// show progress over time without storing every genome of every generation.
export interface GenStat {
  gen: number
  best: number
  avg: number
  min: number
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

const inputs = 16
const outputs = 4
const populationSize = 200

// Side length (diagram units) each neuron occupies in the layout. The renderer
// draws nodes to match, so the ELK spacing reflects what is actually on screen.
export const BRAIN_NODE_SIZE = 46

// The IndexedDB key the run is persisted under. Shared so the trainer, the
// champion replay (watch mode) and the data screen all read the same record.
// Bumped from the carrot-era 'brain_data': those genomes cannot run on this
// engine, so they are left untouched and a fresh run starts under a new key.
export const BRAIN_STORE_KEY = 'brain_data_v2'

// Owns the NEAT population and the run's recorded history. The heavy lifting
// (mutation, crossover, speciation, elitism) lives in the `neat` package; this
// class just wires it to persistence, stats and the brain diagram.
class Runner {
  neat: Neat
  storeKey = BRAIN_STORE_KEY
  elk: ElkInstance
  history: GenStat[] = []
  best?: BestRecord
  private lastSaveAt = 0
  // Persisting the whole current generation is expensive, so throttle it during
  // fast headless training; generation boundaries force a save (see Trainer).
  saveIntervalMs = 1500

  constructor() {
    this.neat = new Neat({ inputs, outputs, populationSize })
    // Run ELK in-thread for the brain-diagram layout.
    this.elk = new ELK()
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
    this.history.push({ gen: this.neat.generation, best, avg, min })

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

    const nodeStr = (id: number) => `n${id}`
    const edgeStr = (i: number) => `e${i}`

    // Count enabled connections per node (both directions) so the renderer can
    // size nodes by how wired-in they are and dim ones that are cut off.
    const degree = new Map<number, number>()
    for (const c of brain.connections) {
      if (!c.enabled) continue
      degree.set(c.from, (degree.get(c.from) ?? 0) + 1)
      degree.set(c.to, (degree.get(c.to) ?? 0) + 1)
    }

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.padding': '[top=8,left=8,bottom=8,right=8]',
        // Lay the nodes out at the size they are actually drawn, with generous
        // gaps, so they no longer pile on top of each other. (They were sized at
        // 1px here but rendered far larger, which is why the diagram bunched up.)
        'elk.spacing.componentComponent': '40',
        'elk.spacing.nodeNode': '26',
        'elk.layered.spacing.nodeNodeBetweenLayers': '110',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        // Keep the inputs/outputs in their natural id order top-to-bottom.
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        'elk.edgeRouting': 'SPLINES'
      },
      children: brain.nodes.map((n) => ({
        id: nodeStr(n.id),
        width: BRAIN_NODE_SIZE,
        height: BRAIN_NODE_SIZE,
        type: n.type,
        connections: degree.get(n.id) ?? 0
      })),
      edges: brain.connections
        .filter((c) => c.enabled)
        .map((e, i) => ({
          id: edgeStr(i),
          sources: [nodeStr(e.from)],
          targets: [nodeStr(e.to)],
          weight: e.weight
        }))
    }

    return (await this.elk.layout(graph as unknown as ElkNode)) as unknown as BrainGraph
  }

  mapOutputToKeys(output: number[]): number[] {
    return mapOutputToKeys(output, getDefault('keyMap'))
  }
}

export default Runner
