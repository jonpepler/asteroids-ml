import { Neat, type Network, type NetworkJSON, methods } from '@liquid-carrot/carrot'
import ELK, { type ELK as ElkInstance, type ElkNode } from 'elkjs/lib/elk.bundled.js'
import { isEmpty } from 'lodash'
import { getDefault } from '../defaults'
import { get, set } from '../storage'
import { mapOutputToKeys } from './controls'

interface BrainHead {
  generation: number
  genome: number
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
  json: NetworkJSON
  gen: number
  score: number
}

interface StoredBrain {
  head: BrainHead
  currentGeneration?: NetworkJSON[]
  best?: BestRecord
  history?: GenStat[]
  // legacy field from the pre-Vite format (the entire generations array)
  data?: NetworkJSON[][]
}

export interface BrainGraphNode {
  x: number
  y: number
  type?: 'input' | 'output' | 'hidden'
}

export interface BrainGraphEdgeSection {
  startPoint: { x: number; y: number }
  endPoint: { x: number; y: number }
}

export interface BrainGraphEdge {
  weight: number
  sections: BrainGraphEdgeSection[]
}

export interface BrainGraph {
  height: number
  children: BrainGraphNode[]
  edges: BrainGraphEdge[]
}

const populationSize = 200
const elitism = 25

class Runner {
  neat: Neat
  storeKey = 'brain_data'
  elk: ElkInstance
  currentPopIndex = 0
  history: GenStat[] = []
  best?: BestRecord
  private lastSaveAt = 0
  // Persisting the whole current generation is expensive, so throttle it during
  // fast headless training; generation boundaries force a save (see Trainer).
  saveIntervalMs = 1500

  constructor() {
    this.neat = new Neat(16, 4, {
      population_size: populationSize,
      elitism,
      // Feed-forward-only mutations. The default (ALL) adds recurrent and gated
      // connections that are useless for this stateless whisker-reactive task
      // and only bloat the search; FFW grows clean feed-forward topology.
      mutation: methods.mutation.FFW
    })
    // Run ELK in-thread. The old workerUrl pointed at a node_modules path that
    // only existed under the Gatsby dev server, not in a bundled build.
    this.elk = new ELK()
  }

  async init() {
    const brainData = (await get(this.storeKey)) as StoredBrain | ''
    // Accept the new compact format and the legacy { data: NetworkJSON[][] } one.
    const currentGeneration =
      brainData && (brainData.currentGeneration ?? brainData.data?.[brainData.head.generation])
    if (brainData && currentGeneration) {
      const gen = brainData.head.generation
      this.neat.fromJSON(currentGeneration)
      this.neat.generation = gen
      this.neat.population.forEach((_, i) => {
        this.neat.population[i].score = currentGeneration[i].score
      })
      this.currentPopIndex = brainData.head.genome
      this.history = brainData.history ?? []
      this.best = brainData.best
    } else {
      this.currentPopIndex = 0
      this.initialiseScore()
    }
  }

  initialiseScore() {
    this.neat.population = this.neat.population.map((brain) => {
      brain.score = 0
      return brain
    })
  }

  recordGenerationStats() {
    const scores = this.neat.population.map((brain) => brain.score ?? 0)
    const best = Math.max(...scores)
    const min = Math.min(...scores)
    const avg = scores.reduce((acc, score) => acc + score, 0) / scores.length
    this.history.push({ gen: this.neat.generation, best, avg, min })

    if (!this.best || best > this.best.score) {
      const bestBrain = this.neat.population[scores.indexOf(best)]
      this.best = { json: bestBrain.toJSON(), gen: this.neat.generation, score: best }
    }
  }

  nextGeneration() {
    // Snapshot the completed generation before we rebuild the population.
    this.recordGenerationStats()
    this.neat.sort()

    // Keep the best genomes from the last generation, unchanged.
    const elites = this.neat.population.slice(0, this.neat.elitism)

    // Build offspring from the (sorted) previous population.
    const offspring: Network[] = []
    for (let i = 0; i < this.neat.population_size - this.neat.elitism; i++) {
      offspring.push(this.neat.getOffspring())
    }

    // Mutate ONLY the offspring; the elites must survive intact, otherwise the
    // champion can be corrupted each generation and progress is non-monotonic.
    this.neat.population = offspring
    this.neat.mutate()
    this.neat.population = [...elites, ...offspring]

    this.initialiseScore()

    this.neat.generation++
    this.currentPopIndex = 0
  }

