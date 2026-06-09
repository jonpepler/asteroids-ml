import type { ConnectionGene, NodeGene } from './types'

// Compiles a genome (genotype) into a feed-forward evaluation plan (phenotype)
// and runs it. The task this package was built for (reacting to whisker sensors)
// is stateless, so networks are strictly feed-forward: no recurrent or gated
// connections, which keeps activation a single ordered pass with no per-tick
// state to manage.

// NEAT's steepened sigmoid. Keeps outputs in (0, 1) so a caller can threshold at
// 0.5 to turn an output into a yes/no action.
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-4.9 * x))

export interface ActivationPlan {
  inputIds: number[]
  outputIds: number[]
  // Hidden and output node ids in the order they must be evaluated.
  order: number[]
  incoming: Map<number, { from: number; weight: number }[]>
  bias: Map<number, number>
}

interface GenomeShape {
  nodes: NodeGene[]
  connections: ConnectionGene[]
}

// Kahn topological sort over the enabled connections. The genome is guaranteed
// acyclic by the mutation code, so this always produces a complete ordering.
export const compile = ({ nodes, connections }: GenomeShape): ActivationPlan => {
  const inputIds = nodes.filter((n) => n.type === 'input').map((n) => n.id)
  const outputIds = nodes.filter((n) => n.type === 'output').map((n) => n.id)
  const bias = new Map(nodes.map((n) => [n.id, n.bias]))

  const incoming = new Map<number, { from: number; weight: number }[]>()
  const inDegree = new Map<number, number>(nodes.map((n) => [n.id, 0]))
  for (const c of connections) {
    if (!c.enabled) continue
    const list = incoming.get(c.to)
    if (list) list.push({ from: c.from, weight: c.weight })
    else incoming.set(c.to, [{ from: c.from, weight: c.weight }])
    inDegree.set(c.to, (inDegree.get(c.to) ?? 0) + 1)
  }

  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id)
  const sorted: number[] = []
  const enabledOut = new Map<number, number[]>()
  for (const c of connections) {
    if (!c.enabled) continue
    const list = enabledOut.get(c.from)
    if (list) list.push(c.to)
    else enabledOut.set(c.from, [c.to])
  }
  while (queue.length) {
    const id = queue.shift() as number
    sorted.push(id)
    for (const to of enabledOut.get(id) ?? []) {
      const remaining = (inDegree.get(to) ?? 0) - 1
      inDegree.set(to, remaining)
      if (remaining === 0) queue.push(to)
    }
  }

  const inputSet = new Set(inputIds)
  const order = sorted.filter((id) => !inputSet.has(id))
  return { inputIds, outputIds, order, incoming, bias }
}

export const activatePlan = (plan: ActivationPlan, input: number[]): number[] => {
  const values = new Map<number, number>()
  plan.inputIds.forEach((id, i) => values.set(id, input[i] ?? 0))

  for (const id of plan.order) {
    let sum = plan.bias.get(id) ?? 0
    for (const edge of plan.incoming.get(id) ?? []) {
      sum += (values.get(edge.from) ?? 0) * edge.weight
    }
    values.set(id, sigmoid(sum))
  }

  return plan.outputIds.map((id) => values.get(id) ?? 0)
}
