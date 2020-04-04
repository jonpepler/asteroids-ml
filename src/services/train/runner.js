import { Neat } from '@liquid-carrot/carrot'
import { getDefault } from '../defaults'
import { get, set } from '../storage'

class Runner {
  constructor () {
    this.neat = new Neat(16, 4, { population_size: 200, elitism: 50 })
    this.storeKey = 'brain_data'
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

  // this.neat.getAverage includes unscored brains
  getAverage () {
    return this.neat.population
      .slice(0, this.currentPopIndex)
      .reduce((acc, cur) => acc + cur.score / (this.currentPopIndex + 1), 0)
      .toFixed(2)
  }

  getMaxScore () {
    return this.neat.population
      .slice(0, this.currentPopIndex)
      .sort((a, b) => b.score - a.score)[0]
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
