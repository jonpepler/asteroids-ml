import { Neat } from '@liquid-carrot/carrot'
import { getDefault } from '../defaults'
import { cloneDeep } from 'lodash'

class Runner {
  constructor () {
    this.neat = new Neat(16, 4, { population_size: 200, elitism: 50 })
    this.currentPopIndex = 0
    this.initialiseScore()
    this.generations = []
  }

  initialiseScore () {
    this.neat.population = this.neat.population.map(brain => {
      brain.score = 0
      return brain
    })
  }

  nextGeneration () {
    this.saveCurrentGeneration()

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
    this.neat.population = this.neat.population.map(genome => genome.mutateRandom())

    this.initialiseScore()

    this.neat.generation++
    this.currentPopIndex = 0
  }

  saveCurrentGeneration () {
    this.generations.push(cloneDeep(this.neat.population))
  }

  nextBrain () {
    this.currentPopIndex++
    return this.currentPopIndex < this.neat.population.length
  }

  getCurrentBrain () {
    if (this.currentPopIndex > this.neat.population.length) return {}
    return this.neat.population[this.currentPopIndex]
  }

  getInfo () {
    const generation = this.neat.generation.toString().padStart(4, '0')
    const genome = this.currentPopIndex.toString().padStart(3, '0')
    const score = this.getCurrentBrain().score.toString().padStart(4, '0')
    return `Generation ${generation}, Genome ${genome}, score ${score}`
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