  saveCurrentGeneration(force = false) {
    const now = performance.now()
    if (!force && now - this.lastSaveAt < this.saveIntervalMs) return
    this.lastSaveAt = now
    const generation = this.neat.toJSON()
    // toJSON drops the live score, so copy it back on.
    generation.forEach((_g, i) => {
      generation[i].score = this.neat.population[i].score
    })

    // Store only the current generation plus a compact history and the best
    // genome, rather than every generation ever (which grew without bound).
    set(this.storeKey, {
      head: {
        generation: this.neat.generation,
        genome: this.currentPopIndex
      },
      currentGeneration: generation,
      best: this.best,
      history: this.history
    } satisfies StoredBrain)
  }

  nextBrain() {
    this.saveCurrentGeneration()
    const withinPop = this.currentPopIndex < this.neat.population.length - 1
    if (withinPop) this.currentPopIndex++
    return withinPop
  }

  getCurrentBrain(): Network {
    if (this.currentPopIndex >= this.neat.population.length) return {} as Network
    return this.neat.population[this.currentPopIndex]
  }

  getBrainGraph(): Promise<BrainGraph | []> {
    return this.buildGraph(this.getCurrentBrain())
  }

  async buildGraph(brain: Network): Promise<BrainGraph | []> {
    if (isEmpty(brain)) return []

    const nodeType = (node: { index: number }) =>
      brain.input_nodes.has(node) ? 'input' : brain.output_nodes.has(node) ? 'output' : 'hidden'
    const nodeStr = (i: number) => `n${i}`
    const edgeStr = (i: number) => `e${i}`
    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.padding': '[top=0,left=0,bottom=0,right=0]',
        'elk.spacing.componentComponent': 25,
        'elk.layered.spacing.nodeNodeBetweenLayers': 25,
        'elk.edgeLabels.inline': true,
        'elk.edgeRouting': 'SPLINES'
      },
      children: brain.nodes.map((n) => ({
        id: nodeStr(n.index),
        width: 1,
        height: 1,
        type: nodeType(n)
      })),
      edges: brain.connections.map((e, i) => ({
        id: edgeStr(i),
        sources: [nodeStr(e.from.index)],
        targets: [nodeStr(e.to.index)],
        weight: e.weight
      }))
    }

    return (await this.elk.layout(graph as unknown as ElkNode)) as unknown as BrainGraph
  }

  // this.neat.getAverage includes unscored brains
  getAverage() {
    return this.neat.population
      .slice(0, this.currentPopIndex)
      .reduce((acc, cur) => acc + (cur.score || 0) / (this.currentPopIndex + 1), 0)
      .toFixed(2)
  }

  getMaxScore() {
    return (
      this.neat.population
        .slice(0, this.currentPopIndex)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] || { score: 0 }
    ).score
  }

  getInfo() {
    const generation = this.neat.generation.toString().padStart(4, '0')
    const genome = this.currentPopIndex.toString().padStart(3, '0')
    const score = Math.round(this.getCurrentBrain().score ?? 0)
      .toString()
      .padStart(4, '0')
    const avg = this.getAverage()
    const max = Math.round(this.getMaxScore() ?? 0)
    return `Generation ${generation}, Genome ${genome}, score ${score} (avg: ${avg}, max: ${max})`
  }

  getBrainOutput(input: number[]) {
    return this.mapOutputToKeys(this.getCurrentBrain().activate(input))
  }

  giveScore(score: number) {
    const brain = this.getCurrentBrain()
    brain.score = (brain.score ?? 0) + score
  }

  mapOutputToKeys(output: number[]): number[] {
    return mapOutputToKeys(output, getDefault('keyMap'))
  }
}

export default Runner
