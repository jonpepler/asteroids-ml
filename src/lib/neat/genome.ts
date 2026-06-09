import type { InnovationTracker } from './innovation'
import { type ActivationPlan, activatePlan, compile } from './network'
import type { Rng } from './rng'
import type { ConnectionGene, GenomeJSON, NeatConfig, NodeGene } from './types'

// A genome is both the genotype (node and connection genes, with historical
// markings) and, via a compiled plan, the phenotype it activates as. Keeping the
// two together mirrors how the rest of the app wants to use a "brain": evaluate
// it, read its structure for the diagram, clone it, serialise it.

export class Genome {
  nodes: NodeGene[]
  connections: ConnectionGene[]
  // Fitness, written by the caller after evaluation. Named `score` to match how
  // the host app already talks about genomes.
  score = 0
  // The value of every node from the most recent activate(), keyed by node id.
  // Transient (not cloned or serialised); used to visualise the network firing.
  activations: Map<number, number> = new Map()
  private plan?: ActivationPlan

  constructor(nodes: NodeGene[], connections: ConnectionGene[]) {
    this.nodes = nodes
    this.connections = connections
  }

  // A minimal starting genome: inputs fully connected to outputs, no hidden
  // nodes, random weights. This is where NEAT begins, growing structure only
  // when a mutation earns its keep.
  static minimal(rng: Rng, tracker: InnovationTracker, config: NeatConfig): Genome {
    const nodes: NodeGene[] = []
    for (let i = 0; i < config.inputs; i++) nodes.push({ id: i, type: 'input', bias: 0 })
    for (let o = 0; o < config.outputs; o++) {
      nodes.push({ id: config.inputs + o, type: 'output', bias: rng.between(-1, 1) })
    }

    const connections: ConnectionGene[] = []
    for (let i = 0; i < config.inputs; i++) {
      for (let o = 0; o < config.outputs; o++) {
        const to = config.inputs + o
        connections.push({
          innovation: tracker.connection(i, to),
          from: i,
          to,
          weight: rng.between(-config.weightRange, config.weightRange),
          enabled: true
        })
      }
    }
    return new Genome(nodes, connections)
  }

  activate(input: number[]): number[] {
    if (!this.plan) this.plan = compile(this)
    this.activations = activatePlan(this.plan, input)
    return this.plan.outputIds.map((id) => this.activations.get(id) ?? 0)
  }

  private invalidate() {
    this.plan = undefined
  }

  clone(): Genome {
    const copy = new Genome(
      this.nodes.map((n) => ({ ...n })),
      this.connections.map((c) => ({ ...c }))
    )
    copy.score = this.score
    return copy
  }

  toJSON(): GenomeJSON {
    return {
      nodes: this.nodes.map((n) => ({ ...n })),
      connections: this.connections.map((c) => ({ ...c })),
      score: this.score
    }
  }

  static fromJSON(json: GenomeJSON): Genome {
    const genome = new Genome(
      json.nodes.map((n) => ({ ...n })),
      json.connections.map((c) => ({ ...c }))
    )
    genome.score = json.score ?? 0
    return genome
  }

  // --- mutation ---------------------------------------------------------------

  mutate(rng: Rng, tracker: InnovationTracker, config: NeatConfig): void {
    if (rng.bool(config.weightMutationRate)) this.mutateWeights(rng, config)
    if (rng.bool(config.biasMutationRate)) this.mutateBias(rng, config)
    if (rng.bool(config.addConnectionRate)) this.addConnection(rng, tracker, config)
    if (rng.bool(config.addNodeRate)) this.addNode(rng, tracker)
    this.invalidate()
  }

  private mutateWeights(rng: Rng, config: NeatConfig): void {
    for (const c of this.connections) {
      if (rng.bool(config.weightPerturbChance)) {
        c.weight += rng.gaussian() * config.weightStep
      } else {
        c.weight = rng.between(-config.weightRange, config.weightRange)
      }
    }
  }

  private mutateBias(rng: Rng, config: NeatConfig): void {
    for (const n of this.nodes) {
      if (n.type === 'input') continue
      if (rng.bool(config.weightPerturbChance)) n.bias += rng.gaussian() * config.weightStep
      else n.bias = rng.between(-config.weightRange, config.weightRange)
    }
  }

  private addConnection(rng: Rng, tracker: InnovationTracker, config: NeatConfig): void {
    const sources = this.nodes
    const targets = this.nodes.filter((n) => n.type !== 'input')
    // A handful of random attempts is enough; if the network is saturated we
    // simply skip adding a connection this time.
    for (let attempt = 0; attempt < 20; attempt++) {
      const from = rng.pick(sources)
      const to = rng.pick(targets)
      if (from.id === to.id) continue
      if (this.connections.some((c) => c.from === from.id && c.to === to.id)) continue
      if (this.createsCycle(from.id, to.id)) continue
      this.connections.push({
        innovation: tracker.connection(from.id, to.id),
        from: from.id,
        to: to.id,
        weight: rng.between(-config.weightRange, config.weightRange),
        enabled: true
      })
      return
    }
  }

