// Minimal type shim for @liquid-carrot/carrot (the published package ships no
// types). Covers only the surface this project uses: the NEAT trainer and the
// network/node/connection shape read when drawing the brain graph.
declare module '@liquid-carrot/carrot' {
  export interface CarrotNode {
    index: number
  }

  export interface CarrotConnection {
    from: CarrotNode
    to: CarrotNode
    weight: number
  }

  export interface Network {
    score?: number
    nodes: CarrotNode[]
    connections: CarrotConnection[]
    input_nodes: Set<CarrotNode>
    output_nodes: Set<CarrotNode>
    activate(input: number[]): number[]
    clone(): Network
    toJSON(): NetworkJSON
  }

  export interface NetworkJSON {
    score?: number
    [key: string]: unknown
  }

  export interface NeatOptions {
    population_size?: number
    elitism?: number
    [key: string]: unknown
  }

  export class Neat {
    constructor(inputs: number, outputs: number, options?: NeatOptions)
    population: Network[]
    population_size: number
    elitism: number
    generation: number
    sort(): void
    getOffspring(): Network
    mutate(): void
    toJSON(): NetworkJSON[]
    fromJSON(json: NetworkJSON[]): void
  }

  export const methods: Record<string, unknown>
}
