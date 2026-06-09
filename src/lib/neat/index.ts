// Public surface of the NEAT package. Import from here; everything else is an
// implementation detail. This file is the seam along which the folder could be
// extracted into its own published package.
export { Genome } from './genome'
export { Neat, defaultConfig, type NeatJSON } from './neat'
export { Rng, randomSeed } from './rng'
export type {
  ConnectionGene,
  GenomeJSON,
  NeatConfig,
  NodeGene,
  NodeType,
  RequiredConfig
} from './types'