  private addNode(rng: Rng, tracker: InnovationTracker): void {
    const enabled = this.connections.filter((c) => c.enabled)
    if (!enabled.length) return
    const split = rng.pick(enabled)
    split.enabled = false
    const newId = tracker.node()
    this.nodes.push({ id: newId, type: 'hidden', bias: 0 })
    // Splitting a connection in two with the first weight at 1 and the second at
    // the old weight keeps the network's behaviour unchanged at the moment of
    // mutation, so structure can grow without a fitness cliff.
    this.connections.push({
      innovation: tracker.connection(split.from, newId),
      from: split.from,
      to: newId,
      weight: 1,
      enabled: true
    })
    this.connections.push({
      innovation: tracker.connection(newId, split.to),
      from: newId,
      to: split.to,
      weight: split.weight,
      enabled: true
    })
  }

  // True if adding from -> to would close a loop, i.e. `to` can already reach
  // `from`. Considers every gene (enabled or not) so a later re-enable can never
  // introduce a cycle. This is what keeps the network strictly feed-forward.
  private createsCycle(from: number, to: number): boolean {
    if (from === to) return true
    const adjacency = new Map<number, number[]>()
    for (const c of this.connections) {
      const list = adjacency.get(c.from)
      if (list) list.push(c.to)
      else adjacency.set(c.from, [c.to])
    }
    const stack = [to]
    const seen = new Set<number>()
    while (stack.length) {
      const node = stack.pop() as number
      if (node === from) return true
      if (seen.has(node)) continue
      seen.add(node)
      for (const next of adjacency.get(node) ?? []) stack.push(next)
    }
    return false
  }

  // --- crossover & distance ---------------------------------------------------

  // Breed a child from two parents. Matching genes (same innovation) are
  // inherited at random; genes present in only one parent are taken from the
  // fitter one. Caller passes the fitter parent first.
  static crossover(fitter: Genome, other: Genome, rng: Rng): Genome {
    const otherByInnovation = new Map(other.connections.map((c) => [c.innovation, c]))
    const childConnections: ConnectionGene[] = []
    const nodeIds = new Set<number>()

    for (const gene of fitter.connections) {
      const match = otherByInnovation.get(gene.innovation)
      const chosen = match && rng.bool(0.5) ? match : gene
      const inherited = { ...chosen }
      // A gene disabled in either parent has a chance to stay disabled.
      if (match && (!gene.enabled || !match.enabled) && rng.bool(0.75)) inherited.enabled = false
      childConnections.push(inherited)
      nodeIds.add(inherited.from)
      nodeIds.add(inherited.to)
    }

    // Carry node genes (with their biases) needed by the inherited connections,
    // plus every input and output node so the interface is always intact.
    const fitterNodes = new Map(fitter.nodes.map((n) => [n.id, n]))
    const childNodes: NodeGene[] = []
    for (const n of fitter.nodes) {
      if (n.type !== 'hidden' || nodeIds.has(n.id)) childNodes.push({ ...n })
    }
    for (const id of nodeIds) {
      if (!fitterNodes.has(id)) {
        const fromOther = other.nodes.find((n) => n.id === id)
        if (fromOther) childNodes.push({ ...fromOther })
      }
    }
    return new Genome(childNodes, childConnections)
  }

  // Compatibility distance, the measure NEAT speciates on: how structurally far
  // apart two genomes are, by counting genes they do not share and how much
  // their shared weights differ.
  distance(other: Genome, config: NeatConfig): number {
    const a = new Map(this.connections.map((c) => [c.innovation, c]))
    const b = new Map(other.connections.map((c) => [c.innovation, c]))
    const maxA = this.connections.reduce((m, c) => Math.max(m, c.innovation), 0)
    const maxB = other.connections.reduce((m, c) => Math.max(m, c.innovation), 0)
    const boundary = Math.min(maxA, maxB)

    let disjoint = 0
    let excess = 0
    let matchingWeightDiff = 0
    let matching = 0
    const innovations = new Set([...a.keys(), ...b.keys()])
    for (const innovation of innovations) {
      const inA = a.get(innovation)
      const inB = b.get(innovation)
      if (inA && inB) {
        matching++
        matchingWeightDiff += Math.abs(inA.weight - inB.weight)
      } else if (innovation > boundary) {
        excess++
      } else {
        disjoint++
      }
    }

    const n = Math.max(1, this.connections.length, other.connections.length)
    const avgWeightDiff = matching ? matchingWeightDiff / matching : 0
    return (
      (config.excessCoeff * excess) / n +
      (config.disjointCoeff * disjoint) / n +
      config.weightCoeff * avgWeightDiff
    )
  }
}
