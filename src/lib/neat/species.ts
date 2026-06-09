import type { Genome } from './genome'

// A species groups structurally similar genomes so they compete mainly among
// themselves. This protects a promising-but-young topology from being wiped out
// by an already-optimised rival before it has had time to mature, which is the
// whole point of speciation in NEAT.
export class Species {
  representative: Genome
  members: Genome[] = []
  // Best score this species has ever reached, and how many generations it has
  // gone without beating it. Used to retire species that have stopped improving.
  bestScore = Number.NEGATIVE_INFINITY
  staleness = 0

  constructor(representative: Genome) {
    this.representative = representative
  }

  get champion(): Genome {
    return this.members.reduce((best, g) => (g.score > best.score ? g : best), this.members[0])
  }

  // Sum of each member's fitness shared across the species. Explicit sharing
  // (dividing by member count) stops a single large species from dominating
  // reproduction.
  adjustedFitnessSum(): number {
    if (!this.members.length) return 0
    return this.members.reduce((sum, g) => sum + g.score, 0) / this.members.length
  }
}
