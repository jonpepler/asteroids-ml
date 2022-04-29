import { Neat, methods } from '@liquid-carrot/carrot'
import { getDefault } from '../defaults'
import { get, set } from '../storage'
import { isEmpty } from 'lodash'
import ELK from 'elkjs/lib/elk.bundled.js'

class Runner {
  constructor () {
    this.neat = new Neat(16, 4, { population_size: 200, elitism: 10 })
    this.storeKey = 'brain_data'
    this.elk = new ELK({
      workerUrl: './node_modules/elkjs/lib/elk-worker.min.js'
    })
  }

  async init () {
    const brainData = await get(this.storeKey)
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

  initialiseScore () {
    this.neat.population = this.neat.population.map(brain => {
      brain.score = 0
      return brain
    })
  }

  nextGeneration () {
    this.neat.sort()
    const newGeneration = []

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

  saveCurrentGeneration () {
    const generation = this.neat.toJSON()
    // add unsaved properties
    generation.forEach((g, i) => {
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

  nextBrain () {
    this.saveCurrentGeneration()
    const withinPop = this.currentPopIndex < this.neat.population.length - 1
    if (withinPop) this.currentPopIndex++
    return withinPop
  }

  getCurrentBrain () {
    if (this.currentPopIndex > this.neat.population.length) return {}
    return this.neat.population[this.currentPopIndex]
  }

  async getBrainGraph () {
    const brain = this.getCurrentBrain()
    if (isEmpty(brain)) return []

    const hiddenNodes = new Set(
      brain.nodes.filter(node => !brain.input_nodes.has(node) && !brain.output_nodes.has(node)))
    const nodeType = node => brain.input_nodes.has(node)
      ? 'input'
      : brain.output_nodes.has(node)
        ? 'output'
        : 'hidden'
    const nodeStr = i => `n${i}`
    const edgeStr = i => `e${i}`
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
      children: brain.nodes.map(n => ({ id: nodeStr(n.index), width: 1, height: 1, type: nodeType(n) })),
      edges: brain.connections.map((e, i) => ({ id: edgeStr(i), sources: [nodeStr(e.from.index)], targets: [nodeStr(e.to.index)], weight: e.weight }))
    }

    return await this.elk.layout(graph)
  }

  // this.neat.getAverage includes unscored brains
  getAverage () {
    return this.neat.population
      .slice(0, this.currentPopIndex)
      .reduce((acc, cur) => acc + (cur.score || 0) / (this.currentPopIndex + 1), 0)
      .toFixed(2)
  }

  getMaxScore () {
    return (this.neat.population
      .slice(0, this.currentPopIndex)
      .sort((a, b) => b.score - a.score)[0] ||
      { score: 0 })
      .score
  }

  getInfo () {
    const generation = this.neat.generation.toString().padStart(4, '0')
    const genome = this.currentPopIndex.toString().padStart(3, '0')
    const score = this.getCurrentBrain().score.toString().padStart(4, '0')
    const avg = this.getAverage()
    const max = this.getMaxScore()
    return `Generation ${generation}, Genome ${genome}, score ${score} (avg: ${avg}, max: ${max})`
  }

  getBrainOutput (input) {
    return this.mapOutputToKeys(this.getCurrentBrain().activate(input))
  }

  giveScore (score) {
    if (this.getCurrentBrain().score === undefined) this.getCurrentBrain().score = 0
    this.getCurrentBrain().score = this.getCurrentBrain().score + score
  }

  mapOutputToKeys (output) {
    const keyMap = getDefault('keyMap')
    const keys = [keyMap.shoot, keyMap.boost, keyMap.rotateLeft, keyMap.rotateRight]
    return output
      .map(o => Math.round(o))
      .map(b => Boolean(b))
      .map((b, i) => b ? keys[i] : false)
      .filter(k => k)
  }
}
export default Runner
