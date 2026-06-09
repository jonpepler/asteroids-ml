// Tracks historical markings ("innovation numbers") for structural mutations.
// Two connections created at different times but between the same node ids are
// the same innovation, which is what lets crossover line up genes from parents
// that have diverged structurally. A single tracker is shared by a whole run.

export class InnovationTracker {
  private nextInnovation: number
  private nextNodeId: number
  private connectionKeys = new Map<string, number>()

  constructor(startInnovation = 0, startNodeId = 0) {
    this.nextInnovation = startInnovation
    this.nextNodeId = startNodeId
  }

  // The innovation number for a connection between two nodes. The same pair
  // always maps to the same number for the lifetime of the run.
  connection(from: number, to: number): number {
    const key = `${from}:${to}`
    const existing = this.connectionKeys.get(key)
    if (existing !== undefined) return existing
    const innovation = this.nextInnovation++
    this.connectionKeys.set(key, innovation)
    return innovation
  }

  // A fresh node id (used when an add-node mutation splits a connection).
  node(): number {
    return this.nextNodeId++
  }

  // Rebuild the counters after loading a saved population so new mutations never
  // reuse an existing id or innovation number.
  static fromGenomeBounds(maxNodeId: number, maxInnovation: number): InnovationTracker {
    return new InnovationTracker(maxInnovation + 1, maxNodeId + 1)
  }
}
