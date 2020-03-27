import { Neat, methods } from '@liquid-carrot/carrot'
import { getDefault } from '../defaults'

class Runner {
  constructor () {
    this.neat = new Neat(16, 4)
    this.currentPopIndex = 0
  }

  nextGeneration () {
    this.neat.sort()
    const newGeneration = []

    // get the best from the last generation
    newGeneration.push(...this.neat.population.slice(0, this.neat.elitism - 1))

    // make new offspring
    Array.from({ length: this.neat.population_size - this.neat.elitism }, () => {
      newGeneration.push(this.neat.getOffspring())
    })

    this.neat.population = newGeneration

    // mutate the population randomly
    this.neat.population = this.neat.population.map(genome =>
      genome.mutate(methods.mutation.FFW[Math.floor(Math.random() * methods.mutation.FFW.length)])
    )

    this.neat.generation++
    this.currentPopIndex = 0
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
    return `Generation ${this.neat.generation}, Genome ${this.currentPopIndex}, score ${this.getCurrentBrain().score}`
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
