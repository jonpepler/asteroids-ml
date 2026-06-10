// Shared types for the NEAT package. Nothing here imports from the host app, so
// the whole `neat` folder can be lifted into a standalone package unchanged.

export type NodeType = 'input' | 'hidden' | 'output'

export interface NodeGene {
  id: number
  type: NodeType
  bias: number
}

export interface ConnectionGene {
  innovation: number
  from: number
  to: number
  weight: number
  enabled: boolean
}

export interface GenomeJSON {
  nodes: NodeGene[]
  connections: ConnectionGene[]
  score?: number
}

// Tunables for the algorithm. Sensible defaults live in `defaultConfig`, so a
// caller only has to supply `inputs` and `outputs`.
export interface NeatConfig {
  inputs: number
  outputs: number
  populationSize: number
  // Optional fixed seed for fully reproducible runs. Omit for a random run.
  seed?: number

  // Structural and weight mutation probabilities (per genome, per generation).
  addConnectionRate: number
  addNodeRate: number
  weightMutationRate: number
  biasMutationRate: number
  // When a weight mutates, chance it is nudged rather than fully replaced.
  weightPerturbChance: number
  weightStep: number
  weightRange: number

  // Speciation (compatibility distance) coefficients and threshold.
  excessCoeff: number
  disjointCoeff: number
  weightCoeff: number
  /*
   * Initial/seed value for the compatibility threshold. At runtime the engine
   * holds a mutable copy that adapts each generation toward `targetSpecies`, so
   * this value is only the starting point, not the value used throughout a run.
   */
  compatibilityThreshold: number
  /* Target number of species the adaptive threshold steers toward. */
  targetSpecies: number
  /* Fraction the threshold moves each generation, applied multiplicatively
     (e.g. 0.3 means x1.3 up or x0.7 down) so it adapts at any distance scale. */
  compatibilityThresholdStep: number
  /* Floor for the adaptive threshold so it can never collapse to zero. */
  minCompatibilityThreshold: number

  // Reproduction.
  crossoverRate: number
  // Fraction of each species (its fittest) eligible to be a parent.
  survivalThreshold: number
  // Species with fewer than this many members do not copy a champion verbatim.
  speciesElitismMin: number
  // Generations a species may go without improving before it is culled.
  stagnationLimit: number
  // Always carry the single best genome of the whole population, untouched, into
  // the next generation. Guarantees the champion can never regress.
  preserveChampion: boolean
}

export type RequiredConfig = Pick<NeatConfig, 'inputs' | 'outputs'> & Partial<NeatConfig>
