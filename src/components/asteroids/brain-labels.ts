/*
 * Human-readable names for the champion's neurons, derived from the fixed node
 * id convention the NEAT engine assigns (see Genome.fromScratch and the input
 * order built in GameInstance.generateBrainInput):
 *   ids 0..15  inputs: the 16 vision whiskers, long-range first then short.
 *   ids 16..19 outputs: fire, thrust, turn-left, turn-right (mapOutputToKeys).
 *   ids 20+    hidden: structure the network grew on its own.
 */

export const BRAIN_INPUTS = 16
export const BRAIN_OUTPUTS = 4
const LONG_WHISKERS = BRAIN_INPUTS / 2

export type NodeKind = 'input' | 'output' | 'hidden'

export interface NodeLabel {
  kind: NodeKind
  name: string
  detail: string
}

// Bearing relative to the ship's nose, where 0 is dead ahead and angle grows
// clockwise. Rounded, since short-range whiskers sit on half-degree offsets.
const describeBearing = (angle: number): string => {
  const a = ((angle % 360) + 360) % 360
  if (a === 0) return 'dead ahead'
  if (a === 180) return 'directly behind'
  if (a < 180) return `${Math.round(a)}° to the right`
  return `${Math.round(360 - a)}° to the left`
}

const outputs: NodeLabel[] = [
  { kind: 'output', name: 'Fire', detail: 'Fires a bullet while active' },
  { kind: 'output', name: 'Thrust', detail: 'Boosts the ship forward while active' },
  { kind: 'output', name: 'Turn left', detail: 'Rotates the ship anticlockwise while active' },
  { kind: 'output', name: 'Turn right', detail: 'Rotates the ship clockwise while active' }
]

export const describeNode = (id: number): NodeLabel => {
  if (id < BRAIN_INPUTS) {
    const long = id < LONG_WHISKERS
    const index = long ? id : id - LONG_WHISKERS
    const angle = long ? 45 * index : 22.5 + 45 * index
    return {
      kind: 'input',
      name: long ? 'Long-range sensor' : 'Short-range sensor',
      detail: `Distance to the nearest asteroid ${describeBearing(angle)} (1.0 = clear)`
    }
  }
  if (id < BRAIN_INPUTS + BRAIN_OUTPUTS) {
    return outputs[id - BRAIN_INPUTS]
  }
  return {
    kind: 'hidden',
    name: `Hidden neuron #${id}`,
    detail: 'A signal the network learned to combine from other neurons'
  }
}
