import { Genome } from './genome'
import { InnovationTracker } from './innovation'
import { Rng, randomSeed } from './rng'
import { Species } from './species'
import type { GenomeJSON, NeatConfig, RequiredConfig } from './types'

// Defaults tuned for the small, stateless control task this package was built
// for. They mirror the original NEAT paper's spirit but lean towards quicker,
// cleaner feed-forward topologies.
export const defaultConfig: Omit<NeatConfig, 'inputs' | 'outputs'> = {
  populationSize: 200,
  addConnectionRate: 0.05,
  addNodeRate: 0.03,
  weightMutationRate: 0.8,
  biasMutationRate: 0.7,
  weightPerturbChance: 0.9,
  weightStep: 0.5,
  weightRange: 1,
  excessCoeff: 1,
  disjointCoeff: 1,
  weightCoeff: 0.4,
  compatibilityThreshold: 3,
  crossoverRate: 0.75,
  survivalThreshold: 0.3,
  speciesElitismMin: 5,
  stagnationLimit: 15,
  preserveChampion: true
}

export interface NeatJSON {
  generation: number
  population: GenomeJSON[]
}

// The evolution engine: owns a population of genomes, the historical-marking
// tracker, and the seeded RNG, and turns one scored generation into the next.
export class Neat {
  config: NeatConfig
  population: Genome[]
  species: Species[] = []
  generation = 0
  private rng: Rng
  private tracker: InnovationTracker

  constructor(options: RequiredConfig) {
    const seed = options.seed ?? randomSeed()
    this.config = { ...defaultConfig, ...options, seed }
    this.rng = new Rng(seed)
    this.tracker = new InnovationTracker(0, this.config.inputs + this.config.outputs)
    this.population = Array.from({ length: this.config.populationSize }, () =>
      Genome.minimal(this.rng, this.tracker, this.config)
    )
  }

  // The single best genome of the current (scored) population.
  best(): Genome {
    return this.population.reduce(
      (best, g) => (g.score > best.score ? g : best),
      this.population[0]
    )
  }

  // Advance one generation. Assumes every genome's `score` has been set.
  evolve(): void {
    this.speciate()
    this.updateStagnation()
    this.cullStagnant()
    const next = this.reproduce()
    for (const genome of next) genome.score = 0
    this.population = next
    this.generation++
    this.prepareRepresentatives()
  }

  // Assign each genome to the first species it is compatible with, creating a
  // new species when none fits.
  private speciate(): void {
    for (const species of this.species) species.members = []
    for (const genome of this.population) {
      const home = this.species.find(
        (s) => genome.distance(s.representative, this.config) < this.config.compatibilityThreshold
      )
      if (home) home.members.push(genome)
      else this.species.push(new Species(genome))
    }
    // Drop any species that attracted no members this round.
    this.species = this.species.filter((s) => s.members.length > 0)
    for (const s of this.species) {
      if (!s.members.includes(s.representative)) s.representative = s.members[0]
    }
  }

  private updateStagnation(): void {
    for (const s of this.species) {
      const best = s.members.reduce((m, g) => Math.max(m, g.score), Number.NEGATIVE_INFINITY)
      if (best > s.bestScore) {
        s.bestScore = best
        s.staleness = 0
      } else {
        s.staleness++
      }
    }
  }

  // Retire species that have not improved for too long, but never empty the
  // pool: the strongest species is always kept.
  private cullStagnant(): void {
    if (this.species.length <= 1) return
    const ranked = [...this.species].sort((a, b) => b.bestScore - a.bestScore)
    const survivors = ranked.filter((s, i) => i === 0 || s.staleness < this.config.stagnationLimit)
    this.species = survivors
  }

  private reproduce(): Genome[] {
    const next: Genome[] = []
    if (this.config.preserveChampion) next.push(this.best().clone())

    const totalAdjusted = this.species.reduce((sum, s) => sum + s.adjustedFitnessSum(), 0)
    const slots = this.config.populationSize - next.length

    for (const species of this.species) {
      const share =
        totalAdjusted > 0 ? species.adjustedFitnessSum() / totalAdjusted : 1 / this.species.length
      let allocation = Math.round(share * slots)
      const ranked = [...species.members].sort((a, b) => b.score - a.score)

      // Large enough species copy their champion across unchanged.
      if (ranked.length >= this.config.speciesElitismMin && allocation > 0) {
        next.push(ranked[0].clone())
        allocation--
      }

      const cutoff = Math.max(1, Math.floor(ranked.length * this.config.survivalThreshold))
      const parents = ranked.slice(0, cutoff)
      for (let i = 0; i < allocation; i++) next.push(this.breed(parents))
    }

    // Rounding can leave us a little short or long; top up from the champion and
    // trim any overflow so the population size is exactly as configured.
    while (next.length < this.config.populationSize) {
      const child = this.best().clone()
      child.mutate(this.rng, this.tracker, this.config)
      next.push(child)
    }
    next.length = this.config.populationSize
    return next
  }

  private breed(parents: Genome[]): Genome {
    if (parents.length > 1 && this.rng.bool(this.config.crossoverRate)) {
      const a = this.rng.pick(parents)
      const b = this.rng.pick(parents)
      const [fitter, other] = a.score >= b.score ? [a, b] : [b, a]
      const child = Genome.crossover(fitter, other, this.rng)
      child.mutate(this.rng, this.tracker, this.config)
      return child
    }
    const child = this.rng.pick(parents).clone()
    child.mutate(this.rng, this.tracker, this.config)
    return child
  }

  // Carry each species into the next round, represented by one of its current
  // members chosen at random (the standard NEAT scheme).
  private prepareRepresentatives(): void {
    for (const s of this.species) {
      s.representative = this.rng.pick(s.members)
      s.members = []
    }
  }

  toJSON(): NeatJSON {
    return { generation: this.generation, population: this.population.map((g) => g.toJSON()) }
  }

  // Rebuild a population from saved genomes. The innovation tracker is restarted
  // beyond the largest id and innovation seen, so future mutations never collide
  // with loaded structure.
  loadPopulation(genomes: GenomeJSON[], generation: number): void {
    this.population = genomes.map((g) => Genome.fromJSON(g))
    this.generation = generation
    this.species = []
    let maxNode = this.config.inputs + this.config.outputs - 1
    let maxInnovation = 0
    for (const g of genomes) {
      for (const n of g.nodes) maxNode = Math.max(maxNode, n.id)
      for (const c of g.connections) maxInnovation = Math.max(maxInnovation, c.innovation)
    }
    this.tracker = InnovationTracker.fromGenomeBounds(maxNode, maxInnovation)
  }
}
