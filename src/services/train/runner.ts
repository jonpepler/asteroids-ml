import { Neat, type Network, type NetworkJSON } from '@liquid-carrot/carrot'
import ELK, { type ELK as ElkInstance, type ElkNode } from 'elkjs/lib/elk.bundled.js'
import { isEmpty } from 'lodash'
import { getDefault } from '../defaults'
import { get, set } from '../storage'

interface BrainHead {
  generation: number
  genome: number
}

interface StoredBrain {
  data: NetworkJSON[][]
  head: BrainHead
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

class Runner {
  neat: Neat
  storeKey = 'brain_data'
  elk: ElkInstance
  currentPopIndex = 0
  generations: NetworkJSON[][] = []

  constructor() {
    this.neat = new Neat(16, 4, { population_size: 200, elitism: 10 })
    // Run ELK in-thread. The old workerUrl pointed at a node_modules path that
    // only existed under the Gatsby dev server, not in a bundled build.
    this.elk = new ELK()
  }

  async init() {
    const brainData = (await get(this.storeKey)) as StoredBrain | ''
    if (brainData) {
      this.generations = brainData.data
      const gen = brainData.head.generation
      this.neat.fromJSON(brainData.data[gen])
      this.neat.generation = gen
      this.neat.population.forEach((_, i) => {
        this.neat.population[i].score = this.generations[gen][i].score
      })
      this.currentPopIndex = brainData.head.genome
    } else {
      this.currentPopIndex = 0
      this.initialiseScore()
      this.generations = []
    }
  }

  initialiseScore() {
    this.neat.population = this.neat.population.map((brain) => {
      brain.score = 0
      return brain
    })
  }

  nextGeneration() {
    this.neat.sort()
    const newGeneration: Network[] = []

    // get the best from the last generation
    newGeneration.push(...this.neat.population.slice(0, this.neat.elitism))

    // fill out the population with new offspring
    Array.from({ length: this.neat.population_size - this.neat.elitism }, () => {
      newGeneration.push(this.neat.getOffspring())
    })
    this.neat.population = newGeneration

    // mutate the population randomly
    this.neat.mutate()

    this.initialiseScore()

    this.neat.generation++
    this.currentPopIndex = 0
  }

  saveCurrentGeneration() {
    const generation = this.neat.toJSON()
    // add unsaved properties
    generation.forEach((_g, i) => {
      generation[i].score = this.neat.population[i].score
    })

    this.generations[this.neat.generation] = generation
    set(this.storeKey, {
      data: this.generations,
      head: {
        generation: this.neat.generation,
        genome: this.currentPopIndex
      }
    })
  }

  nextBrain() {
    this.saveCurrentGeneration()
    const withinPop = this.currentPopIndex < this.neat.population.length - 1
    if (withinPop) this.currentPopIndex++
    return withinPop
  }

  getCurrentBrain(): Network {
    if (this.currentPopIndex > this.neat.population.length) return {} as Network
    return this.neat.population[this.currentPopIndex]
  }

  async getBrainGraph(): Promise<BrainGraph | []> {
    const brain = this.getCurrentBrain()
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
    const score = (this.getCurrentBrain().score ?? 0).toString().padStart(4, '0')
    const avg = this.getAverage()
    const max = this.getMaxScore()
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
    const keyMap = getDefault('keyMap')
    const keys = [keyMap.shoot, keyMap.boost, keyMap.rotateLeft, keyMap.rotateRight]
    return output
      .map((o) => Math.round(o))
      .map((b) => Boolean(b))
      .map((b, i) => (b ? keys[i] : false))
      .filter((k): k is number => k !== false)
  }
}

export default Runner
