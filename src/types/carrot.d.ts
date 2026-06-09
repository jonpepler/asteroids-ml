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

  export class Network {
    score?: number
    nodes: CarrotNode[]
    connections: CarrotConnection[]
    input_nodes: Set<CarrotNode>
    output_nodes: Set<CarrotNode>
    activate(input: number[]): number[]
    clone(): Network
    toJSON(): NetworkJSON
    static fromJSON(json: NetworkJSON): Network
  }

  export interface NetworkJSON {
    score?: number
    [key: string]: unknown
  }

  export type MutationMethod = unknown

  export interface NeatOptions {
    population_size?: number
    elitism?: number
    mutation?: MutationMethod[]
    selection?: unknown
    [key: string]: unknown
  }

  export class Neat {
    constructor(inputs: number, outputs: number, options?: NeatOptions)
    population: Network[]
    population_size: number
    elitism: number
    generation: number
    mutation: MutationMethod[]
    sort(): void
    getOffspring(): Network
    mutate(method?: MutationMethod[]): void
    toJSON(): NetworkJSON[]
    fromJSON(json: NetworkJSON[]): void
  }

  export const methods: {
    mutation: {
      FFW: MutationMethod[]
      ALL: MutationMethod[]
      [key: string]: MutationMethod[] | MutationMethod
    }
    selection: Record<string, unknown>
    cost: Record<string, unknown>
    [key: string]: unknown
  }
}
